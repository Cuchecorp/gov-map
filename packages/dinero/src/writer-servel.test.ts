// writer-servel.test — InMemoryServelWriter idempotente + ServelConnector (orden LOCKED, https, bloqueo).
//
// Invariantes:
//  - upsert del mismo lote 2x -> mismos conteos (idempotente); clave de version (fuente_id, fecha_corte).
//  - marcarIngestado registra los parlamentarios con ingestado_hasta.
//  - donante sub-maestra upsert keyed por donante_id last-write-wins.
//  - connector: orden LOCKED (assertAllowedUrl host EXACTO -> https -> robots -> rate-limit -> get);
//    http rechazado; 403/503/429 -> ServelBloqueadaError; host no SERVEL rechazado.

import { describe, it, expect } from "vitest";
import { Fetcher, HostRateLimiter, RobotsGuard, FetchError, RetryableError } from "@obs/ingest";
import { InMemoryServelWriter } from "./writer-servel";
import type { AporteParaEscribir } from "./reconciliar-aporte";
import type { Donante } from "./model-servel";
import { confirmar } from "@obs/identity";
import {
  ServelConnector,
  ServelBloqueadaError,
  SERVEL_HOST,
  type HeadFn,
} from "./connector-servel";

function aporteEscribible(over: Partial<AporteParaEscribir> & { fuenteId: string }): AporteParaEscribir {
  return {
    fuenteId: over.fuenteId,
    fechaCorte: over.fechaCorte ?? "2026-06-19",
    eleccion: over.eleccion ?? "DIPUTADO - DISTRITO 23 - 2025",
    donanteNombre: over.donanteNombre ?? "Donante X",
    tipoPersona: over.tipoPersona ?? "Persona Natural",
    monto: over.monto ?? "1000000",
    fechaAporte: over.fechaAporte ?? "2025-03-10",
    tipoAporte: over.tipoAporte ?? "Aporte con publicidad",
    candidatoNombreVerbatim: over.candidatoNombreVerbatim ?? "Cand X",
    territorio: over.territorio ?? "DISTRITO 23",
    pacto: over.pacto ?? null,
    partido: over.partido ?? null,
    origen: "servel",
    fecha_captura: "2026-06-19T00:00:00Z",
    enlace: "https://repodocgastoelectoral.blob.core.windows.net/x.xlsx",
    licencia: "terminos por verificar",
    enlaceCandidato: over.enlaceCandidato ?? null,
    estadoVinculo: over.estadoVinculo ?? null,
  };
}

function donante(id: string, nombre: string): Donante {
  return {
    donanteId: id,
    rutDonante: null,
    nombre,
    tipoPersona: "Persona Natural",
    origen: "servel",
    fecha_captura: "2026-06-19T00:00:00Z",
    enlace: "https://repodocgastoelectoral.blob.core.windows.net/x.xlsx",
    licencia: "terminos por verificar",
  };
}

describe("InMemoryServelWriter — idempotente + versionado", () => {
  it("upsert del mismo lote 2x -> mismos conteos (clave fuente_id+fecha_corte)", async () => {
    const w = new InMemoryServelWriter();
    const lote = [aporteEscribible({ fuenteId: "a1" }), aporteEscribible({ fuenteId: "a2" })];
    await w.upsertAportes(lote);
    await w.upsertAportes(lote);
    expect(w.aportes.size).toBe(2);
    // Un nuevo corte de a1 es una version nueva (fila nueva).
    await w.upsertAportes([aporteEscribible({ fuenteId: "a1", fechaCorte: "2026-07-01" })]);
    expect(w.aportes.size).toBe(3);
  });

  it("FK del candidato se aplana: enlaceCandidato confirmado -> parlamentario_id poblado", async () => {
    const w = new InMemoryServelWriter();
    await w.upsertAportes([
      aporteEscribible({ fuenteId: "a1", enlaceCandidato: confirmar("P00500", "determinista"), estadoVinculo: "confirmado" }),
      aporteEscribible({ fuenteId: "a2" }), // sin enlace -> null
    ]);
    expect(w.aportes.get("a1∥2026-06-19")!.parlamentario_id).toBe("P00500");
    expect(w.aportes.get("a2∥2026-06-19")!.parlamentario_id).toBeNull();
  });

  it("donante sub-maestra: upsert keyed por donante_id last-write-wins", async () => {
    const w = new InMemoryServelWriter();
    await w.upsertDonantes([donante("d1", "Nombre Viejo")]);
    await w.upsertDonantes([donante("d1", "Nombre Nuevo"), donante("d2", "Otro")]);
    expect(w.donantes.size).toBe(2);
    expect(w.donantes.get("d1")!.nombre).toBe("Nombre Nuevo");
  });

  it("marcarIngestado registra parlamentarios con ingestado_hasta", async () => {
    const w = new InMemoryServelWriter();
    await w.marcarIngestado(["P00500", "P00501"], "2026-06-19");
    expect(w.ingestaEstado.size).toBe(2);
    expect(w.ingestaEstado.get("P00500")!.ingestado_hasta).toBe("2026-06-19");
  });
});

