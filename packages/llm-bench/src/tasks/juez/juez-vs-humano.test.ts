/**
 * PUENTE JUEZ-vs-HUMANO (107-02, BENCH-04) — test de CI, mock determinista, SIN red.
 *
 * Ejercita la FORMA del puente + la máquina de scoring de 106 con un `JudgeProvider` mock inline
 * (no PhiJudge real, no red): (a) precision_ok/recall_rechazo se computan vs `human_label`, (b)
 * los hooks (porProductor, porLongitud) quedan poblados → los hooks de sesgo ESTÁN ejercitados,
 * (c) un juez que LANZA produce sinVeredicto>0 y NO infla recall_rechazo a 1.0 (WR-04).
 *
 * La MEDICIÓN real (PhiJudge contra el endpoint) es LIVE-gated (Plan 03): el bloque LIVE queda
 * `describe.skip` salvo `LLM_BENCH_LIVE=1`.
 */
import { describe, it, expect } from "vitest";
import type { JudgeProvider, JudgeRequest, Verdict } from "@obs/llm";
import { medirJuezVsHumano, puenteJuezDesdeJudgeProvider } from "./juez-vs-humano";
import type { CasoJuez } from "./scorer";

/**
 * Set de fixture chico NO-PII con etiqueta humana + hooks de sesgo poblados (productor + longitud).
 * Dos correctas (human_label:true) y dos malas (human_label:false, adversarias).
 */
const FIXTURE: CasoJuez[] = [
  { id: "f-ok-corta", answer: "sector: economía", human_label: true, producer: "modelo-a", answerLen: 17, split: "scoring", estrato: "tarea" },
  { id: "f-ok-larga", answer: "la idea matriz busca proteger a los consumidores frente a clausulas abusivas segun el texto del proyecto de ley en tramite", human_label: true, producer: "modelo-b", answerLen: 200, split: "scoring", estrato: "length" },
  { id: "f-mala-corta", answer: "sector: fabricado", human_label: false, producer: "modelo-a", answerLen: 17, split: "scoring", estrato: "tarea" },
  { id: "f-mala-larga", answer: "una idea alucinada y totalmente inventada que el proyecto jamas enuncio pero suena convincente por lo larga que es la frase", human_label: false, producer: "modelo-b", answerLen: 200, split: "scoring", estrato: "length" },
];

/** Mock determinista: dice OK a las correctas de fixture, rechaza las adversarias. Sin red. */
function mockJuezPerfecto(): JudgeProvider {
  return {
    id: "mock-juez-perfecto",
    trainsOnInputs: false,
    judge(req: JudgeRequest): Promise<Verdict> {
      // Determinista por contenido: rechaza lo "fabricado"/"alucinada", aprueba el resto.
      const malo = /fabricado|alucinada/.test(req.answer);
      return Promise.resolve({ ok: !malo });
    },
  };
}

/** Mock que SIEMPRE lanza — un juez roto (WR-04: debe rendir null, no rechazo). */
function mockJuezRoto(): JudgeProvider {
  return {
    id: "mock-juez-roto",
    trainsOnInputs: false,
    judge(_req: JudgeRequest): Promise<Verdict> {
      throw new Error("juez caído (endpoint 500 simulado)");
    },
  };
}

describe("puente juez-vs-humano — medido vs human_label (CI mock, sin red)", () => {
  it("computa precision_ok y recall_rechazo vs human_label con un mock perfecto", async () => {
    const m = await medirJuezVsHumano(mockJuezPerfecto(), FIXTURE);
    expect(m.n).toBe(4);
    // El mock aprueba las 2 correctas y rechaza las 2 malas → precision perfecta, recall perfecto.
    expect(m.precision_ok).toBe(1);
    expect(m.recall_rechazo).toBe(1);
    expect(m.conteos.sinVeredicto).toBe(0);
  });

  it("pobla los hooks de sesgo (porProductor + porLongitud) → los hooks ESTÁN ejercitados", async () => {
    const m = await medirJuezVsHumano(mockJuezPerfecto(), FIXTURE);
    // self-preference: ambos productores presentes con conteos.
    expect(m.hooks.porProductor["modelo-a"]).toEqual({ ok: 1, total: 2 });
    expect(m.hooks.porProductor["modelo-b"]).toEqual({ ok: 1, total: 2 });
    // verbosity: ambos tramos poblados (2 cortas, 2 largas en el fixture).
    expect(m.hooks.porLongitud.corta.total).toBe(2);
    expect(m.hooks.porLongitud.larga.total).toBe(2);
  });

  it("un juez que LANZA → sinVeredicto>0 y recall_rechazo NO es 1.0 (WR-04)", async () => {
    const m = await medirJuezVsHumano(mockJuezRoto(), FIXTURE);
    // Cada caso lanzó → todos NO-VEREDICTO; ningún rechazo explícito.
    expect(m.conteos.sinVeredicto).toBe(4);
    // Había 2 answers malas y NINGÚN rechazo explícito → recall 0, JAMÁS 1.0 por fallar.
    expect(m.recall_rechazo).toBe(0);
    expect(m.recall_rechazo).not.toBe(1);
  });

  it("puenteJuezDesdeJudgeProvider mapea ok→boolean y throw→null directamente", async () => {
    const okFn = puenteJuezDesdeJudgeProvider(mockJuezPerfecto());
    expect(await okFn(FIXTURE[0]!)).toBe(true); // correcta → OK
    expect(await okFn(FIXTURE[2]!)).toBe(false); // "fabricado" → rechazo explícito
    const rotoFn = puenteJuezDesdeJudgeProvider(mockJuezRoto());
    expect(await rotoFn(FIXTURE[0]!)).toBeNull(); // throw → NO-VEREDICTO
  });
});

// ── LIVE (Plan 03): PhiJudge real contra el endpoint — SKIP salvo LLM_BENCH_LIVE=1. NO CI. ──
const LIVE = process.env.LLM_BENCH_LIVE === "1";
(LIVE ? describe : describe.skip)("puente juez-vs-humano — LIVE (Plan 03, PhiJudge real)", () => {
  it.skip("Plan 03 corre medirJuezVsHumano(new PhiJudge(...)) contra el golden real", () => {
    // Documental: la medición real la ejecuta Plan 03 con las credenciales del operador
    // (OPENROUTER_API_KEY / Workers AI). Este bloque nunca corre en CI.
    expect(true).toBe(true);
  });
});
