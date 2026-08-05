// carga-run — Etapa 2 orquestada: ítems parseados → filas en `noticia` y `noticia_url_vista`
// (132-05). Analog: packages/tramitacion/src/ingest-run.ts (colaboradores por parámetro,
// conteos + `errores[]` para degradación honesta sin abortar el lote).
//
// ── ORDEN LOCKED (D-07/Pitfall 11 + CR-02, 132-09) — NO REORDENAR ───────────────────
// La URL se marca vista (`writer.marcarVistas`) ANTES de cualquier camino de rechazo
// (`esLegislativo`), pero con un estado PROVISIONAL NEUTRO (`'pendiente'`, causa=null) — NUNCA
// con la causa final. CR-02: escribir la causa final (`descarta/prefiltro_lexico`) en el
// marcado provisional es un veredicto emitido antes de conocer el resultado; si el ítem SÍ pasa
// el pre-filtro pero la escritura final falla (red, 5xx, timeout), esa causa falsa queda
// PERMANENTE y el dedup nivel 1 nunca vuelve a evaluar el ítem — pérdida definitiva del dato.
// Por eso la causa final se promueve en el MISMO paso en que la decisión se toma, nunca antes.
// Pipeline exacto:
//   1. canonicalizar URL + urlHash; colapsar duplicados DENTRO del lote (dedup nivel 2).
//   2. writer.urlsYaVistas(hashes) → ya RESUELTOS (pasa/descarta) = duplicados, SIN re-evaluar
//      el pre-filtro (dedup nivel 1, D-13). Los `pendiente` NO cuentan como vistos: son
//      re-evaluables (CR-02).
//   3. writer.marcarVistas(...) para TODOS los ítems nuevos con estado='pendiente', causa=null
//      — ANTES de aplicar esLegislativo. Si esta escritura falla, el ítem se acumula en
//      `errores[]` y no se procesa más en esta corrida (queda sin marcar, re-evaluable igual).
//   4. esLegislativo(titulo, descripcion):
//      - NO pasa → promoción inmediata a estado='descarta', causa='prefiltro_lexico'
//        (marcarVistas). Si esa promoción falla, el ítem queda `pendiente` (re-evaluable) y se
//        acumula en `errores[]` — NUNCA se cuenta como descartado sin que la promoción haya
//        tenido éxito.
//      - SÍ pasa → writer.upsertNoticias([fila]); solo si tuvo éxito, promoción a
//        estado='pasa', causa=null. Cualquier fallo en cualquiera de los dos pasos deja la fila
//        en `pendiente` (re-evaluable) y se acumula en `errores[]`.
//   5. Log final con los 5 conteos y los errores.
//
// Cero red: este módulo no hace peticiones HTTP ni construye clientes de base de datos — todos
// los colaboradores (writer, log) entran por parámetro (RunIngestOpts-style), así los tests
// corren sin red ni DB.

import { canonicalizarUrl, urlHash } from "./canonicalizar-url";
import { esLegislativo, despojarHtml } from "./prefiltro-lexico";
import type { NewsWriter, NoticiaRow, UrlVistaRow } from "./writer";
import type { RssItem } from "./model";

export interface CargarOpts {
  items: RssItem[];
  r2Path: string;
  contenidoHash: string;
  writer: NewsWriter;
  log: (s: string) => void;
}

export interface CargarResult {
  vistos: number;
  nuevos: number;
  duplicados: number;
  descartados: number;
  cargados: number;
  /** `ref` (IN-04): hash resuelto del ítem, o la URL cruda cuando el fallo ocurrió ANTES de
   *  poder calcular el hash (etapa "canonicalizar") — nunca se llama `urlHash` a algo que no
   *  siempre es un hash. */
  errores: { ref: string; etapa: string; mensaje: string }[];
}

/** Ítem del lote ya canonicalizado, previo a cualquier decisión de descarte. */
interface ItemCanonico {
  item: RssItem;
  urlHash: string;
  urlCanonica: string;
}

/**
 * Corre la Etapa 2: de ítems parseados a filas en `noticia` y `noticia_url_vista`.
 * Idempotente: re-correr con el mismo input no duplica filas (el writer upserta por
 * `url_hash`) y la segunda corrida reporta los ítems ya vistos como `duplicados`.
 */
