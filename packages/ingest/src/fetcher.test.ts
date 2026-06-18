import { describe, expect, it } from "vitest";
import { makeMockFetch } from "../test/_helpers";
import { Fetcher, RetryableError } from "./fetcher";
import { HostNotAllowedError } from "./allowlist";
import { IDENTIFIED_UA } from "./robots";

// CR-03: el host debe ser un origen gubernamental allowlisted.
const URL_OK = "https://www.camara.cl/data";
const SPEC = { url: URL_OK, host: "www.camara.cl" };

describe("Fetcher", () => {
  it("Test 4a: 200 => devuelve el body crudo como Uint8Array", async () => {
    const mock = makeMockFetch({
      [URL_OK]: { status: 200, body: "hola" },
    });
    const fetcher = new Fetcher({ fetchFn: mock.fn });
    const body = await fetcher.get(SPEC);
    expect(new TextDecoder().decode(body)).toBe("hola");
  });

  it("Test 4b: 429 => lanza RetryableError (NO devuelve body) para backoff", async () => {
    const mock = makeMockFetch({
      [URL_OK]: { status: 429 },
    });
    const fetcher = new Fetcher({ fetchFn: mock.fn });
    await expect(fetcher.get(SPEC)).rejects.toBeInstanceOf(RetryableError);
  });

  it("5xx => tambien senaliza retry (backoff diferido)", async () => {
    const mock = makeMockFetch({
      [URL_OK]: { status: 503 },
    });
    const fetcher = new Fetcher({ fetchFn: mock.fn });
    await expect(fetcher.get(SPEC)).rejects.toBeInstanceOf(RetryableError);
  });

  it("setea el User-Agent identificatorio LOCKED en la request", async () => {
    const mock = makeMockFetch({
      [URL_OK]: { status: 200, body: "x" },
    });
    const fetcher = new Fetcher({ fetchFn: mock.fn });
    await fetcher.get(SPEC);
    expect(mock.calls[0]!.headers["user-agent"]).toBe(IDENTIFIED_UA);
  });

  // --- CR-03: defensa SSRF / allowlist deny-by-default ---

  it("CR-03: host NO gubernamental => HostNotAllowedError, sin fetch", async () => {
    const mock = makeMockFetch({});
    const fetcher = new Fetcher({ fetchFn: mock.fn });
    await expect(
      fetcher.get({ url: "https://evil.example.com/x", host: "evil.example.com" }),
    ).rejects.toBeInstanceOf(HostNotAllowedError);
    expect(mock.calls.length).toBe(0); // nunca toco la red
  });

  it("CR-03: target interno (metadata cloud) => HostNotAllowedError, sin fetch", async () => {
    const mock = makeMockFetch({});
    const fetcher = new Fetcher({ fetchFn: mock.fn });
    await expect(
      fetcher.get({ url: "http://169.254.169.254/latest/meta-data/", host: "x" }),
    ).rejects.toBeInstanceOf(HostNotAllowedError);
    expect(mock.calls.length).toBe(0);
  });

  it("CR-03: localhost/loopback => HostNotAllowedError, sin fetch", async () => {
    const mock = makeMockFetch({});
    const fetcher = new Fetcher({ fetchFn: mock.fn });
    for (const url of [
      "http://localhost:8000/",
      "http://127.0.0.1/",
      "http://kong:8000/",
      "http://[::1]/",
      "http://10.0.0.5/",
      "http://192.168.1.10/",
    ]) {
      await expect(fetcher.get({ url, host: "x" })).rejects.toBeInstanceOf(
        HostNotAllowedError,
      );
    }
    expect(mock.calls.length).toBe(0);
  });

  it("CR-03: http (no https) a host gubernamental => rechazado", async () => {
    const mock = makeMockFetch({});
    const fetcher = new Fetcher({ fetchFn: mock.fn });
    await expect(
      fetcher.get({ url: "http://www.camara.cl/x", host: "www.camara.cl" }),
    ).rejects.toBeInstanceOf(HostNotAllowedError);
  });

  it("CR-03: subdominio de un sufijo allowlisted SI se permite", async () => {
    const url = "https://opendata.camara.cl/x";
    const mock = makeMockFetch({ [url]: { status: 200, body: "ok" } });
    const fetcher = new Fetcher({ fetchFn: mock.fn });
    const body = await fetcher.get({ url, host: "opendata.camara.cl" });
    expect(new TextDecoder().decode(body)).toBe("ok");
  });

  it("CR-03: WR-01 host efectivo sale de la URL, NO de spec.host spoofeado", async () => {
    // spec.host miente ("www.camara.cl") pero la URL real es interna => rechazado.
    const mock = makeMockFetch({});
    const fetcher = new Fetcher({ fetchFn: mock.fn });
    await expect(
      fetcher.get({ url: "http://169.254.169.254/", host: "www.camara.cl" }),
    ).rejects.toBeInstanceOf(HostNotAllowedError);
    expect(mock.calls.length).toBe(0);
  });

  it("CR-03: extraHosts habilita dummy.local sobre http (solo dev/CI)", async () => {
    const url = "https://dummy.local/echo";
    const mock = makeMockFetch({ [url]: { status: 200, body: "echo" } });
    const fetcher = new Fetcher({
      fetchFn: mock.fn,
      allowlist: { extraHosts: ["dummy.local"] },
    });
    const body = await fetcher.get({ url, host: "dummy.local" });
    expect(new TextDecoder().decode(body)).toBe("echo");
  });
});
