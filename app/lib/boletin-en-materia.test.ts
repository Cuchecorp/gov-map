import { describe, it, expect } from "vitest";
import { extraerBoletines } from "./boletin-en-materia";

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE COMPARTIDO TS↔SQL (guard de equivalencia — PLAN-CHECKER FIX MAJOR 3).
// Cada entrada [materia, boletines esperados en forma canónica] es la ÚNICA fuente
// de verdad del comportamiento del extractor. El pgTAP de 0062 asegura filas concretas
// mencionadas vs no-mencionadas contra ESTE mismo set (equivalencia demostrable del
// regex SQL de la RPC con el extractor TS). Si cambias este fixture, actualiza el
// pgTAP 0062_lobby_menciones_de_boletin.test.sql.
//
// REGLA LOCKED (dirimida por el orquestador, riesgo #1 de la fase): en TEXTO LIBRE un
// número pelado NO es evidencia de boletín. El extractor acepta SOLO:
//   (a) formas CON sufijo `-NN` (p.ej. "14309-04", "14.309-04") en cualquier posición
//       — inequívocas por el sufijo;
//   (b) números SIN sufijo (pelados o punteados, 3-6 dígitos) SOLO si van precedidos
//       (hasta 3 tokens antes) por la palabra "boletín"/"boletin"/"bol." (case-insensitive).
// TODO lo demás se rechaza.
// ─────────────────────────────────────────────────────────────────────────────
export const FIXTURE_MATERIA: Array<[string | null, string[]]> = [
  // ── (a) formas CON sufijo -NN → inequívocas, en cualquier posición ──────────
  ["boletín 14309-04 sobre pesca", ["14309-04"]],
  ["proyectos 14.309-04 y 12345", ["14309-04"]], // 12345 pelado SIN "boletín" → excluido
  ["boletines 14309-04, 14309-04 y 14309-04", ["14309-04"]], // dedupe
  ["boletines 14309-04 y 15000-07", ["14309-04", "15000-07"]],
  ["sobre el proyecto 14309-04 y otros", ["14309-04"]],

  // ── (b) números SIN sufijo SOLO tras "boletín"/"boletin"/"bol." ─────────────
  ["boletín 14.309", ["14309"]],
  ["boletín 20730", ["20730"]],
  ["el boletín N° 14309", ["14309"]], // "N°" es un token intermedio (≤3)
  ["boletines 14309-04 y 15000-07", ["14309-04", "15000-07"]],

  // ── (b') WR-01: punto de FIN DE ORACIÓN tras la base pelada → SÍ matchea ─────
  // Puntuación común en `materia` de texto libre; el SQL branch (b) ya la aceptaba
  // (`\M(?!-[[:digit:]])`) → estos casos anclan la equivalencia TS↔SQL en el punto
  // final. El decimal/miles ("14.309", "$12.345") se sigue rechazando por `\.\d`.
  ["boletín 14309.", ["14309"]], // punto final de oración, NO decimal
  ["sobre boletín 20730. Fin", ["20730"]], // punto seguido de otra oración
  ["boletín 14309, y otros", ["14309"]], // coma tras la base pelada

  // ── Rechazos LOCKED: pelado sin gatillo, ley, año, dinero ───────────────────
  ["Ley 20.730 de lobby", []], // "Ley 20.730" → [] (fixture LOCKED estrella)
  ["ley N° 20.730", []],
  ["20730", []], // pelado suelto → []
  ["año 2024", []],
  ["monto de $12.345 (3.14%)", []], // separador decimal / dinero NO es boletín
  ["reunión sobre medio ambiente", []],

  // ── materia vacía / null ────────────────────────────────────────────────────
  [null, []],
  ["", []],
];

// Guard de equivalencia (patrón WR-03 de packages/fichas/src/spike/boletin.test.ts):
// re-implementación inline del extractor para cazar drift entre dos copias de la lógica.
// Si actualizas boletin-en-materia.ts, actualiza esta copia también.
const BOLETIN_CON_SUFIJO = /\b(\d{1,3}(?:\.\d{3})*|\d{3,6})-(\d{1,2})\b/g;
const GATILLO = /(bolet[ií]n|bol\.)/i;
function extraerBoletinesInline(materia: string | null): string[] {
  if (!materia) return [];
  const out = new Set<string>();
  // (a) formas con sufijo -NN en cualquier posición
  let m: RegExpExecArray | null;
  BOLETIN_CON_SUFIJO.lastIndex = 0;
  while ((m = BOLETIN_CON_SUFIJO.exec(materia)) !== null) {
    const base = m[1]!.replace(/\./g, "");
    if (base.length >= 3 && base.length <= 6) out.add(`${base}-${m[2]}`);
  }
  // (b) números sin sufijo SOLO precedidos (≤3 tokens) por gatillo. El lookahead
  //     rechaza SOLO continuación de token (dígito, `.`+dígito, `-`+dígito) — NO el
  //     punto de fin de oración (WR-01). Debe ser IDÉNTICO al canónico NUMERO_SIN_SUFIJO.
  const numRe = /(\d{1,3}(?:\.\d{3})*|\d{3,6})(?![\d]|\.\d|-\d)/g;
  let n: RegExpExecArray | null;
  numRe.lastIndex = 0;
  while ((n = numRe.exec(materia)) !== null) {
    const raw = n[0]!;
    if (raw.includes("-")) continue;
    const base = raw.replace(/\./g, "");
    if (base.length < 3 || base.length > 6) continue;
    const before = materia.slice(0, n.index);
    const tokens = before.trim().split(/\s+/).filter(Boolean);
    const window = tokens.slice(-3).join(" ");
    if (GATILLO.test(window)) out.add(base);
  }
  return [...out].sort((a, b) => {
    const na = parseInt(a.split("-")[0]!, 10);
    const nb = parseInt(b.split("-")[0]!, 10);
    if (na !== nb) return na - nb;
    return a.localeCompare(b);
  });
}

