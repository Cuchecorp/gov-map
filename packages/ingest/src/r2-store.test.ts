import { describe, expect, it } from "vitest";
import { makeMockFetch } from "../test/_helpers";
import { R2Store, sha256Hex } from "./r2-store";

const CFG = {
  accessKeyId: "AKIA_TEST",
  secretAccessKey: "secret_test",
  endpoint: "https://acct.r2.cloudflarestorage.com",
  bucket: "observatorio",
};

describe("R2Store.putImmutable", () => {
  it("Test 1a: key content-addressed {source}/{resource}/{date}/{sha}.{ext}", async () => {
    const body = new TextEncoder().encode("crudo");
    const sha = await sha256Hex(body);
    const url = `${CFG.endpoint}/${CFG.bucket}/camara/proyectos/2026-06-17/${sha}.json`;
    const mock = makeMockFetch({ [url]: { status: 200 } });
    const store = new R2Store(CFG, { fetchFn: mock.fn });

    const { r2Path } = await store.putImmutable(
      "camara",
      "proyectos",
      "2026-06-17",
      sha,
      "json",
      body,
    );
    expect(r2Path).toBe(`camara/proyectos/2026-06-17/${sha}.json`);
  });

  it("Test 1b: sha256 del mismo body es estable", async () => {
    const a = await sha256Hex(new TextEncoder().encode("igual"));
    const b = await sha256Hex(new TextEncoder().encode("igual"));
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("Test 1c: el PUT incluye header If-None-Match: *", async () => {
    const body = new TextEncoder().encode("x");
    const sha = await sha256Hex(body);
    const url = `${CFG.endpoint}/${CFG.bucket}/s/r/2026-06-17/${sha}.json`;
    const mock = makeMockFetch({ [url]: { status: 200 } });
    const store = new R2Store(CFG, { fetchFn: mock.fn });
    await store.putImmutable("s", "r", "2026-06-17", sha, "json", body);

    const put = mock.calls.find((c) => c.method === "PUT");
    expect(put).toBeDefined();
    expect(put!.headers["if-none-match"]).toBe("*");
  });

  it("Test 1d: status 412 (ya existia) devuelve r2Path correcto y existed=true", async () => {
    const body = new TextEncoder().encode("dup");
    const sha = await sha256Hex(body);
    const url = `${CFG.endpoint}/${CFG.bucket}/s/r/2026-06-17/${sha}.json`;
    const mock = makeMockFetch({ [url]: { status: 412 } });
    const store = new R2Store(CFG, { fetchFn: mock.fn });

    const { r2Path, existed } = await store.putImmutable("s", "r", "2026-06-17", sha, "json", body);
    expect(r2Path).toBe(`s/r/2026-06-17/${sha}.json`);
    expect(existed).toBe(true); // 412 = contenido sin cambios → hash-check early-exit
  });

  it("no expone credenciales en el error de un PUT fallido (T-01-06)", async () => {
    const body = new TextEncoder().encode("err");
    const sha = await sha256Hex(body);
    const url = `${CFG.endpoint}/${CFG.bucket}/s/r/2026-06-17/${sha}.json`;
    const mock = makeMockFetch({ [url]: { status: 500 } });
    const store = new R2Store(CFG, { fetchFn: mock.fn });
    await expect(
      store.putImmutable("s", "r", "2026-06-17", sha, "json", body),
    ).rejects.toThrow(/500/);
    await expect(
      store.putImmutable("s", "r", "2026-06-17", sha, "json", body),
    ).rejects.not.toThrow(/secret_test/);
  });

  it("PUT 200 => existed=false", async () => {
    const body = new TextEncoder().encode("nuevo");
    const sha = await sha256Hex(body);
    const url = `${CFG.endpoint}/${CFG.bucket}/s/r/2026-06-17/${sha}.json`;
    const mock = makeMockFetch({ [url]: { status: 200 } });
    const store = new R2Store(CFG, { fetchFn: mock.fn });

    const { existed } = await store.putImmutable("s", "r", "2026-06-17", sha, "json", body);
    expect(existed).toBe(false);
  });

  it("PUT 412 => existed=true (objeto ya existia)", async () => {
    const body = new TextEncoder().encode("dup");
    const sha = await sha256Hex(body);
    const url = `${CFG.endpoint}/${CFG.bucket}/s/r/2026-06-17/${sha}.json`;
    const mock = makeMockFetch({ [url]: { status: 412 } });
    const store = new R2Store(CFG, { fetchFn: mock.fn });

    const { r2Path, existed } = await store.putImmutable("s", "r", "2026-06-17", sha, "json", body);
    expect(existed).toBe(true);
    expect(r2Path).toBe(`s/r/2026-06-17/${sha}.json`);
  });
});

describe("R2Store.getObject", () => {
  it("GET 200 devuelve Uint8Array del body", async () => {
    const expected = new TextEncoder().encode("crudo-leido");
    const r2Path = "tramitacion/boletin/2026-01-10/abc123.json";
    const url = `${CFG.endpoint}/${CFG.bucket}/${r2Path}`;
    const mock = makeMockFetch({ [url]: { status: 200, body: expected } });
    const store = new R2Store(CFG, { fetchFn: mock.fn });
    const result = await store.getObject(r2Path);
    expect(result).toEqual(expected);
  });

  it("GET 404 lanza error sin exponer credenciales (T-01-06)", async () => {
    const r2Path = "no/existe/path.json";
    const url = `${CFG.endpoint}/${CFG.bucket}/${r2Path}`;
    const mock = makeMockFetch({ [url]: { status: 404 } });
    const store = new R2Store(CFG, { fetchFn: mock.fn });
    await expect(store.getObject(r2Path)).rejects.toThrow(/404/);
    await expect(store.getObject(r2Path)).rejects.not.toThrow(/secret_test/);
  });

  it("GET 500 lanza error sin exponer credenciales (T-01-06)", async () => {
    const r2Path = "tramitacion/boletin/2026-01-10/abc123.json";
    const url = `${CFG.endpoint}/${CFG.bucket}/${r2Path}`;
    const mock = makeMockFetch({ [url]: { status: 500 } });
    const store = new R2Store(CFG, { fetchFn: mock.fn });
    await expect(store.getObject(r2Path)).rejects.toThrow(/500/);
    await expect(store.getObject(r2Path)).rejects.not.toThrow(/secret_test/);
  });
});
