import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { evaluarClasificador, idsDeVetoEvaluados, type CasoDorado } from "./gate-clasificador";

const AQUI = dirname(fileURLToPath(import.meta.url));

function goldenReal(): CasoDorado[] {
  const g = JSON.parse(readFileSync(join(AQUI, "golden-set.json"), "utf8")) as {
    casos: Array<{ caso_id: string; etiqueta: string }>;
  };
  return g.casos.map((c) => ({ caso_id: c.caso_id, etiqueta: c.etiqueta }));
}

describe("gate-clasificador — la vara muerde (135, SC1)", () => {
  const golden = goldenReal();

  it("(a) clasificador PERFECTO sintético aprueba; T4/T9 quedan no-medidos (fail-closed)", () => {
    const perfecto = golden.map((c) => ({ caso_id: c.caso_id, etiqueta: c.etiqueta }));
    const v = evaluarClasificador(perfecto, golden);
    expect(v.n).toBe(159);
    expect(v.aprueba).toBe(true);
    const t4 = v.metricas.find((m) => m.id === "T4")!;
    const t9 = v.metricas.find((m) => m.id === "T9")!;
    expect(t4.estado).toBe("no-medido");
    expect(t9.estado).toBe("no-medido");
    expect(v.clases_no_medidas).toContain("tramitacion_legislativa");
    expect(v.clases_no_medidas).toContain("actividad_parlamentaria");
    const t5 = v.metricas.find((m) => m.id === "T5")!;
    expect(t5.estado).toBe("pasa"); // n_clase=72 >= 25, precision 1.0
  });

  it("(b) FIXTURE DE MUTACIÓN (SC1): un clasificador degradado hace FALLAR el gate", () => {
    // Degradado: todo `no_legislativa`. T1 y T2 pasan (etiqueta legal, parsea), pero la
    // exactitud macro se derrumba (solo acierta esa clase) ⇒ T3 veta. El gate MUERDE.
    const degradado = golden.map((c) => ({ caso_id: c.caso_id, etiqueta: "no_legislativa" }));
    const v = evaluarClasificador(degradado, golden);
    expect(v.aprueba).toBe(false);
    const t3 = v.metricas.find((m) => m.id === "T3")!;
    expect(t3.estado).toBe("veta");
  });

  it("(c) T1 veta con UNA sola etiqueta fuera de lista (0.00 duro)", () => {
    const casi = golden.map((c) => ({ caso_id: c.caso_id, etiqueta: c.etiqueta }));
    casi[0] = { caso_id: casi[0]!.caso_id, etiqueta: "etiqueta_inventada" };
    const v = evaluarClasificador(casi, golden);
    expect(v.metricas.find((m) => m.id === "T1")!.estado).toBe("veta");
    expect(v.aprueba).toBe(false);
  });

  it("(d) T2 tolera hasta 2% de parse fallido y veta sobre eso", () => {
    const conNulls = golden.map((c, i) => ({
      caso_id: c.caso_id,
      etiqueta: i < 3 ? null : c.etiqueta, // 3/159 = 1.9% ⇒ pasa
    }));
    expect(evaluarClasificador(conNulls, golden).metricas.find((m) => m.id === "T2")!.estado).toBe("pasa");
    const conMasNulls = golden.map((c, i) => ({
      caso_id: c.caso_id,
      etiqueta: i < 4 ? null : c.etiqueta, // 4/159 = 2.5% ⇒ veta
    }));
    const v = evaluarClasificador(conMasNulls, golden);
    expect(v.metricas.find((m) => m.id === "T2")!.estado).toBe("veta");
    expect(v.aprueba).toBe(false);
  });

  it("(e) cero vacuo y cobertura: vacío LANZA, parcial LANZA, duplicado LANZA, desconocido LANZA", () => {
    expect(() => evaluarClasificador([], golden)).toThrow(/cero vacuo/);
    expect(() => evaluarClasificador(golden.slice(0, 100), golden)).toThrow(/cobertura incompleta/);
    const dup = [...golden.map((c) => ({ caso_id: c.caso_id, etiqueta: c.etiqueta }))];
    dup[1] = { ...dup[0]! };
    expect(() => evaluarClasificador(dup, golden)).toThrow(/duplicado/);
    expect(() =>
      evaluarClasificador([{ caso_id: "fantasma", etiqueta: "ambiguo" }], golden),
    ).toThrow(/desconocido/);
  });

  it("(f) sincronía con thresholds congelados: los 6 vetos evaluados existen como veto en THRESHOLDS", () => {
    expect(idsDeVetoEvaluados().sort()).toEqual(["T1", "T2", "T3", "T4", "T5", "T9"]);
  });

  it("(g) dentro_del_ruido se marca cuando el IC95 cruza el umbral", () => {
    // Empujar T3 cerca de 0.80: con 30 errores en politica_no_legislativa (58 casos) la
    // exactitud de esa clase cae a 28/58≈0.48 y el macro a ≈0.83 — sobre el umbral (T3
    // pasa por estimación puntual) pero con IC95 [≈0.77, ≈0.89] que CRUZA 0.80.
    let erroresPolitica = 0;
    const alBorde = golden.map((c) => {
      if (c.etiqueta === "politica_no_legislativa" && erroresPolitica < 30) {
        erroresPolitica += 1;
        return { caso_id: c.caso_id, etiqueta: "no_legislativa" };
      }
      return { caso_id: c.caso_id, etiqueta: c.etiqueta };
    });
    const v = evaluarClasificador(alBorde, golden);
    const t3 = v.metricas.find((m) => m.id === "T3")!;
    expect(t3.valor!).toBeGreaterThan(0.8);
    expect(t3.dentro_del_ruido).toBe(true);
  });
});
