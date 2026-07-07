import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerSupabase } from "@/lib/supabase";
import { buscarProyectos, BOLETIN_RE, MAX_QUERY_CHARS } from "@/lib/buscar";
import { sourceLabel, type ProyectoRow } from "@/lib/types";
import { SearchBox } from "@/components/search-box";
import { SearchResultCard } from "@/components/search-result-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * /buscar — resultados de la búsqueda semántica (UI-SPEC §4). Server Component.
 *
 * `searchParams.q` es input no confiable: se trimea y capea a ≤300 (T-07-09).
 * Atajo de boletín: si `q` matchea `BOLETIN_RE`, `redirect(/proyecto/{q})` ANTES
 * de embeber (T-07-10). El embed + kNN corren server-only en `buscarProyectos`
 * (la Gemini key nunca llega al cliente, T-07-11). NUNCA se muestra score.
 */

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}

export default async function BuscarPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const qRaw = typeof sp.q === "string" ? sp.q : "";
  const q = qRaw.trim().slice(0, MAX_QUERY_CHARS);
  const pageParam = typeof sp.page === "string" ? sp.page : "1";
  const page = Math.max(1, Number.parseInt(pageParam, 10) || 1);

  // Atajo de boletín ANTES de embeber (mismo validador que /proyecto/[boletin]).
  if (q.length > 0 && BOLETIN_RE.test(q)) {
    redirect(`/proyecto/${q}`);
  }

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-16">
      <h1 className="sr-only">Buscar proyectos de ley</h1>
      <SearchBox initialQuery={q} />

      {q.length === 0 ? (
        // Query vacía: prompt estilo landing, sin lista ni error (UI-SPEC §8.1).
        <p className="text-sm text-muted-foreground mt-4">
          Escribe una idea o un número de boletín para buscar proyectos de ley.
        </p>
      ) : (
        <Suspense key={`${q}::${page}`} fallback={<ResultadosSkeleton />}>
          <Resultados q={q} page={page} />
        </Suspense>
      )}
    </main>
  );
}

export async function Resultados({ q, page }: { q: string; page: number }) {
  let vecinos: { boletin: string }[];
  try {
    vecinos = await buscarProyectos(q, { matchCount: PAGE_SIZE * page + 1 });
  } catch (err) {
    // Error = una llamada falló (embed / rpc / DB). Distinto de vacío/degradado.
    // Log para observabilidad (Cloudflare logs): un "search error" permanente por
    // GEMINI_API_KEY ausente o 429 era invisible sin esto.
    console.error(`buscarProyectos("${q}") falló:`, err);
    return (
      <div className="mt-6 border border-destructive/20 bg-destructive/5 rounded-lg p-4 text-sm">
        Ocurrió un error al realizar la búsqueda. Vuelve a intentarlo en unos
        momentos.
      </div>
    );
  }

  const hayMas = vecinos.length > PAGE_SIZE * page;
  const pageSlice = vecinos.slice(PAGE_SIZE * (page - 1), PAGE_SIZE * page);

  if (pageSlice.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-border bg-muted/40 px-6 py-8 text-center text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">Sin resultados</p>
        <p className="mt-1">
          No se encontraron proyectos para &ldquo;{q}&rdquo;. Prueba con otras
          palabras, o ingresa un número de boletín.
        </p>
        <p className="text-sm mt-2">
          También puedes revisar{" "}
          <Link
            href="/agenda"
            className="inline-flex min-h-11 items-center text-accent-product underline underline-offset-2"
          >
            la agenda legislativa de la semana{" "}
            <span aria-hidden="true" className="pl-1">→</span>
          </Link>
          .
        </p>
      </div>
    );
  }

  // Hidratar las filas del proyecto (público) preservando el orden del kNN.
  const sb = createServerSupabase();
  const boletines = pageSlice.map((v) => v.boletin);
  const { data: proyectos, error: proyectosError } = await sb
    .from("proyecto")
    .select("*")
    .in("boletin", boletines);
  // #34: un fallo de hidratación NO es "sin resultados". Antes el error se tragaba y
  // se renderizaba el header de conteo con CERO tarjetas (degradación silenciosa).
  // Mostrar el mismo error honesto que usa la rama de búsqueda.
  if (proyectosError) {
    console.error(`hidratación de proyectos falló ("${q}"):`, proyectosError);
    return (
      <div className="mt-6 border border-destructive/20 bg-destructive/5 rounded-lg p-4 text-sm">
        Ocurrió un error al realizar la búsqueda. Vuelve a intentarlo en unos
        momentos.
      </div>
    );
  }
  const porBoletin = new Map<string, ProyectoRow>(
    ((proyectos as ProyectoRow[]) ?? []).map((p) => [p.boletin, p]),
  );
  const ordenados = pageSlice
    .map((v) => porBoletin.get(v.boletin))
    .filter((p): p is ProyectoRow => p !== undefined);

  // #32: mostrar el RANGO de la página, no `ordenados.length` como si fuera el total
  // (antes "20 resultados" aunque hubiera más). `hayMas` indica que la cuenta no termina aquí.
  const desde = PAGE_SIZE * (page - 1) + 1;
  const hasta = PAGE_SIZE * (page - 1) + ordenados.length;
  const rango = desde === hasta ? `${desde}` : `${desde}–${hasta}`;
  const countCopy = `Resultados ${rango}${hayMas ? "+" : ""} para "${q}"`;

  return (
    <>
      <p className="text-sm text-muted-foreground mt-4">{countCopy}</p>
      <section className="mt-6 space-y-4">
        {ordenados.map((p) => (
          <SearchResultCard
            key={p.boletin}
            boletin={p.boletin}
            titulo={p.titulo}
            materia={p.materia}
            estado={p.estado}
            camaraOrigen={p.camara_origen}
            provenance={{
              capturedAt: p.fecha_captura ? new Date(p.fecha_captura) : null,
              sourceName: sourceLabel(p.origen),
              sourceUrl: p.enlace ?? null,
            }}
          />
        ))}
      </section>

      {(page > 1 || hayMas) && (
        <nav className="mt-8 flex items-center justify-between" aria-label="Paginación">
          {page > 1 ? (
            <Button asChild variant="ghost">
              <Link href={`/buscar?q=${encodeURIComponent(q)}&page=${page - 1}`}>
                ← Anterior
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {hayMas ? (
            <Button asChild variant="ghost">
              <Link href={`/buscar?q=${encodeURIComponent(q)}&page=${page + 1}`}>
                Siguiente →
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}

// ── Skeleton (UI-SPEC §8.2): 4 SearchResultCard skeletons ────────────────────
function ResultadosSkeleton() {
  return (
    <div className="mt-6 space-y-4" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-28" />
            </div>
            <Skeleton className="h-5 w-3/4 mt-2" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-5 w-48 mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
