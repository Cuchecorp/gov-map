/**
 * TieredProvider — decorador de cascada acotada respond→validate→escalate (@obs/llm).
 *
 * Implementa `LLMProvider` como un decorador drop-in: llama al tier primario, y en caso
 * de fallo zod (LLMValidationError) o veredicto de juez `ok:false`, escala UN hop al
 * tier de escalación. Si ese también falla, lanza `EscalationExhaustedError` (revisión
 * humana). La escalera de tiers es INMUTABLE post-construcción: `task` en el request
 * NO re-rutea mid-sesión (FLAG-1 — anti-pattern "mid-session routing").
 *
 * Restricciones de seguridad:
 * - `assertNoRutInLlmInput` en la ENTRADA del decorador (defensa en profundidad, T-108-03).
 * - Catch NARROWED a `LLMValidationError` (FLAG-2): solo ese fallo dispara escalación;
 *   otros errores se re-lanzan sin escalar.
 * - El juez es ESCALATE-ONLY: `ok:true` nunca relaja compuerta ni swallowea fallo zod.
 * - Cota dura: máx `tiers.length` llamadas por `complete()` (T-108-04).
 * - TelemetryEvent PAYLOAD-FREE: sin user/system/answer/prompt/reason (T-108-06).
 */
import type { ZodType } from "zod";
import type { CompletionRequest, LLMProvider } from "./types";
import type { JudgeProvider } from "./judge";
import type { TelemetrySink, TelemetryEvent } from "./telemetry";
import type { ValidationOutcome } from "./validate";
import { LLMValidationError } from "./validate";
import { assertNoRutInLlmInput } from "./data-routing";
import { noopSink } from "./telemetry";

// ─── EscalationExhaustedError ─────────────────────────────────────────────────

/**
 * Error terminal de la cascada: todos los tiers fallaron o el presupuesto se agotó.
 * El message es GENÉRICO (sin contenido del prompt — espeja la disciplina de
 * `LLMValidationError`). El caller debe marcar el ítem para revisión humana.
 */
export class EscalationExhaustedError extends Error {
  constructor(reason: "all-tiers-failed" | "budget-exceeded" | "no-escalation-tier") {
    super(`LLM escalation exhausted: ${reason}`);
    this.name = "EscalationExhaustedError";
  }
}

// ─── TieredProviderOptions ────────────────────────────────────────────────────

/**
 * Opciones de construcción de `TieredProvider`. Fijadas en el constructor y NUNCA
 * mutadas: la escalera es inmutable post-construcción (FLAG-1).
 */
export interface TieredProviderOptions {
  /**
   * Lista ORDENADA de tiers. `tiers[0]` = primario; `tiers[1]` = escalación (opcional).
   * La lista es INMUTABLE: `complete()` nunca la muta ni la reordena.
   */
  tiers: LLMProvider[];
  /** Juez opcional. Si presente, corre tras el tier primario y puede escalar. */
  judge?: JudgeProvider;
  /** Contexto extra para el prompt del juez (rubrica, instrucciones). */
  judgeContext?: string;
  /**
   * Budget máximo en USD para el complete() completo.
   * `0` → sin escalación (EscalationExhaustedError tras tier-0).
   * `undefined` → sin límite de presupuesto.
   */
  maxBudgetUsd?: number;
  /** Sink de telemetría (default: noopSink). */
  telemetrySink?: TelemetrySink;
  /** Costo por token del tier primario (para presupuesto). */
  costPerToken?: number;
  /** Costo por token del tier de escalación (para presupuesto). */
  escalationCostPerToken?: number;
}

// ─── TieredProvider ──────────────────────────────────────────────────────────

/**
 * Decorador `LLMProvider` que implementa la cascada acotada respond→validate→escalate.
 *
 * La instancia es un `LLMProvider` drop-in: el caller puede asignarla a una variable
 * `LLMProvider` sin cast alguno. La escalera de tiers se fija en el constructor y
 * es INMUTABLE: `complete()` nunca la muta en función de `req.task` (FLAG-1).
 */
export class TieredProvider implements LLMProvider {
  readonly id: string;
  readonly trainsOnInputs: boolean;

  private readonly tiers: LLMProvider[];
  private readonly judge?: JudgeProvider;
  private readonly judgeContext?: string;
  private readonly maxBudgetUsd?: number;
  private readonly telemetrySink: TelemetrySink;
  private readonly costPerToken?: number;
  private readonly escalationCostPerToken?: number;

  constructor(opts: TieredProviderOptions) {
    if (opts.tiers.length === 0) {
      throw new Error("TieredProvider: se requiere al menos un tier");
    }
    // Copia defensiva: la lista es inmutable (FLAG-1).
    this.tiers = [...opts.tiers];
    this.judge = opts.judge;
    this.judgeContext = opts.judgeContext;
    this.maxBudgetUsd = opts.maxBudgetUsd;
    this.telemetrySink = opts.telemetrySink ?? noopSink;
    this.costPerToken = opts.costPerToken;
    this.escalationCostPerToken = opts.escalationCostPerToken;

    // id derivado de los tiers (inmutable, refleja la escalera).
    this.id = "tiered:" + this.tiers.map((t) => t.id).join("→");

    // trainsOnInputs: true si CUALQUIER tier entrena (Pitfall 2 — conservador).
    this.trainsOnInputs = this.tiers.some((t) => t.trainsOnInputs);
  }

