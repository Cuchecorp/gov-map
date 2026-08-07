import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  CUOTA_P,
  seleccionarCalibracion,
  ItemCiegoSchema,
  ArtefactoCiegoSchema,
  derivarGlosa,
  type CasoMuestraCalib,
} from "./calibracion";

const AQUI = dirname(fileURLToPath(import.meta.url));

function leerMuestraReal(): CasoMuestraCalib[] {
  const muestra = JSON.parse(readFileSync(join(AQUI, "muestra-133b.json"), "utf8")) as {
    casos: CasoMuestraCalib[];
  };
  return muestra.casos;
}

describe("calibracion — Task 1: selección determinista de los 20", () => {
  it("(a) cuota por outlet exacta {latercera:8, lacuarta:1, exante:1, biobiochile:1, cooperativa:1}, suma 12", () => {
    const censo = { latercera: 50, lacuarta: 11, exante: 6, biobiochile: 6, cooperativa: 1 };
    const cuota = CUOTA_P(censo, 12);
    expect(cuota).toEqual({ latercera: 8, lacuarta: 1, exante: 1, biobiochile: 1, cooperativa: 1 });
    expect(Object.values(cuota).reduce((a, b) => a + b, 0)).toBe(12);
  });

  it("(b) todo outlet que aporta al censo P tiene ≥1 representante en la selección real", () => {
    const muestra = leerMuestraReal();
    const outletsEnP = new Set(muestra.filter((c) => c.estrato === "P").map((c) => c.outlet));
    const ids = seleccionarCalibracion({ muestra, semilla: "133-b-golden-2026" });
    const seleccionados = new Set(ids);
    const porOutletP = new Map<string, CasoMuestraCalib>();
    for (const c of muestra) if (c.estrato === "P") porOutletP.set(c.caso_id, c);
    const outletsRepresentados = new Set(
      ids.filter((id) => porOutletP.has(id)).map((id) => porOutletP.get(id)!.outlet),
    );
    for (const o of outletsEnP) expect(outletsRepresentados.has(o)).toBe(true);
    expect(seleccionados.size).toBe(20);
  });

  it("(c) 5 de N-alea + 3 de N-sonda, y los 20 son disjuntos (sin repetidos)", () => {
    const muestra = leerMuestraReal();
    const ids = seleccionarCalibracion({ muestra, semilla: "133-b-golden-2026" });
    expect(ids).toHaveLength(20);
    expect(new Set(ids).size).toBe(20);
    const porId = new Map(muestra.map((c) => [c.caso_id, c]));
    const nAlea = ids.filter((id) => porId.get(id)?.estrato === "N-alea").length;
    const nSonda = ids.filter((id) => porId.get(id)?.estrato === "N-sonda").length;
    const nP = ids.filter((id) => porId.get(id)?.estrato === "P").length;
    expect(nAlea).toBe(5);
    expect(nSonda).toBe(3);
    expect(nP).toBe(12);
  });

  it("(d) determinismo: dos corridas con la misma semilla dan la misma lista de 20", () => {
    const muestra = leerMuestraReal();
    const a = seleccionarCalibracion({ muestra, semilla: "133-b-golden-2026" });
    const b = seleccionarCalibracion({ muestra, semilla: "133-b-golden-2026" });
    expect(a).toEqual(b);
  });

  it("(e) control negativo: otra semilla da una lista distinta", () => {
    const muestra = leerMuestraReal();
    const a = seleccionarCalibracion({ muestra, semilla: "133-b-golden-2026" });
    const b = seleccionarCalibracion({ muestra, semilla: "133-b-golden-2026-X" });
    expect(a).not.toEqual(b);
  });

  it("(f) la selección no excluye los casos sin descripción", () => {
    const muestra: CasoMuestraCalib[] = [];
    // Un solo outlet con 12 casos para simplificar la cuota (piso 1, resto irrelevante).
    // La mitad de cada sub-estrato SIN descripción (""), la otra mitad con bajada — si
    // `seleccionarCalibracion` filtrara por contenido, no podría completar los 20 pedidos
    // sobre exactamente 12/5/3 disponibles.
    for (let i = 0; i < 12; i++) {
      muestra.push({
        caso_id: `p${i}`,
        url_hash: `hp${String(i).padStart(3, "0")}`,
        outlet: "unico",
        estrato: "P",
        descripcion: i % 2 === 0 ? "" : "bajada no vacia",
      });
    }
    for (let i = 0; i < 5; i++) {
      muestra.push({
        caso_id: `a${i}`,
        url_hash: `ha${String(i).padStart(3, "0")}`,
        outlet: "unico",
        estrato: "N-alea",
        descripcion: i % 2 === 0 ? "" : "bajada no vacia",
      });
    }
    for (let i = 0; i < 3; i++) {
      muestra.push({
        caso_id: `s${i}`,
        url_hash: `hs${String(i).padStart(3, "0")}`,
        outlet: "unico",
        estrato: "N-sonda",
        descripcion: i % 2 === 0 ? "" : "bajada no vacia",
      });
    }
    const ids = seleccionarCalibracion({ muestra, semilla: "sem-f" });
    expect(ids).toHaveLength(20);
    expect(new Set(ids).size).toBe(20);
  });

  it("(g) el orden de los 20 NO está agrupado por estrato (hallazgo del coordinador: la posición del caso en el artefacto revelaría el veredicto del pre-filtro)", () => {
    // La ceguera se define por la INFORMACIÓN disponible, no por los campos presentes: si el
    // orden queda agrupado (12 P, luego 5 N-alea, luego 3 N-sonda — la composición está
    // escrita en el plan y en la adjudicación), cualquiera que conozca esa composición lee del
    // ÍNDICE del artefacto qué casos descartó el pre-filtro, un prior fortísimo hacia
    // `no_legislativa`. El estrato se resuelve SIEMPRE contra `muestra-133b.json` — el
    // artefacto ciego no lo tiene y no debe tenerlo.
    const muestra = leerMuestraReal();
    const ids = seleccionarCalibracion({ muestra, semilla: "133-b-golden-2026" });
    const porId = new Map(muestra.map((c) => [c.caso_id, c.estrato]));
    const estratos = ids.map((id) => porId.get(id));
    // Anti-cero-vacuo del propio join: si el join no resolviera nada, el test debe FALLAR,
    // no pasar en silencio sobre una lista de `undefined`.
    expect(estratos.filter((e) => e != null)).toHaveLength(20);

    let transiciones = 0;
    for (let i = 1; i < estratos.length; i++) {
      if (estratos[i] !== estratos[i - 1]) transiciones += 1;
    }
    // Con orden agrupado (bug original) hay EXACTAMENTE 2 transiciones (P→N-alea,
    // N-alea→N-sonda). Con el barajado determinista, el valor medido es 10; se congela un piso
    // conservador de 8 para no acoplar el test a una cifra exacta que un cambio de semilla
    // moviera sin ser un regreso al bug.
    expect(transiciones).toBeGreaterThanOrEqual(8);
  });
});

