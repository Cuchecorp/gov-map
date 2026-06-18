// writer.test — idempotencia por clave natural (in-memory) + onConflict correcto (Supabase fake).

import { describe, it, expect } from "vitest";
import { InMemoryTramitacionWriter } from "./writer";
import { SupabaseTramitacionWriter } from "./writer-supabase";
import type { Proyecto, Votacion, Voto, TramitacionEvento } from "./model";

const PROV = {
  origen: "test",
  fecha_captura: "2026-06-18T00:00:00.000Z",
  enlace: "https://camara.cl/x",
};

const proyecto: Proyecto = {
  boletin: "14309-04",
  boletin_num: "14309",
  titulo: "Proyecto X",
  iniciativa: "Moción",
  camara_origen: "C.Diputados",
  autores: ["A", "B"],
  materia: null,
  estado: "En tramitación",
  etapa: "Segundo trámite",
  subetapa: null,
  ...PROV,
};

const votacion: Votacion = {
  id: "camara:89178",
  boletin: "14309-04",
  fecha: "2026-03-01T00:00:00.000Z",
  etapa: null,
  tipo: null,
  quorum: null,
  resultado: "Aprobado",
  total_si: 58,
  total_no: 81,
  total_abstencion: 0,
  total_pareo: 0,
  camara: "diputados",
  ...PROV,
};

const voto: Voto = {
  votacion_id: "camara:89178",
  mencion_nombre: "Coloma C., Juan Antonio",
  parlamentario_id: "D123",
  seleccion: "si",
  metodo: "determinista",
  estado_vinculo: "confirmado",
};

const evento: TramitacionEvento = {
  boletin: "14309-04",
  fecha: "2026-03-01T00:00:00.000Z",
  camara: "C.Diputados",
  tipo: "tramite",
  descripcion: "Ingreso",
  enlace: null,
  origen: "test",
  fecha_captura: "2026-06-18T00:00:00.000Z",
};

describe("InMemoryTramitacionWriter — idempotente por clave natural", () => {
  it("correr 2× con el mismo input NO duplica filas", async () => {
    const w = new InMemoryTramitacionWriter();
    for (let i = 0; i < 2; i++) {
      await w.upsertProyecto(proyecto);
      await w.upsertVotacion([votacion]);
      await w.upsertVotos([voto]);
      await w.upsertEventos([evento]);
    }
    expect(w.proyectos.size).toBe(1);
    expect(w.votaciones.size).toBe(1);
    expect(w.votos.size).toBe(1);
    expect(w.eventos.size).toBe(1);
  });

  it("distingue votos por (votacion_id, mencion_nombre) y eventos por su clave natural", async () => {
    const w = new InMemoryTramitacionWriter();
    await w.upsertVotos([
      voto,
      { ...voto, mencion_nombre: "Otro, Diputado" },
    ]);
    await w.upsertEventos([
      evento,
      { ...evento, descripcion: "Segundo trámite" },
    ]);
    expect(w.votos.size).toBe(2);
    expect(w.eventos.size).toBe(2);
  });
});

/** Cliente fake mínimo de supabase-js: registra los upserts y su onConflict por tabla. */
function fakeClient() {
  const calls: { table: string; rows: unknown[]; onConflict?: string }[] = [];
  const client = {
    from(table: string) {
      return {
        upsert(rows: unknown, opts?: { onConflict?: string }) {
          calls.push({
            table,
            rows: Array.isArray(rows) ? rows : [rows],
            ...(opts?.onConflict !== undefined ? { onConflict: opts.onConflict } : {}),
          });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return { client, calls };
}

describe("SupabaseTramitacionWriter — onConflict por clave natural (cliente fake)", () => {
  it("usa el onConflict correcto por entidad y omite lotes vacíos", async () => {
    const { client, calls } = fakeClient();
    const w = new SupabaseTramitacionWriter({
      url: "http://local",
      serviceKey: "k",
      // @ts-expect-error — cliente fake mínimo para el test (no es un SupabaseClient real).
      client,
    });

    await w.upsertProyecto(proyecto);
    await w.upsertVotacion([votacion]);
    await w.upsertVotos([voto]);
    await w.upsertEventos([evento]);
    await w.upsertVotacion([]); // lote vacío → no genera call

    const byTable = Object.fromEntries(calls.map((c) => [c.table, c.onConflict]));
    expect(byTable["proyecto"]).toBe("boletin");
    expect(byTable["votacion"]).toBe("id");
    expect(byTable["voto"]).toBe("votacion_id,mencion_nombre");
    expect(byTable["tramitacion_evento"]).toBe("boletin,fecha,camara,tipo,descripcion");
    expect(calls.filter((c) => c.table === "votacion")).toHaveLength(1); // el vacío no llamó
  });

  it("propaga el error de PostgREST sin filtrar la service key", async () => {
    const client = {
      from() {
        return {
          upsert() {
            return Promise.resolve({ error: { message: "duplicate key" } });
          },
        };
      },
    };
    const w = new SupabaseTramitacionWriter({
      url: "http://local",
      serviceKey: "super-secret-key",
      // @ts-expect-error — cliente fake.
      client,
    });
    await expect(w.upsertProyecto(proyecto)).rejects.toThrow(/upsert proyecto falló/);
    await expect(w.upsertProyecto(proyecto)).rejects.not.toThrow(/super-secret-key/);
  });
});
