/**
 * GATE DE CALIDAD del juez/validación (BENCH-02) — mock, sin red.
 *
 * Prueba el contrato de accuracy CONDICIONAL vs etiqueta HUMANA:
 *   - precisión-del-OK y recall-de-rechazo son números SEPARADOS.
 *   - un juez sello-de-goma (siempre OK) → recall-de-rechazo ≈ 0 (EXPUESTO).
 *   - el scoring usa SOLO el split de scoring; el split de calibración es disjunto y reservado.
 *   - los hooks de sesgo (productor, longitud) se POBLAN (no se interpretan en 106).
 * Más el meta-test adversario aislado: la rama de recall-de-rechazo PUEDE caer → métrica viva.
 */
import { describe, it, expect } from "vitest";
import {
  GOLDEN_SET_JUEZ,
  GOLDEN_SET_SCORING_JUEZ,
  GOLDEN_SET_CALIBRACION_JUEZ,
  GOLDEN_SET_ADVERSARIO_JUEZ,
  evaluarJuez,
  slotCurvaConfiabilidadJuez,
  type CasoJuez,
} from "./scorer";

/** Juez "oro": su veredicto coincide con la etiqueta humana (acuerdo perfecto). */
const juzgarOro = (caso: CasoJuez): Promise<boolean> => Promise.resolve(caso.human_label);
/** Juez sello-de-goma: aprueba TODO (siempre OK). */
const juzgarSelloDeGoma = (): Promise<boolean> => Promise.resolve(true);
/** Juez ROTO: nunca emite un veredicto usable (null = fallo/no-respuesta). WR-04. */
const juzgarRoto = (): Promise<null> => Promise.resolve(null);

describe("juez — estructura del set (pares answer/human_label)", () => {
  it("tiene ≥35 casos, cada uno con answer + human_label booleano", () => {
    expect(GOLDEN_SET_JUEZ.length).toBeGreaterThanOrEqual(35);
    for (const c of GOLDEN_SET_JUEZ) {
      expect(typeof c.answer).toBe("string");
      expect(typeof c.human_label).toBe("boolean");
    }
  });

  it("incluye answers INCORRECTAS (human_label:false) para que recall-de-rechazo sea medible", () => {
    const malas = GOLDEN_SET_JUEZ.filter((c) => c.human_label === false);
    expect(malas.length).toBeGreaterThanOrEqual(5);
  });

  it("cada caso lleva los hooks de sesgo: producer + answerLen (+ orderings opcional)", () => {
    for (const c of GOLDEN_SET_JUEZ) {
      expect(c.producer.length).toBeGreaterThan(0);
      expect(c.answerLen).toBeGreaterThanOrEqual(0);
    }
    expect(GOLDEN_SET_JUEZ.some((c) => c.orderings !== undefined)).toBe(true); // hook de posición presente
  });

  it("el split de calibración es DISJUNTO del de scoring (∩ = ∅)", () => {
    const scoringIds = new Set(GOLDEN_SET_SCORING_JUEZ.map((c) => c.id));
    const solape = GOLDEN_SET_CALIBRACION_JUEZ.filter((c) => scoringIds.has(c.id));
    expect(solape).toEqual([]);
    expect(GOLDEN_SET_CALIBRACION_JUEZ.length).toBeGreaterThanOrEqual(1);
    // scoring ∪ calibración = todo el golden (no hay caso sin split).
    expect(GOLDEN_SET_SCORING_JUEZ.length + GOLDEN_SET_CALIBRACION_JUEZ.length).toBe(
      GOLDEN_SET_JUEZ.length,
    );
  });
});