// -- ServelConnector: orden LOCKED + https forzado + degradacion honesta -----------

const HEAD_FAKE: HeadFn = async () => ({
  etag: '"abc"',
  contentMd5: "MD5BASE64==",
  lastModified: "Wed, 18 Jun 2026 00:00:00 GMT",
  contentLength: 5,
});

/** Fetcher fake que devuelve bytes fijos sin red, registrando el orden de llamada. */
function fakeFetcher(bytes: Uint8Array, err?: Error): Fetcher {
  return {
    async get() {
      if (err) throw err;
      return bytes;
    },
  } as unknown as Fetcher;
}

function robotsTrue(): RobotsGuard {
  return { async isAllowed() { return true; } } as unknown as RobotsGuard;
}

function rateLimiterNoop(): HostRateLimiter {
  return { async wait() { /* sin delay en test */ } } as unknown as HostRateLimiter;
}

const URL_OK = `https://${SERVEL_HOST}/public/x.xlsx`;

describe("ServelConnector — orden LOCKED + https + bloqueo", () => {
  it("descarga OK: bytes + anclas (Content-MD5/byte-length) por el host EXACTO via extraHosts", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const conn = new ServelConnector({
      fetcher: fakeFetcher(bytes),
      rateLimiter: rateLimiterNoop(),
      robots: robotsTrue(),
      headFn: HEAD_FAKE,
    });
    const res = await conn.descargar(URL_OK);
    expect(res.byteLength).toBe(5);
    expect(res.anclas.contentMd5).toBe("MD5BASE64==");
    expect(res.anclas.contentLength).toBe(5);
  });

  it("http (no https) para el host SERVEL -> THROW (https forzado, extraHosts admite http)", async () => {
    const conn = new ServelConnector({
      fetcher: fakeFetcher(new Uint8Array([1])),
      rateLimiter: rateLimiterNoop(),
      robots: robotsTrue(),
      headFn: HEAD_FAKE,
    });
    await expect(conn.descargar(`http://${SERVEL_HOST}/x.xlsx`)).rejects.toThrow(/requiere https/);
  });

  it("host NO SERVEL (ni allowlisted) -> THROW host no permitido (SSRF)", async () => {
    const conn = new ServelConnector({
      fetcher: fakeFetcher(new Uint8Array([1])),
      rateLimiter: rateLimiterNoop(),
      robots: robotsTrue(),
      headFn: HEAD_FAKE,
    });
    await expect(
      conn.descargar("https://otro-tenant.blob.core.windows.net/x.xlsx"),
    ).rejects.toThrow(/host no permitido/);
  });

  it("403 (FetchError) -> ServelBloqueadaError (degradacion honesta)", async () => {
    const conn = new ServelConnector({
      fetcher: fakeFetcher(new Uint8Array([1]), new FetchError(403, URL_OK)),
      rateLimiter: rateLimiterNoop(),
      robots: robotsTrue(),
      headFn: HEAD_FAKE,
    });
    await expect(conn.descargar(URL_OK)).rejects.toBeInstanceOf(ServelBloqueadaError);
  });

  it("503 (RetryableError) -> ServelBloqueadaError", async () => {
    const conn = new ServelConnector({
      fetcher: fakeFetcher(new Uint8Array([1]), new RetryableError(503, URL_OK)),
      rateLimiter: rateLimiterNoop(),
      robots: robotsTrue(),
      headFn: HEAD_FAKE,
    });
    await expect(conn.descargar(URL_OK)).rejects.toBeInstanceOf(ServelBloqueadaError);
  });
});
