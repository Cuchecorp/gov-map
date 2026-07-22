import { describe, it, expect } from "vitest";
import { parseCamaraLegislativo } from "./parse-camara-legislativo";

// Fixture inline capturado LIVE de WSLegislativo.asmx/retornarMocionesXAnno?prmAnno=2024
// (2026-07-10, UA identificatorio, rate-limit respetado — UNA sola llamada). El shape confirmado:
//   root wrapper <ProyectosLeyColeccion>, items <ProyectoLey>, boletín en <NumeroBoletin>,
//   namespace default `http://opendata.camara.cl/camaradiputados/v1` (fast-xml-parser lo ignora).
const XML_MULTIPLE = `<?xml version="1.0" encoding="utf-8"?>
<ProyectosLeyColeccion xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://opendata.camara.cl/camaradiputados/v1">
  <ProyectoLey>
    <Id>17140</Id>
    <NumeroBoletin>16572-06</NumeroBoletin>
    <Nombre>Modifica cuerpos legales que indica para fortalecer el rol de las juntas de vecinos</Nombre>
    <FechaIngreso>2024-01-10T00:00:00</FechaIngreso>
    <TipoIniciativa Valor="2">Moción</TipoIniciativa>
    <CamaraOrigen Valor="1">Cámara de Diputados</CamaraOrigen>
    <Admisible>true</Admisible>
  </ProyectoLey>
  <ProyectoLey>
    <Id>17424</Id>
    <NumeroBoletin>16818-07</NumeroBoletin>
    <Nombre>Modifica diversos cuerpos legales</Nombre>
    <FechaIngreso>2024-05-06T00:00:00</FechaIngreso>
    <TipoIniciativa Valor="2">Moción</TipoIniciativa>
    <CamaraOrigen Valor="1">Cámara de Diputados</CamaraOrigen>
    <Admisible>true</Admisible>
  </ProyectoLey>
  <ProyectoLey>
    <Id>17498</Id>
    <NumeroBoletin>16879-15</NumeroBoletin>
    <Nombre>Modifica la ley N° 18.290, de Tránsito</Nombre>
    <FechaIngreso>2024-05-27T00:00:00</FechaIngreso>
    <TipoIniciativa Valor="2">Moción</TipoIniciativa>
    <CamaraOrigen Valor="2">Senado</CamaraOrigen>
    <Admisible>true</Admisible>
  </ProyectoLey>
</ProyectosLeyColeccion>`;

// Colección con UN SOLO ProyectoLey → fast-xml-parser lo colapsa a objeto (no array).
const XML_SINGLE = `<?xml version="1.0" encoding="utf-8"?>
<ProyectosLeyColeccion xmlns="http://opendata.camara.cl/camaradiputados/v1">
  <ProyectoLey>
    <Id>17667</Id>
    <NumeroBoletin>17053-15</NumeroBoletin>
    <Nombre>Modifica la ley N° 18.290, de Tránsito</Nombre>
    <FechaIngreso>2024-08-12T00:00:00</FechaIngreso>
    <TipoIniciativa Valor="2">Moción</TipoIniciativa>
    <CamaraOrigen Valor="1">Cámara de Diputados</CamaraOrigen>
  </ProyectoLey>
</ProyectosLeyColeccion>`;

// Colección con boletines inválidos entremezclados (basura del WS o mal formados).
const XML_INVALIDOS = `<?xml version="1.0" encoding="utf-8"?>
<ProyectosLeyColeccion xmlns="http://opendata.camara.cl/camaradiputados/v1">
  <ProyectoLey>
    <Id>1</Id>
    <NumeroBoletin>12345-06</NumeroBoletin>
    <Nombre>Válido</Nombre>
  </ProyectoLey>
  <ProyectoLey>
    <Id>2</Id>
    <NumeroBoletin>no-es-un-boletin</NumeroBoletin>
    <Nombre>Boletín ilegible</Nombre>
  </ProyectoLey>
  <ProyectoLey>
    <Id>3</Id>
    <NumeroBoletin></NumeroBoletin>
    <Nombre>Boletín vacío</Nombre>
  </ProyectoLey>
  <ProyectoLey>
    <Id>4</Id>
    <NumeroBoletin>16572-06</NumeroBoletin>
    <Nombre>Duplicado válido — se dedup</Nombre>
  </ProyectoLey>
  <ProyectoLey>
    <Id>5</Id>
    <NumeroBoletin>16572-06</NumeroBoletin>
    <Nombre>Repetido — mismo boletín</Nombre>
  </ProyectoLey>
</ProyectosLeyColeccion>`;

