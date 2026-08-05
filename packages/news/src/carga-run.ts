// carga-run — Etapa 2 orquestada: ítems parseados → filas en `noticia` y `noticia_url_vista`
// (132-05). Analog: packages/tramitacion/src/ingest-run.ts (colaboradores por parámetro,
// conteos + `errores[]` para degradación honesta sin abortar el lote).
//
// ── ORDEN LOCKED (D-07/Pitfall 11) — NO REORDENAR ──────────────────────────────────
// La URL se marca vista (`writer.marcarVistas`) ANTES de cualquier camino de rechazo
// (`esLegislativo`). Si se invierte, un ítem descartado se re-procesa eternamente en la
// siguiente corrida (nunca queda en el ledger) y el conteo de descartes por causa queda
// inflado/incorrecto. Pipeline exacto:
//   1. canonicalizar URL + urlHash; colapsar duplicados DENTRO del lote (dedup nivel 2).
//   2. writer.urlsYaVistas(hashes) → ya vistos = duplicados, SIN re-evaluar el pre-filtro
//      (dedup nivel 1, D-13).
//   3. writer.marcarVistas(...) para TODOS los ítems nuevos, con estado/causa PROVISORIOS —
//      ANTES de aplicar esLegislativo.
//   4. esLegislativo(titulo, descripcion): pasa → fila `noticia` + ledger estado='pasa'; no
//      pasa → ledger estado='descarta', causa='prefiltro_lexico'.
//   5. writer.upsertNoticias(filas) para los que pasaron.
//   6. Log final con los 5 conteos y los errores.
//
// Cero red: este módulo no hace peticiones HTTP ni construye clientes de base de datos — todos
// los colaboradores (writer, log) entran por parámetro (RunIngestOpts-style), así los tests
// corren sin red ni DB.

import { canonicalizarUrl, urlHash } from "./canonicalizar-url";
import { esLegislativo } from "./prefiltro-lexico";
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
  errores: { urlHash: string; etapa: string; mensaje: string }[];
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
        urlHash: item.link,
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

    // 3. ORDEN LOCKED: marcar vista con estado/causa PROVISORIOS ANTES de esLegislativo.
    //    Si el proceso muere entre este marcado y la carga, se re-procesa un ítem ya marcado
    //    (aceptable); el orden inverso perdería el registro del descarte.
    const provisional: UrlVistaRow = {
      url_hash: hash,
      url_canonica: urlCanonica,
      outlet: item.outlet,
      estado: "descarta",
      causa: "prefiltro_lexico",
    };
    try {
      await writer.marcarVistas([provisional]);
    } catch (err) {
      errores.push({
        urlHash: hash,
        etapa: "marcarVistas-provisional",
        mensaje: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    // 4. Pre-filtro léxico (D-05/D-06, recall-first): ocurre DESPUÉS del marcado provisional.
    const pasa = esLegislativo(item.titulo, item.descripcion);

    if (!pasa) {
      descartados += 1;
      continue;
    }

    // 5. Pasa el pre-filtro: fila de `noticia` + actualización final del ledger.
    const fila: NoticiaRow = {
      url_hash: hash,
      url: item.link,
      url_canonica: urlCanonica,
      titular: item.titulo,
      outlet: item.outlet,
      fecha_pub: item.fechaPub,
      descripcion: item.descripcion,
      r2_path: r2Path,
      contenido_hash: contenidoHash,
      estado: "pendiente",
    };

    try {
      await writer.upsertNoticias([fila]);
    } catch (err) {
      errores.push({
        urlHash: hash,
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
        urlHash: hash,
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
    log(`carga: ERROR ${e.urlHash} [${e.etapa}]: ${e.mensaje}`);
  }

  return { vistos, nuevos, duplicados, descartados, cargados, errores };
}
