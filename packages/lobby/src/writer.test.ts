// writer.test — el LobbyWriter es IDEMPOTENTE por clave natural (2× no duplica), tanto el fake
// in-memory como el SupabaseLobbyWriter (mock del cliente PostgREST que verifica el onConflict y
// la guarda: la service key nunca aparece en mensajes de error).

import { describe, it, expect } from "vitest";
import { confirmar } from "@obs/identity";
import { InMemoryLobbyWriter } from "./writer";
import { SupabaseLobbyWriter } from "./writer-supabase";
import type { AudienciaParaEscribir } from "./reconciliar-sujeto";

function fila(over: Partial<AudienciaParaEscribir> & { identificador: string }): AudienciaParaEscribir {
  return {
    identificador: over.identificador,
    institucionCodigo: over.institucionCodigo ?? "AA001",
    enlace: over.enlace ?? null,
    mencionSujeto: over.mencionSujeto ?? "Víctor Gutiérrez",
    estadoVinculo: over.estadoVinculo ?? "no_confirmado",
    fecha: over.fecha ?? "2024-06-24T16:30:00.000Z",
    fechaRaw: over.fechaRaw ?? "2024-06-24 12:30:00-04",
    materia: over.materia ?? "Materia X",
    enlaceDetalle: over.enlaceDetalle ?? "https://www.leylobby.gob.cl/x/728817",
    contrapartes: over.contrapartes ?? [
      { nombre: "María José Valenzuela", rol: "Gestor de intereses", representadoText: "Fundación Momart", contraparteId: null },
      { nombre: "CONSTANZA Baasch", rol: "Gestor de intereses", representadoText: "Fundación Momart", contraparteId: null },
    ],
    origen: "leylobby-audiencias",
    fecha_captura: "2026-06-19T00:00:00Z",
    enlace_url: "https://www.leylobby.gob.cl/instituciones/AA001/audiencias/2024",
  };
}

describe("InMemoryLobbyWriter — idempotente por clave natural", () => {
  it("upsert 2× con el mismo input NO duplica (audiencias + contrapartes)", async () => {
    const w = new InMemoryLobbyWriter();
    await w.upsertAudiencias([fila({ identificador: "AA001AW1639516" })]);
    await w.upsertAudiencias([fila({ identificador: "AA001AW1639516" })]);

    expect(w.audiencias.size).toBe(1);
    expect(w.contrapartes.size).toBe(2);
  });

  it("dedupe-before-batch: dos contrapartes de la misma (identificador,nombre,rol) colapsan a una", async () => {
    const w = new InMemoryLobbyWriter();
    await w.upsertAudiencias([
      fila({
        identificador: "AA001AW1",
        contrapartes: [
          { nombre: "Lobbista Dup", rol: "Gestor de intereses", representadoText: "X", contraparteId: null },
          { nombre: "Lobbista Dup", rol: "Gestor de intereses", representadoText: "X", contraparteId: null },
        ],
      }),
    ]);
    expect(w.contrapartes.size).toBe(1);
  });

  it("storage plano: el FK branded se aplana a parlamentario_id string|null", async () => {
    const w = new InMemoryLobbyWriter();
    await w.upsertAudiencias([
      fila({ identificador: "AA001AW-OK", enlace: confirmar("P00500", "determinista"), estadoVinculo: "confirmado" }),
    ]);
    expect(w.audiencias.get("AA001AW-OK")!.parlamentario_id).toBe("P00500");
    // Las contrapartes NUNCA llevan un FK a persona.
    expect([...w.contrapartes.values()].every((c) => c.contraparte_id === null)).toBe(true);
  });

  it("marcarIngestado upserta un row por parlamentario (idempotente)", async () => {
    const w = new InMemoryLobbyWriter();
    await w.marcarIngestado(["P1", "P2"], "2024-12-31");
    await w.marcarIngestado(["P1", "P2"], "2024-12-31");
    expect(w.ingestaEstado.size).toBe(2);
    expect(w.ingestaEstado.get("P1")!.ingestado_hasta).toBe("2024-12-31");
  });
});

/**
 * Mock mínimo del cliente Supabase: registra los upsert por tabla (tabla → filas, onConflict) y
 * sirve las filas VIGENTES de `lobby_ingesta_estado` al `select().in()` que la guarda monotónica
 * de `marcarIngestado` hace antes de escribir (G1 / T-119-17).
 */
