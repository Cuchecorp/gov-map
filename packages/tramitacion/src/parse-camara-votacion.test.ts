import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseCamaraVotacion,
  parseCamaraVotoDetalle,
} from "./parse-camara-votacion";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures");
const leer = (f: string) => readFileSync(join(FIXTURES, f), "utf8");

const boletinXml = leer("camara-votacion-boletin.xml");
const detalleXml = leer("camara-votacion-detalle.xml");

describe("parseCamaraVotacion (ns tempuri.org, boletín estructurado)", () => {
  it("produce ≥1 Votacion con boletín 14309-04 estructurado (no regex)", () => {
    const vs = parseCamaraVotacion(boletinXml);
    expect(vs.length).toBeGreaterThanOrEqual(1);
    expect(vs[0].boletin).toBe("14309-04");
  });

  it("mapea cámara=diputados, id sintético camara:<ID> y fecha ISO", () => {
    const v = parseCamaraVotacion(boletinXml)[0];
    expect(v.camara).toBe("diputados");
    expect(v.id).toBe("camara:88813");
    expect(v.fecha).toMatch(/^2026-05-11T/);
  });

  it("toma totales del boletín (TotalAfirmativos/Negativos/Abstenciones)", () => {
    const v = parseCamaraVotacion(boletinXml)[0];
    expect(v.total_si).toBe(58);
    expect(v.total_no).toBe(81);
    expect(v.total_abstencion).toBe(0);
  });

  it("mapea resultado y quorum desde el texto del nodo", () => {
    const v = parseCamaraVotacion(boletinXml)[0];
    expect(v.resultado).toBe("Rechazado");
    expect(v.quorum).toBe("Quorum Simple");
  });

  it("provenance inline presente (origen/fecha_captura/enlace)", () => {
    const v = parseCamaraVotacion(boletinXml)[0];
    expect(v.origen).toBe("camara-opendata");
    expect(v.fecha_captura).toMatch(/T/);
    expect(v.enlace).toContain("opendata.camara.cl");
  });
});

describe("parseCamaraVotoDetalle (ns v1, voto-a-voto por Diputado/Id)", () => {
  it("produce votos con diputadoId y opcion mapeada (1→si, 0→no)", () => {
    const votos = parseCamaraVotoDetalle(detalleXml);
    expect(votos.length).toBeGreaterThanOrEqual(3);
    const alinco = votos.find((v) => v.diputadoId === "803");
    expect(alinco?.opcion).toBe("no"); // En Contra (Valor=0)
    const bobadilla = votos.find((v) => v.diputadoId === "815");
    expect(bobadilla?.opcion).toBe("si"); // Afirmativo (Valor=1)
  });

  it("arma nombreCrudo desde Nombre + apellidos", () => {
    const votos = parseCamaraVotoDetalle(detalleXml);
    const alinco = votos.find((v) => v.diputadoId === "803");
    expect(alinco?.nombreCrudo).toContain("Alinco");
  });
});