export async function cargar(opts: CargarOpts): Promise<CargarResult> {
  const { items, r2Path, contenidoHash, writer, log } = opts;
  const errores: CargarResult["errores"] = [];

  // 1. Canonicalizar + hashear; colapsar duplicados DENTRO del lote (dedup nivel 2, D-13:
  //    dos ítems del mismo lote cuyas URLs difieren solo en utm_* colapsan a una sola fila).
  const porHash = new Map<string, ItemCanonico>();
  for (const item of items) {
    let urlCanonica: string;
    let hash: string;
    try {
      urlCanonica = canonicalizarUrl(item.link);
      hash = await urlHash(item.link);
    } catch (err) {
      errores.push({
        ref: item.link,
        etapa: "canonicalizar",
        mensaje: err instanceof Error ? err.message : String(err),
      });
      continue;
    }
    porHash.set(hash, { item, urlHash: hash, urlCanonica });
  }

  const vistos = porHash.size;
  const hashes = [...porHash.keys()];

  // 2. Dedup nivel 1 (D-13): ya vistos en corridas anteriores → duplicados, SIN re-evaluar
  //    el pre-filtro (esLegislativo NO se llama para ellos).
  const yaVistos = await writer.urlsYaVistas(hashes);
  const nuevosEntries = [...porHash.entries()].filter(([h]) => !yaVistos.has(h));
  const duplicados = yaVistos.size;
  const nuevos = nuevosEntries.length;

  let descartados = 0;
  let cargados = 0;

  for (const [hash, canon] of nuevosEntries) {
    const { item, urlCanonica } = canon;

    // 3. ORDEN LOCKED (CR-02): marcar vista con estado PROVISIONAL NEUTRO ANTES de
    //    esLegislativo. Jamás la causa final aquí — ver cabecera del archivo.
    const provisional: UrlVistaRow = {
      url_hash: hash,
      url_canonica: urlCanonica,
      outlet: item.outlet,
      estado: "pendiente",
      causa: null,
    };
    try {
      await writer.marcarVistas([provisional]);
    } catch (err) {
      errores.push({
        ref: hash,
        etapa: "marcarVistas-provisional",
        mensaje: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    // 4. Pre-filtro léxico (D-05/D-06, recall-first): ocurre DESPUÉS del marcado provisional.
    const pasa = esLegislativo(item.titulo, item.descripcion);

    if (!pasa) {
      // Promoción a causa final en el MISMO paso en que la decisión se toma (CR-02). Si la
      // promoción falla, el ítem queda `pendiente` (re-evaluable) — NUNCA se cuenta como
      // descartado sin que el ledger lo confirme.
      try {
        await writer.marcarVistas([
          {
            url_hash: hash,
            url_canonica: urlCanonica,
            outlet: item.outlet,
            estado: "descarta",
            causa: "prefiltro_lexico",
          },
        ]);
      } catch (err) {
        errores.push({
          ref: hash,
          etapa: "marcarVistas-descarte",
          mensaje: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
      descartados += 1;
      continue;
    }

    // 5. Pasa el pre-filtro: fila de `noticia` (descripción despojada de HTML, WR-17) +
    //    actualización final del ledger — solo si el upsert tuvo éxito.
    const fila: NoticiaRow = {
      url_hash: hash,
      url: item.link,
      url_canonica: urlCanonica,
      titular: item.titulo,
      outlet: item.outlet,
      fecha_pub: item.fechaPub,
      descripcion: despojarHtml(item.descripcion ?? "") || null,
      r2_path: r2Path,
      contenido_hash: contenidoHash,
      estado: "pendiente",
    };

    try {
      await writer.upsertNoticias([fila]);
    } catch (err) {
      errores.push({
        ref: hash,
        etapa: "upsertNoticias",
        mensaje: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    try {
      await writer.marcarVistas([
        { url_hash: hash, url_canonica: urlCanonica, outlet: item.outlet, estado: "pasa", causa: null },
      ]);
    } catch (err) {
      errores.push({
        ref: hash,
        etapa: "marcarVistas-final",
        mensaje: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    cargados += 1;
  }

  log(
    `carga: vistos=${vistos} nuevos=${nuevos} duplicados=${duplicados} ` +
      `descartados=${descartados} cargados=${cargados} errores=${errores.length}`,
  );
  for (const e of errores) {
    log(`carga: ERROR ${e.ref} [${e.etapa}]: ${e.mensaje}`);
  }

  return { vistos, nuevos, duplicados, descartados, cargados, errores };
}