function makeFakeClient(vigentes: Record<string, string> = {}) {
  const upserts: Array<{ tabla: string; rows: unknown[]; onConflict?: string }> = [];
  const client = {
    from(tabla: string) {
      return {
        upsert(rows: unknown[], opts?: { onConflict?: string }) {
          upserts.push({ tabla, rows: Array.isArray(rows) ? rows : [rows], onConflict: opts?.onConflict });
          return Promise.resolve({ error: null });
        },
        select(_cols: string) {
          return {
            in(_col: string, ids: string[]) {
              const data = ids
                .filter((id) => vigentes[id] !== undefined)
                .map((id) => ({ parlamentario_id: id, ingestado_hasta: vigentes[id] }));
              return Promise.resolve({ data, error: null });
            },
          };
        },
      };
    },
  };
  return { client, upserts };
}

describe("SupabaseLobbyWriter — upsert idempotente por onConflict (clave natural)", () => {
  it("upserta cada tabla por su clave natural (raíz antes que hijos), aplanando las contrapartes", async () => {
    const { client, upserts } = makeFakeClient();
    const w = new SupabaseLobbyWriter({ url: "x", serviceKey: "k", client: client as never });

    await w.upsertAudiencias([fila({ identificador: "AA001AW1639516" })]);

    const porTabla = Object.fromEntries(upserts.map((u) => [u.tabla, u]));
    expect(porTabla["lobby_audiencia"]?.onConflict).toBe("identificador");
    expect(porTabla["lobby_contraparte"]?.onConflict).toBe("identificador,nombre,rol");
    // La raíz NO lleva las contrapartes anidadas (van a la tabla hija).
    const raiz = porTabla["lobby_audiencia"]!.rows[0] as Record<string, unknown>;
    expect(raiz).not.toHaveProperty("contrapartes");
    expect(raiz).not.toHaveProperty("enlace_url");
    expect(raiz).toHaveProperty("parlamentario_id");
    // Orden: lobby_audiencia (raíz) antes que sus hijos.
    expect(upserts[0]!.tabla).toBe("lobby_audiencia");
  });

  it("marcarIngestado upserta lobby_ingesta_estado por parlamentario_id", async () => {
    const { client, upserts } = makeFakeClient();
    const w = new SupabaseLobbyWriter({ url: "x", serviceKey: "k", client: client as never });
    await w.marcarIngestado(["P1"], "2024-12-31");
    const porTabla = Object.fromEntries(upserts.map((u) => [u.tabla, u]));
    expect(porTabla["lobby_ingesta_estado"]?.onConflict).toBe("parlamentario_id");
  });

  it("marcarIngestado es MONOTÓNICO: no escribe un `hasta` anterior al vigente (G1)", async () => {
    // P1 ya cubierto hasta 2026-06-22; P2 sin fila previa.
    const { client, upserts } = makeFakeClient({ P1: "2026-06-22" });
    const w = new SupabaseLobbyWriter({ url: "x", serviceKey: "k", client: client as never });

    // Un lote HISTÓRICO (2024) no puede retroceder a P1, pero sí estrena a P2.
    await w.marcarIngestado(["P1", "P2"], "2024-12-31");
    const filas = upserts.find((u) => u.tabla === "lobby_ingesta_estado")!.rows as Record<
      string,
      unknown
    >[];
    expect(filas.map((f) => f.parlamentario_id)).toEqual(["P2"]);

    // Y si NINGUNO avanza, no se emite upsert alguno.
    const { client: c2, upserts: u2 } = makeFakeClient({ P1: "2026-06-22" });
    const w2 = new SupabaseLobbyWriter({ url: "x", serviceKey: "k", client: c2 as never });
    await w2.marcarIngestado(["P1"], "2024-12-31");
    expect(u2.filter((u) => u.tabla === "lobby_ingesta_estado")).toHaveLength(0);
  });

  it("propaga el error de PostgREST SIN interpolar la service key", async () => {
    const SERVICE_KEY = "super-secret-service-role-key-xyz";
    const client = {
      from(_t: string) {
        return {
          upsert(_rows: unknown[], _opts?: unknown) {
            return Promise.resolve({ error: { message: "permission denied" } });
          },
        };
      },
    };
    const w = new SupabaseLobbyWriter({ url: "x", serviceKey: SERVICE_KEY, client: client as never });

    await expect(w.upsertAudiencias([fila({ identificador: "AA001AW1" })])).rejects.toThrow(
      /permission denied/,
    );
    await w
      .upsertAudiencias([fila({ identificador: "AA001AW2" })])
      .catch((e: Error) => expect(e.message).not.toContain(SERVICE_KEY));
  });
});