describe("parseCamaraVotoDetalle (ns tempuri REAL: getVotacion_Detalle, DIPID + Opcion Codigo)", () => {
  const detalleReal = leer("camara-votacion-detalle-real.xml");

  it("lee DIPID + <Opcion Codigo> de la forma REAL del WS (LIVE 2026-06-18)", () => {
    const votos = parseCamaraVotoDetalle(detalleReal);
    // Ahora emite el roster COMPLETO (5 opciones), no solo sí/no nominal: ~160 filas.
    expect(votos.length).toBeGreaterThan(100);
    // DIPID 815 = "En Contra" (Codigo=0) → no; presente.
    const bobadilla = votos.find((v) => v.diputadoId === "815");
    expect(bobadilla?.opcion).toBe("no");
    expect(bobadilla?.nombreCrudo).toContain("Bobadilla");
  });

  it("emite 'ausente' para No Vota (Codigo=4) — NUNCA lo descarta ni lo colapsa a sí/no", () => {
    const votos = parseCamaraVotoDetalle(detalleReal);
    // DIPID 803 = "No Vota" (Codigo=4) → ausente (asistencia honesta, no fabricada).
    const alinco = votos.find((v) => v.diputadoId === "803");
    expect(alinco?.opcion).toBe("ausente");
    expect(alinco?.nombreCrudo).toContain("Alinco");
    // Solo aparecen las opciones del catálogo (5 valores), nunca null/descartado.
    for (const v of votos)
      expect(["si", "no", "abstencion", "pareo", "ausente"]).toContain(v.opcion);
  });

  it("los DIPID cruzan determinísticamente contra id_diputado_camara de la maestra", () => {
    const votos = parseCamaraVotoDetalle(detalleReal);
    // Los DIPID son numéricos oficiales (803/815/843…) — el cruce lo hace reconciliarVotosCamara.
    for (const v of votos) expect(v.diputadoId).toMatch(/^\d+$/);
  });

  // --- Task 1 (Plan 64-01): abstención por CÓDIGO 2 (CONFIRMADO LIVE 2026-07-13) ---
  // El fixture real 88813 no trae una abstención (TotalAbstenciones=0), así que se ejercita
  // el mapeo por código con un XML mínimo tempuri con un <Opcion Codigo="2">.
  const votacionConCodigo = (codigo: string, texto: string) =>
    `<?xml version="1.0" encoding="utf-8"?>
     <Votacion xmlns="http://tempuri.org/">
       <Votos>
         <Voto>
           <Diputado><DIPID>999</DIPID><Nombre>Test</Nombre><Apellido_Paterno>Diputado</Apellido_Paterno></Diputado>
           <Opcion Codigo="${codigo}">${texto}</Opcion>
         </Voto>
       </Votos>
     </Votacion>`;

  it("mapea <Opcion Codigo=\"2\"> → 'abstencion' por CÓDIGO, con o sin texto reconocible (LIVE 2026-07-13)", () => {
    // Con texto "Abstencion" (caso live).
    const conTexto = parseCamaraVotoDetalle(votacionConCodigo("2", "Abstencion"));
    expect(conTexto.find((v) => v.diputadoId === "999")?.opcion).toBe("abstencion");
    // Código 2 SIN texto reconocible (o vacío): sigue siendo abstención POR CÓDIGO, no null.
    const sinTexto = parseCamaraVotoDetalle(votacionConCodigo("2", ""));
    expect(sinTexto.find((v) => v.diputadoId === "999")?.opcion).toBe("abstencion");
    const textoRaro = parseCamaraVotoDetalle(votacionConCodigo("2", "xyz"));
    expect(textoRaro.find((v) => v.diputadoId === "999")?.opcion).toBe("abstencion");
  });

  it("no regresa las otras ramas: code-1→si, code-0→no, code-4→ausente (contra el fixture real)", () => {
    const votos = parseCamaraVotoDetalle(detalleReal);
    // 986 Hernando = Afirmativo (Codigo=1) → si
    expect(votos.find((v) => v.diputadoId === "986")?.opcion).toBe("si");
    // 815 Bobadilla = En Contra (Codigo=0) → no
    expect(votos.find((v) => v.diputadoId === "815")?.opcion).toBe("no");
    // 1009 Alessandri = No Vota (Codigo=4), NO pareado → ausente
    expect(votos.find((v) => v.diputadoId === "1009")?.opcion).toBe("ausente");
  });

  it("fail-closed: una opción con código desconocido y texto ilegible → fila omitida (nunca fabrica sí/no)", () => {
    const raro = parseCamaraVotoDetalle(votacionConCodigo("9", "???"));
    expect(raro.find((v) => v.diputadoId === "999")).toBeUndefined();
  });

  // --- Task 2 (Plan 64-01): pareo DERIVADO del bloque <Pareos> por DIPID (A1b resuelto) ---
  // El fixture LIVE prueba que el pareo NO es un Opcion Codigo=3 (inexistente en el roster):
  // vive en un bloque hermano <Pareos><Pareo><Diputado1/2><DIPID>, y esos diputados figuran
  // en <Votos> como "No Vota" (codigo 4). El parser los re-etiqueta a "pareo".
  const PAREADOS = ["1240", "1082", "1259", "1142", "1039", "1131", "1015", "1217", "1107", "1219"];

  it("emite 'pareo' para los 10 DIPID del bloque <Pareos>, aunque en <Votos> figuren como No Vota", () => {
    const votos = parseCamaraVotoDetalle(detalleReal);
    const pareo = votos.filter((v) => v.opcion === "pareo");
    expect(pareo.length).toBe(10);
    const idsPareo = new Set(pareo.map((v) => v.diputadoId));
    for (const id of PAREADOS) expect(idsPareo.has(id)).toBe(true);
    // Pareo 1 del fixture: 1240 (Parisi) y 1082 (Urruticoechea).
    expect(votos.find((v) => v.diputadoId === "1240")?.opcion).toBe("pareo");
    expect(votos.find((v) => v.diputadoId === "1082")?.opcion).toBe("pareo");
  });

  it("un DIPID 'No Vota' que NO está en <Pareos> sigue siendo 'ausente' (1009 Alessandri)", () => {
    const votos = parseCamaraVotoDetalle(detalleReal);
    expect(votos.find((v) => v.diputadoId === "1009")?.opcion).toBe("ausente");
  });

  it("todas las opciones ∈ {si,no,abstencion,pareo,ausente} (roll-call fiel, nada fabricado)", () => {
    const votos = parseCamaraVotoDetalle(detalleReal);
    for (const v of votos)
      expect(["si", "no", "abstencion", "pareo", "ausente"]).toContain(v.opcion);
  });

  // CR-01 (defamation-critical): un DIPID que figura en <Pareos> pero que ADEMÁS trae un voto
  // nominal (código 1 = afirmativo) es una contradicción de integridad de la fuente. El parser
  // JAMÁS reescribe el voto real "si" a "pareo" en silencio: DEBE lanzar (fail-loud) para que la
  // contradicción se investigue, no se atribuya como falsa ("voted YES" → "was paired").
  it("CR-01: un pareado que trae voto nominal (code-1 afirmativo) hace THROW, nunca sobrescribe el 'si' con 'pareo'", () => {
    const conflicto = `<?xml version="1.0" encoding="utf-8"?>
      <Votacion xmlns="http://tempuri.org/">
        <Votos>
          <Voto><Diputado><DIPID>777</DIPID></Diputado><Opcion Codigo="1">A Favor</Opcion></Voto>
        </Votos>
        <Pareos>
          <Pareo><Diputado1><DIPID>777</DIPID></Diputado1><Diputado2><DIPID>778</DIPID></Diputado2></Pareo>
        </Pareos>
      </Votacion>`;
    expect(() => parseCamaraVotoDetalle(conflicto)).toThrow(/pareo\/voto conflict DIPID=777/);
    // Y nunca emite una fila "pareo" que oculte el voto real.
    expect(() => parseCamaraVotoDetalle(conflicto)).toThrow(/VOTO-04/);
  });

  it("sin bloque <Pareos> nadie se marca pareo espurio", () => {
    const sinPareos = `<?xml version="1.0" encoding="utf-8"?>
      <Votacion xmlns="http://tempuri.org/">
        <Votos>
          <Voto><Diputado><DIPID>803</DIPID></Diputado><Opcion Codigo="4">No Vota</Opcion></Voto>
        </Votos>
      </Votacion>`;
    const votos = parseCamaraVotoDetalle(sinPareos);
    expect(votos.find((v) => v.diputadoId === "803")?.opcion).toBe("ausente");
    expect(votos.some((v) => v.opcion === "pareo")).toBe(false);
  });
});

