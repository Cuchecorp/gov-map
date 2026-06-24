/**
 * Tests del RevisionEntidadWriter (espeja writer-revision.test.ts): cliente Supabase mockeado que
 * captura insert/upsert/rpc por tabla. SIN red. Casos del <behavior> de Task 3:
 *  - Test 1: upsertVinculoEntidad usa onConflict 'tipo_entidad,mencion_normalizada' (índice único
 *            TOTAL de 0035 — Pitfall 6).
 *  - Test 2: resolverEntidad llama .rpc('resolver_entidad', {...}) con los 10 params incl. p_tipo_entidad.
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RevisionEntidadWriter,
  ONCONFLICT_VINCULO_ENTIDAD,
  type CasoRevisionEntidad,
  type FilaVinculoEntidad,
  type FilaAuditEntidad,
} from "./writer-revision-entidad";

interface InsertCall {
  table: string;
  rows: unknown;
}
interface UpsertCall {
  table: string;
  rows: unknown;
  onConflict: string | undefined;
}
interface RpcCall {
  name: string;
  params: Record<string, unknown>;
}

/** Cliente fake que captura insert/upsert/rpc por tabla; error inyectable. */
function fakeClient(opts: { error?: { message: string } } = {}): {
  client: SupabaseClient;
  inserts: InsertCall[];
  upserts: UpsertCall[];
  rpcs: RpcCall[];
} {
  const inserts: InsertCall[] = [];
  const upserts: UpsertCall[] = [];
  const rpcs: RpcCall[] = [];
  const err = opts.error ?? null;
  const client = {
    rpc(name: string, params: Record<string, unknown>) {
      rpcs.push({ name, params });
      return Promise.resolve({ data: err ? null : 7, error: err });
    },
    from(table: string) {
      return {
        insert(rows: unknown) {
          inserts.push({ table, rows });
          return {
            select() {
              return Promise.resolve({ data: err ? null : [{ id: 1 }], error: err });
            },
          };
        },
        upsert(rows: unknown, options?: { onConflict?: string }) {
          upserts.push({ table, rows, onConflict: options?.onConflict });
          return {
            select() {
              return Promise.resolve({ data: err ? null : [{ id: 7 }], error: err });
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, inserts, upserts, rpcs };
}

const CASO: CasoRevisionEntidad = {
  mencion_nombre: "Juan Pérez González",
  mencion_normalizada: "juan perez gonzalez",
  tipo_entidad: "natural",
  candidatos: [{ id: "E00042", nombre: "juan perez gonzalez" }],
  salida_modelo: { decision: "uncertain", chosen_id: null, confidence: 0.5, evidence: [], conflicts: [] },
  modelo_version: "minimax-mock",
  estado: "pendiente",
};

const VINCULO: FilaVinculoEntidad = {
  mencion_nombre: "Juan Pérez González",
  mencion_normalizada: "juan perez gonzalez",
  tipo_entidad: "natural",
  entidad_tercero_id: "E00042",
  estado: "probable",
  metodo: "llm",
  origen: "reconciliacion",
  fecha_captura: "2026-06-23T00:00:00Z",
  enlace: "",
};

const AUDIT: FilaAuditEntidad = {
  vinculo_id: null,
  metodo: "llm",
  decision: "probable",
  confidence: 0.97,
  modelo_version: "minimax-mock",
  revisor_id: null,
  evidence: ["nombre coincide"],
  conflicts: [],
  tipo_entidad: "natural",
};

describe("RevisionEntidadWriter.enqueueRevision", () => {
  it("inserta en revision_entidad con candidatos/salida_modelo y tipo_entidad", async () => {
    const { client, inserts } = fakeClient();
    const w = new RevisionEntidadWriter({ url: "x", serviceKey: "x", client });
    await w.enqueueRevision(CASO);

    expect(inserts).toHaveLength(1);
    expect(inserts[0]!.table).toBe("revision_entidad");
    const row = (inserts[0]!.rows as CasoRevisionEntidad[])[0]!;
    expect(row.candidatos).toEqual(CASO.candidatos);
    expect(row.tipo_entidad).toBe("natural");
    expect(row.estado).toBe("pendiente");
  });
});

describe("RevisionEntidadWriter.upsertVinculoEntidad (Pitfall 6)", () => {
  it("Test 1: onConflict = 'tipo_entidad,mencion_normalizada' (índice único TOTAL de 0035)", async () => {
    const { client, upserts } = fakeClient();
    const w = new RevisionEntidadWriter({ url: "x", serviceKey: "x", client });
    const id = await w.upsertVinculoEntidad(VINCULO);

    expect(upserts).toHaveLength(1);
    expect(upserts[0]!.table).toBe("vinculo_entidad");
    expect(upserts[0]!.onConflict).toBe("tipo_entidad,mencion_normalizada");
    // La constante exportada debe coincidir byte-a-byte con el on conflict del RPC en 0036.
    expect(ONCONFLICT_VINCULO_ENTIDAD).toBe("tipo_entidad,mencion_normalizada");
    expect(id).toBe(7);
  });

  it("propaga el error de DB sin exponer la service key", async () => {
    const { client } = fakeClient({ error: { message: "permiso denegado" } });
    const w = new RevisionEntidadWriter({ url: "x", serviceKey: "super-secreto", client });
    await expect(w.upsertVinculoEntidad(VINCULO)).rejects.toThrow(/upsertVinculoEntidad/);
    await expect(w.upsertVinculoEntidad(VINCULO)).rejects.not.toThrow(/super-secreto/);
  });
});

describe("RevisionEntidadWriter.resolverEntidad (RPC resolver_entidad)", () => {
  it("Test 2: llama .rpc('resolver_entidad', {...}) con los 10 params incluyendo p_tipo_entidad", async () => {
    const { client, rpcs } = fakeClient();
    const w = new RevisionEntidadWriter({ url: "x", serviceKey: "x", client });
    const id = await w.resolverEntidad({
      casoId: 5,
      estado: "confirmado",
      revisor: "operador",
      motivo: null,
      resolvedAt: "2026-06-23T00:00:00Z",
      promover: true,
      vinculo: VINCULO,
      decision: "confirmado",
      modeloVersion: "minimax-mock",
      tipoEntidad: "natural",
    });

    expect(rpcs).toHaveLength(1);
    expect(rpcs[0]!.name).toBe("resolver_entidad");
    const p = rpcs[0]!.params;
    // Los 10 parámetros del RPC (firma exacta de 0036, Pitfall 5).
    expect(Object.keys(p).sort()).toEqual(
      [
        "p_caso_id",
        "p_decision",
        "p_estado",
        "p_modelo_version",
        "p_motivo",
        "p_promover",
        "p_resolved_at",
        "p_revisor",
        "p_tipo_entidad",
        "p_vinculo",
      ].sort(),
    );
    expect(p.p_tipo_entidad).toBe("natural");
    expect(p.p_caso_id).toBe(5);
    expect(p.p_promover).toBe(true);
    expect(id).toBe(7);
  });

  it("propaga el error del RPC (caso ya no pendiente) sin colaterales", async () => {
    const { client } = fakeClient({ error: { message: "caso 5 ya no estaba pendiente" } });
    const w = new RevisionEntidadWriter({ url: "x", serviceKey: "x", client });
    await expect(
      w.resolverEntidad({
        casoId: 5,
        estado: "confirmado",
        revisor: "operador",
        motivo: null,
        resolvedAt: "2026-06-23T00:00:00Z",
        promover: true,
        vinculo: VINCULO,
        decision: "confirmado",
        modeloVersion: null,
        tipoEntidad: "natural",
      }),
    ).rejects.toThrow(/resolverEntidad/);
  });
});

describe("RevisionEntidadWriter.appendAudit (append-only, columna tipo_entidad)", () => {
  it("INSERTA en identidad_audit con tipo_entidad (nunca update)", async () => {
    const { client, inserts } = fakeClient();
    const w = new RevisionEntidadWriter({ url: "x", serviceKey: "x", client });
    await w.appendAudit(AUDIT);

    expect(inserts).toHaveLength(1);
    expect(inserts[0]!.table).toBe("identidad_audit");
    const row = (inserts[0]!.rows as FilaAuditEntidad[])[0]!;
    expect(row.tipo_entidad).toBe("natural");
    expect(row.decision).toBe("probable");
  });
});
