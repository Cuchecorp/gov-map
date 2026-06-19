// parse-servel — parser del .xlsx de SERVEL -> `Aporte[]` VERBATIM. FUNCION PURA sin red, sin LLM.
//
// LITERAL, SIN modelo de lenguaje: cada campo se copia tal cual (el `monto` como string crudo, sin
// computo; la `eleccion` compuesta verbatim). GATE DE HEADER-TEXT (Pattern 2 del research):
//   - los headers viven en la FILA 4 de la unica hoja; se leen, se normalizan
//     (`String(h).trim().toUpperCase()`) y se comparan contra `EXPECTED_HEADERS` (los 11 literales).
//   - una columna renombrada / faltante / reordenada => THROW "drift estructural SERVEL" (cuarentena
//     aguas arriba). NUNCA se mapea por indice posicional; NUNCA 0 filas silenciosas.
//   - una fila sin `eleccion` construible es drift => THROW (eleccion es NON-NULL en 0024).
//
// La clave de version del aporte es (`fuenteId` = hash de la fila + eleccion, `fechaCorte`).

import ExcelJS from "exceljs";
import {
  AporteSheetSchema,
  ORIGEN_SERVEL,
  LICENCIA_SERVEL,
  fuenteIdDe,
  type Aporte,
  type AporteSheet,
  type TipoPersonaDonante,
} from "./model-servel";

/** Fila (1-based) de la hoja donde viven los headers VERBATIM. */
export const HEADER_ROW = 4;

/**
 * CR-01 (Phase 16): normaliza el "TIPO APORTANTE" verbatim de SERVEL al MISMO enum
 * canonico `'juridica' | 'natural'` que usa el lado ChileCompra (`model.ts`), de modo que
 * el filtro PII load-bearing del RPC publico `agregado_por_contraparte`
 * (`tipo_persona = 'juridica'`) matchee la data realmente almacenada — sin esta
 * normalizacion el filtro NUNCA coincide con labels como "Persona Juridica" y el carril de
 * aportes queda muerto / la garantia PII se vuelve coincidencia.
 *
 * FAIL-CLOSED por diseno: solo un label que mapee inequivocamente a juridica devuelve
 * `'juridica'`; cualquier otra cosa (natural, desconocido, vacio, null) cae a `'natural'`
 * -> NUNCA se expone por nombre una contraparte que no sea claramente persona juridica.
 * La comparacion es case-insensitive y accent-insensitive ("Persona Juridica",
 * "PERSONA JURÍDICA", "Jurídica" -> 'juridica').
 */
export function normalizarTipoPersona(
  bruto: string | null | undefined,
): TipoPersonaDonante {
  if (bruto == null) return "natural";
  // Minuscula + quitar tildes (translate manual ASCII-fold) + colapsar espacios.
  const sinTilde = bruto
    .toLowerCase()
    .replace(/[áàä]/g, "a")
    .replace(/[éèë]/g, "e")
    .replace(/[íìï]/g, "i")
    .replace(/[óòö]/g, "o")
    .replace(/[úùü]/g, "u")
    .replace(/\s+/g, " ")
    .trim();
  if (sinTilde === "") return "natural";
  // "persona juridica" / "juridica" / "p. juridica" ... cualquier mencion clara a juridica.
  if (sinTilde.includes("juridica")) return "juridica";
  // Todo lo demas (natural, desconocido) NO se expone: fail-closed.
  return "natural";
}

/**
 * Los 11 headers EXACTOS (UPPERCASE), en el orden VERBATIM de la fuente. El gate compara por TEXTO,
 * no por posicion: cada uno DEBE estar presente; si falta/renombra cualquiera -> drift -> THROW.
 */
export const EXPECTED_HEADERS: readonly string[] = [
  "TIPO DE APORTE",
  "NOMBRE APORTANTE",
  "TIPO APORTANTE",
  "NOMBRE CANDIDATO-PARTIDO POLITICO",
  "TIPO DONATARIO",
  "ELECCION",
  "TERRITORIO ELECTORAL",
  "PACTO",
  "PARTIDO",
  "FECHA DE TRANSFERENCIA",
  "MONTO",
] as const;

/** Normaliza un valor de celda a string crudo (verbatim, trim), o null si vacio. */
function celdaStr(v: ExcelJS.CellValue | undefined): string | null {
  if (v === null || v === undefined) return null;
  // exceljs puede devolver objetos para celdas con formula/rich-text/fecha. Para VERBATIM
  // preferimos el `.text`/`.result` cuando existe; el numero/fecha se vuelca a string sin computo.
  if (typeof v === "object") {
    const o = v as unknown as Record<string, unknown>;
    if (typeof o.text === "string") {
      const t = o.text.trim();
      return t === "" ? null : t;
    }
    if (o.result !== undefined && o.result !== null) {
      const t = String(o.result).trim();
      return t === "" ? null : t;
    }
    if (o.richText && Array.isArray(o.richText)) {
      const t = (o.richText as { text?: string }[]).map((r) => r.text ?? "").join("").trim();
      return t === "" ? null : t;
    }
    // Fecha (Date) u otro objeto: volcar a string sin reinterpretar.
    const t = String(v).trim();
    return t === "" ? null : t;
  }
  const t = String(v).trim();
  return t === "" ? null : t;
}

