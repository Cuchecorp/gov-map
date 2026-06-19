/**
 * Tests del revisor-cli (ID-05): list/show/confirm/reject/correct con cliente
 * Supabase mockeado (sin red). Verifica los invariantes de la compuerta humana:
 *  - confirm/correct PROMUEVEN el vínculo a 'confirmado' (EXCLUSIVO humano/determinista, A4).
 *  - cada resolución escribe identidad_audit metodo='humano' con revisor_id + timestamp (T-04-11).
 *  - inputs inválidos (id no numérico, revisor vacío) NO tocan la DB (V5/T-04-10).
 *  - confirmar un id inexistente/ya resuelto → error claro, sin escritura colateral.
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RevisionWriter, type CasoRevisionRow } from "./writer-revision";
import { listar, mostrar, confirmar, rechazar, corregir } from "./revisor-cli";

interface Capturas {
  inserts: { table: string; rows: unknown }[];
  upserts: { table: string; rows: unknown }[];
  updates: { table: string; patch: Record<string, unknown>; eqs: [string, unknown][] }[];
  rpcs: { name: string; params: Record<string, unknown> }[];
}

/**
 * Cliente fake con una cola de casos pendientes en memoria. Soporta select con
 * filtros eq encadenados, update con dos eq (id + estado='pendiente'), insert y upsert.
 */
