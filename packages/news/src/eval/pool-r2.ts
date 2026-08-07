// pool-r2.ts — join puro snapshots-R2 × población-DB por url_hash (D-133b-1, 133-b-01).
//
// El texto de los 579 casos de la ventana (titular + descripción) NO vive en Supabase:
// `noticia_url_vista` solo guarda seis columnas de ledger (url_hash, url_canonica, outlet,
// estado, causa, primera_vista), y los estratos N-alea/N-sonda se construyen sobre
// DESCARTADOS, que por definición no llegan a `noticia`. Este módulo re-deriva ese texto
// desde el crudo inmutable de R2 — Supabase aporta la población y el veredicto del
// pre-filtro, R2 aporta el texto — y prueba que la reconstrucción es TOTAL: un `url_hash`
// sin contraparte NUNCA se silencia (entra en `faltantes`/`sobrantes`), porque silenciarlo
// sesgaría el estrato sin dejar rastro (T-133-30).
//
// Primera aplicación del régimen de dos etapas de CLAUDE.md (R2 = verdad cruda, Supabase =
// derivado reconstruible) a un consumidor que NO es el cargador. La fuente jamás se
// re-scrapea aquí: este módulo es PURO (cero red, cero DB, cero fs) — la única I/O del plan
// vive en pool-r2-cli.ts.

import { z } from "zod";
import { urlHash } from "../canonicalizar-url.js";
import { parseRss } from "../parse-rss.js";

/** Reflejo de las columnas REALES de `noticia_url_vista` — no inventar columnas de texto. */
export interface PoblacionRow {
  url_hash: string;
  url_canonica: string;
  outlet: string;
  estado: string;
  causa: string | null;
}

/** Un snapshot de R2 ya leído (XML crudo) — la I/O ocurre en pool-r2-cli.ts. */
export interface SnapshotCrudo {
  r2Path: string;
  dateBucket: string;
  outlet: string;
  xml: string;
}

export const PoolCasoSchema = z
  .object({
    caso_id: z.string().min(1),
    url_hash: z.string().min(1),
    url_canonica: z.string().min(1),
    outlet: z.string().min(1),
    estado: z.string().min(1),
    causa: z.string().nullable(),
    titulo: z.string().min(1),
    descripcion: z.string().nullable(),
    fecha_pub: z.string().nullable(),
    r2_path: z.string().min(1),
    date_bucket: z.string().min(1),
  })
  .strict();

export type PoolCaso = z.infer<typeof PoolCasoSchema>;

export interface PoolStats {
  snapshots: number;
  itemsParseados: number;
  hashesUnicos: number;
  erroresParseo: number;
  sinDescripcion: number;
  porOutlet: Record<string, number>;
  titulosVacios: number;
}

export interface PoolResultado {
  casos: PoolCaso[];
  faltantes: PoblacionRow[];
  sobrantes: PoolCaso[];
  tasaReconstruccion: number;
  stats: PoolStats;
}

/** Ítem colapsado por `url_hash`, con el `date_bucket`/`r2_path` más antiguo conservado. */
interface Colapsado {
  hash: string;
  dateBucket: string;
  r2Path: string;
  outlet: string;
  titulo: string;
  descripcion: string | null;
  fechaPub: string | null;
}

/**
 * Join puro: `snapshots` (XML ya leídos de R2) × `poblacion` (filas ya consultadas de
 * `noticia_url_vista`), por `url_hash` — recalculado siempre con `urlHash` real, nunca
 * tomado del XML ni inferido. Cero red, cero DB, cero fs.
 */
