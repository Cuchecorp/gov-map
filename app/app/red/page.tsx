import { notFound } from "next/navigation";

import { createServerSupabase } from "@/lib/supabase";
import { formatNombre } from "@/lib/format";
import { PARLAMENTARIO_ID_RE } from "@/lib/buscar";
import { netPublicEnabled } from "@/lib/net-gate";
import { RedGraph, type Subgrafo } from "@/components/red/red-graph";
import type { ParlamentarioListadoRow } from "@/lib/types";

/**
 * /red — el grafo de influencia ciudadano de NET (NET-02). Server Component que
 * (1) gatea con `notFound()` como PRIMERA sentencia cuando el candado B está OFF,
 * y (2) cuando ON, consume el RPC `subgrafo_red` por SEMILLA y pasa el JSON plano
 * a la isla cliente `<RedGraph>` (Plan 18-03 monta @xyflow/react sobre ese JSON).
 *
 * GATE A NIVEL DE PÁGINA (LOCKED, ORDEN LOAD-BEARING — espejo de
 * /contraparte/[id]):
 *   1. `if (!netPublicEnabled(process.env)) notFound();` — PRIMERA sentencia,
 *      ANTES de leer searchParams, ANTES de cualquier RPC/heading. Con OFF
 *      (default fail-closed) la ruta ENTERA 404 (sirve not-found.tsx); NO se filtra
 *      NINGÚN heading ni DOM de NET al HTML mientras OFF. Encender requiere el
 *      sign-off legal F17 (17-LEGAL-DOSSIER signoff: approved).
 *   2. `const { seed } = await searchParams;` — searchParams es Promise (Next 16).
 *   3. Sin semilla → estado honesto (invita a elegir un parlamentario); NUNCA se
 *      consulta el grafo entero (subgrafo_red EXIGE semilla; no hay variante
 *      seedless — evita enumeración de todos los nodos, espejo WR-03).
 *   4. `if (!PARLAMENTARIO_ID_RE.test(seed)) notFound();` — valida la semilla
 *      ANTES de tocar la DB (V5 / T-18-07). Espejo de la validación de id en
 *      /contraparte y /parlamentario.
 *
 * REGLA RECTORA DURA ANTI-INSINUACIÓN (18-CONTEXT): la copy describe hechos
 * tipados con fuente y fecha; jamás una valoración ni una relación de proximidad,
 * y nunca lenguaje de causa. El grafo VACÍO (0 aristas) es un estado honesto,
 * NUNCA un error. `netPublicEnabled` es server-only (chokepoint): la ruta enruta
 * su visibilidad SOLO por esa función, nunca leyendo el flag crudo del entorno.
 */

// FORCE-DYNAMIC (load-bearing): sin esto, el `notFound()` del gate corre DURANTE
// el build (flag OFF en el contenedor) ANTES de tocar searchParams → Next clasifica
// /red como estática (○) y hornea el 404. Con el flag ON en runtime, servir esa
// prerender rota el render RSC (500 en TODAS las ramas). Todas las demás rutas de
// datos son dinámicas por segmento o por acceso temprano a searchParams; /red es
// la única cuyo gate lanza antes del primer API dinámico.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function RedPage({ searchParams }: PageProps) {
  // 1. GATE A NIVEL DE PÁGINA — PRIMERA sentencia, antes de searchParams/RPC/heading.
  //    OFF (default) → la ruta entera 404; sin filtración de DOM de NET.
  if (!netPublicEnabled(process.env)) {
    notFound();
  }

  // 2. searchParams es Promise (Next 16) → await.
  const sp = await searchParams;
  const seedRaw = sp.seed;
  const seed = typeof seedRaw === "string" ? seedRaw : undefined;

  // 3. Sin semilla → SELECTOR de semilla server-rendered (JS-free), espejo del
  //    directorio /parlamentarios: un <form method="get" action="/red"> con un
  //    <select name="seed"> agrupado por cámara. NUNCA consultamos el grafo entero
  //    (subgrafo_red EXIGE semilla; no hay variante seedless → evita enumeración de
  //    todos los nodos). Se lee `parlamentarios_publico` (el ÚNICO canal anon a la
  //    maestra deny-by-default, ya allowlisted; NUNCA partido/rut/email). Al enviar,
  //    el GET recarga /red?seed=<id> y cae en el path de validación PARLAMENTARIO_ID_RE.
  if (!seed) {
    const sb = createServerSupabase();
    const { data, error } = await sb.rpc("parlamentarios_publico");
    // #34 (honest degradation): un fallo real de DB/red es un ERROR, NUNCA se
    // degrada a "sin opciones" — se lanza para que la UI muestre el error.
    if (error) {
      throw new Error(`parlamentarios_publico falló: ${error.message}`);
    }
    const rows = (data as ParlamentarioListadoRow[] | null) ?? [];
    const diputados = rows.filter((r) => r.camara === "diputados");
    const senadores = rows.filter((r) => r.camara === "senado");

    return (
      <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-16">
        <h1 className="text-xl font-semibold">Relaciones entre parlamentarios</h1>
        <p className="text-base leading-relaxed text-muted-foreground mt-4">
          Elige un parlamentario para ver con qué otros comparte hechos públicos
          —por ejemplo, haber recibido audiencia de la misma contraparte de
          lobby—. Cada relación se muestra con su fuente y su fecha.
        </p>

        <form
          method="get"
          action="/red"
          className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="flex-1">
            <span className="block text-sm font-medium">Parlamentario</span>
            <select
              name="seed"
              defaultValue=""
              required
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="" disabled>
                Elige un parlamentario…
              </option>
              <optgroup label="Cámara">
                {diputados.map((r) => (
                  <option key={r.id} value={r.id}>
                    {formatNombre(r.nombre)}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Senado">
                {senadores.map((r) => (
                  <option key={r.id} value={r.id}>
                    {formatNombre(r.nombre)}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver relaciones
          </button>
        </form>
      </main>
    );
  }

  // 4. Validación de la semilla ANTES de tocar la DB (V5 / T-18-07).
  if (!PARLAMENTARIO_ID_RE.test(seed)) {
    notFound();
  }

  // Consulta acotada-por-semilla. depth=1 (clamp 1..2 in-SQL).
  const sb = createServerSupabase();
  const { data, error } = await sb.rpc("subgrafo_red", {
    p_id: seed,
    p_depth: 1,
  });

  // Honest degradation: un fallo real del RPC (grant/RLS, red, error de Postgres)
  // NO es "sin relaciones". Se lanza para que la UI muestre el error en vez de un
  // grafo vacío engañoso. El camino vacío queda SOLO para grafos genuinamente sin
  // aristas (lo maneja <RedGraph> como estado honesto).
  if (error) {
    throw new Error(`subgrafo_red falló para ${seed}: ${error.message}`);
  }

  const subgrafo = (data as Subgrafo | null) ?? null;

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-16">
      <h1 className="text-xl font-semibold">Relaciones entre parlamentarios</h1>
      <p className="text-base leading-relaxed text-muted-foreground mt-4">
        Hechos públicos que vinculan a este parlamentario con otros. Cada relación
        es un hecho con fuente y fecha; no afirma intención ni causa.
      </p>
      <RedGraph subgrafo={subgrafo} />
    </main>
  );
}
