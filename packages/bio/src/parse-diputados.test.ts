// parse-diputados.test — el "test que MUERDE" del allowlist de minimización (Ley 21.719) +
// mapeo de militancia con "actual" correcta + fail-loud ante fecha malformada.
//
// El fixture __fixtures__/diputados-periodo-actual.xml trae DELIBERADAMENTE PII sintética
// (<RUT>12345678-9</RUT>, <FechaNacimiento>, <Sexo>Femenino</Sexo>). El parser DEBE dropearla
// por construcción: el modelo emitido nunca la contiene. Si el parser la copiara, el test muerde.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseDiputadosBio, FechaInvalidaError, IdNoEscalarError } from "./parse-diputados";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(here, "__fixtures__", "diputados-periodo-actual.xml");

function cargar() {
  const xml = readFileSync(FIXTURE, "utf8");
  return parseDiputadosBio(xml, {
    fechaCaptura: "2026-07-22T00:00:00Z",
    corte: new Date("2026-03-11T12:00:00"),
  });
}

describe("parse-diputados — allowlist por construcción (test que MUERDE)", () => {
  it("el fixture SÍ contiene PII (control): RUT/FechaNacimiento/Sexo presentes en el crudo", () => {
    const xml = readFileSync(FIXTURE, "utf8");
    expect(xml).toContain("12345678");
    expect(xml).toContain("FechaNacimiento");
    expect(xml).toContain("Femenino");
  });

  it("el modelo parseado NO contiene RUT/FechaNacimiento/Sexo (PII dropeada por construcción)", () => {
    const parsed = cargar();
    const json = JSON.stringify(parsed);
    expect(json).not.toContain("12345678");
    expect(json).not.toContain("13284574");
    expect(json).not.toContain("FechaNacimiento");
    expect(json).not.toContain("1975-04-24");
    expect(json).not.toContain("Femenino");
    expect(json).not.toContain("Masculino");
  });
});

describe("parse-diputados — militancia + DIPID", () => {
  it("emite DIPID = <Id> del <Diputado> como clave de match", () => {
    const parsed = cargar();
    const dipids = parsed.map((d) => d.dipid).sort();
    expect(dipids).toEqual(["1009", "1074"]);
  });

  it("mapea cada <Militancia> a { partido, partidoAlias, desde, hasta, esActual }", () => {
    const parsed = cargar();
    const santibanez = parsed.find((d) => d.dipid === "1074")!;
    expect(santibanez.militancias).toHaveLength(2);
    const historica = santibanez.militancias.find((m) => m.partidoAlias === "PRO")!;
    expect(historica.partido).toBe("Partido Progresista");
    expect(historica.desde).toBe("2018-01-01T00:00:00");
    expect(historica.hasta).toBe("2021-12-31T00:00:00");
    expect(historica.esActual).toBe(false);
  });

  it("'actual' = militancia con FechaTermino abierta/más futura (NO la primera del XML)", () => {
    const parsed = cargar();
    const santibanez = parsed.find((d) => d.dipid === "1074")!;
    // La PRIMERA militancia del XML es la histórica (PRO); la actual es PC (FechaTermino nil).
    const actual = santibanez.militancias.filter((m) => m.esActual);
    expect(actual).toHaveLength(1);
    expect(actual[0]!.partidoAlias).toBe("PC");
    expect(actual[0]!.hasta).toBeNull();
  });

  it("nombre normalizado disponible para el match (materno-less), sin PII", () => {
    const parsed = cargar();
    const boric = parsed.find((d) => d.dipid === "1009")!;
    expect(boric.nombreNormalizado).toContain("boric");
    expect(boric.nombreNormalizado).not.toContain("1986");
  });
});

