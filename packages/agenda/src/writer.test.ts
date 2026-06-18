// writer.test — el AgendaWriter es IDEMPOTENTE por clave natural (2× no duplica), tanto el
// fake in-memory como el SupabaseAgendaWriter (mock del cliente PostgREST que verifica el
// onConflict y la guarda T-06-06: la service key nunca aparece en mensajes de error).

import { describe, it, expect } from "vitest";
import { InMemoryAgendaWriter } from "./writer";
import { SupabaseAgendaWriter } from "./writer-supabase";
import type { Citacion, SesionSala } from "./model";

function citacion(id: string): Citacion {
  return {
    id,
    camara: "camara",
    comision: "Comisión de Hacienda",
    fecha: "2026-06-15",
    horario: "10:00 a 12:00",
    sala: "Sala 1",
    materia: "Estudio del proyecto N°18296-05",
    estado: null,
    semana_iso: "2026-W25",
    invitados: [
      { nombre: "Juan Pérez", calidad: "Subsecretario" },
      { nombre: "María Soto", calidad: null },
    ],
    puntos: [
      { boletin: "18296-05", id_proyecto: 123, materia: "Estudio", tipo_tramite: null },
      { boletin: null, id_proyecto: null, materia: "Varios", tipo_tramite: null },
    ],
    origen: "camara-citaciones-semana",
    fecha_captura: "2026-06-18T00:00:00Z",
    enlace: "https://www.camara.cl/legislacion/comisiones/citaciones_semana.aspx",
  };
}

function sesion(id: string): SesionSala {
  return {
    id,
    camara: "senado",
    fecha: "2026-06-17",
    numero: "42",
    hora_inicio: "16:00",
    tipo: "Ordinaria",
    items: [
      {
        posicion: 1,
        parte_sesion: "ORDEN DEL DÍA",
        materia: "Proyecto X",
        boletin: "14309-04",
        id_proyecto: 9,
        alias: null,
        quorum: null,
      },
      {
        posicion: 2,
        parte_sesion: "ORDEN DEL DÍA",
        materia: "Proyecto Y",
        boletin: null,
        id_proyecto: null,
        alias: null,
        quorum: null,
      },
    ],
    origen: "senado-weekly-table",
    fecha_captura: "2026-06-18T00:00:00Z",
    enlace: "https://web-back.senado.cl/api/weekly_table",
  };
}

describe("InMemoryAgendaWriter — idempotente por clave natural", () => {
  it("upsert 2× con el mismo input NO duplica (citaciones + invitados + puntos)", async () => {
    const w = new InMemoryAgendaWriter();
    await w.upsertCitaciones([citacion("camara:2026-W25:hacienda:2026-06-15")]);
    await w.upsertCitaciones([citacion("camara:2026-W25:hacienda:2026-06-15")]);

    expect(w.citaciones.size).toBe(1);
    expect(w.invitados.size).toBe(2);
    expect(w.puntos.size).toBe(2);
  });

  it("upsert 2× con el mismo input NO duplica (sesiones + items)", async () => {
    const w = new InMemoryAgendaWriter();
    await w.upsertSesiones([sesion("senado:sesion:1001")]);
    await w.upsertSesiones([sesion("senado:sesion:1001")]);

    expect(w.sesiones.size).toBe(1);
    expect(w.items.size).toBe(2);
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

describe("SupabaseAgendaWriter — upsert idempotente por onConflict (clave natural)", () => {
  it("upserta cada tabla por su clave natural (raíz antes que hijos) sin anidar los arrays", async () => {
    const { client, upserts } = makeFakeClient();
    const w = new SupabaseAgendaWriter({ url: "x", serviceKey: "k", client: client as never });

    await w.upsertCitaciones([citacion("camara:2026-W25:hacienda:2026-06-15")]);

    const porTabla = Object.fromEntries(upserts.map((u) => [u.tabla, u]));
    expect(porTabla["citacion"]?.onConflict).toBe("id");
    expect(porTabla["citacion_invitado"]?.onConflict).toBe("citacion_id,nombre");
    expect(porTabla["citacion_punto"]?.onConflict).toBe("citacion_id,posicion");
    // La raíz NO lleva los arrays anidados (van a tablas hijas).
    const raiz = porTabla["citacion"]!.rows[0] as Record<string, unknown>;
    expect(raiz).not.toHaveProperty("invitados");
    expect(raiz).not.toHaveProperty("puntos");
    // Los puntos llevan posicion derivada del índice.
    const puntos = porTabla["citacion_punto"]!.rows as Array<{ posicion: number }>;
    expect(puntos.map((p) => p.posicion)).toEqual([0, 1]);
    // Orden: citacion (raíz) antes que sus hijos.
    expect(upserts[0]!.tabla).toBe("citacion");
  });

  it("upserta sesiones + items por clave natural", async () => {
    const { client, upserts } = makeFakeClient();
    const w = new SupabaseAgendaWriter({ url: "x", serviceKey: "k", client: client as never });

    await w.upsertSesiones([sesion("senado:sesion:1001")]);

    const porTabla = Object.fromEntries(upserts.map((u) => [u.tabla, u]));
    expect(porTabla["sesion_sala"]?.onConflict).toBe("id");
    expect(porTabla["sesion_tabla_item"]?.onConflict).toBe("sesion_id,posicion");
    expect(upserts[0]!.tabla).toBe("sesion_sala"); // raíz primero
  });

  it("propaga el error de PostgREST SIN interpolar la service key (T-06-06)", async () => {
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
    const w = new SupabaseAgendaWriter({
      url: "x",
      serviceKey: SERVICE_KEY,
      client: client as never,
    });

    await expect(
      w.upsertCitaciones([citacion("camara:2026-W25:hacienda:2026-06-15")]),
    ).rejects.toThrow(/permission denied/);
    // La clave NUNCA debe aparecer en el mensaje de error.
    await w
      .upsertCitaciones([citacion("c2")])
      .catch((e: Error) => expect(e.message).not.toContain(SERVICE_KEY));
  });
});
