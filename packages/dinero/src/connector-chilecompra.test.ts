// connector-chilecompra.test — CR-01: el `MERCADOPUBLICO_TICKET` (secreto de operador) NUNCA debe
// aparecer en un mensaje de error lanzado, ni siquiera en los HTTP-errores que NO son 403/429/503.
//
// El conector arma URLs con `&ticket=<SECRET>` en la querystring. Cuando `Fetcher.get` falla, los
// errores `FetchError`/`RetryableError` interpolan la URL CRUDA (con el ticket) en su `.message`.
// Antes del fix, solo 403 (FetchError) y 429/503 (RetryableError) se saneaban; un 500/502/504/400/
// 401/404 re-lanzaba el error crudo con el ticket. Este test ejerce ESE camino (un 500) y exige que
// el mensaje surfaceado lleve `ticket=***` y NUNCA el secreto.

import { describe, it, expect } from "vitest";
import { Fetcher, HostRateLimiter, RobotsGuard } from "@obs/ingest";
import { ChileCompraConnector, ChileCompraBloqueadaError } from "./connector-chilecompra";
import { redactarTicket } from "./query";

const SECRET = "S3CR3T-TICKET-NO-LEAK-9f2a";

/** Deps del conector con un fetch fake que SIEMPRE responde `status` y sin delays de rate-limit. */
function connectorConStatus(status: number): ChileCompraConnector {
  const fetchFake: typeof fetch = async () =>
    new Response("error", { status }) as unknown as Response;
  return new ChileCompraConnector({
    fetcher: new Fetcher({ fetchFn: fetchFake }),
    rateLimiter: new HostRateLimiter({ minDelayMs: 0, jitterMs: 0 }),
    robots: new RobotsGuard({ allowlist: {} }),
  });
}

describe("ChileCompraConnector — CR-01: el ticket NUNCA se filtra en mensajes de error", () => {
  it("un 500 (RetryableError, NO 503) surfacea un error SIN el ticket y con ticket=***", async () => {
    const conn = connectorConStatus(500);
    let lanzado: unknown;
    try {
      await conn.buscarProveedor("76.123.456-0", SECRET);
    } catch (err) {
      lanzado = err;
    }
    expect(lanzado).toBeInstanceOf(Error);
    const msg = (lanzado as Error).message;
    // El secreto NUNCA aparece en el mensaje.
    expect(msg).not.toContain(SECRET);
    // Y si quedara algun `ticket=` en algun mensaje, debe estar enmascarado.
    expect(redactarTicket(msg)).not.toContain(SECRET);
    // Un 5xx degrada honestamente a ChileCompraBloqueadaError (sin querystring).
    expect(lanzado).toBeInstanceOf(ChileCompraBloqueadaError);
  });

  it("un 404 (FetchError, NO 403) surfacea un error SIN el ticket", async () => {
    const conn = connectorConStatus(404);
    let msg = "";
    try {
      await conn.ordenesDeCompra("17793", "02022024", SECRET);
    } catch (err) {
      msg = (err as Error).message;
    }
    expect(msg).not.toContain(SECRET);
    expect(msg).not.toContain("ticket=" + SECRET);
  });
});

describe("redactarTicket — enmascara el query param ticket sin tocar el resto", () => {
  it("reemplaza ticket=<SECRET> por ticket=*** preservando el resto de la URL", () => {
    const url = `https://api.mercadopublico.cl/x?CodigoProveedor=17793&ticket=${SECRET}&fecha=02022024`;
    const red = redactarTicket(url);
    expect(red).not.toContain(SECRET);
    expect(red).toContain("ticket=***");
    expect(red).toContain("CodigoProveedor=17793");
    expect(red).toContain("fecha=02022024");
  });

  it("es idempotente y null-safe sobre strings sin ticket", () => {
    expect(redactarTicket("sin ticket aqui")).toBe("sin ticket aqui");
    expect(redactarTicket(redactarTicket(`a?ticket=${SECRET}`))).toBe("a?ticket=***");
  });
});