describe("extraerBoletines — reglas LOCKED de mención en texto libre", () => {
  it("boletín con sufijo → canónico base-sufijo", () => {
    expect(extraerBoletines("boletín 14309-04 sobre pesca")).toEqual(["14309-04"]);
  });

  it("punteado con sufijo se normaliza; pelado sin gatillo se excluye", () => {
    expect(extraerBoletines("proyectos 14.309-04 y 12345")).toEqual(["14309-04"]);
  });

  it("separador decimal / dinero NO es boletín", () => {
    expect(extraerBoletines("monto de $12.345 (3.14%)")).toEqual([]);
  });

  it("dedupe por boletín distinto", () => {
    expect(extraerBoletines("boletines 14309-04, 14309-04 y 14309-04")).toEqual(["14309-04"]);
  });

  it("sin número → sin mención", () => {
    expect(extraerBoletines("reunión sobre medio ambiente")).toEqual([]);
  });

  it("null / vacío → []", () => {
    expect(extraerBoletines(null)).toEqual([]);
    expect(extraerBoletines("")).toEqual([]);
  });

  it('LOCKED: "Ley 20.730 de lobby" → [] (ley, no boletín)', () => {
    expect(extraerBoletines("Ley 20.730 de lobby")).toEqual([]);
  });

  it('LOCKED: "ley N° 20.730" → []', () => {
    expect(extraerBoletines("ley N° 20.730")).toEqual([]);
  });

  it('LOCKED: "boletín 14.309" → ["14309"]', () => {
    expect(extraerBoletines("boletín 14.309")).toEqual(["14309"]);
  });

  it('LOCKED: "boletín 20730" → ["20730"]', () => {
    expect(extraerBoletines("boletín 20730")).toEqual(["20730"]);
  });

  it('LOCKED: "20730" pelado suelto → []', () => {
    expect(extraerBoletines("20730")).toEqual([]);
  });

  it('LOCKED: "el boletín N° 14309" → ["14309"]', () => {
    expect(extraerBoletines("el boletín N° 14309")).toEqual(["14309"]);
  });

  it('LOCKED: "boletines 14309-04 y 15000-07" → ambos', () => {
    expect(extraerBoletines("boletines 14309-04 y 15000-07")).toEqual(["14309-04", "15000-07"]);
  });

  it('LOCKED: "sobre el proyecto 14309-04 y otros" → ["14309-04"]', () => {
    expect(extraerBoletines("sobre el proyecto 14309-04 y otros")).toEqual(["14309-04"]);
  });

  it('LOCKED: "año 2024" → [] (año, no boletín pelado con gatillo)', () => {
    expect(extraerBoletines("año 2024")).toEqual([]);
  });

  it('WR-01: "boletín 14309." (punto final de oración) → ["14309"]', () => {
    expect(extraerBoletines("boletín 14309.")).toEqual(["14309"]);
  });

  it('WR-01: "sobre boletín 20730. Fin" (punto + nueva oración) → ["20730"]', () => {
    expect(extraerBoletines("sobre boletín 20730. Fin")).toEqual(["20730"]);
  });

  it('WR-01: el decimal/miles se sigue rechazando ("boletín 14.309" → base sin puntos)', () => {
    // "14.309" es la BASE punteada (miles), no un decimal → colapsa a "14309".
    expect(extraerBoletines("boletín 14.309")).toEqual(["14309"]);
    // pero un decimal real de dinero sigue excluido:
    expect(extraerBoletines("monto $12.345 (3.14%)")).toEqual([]);
  });

  it("orden ascendente por número base", () => {
    expect(extraerBoletines("boletines 15000-07 y 14309-04")).toEqual(["14309-04", "15000-07"]);
  });
});

describe("extraerBoletines — guard de equivalencia (WR-03) sobre el fixture compartido", () => {
  it("la copia canónica y la copia inline producen salida idéntica sobre el fixture", () => {
    for (const [materia, expected] of FIXTURE_MATERIA) {
      expect(extraerBoletines(materia)).toEqual(expected);
      expect(extraerBoletinesInline(materia)).toEqual(expected);
    }
  });
});