describe("parseCamaraVotoDetalle (roster completo: las 5 opciones por diputado, VOTE-03)", () => {
  const roster = leer("camara-votacion-detalle-roster.xml");

  it("emite una fila por diputado con su opción real (si/no/abstencion/pareo/ausente)", () => {
    const votos = parseCamaraVotoDetalle(roster);
    expect(votos.length).toBe(5); // ningún diputado se descarta
    const op = (id: string) => votos.find((v) => v.diputadoId === id)?.opcion;
    expect(op("815")).toBe("si"); // Afirmativo (Codigo=1)
    expect(op("843")).toBe("no"); // En Contra (Codigo=0)
    expect(op("872")).toBe("abstencion"); // texto "Abstención" (código no confirmado LIVE — A1)
    expect(op("915")).toBe("pareo"); // texto "Pareo" (código no confirmado LIVE — A1)
    expect(op("803")).toBe("ausente"); // No Vota (Codigo=4)
  });

  it("NUNCA colapsa una opción no-nominal a sí/no (fidelidad del roll-call)", () => {
    const votos = parseCamaraVotoDetalle(roster);
    // 1 sí, 1 no, 1 abstención, 1 pareo, 1 ausente — la suma cuadra con el roster.
    const cuenta = (op: string) => votos.filter((v) => v.opcion === op).length;
    expect(cuenta("si")).toBe(1);
    expect(cuenta("no")).toBe(1);
    expect(cuenta("abstencion")).toBe(1);
    expect(cuenta("pareo")).toBe(1);
    expect(cuenta("ausente")).toBe(1);
  });
});

