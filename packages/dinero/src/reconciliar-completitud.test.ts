// reconciliar-completitud.test — reconciliacion de completitud RUN-LEVEL (drift bloqueante). Pura.
//
// Invariantes:
//  - Content-MD5 mismatch -> { ok:false }.
//  - Content-Length mismatch -> { ok:false }.
//  - TOTAL declarado parseable != parsed.length -> { ok:false }; sin TOTAL, MD5+length bastan.
//  - sin ningun control -> { ok:false } (fail-closed: nunca emitir a ciegas).

import { describe, it, expect } from "vitest";
import { reconciliarCompletitud } from "./reconciliar-completitud";
import type { Aporte } from "./model-servel";

function aporte(i: number): Aporte {
  return {
    fuenteId: `f${i}`,
    fechaCorte: "2026-06-19",
    eleccion: "DIPUTADO - DISTRITO 1 - 2025",
    donanteNombre: "X",
    tipoPersona: "Natural",
    monto: "100",
    fechaAporte: "2025-01-01",
    tipoAporte: "Aporte",
    candidatoNombreVerbatim: "Cand X",
    territorio: "DISTRITO 1",
    pacto: null,
    partido: null,
    origen: "servel",
    fecha_captura: "2026-06-19T00:00:00Z",
    enlace: "https://x",
    licencia: "terminos por verificar",
  };
}

const parsed3 = [aporte(1), aporte(2), aporte(3)];

describe("reconciliarCompletitud — drift bloqueante run-level", () => {
  it("Content-MD5 mismatch -> { ok:false }", () => {
    const res = reconciliarCompletitud(
      parsed3,
      { contentMd5: "AAAbase64==", contentLength: 1000, declaredRowCount: null },
      { md5: "ZZZdistinto==", length: 1000 },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.motivo).toMatch(/Content-MD5/);
  });

  it("Content-Length mismatch -> { ok:false }", () => {
    const res = reconciliarCompletitud(
      parsed3,
      { contentMd5: "MISMO==", contentLength: 999, declaredRowCount: null },
      { md5: "MISMO==", length: 1000 },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.motivo).toMatch(/Content-Length/);
  });

  it("TOTAL declarado != parsed.length -> { ok:false }", () => {
    const res = reconciliarCompletitud(
      parsed3,
      { contentMd5: "MISMO==", contentLength: 1000, declaredRowCount: 5 },
      { md5: "MISMO==", length: 1000 },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.motivo).toMatch(/TOTAL/);
  });

  it("sin TOTAL pero MD5+length cuadran -> { ok:true }", () => {
    const res = reconciliarCompletitud(
      parsed3,
      { contentMd5: "MISMO==", contentLength: 1000, declaredRowCount: null },
      { md5: "MISMO==", length: 1000 },
    );
    expect(res.ok).toBe(true);
  });

  it("TOTAL coincide y MD5+length cuadran -> { ok:true }", () => {
    const res = reconciliarCompletitud(
      parsed3,
      { contentMd5: "MISMO==", contentLength: 1000, declaredRowCount: 3 },
      { md5: "MISMO==", length: 1000 },
    );
    expect(res.ok).toBe(true);
  });

  it("sin ningun ancla de completitud -> { ok:false } (fail-closed)", () => {
    const res = reconciliarCompletitud(
      parsed3,
      { contentMd5: null, contentLength: null, declaredRowCount: null },
      { md5: "loquesea==", length: 1000 },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.motivo).toMatch(/sin ancla/);
  });
});
