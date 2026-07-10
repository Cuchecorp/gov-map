// seed-fichas.test — idempotencia del seed de proyecto_ficha 'pendiente' (Wave 0, TDD RED).
//
// Cierra la causa raíz de BUSQ-01: los proyectos SIN fila en proyecto_ficha son invisibles
// al pipeline (leerPendientes consulta proyecto_ficha, runIngest solo escribe proyecto).
// seedFichasPendientes() crea una fila estado='pendiente' SOLO para los faltantes, idempotente.
//
// Espeja pipeline.test.ts: colaborador inyectado (el SupabaseClient vía opts.client), captura
// de argumentos de .upsert(...) y verificación del contrato SIN red/DB reales.
//
// Verifica:
//   - gap detection: proyecto={A,B,C} + ficha={A} → crea SOLO {B,C} (estado 'pendiente').
//   - origen='fichas-seed' en las filas seedeadas.
//   - idempotencia: upsert usa ignoreDuplicates:true (ON CONFLICT DO NOTHING) → no re-abre.
//   - NO re-abrir estado terminal: 'embebido'/'error' preexistente nunca entra al lote.
//   - sin faltantes → { creados: 0 } sin llamar upsert.

import { describe, it, expect, vi } from "vitest";
import { SupabaseFichasWriter, type FichaRow } from "./writer-supabase";

/**
 * Mock del SupabaseClient inyectado (opts.client). `from("proyecto").select` y
 * `from("proyecto_ficha").select` devuelven conjuntos controlados; `.upsert(...)` captura
 * el lote + las opciones para aserción. Espeja la forma que consume el writer.
 */
function fakeClient(opts: {
  proyectos: string[];
  fichas: string[];
}) {
  const upsertCalls: Array<{ lote: unknown[]; options: unknown }> = [];
  // select().range(from,to) pagina como PostgREST (writer lee TODAS las páginas — fix >1k filas).
  const selectPaginado = (boletines: string[]) =>
    vi.fn(() => ({
      range: vi.fn(async (from: number, to: number) => ({
        data: boletines.slice(from, to + 1).map((boletin) => ({ boletin })),
        error: null,
      })),
    }));
  const client = {
    from(table: string) {
      if (table === "proyecto") {
        return { select: selectPaginado(opts.proyectos) };
      }
      // proyecto_ficha: select devuelve los boletines con ficha; upsert captura.
      return {
        select: selectPaginado(opts.fichas),
        upsert: vi.fn(async (lote: unknown[], options: unknown) => {
          upsertCalls.push({ lote, options });
          return { error: null };
        }),
      };
    },
  };
  return { client, upsertCalls };
}

function writerCon(opts: { proyectos: string[]; fichas: string[] }) {
  const { client, upsertCalls } = fakeClient(opts);
  const writer = new SupabaseFichasWriter({
    url: "http://local",
    serviceKey: "svc",
    client: client as never,
  });
  return { writer, upsertCalls };
}

describe("seedFichasPendientes — seed idempotente del gap BUSQ-01", () => {
  it("Test 1: crea filas SOLO para los proyectos sin ficha, estado 'pendiente' + origen 'fichas-seed'", async () => {
    const { writer, upsertCalls } = writerCon({
      proyectos: ["A", "B", "C"],
      fichas: ["A"],
    });

    const res = await writer.seedFichasPendientes();

    expect(res.creados).toBe(2);
    expect(upsertCalls).toHaveLength(1);
    const lote = upsertCalls[0]!.lote as FichaRow[];
    const boletines = lote.map((f) => f.boletin).sort();
    expect(boletines).toEqual(["B", "C"]);
    for (const f of lote) {
      expect(f.estado).toBe("pendiente");
      expect(f.origen).toBe("fichas-seed");
      expect(f.idea_matriz).toBeNull();
      expect(f.cuerpos_legales).toEqual([]);
      expect(f.texto_r2_path).toBeNull();
    }
  });

  it("Test 2: idempotencia — el upsert usa ignoreDuplicates:true (ON CONFLICT DO NOTHING)", async () => {
    const { writer, upsertCalls } = writerCon({
      proyectos: ["A", "B"],
      fichas: [],
    });

    await writer.seedFichasPendientes();

    expect(upsertCalls).toHaveLength(1);
    const options = upsertCalls[0]!.options as { onConflict: string; ignoreDuplicates: boolean };
    expect(options.onConflict).toBe("boletin");
    expect(options.ignoreDuplicates).toBe(true);
  });

  it("Test 3: NO re-abre estado terminal — un 'embebido'/'error' preexistente NUNCA entra al lote", async () => {
    // A='embebido', B='error' ya tienen fila → solo C (sin ficha) debe seedearse.
    const { writer, upsertCalls } = writerCon({
      proyectos: ["A", "B", "C"],
      fichas: ["A", "B"], // A y B ya tienen fila (cualquier estado terminal)
    });

    const res = await writer.seedFichasPendientes();

    expect(res.creados).toBe(1);
    const lote = upsertCalls[0]!.lote as FichaRow[];
    expect(lote.map((f) => f.boletin)).toEqual(["C"]);
    // Defensa-en-profundidad: aunque C sea el único, ignoreDuplicates:true garantiza DO NOTHING.
    const options = upsertCalls[0]!.options as { ignoreDuplicates: boolean };
    expect(options.ignoreDuplicates).toBe(true);
  });

  it("Test 4: sin faltantes (todo proyecto ya tiene ficha) → { creados: 0 } sin llamar upsert", async () => {
    const { writer, upsertCalls } = writerCon({
      proyectos: ["A", "B"],
      fichas: ["A", "B"],
    });

    const res = await writer.seedFichasPendientes();

    expect(res.creados).toBe(0);
    expect(upsertCalls).toHaveLength(0);
  });
});