describe("cross-check de totales (SC#3): Σ roster == Total* del header, mismatch RUIDOSO", () => {
  const detalleReal = leer("camara-votacion-detalle-real.xml");

  // Totales del header, extraídos por regex sobre los tags estructurados del XML de detalle.
  // (El header vive en <Votacion>, no en cada <Voto> — se lee del XML crudo del fixture.)
  const totalHeader = (xml: string, tag: string): number => {
    const m = xml.match(new RegExp(`<${tag}>\\s*(\\d+)\\s*</${tag}>`));
    if (m == null) throw new Error(`header total <${tag}> ausente/ilegible en el XML`);
    return Number(m[1]);
  };

  // Cross-check por BUCKET SEMÁNTICO (si↔Afirmativos, no↔Negativos, abstencion↔Abstenciones),
  // NUNCA por comparación de strings de label del header. Lanza RUIDOSO ante cualquier
  // desbalance — jamás retorna 0 en silencio.
  const crossCheck = (xml: string): void => {
    const votos = parseCamaraVotoDetalle(xml);
    const cuenta = (op: string) => votos.filter((v) => v.opcion === op).length;
    const pares: Array<[string, string]> = [
      ["si", "TotalAfirmativos"],
      ["no", "TotalNegativos"],
      ["abstencion", "TotalAbstenciones"],
    ];
    for (const [bucket, tag] of pares) {
      const suma = cuenta(bucket);
      const esperado = totalHeader(xml, tag);
      if (suma !== esperado) {
        throw new Error(
          `cross-check FALLÓ: Σ(${bucket})=${suma} ≠ ${tag}=${esperado} (roster no cuadra con el header)`,
        );
      }
    }
  };

  it("positivo: Σ(si)=58, Σ(no)=81, Σ(abstencion)=0 cuadran con el header del fixture LIVE", () => {
    const votos = parseCamaraVotoDetalle(detalleReal);
    const cuenta = (op: string) => votos.filter((v) => v.opcion === op).length;
    expect(cuenta("si")).toBe(58);
    expect(cuenta("no")).toBe(81);
    expect(cuenta("abstencion")).toBe(0);
    expect(() => crossCheck(detalleReal)).not.toThrow();
    // El pareo se cuenta APARTE (no entra en el cross-check nominal): 10 pareados en el fixture.
    expect(cuenta("pareo")).toBe(10);
    // NOTA: TotalDispensados vs "ausente" queda PENDIENTE de confirmación LIVE en Plan 02
    // (Open Question 2). Aquí TotalDispensados=0 y no se assert-a ciegamente contra "ausente".
  });

  it("negativo: un voto mutado (no→si) desbalancea la suma y hace THROW ruidoso (nunca silencioso)", () => {
    // Muta en memoria UN <Opcion Codigo="0">En Contra</Opcion> a Codigo="1">Afirmativo:
    // ahora Σ(si)=59 y Σ(no)=80, que ya no cuadran con 58/81 → el cross-check DEBE lanzar.
    const corrupto = detalleReal.replace(
      '<Opcion Codigo="0">En Contra</Opcion>',
      '<Opcion Codigo="1">Afirmativo</Opcion>',
    );
    expect(corrupto).not.toBe(detalleReal); // la mutación efectivamente ocurrió
    expect(() => crossCheck(corrupto)).toThrow(/cross-check FALLÓ/);
    // Y explícitamente: la suma mutada ya no es 58.
    const votosMut = parseCamaraVotoDetalle(corrupto);
    expect(votosMut.filter((v) => v.opcion === "si").length).not.toBe(58);
  });
});

describe("parseCamaraVotacion con detalleXml (totales del detalle pisan boletín)", () => {
  it("usa los totales del detalle para la votación coincidente (id 89178 no está en boletín → solo boletín)", () => {
    // El detalle es de la votación 89178 (boletín 18296), no presente en el fixture de boletín
    // (14309). Por eso los totales del boletín se conservan; el test verifica que pasar detalle
    // no rompe el parseo del boletín.
    const vs = parseCamaraVotacion(boletinXml, { detalleXml });
    expect(vs[0].boletin).toBe("14309-04");
    expect(vs[0].total_si).toBe(58);
  });
});
