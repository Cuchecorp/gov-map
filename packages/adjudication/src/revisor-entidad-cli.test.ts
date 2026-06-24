/**
 * Tests del revisor-entidad-cli (ENT-04): list/show/confirm/reject/correct con cliente Supabase
 * mockeado (sin red). Casos del <behavior> de Task 3:
 *  - Test 3: el CLI 'confirm' promueve vía resolverEntidad con p_promover=true (la promoción humana
 *            mintea confirmarEntidad(..., 'humano')).
 *  - Test 4: el CLI 'list' muestra solo revision_entidad estado='pendiente'.
 * Más: inputs inválidos no tocan la DB; correct valida /^E\d{5}$/; reject no promueve.
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RevisionEntidadWriter, type CasoRevisionEntidadRow } from "./writer-revision-entidad";
import { listar, confirmar, rechazar, corregir, mostrar } from "./revisor-entidad-cli";

interface Capturas {
  rpcs: { name: string; params: Record<string, unknown> }[];
}

/** Cliente fake con casos en memoria. Soporta select con eq encadenados y el RPC resolver_entidad. */
function fakeClient(casosIn: CasoRevisionEntidadRow[]): {
  client: SupabaseClient;
  caps: Capturas;
} {
  const caps: Capturas = { rpcs: [] };
  const casos = new Map<number, CasoRevisionEntidadRow>();
  for (const c of casosIn) casos.set(c.id, { ...c });

  const client = {
    rpc(name: string, params: Record<string, unknown>) {
      caps.rpcs.push({ name, params });
      if (name === "resolver_entidad") {
        const id = params.p_caso_id as number;
        const caso = casos.get(id);
        if (!caso || caso.estado !== "pendiente") {
          return Promise.resolve({ data: null, error: { message: `caso ${id} ya no estaba pendiente` } });
        }
        caso.estado = params.p_estado as CasoRevisionEntidadRow["estado"];
        caso.revisor_id = params.p_revisor as string;
        return Promise.resolve({ data: 1, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    from(_table: string) {
      return {
        select(_cols?: string) {
          const filtros: [string, unknown][] = [];
          const builder = {
            eq(col: string, val: unknown) {
              filtros.push([col, val]);
              return builder;
            },
            then(resolve: (r: { data: unknown; error: null }) => void) {
              let rows = [...casos.values()] as CasoRevisionEntidadRow[];
              for (const [col, val] of filtros) {
                rows = rows.filter((r) => (r as Record<string, unknown>)[col] === val);
              }
              resolve({ data: rows, error: null });
            },
          };
          return builder;
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, caps };
}

function caso(over: Partial<CasoRevisionEntidadRow> & { id: number }): CasoRevisionEntidadRow {
  return {
    id: over.id,
    mencion_nombre: over.mencion_nombre ?? "Juan Pérez González",
    mencion_normalizada: over.mencion_normalizada ?? "juan perez gonzalez",
    tipo_entidad: over.tipo_entidad ?? "natural",
    candidatos: over.candidatos ?? [{ id: "E00042", nombre: "juan perez gonzalez" }],
    salida_modelo:
      over.salida_modelo ??
      { decision: "match", chosen_id: "E00042", confidence: 0.95, evidence: [], conflicts: [] },
    modelo_version: over.modelo_version ?? "minimax-mock",
    estado: over.estado ?? "pendiente",
    created_at: over.created_at ?? "2026-06-23T00:00:00Z",
  };
}

describe("revisor-entidad-cli list (Test 4)", () => {
  it("muestra solo casos estado='pendiente'", async () => {
    const { client } = fakeClient([
      caso({ id: 1, estado: "pendiente" }),
      caso({ id: 2, estado: "confirmado" }),
      caso({ id: 3, estado: "pendiente" }),
    ]);
    const w = new RevisionEntidadWriter({ url: "x", serviceKey: "x", client });
    const pendientes = await listar(w);
    expect(pendientes.map((c) => c.id).sort()).toEqual([1, 3]);
    expect(pendientes.every((c) => c.estado === "pendiente")).toBe(true);
  });
});

describe("revisor-entidad-cli confirm (Test 3 — promoción humana)", () => {
  it("promueve vía resolverEntidad con p_promover=true, estado='confirmado', p_tipo_entidad", async () => {
    const { client, caps } = fakeClient([caso({ id: 1, estado: "pendiente" })]);
    const w = new RevisionEntidadWriter({ url: "x", serviceKey: "x", client });
    await confirmar(w, 1, "operador");

    const rpc = caps.rpcs.find((r) => r.name === "resolver_entidad");
    expect(rpc).toBeDefined();
    expect(rpc!.params.p_promover).toBe(true);
    expect(rpc!.params.p_estado).toBe("confirmado");
    expect(rpc!.params.p_revisor).toBe("operador");
    expect(rpc!.params.p_tipo_entidad).toBe("natural");
    // El vínculo a promover apunta a la entidad confirmada por el humano (FK branded minteado).
    const v = rpc!.params.p_vinculo as { entidad_tercero_id: string; metodo: string; estado: string };
    expect(v.entidad_tercero_id).toBe("E00042");
    expect(v.metodo).toBe("humano");
    expect(v.estado).toBe("confirmado");
  });

  it("rechaza confirmar un caso sin chosen_id del modelo (exige correct)", async () => {
    const { client } = fakeClient([
      caso({
        id: 1,
        estado: "pendiente",
        salida_modelo: { decision: "uncertain", chosen_id: null, confidence: 0.5, evidence: [], conflicts: [] },
      }),
    ]);
    const w = new RevisionEntidadWriter({ url: "x", serviceKey: "x", client });
    await expect(confirmar(w, 1, "operador")).rejects.toThrow(/correct/);
  });
});

describe("revisor-entidad-cli reject / correct / validación de input", () => {
  it("reject NO promueve (p_promover=false), estado='rechazado'", async () => {
    const { client, caps } = fakeClient([caso({ id: 1, estado: "pendiente" })]);
    const w = new RevisionEntidadWriter({ url: "x", serviceKey: "x", client });
    await rechazar(w, 1, "operador", "no es la misma persona");

    const rpc = caps.rpcs.find((r) => r.name === "resolver_entidad");
    expect(rpc!.params.p_promover).toBe(false);
    expect(rpc!.params.p_estado).toBe("rechazado");
    expect(rpc!.params.p_vinculo).toBeNull();
  });

  it("correct con --chosen-id válido (Exxxxx) promueve al nuevo id", async () => {
    const { client, caps } = fakeClient([caso({ id: 1, estado: "pendiente" })]);
    const w = new RevisionEntidadWriter({ url: "x", serviceKey: "x", client });
    await corregir(w, 1, "operador", "E00777");

    const rpc = caps.rpcs.find((r) => r.name === "resolver_entidad");
    expect(rpc!.params.p_estado).toBe("corregido");
    expect(rpc!.params.p_promover).toBe(true);
    const v = rpc!.params.p_vinculo as { entidad_tercero_id: string };
    expect(v.entidad_tercero_id).toBe("E00777");
  });

  it("correct con --chosen-id de formato inválido (P) NO toca la DB", async () => {
    const { client, caps } = fakeClient([caso({ id: 1, estado: "pendiente" })]);
    const w = new RevisionEntidadWriter({ url: "x", serviceKey: "x", client });
    await expect(corregir(w, 1, "operador", "P00042")).rejects.toThrow(/formato inválido/);
    expect(caps.rpcs).toHaveLength(0);
  });

  it("revisor vacío NO toca la DB", async () => {
    const { client, caps } = fakeClient([caso({ id: 1, estado: "pendiente" })]);
    const w = new RevisionEntidadWriter({ url: "x", serviceKey: "x", client });
    await expect(confirmar(w, 1, "")).rejects.toThrow(/revisor/);
    expect(caps.rpcs).toHaveLength(0);
  });

  it("show con id inválido lanza antes de tocar la DB", async () => {
    const { client } = fakeClient([caso({ id: 1, estado: "pendiente" })]);
    const w = new RevisionEntidadWriter({ url: "x", serviceKey: "x", client });
    await expect(mostrar(w, 0)).rejects.toThrow(/id inválido/);
  });
});
