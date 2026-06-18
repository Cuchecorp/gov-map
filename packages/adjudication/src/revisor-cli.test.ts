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
}

/**
 * Cliente fake con una cola de casos pendientes en memoria. Soporta select con
 * filtros eq encadenados, update con dos eq (id + estado='pendiente'), insert y upsert.
 */
function fakeClient(pendientes: CasoRevisionRow[]): {
  client: SupabaseClient;
  caps: Capturas;
} {
  const caps: Capturas = { inserts: [], upserts: [], updates: [] };
  const casos = new Map<number, CasoRevisionRow>();
  for (const c of pendientes) casos.set(c.id, { ...c });

  const client = {
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
          return Promise.resolve({ error: null });
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
    const { client, caps } = fakeClient([casoPendiente(1)]);
    const w = new RevisionWriter({ url: "x", serviceKey: "x", client });
    await confirmar(w, 1, "ana");

    // revision_identidad resuelto a confirmado con revisor_id.
    const upd = caps.updates.find((u) => u.table === "revision_identidad")!;
    expect(upd.patch.estado).toBe("confirmado");
    expect(upd.patch.revisor_id).toBe("ana");
    expect(upd.patch.resolved_at).toBeTruthy();

    // vínculo promovido a confirmado, metodo='humano'.
    const vinc = caps.upserts.find((u) => u.table === "vinculo_identidad")!;
    const filaV = (vinc.rows as { estado: string; metodo: string }[])[0]!;
    expect(filaV.estado).toBe("confirmado");
    expect(filaV.metodo).toBe("humano");

    // audit metodo='humano', decision='confirmado', revisor_id='ana'.
    const aud = caps.inserts.find((i) => i.table === "identidad_audit")!;
    const filaA = (aud.rows as { metodo: string; decision: string; revisor_id: string }[])[0]!;
    expect(filaA.metodo).toBe("humano");
    expect(filaA.decision).toBe("confirmado");
    expect(filaA.revisor_id).toBe("ana");
  });
});

describe("revisor-cli reject", () => {
  it("reject <id> --revisor ana --motivo 'homónimo' → estado='rechazado', audit decision='rechazado'", async () => {
    const { client, caps } = fakeClient([casoPendiente(1)]);
    const w = new RevisionWriter({ url: "x", serviceKey: "x", client });
    await rechazar(w, 1, "ana", "homónimo");

    const upd = caps.updates.find((u) => u.table === "revision_identidad")!;
    expect(upd.patch.estado).toBe("rechazado");
    expect(upd.patch.revisor_id).toBe("ana");
    expect(upd.patch.motivo).toBe("homónimo");

    const aud = caps.inserts.find((i) => i.table === "identidad_audit")!;
    const filaA = (aud.rows as { metodo: string; decision: string }[])[0]!;
    expect(filaA.metodo).toBe("humano");
    expect(filaA.decision).toBe("rechazado");

    // reject NO promueve un vínculo confirmado.
    const vinc = caps.upserts.find((u) => u.table === "vinculo_identidad");
    expect(vinc).toBeUndefined();
  });
});

describe("revisor-cli correct", () => {
  it("correct <id> --revisor ana --chosen-id P00077 → estado='corregido', vínculo→P00077 confirmado, audit decision='corregido'", async () => {
    const { client, caps } = fakeClient([casoPendiente(1)]);
    const w = new RevisionWriter({ url: "x", serviceKey: "x", client });
    await corregir(w, 1, "ana", "P00077");

    const upd = caps.updates.find((u) => u.table === "revision_identidad")!;
    expect(upd.patch.estado).toBe("corregido");

    const vinc = caps.upserts.find((u) => u.table === "vinculo_identidad")!;
    const filaV = (vinc.rows as { estado: string; metodo: string; parlamentario_id: string }[])[0]!;
    expect(filaV.parlamentario_id).toBe("P00077");
    expect(filaV.estado).toBe("confirmado");
    expect(filaV.metodo).toBe("humano");

    const aud = caps.inserts.find((i) => i.table === "identidad_audit")!;
    const filaA = (aud.rows as { decision: string; revisor_id: string }[])[0]!;
    expect(filaA.decision).toBe("corregido");
    expect(filaA.revisor_id).toBe("ana");
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
