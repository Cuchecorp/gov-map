/**
 * Tests del contrato de telemetría payload-free (telemetry.ts).
 *
 * Cubre: noopSink, jsonlSink y la disciplina de no-payload de TelemetryEvent.
 * Todos los tests corren OFFLINE (cero red, cero LLM real).
 */
import { describe, it, expect, vi } from "vitest";
import {
  type TelemetryEvent,
  type TelemetrySink,
  noopSink,
  jsonlSink,
} from "./telemetry";

// ─── Fixture: TelemetryEvent de ejemplo ──────────────────────────────────────

function makeEvent(overrides: Partial<TelemetryEvent> = {}): TelemetryEvent {
  return {
    providerId: "deepseek",
    task: "extraccion",
    latencyMs: 350,
    costUsd: 0.0000168,
    validationOutcome: { kind: "clean" },
    escalated: false,
    ts: "2026-07-27T00:00:00.000Z",
    ...overrides,
  };
}

// ─── noopSink ─────────────────────────────────────────────────────────────────

describe("noopSink", () => {
  it("no lanza al recibir un evento", () => {
    expect(() => noopSink(makeEvent())).not.toThrow();
  });

  it("no lanza con evento mínimo (sin task ni costUsd ni judgeVerdict)", () => {
    const minimal: TelemetryEvent = {
      providerId: "mock",
      latencyMs: 0,
      costUsd: null,
      validationOutcome: null,
      escalated: false,
      ts: new Date().toISOString(),
    };
    expect(() => noopSink(minimal)).not.toThrow();
  });

  it("es type-compatible con TelemetrySink", () => {
    // Verificación estática: noopSink debe aceptarse donde se espera TelemetrySink
    const sink: TelemetrySink = noopSink;
    expect(typeof sink).toBe("function");
  });
});

// ─── jsonlSink ────────────────────────────────────────────────────────────────

describe("jsonlSink", () => {
  it("escribe una línea JSON terminada en \\n por evento", () => {
    const lines: string[] = [];
    const sink = jsonlSink({ write: (l) => lines.push(l) });

    sink(makeEvent());

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/\n$/);
  });

  it("la línea es JSON parseable", () => {
    const lines: string[] = [];
    const sink = jsonlSink({ write: (l) => lines.push(l) });

    sink(makeEvent());

    expect(() => JSON.parse(lines[0])).not.toThrow();
  });

  it("round-trip preserva providerId, task, latencyMs, escalated", () => {
    const lines: string[] = [];
    const sink = jsonlSink({ write: (l) => lines.push(l) });

    const evt = makeEvent({ task: "routing", latencyMs: 123, escalated: true });
    sink(evt);

    const parsed = JSON.parse(lines[0]) as TelemetryEvent;
    expect(parsed.providerId).toBe("deepseek");
    expect(parsed.task).toBe("routing");
    expect(parsed.latencyMs).toBe(123);
    expect(parsed.escalated).toBe(true);
  });

  it("escribe un evento por llamada al sink (múltiples eventos → múltiples líneas)", () => {
    const lines: string[] = [];
    const sink = jsonlSink({ write: (l) => lines.push(l) });

    sink(makeEvent({ providerId: "deepseek", task: "extraccion" }));
    sink(makeEvent({ providerId: "minimax", task: "clasificacion" }));

    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]) as TelemetryEvent;
    const second = JSON.parse(lines[1]) as TelemetryEvent;
    expect(first.providerId).toBe("deepseek");
    expect(second.providerId).toBe("minimax");
  });

  it("round-trip preserva costUsd null y validationOutcome null", () => {
    const lines: string[] = [];
    const sink = jsonlSink({ write: (l) => lines.push(l) });

    sink(makeEvent({ costUsd: null, validationOutcome: null }));

    const parsed = JSON.parse(lines[0]) as TelemetryEvent;
    expect(parsed.costUsd).toBeNull();
    expect(parsed.validationOutcome).toBeNull();
  });

  it("round-trip preserva judgeVerdict (ok + confidence)", () => {
    const lines: string[] = [];
    const sink = jsonlSink({ write: (l) => lines.push(l) });

    sink(makeEvent({ judgeVerdict: { ok: true, confidence: 0.92 } }));

    const parsed = JSON.parse(lines[0]) as TelemetryEvent;
    expect(parsed.judgeVerdict).toEqual({ ok: true, confidence: 0.92 });
  });

  it("llama a target.write exactamente una vez por evento", () => {
    const writeFn = vi.fn();
    const sink = jsonlSink({ write: writeFn });

    sink(makeEvent());
    expect(writeFn).toHaveBeenCalledTimes(1);

    sink(makeEvent());
    expect(writeFn).toHaveBeenCalledTimes(2);
  });
});

// ─── Disciplina payload-free (T-108-01) ──────────────────────────────────────

describe("TelemetryEvent — disciplina payload-free (T-108-01)", () => {
  it("un TelemetryEvent de ejemplo NO contiene user, system, answer, prompt ni reason", () => {
    const evt = makeEvent();
    const keys = Object.keys(evt);

    const prohibidos = ["user", "system", "answer", "prompt", "reason"];
    for (const campo of prohibidos) {
      expect(keys, `El campo '${campo}' NO debe estar en TelemetryEvent`).not.toContain(campo);
    }
  });

  it("un TelemetryEvent con judgeVerdict NO expone reason del Verdict", () => {
    // judgeVerdict es Pick<Verdict, "ok"|"confidence"> — excluye reason
    const evt = makeEvent({ judgeVerdict: { ok: false, confidence: 0.3 } });
    const verdictKeys = Object.keys(evt.judgeVerdict ?? {});
    expect(verdictKeys).not.toContain("reason");
  });

  it("TelemetryEvent completo con todos los campos opcionales NO filtra contenido del dominio", () => {
    const fullEvt: TelemetryEvent = {
      providerId: "minimax",
      task: "clasificacion",
      latencyMs: 800,
      costUsd: 0.001,
      validationOutcome: { kind: "zod-repaired", attempts: 1 },
      judgeVerdict: { ok: false, confidence: 0.4 },
      escalated: true,
      ts: "2026-07-27T12:00:00.000Z",
    };

    const keys = Object.keys(fullEvt);
    const prohibidos = ["user", "system", "answer", "prompt", "reason"];
    for (const campo of prohibidos) {
      expect(keys, `El campo '${campo}' NO debe estar en TelemetryEvent`).not.toContain(campo);
    }
  });
});
