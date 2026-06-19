/**
 * Tests de backfill-rut (IDENT-10). Cubre la regla LOCKED "NUNCA fabricar un RUT":
 *   - DV válido (módulo-11) → se acepta y normaliza.
 *   - DV inválido → se rechaza a un log de revisión, NUNCA se escribe.
 *   - provenance faltante (origen/fecha_captura/enlace) → se rechaza (0005 exige NOT NULL).
 *   - idempotencia: dos corridas con la misma lista producen las mismas escrituras por id.
 *   - updateRut: actualiza solo rut+provenance de los id pasados, en lotes.
 */

import { describe, it, expect } from "vitest";
import {
  aceptarRutBackfill,
  runBackfillRut,
  type FilaRutCruda,
  type RutBackfillWriter,
  type FilaRutEscribir,
} from "./backfill-rut";

const PROV = {
  origen: "infoprobidad-declaracion",
  fecha_captura: "2026-06-19T00:00:00Z",
  enlace: "https://www.infoprobidad.cl/declaracion/123",
} as const;

/** RUT real DV-válido (módulo-11): 11.111.111-1 y 12.345.678-5. */
const RUT_VALIDO = "12.345.678-5";
const RUT_INVALIDO = "12.345.678-9"; // DV real es 5 → inválido

/** Writer espía: registra los lotes recibidos por updateRut (sin tocar la DB). */
class SpyWriter implements RutBackfillWriter {
  lotes: FilaRutEscribir[][] = [];
  async updateRut(rows: FilaRutEscribir[]): Promise<{ actualizadas: number }> {
    this.lotes.push(rows);
    return { actualizadas: rows.length };
  }
  /** Todas las filas vistas a lo largo de las llamadas. */
  get vistas(): FilaRutEscribir[] {
    return this.lotes.flat();
  }
}

describe("aceptarRutBackfill — DV gate + provenance (nunca fabricar)", () => {
  it("RUT con DV válido + provenance → acepta y normaliza (normRut)", () => {
    const fila: FilaRutCruda = { id: "D1009", rut: RUT_VALIDO, ...PROV };
    const r = aceptarRutBackfill(fila);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.fila.id).toBe("D1009");
      expect(r.fila.rut).toBe("123456785"); // normRut: sin puntos/guión, DV casefold
      expect(r.fila.origen).toBe(PROV.origen);
    }
  });

  it("RUT con DV INVÁLIDO → rechaza a revisión, NUNCA produce fila escribible", () => {
    const fila: FilaRutCruda = { id: "D1012", rut: RUT_INVALIDO, ...PROV };
    const r = aceptarRutBackfill(fila);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.razon).toBe("dv-invalido");
  });

  it("provenance faltante (sin enlace) → rechaza (0005 exige NOT NULL)", () => {
    const fila = { id: "D1013", rut: RUT_VALIDO, origen: PROV.origen, fecha_captura: PROV.fecha_captura } as unknown as FilaRutCruda;
    const r = aceptarRutBackfill(fila);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.razon).toBe("provenance-faltante");
  });

  it("provenance vacía (origen='') → rechaza (NOT NULL ≠ string vacío)", () => {
    const fila: FilaRutCruda = { id: "D1013", rut: RUT_VALIDO, origen: "", fecha_captura: PROV.fecha_captura, enlace: PROV.enlace };
    const r = aceptarRutBackfill(fila);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.razon).toBe("provenance-faltante");
  });
});

describe("runBackfillRut — orquesta filtro DV + provenance → updateRut", () => {
  it("filtra válidas, escribe solo esas, devuelve {escritas, rechazadas}", async () => {
    const writer = new SpyWriter();
    const filas: FilaRutCruda[] = [
      { id: "D1009", rut: RUT_VALIDO, ...PROV },
      { id: "D1012", rut: RUT_INVALIDO, ...PROV }, // DV inválido → rechazada
      { id: "D1013", rut: "11.111.111-1", ...PROV }, // DV válido
    ];
    const res = await runBackfillRut(filas, writer);
    expect(res.escritas).toBe(2);
    expect(res.rechazadas).toHaveLength(1);
    expect(res.rechazadas[0]!.razon).toBe("dv-invalido");
    // El writer NUNCA vio el RUT inválido (nunca se fabrica/escribe).
    const ids = writer.vistas.map((f) => f.id);
    expect(ids).toContain("D1009");
    expect(ids).toContain("D1013");
    expect(ids).not.toContain("D1012");
  });

  it("lista vacía → no llama al writer, 0 escritas", async () => {
    const writer = new SpyWriter();
    const res = await runBackfillRut([], writer);
    expect(res.escritas).toBe(0);
    expect(writer.lotes).toHaveLength(0);
  });

  it("idempotente: 2 corridas con la misma lista producen las mismas escrituras por id", async () => {
    const filas: FilaRutCruda[] = [{ id: "D1009", rut: RUT_VALIDO, ...PROV }];
    const w1 = new SpyWriter();
    const w2 = new SpyWriter();
    const r1 = await runBackfillRut(filas, w1);
    const r2 = await runBackfillRut(filas, w2);
    expect(r1.escritas).toBe(r2.escritas);
    expect(w1.vistas.map((f) => ({ id: f.id, rut: f.rut }))).toEqual(
      w2.vistas.map((f) => ({ id: f.id, rut: f.rut })),
    );
  });
});