/** Normaliza un header de celda para comparar contra EXPECTED_HEADERS (trim + uppercase). */
function headerNorm(v: ExcelJS.CellValue | undefined): string {
  const s = celdaStr(v);
  return (s ?? "").toUpperCase();
}

export interface ParseAportesOpts {
  /** Anio de la eleccion (lo provee el caller; entra en la `eleccion` compuesta verbatim). */
  anio?: string | null;
  /** Fecha de corte de la ingesta (ancla de version). Default: hoy (ISO date). */
  fechaCorte?: string;
  /** Enlace base de la fuente (la URL del .xlsx). */
  enlace?: string;
  /** Momento de captura ISO (procedencia determinista en tests). */
  fechaCaptura?: string;
}

/**
 * Lee el workbook desde los BYTES del .xlsx (pura, sin red). Devuelve la primera hoja.
 */
async function leerHoja(bytes: Uint8Array): Promise<ExcelJS.Worksheet> {
  const wb = new ExcelJS.Workbook();
  // exceljs acepta un Buffer/ArrayBuffer. Convertimos sin copiar el contenido (vista del buffer).
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  await wb.xlsx.load(ab);
  const ws = wb.worksheets[0];
  if (!ws) {
    throw new Error("drift estructural SERVEL: el .xlsx no tiene ninguna hoja");
  }
  return ws;
}

/**
 * Construye la `eleccion` compuesta verbatim a partir de los campos de la fila + el anio. NON-NULL:
 * el periodo DEBE nacer de un componente DE LA FILA (ELECCION y/o TERRITORIO). El `anio` es un
 * constante per-run (`--anio`) y SOLO se anexa cuando ya hay un componente de fila; NUNCA sustituye
 * un periodo de fila ausente. Si la fila no trae ni ELECCION ni TERRITORIO -> null (drift -> el
 * caller THROW, cuarentena run-level), aunque `--anio` venga seteado: una fila con el anio como unico
 * "periodo" mal-agruparia el aporte en la ficha (WR-01).
 */
function componerEleccion(
  eleccionCol: string | null,
  territorio: string | null,
  anio: string | null | undefined,
): string | null {
  const partesFila = [eleccionCol, territorio].filter(
    (p): p is string => p != null && p !== "",
  );
  // Sin NINGUN componente de fila -> no hay periodo construible (el anio NO sustituye). Drift.
  if (partesFila.length === 0) return null;
  const anioStr = anio != null && anio !== "" ? anio : null;
  const partes = anioStr != null ? [...partesFila, anioStr] : partesFila;
  return partes.join(" - ");
}

/**
 * Parsea los BYTES de un .xlsx de SERVEL -> `Aporte[]` VERBATIM. Valida los headers por TEXTO; un
 * header renombrado/faltante/reordenado LANZA (drift estructural -> cuarentena aguas arriba). Una
 * fila sin `eleccion` construible LANZA. NUNCA fabrica, NUNCA mapea por indice posicional ciego.
 */
