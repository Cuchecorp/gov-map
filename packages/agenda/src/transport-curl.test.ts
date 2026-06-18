// Tests del transporte `curl` anti-Cloudflare (WR-03). No tocan la red ni el
// binario real: inyectan un `spawnFn` falso que emula stdout/stderr/close.

import { describe, it, expect } from "vitest";
import { EventEmitter } from "node:events";
import { createCurlTransport, CurlUnavailableError } from "./transport-curl";

const STATUS_MARKER = "\n__CURL_HTTP_STATUS__:";

/** Fake de child_process: emite el body + el status que `-w` añadiría, y cierra. */
function fakeSpawn(opts: {
  stdout?: string;
  status?: number;
  errorCode?: string;
  throwOnSpawn?: boolean;
}) {
  return ((_bin: string, _args: readonly string[]) => {
    if (opts.throwOnSpawn) throw new Error("spawn boom");
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    queueMicrotask(() => {
      if (opts.errorCode) {
        const err = new Error("spawn error") as NodeJS.ErrnoException;
        err.code = opts.errorCode;
        child.emit("error", err);
        return;
      }
      const body = opts.stdout ?? "<html>ok</html>";
      const full = `${body}${STATUS_MARKER}${opts.status ?? 200}`;
      child.stdout.emit("data", Buffer.from(full, "utf8"));
      child.emit("close", 0);
    });
    return child;
  }) as unknown as typeof import("node:child_process").spawn;
}

describe("createCurlTransport (WR-03)", () => {
  it("parsea body + status 200 → ok=true", async () => {
    const t = createCurlTransport({
      spawnFn: fakeSpawn({ stdout: "<html>OK</html>", status: 200 }),
    });
    const res = await t("https://www.camara.cl/x", { headers: { Accept: "text/html" } });
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.toString("utf8")).toBe("<html>OK</html>");
  });

  it("status 403 → ok=false (sin lanzar; el caller mapea a CamaraBloqueadaError)", async () => {
    const t = createCurlTransport({ spawnFn: fakeSpawn({ stdout: "blocked", status: 403 }) });
    const res = await t("https://www.camara.cl/x");
    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
  });

  it("curl ausente (ENOENT) → CurlUnavailableError (degradación con gracia)", async () => {
    const t = createCurlTransport({ spawnFn: fakeSpawn({ errorCode: "ENOENT" }) });
    await expect(t("https://www.camara.cl/x")).rejects.toBeInstanceOf(CurlUnavailableError);
  });

  it("spawn lanza sincrónicamente → CurlUnavailableError", async () => {
    const t = createCurlTransport({ spawnFn: fakeSpawn({ throwOnSpawn: true }) });
    await expect(t("https://www.camara.cl/x")).rejects.toBeInstanceOf(CurlUnavailableError);
  });

  it("preserva bytes binarios del body (no asume texto)", async () => {
    // El status se localiza por el último marcador, no por decodificar el body.
    const t = createCurlTransport({ spawnFn: fakeSpawn({ stdout: "áé—✓", status: 200 }) });
    const res = await t("https://www.camara.cl/x");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.toString("utf8")).toBe("áé—✓");
  });
});
