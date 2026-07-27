import { describe, expect, it } from "vitest";
import {
  agregarFallos,
  clasificarOutcome,
  costoUsd,
  percentile,
  type CallOutcome,
} from "./metrics";

describe("percentile (nearest-rank, no interpolation)", () => {
  it("empty samples → NaN", () => {
    expect(percentile([], 50)).toBeNaN();
  });

  it("n=40: p50 lands on discrete sorted index 19, p95 on index 37", () => {
    // sorted values 0..39 → value === sorted index (identity), so the returned
    // value IS the index chosen. Proves nearest-rank with NO interpolation.
    const samples = Array.from({ length: 40 }, (_, i) => i);
    // shuffle a bit to prove it sorts internally
    const shuffled = [...samples].reverse();
    expect(percentile(shuffled, 50)).toBe(19); // ceil(0.5*40)-1 = 19
    expect(percentile(shuffled, 95)).toBe(37); // ceil(0.95*40)-1 = 37
  });

  it("p100 clamps to last index; p0 clamps to first", () => {
    const samples = [10, 20, 30, 40];
    expect(percentile(samples, 100)).toBe(40);
    expect(percentile(samples, 0)).toBe(10);
  });

  it("single sample returns that sample for any p", () => {
    expect(percentile([7], 50)).toBe(7);
    expect(percentile([7], 95)).toBe(7);
  });
});

describe("costoUsd (never silently zero)", () => {
  const rate = { in: 0.27, out: 1.1 }; // per 1M tokens

  it("computes prompt/1e6*in + completion/1e6*out", () => {
    const cost = costoUsd(
      { prompt_tokens: 1_000_000, completion_tokens: 2_000_000 },
      rate,
    );
    // 1*0.27 + 2*1.1 = 2.47
    expect(cost).toBeCloseTo(2.47, 10);
  });

  it("undefined usage → null (NOT 0)", () => {
    expect(costoUsd(undefined, rate)).toBeNull();
  });

  it("missing prompt_tokens → null (NOT 0)", () => {
    expect(costoUsd({ completion_tokens: 100 }, rate)).toBeNull();
  });

  it("missing completion_tokens → null (NOT 0)", () => {
    expect(costoUsd({ prompt_tokens: 100 }, rate)).toBeNull();
  });
});

describe("clasificarOutcome (mirrors validate.ts semantics)", () => {
  it("clean = payload usable on attempt 0, no repair, not terminal", () => {
    const o = clasificarOutcome({
      payloadUsableAttempt0: true,
      repaired: false,
      terminal: false,
    });
    expect(o).toBe<CallOutcome>("clean");
  });

  it("structured-output-fail = no usable payload on attempt 0", () => {
    const o = clasificarOutcome({
      payloadUsableAttempt0: false,
      repaired: false,
      terminal: false,
    });
    expect(o).toBe<CallOutcome>("structured-output-fail");
  });

  it("zod-repaired = parsed on attempt 0 but repaired to a valid object", () => {
    const o = clasificarOutcome({
      payloadUsableAttempt0: true,
      repaired: true,
      terminal: false,
    });
    expect(o).toBe<CallOutcome>("zod-repaired");
  });

  it("zod-terminal = attempts exhausted (terminal), distinct from structured-output-fail", () => {
    const o = clasificarOutcome({
      payloadUsableAttempt0: true,
      repaired: false,
      terminal: true,
    });
    expect(o).toBe<CallOutcome>("zod-terminal");
    expect(o).not.toBe("structured-output-fail");
  });
});

describe("agregarFallos (Pitfall B — the two failure metrics stay SEPARATE)", () => {
  it("returns structured_output_fail_rate and zod_fail_rate.{repaired,terminal} as three distinct rates", () => {
    const outcomes: CallOutcome[] = [
      "clean",
      "clean",
      "structured-output-fail",
      "zod-repaired",
      "zod-terminal",
    ];
    const r = agregarFallos(outcomes);
    expect(r.structured_output_fail_rate).toBeCloseTo(1 / 5, 10);
    expect(r.zod_fail_rate.repaired).toBeCloseTo(1 / 5, 10);
    expect(r.zod_fail_rate.terminal).toBeCloseTo(1 / 5, 10);
    // three distinct numbers, none folded into another
    expect(r.structured_output_fail_rate).not.toBe(r.zod_fail_rate.terminal + r.zod_fail_rate.repaired);
  });

  it("anti-Pitfall-B: a model that structure-fails 30% but is clean on what it managed reports a HIGH structured_output_fail_rate (does NOT look good)", () => {
    // 10 calls: 3 structured-output-fail, 7 clean → looks perfect on quality
    // (100% clean on the ones it managed) but MUST expose 30% structure fail.
    const outcomes: CallOutcome[] = [
      ...Array<CallOutcome>(3).fill("structured-output-fail"),
      ...Array<CallOutcome>(7).fill("clean"),
    ];
    const r = agregarFallos(outcomes);
    expect(r.structured_output_fail_rate).toBeCloseTo(0.3, 10);
    // the failure is NOT hidden inside zod metrics
    expect(r.zod_fail_rate.repaired).toBe(0);
    expect(r.zod_fail_rate.terminal).toBe(0);
  });

  it("empty list → all rates 0 (no division by zero)", () => {
    const r = agregarFallos([]);
    expect(r.structured_output_fail_rate).toBe(0);
    expect(r.zod_fail_rate.repaired).toBe(0);
    expect(r.zod_fail_rate.terminal).toBe(0);
  });
});