// ── BEHAVIOR: accuracy condicional vs etiqueta humana ──
describe("juez — accuracy CONDICIONAL (precisión-del-OK + recall-de-rechazo)", () => {
  it("juez oro → precisión-del-OK = 1 y recall-de-rechazo = 1", async () => {
    const m = await evaluarJuez(GOLDEN_SET_SCORING_JUEZ, juzgarOro);
    expect(m.precision_ok).toBe(1);
    expect(m.recall_rechazo).toBe(1);
    expect(m.n).toBe(GOLDEN_SET_SCORING_JUEZ.length);
  });

  it("juez SELLO-DE-GOMA (siempre OK) → recall-de-rechazo ≈ 0 (EXPUESTO)", async () => {
    const m = await evaluarJuez(GOLDEN_SET_SCORING_JUEZ, juzgarSelloDeGoma);
    // Nunca rechaza → no atrapa ninguna answer mala → recall de rechazo = 0.
    expect(m.recall_rechazo).toBe(0);
    // …y su precisión-del-OK cae a la tasa-base (aprueba también las malas).
    expect(m.precision_ok).toBeLessThan(1);
  });

  it("precisión-del-OK y recall-de-rechazo son números SEPARADOS (nunca fusionados)", async () => {
    const m = await evaluarJuez(GOLDEN_SET_SCORING_JUEZ, juzgarSelloDeGoma);
    expect(m).toHaveProperty("precision_ok");
    expect(m).toHaveProperty("recall_rechazo");
    expect(m.precision_ok).not.toBe(m.recall_rechazo);
  });

  // WR-04: un juez ROTO (nunca emite veredicto) NO debe puntuar recall-de-rechazo = 1.0.
  it("juez ROTO (siempre null) → recall-de-rechazo = 0, NO 1.0 (WR-04)", async () => {
    const m = await evaluarJuez(GOLDEN_SET_SCORING_JUEZ, juzgarRoto);
    // Un no-veredicto NO cuenta como rechazo: no atrapa ninguna answer mala → recall = 0.
    expect(m.recall_rechazo).toBe(0);
    // Explícitamente NO es 1 (el bug premiaba al juez roto como rechazador perfecto).
    expect(m.recall_rechazo).not.toBe(1);
    // Nunca dijo OK → precisión-del-OK = null (denominador 0).
    expect(m.precision_ok).toBeNull();
    // El fallo se surface SEPARADO: todos los casos quedaron sin veredicto.
    expect(m.conteos.sinVeredicto).toBe(GOLDEN_SET_SCORING_JUEZ.length);
    // Las answers malas siguen en el denominador (no se atraparon), pero 0 en el numerador.
    expect(m.conteos.rechazoYMala).toBe(0);
    expect(m.conteos.malas).toBeGreaterThan(0);
  });

  it("un no-veredicto (null) sobre una answer mala NO se cuenta como rechazo (WR-04)", async () => {
    // Sobre el set adversario (todas answers malas): un juez que responde null en todas obtiene
    // recall = 0 — el rechazo hay que GANARLO con un veredicto explícito, no fallando.
    const m = await evaluarJuez(GOLDEN_SET_ADVERSARIO_JUEZ, juzgarRoto);
    expect(m.recall_rechazo).toBe(0);
    expect(m.conteos.sinVeredicto).toBe(GOLDEN_SET_ADVERSARIO_JUEZ.length);
  });

  it("el scoring usa SOLO el split de scoring (no cuenta los de calibración)", async () => {
    const m = await evaluarJuez(GOLDEN_SET_SCORING_JUEZ, juzgarOro);
    expect(m.n).toBe(GOLDEN_SET_SCORING_JUEZ.length);
    expect(m.n).toBeLessThan(GOLDEN_SET_JUEZ.length); // excluye la calibración
  });
});

// ── BEHAVIOR: hooks de sesgo POBLADOS (no interpretados en 106) ──
describe("juez — hooks de sesgo poblados (medición es 107)", () => {
  it("porProductor y porLongitud quedan poblados tras la corrida", async () => {
    const m = await evaluarJuez(GOLDEN_SET_SCORING_JUEZ, juzgarOro);
    expect(Object.keys(m.hooks.porProductor).length).toBeGreaterThanOrEqual(2);
    const totalPorProductor = Object.values(m.hooks.porProductor).reduce((s, p) => s + p.total, 0);
    expect(totalPorProductor).toBe(GOLDEN_SET_SCORING_JUEZ.length);
    expect(m.hooks.porLongitud.corta.total + m.hooks.porLongitud.larga.total).toBe(
      GOLDEN_SET_SCORING_JUEZ.length,
    );
  });

  it("el slot de la curva de confiabilidad está VACÍO en 106 (fit es 107)", () => {
    expect(slotCurvaConfiabilidadJuez()).toEqual([]);
  });
});

// ── META-TEST: la métrica de rechazo PUEDE caer (adversario aislado) ──
describe("juez — meta-test: recall-de-rechazo PUEDE caer (adversario aislado)", () => {
  it("existen ≥2 casos adversarios (answers malas que un sello-de-goma aprobaría)", () => {
    expect(GOLDEN_SET_ADVERSARIO_JUEZ.length).toBeGreaterThanOrEqual(2);
    expect(GOLDEN_SET_ADVERSARIO_JUEZ.every((c) => c.human_label === false)).toBe(true);
  });

  it("un juez que APRUEBA los adversarios (malos) baja recall-de-rechazo por debajo de 1", async () => {
    const m = await evaluarJuez(GOLDEN_SET_ADVERSARIO_JUEZ, juzgarSelloDeGoma);
    expect(m.recall_rechazo).toBe(0); // aprobó respuestas malas → 0 rechazos
    expect(m.conteos.malas).toBeGreaterThanOrEqual(2);
  });
});