describe("parse-diputados — fail-loud", () => {
  it("lanza FechaInvalidaError ante una fecha de militancia malformada (no Invalid Date silencioso)", () => {
    const xmlMalo = `<?xml version="1.0"?>
<DiputadosPeriodoColeccion>
  <DiputadoPeriodo><Diputado>
    <Id>9999</Id><Nombre>Test</Nombre><ApellidoPaterno>Malo</ApellidoPaterno><ApellidoMaterno>Fecha</ApellidoMaterno>
    <Militancias><Militancia>
      <FechaInicio>no-es-fecha</FechaInicio><FechaTermino />
      <Partido><Id>X</Id><Nombre>X</Nombre><Alias>X</Alias></Partido>
    </Militancia></Militancias>
  </Diputado></DiputadoPeriodo>
</DiputadosPeriodoColeccion>`;
    expect(() => parseDiputadosBio(xmlMalo)).toThrow(FechaInvalidaError);
  });

  it("WR-04: <Id> presente pero no escalar (nesting inesperado) → LANZA (no skip silencioso)", () => {
    // <Id> con hijo → fast-xml-parser lo entrega como objeto. str() lo colapsaria a null (skip
    // silencioso, cobertura menguada sin error); strMatchKey debe LANZAR para que la deriva surja.
    const xmlIdObjeto = `<?xml version="1.0"?>
<DiputadosPeriodoColeccion>
  <DiputadoPeriodo><Diputado>
    <Id><Interno>5</Interno></Id><Nombre>Test</Nombre><ApellidoPaterno>Id</ApellidoPaterno><ApellidoMaterno>Objeto</ApellidoMaterno>
    <Militancias><Militancia>
      <FechaInicio>2022-03-11T00:00:00</FechaInicio><FechaTermino />
      <Partido><Id>X</Id><Nombre>X</Nombre><Alias>X</Alias></Partido>
    </Militancia></Militancias>
  </Diputado></DiputadoPeriodo>
</DiputadosPeriodoColeccion>`;
    expect(() => parseDiputadosBio(xmlIdObjeto)).toThrow(IdNoEscalarError);
  });
});

describe("parse-diputados — CR-01/WR-03 desde ausente", () => {
  // Una militancia SIN <FechaInicio> NO debe emitirse con desde="" (romperia el upsert contra la
  // columna date NOT NULL y degradaria la clave natural). Se SALTA con log (contrato explicito).
  const xmlSinFecha = `<?xml version="1.0"?>
<DiputadosPeriodoColeccion>
  <DiputadoPeriodo><Diputado>
    <Id>7777</Id><Nombre>Ana</Nombre><ApellidoPaterno>Sin</ApellidoPaterno><ApellidoMaterno>Fecha</ApellidoMaterno>
    <Militancias>
      <Militancia>
        <FechaInicio /><FechaTermino />
        <Partido><Id>1</Id><Nombre>Partido Sin Alias</Nombre></Partido>
      </Militancia>
      <Militancia>
        <FechaInicio>2022-03-11T00:00:00</FechaInicio><FechaTermino />
        <Partido><Id>2</Id><Nombre>Partido Con Fecha</Nombre><Alias>PCF</Alias></Partido>
      </Militancia>
    </Militancias>
  </Diputado></DiputadoPeriodo>
</DiputadosPeriodoColeccion>`;

  it("militancia sin <FechaInicio> se salta (no emite desde vacío) y loguea", () => {
    const logs: string[] = [];
    const parsed = parseDiputadosBio(xmlSinFecha, {
      corte: new Date("2026-03-11T12:00:00"),
      log: (m) => logs.push(m),
    });
    const d = parsed.find((x) => x.dipid === "7777")!;
    // Solo la militancia CON fecha sobrevive; ninguna con desde vacío.
    expect(d.militancias).toHaveLength(1);
    expect(d.militancias[0]!.partidoAlias).toBe("PCF");
    expect(d.militancias.every((m) => m.desde.length > 0)).toBe(true);
    expect(logs.some((l) => l.includes("sin FechaInicio"))).toBe(true);
  });
});
