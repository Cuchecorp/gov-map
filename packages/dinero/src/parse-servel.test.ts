// parse-servel.test — parser xlsx VERBATIM + gate de header-text que THROW en drift. Sin red, sin LLM.
//
// Invariantes:
//  - 11 headers exactos en fila 4 -> Aporte[] VERBATIM (monto string crudo, eleccion compuesta verbatim).
//  - un header renombrado/faltante/reordenado -> THROW "drift estructural SERVEL".
//  - una fila con datos pero sin eleccion construible -> THROW (eleccion es NON-NULL).

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  parseAportes,
  normalizarTipoPersona,
  EXPECTED_HEADERS,
  HEADER_ROW,
} from "./parse-servel";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(here, "..", "test-fixtures", "servel-sample.xlsx");

async function fixtureBytes(): Promise<Uint8Array> {
  return new Uint8Array(await readFile(FIXTURE));
}

/** Construye un .xlsx en memoria con headers + filas dados (headers en HEADER_ROW). */
async function xlsxConHeaders(headers: string[], filas: string[][]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Aportes");
  ws.getRow(1).getCell(1).value = "meta";
  headers.forEach((h, i) => (ws.getRow(HEADER_ROW).getCell(i + 1).value = h));
  filas.forEach((f, ri) => f.forEach((v, ci) => (ws.getRow(HEADER_ROW + 1 + ri).getCell(ci + 1).value = v)));
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

describe("parseAportes — VERBATIM + gate de header-text", () => {
  it("11 headers exactos -> Aporte[] VERBATIM con monto string y eleccion compuesta", async () => {
    const aportes = await parseAportes(await fixtureBytes(), {
      anio: "2025",
      fechaCorte: "2026-06-19",
      enlace: "https://repodocgastoelectoral.blob.core.windows.net/x.xlsx",
      fechaCaptura: "2026-06-19T00:00:00Z",
    });

    expect(aportes.length).toBe(5);
    // monto es string crudo VERBATIM (nunca numeric).
    for (const a of aportes) {
      expect(typeof a.monto).toBe("string");
      expect(a.eleccion).not.toBe("");
      expect(a.licencia).toBe("terminos por verificar");
      expect(a.origen).toBe("servel");
    }
    // eleccion compuesta verbatim: ELECCION - TERRITORIO - anio.
    const diputado = aportes.find((a) => a.eleccion.startsWith("DIPUTADO"));
    expect(diputado?.eleccion).toBe("DIPUTADO - DISTRITO 23 - 2025");
    // candidato verbatim preservado; donante verbatim preservado (incl. "-" anonimo).
    const anon = aportes.find((a) => a.tipoAporte === "Aporte menor anonimo");
    expect(anon?.donanteNombre).toBe("-");
    expect(anon?.candidatoNombreVerbatim).toBe("Bianchi Ch., Carlos");
    expect(anon?.monto).toBe("50000");
  });

  it("header renombrado (MONTO -> IMPORTE) -> THROW drift estructural", async () => {
    const headers = EXPECTED_HEADERS.map((h) => (h === "MONTO" ? "IMPORTE" : h));
    const bytes = await xlsxConHeaders([...headers], [
      ["Aporte", "Donante", "Natural", "Cand X", "Candidato", "DIPUTADO", "DISTRITO 1", "P", "Q", "2025-01-01", "100"],
    ]);
    await expect(parseAportes(bytes, { anio: "2025" })).rejects.toThrow(/drift estructural SERVEL/);
  });

  it("header faltante (sin MONTO) -> THROW drift estructural", async () => {
    const headers = EXPECTED_HEADERS.filter((h) => h !== "MONTO");
    const bytes = await xlsxConHeaders([...headers], [
      ["Aporte", "Donante", "Natural", "Cand X", "Candidato", "DIPUTADO", "DISTRITO 1", "P", "Q", "2025-01-01"],
    ]);
    await expect(parseAportes(bytes, { anio: "2025" })).rejects.toThrow(/drift estructural SERVEL/);
  });

  it("headers reordenados pero todos presentes -> NO drift (gate por TEXTO, no posicion)", async () => {
    // Invertimos el orden de los 11 headers; el mapeo por TEXTO debe seguir funcionando.
    const headers = [...EXPECTED_HEADERS].reverse();
    // fila en el MISMO orden invertido de columnas.
    const filaInv = ["100", "2025-01-01", "Q", "P", "DISTRITO 1", "DIPUTADO", "Candidato", "Cand X", "Natural", "Donante Z", "Aporte"];
    const bytes = await xlsxConHeaders([...headers], [filaInv]);
    const aportes = await parseAportes(bytes, { anio: "2025" });
    expect(aportes.length).toBe(1);
    expect(aportes[0]!.monto).toBe("100");
    expect(aportes[0]!.donanteNombre).toBe("Donante Z");
    expect(aportes[0]!.eleccion).toBe("DIPUTADO - DISTRITO 1 - 2025");
  });

  it("fila con datos pero sin eleccion construible -> THROW (eleccion NON-NULL)", async () => {
    // Sin ELECCION, sin TERRITORIO, sin anio -> no hay eleccion construible.
    const bytes = await xlsxConHeaders([...EXPECTED_HEADERS], [
      ["Aporte", "Donante", "Natural", "Cand X", "Candidato", "", "", "P", "Q", "2025-01-01", "100"],
    ]);
    await expect(parseAportes(bytes, { anio: null })).rejects.toThrow(/sin eleccion construible/);
  });

  it("WR-01: --anio seteado NO sustituye un periodo de fila ausente -> THROW (cuarentena run-level)", async () => {
    // ELECCION y TERRITORIO vacios PERO --anio presente (el camino LIVE normal). El anio NO debe
    // colar como periodo: una fila sin componente de periodo de fila es drift -> THROW (0 filas).
    const bytes = await xlsxConHeaders([...EXPECTED_HEADERS], [
      ["Aporte", "Donante", "Natural", "Cand X", "Candidato", "", "", "P", "Q", "2025-01-01", "100"],
    ]);
    await expect(parseAportes(bytes, { anio: "2025" })).rejects.toThrow(/sin eleccion construible/);
  });

  it("WR-01: con --anio + un componente de fila presente -> eleccion compuesta (anio se anexa)", async () => {
    // Solo TERRITORIO presente (ELECCION vacia) + --anio: el anio se ANEXA al componente de fila.
    const bytes = await xlsxConHeaders([...EXPECTED_HEADERS], [
      ["Aporte", "Donante", "Natural", "Cand X", "Candidato", "", "DISTRITO 7", "P", "Q", "2025-01-01", "100"],
    ]);
    const aportes = await parseAportes(bytes, { anio: "2025" });
    expect(aportes.length).toBe(1);
    expect(aportes[0]!.eleccion).toBe("DISTRITO 7 - 2025");
  });

  it("WR-02: fila con datos SOLO en columnas no-clave -> NO se descarta en silencio (THROW)", async () => {
    // Las 6 columnas "clave" (tipoAporte/donante/candidato/eleccion/territorio/monto) vacias, pero
    // fechaTransferencia + tipoAportante + tipoDonatario + pacto + partido con contenido real. Antes
    // se descartaba en silencio; ahora pasa el guard y -- sin ELECCION/TERRITORIO -- THROW (cuarentena).
    const bytes = await xlsxConHeaders([...EXPECTED_HEADERS], [
      ["", "", "Natural", "", "Donatario", "", "", "PACTO Z", "PARTIDO Q", "2025-01-01", ""],
    ]);
    await expect(parseAportes(bytes, { anio: "2025" })).rejects.toThrow(/sin eleccion construible/);
  });

  it("WR-02: fila 100% vacia (todas las 11 celdas null) -> se omite (no es drift)", async () => {
    // Una fila genuinamente vacia NO es una fila de aporte; se omite sin THROW (no es contenido real).
    const bytes = await xlsxConHeaders([...EXPECTED_HEADERS], [
      ["Aporte", "Donante", "Natural", "Cand X", "Candidato", "DIPUTADO", "DISTRITO 1", "P", "Q", "2025-01-01", "100"],
      ["", "", "", "", "", "", "", "", "", "", ""],
    ]);
    const aportes = await parseAportes(bytes, { anio: "2025" });
    expect(aportes.length).toBe(1); // la fila vacia se omite; solo la real persiste.
  });

  // CR-01 (Phase 16): el "TIPO APORTANTE" verbatim se NORMALIZA al enum canonico
  // 'juridica'|'natural' en el parse, de modo que el filtro PII del RPC
  // `agregado_por_contraparte` (`tipo_persona = 'juridica'`) matchee la data almacenada.
  it("CR-01: tipoPersona se normaliza al enum canonico en el Aporte parseado", async () => {
    const bytes = await xlsxConHeaders([...EXPECTED_HEADERS], [
      // tipoAportante = "Persona Jurídica" (con tilde + caja mixta, como en la fuente).
      ["Aporte", "Empresa X", "Persona Jurídica", "Cand X", "Candidato", "DIPUTADO", "DISTRITO 1", "P", "Q", "2025-01-01", "100"],
      // tipoAportante = "Persona Natural".
      ["Aporte", "Perez P., Juan", "Persona Natural", "Cand Y", "Candidato", "DIPUTADO", "DISTRITO 1", "P", "Q", "2025-01-02", "200"],
    ]);
    const aportes = await parseAportes(bytes, { anio: "2025" });
    expect(aportes.length).toBe(2);
    const empresa = aportes.find((a) => a.donanteNombre === "Empresa X");
    const persona = aportes.find((a) => a.donanteNombre === "Perez P., Juan");
    // "Persona Jurídica" -> 'juridica' (matchea el filtro PII del RPC).
    expect(empresa?.tipoPersona).toBe("juridica");
    // "Persona Natural" -> 'natural' (NUNCA matchea el filtro 'juridica').
    expect(persona?.tipoPersona).toBe("natural");
    expect(persona?.tipoPersona).not.toBe("juridica");
  });
});

describe("normalizarTipoPersona — enum canonico fail-closed (CR-01)", () => {
  it("mapea labels juridica (caja/tilde/variantes) -> 'juridica'", () => {
    for (const v of [
      "Persona Jurídica",
      "PERSONA JURIDICA",
      "persona juridica",
      "Jurídica",
      "JURIDICA",
      "  Persona   Jurídica  ",
    ]) {
      expect(normalizarTipoPersona(v)).toBe("juridica");
    }
  });

  it("mapea labels natural -> 'natural'", () => {
    for (const v of ["Persona Natural", "PERSONA NATURAL", "natural", "Natural"]) {
      expect(normalizarTipoPersona(v)).toBe("natural");
    }
  });

  it("FAIL-CLOSED: vacio/null/desconocido -> 'natural' (NUNCA 'juridica')", () => {
    for (const v of [null, undefined, "", "   ", "PJ", "empresa", "?", "otro"]) {
      expect(normalizarTipoPersona(v)).toBe("natural");
      expect(normalizarTipoPersona(v)).not.toBe("juridica");
    }
  });
});