describe("calibracion — Task 2 (parte no-guard): esquema estricto y glosa derivada", () => {
  it("(a) el artefacto tiene exactamente 20 ítems y cada ítem exactamente las 5 claves permitidas", () => {
    const itemValido = { id: "x", titulo: "T", descripcion: "D", outlet: "latercera", fecha: null };
    expect(ItemCiegoSchema.safeParse(itemValido).success).toBe(true);
    expect(ItemCiegoSchema.safeParse({ ...itemValido, campoExtra: "no" }).success).toBe(false);

    const artefacto = {
      semilla: "133-b-golden-2026",
      ventana: "2026-08-05..2026-08-07",
      glosa: derivarGlosa(),
      casos: Array.from({ length: 20 }, (_, i) => ({ ...itemValido, id: `id${i}` })),
    };
    expect(ArtefactoCiegoSchema.safeParse(artefacto).success).toBe(true);
    const con19 = { ...artefacto, casos: artefacto.casos.slice(0, 19) };
    expect(ArtefactoCiegoSchema.safeParse(con19).success).toBe(false);
  });

  it("(e) el artefacto incluye la glosa derivada de TAXONOMIA (definicion + marca_decisoria + frontera)", () => {
    const glosa = derivarGlosa();
    expect(glosa).toHaveLength(6);
    for (const clase of glosa) {
      expect(clase.definicion.length).toBeGreaterThan(0);
      expect(clase.marca_decisoria.length).toBeGreaterThan(0);
      expect(clase.frontera.length).toBeGreaterThan(0);
    }
    expect(glosa.map((c) => c.etiqueta)).toContain("ambiguo");
  });
});
