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

/** Mock mínimo del cliente Supabase: registra los upsert por tabla (tabla → filas, onConflict). */
function makeFakeClient() {
  const upserts: Array<{ tabla: string; rows: unknown[]; onConflict?: string }> = [];
  const client = {
    from(tabla: string) {
      return {
        upsert(rows: unknown[], opts?: { onConflict?: string }) {
          upserts.push({ tabla, rows: Array.isArray(rows) ? rows : [rows], onConflict: opts?.onConflict });
          return Promise.resolve({ error: null });
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