export async function construirPool(input: {
  snapshots: readonly SnapshotCrudo[];
  poblacion: readonly PoblacionRow[];
}): Promise<PoolResultado> {
  const { snapshots, poblacion } = input;

  // Cero vacuo (T-133-31): una tasa de 1.0 sobre cero casos no prueba nada.
  if (poblacion.length === 0) {
    throw new Error(
      "construirPool: poblacion vacía — una tasa de reconstrucción de 1.0 sobre cero casos " +
        "es el cero vacuo que D-133b-1 prohíbe.",
    );
  }

  const erroresParseo: string[] = [];
  let itemsParseados = 0;

  // Colapso por hash: conserva el date_bucket lexicográficamente MENOR. Las fechas son
  // strings "YYYY-MM-DD" ⇒ orden lexicográfico == orden cronológico. Prohibida la conversión
  // a objeto fecha nativo para esta comparación (gotcha rector de tz, v9.0/v12.0).
  const porHash = new Map<string, Colapsado>();

  for (const snap of snapshots) {
    const { items, errores } = parseRss(snap.xml, snap.outlet);
    for (const e of errores) erroresParseo.push(`${snap.r2Path}: ${e}`);
    itemsParseados += items.length;

    for (const item of items) {
      let hash: string;
      try {
        // El hash se RECALCULA con la función real del cargador — nunca reimplementado, y
        // nunca tomado del XML: dos links que difieren solo en utm_* deben colapsar igual
        // que en carga-run.ts.
        hash = await urlHash(item.link);
      } catch (err) {
        erroresParseo.push(
          `${snap.r2Path}: urlHash falló para "${item.link}": ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        continue;
      }

      const existente = porHash.get(hash);
      if (existente == null || snap.dateBucket < existente.dateBucket) {
        porHash.set(hash, {
          hash,
          dateBucket: snap.dateBucket,
          r2Path: snap.r2Path,
          outlet: snap.outlet,
          titulo: item.titulo,
          descripcion: item.descripcion,
          fechaPub: item.fechaPub,
        });
      }
    }
  }

  const poblacionPorHash = new Map(poblacion.map((p) => [p.url_hash, p]));

  const casos: PoolCaso[] = [];
  const sobrantes: PoolCaso[] = [];
  let sinDescripcion = 0;
  let titulosVacios = 0;
  const porOutlet: Record<string, number> = {};

  for (const [hash, c] of porHash) {
    const pob = poblacionPorHash.get(hash);

    if (pob == null) {
      // Crudo reconstruido sin contraparte en la población de Postgres: sobrante explícito,
      // jamás omitido en silencio.
      sobrantes.push({
        caso_id: `${c.outlet}:${hash.slice(0, 12)}`,
        url_hash: hash,
        url_canonica: "",
        outlet: c.outlet,
        estado: "sobrante",
        causa: null,
        titulo: c.titulo,
        descripcion: c.descripcion,
        fecha_pub: c.fechaPub,
        r2_path: c.r2Path,
        date_bucket: c.dateBucket,
      });
      continue;
    }

    const caso: PoolCaso = {
      caso_id: `${c.outlet}:${hash.slice(0, 12)}`,
      url_hash: hash,
      url_canonica: pob.url_canonica,
      outlet: c.outlet,
      estado: pob.estado,
      causa: pob.causa,
      titulo: c.titulo,
      descripcion: c.descripcion,
      fecha_pub: c.fechaPub,
      r2_path: c.r2Path,
      date_bucket: c.dateBucket,
    };
    casos.push(caso);

    const descripcionTrim = (caso.descripcion ?? "").trim();
    if (descripcionTrim.length === 0) sinDescripcion += 1;
    if (caso.titulo.trim().length === 0) titulosVacios += 1;
    if (pob.estado === "pasa") {
      porOutlet[c.outlet] = (porOutlet[c.outlet] ?? 0) + 1;
    }
  }

  // Población presente en Postgres sin contraparte en el crudo reconstruido: faltante
  // explícito (T-133-30) — jamás se omite en silencio, porque silenciarlo sesga el estrato.
  const hashesEncontrados = new Set(casos.map((c) => c.url_hash));
  const faltantes = poblacion.filter((p) => !hashesEncontrados.has(p.url_hash));

  // Comparador explícito de strings — PROHIBIDO un método de comparación sensible a
  // locale/ICU (rompería el orden total que 133-b-02 necesita).
  casos.sort((a, b) => (a.url_hash < b.url_hash ? -1 : a.url_hash > b.url_hash ? 1 : 0));

  const tasaReconstruccion = casos.length / poblacion.length;

  return {
    casos,
    faltantes,
    sobrantes,
    tasaReconstruccion,
    stats: {
      snapshots: snapshots.length,
      itemsParseados,
      hashesUnicos: porHash.size,
      erroresParseo: erroresParseo.length,
      sinDescripcion,
      porOutlet,
      titulosVacios,
    },
  };
}
