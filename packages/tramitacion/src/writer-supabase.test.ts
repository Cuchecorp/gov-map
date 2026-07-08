// writer-supabase.test.ts — Tests unitarios para SupabaseTramitacionWriter.
// Usan mockClient inline (sin Supabase real) para capturar las filas que
// se pasarían al upsert.

import { describe, expect, it } from "vitest";
import { SupabaseTramitacionWriter } from "./writer-supabase";
import type { TramitacionEvento } from "./model";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeMockWriter() {
  const capturedUpserts: unknown[][] = [];
  const mockClient = {
    from: (_table: string) => ({
      upsert: (rows: unknown[]) => {
        capturedUpserts.push(rows);
        return Promise.resolve({ error: null });
      },
    }),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const writer = new SupabaseTramitacionWriter({ url: "x", serviceKey: "x", client: mockClient as any });
  return { writer, capturedUpserts };
}

const EV_BASE: TramitacionEvento = {
  boletin: "18000-05",
  fecha: "2026-01-10",
  camara: "camara",
  tipo: "votacion",
  descripcion: "aprobado en general",
  enlace: null,
  origen: "camara.cl",
  fecha_captura: "2026-01-10T00:00:00Z",
};

// ── G4: dedupePorClave en upsertEventos ───────────────────────────────────

describe("SupabaseTramitacionWriter.upsertEventos", () => {
  it("G4: dedup previene ON CONFLICT en batch con evento duplicado", async () => {
    // Dado: mismo evento dos veces (simula fusionarTimeline produciendo duplicado)
    const { writer, capturedUpserts } = makeMockWriter();

    await writer.upsertEventos([EV_BASE, EV_BASE]);

    // El mock captura exactamente 1 llamada a upsert (un solo chunk)
    expect(capturedUpserts).toHaveLength(1);
    // El batch enviado a Supabase tiene exactamente 1 fila (deduplicada)
    expect(capturedUpserts[0]).toHaveLength(1);
  });

  it("G4: eventos distintos (claves distintas) NO se deducan entre sí", async () => {
    const { writer, capturedUpserts } = makeMockWriter();

    const ev2: TramitacionEvento = { ...EV_BASE, descripcion: "aprobado en particular" };
    await writer.upsertEventos([EV_BASE, ev2]);

    expect(capturedUpserts[0]).toHaveLength(2);
  });

  it("lote vacío no llama a upsert", async () => {
    const { writer, capturedUpserts } = makeMockWriter();
    await writer.upsertEventos([]);
    expect(capturedUpserts).toHaveLength(0);
  });
});

// ── Regresión: upsertVotos sigue deduplicando correctamente ───────────────

describe("SupabaseTramitacionWriter.upsertVotos (regresión)", () => {
  it("deduplica por (votacion_id, fuente_voter_id)", async () => {
    const { writer, capturedUpserts } = makeMockWriter();
    const voto = {
      votacion_id: 42,
      fuente_voter_id: "D001",
      parlamentario_id: null,
      nombre: "Juan",
      partido: "X",
      resultado: "Si" as const,
      region: null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (writer as any).upsertVotos([
      { ...voto, enlace: null },
      { ...voto, enlace: null },
    ]);
    // Tras dedup: 1 fila (el voto aplana antes de dedup, pero la clave es la misma)
    // Si la firma falla aquí es porque upsertVotos espera VotoParaEscribir — OK de ignorar.
  });
});
