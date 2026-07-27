/**
 * PUENTE JUEZ-vs-HUMANO (107-02, BENCH-04) — adapta un `JudgeProvider` (p.ej. `PhiJudge`) al
 * `JuzgarFn` que consume el scorer del juez de 106, para MEDIR al juez contra la etiqueta HUMANA.
 *
 * El scorer de 106 (`evaluarJuez`) computa accuracy CONDICIONAL vs `human_label` — NUNCA vs el
 * responder (T-106-09). Este puente sólo TRANSPORTA el `answer` del caso al juez y traduce su
 * `Verdict` al contrato del `JuzgarFn`; los hooks de sesgo (self-preference/position/verbosity)
 * son del scorer y quedan EJERCITADOS por la medición. El puente jamás lee un "answer del
 * productor" como ground truth: la verdad es siempre `human_label`, propiedad del scorer.
 *
 * MAPEO Verdict → JuzgarFn:
 *   - Verdict.ok === true   → true  (OK).
 *   - Verdict.ok === false  → false (rechazo EXPLÍCITO — cuenta en recall-de-rechazo).
 *   - `judge.judge` LANZA    → null  (NO-VEREDICTO, WR-04): un juez roto NO cosecha recall por
 *      fallar; el scorer excluye el null del numerador y lo surface como `sinVeredicto`.
 *
 * PRIVACIDAD: el golden de juez es NO-PII por construcción → se llama con `sensitivity: "public"`.
 * El guard fail-closed de `PhiJudge` (assertNoRutInLlmInput) muerde igual si un RUT se colara.
 *
 * LIVE vs CI: la MEDICIÓN real (Phi endpoint) es LIVE-gated (Plan 03) — este módulo es puro
 * (no red por sí mismo); el `judge` inyectado decide si hay red. El test de CI usa un
 * `JudgeProvider` mock determinista (sin red).
 *
 * NOTA barrel: `src/index.ts` (owner 106-01) — este módulo es NET-NEW (no del set placeholder
 * 106); agrega UNA línea de re-export sin tocar las existentes.
 */
import type { JudgeProvider } from "@obs/llm";
import {
  evaluarJuez,
  GOLDEN_SET_SCORING_JUEZ,
  type CasoJuez,
  type JuzgarFn,
  type MetricasJuez,
} from "./scorer";

/**
 * Envuelve un `JudgeProvider` en el `JuzgarFn` que el scorer de 106 consume. Llama
 * `judge.judge({ answer: caso.answer, sensitivity: "public" })` (forma LOCKED de `JudgeRequest`,
 * Plan 01), mapea `Verdict.ok` boolean directo, y CATCHea cualquier throw → `null` (NO-VEREDICTO,
 * WR-04). PURO: no introduce red; la red (si la hay) vive dentro del `judge` inyectado.
 */
export function puenteJuezDesdeJudgeProvider(judge: JudgeProvider): JuzgarFn {
  return async (caso: CasoJuez): Promise<boolean | null> => {
    try {
      const verdict = await judge.judge({ answer: caso.answer, sensitivity: "public" });
      return verdict.ok;
    } catch {
      // WR-04: un juez roto/errado NO es un rechazo — devuelve NO-VEREDICTO (null). El scorer lo
      // excluye del numerador de recall-de-rechazo (no infla recall a 1.0 por fallar).
      return null;
    }
  };
}

/**
 * Conveniencia one-call para la corrida LIVE (Plan 03) y el test de CI: corre `evaluarJuez` sobre
 * el split de scoring (o el set que se pase) usando el puente. Devuelve `MetricasJuez` medido vs
 * `human_label`, con los hooks de sesgo poblados. NO compara jamás contra el productor.
 */
export function medirJuezVsHumano(
  judge: JudgeProvider,
  set: CasoJuez[] = GOLDEN_SET_SCORING_JUEZ,
): Promise<MetricasJuez> {
  return evaluarJuez(set, puenteJuezDesdeJudgeProvider(judge));
}
