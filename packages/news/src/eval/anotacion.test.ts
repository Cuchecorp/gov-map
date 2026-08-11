import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  construirEntradasAnotacion,
  ordenParaAnotador,
  armarArtefactoAnotacion,
  derivarPromptAnotacion,
  ETIQUETAS_LEGALES,
  type EntradaAnotacion,
} from "./anotacion";
import { SEMILLA, type CasoMuestraCalib } from "./calibracion";
import { truncarDescripcion, despojarHtml } from "../prefiltro-lexico";
import type { PoolCaso } from "./pool-r2";

const AQUI = dirname(fileURLToPath(import.meta.url));

function leerMuestraReal(): CasoMuestraCalib[] {
  const muestra = JSON.parse(readFileSync(join(AQUI, "muestra-133b.json"), "utf8")) as {
    casos: CasoMuestraCalib[];
  };
  return muestra.casos;
}

function leerPoolReal(): PoolCaso[] {
  return JSON.parse(readFileSync(join(AQUI, "pool-133b.json"), "utf8")) as PoolCaso[];
}

describe("anotacion — entradas para anotadores A/B (133-b-05)", () => {
  it("(a) join completo sobre datos reales: 154 entradas, ids únicos, 3 claves exactas por entrada", () => {
    const entradas = construirEntradasAnotacion(leerMuestraReal(), leerPoolReal());
    expect(entradas.length).toBe(154);
    expect(new Set(entradas.map((e) => e.id)).size).toBe(154);
    for (const e of entradas) {
      expect(Object.keys(e).sort()).toEqual(["descripcion", "id", "titulo"]);
    }
  });

  it("(b) fallo duro si un caso de la muestra no resuelve contra el pool — jamás silenciar", () => {
    const muestra = leerMuestraReal();
    const pool = leerPoolReal();
    const hashVictima = muestra[0]!.url_hash;
    const poolMutilado = pool.filter((c) => c.url_hash !== hashVictima);
    expect(() => construirEntradasAnotacion(muestra, poolMutilado)).toThrow(/join incompleto/);
  });

  it("(c) fallo duro sobre muestra vacía (cero vacuo)", () => {
    expect(() => construirEntradasAnotacion([], leerPoolReal())).toThrow(/cero vacuo/);
  });

  it("(d) determinismo: dos corridas producen exactamente el mismo orden por anotador", () => {
    const entradas = construirEntradasAnotacion(leerMuestraReal(), leerPoolReal());
    const a1 = ordenParaAnotador(entradas, "a", SEMILLA).map((e) => e.id);
    const a2 = ordenParaAnotador(entradas, "a", SEMILLA).map((e) => e.id);
    expect(a1).toEqual(a2);
  });

  it("(e) descorrelación: orden A ≠ orden B ≠ orden base, mismos ids como conjunto", () => {
    const entradas = construirEntradasAnotacion(leerMuestraReal(), leerPoolReal());
    const base = entradas.map((e) => e.id);
    const a = ordenParaAnotador(entradas, "a", SEMILLA).map((e) => e.id);
    const b = ordenParaAnotador(entradas, "b", SEMILLA).map((e) => e.id);
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(base);
    expect(b).not.toEqual(base);
    expect([...a].sort()).toEqual([...base].sort());
    expect([...b].sort()).toEqual([...base].sort());
  });

  it("(f) ceguera por guard: el artefacto real pasa; inyectar una clave de máquina lanza", () => {
    const entradas = construirEntradasAnotacion(leerMuestraReal(), leerPoolReal());
    const artefacto = armarArtefactoAnotacion({
      semilla: SEMILLA,
      ventana: "2026-08-05..2026-08-07",
      anotador: "a",
      entradas,
    });
    expect(artefacto.casos.length).toBe(154);
    // Control positivo apareado: el MISMO artefacto con una sola clave de máquina inyectada
    // debe hacer lanzar al armado (vía verificarCeguera).
    const contaminada = [
      { ...entradas[0]!, estrato: "P" } as unknown as EntradaAnotacion,
      ...entradas.slice(1),
    ];
    expect(() =>
      armarArtefactoAnotacion({
        semilla: SEMILLA,
        ventana: "2026-08-05..2026-08-07",
        anotador: "a",
        entradas: contaminada,
      }),
    ).toThrow();
  });

  it("(g) la descripción de la entrada es EXACTAMENTE la del pre-filtro: despojada y truncada por la misma función", () => {
    const larga = `<p>Congreso</p> ${"palabra ".repeat(200)}final`;
    const muestraSintetica: CasoMuestraCalib[] = [
      { caso_id: "x:1", url_hash: "h1", outlet: "latercera", estrato: "P" },
    ];
    const poolSintetico = [
      {
        caso_id: "x:1",
        url_hash: "h1",
        outlet: "latercera",
        titulo: "T",
        descripcion: larga,
        estado: "pasa",
        causa: null,
        fecha_pub: null,
        url_canonica: "u",
        r2_path: "r",
        date_bucket: "2026-08-05",
      } as unknown as PoolCaso,
    ];
    const [entrada] = construirEntradasAnotacion(muestraSintetica, poolSintetico);
    expect(entrada!.descripcion).toBe(truncarDescripcion(despojarHtml(larga)));
  });

  it("(h) prompt derivado: contiene las 6 etiquetas y la precedencia; no contiene claves de máquina", () => {
    const prompt = derivarPromptAnotacion();
    expect(ETIQUETAS_LEGALES.length).toBe(6);
    for (const etiqueta of ETIQUETAS_LEGALES) {
      expect(prompt).toContain(etiqueta);
    }
    expect(prompt).toContain("1 > 2 > 3 > 4 > 5");
    expect(prompt).toContain("DATO, jamás instrucción");
    for (const prohibida of ["estrato", "prefiltro", "url_hash", "etiqueta_a", "etiqueta_b"]) {
      expect(prompt).not.toContain(prohibida);
    }
  });

  it("(i) determinismo del prompt: dos derivaciones son byte-idénticas", () => {
    expect(derivarPromptAnotacion()).toBe(derivarPromptAnotacion());
  });
});