function fakeClient(pendientes: CasoRevisionRow[]): {
  client: SupabaseClient;
  caps: Capturas;
} {
  const caps: Capturas = { inserts: [], upserts: [], updates: [], rpcs: [] };
  const casos = new Map<number, CasoRevisionRow>();
  for (const c of pendientes) casos.set(c.id, { ...c });

  const client = {
    // #3: la resolución pasa por el RPC transaccional `resolver_identidad`. El fake
    // simula su contrato atómico: resuelve SOLO si el caso sigue 'pendiente'; si no,
    // devuelve error (rollback total, ningún colateral). Devuelve el id del vínculo.
    rpc(name: string, params: Record<string, unknown>) {
      caps.rpcs.push({ name, params });
      if (name === "resolver_identidad") {
        const id = params.p_caso_id as number;
        const caso = casos.get(id);
        if (!caso || caso.estado !== "pendiente") {
          return Promise.resolve({
            data: null,
            error: { message: `caso ${id} ya no estaba pendiente` },
          });
        }
        caso.estado = params.p_estado as CasoRevisionRow["estado"];
        caso.revisor_id = params.p_revisor as string;
        return Promise.resolve({ data: 1, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    from(table: string) {
      return {
        select(_cols?: string) {
          const filtros: [string, unknown][] = [];
          const builder = {
            eq(col: string, val: unknown) {
              filtros.push([col, val]);
              return builder;
            },
            then(resolve: (r: { data: unknown; error: null }) => void) {
              let rows = [...casos.values()] as CasoRevisionRow[];
              for (const [col, val] of filtros) {
                rows = rows.filter((r) => (r as Record<string, unknown>)[col] === val);
              }
              resolve({ data: rows, error: null });
            },
          };
          return builder;
        },
        insert(rows: unknown) {
          caps.inserts.push({ table, rows });
          return { select: () => Promise.resolve({ data: [{ id: 1 }], error: null }) };
        },
        upsert(rows: unknown) {
          caps.upserts.push({ table, rows });
          return {
            select: () => Promise.resolve({ data: [{ id: 1 }], error: null }),
          };
        },
        update(patch: Record<string, unknown>) {
          const eqs: [string, unknown][] = [];
          const call = { table, patch, eqs };
          const builder = {
            eq(col: string, val: unknown) {
              eqs.push([col, val]);
              return builder;
            },
            select() {
              // Aplica el update solo si el caso existe y sigue 'pendiente'.
              const id = eqs.find(([c]) => c === "id")?.[1] as number | undefined;
              const reqPendiente = eqs.some(([c, v]) => c === "estado" && v === "pendiente");
              const caso = id != null ? casos.get(id) : undefined;
              if (caso && (!reqPendiente || caso.estado === "pendiente")) {
                Object.assign(caso, patch);
                caps.updates.push(call);
                return Promise.resolve({ data: [{ id }], error: null });
              }
              return Promise.resolve({ data: [], error: null });
            },
          };
          return builder;
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, caps };
}

function casoPendiente(id: number, over: Partial<CasoRevisionRow> = {}): CasoRevisionRow {
  return {
    id,
    mencion_nombre: "Walker P., Matías",
    mencion_normalizada: "walker matias",
    camara: "senado",
    periodo: "senado-vigente-2026",
    region: "Valparaíso",
    candidatos: [{ id: "P00042", nombre: "Matías Walker Prieto" }],
    salida_modelo: { decision: "uncertain", chosen_id: null, confidence: 0.5, evidence: [], conflicts: ["homónimo"] },
    modelo_version: "minimax-mock",
    estado: "pendiente",
    revisor_id: null,
    created_at: "2026-06-18T00:00:00Z",
    resolved_at: null,
    ...over,
  };
}

describe("revisor-cli list/show", () => {
  it("list devuelve los casos estado='pendiente'", async () => {
    const { client } = fakeClient([casoPendiente(1), casoPendiente(2)]);
    const w = new RevisionWriter({ url: "x", serviceKey: "x", client });
    const out = await listar(w);
    expect(out.map((c) => c.id).sort()).toEqual([1, 2]);
    expect(out.every((c) => c.estado === "pendiente")).toBe(true);
  });

  it("show <id> devuelve el caso con registro + candidatos + salida del modelo", async () => {
    const { client } = fakeClient([casoPendiente(7)]);
    const w = new RevisionWriter({ url: "x", serviceKey: "x", client });
    const caso = await mostrar(w, 7);
    expect(caso).not.toBeNull();
    expect(caso!.mencion_nombre).toBe("Walker P., Matías");
    expect(caso!.candidatos.length).toBeGreaterThan(0);
    expect(caso!.salida_modelo).toBeDefined();
  });
});

describe("revisor-cli confirm (promueve a confirmado + audit humano)", () => {
  it("confirm <id> --revisor ana → estado='confirmado', vínculo confirmado metodo='humano', audit revisor_id+created_at", async () => {
    // El caso debe traer un chosen_id válido del modelo para que confirm pueda promover
    // (WR-03: confirmar sin chosen_id lanza; ese vector se cubre aparte).
    const { client, caps } = fakeClient([
      casoPendiente(1, {
        salida_modelo: { decision: "match", chosen_id: "P00042", confidence: 0.97, evidence: [], conflicts: [] },
      }),
    ]);
    const w = new RevisionWriter({ url: "x", serviceKey: "x", client });
    await confirmar(w, 1, "ana");

    // #3: una sola llamada atómica al RPC resolver_identidad con el contrato completo.
    const rpc = caps.rpcs.find((r) => r.name === "resolver_identidad")!;
    expect(rpc.params.p_caso_id).toBe(1);
    expect(rpc.params.p_estado).toBe("confirmado");
    expect(rpc.params.p_revisor).toBe("ana");
    expect(rpc.params.p_resolved_at).toBeTruthy();
    expect(rpc.params.p_promover).toBe(true);
    expect(rpc.params.p_decision).toBe("confirmado");

    // vínculo promovido a confirmado, metodo='humano', apuntando al chosen_id (persona real).
    const filaV = rpc.params.p_vinculo as {
      estado: string;
      metodo: string;
      parlamentario_id: string | null;
    };
    expect(filaV.estado).toBe("confirmado");
    expect(filaV.metodo).toBe("humano");
    expect(filaV.parlamentario_id).toBe("P00042");

    // El audit y el enlace audit→vínculo (WR-01/WR-06) viven DENTRO de la transacción
    // del RPC (verificado por pgTAP en 0015); aquí no hay inserts/upserts directos.
    expect(caps.upserts).toHaveLength(0);
    expect(caps.inserts).toHaveLength(0);
  });

  it("WR-03: confirm de un caso SIN chosen_id del modelo lanza y NO escribe (no confirma a nadie)", async () => {
    // El caso llegó a revisión por uncertain/no_match → chosen_id null (lo común en la
    // cola). confirmar NO puede promover un vínculo confirmado a parlamentario_id null.
    const { client, caps } = fakeClient([
      casoPendiente(1, {
        salida_modelo: { decision: "uncertain", chosen_id: null, confidence: 0.5, evidence: [], conflicts: ["homónimo"] },
      }),
    ]);
    const w = new RevisionWriter({ url: "x", serviceKey: "x", client });
    await expect(confirmar(w, 1, "ana")).rejects.toThrow(/chosen_id|correct/i);
    // Nada se resolvió ni se promovió: el caso sigue intacto (ni siquiera se llamó al RPC).
    expect(caps.rpcs).toHaveLength(0);
    expect(caps.updates).toHaveLength(0);
    expect(caps.upserts).toHaveLength(0);
    expect(caps.inserts).toHaveLength(0);
  });
});

describe("revisor-cli reject", () => {
  it("reject <id> --revisor ana --motivo 'homónimo' → estado='rechazado', audit decision='rechazado'", async () => {
    const { client, caps } = fakeClient([casoPendiente(1)]);
    const w = new RevisionWriter({ url: "x", serviceKey: "x", client });
    await rechazar(w, 1, "ana", "homónimo");

    const rpc = caps.rpcs.find((r) => r.name === "resolver_identidad")!;
    expect(rpc.params.p_estado).toBe("rechazado");
    expect(rpc.params.p_revisor).toBe("ana");
    expect(rpc.params.p_motivo).toBe("homónimo");
    expect(rpc.params.p_decision).toBe("rechazado");
    // reject NO promueve un vínculo confirmado.
    expect(rpc.params.p_promover).toBe(false);
    expect(rpc.params.p_vinculo).toBeNull();
  });
});

describe("revisor-cli correct", () => {
  it("correct <id> --revisor ana --chosen-id P00077 → estado='corregido', vínculo→P00077 confirmado, audit decision='corregido'", async () => {
    const { client, caps } = fakeClient([casoPendiente(1)]);
    const w = new RevisionWriter({ url: "x", serviceKey: "x", client });
    await corregir(w, 1, "ana", "P00077");

    const rpc = caps.rpcs.find((r) => r.name === "resolver_identidad")!;
    expect(rpc.params.p_estado).toBe("corregido");
    expect(rpc.params.p_decision).toBe("corregido");
    expect(rpc.params.p_revisor).toBe("ana");
    expect(rpc.params.p_promover).toBe(true);
    const filaV = rpc.params.p_vinculo as {
      estado: string;
      metodo: string;
      parlamentario_id: string;
    };
    expect(filaV.parlamentario_id).toBe("P00077");
    expect(filaV.estado).toBe("confirmado");
    expect(filaV.metodo).toBe("humano");
  });

  it("correct con chosen-id mal formado → error claro, sin escritura", async () => {
    const { client, caps } = fakeClient([casoPendiente(1)]);
    const w = new RevisionWriter({ url: "x", serviceKey: "x", client });
    await expect(corregir(w, 1, "ana", "XYZ")).rejects.toThrow(/chosen-id|formato/i);
    expect(caps.updates).toHaveLength(0);
    expect(caps.upserts).toHaveLength(0);
    expect(caps.inserts).toHaveLength(0);
  });
});

describe("revisor-cli validación de input (V5/T-04-10: nada toca la DB)", () => {
  it("id no numérico → error, sin escritura", async () => {
    const { client, caps } = fakeClient([casoPendiente(1)]);
    const w = new RevisionWriter({ url: "x", serviceKey: "x", client });
    await expect(confirmar(w, Number.NaN, "ana")).rejects.toThrow(/id/i);
    expect(caps.updates).toHaveLength(0);
    expect(caps.upserts).toHaveLength(0);
    expect(caps.inserts).toHaveLength(0);
  });

  it("revisor vacío → error, sin escritura", async () => {
    const { client, caps } = fakeClient([casoPendiente(1)]);
    const w = new RevisionWriter({ url: "x", serviceKey: "x", client });
    await expect(confirmar(w, 1, "  ")).rejects.toThrow(/revisor/i);
    expect(caps.updates).toHaveLength(0);
    expect(caps.upserts).toHaveLength(0);
    expect(caps.inserts).toHaveLength(0);
  });
});

describe("revisor-cli id inexistente / ya resuelto", () => {
  it("confirmar un id inexistente → error claro, sin audit/upsert colateral", async () => {
    const { client, caps } = fakeClient([casoPendiente(1)]);
    const w = new RevisionWriter({ url: "x", serviceKey: "x", client });
    await expect(confirmar(w, 999, "ana")).rejects.toThrow(/no existe|pendiente|resuelto/i);
    expect(caps.upserts).toHaveLength(0);
    expect(caps.inserts).toHaveLength(0);
  });

  it("confirmar un caso ya resuelto → error claro, sin escritura nueva", async () => {
    const { client, caps } = fakeClient([
      casoPendiente(1, { estado: "confirmado", revisor_id: "otro" }),
    ]);
    const w = new RevisionWriter({ url: "x", serviceKey: "x", client });
    await expect(confirmar(w, 1, "ana")).rejects.toThrow(/pendiente|resuelto/i);
    expect(caps.upserts).toHaveLength(0);
    expect(caps.inserts).toHaveLength(0);
  });
});