  async complete<T>(req: CompletionRequest, schema: ZodType<T>): Promise<T> {
    // ── Guard RUT en la entrada del decorador (T-108-03, defensa en profundidad) ──
    assertNoRutInLlmInput(req.user);
    if (req.system) assertNoRutInLlmInput(req.system);

    const t0 = Date.now();

    // Aliases locales para evitar noUncheckedIndexedAccess (tiers.length validado en constructor).
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const primaryTier = this.tiers[0]!;
    const escalationTier = this.tiers[1] as LLMProvider | undefined;

    // ── Capturar ValidationOutcome sin perder el callback original (Pitfall 1) ──
    // El callback onValidationOutcome se dispara ANTES del throw en validate.ts.
    // Lo envolvemos para capturarlo; el try/catch es el que decide escalación.
    let capturedOutcome: ValidationOutcome | null = null;
    const wrappedReq: CompletionRequest = {
      ...req,
      onValidationOutcome: (o: ValidationOutcome) => {
        capturedOutcome = o;
        req.onValidationOutcome?.(o);
      },
    };

    // ── Intento en tier-0 ──────────────────────────────────────────────────────
    let tier0Result: T | undefined;
    let tier0Failed = false;
    let tier0Error: LLMValidationError | undefined;

    try {
      tier0Result = await primaryTier.complete(wrappedReq, schema);
    } catch (err) {
      // FLAG-2: narrowing ESPECÍFICO a LLMValidationError.
      // Solo ese fallo es trigger de escalación; cualquier otro error se re-lanza.
      if (err instanceof LLMValidationError) {
        tier0Failed = true;
        tier0Error = err;
      } else {
        // Error de red, TypeError, ZodError crudo, etc. — re-lanzar sin escalar.
        throw err;
      }
    }

    // ── Veredicto del juez (ESCALATE-ONLY) ────────────────────────────────────
    let judgeVerdict: { ok: boolean; confidence?: number } | undefined;
    let judgeTriggeredEscalation = false;

    if (this.judge && !tier0Failed) {
      // El juez corre tras el tier primario SOLO si no falló (si falló, ya tenemos trigger).
      // Diseño ESCALATE-ONLY: ok:true NUNCA relaja compuerta ni swallowea fallo zod.
      const answer = JSON.stringify(tier0Result);
      const verdict = await this.judge.judge({
        answer,
        system: this.judgeContext,
        sensitivity: req.sensitivity,
        temperature: 0,
      });
      judgeVerdict = { ok: verdict.ok, confidence: verdict.confidence };
      if (!verdict.ok) {
        judgeTriggeredEscalation = true;
      }
    }

    const needsEscalation = tier0Failed || judgeTriggeredEscalation;

    // ── Sin trigger: retornar resultado de tier-0 ──────────────────────────────
    if (!needsEscalation) {
      const latencyMs = Date.now() - t0;
      this._emit({
        providerId: primaryTier.id,
        task: req.task,
        latencyMs,
        costUsd: this._estimateCost(this.costPerToken),
        validationOutcome: capturedOutcome,
        judgeVerdict,
        escalated: false,
        ts: new Date().toISOString(),
      });
      return tier0Result as T;
    }

    // ── Con trigger: verificar presupuesto antes de escalar ────────────────────
    // maxBudgetUsd:0 → sin escalación; undefined → sin límite.
    const budgetExceeded =
      this.maxBudgetUsd !== undefined && this.maxBudgetUsd <= 0;

    if (budgetExceeded) {
      const latencyMs = Date.now() - t0;
      this._emit({
        providerId: primaryTier.id,
        task: req.task,
        latencyMs,
        costUsd: this._estimateCost(this.costPerToken),
        validationOutcome: capturedOutcome,
        judgeVerdict,
        escalated: true,
        ts: new Date().toISOString(),
      });
      throw new EscalationExhaustedError("budget-exceeded");
    }

    // ── Escalación: UN hop a tier-1 ────────────────────────────────────────────
    if (!escalationTier) {
      // No hay tier de escalación.
      const latencyMs = Date.now() - t0;
      this._emit({
        providerId: primaryTier.id,
        task: req.task,
        latencyMs,
        costUsd: this._estimateCost(this.costPerToken),
        validationOutcome: capturedOutcome,
        judgeVerdict,
        escalated: true,
        ts: new Date().toISOString(),
      });
      throw new EscalationExhaustedError("no-escalation-tier");
    }

    // Escalación: llamar tier-1 UN hop (sin volver a tier-0 — T-108-04).
    try {
      const escalationResult = await escalationTier.complete(req, schema);
      const latencyMs = Date.now() - t0;
      this._emit({
        providerId: escalationTier.id,
        task: req.task,
        latencyMs,
        costUsd: this._estimateCost(this.escalationCostPerToken),
        validationOutcome: null, // outcome de escalación no capturado por wrapper
        judgeVerdict,
        escalated: true,
        ts: new Date().toISOString(),
      });
      return escalationResult;
    } catch {
      // tier-1 también falló → EscalationExhaustedError (sin loop, T-108-04).
      const latencyMs = Date.now() - t0;
      this._emit({
        providerId: escalationTier.id,
        task: req.task,
        latencyMs,
        costUsd: null,
        validationOutcome: null,
        judgeVerdict,
        escalated: true,
        ts: new Date().toISOString(),
      });
      throw new EscalationExhaustedError("all-tiers-failed");
    }
  }

  /** Emite exactamente UN TelemetryEvent por invocación (PAYLOAD-FREE, T-108-06). */
  private _emit(event: TelemetryEvent): void {
    this.telemetrySink(event);
  }

  /** Estimación de costo en USD (aproximada). null si costPerToken no disponible. */
  private _estimateCost(costPerToken?: number): number | null {
    if (costPerToken == null) return null;
    // Estimado conservador: 120 tokens de output (igual que MockProvider).
    return costPerToken * 120;
  }
}
