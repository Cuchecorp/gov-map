// parse-camara-legislativo — XML de WSLegislativo (opendata.camara.cl) → {boletin, prmId}[].
//
// Fuente (verificada LIVE 2026-07-10): WSLegislativo.asmx/retornarMocionesXAnno?prmAnno={año}
// y retornarMensajesXAnno. El WS de VOTACIONES devuelve [] para enumeración por año
// (anti-patrón conocido) — WSLegislativo es la fuente correcta para enumerar el histórico.
//
// Shape confirmado LIVE:
//   <ProyectosLeyColeccion xmlns="http://opendata.camara.cl/camaradiputados/v1">
//     <ProyectoLey>
//       <Id>17140</Id>
//       <NumeroBoletin>16572-06</NumeroBoletin>
//       <Nombre>...</Nombre>
//       <FechaIngreso>2024-01-10T00:00:00</FechaIngreso>
//       <TipoIniciativa Valor="2">Moción</TipoIniciativa>
//       <CamaraOrigen Valor="1">Cámara de Diputados</CamaraOrigen>
//     </ProyectoLey>
//     ...
//   </ProyectosLeyColeccion>
//
// El namespace default lo ignora fast-xml-parser (no `removeNSPrefix` necesario: los tags no
// llevan prefijo). El idiom (XMLParser config + txt/asArray) es copia verbatim de
// parse-camara-votacion.ts. Cada ProyectoLey se valida con `ProyectoLeySchema` (zod) ANTES de
// aceptarlo (compuerta de contrato de fuente, CLAUDE.md); los inválidos se DESCARTAN, no lanzan.
//
// Change (89-01 TRACE-01): el `<Id>` (prmID interno de Cámara) ya se leía pero se descartaba.
// Ahora se incluye en el return como `prmId: string | null` (null si ausente). Esto permite
// persistir el deep-link de tramitación:
//   https://www.camara.cl/legislacion/ProyectosDeLey/tramitacion.aspx?prmID={prmId}&prmBOLETIN={boletin}
// El idiom fail-soft (continue en boletin inválido) se preserva INTACTO.

import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });

/** Boletín bien formado `NNNNN-NN` (mismo regex de defensa que el prod-CLI). */
const BOLETIN_RE = /^\d{3,6}-\d{1,3}$/;

/** Texto de un nodo: string-no-vacío o null (self-closing → {} / ""). Copia de parse-camara-votacion. */
function txt(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object") {
    // fast-xml-parser con atributos: el texto vive en "#text".
    const t = (v as Record<string, unknown>)["#text"];
    if (t == null) return null;
    const s = String(t).trim();
    return s.length === 0 ? null : s;
  }
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

/** fast-xml-parser colapsa un nodo único a objeto; fuerza a array. Copia de parse-camara-votacion. */
function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return ([] as T[]).concat(v as T | T[]);
}

/**
 * Compuerta de contrato de fuente (CLAUDE.md "validación de esquema"): un ProyectoLey se acepta
 * solo si su `NumeroBoletin` es un boletín bien formado. `Nombre` e `Id` son opcionales.
 * Se valida por ELEMENTO — un elemento inválido se descarta, no aborta la colección.
 */
const ProyectoLeySchema = z.object({
  NumeroBoletin: z.string().regex(BOLETIN_RE),
  Nombre: z.string().optional(),
  Id: z.string().optional(),
});

/** Par {boletin, prmId} emitido por el parser. prmId es null si el XML no trae <Id>. */
export interface CamaraProyectoPar {
  boletin: string;
  /** ID interno de la Cámara (<Id> de WSLegislativo). Null si el WS no lo entregó. */
  prmId: string | null;
}

/**
 * Parsea la respuesta de `retornarMocionesXAnno`/`retornarMensajesXAnno` → lista de pares
 * `{boletin, prmId}` deduplicados (por boletín) que pasan el regex de boletín. Los boletines
 * malformados/ausentes se DESCARTAN (not lanzan); un XML sin colección devuelve [] (zod rechaza,
 * fail-closed). `prmId` es null si el elemento no trae `<Id>` (no descarta la fila).
 */
export function parseCamaraLegislativo(xml: string): CamaraProyectoPar[] {
  let doc: unknown;
  try {
    doc = parser.parse(xml);
  } catch {
    return []; // XML ilegible → [] (no lanza; el caller es best-effort por op)
  }

  const root = (doc ?? {}) as Record<string, unknown>;
  const coleccion = (root.ProyectosLeyColeccion ?? {}) as Record<string, unknown>;
  // El nodo <ProyectoLey> puede colgar de la colección o (defensivo) del root.
  const lista = asArray<Record<string, unknown>>(
    (coleccion.ProyectoLey ?? root.ProyectoLey) as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined,
  );

  const vistos = new Set<string>();
  const out: CamaraProyectoPar[] = [];
  for (const p of lista) {
    const numeroBoletin = txt(p.NumeroBoletin);
    const nombre = txt(p.Nombre);
    const id = txt(p.Id);
    // zod-validate-before-return: el shape debe cumplir el contrato o se descarta.
    const parsed = ProyectoLeySchema.safeParse({
      NumeroBoletin: numeroBoletin ?? "",
      ...(nombre != null ? { Nombre: nombre } : {}),
      ...(id != null ? { Id: id } : {}),
    });
    if (!parsed.success) continue; // inválido → descartar, NO lanzar (idiom LOCKED)
    const bol = parsed.data.NumeroBoletin;
    if (!vistos.has(bol)) {
      vistos.add(bol);
      out.push({ boletin: bol, prmId: parsed.data.Id ?? null });
    }
  }
  return out;
}
