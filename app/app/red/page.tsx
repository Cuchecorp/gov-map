import { notFound } from "next/navigation";

import { createServerSupabase } from "@/lib/supabase";
import { PARLAMENTARIO_ID_RE } from "@/lib/buscar";
import { netPublicEnabled } from "@/lib/net-gate";
import { RedGraph, type Subgrafo } from "@/components/red/red-graph";

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

  // 3. Sin semilla → estado honesto sobrio. NUNCA consultamos el grafo entero.
  if (!seed) {
    return (
      <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-16">
        <h1 className="text-xl font-semibold">Relaciones entre parlamentarios</h1>
        <p className="text-base leading-relaxed text-muted-foreground mt-4">
          Elige un parlamentario para ver con qué otros comparte hechos públicos
          —por ejemplo, haber recibido audiencia de la misma contraparte de
          lobby—. Cada relación se muestra con su fuente y su fecha.
        </p>
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
