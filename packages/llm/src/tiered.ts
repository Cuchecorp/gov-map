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
 * - `assertNoRutInLlmInput` en la ENTRADA del decorador (defensa en profundidad, T-108-03)
 *   Y en el hop AL JUEZ (WR-01): la salida de tier-0 se re-guarda antes de cruzar al juez,
 *   sin delegar en que cada JudgeProvider re-guarde su `answer`.
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

    // ── Contrato: onValidationOutcome del caller se dispara EXACTAMENTE una vez ──
    // (WR-02) El observador del caller describe el desenlace del tier que produce el
    // VALOR RETORNADO. `parseAndValidate` (validate.ts) dispara su onOutcome ANTES del
    // throw terminal; si simplemente reenviáramos `req.onValidationOutcome` en el
    // wrapper de tier-0 Y volviéramos a pasar `req` a tier-1, el callback del caller se
    // dispararía DOS veces en una escalación (una por el fallo terminal de tier-0, otra
    // por el desenlace de tier-1). Eso rompe el "invoked EXACTLY once" del que depende
    // @obs/llm-bench para recuperar el desenlace real de producción.
    //
    // Solución: los wrappers de tier CAPTURAN el outcome pero NO reenvían el callback
    // del caller. Nosotros disparamos `req.onValidationOutcome` una sola vez, con el
    // outcome del tier que efectivamente produjo el valor retornado, justo antes de
    // retornar (o antes de lanzar el terminal).
    let capturedOutcome: ValidationOutcome | null = null;
    let escalationOutcome: ValidationOutcome | null = null;
    let callerOutcomeFired = false;
    const fireCallerOutcome = (o: ValidationOutcome | null): void => {
      // Idempotente y a lo sumo-una-vez: el callback del caller se invoca una sola vez
      // por complete(), con el outcome del tier que produjo el valor retornado.
      if (callerOutcomeFired) return;
      callerOutcomeFired = true;
      if (o !== null) req.onValidationOutcome?.(o);
    };

    // Wrapper de tier-0: captura el outcome, NO reenvía al caller (lo hacemos nosotros).
    const wrappedReq: CompletionRequest = {
      ...req,
      onValidationOutcome: (o: ValidationOutcome) => {
        capturedOutcome = o;
      },
    };
    // Wrapper de tier-1 (escalación): captura su outcome, tampoco reenvía al caller.
    const escalationReq: CompletionRequest = {
      ...req,
      onValidationOutcome: (o: ValidationOutcome) => {
        escalationOutcome = o;
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
      // (WR-01) Defensa en profundidad en el hop AL JUEZ: la salida del tier-0 cruza a
      // un SEGUNDO LLM (el juez). Si el modelo primario echó un RUT a su salida
      // estructurada, ese RUT no debe llegar al juez. Guardamos aquí, en la frontera del
      // propio decorador — NO delegamos en que cada JudgeProvider re-guarde su answer.
      assertNoRutInLlmInput(answer);
      if (this.judgeContext) assertNoRutInLlmInput(this.judgeContext);
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
      // El valor retornado proviene de tier-0 → disparar el callback del caller con
      // el outcome de tier-0 (WR-02: exactamente una vez).
      fireCallerOutcome(capturedOutcome);
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
    // (WR-05) Enforcement de presupuesto POSITIVO: se compara el costo YA acumulado
    // por tier-0 contra `maxBudgetUsd`. Si escalar excedería el budget (o el costo de
    // tier-0 ya lo consumió), se aborta ANTES del hop de escalación — cumpliendo el
    // contrato de LadderConfig.maxBudgetUsd ("Si se supera antes de la escalación,
    // aborta con error"). Antes solo el sentinela `0` disparaba; un budget positivo se
    // comportaba como `undefined` (unlimited). El costo de escalación se estima con el
    // costPerToken del tier de escalación; si el acumulado (tier-0 + estimado tier-1)
    // superaría el budget, no se escala.
    let budgetExceeded = false;
    if (this.maxBudgetUsd !== undefined) {
      if (this.maxBudgetUsd <= 0) {
        // Sentinela: 0 (o negativo) → escalación deshabilitada.
        budgetExceeded = true;
      } else {
        const primaryCost = this._estimateCost(this.costPerToken) ?? 0;
        const escalationCost = this._estimateCost(this.escalationCostPerToken) ?? 0;
        // Aborta si el costo de tier-0 ya agotó el budget, o si sumar la escalación
        // lo excedería.
        if (primaryCost >= this.maxBudgetUsd || primaryCost + escalationCost > this.maxBudgetUsd) {
          budgetExceeded = true;
        }
      }
    }

    if (budgetExceeded) {
      // Terminal sin escalación: el desenlace de producción es el de tier-0 (WR-02).
      fireCallerOutcome(capturedOutcome);
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
      // No hay tier de escalación. Terminal: el desenlace es el de tier-0 (WR-02).
      fireCallerOutcome(capturedOutcome);
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
    //
    // (WR-03) DECISIÓN DELIBERADA: el juez NO re-evalúa la salida de tier-1. La cascada
    // es de UN hop acotado (T-108-04): re-juzgar tier-1 abriría la puerta a un loop
    // re-judge→re-escalate. El resultado de tier-1 se retorna SIN adjudicación de juez
    // por diseño; la telemetría lo refleja emitiendo `judgeVerdict` (el veredicto de
    // tier-0 que causó la escalación) mientras el `providerId` apunta a tier-1 — el
    // consumidor sabe que el valor retornado NO fue juzgado (el verdict pertenece al
    // tier anterior). Ver test "escalación retorna salida NO juzgada".
    try {
      // (WR-02) Usar `escalationReq` (wrapper que captura el outcome de tier-1 sin
      // reenviar el callback del caller). El valor retornado proviene de tier-1 → el
      // callback del caller se dispara con el outcome de tier-1 (exactamente una vez).
      const escalationResult = await escalationTier.complete(escalationReq, schema);
      fireCallerOutcome(escalationOutcome);
      const latencyMs = Date.now() - t0;
      this._emit({
        providerId: escalationTier.id,
        task: req.task,
        latencyMs,
        costUsd: this._estimateCost(this.escalationCostPerToken),
        // (WR-04) Emitir el outcome TERMINAL de tier-0 capturado por el wrapper: es la
        // señal causal de POR QUÉ se escaló (zod-terminal / structured-output-fail).
        // El outcome propio de tier-1 no se refleja aquí (el evento es de la escalación,
        // no del tier de escalación aislado); el consumidor combina esto con judgeVerdict.
        validationOutcome: capturedOutcome,
        judgeVerdict,
        escalated: true,
        ts: new Date().toISOString(),
      });
      return escalationResult;
    } catch {
      // tier-1 también falló → EscalationExhaustedError (sin loop, T-108-04).
      // (WR-02) Terminal: el desenlace de producción es el del ÚLTIMO tier que produjo
      // uno (tier-1 si alcanzó a disparar su outcome terminal antes de lanzar; si no,
      // tier-0). Se dispara el callback del caller exactamente una vez.
      fireCallerOutcome(escalationOutcome ?? capturedOutcome);
      const latencyMs = Date.now() - t0;
      this._emit({
        providerId: escalationTier.id,
        task: req.task,
        latencyMs,
        costUsd: null,
        // (WR-04) La señal causal de la escalación sigue siendo el outcome terminal de
        // tier-0. tier-1 falló pero su outcome no es la causa; se emite el de tier-0.
        validationOutcome: capturedOutcome,
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
