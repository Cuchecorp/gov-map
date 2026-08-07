import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  medirCobertura,
  verificarCobertura,
  construirEntradaMedida,
  UMBRAL_COBERTURA,
  type CasoCobertura,
} from "./cobertura";
import { construirEntradaLlm } from "./entrada-llm";
import { truncarDescripcion } from "../prefiltro-lexico";
import type { PoolCaso } from "./pool-r2";

const AQUI = dirname(fileURLToPath(import.meta.url));

function leerCensoP(): CasoCobertura[] {
  const pool = JSON.parse(readFileSync(join(AQUI, "pool-133b.json"), "utf8")) as PoolCaso[];
  const pasa = pool.filter((c) => c.estado === "pasa");
  return pasa.map((c) => ({ caso_id: c.caso_id, titulo: c.titulo, descripcion: c.descripcion }));
}

const OUTLETS_ESPERADOS = ["latercera", "lacuarta", "exante", "biobiochile", "cooperativa"];

describe("cobertura — Task 1: medición con truncador inyectable", () => {
  it("(a) truncador real sobre el censo P ⇒ 74/74, y paridad byte a byte con construirEntradaLlm", () => {
    const censoP = leerCensoP();
    expect(censoP).toHaveLength(74);
    // Sanity de composición: el censo real tiene los 5 outlets (piso de conteo realista).
    const pool = JSON.parse(readFileSync(join(AQUI, "pool-133b.json"), "utf8")) as PoolCaso[];
    const outletsEnP = new Set(pool.filter((c) => c.estado === "pasa").map((c) => c.outlet));
    for (const o of OUTLETS_ESPERADOS) expect(outletsEnP.has(o)).toBe(true);

    const r = medirCobertura(censoP);
    expect(r.total).toBe(74);
    expect(r.cubiertos).toBe(74);
    expect(r.sinTerminos).toBe(0);
    expect(r.cobertura).toBe(1);

    // Paridad: sobre al menos un caso real, la entrada_llm construida por cobertura.ts con el
    // truncador REAL (el mismo que usa medirCobertura por defecto) debe ser BYTE-IDÉNTICA a
    // construirEntradaLlm (misma pieza real, mismo punto del pipeline).
    const caso = censoP[0]!;
    const entradaMedida = construirEntradaMedida(caso, truncarDescripcion);
    const entradaProduccion = construirEntradaLlm(caso);
    expect(entradaMedida).toEqual(entradaProduccion);
  });

  it("(b) truncado a 200 chars ⇒ 65/74", () => {
    const r = medirCobertura(leerCensoP(), { truncador: (s) => s.slice(0, 200) });
    expect(r.cubiertos).toBe(65);
    expect(r.total).toBe(74);
  });

  it("(c) truncado a 80 chars ⇒ 40/74", () => {
    const r = medirCobertura(leerCensoP(), { truncador: (s) => s.slice(0, 80) });
    expect(r.cubiertos).toBe(40);
  });

  it("(d) truncado a 0 (solo titular) ⇒ 30/74", () => {
    const r = medirCobertura(leerCensoP(), { truncador: () => "" });
    expect(r.cubiertos).toBe(30);
  });

  it("(e) entrada vacía (titulo y descripcion vacíos) ⇒ 0/74", () => {
    const censoP = leerCensoP();
    // "entrada vacía": título Y descripción vacíos — a diferencia de (d) ("solo titular"), acá
    // el titular también desaparece. `prefiltro.terminos` se sigue derivando del texto CRUDO
    // (terminosQueMatchean no cambia), pero la entrada_llm queda sin ningún término presente.
    const censoVacio = censoP.map((c) => ({ ...c, titulo: "" }));
    const r = medirCobertura(censoVacio, { truncador: () => "" });
    expect(r.cubiertos).toBe(0);
  });

  it("(f) lista vacía ⇒ LANZA", () => {
    expect(() => medirCobertura([])).toThrow();
  });

  it("(g) el gradiente es monótono no creciente al reducir el truncado", () => {
    const censoP = leerCensoP();
    const real = medirCobertura(censoP).cubiertos;
    const t200 = medirCobertura(censoP, { truncador: (s) => s.slice(0, 200) }).cubiertos;
    const t80 = medirCobertura(censoP, { truncador: (s) => s.slice(0, 80) }).cubiertos;
    const t0 = medirCobertura(censoP, { truncador: () => "" }).cubiertos;
    expect(real).toBeGreaterThanOrEqual(t200);
    expect(t200).toBeGreaterThanOrEqual(t80);
    expect(t80).toBeGreaterThanOrEqual(t0);
  });
});

describe("cobertura — Task 2: gate fail-closed del 95%", () => {
  it("(a) verificarCobertura LANZA bajo 0,95", () => {
    const censoP = leerCensoP();
    expect(() => verificarCobertura(censoP, { truncador: () => "" })).toThrow();
  });

  it("(b) verificarCobertura NO lanza en 0,95 exacto (control positivo apareado)", () => {
    // Población sintética de 100 casos: exactamente 95 cubiertos ⇒ cobertura = 0.95 exacto.
    // El titulo NUNCA se trunca (contrato), así que para lograr un caso "no cubierto" el
    // término debe vivir SOLO en la descripción y quedar fuera tras el truncador inyectado
    // (`slice(0,10)`): 95 casos llevan el término al INICIO (sobrevive); 5 lo llevan tras un
    // relleno de 10 chars (se corta). `terminosQueMatchean` sigue detectando "senado" en los 5
    // no-cubiertos porque opera sobre el texto CRUDO (sin el truncador de prueba) — así el caso
    // realmente ejercita "término detectado por el pre-filtro real, pero ausente de la
    // entrada_llm truncada", que es la patología que D-133-F2.2 vigila.
    const sinteticos: CasoCobertura[] = [];
    for (let i = 0; i < 100; i++) {
      const cubierto = i < 95;
      sinteticos.push({
        caso_id: `sint${i}`,
        titulo: "Titulo neutro de prueba sintetica sin vocabulario",
        descripcion: cubierto ? "senado" : "xxxxxxxxxx senado",
      });
    }
    const r = verificarCobertura(sinteticos, { truncador: (s) => s.slice(0, 10) });
    expect(r.cobertura).toBe(0.95);
    expect(() => verificarCobertura(sinteticos, { truncador: (s) => s.slice(0, 10) })).not.toThrow();
  });

  it("(c) con el truncador a 200 sobre el censo P real, verificarCobertura LANZA", () => {
    const censoP = leerCensoP();
    expect(() => verificarCobertura(censoP, { truncador: (s) => s.slice(0, 200) })).toThrow();
  });
});