export async function parseAportes(bytes: Uint8Array, opts: ParseAportesOpts = {}): Promise<Aporte[]> {
  const fechaCorte = opts.fechaCorte ?? new Date().toISOString().slice(0, 10);
  const fechaCaptura = opts.fechaCaptura ?? new Date().toISOString();
  const enlace = opts.enlace ?? "";
  const anio = opts.anio ?? null;

  const ws = await leerHoja(bytes);

  // GATE DE HEADER-TEXT: leer la fila 4, normalizar, y mapear EXPECTED_HEADERS -> indice de columna
  // por TEXTO (no por posicion). Cualquier header esperado ausente -> drift -> THROW.
  const headerRow = ws.getRow(HEADER_ROW);
  const headerPorTexto = new Map<string, number>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const norm = headerNorm(cell.value);
    if (norm !== "" && !headerPorTexto.has(norm)) headerPorTexto.set(norm, colNumber);
  });

  const faltantes = EXPECTED_HEADERS.filter((h) => !headerPorTexto.has(h));
  if (faltantes.length > 0) {
    throw new Error(
      `drift estructural SERVEL: faltan/cambiaron columnas [${faltantes.join(", ")}] ` +
        `(headers leidos en fila ${HEADER_ROW}: [${[...headerPorTexto.keys()].join(", ")}])`,
    );
  }

  // Indice de columna por header (por TEXTO; resuelto arriba). Reordenar la fuente NO rompe.
  const col = (h: string): number => headerPorTexto.get(h)!;
  const C = {
    tipoAporte: col("TIPO DE APORTE"),
    donanteNombre: col("NOMBRE APORTANTE"),
    tipoAportante: col("TIPO APORTANTE"),
    candidatoNombre: col("NOMBRE CANDIDATO-PARTIDO POLITICO"),
    tipoDonatario: col("TIPO DONATARIO"),
    eleccionCol: col("ELECCION"),
    territorio: col("TERRITORIO ELECTORAL"),
    pacto: col("PACTO"),
    partido: col("PARTIDO"),
    fechaTransferencia: col("FECHA DE TRANSFERENCIA"),
    monto: col("MONTO"),
  };

  const out: Aporte[] = [];
  const ultimaFila = ws.rowCount;
  for (let r = HEADER_ROW + 1; r <= ultimaFila; r++) {
    const row = ws.getRow(r);
    const cruda: AporteSheet = AporteSheetSchema.parse({
      tipoAporte: celdaStr(row.getCell(C.tipoAporte).value),
      donanteNombre: celdaStr(row.getCell(C.donanteNombre).value),
      tipoAportante: celdaStr(row.getCell(C.tipoAportante).value),
      candidatoNombre: celdaStr(row.getCell(C.candidatoNombre).value),
      tipoDonatario: celdaStr(row.getCell(C.tipoDonatario).value),
      eleccionCol: celdaStr(row.getCell(C.eleccionCol).value),
      territorio: celdaStr(row.getCell(C.territorio).value),
      pacto: celdaStr(row.getCell(C.pacto).value),
      partido: celdaStr(row.getCell(C.partido).value),
      fechaTransferencia: celdaStr(row.getCell(C.fechaTransferencia).value),
      monto: celdaStr(row.getCell(C.monto).value),
    });

    // Fila totalmente vacia (TODAS las 11 celdas mapeadas null): se omite (no es una fila de aporte).
    // WR-02: el chequeo cubre las 11 columnas, NO solo las 6 "clave". Una fila con contenido SOLO en
    // columnas no-clave (fecha, tipo aportante/donatario, pacto, partido) ya NO se descarta en silencio:
    // pasa este guard, llega a componerEleccion y -- si no trae ELECCION/TERRITORIO -- THROW (cuarentena
    // run-level). "Una fila silenciosa es peor que ninguna fila": nunca un descarte silencioso de
    // contenido real.
    const algunDato =
      cruda.tipoAporte ||
      cruda.donanteNombre ||
      cruda.tipoAportante ||
      cruda.candidatoNombre ||
      cruda.tipoDonatario ||
      cruda.eleccionCol ||
      cruda.territorio ||
      cruda.pacto ||
      cruda.partido ||
      cruda.fechaTransferencia ||
      cruda.monto;
    if (!algunDato) continue;

    const eleccion = componerEleccion(cruda.eleccionCol, cruda.territorio, anio);
    if (eleccion === null) {
      // `eleccion` es NON-NULL (campo siempre-presente de la ficha). Una fila con datos pero sin
      // un componente de periodo DE LA FILA (ELECCION/TERRITORIO) es drift -> THROW (cuarentena de
      // TODA la corrida aguas arriba). El --anio NO sustituye un periodo de fila ausente (WR-01).
      throw new Error(
        `drift estructural SERVEL: fila ${r} sin eleccion construible (ELECCION y TERRITORIO vacios; --anio no sustituye)`,
      );
    }

    out.push({
      fuenteId: fuenteIdDe(cruda, eleccion),
      fechaCorte,
      eleccion,
      donanteNombre: cruda.donanteNombre,
      // CR-01: NORMALIZADO al enum canonico 'juridica'|'natural' (fail-closed). El label
      // verbatim "TIPO APORTANTE" NUNCA es la llave del filtro PII publico.
      tipoPersona: normalizarTipoPersona(cruda.tipoAportante),
      monto: cruda.monto, // VERBATIM string crudo, NUNCA numeric.
      fechaAporte: cruda.fechaTransferencia,
      tipoAporte: cruda.tipoAporte,
      candidatoNombreVerbatim: cruda.candidatoNombre,
      territorio: cruda.territorio,
      pacto: cruda.pacto,
      partido: cruda.partido,
      origen: ORIGEN_SERVEL,
      fecha_captura: fechaCaptura,
      enlace,
      licencia: LICENCIA_SERVEL,
    });
  }

  // Orden estable por fuenteId (determinista para tests/idempotencia).
  out.sort((a, b) => a.fuenteId.localeCompare(b.fuenteId));
  return out;
}
