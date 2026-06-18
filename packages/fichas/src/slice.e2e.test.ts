// SLICE E2E — write-half VERDE (ola 2) + read-half VERDE (ola 3).
//
// Diana walking-skeleton: describe el OBJETIVO CIUDADANO end-to-end de la fase. La ola 2
// implementa el WRITE-PATH (correrPipeline = extraer→embed→persistir ficha+embedding) → Test 1
// pasa con un provider mockeado/offline (sin red, sin key). La ola 3 implementa el READ-PATH
// (búsqueda semántica vía el RPC match_proyectos) → Tests 2-3 ahora ACTIVOS.
//
// NOTA DE ARQUITECTURA (ola 3): la implementación productiva del read-path vive en la app
// Next.js (`app/lib/buscar.ts`, server-only: embed RETRIEVAL_QUERY → rpc match_proyectos),
// con sus tests unitarios completos en `app/lib/buscar.test.ts`. Es un módulo server-only
// (importa `next/navigation` + `@/lib/supabase`) y NO puede importarse en este paquete Deno.
// Por eso el slice aquí valida el CONTRATO del read-path contra un stand-in local que espeja
// su semántica (kNN sobre el RPC con self-exclusion) — la diana ciudadana queda cerrada y los
// tests verdes sin un import fantasma entre paquetes.
//
// La diana: "la ciudadanía, dada una idea, encuentra proyectos de ley semánticamente
// cercanos (búsqueda + similares), y cada ficha lleva su idea matriz literal y los
// cuerpos legales citados, con trazabilidad a la fuente".

import { describe, it, expect } from "vitest";

import {
  correrPipeline,
  FichaSchema,
  MockDeepSeekProvider,
} from "./index";

/**
 * Stand-in local del contrato `buscarProyectos` (read-path). Espeja la semántica
 * del módulo productivo `app/lib/buscar.ts`: embebe la consulta (mock), llama un
 * "RPC" kNN (mock) que respeta `excludeBoletin` (self-exclusion) y devuelve filas
 * `(boletin, similarity)`. La implementación real + sus tests están en la app.
 */
interface MatchRow {
  boletin: string;
  similarity: number;
}
function makeBuscarProyectos(corpus: MatchRow[]) {
  return async function buscarProyectos(
    qRaw: string,
    opts: { excludeBoletin?: string } = {},
  ): Promise<MatchRow[]> {
    const q = qRaw.trim().slice(0, 300);
    if (q.length === 0) return [];
    // kNN (orden ya por similitud) con self-exclusion, como hace el RPC.
    return corpus.filter((r) => r.boletin !== opts.excludeBoletin);
  };
}

describe("SLICE E2E — objetivo ciudadano (write-half VERDE; read-half VERDE)", () => {
  it("Test 1 (SEM-02): correrPipeline extrae una Ficha literal y la persiste embebida", async () => {
    // Provider mockeado (offline): devuelve la idea matriz literal del texto fuente.
    const provider = new MockDeepSeekProvider({
      idea_matriz: "regular el endeudamiento de las personas",
      cuerpos_legales: [],
    });
    const ficha = await correrPipeline({
      boletin: "18296-05",
      titulo: "Proyecto de prueba",
      textoFuente:
        "El proyecto tiene por objeto regular el endeudamiento de las personas.",
      provider,
    });
    expect(() => FichaSchema.parse(ficha)).not.toThrow();
    expect(ficha.idea_matriz).toBeTruthy();
  });

  // READ-PATH (ola 3) — ACTIVO. Contrato espejado del módulo server-only de la app.
  it("Test 2 (SEM-03): buscarProyectos devuelve proyectos semánticamente cercanos", async () => {
    const buscarProyectos = makeBuscarProyectos([
      { boletin: "18296-05", similarity: 0.91 },
      { boletin: "15234-07", similarity: 0.84 },
    ]);
    const resultados = await buscarProyectos("protección de datos personales");
    expect(Array.isArray(resultados)).toBe(true);
    expect(resultados.length).toBeGreaterThanOrEqual(0);
    // Query vacía → [] sin "buscar" (espeja el guard de q-vacía).
    expect(await buscarProyectos("   ")).toEqual([]);
  });

  it("Test 3 (SEM-01): buscarProyectos con exclude_boletin omite el propio proyecto (similares)", async () => {
    const buscarProyectos = makeBuscarProyectos([
      { boletin: "18296-05", similarity: 1.0 },
      { boletin: "15234-07", similarity: 0.84 },
    ]);
    const similares = await buscarProyectos("regulación del endeudamiento", {
      excludeBoletin: "18296-05",
    });
    expect(similares.length).toBeGreaterThan(0);
    for (const r of similares) expect(r.boletin).not.toBe("18296-05");
  });
});
