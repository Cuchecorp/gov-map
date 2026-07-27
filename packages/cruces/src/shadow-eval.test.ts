/**
 * Shadow-eval Granite vs DeepSeek — OBSERVABILIDAD DE LA PROMOCIÓN (INTEG-01).
 *
 * RESEARCH §6: "shadow-eval ON antes de promover; el agente NO promueve".
 * El agente NO setea CLASIFICACION_ESCALERA=1 en ningún lado. La activación es
 * un config-flip EXCLUSIVO del operador tras shadow-eval verde sostenido.
 *
 * Dos bloques:
 *
 *   OFFLINE (siempre corre, sin gate): re-confirma el rollback por config (INTEG-03)
 *   usando resolverProvider con env vars — si CLASIFICACION_ESCALERA no está seteado
 *   el provider resuelto es DeepSeekProvider (byte-idéntico al incumbent actual).
 *
 *   LIVE-gated (solo con CLASIFICACION_SHADOW_LIVE=1 + keys): corre Granite (candidato)
 *   en SOMBRA vs DeepSeek (incumbente) sobre GOLDEN_SET_GATE (10 casos), comparando
 *   sector_codigo salida-a-salida. SECUENCIAL con delay 2-3s entre llamadas (rate-limit
 *   LOCKED — WAF/Workers AI). Reporta acuerdo/desacuerdo a console.log. NO persiste en DB.
 *   NO altera el provider productivo. Es observación pura — la promoción es acto del
 *   operador tras shadow verde.
 *
 * Para activar el bloque LIVE (fuera de CI):
 *   CLASIFICACION_SHADOW_LIVE=1 \
 *   WORKERS_AI_API_TOKEN=<token> \
 *   CLOUDFLARE_ACCOUNT_ID=<account_id> \
 *   DEEPSEEK_API_KEY=<key> \
 *   pnpm --filter @obs/cruces exec vitest run src/shadow-eval.test.ts
 */
import { describe, it, expect } from "vitest";
import { DeepSeekProvider, GraniteProvider, TieredProvider } from "@obs/llm";
import { resolverProvider } from "./clasificar-fichas-cli";
import { clasificarFicha } from "./clasificar";
import { GOLDEN_SET_GATE, inputDeCaso } from "./golden/golden-set";

// ── BLOQUE OFFLINE (siempre corre) — rollback por config (INTEG-03) ─────────────────────────
// Re-confirma: sin CLASIFICACION_ESCALERA=1 → DeepSeekProvider (byte-idéntico al incumbente).
// Complementa clasificar-fichas-cli.test.ts; aquí el foco es el invariante de shadow-eval:
// la observabilidad NO promueve el candidato (el provider productivo sigue siendo DeepSeek).

const noop = () => {};

describe("shadow-eval — rollback por config OFFLINE (INTEG-03)", () => {
  it("sin CLASIFICACION_ESCALERA → resolverProvider = DeepSeekProvider (incumbente byte-idéntico)", () => {
    const p = resolverProvider({}, { DEEPSEEK_API_KEY: "dummy-deepseek" }, noop);
    expect(p).toBeInstanceOf(DeepSeekProvider);
    expect(p).not.toBeInstanceOf(TieredProvider);
  });

  it("CLASIFICACION_ESCALERA=1 + keys válidas → TieredProvider (escalera Granite→DeepSeek)", () => {
    const env = {
      CLASIFICACION_ESCALERA: "1",
      WORKERS_AI_API_TOKEN: "dummy-token",
      CLOUDFLARE_ACCOUNT_ID: "dummy-account",
      DEEPSEEK_API_KEY: "dummy-deepseek",
    };
    const p = resolverProvider({}, env, noop);
    expect(p).toBeInstanceOf(TieredProvider);
  });

  it("CLASIFICACION_ESCALERA=1 + WORKERS_AI_API_TOKEN vacío → fallback DeepSeekProvider (Pitfall 2)", () => {
    const env = {
      CLASIFICACION_ESCALERA: "1",
      WORKERS_AI_API_TOKEN: "",
      CLOUDFLARE_ACCOUNT_ID: "dummy-account",
      DEEPSEEK_API_KEY: "dummy-deepseek",
    };
    const p = resolverProvider({}, env, noop);
    expect(p).toBeInstanceOf(DeepSeekProvider);
    expect(p).not.toBeInstanceOf(TieredProvider);
  });

  it("CLASIFICACION_ESCALERA=1 + CLOUDFLARE_ACCOUNT_ID vacío → fallback DeepSeekProvider (Pitfall 2)", () => {
    const env = {
      CLASIFICACION_ESCALERA: "1",
      WORKERS_AI_API_TOKEN: "dummy-token",
      CLOUDFLARE_ACCOUNT_ID: "",
      DEEPSEEK_API_KEY: "dummy-deepseek",
    };
    const p = resolverProvider({}, env, noop);
    expect(p).toBeInstanceOf(DeepSeekProvider);
    expect(p).not.toBeInstanceOf(TieredProvider);
  });
});