// ── Fixtures para los nuevos tests de prmId (Task 1, 89-01) ──────────────────────────────────
// Un ProyectoLey con Id presente → prmId debe venir en el resultado.
const XML_CON_ID = `<?xml version="1.0" encoding="utf-8"?>
<ProyectosLeyColeccion xmlns="http://opendata.camara.cl/camaradiputados/v1">
  <ProyectoLey>
    <Id>17140</Id>
    <NumeroBoletin>16572-06</NumeroBoletin>
    <Nombre>Test con Id</Nombre>
  </ProyectoLey>
</ProyectosLeyColeccion>`;

// Un ProyectoLey sin nodo <Id> → prmId null (no descartado, no lanza).
const XML_SIN_ID = `<?xml version="1.0" encoding="utf-8"?>
<ProyectosLeyColeccion xmlns="http://opendata.camara.cl/camaradiputados/v1">
  <ProyectoLey>
    <NumeroBoletin>16572-06</NumeroBoletin>
    <Nombre>Test sin Id</Nombre>
  </ProyectoLey>
</ProyectosLeyColeccion>`;

// Un ProyectoLey con NumeroBoletin inválido → DESCARTADO (no aparece en el output, no lanza).
const XML_BOLETIN_INVALIDO = `<?xml version="1.0" encoding="utf-8"?>
<ProyectosLeyColeccion xmlns="http://opendata.camara.cl/camaradiputados/v1">
  <ProyectoLey>
    <Id>99</Id>
    <NumeroBoletin>no-valido</NumeroBoletin>
    <Nombre>Boletín inválido debe descartarse</Nombre>
  </ProyectoLey>
</ProyectosLeyColeccion>`;

describe("parseCamaraLegislativo (WSLegislativo → {boletin, prmId}[])", () => {
  // ── Tests originales (backward-compat con el nuevo shape) ─────────────────
  it("Test 1: parsea múltiples ProyectoLey → array de {boletin, prmId}", () => {
    const result = parseCamaraLegislativo(XML_MULTIPLE);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.boletin)).toEqual(["16572-06", "16818-07", "16879-15"]);
    // Los tres tienen Id presente → prmId no null.
    expect(result[0]).toEqual({ boletin: "16572-06", prmId: "17140" });
    expect(result[1]).toEqual({ boletin: "16818-07", prmId: "17424" });
    expect(result[2]).toEqual({ boletin: "16879-15", prmId: "17498" });
  });

  it("Test 2: colapsa un nodo único (objeto, no array) a lista de 1", () => {
    const result = parseCamaraLegislativo(XML_SINGLE);
    expect(result).toEqual([{ boletin: "17053-15", prmId: "17667" }]);
  });

  it("Test 3: descarta boletines que no matchean /^\\d{3,6}-\\d{1,3}$/ (no lanza) y dedup", () => {
    const result = parseCamaraLegislativo(XML_INVALIDOS);
    const boletines = result.map((r) => r.boletin);
    // "no-es-un-boletin" y "" descartados; "16572-06" deduplicado → una sola vez.
    expect(boletines).toEqual(["12345-06", "16572-06"]);
    expect(boletines).not.toContain("no-es-un-boletin");
    expect(boletines).not.toContain("");
  });

  it("Test 4: XML sin colección (shape inválido) → [] (zod rechaza, no lanza)", () => {
    const result = parseCamaraLegislativo(
      `<?xml version="1.0"?><Otro><Cosa>x</Cosa></Otro>`,
    );
    expect(result).toEqual([]);
  });

  it("XML vacío/basura → [] sin lanzar", () => {
    expect(parseCamaraLegislativo("")).toEqual([]);
    expect(parseCamaraLegislativo("<root/>")).toEqual([]);
  });

  // ── Tests nuevos para prmId (Task 1 behavior, 89-01) ─────────────────────
  it("prmId-1: ProyectoLey con <Id>17140</Id> y boletín 16572-06 → {boletin:'16572-06', prmId:'17140'}", () => {
    const result = parseCamaraLegislativo(XML_CON_ID);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ boletin: "16572-06", prmId: "17140" });
  });

  it("prmId-2: ProyectoLey sin <Id> → {boletin, prmId: null} (no lanza, no descarta la fila)", () => {
    const result = parseCamaraLegislativo(XML_SIN_ID);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ boletin: "16572-06", prmId: null });
  });

  it("prmId-3: ProyectoLey con NumeroBoletin inválido → DESCARTADO (continue), no lanza", () => {
    expect(() => parseCamaraLegislativo(XML_BOLETIN_INVALIDO)).not.toThrow();
    const result = parseCamaraLegislativo(XML_BOLETIN_INVALIDO);
    expect(result).toEqual([]); // descartado por fail-soft idiom LOCKED
  });
});
