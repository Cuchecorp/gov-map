import { describe, expect, it } from "vitest";
import { makeMockFetch } from "../test/_helpers";
import { Fetcher, RetryableError } from "./fetcher";
import { IDENTIFIED_UA } from "./robots";

const SPEC = { url: "https://host.cl/data", host: "host.cl" };

describe("Fetcher", () => {
  it("Test 4a: 200 => devuelve el body crudo como Uint8Array", async () => {
    const mock = makeMockFetch({
      "https://host.cl/data": { status: 200, body: "hola" },
    });
    const fetcher = new Fetcher({ fetchFn: mock.fn });
    const body = await fetcher.get(SPEC);
    expect(new TextDecoder().decode(body)).toBe("hola");
  });

  it("Test 4b: 429 => lanza RetryableError (NO devuelve body) para backoff", async () => {
    const mock = makeMockFetch({
      "https://host.cl/data": { status: 429 },
    });
    const fetcher = new Fetcher({ fetchFn: mock.fn });
    await expect(fetcher.get(SPEC)).rejects.toBeInstanceOf(RetryableError);
  });

  it("5xx => tambien senaliza retry (backoff diferido)", async () => {
    const mock = makeMockFetch({
      "https://host.cl/data": { status: 503 },
    });
    const fetcher = new Fetcher({ fetchFn: mock.fn });
    await expect(fetcher.get(SPEC)).rejects.toBeInstanceOf(RetryableError);
  });

  it("setea el User-Agent identificatorio LOCKED en la request", async () => {
    const mock = makeMockFetch({
      "https://host.cl/data": { status: 200, body: "x" },
    });
    const fetcher = new Fetcher({ fetchFn: mock.fn });
    await fetcher.get(SPEC);
    expect(mock.calls[0]!.headers["user-agent"]).toBe(IDENTIFIED_UA);
  });
});
