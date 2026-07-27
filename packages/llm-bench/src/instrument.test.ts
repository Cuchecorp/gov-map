import { describe, expect, it } from "vitest";
import { instrumentedFetch, type CallMetric } from "./instrument";

/** Construye un `Response` con cuerpo JSON canónico clonable. */
function cannedResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("instrumentedFetch", () => {
  it("emits latency + usage-derived token counts to the sink and returns the ORIGINAL response", async () => {
    const metrics: CallMetric[] = [];
    const canned = cannedResponse({
      choices: [{ message: { content: "{}" } }],
      usage: { prompt_tokens: 123, completion_tokens: 45, total_tokens: 168 },
    });
    const base: typeof fetch = async () => canned;

    const wrapped = instrumentedFetch(base, (m) => metrics.push(m));
    const res = await wrapped("https://example.test/v1/chat/completions");

    // returns the original response object (not the clone)
    expect(res).toBe(canned);
    expect(metrics).toHaveLength(1);
    expect(metrics[0]!.promptTokens).toBe(123);
    expect(metrics[0]!.completionTokens).toBe(45);
    expect(typeof metrics[0]!.latencyMs).toBe("number");
    expect(metrics[0]!.latencyMs).toBeGreaterThanOrEqual(0);

    // original response body is still readable (clone did not consume it)
    const parsed = (await res.json()) as { usage: { prompt_tokens: number } };
    expect(parsed.usage.prompt_tokens).toBe(123);
  });

  it("body WITHOUT usage → CallMetric carries undefined token counts (so cost later resolves to null, never 0)", async () => {
    const metrics: CallMetric[] = [];
    const canned = cannedResponse({ choices: [{ message: { content: "{}" } }] });
    const base: typeof fetch = async () => canned;

    const wrapped = instrumentedFetch(base, (m) => metrics.push(m));
    await wrapped("https://example.test/v1/chat/completions");

    expect(metrics).toHaveLength(1);
    expect(metrics[0]!.promptTokens).toBeUndefined();
    expect(metrics[0]!.completionTokens).toBeUndefined();
  });

  it("non-JSON body → undefined token counts, still emits a latency sample, still returns original", async () => {
    const metrics: CallMetric[] = [];
    const canned = new Response("not json", { status: 200 });
    const base: typeof fetch = async () => canned;

    const wrapped = instrumentedFetch(base, (m) => metrics.push(m));
    const res = await wrapped("https://example.test/v1/chat/completions");

    expect(res).toBe(canned);
    expect(metrics).toHaveLength(1);
    expect(metrics[0]!.promptTokens).toBeUndefined();
    expect(metrics[0]!.completionTokens).toBeUndefined();
    expect(typeof metrics[0]!.latencyMs).toBe("number");
  });
});
