/**
 * Tests del RevisionWriter (espeja writer-supabase.test.ts): cliente Supabase
 * mockeado que captura insert/update/select por tabla. SIN red.
 *
 * Invariantes verificados:
 *  - enqueueRevision INSERTA en revision_identidad con candidatos/salida_modelo jsonb.
 *  - upsertVinculo hace UPSERT en vinculo_identidad con estado+metodo.
 *  - appendAudit INSERTA en identidad_audit (NUNCA update) — inmutabilidad app-side.
 *  - un error de DB se propaga con mensaje claro (sin secretos).
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RevisionWriter,
  type CasoRevision,
  type FilaVinculo,
  type FilaAudit,
} from "./writer-revision";

interface InsertCall {
  table: string;
  rows: unknown;
}
interface UpsertCall {
  table: string;
  rows: unknown;
  onConflict: string | undefined;
}
interface UpdateCall {
  table: string;
  patch: Record<string, unknown>;
  eqCol: string;
  eqVal: unknown;
}

/** Cliente fake que captura insert/upsert/update por tabla; error inyectable. */
function fakeClient(opts: { error?: { message: string } } = {}): {
  client: SupabaseClient;
  inserts: InsertCall[];
  upserts: UpsertCall[];
  updates: UpdateCall[];
} {
  const inserts: InsertCall[] = [];
  const upserts: UpsertCall[] = [];
  const updates: UpdateCall[] = [];
  const err = opts.error ?? null;
  const client = {
    from(table: string) {
      return {
        insert(rows: unknown) {
          inserts.push({ table, rows });
          return {
            select() {
              return Promise.resolve({
                data: err ? null : [{ id: 1 }],
                error: err,
              });
            },
          };
        },
        upsert(rows: unknown, options: { onConflict?: string }) {
          upserts.push({ table, rows, onConflict: options?.onConflict });
          return Promise.resolve({ error: err });
        },
        update(patch: Record<string, unknown>) {
          const call: UpdateCall = { table, patch, eqCol: "", eqVal: undefined };
          updates.push(call);
          return {
            eq(col: string, val: unknown) {
              call.eqCol = col;
              call.eqVal = val;
              return {
                select() {
                  return Promise.resolve({
                    data: err ? null : [{ id: val }],
                    error: err,
                  });
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, inserts, upserts, updates };
}

const CASO: CasoRevision = {
  mencion_nombre: "Walker P., Matías",
  mencion_normalizada: "walker matias",
  camara: "senado",
  periodo: "senado-vigente-2026",
  region: "Valparaíso",
  candidatos: [{ id: "P00042", nombre: "Matías Walker Prieto" }],
  salida_modelo: { decision: "uncertain", chosen_id: null, confidence: 0.5, evidence: [], conflicts: [] },
  modelo_version: "minimax-mock",
  estado: "pendiente",
};

const VINCULO: FilaVinculo = {
  mencion_nombre: "Walker P., Matías",
  mencion_normalizada: "walker matias",
  camara: "senado",
  periodo: "senado-vigente-2026",
  parlamentario_id: "P00042",
  estado: "probable",
  metodo: "llm",
  origen: "senado",
  fecha_captura: "2026-06-18T00:00:00Z",
  enlace: "https://example.cl",
};

const AUDIT: FilaAudit = {
  vinculo_id: null,
  metodo: "llm",
  decision: "probable",
  confidence: 0.97,
  modelo_version: "minimax-mock",
  revisor_id: null,
  evidence: ["apellido coincide"],
  conflicts: [],
};

describe("RevisionWriter.enqueueRevision", () => {
  it("inserta en revision_identidad con candidatos/salida_modelo como jsonb", async () => {
    const { client, inserts } = fakeClient();
    const w = new RevisionWriter({ url: "x", serviceKey: "x", client });
    await w.enqueueRevision(CASO);

    expect(inserts).toHaveLength(1);
    expect(inserts[0]!.table).toBe("revision_identidad");
    const row = (inserts[0]!.rows as CasoRevision[])[0]!;
    expect(row.candidatos).toEqual(CASO.candidatos);
    expect(row.salida_modelo).toEqual(CASO.salida_modelo);
    expect(row.estado).toBe("pendiente");
  });

  it("propaga el error de DB con mensaje claro (sin secretos)", async () => {
    const { client } = fakeClient({ error: { message: "boom de la DB" } });
    const w = new RevisionWriter({ url: "x", serviceKey: "secreto", client });
    await expect(w.enqueueRevision(CASO)).rejects.toThrow(/enqueueRevision/);
    await expect(w.enqueueRevision(CASO)).rejects.not.toThrow(/secreto/);
  });
});

describe("RevisionWriter.upsertVinculo", () => {
  it("upsert en vinculo_identidad con estado + metodo", async () => {
    const { client, upserts } = fakeClient();
    const w = new RevisionWriter({ url: "x", serviceKey: "x", client });
    await w.upsertVinculo(VINCULO);

    expect(upserts).toHaveLength(1);
    expect(upserts[0]!.table).toBe("vinculo_identidad");
    const row = (upserts[0]!.rows as FilaVinculo[])[0]!;
    expect(row.estado).toBe("probable");
    expect(row.metodo).toBe("llm");
    expect(row.parlamentario_id).toBe("P00042");
  });
});

describe("RevisionWriter.appendAudit (append-only app-side)", () => {
  it("INSERTA una fila en identidad_audit (nunca update)", async () => {
    const { client, inserts, updates } = fakeClient();
    const w = new RevisionWriter({ url: "x", serviceKey: "x", client });
    await w.appendAudit(AUDIT);

    expect(updates).toHaveLength(0); // jamás update sobre el audit
    expect(inserts).toHaveLength(1);
    expect(inserts[0]!.table).toBe("identidad_audit");
    const row = (inserts[0]!.rows as FilaAudit[])[0]!;
    expect(row.metodo).toBe("llm");
    expect(row.decision).toBe("probable");
    expect(row.evidence).toEqual(["apellido coincide"]);
  });

  it("propaga el error de DB sin exponer la service key", async () => {
    const { client } = fakeClient({ error: { message: "permiso denegado" } });
    const w = new RevisionWriter({ url: "x", serviceKey: "super-secreto", client });
    await expect(w.appendAudit(AUDIT)).rejects.toThrow(/appendAudit/);
    await expect(w.appendAudit(AUDIT)).rejects.not.toThrow(/super-secreto/);
  });
});