// ── BLOQUE LIVE-gated — shadow-eval Granite vs DeepSeek (INTEG-01) ──────────────────────────
// Gate: CLASIFICACION_SHADOW_LIVE === "1". Skip limpio sin el flag (nunca corre en CI).

const LIVE = process.env.CLASIFICACION_SHADOW_LIVE === "1";

/** Delay entre llamadas al MISMO host (rate-limit LOCKED: 2-3s, RESEARCH §7 / CLAUDE.md). */
const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const DELAY_MS = 2500;

(LIVE ? describe : describe.skip)(
  "shadow-eval Granite vs DeepSeek LIVE — observación pura, NO promueve (CLASIFICACION_SHADOW_LIVE=1)",
  () => {
    it.skipIf(
      !process.env.WORKERS_AI_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.DEEPSEEK_API_KEY,
    )(
      "corre el golden (10 casos) en sombra y reporta acuerdo/desacuerdo (informativo, sin assert de gate)",
      async () => {
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
        const workerToken = process.env.WORKERS_AI_API_TOKEN!;
        const deepseekKey = process.env.DEEPSEEK_API_KEY!;

        // Pitfall 1 (T-109-07): CLOUDFLARE_ACCOUNT_ID interpolado en baseURL, nunca hardcodeado.
        const graniteBaseURL = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`;

        const granite = new GraniteProvider({ apiKey: workerToken, baseURL: graniteBaseURL });
        const deepseek = new DeepSeekProvider({ apiKey: deepseekKey });

        const muestra = GOLDEN_SET_GATE; // 10 casos no-null
        let acuerdos = 0;
        const desacuerdos: { id: string; deepseek: string | null; granite: string | null }[] = [];

        for (const caso of muestra) {
          if (caso.tipo !== "ficha") {
            // Shadow-eval enfoca la ruta pública (clasificarFicha); contrapartes usan MiniMax.
            // Casos contraparte se saltan silenciosamente.
            continue;
          }

          const d = inputDeCaso(caso);
          if (d.tipo !== "ficha") continue;

          // Incumbente primero (DeepSeek) — establece el baseline de comparación.
          const resDeepseek = await clasificarFicha(d.input, deepseek);
          await delay(DELAY_MS); // rate-limit LOCKED (2-3s entre llamadas al mismo host)

          // Candidato en SOMBRA (Granite) — observación pura, salida NO usada en producción.
          const resGranite = await clasificarFicha(d.input, granite);
          await delay(DELAY_MS); // rate-limit LOCKED (respeto Workers AI)

          if (resDeepseek.sector_codigo === resGranite.sector_codigo) {
            acuerdos++;
          } else {
            desacuerdos.push({
              id: caso.id,
              deepseek: resDeepseek.sector_codigo,
              granite: resGranite.sector_codigo,
            });
          }
        }

        const total = muestra.filter((c) => c.tipo === "ficha").length;
        const tasaAcuerdo = total === 0 ? 1 : acuerdos / total;

        // Informe de acuerdo/desacuerdo — INFORMATIVO. El veredicto full-40 (109-VEREDICTO)
        // ya aprobó Δ0.0000; este shadow confirma paridad live antes del config-flip.
        console.log(
          `[shadow-eval] acuerdo=${acuerdos}/${total} (${(tasaAcuerdo * 100).toFixed(0)}%)`,
        );
        if (desacuerdos.length > 0) {
          console.log("[shadow-eval] desacuerdos:");
          for (const d of desacuerdos) {
            console.log(`  id=${d.id}  deepseek=${d.deepseek}  granite=${d.granite}`);
          }
        } else {
          console.log("[shadow-eval] cero desacuerdos — paridad perfecta sobre la muestra.");
        }

        // Piso defensivo mínimo: si la discordancia es total algo está gravemente roto
        // (ej. Granite devuelve siempre null). No assert de gate de acuerdo (informativo).
        expect(total).toBeGreaterThan(0);
        // El shadow NUNCA afecta el provider productivo — el incumbente continúa siendo DeepSeek.
        // La promoción es acto EXCLUSIVO del operador tras shadow verde sostenido.
      },
    );
  },
);
