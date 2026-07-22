import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { isRedirectError } from "next/dist/client/components/redirect-error";

import { createServerSupabase } from "@/lib/supabase";
import { contarCoberturaBusqueda, ALCANCE_COBERTURA } from "@/lib/coverage";
import { buscarProyectos, BOLETIN_RE, MAX_QUERY_CHARS } from "@/lib/buscar";
import { type ProyectoRow, type TramitacionEventoRow, type BuscarSliceRow } from "@/lib/types";
import { estadoBucket, deriveAnio } from "@/lib/estado-bucket";
import { SearchBox } from "@/components/search-box";
import { BuscarFiltros } from "@/components/buscar-filtros";
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

// WR-03: `page` acotada SUPERIOR e inferiormente. Sin tope, `?page=999999999999` haría
// matchCount ≈ 2×10^13 hacia el RPC kNN: cast int4 revienta (error banner en URL válida)
// o LIMIT gigante saca al planner del índice HNSW → full-scan + un embed Gemini quemado.
// MAX_PAGE=50 (1000 resultados) es más que suficiente para un kNN de 20/página.
export const MAX_PAGE = 50;

/** Parsea+clampa el query param `page` a 1..MAX_PAGE (defensa como los otros inputs V5). */
export function clampPage(raw: string): number {
  return Math.min(MAX_PAGE, Math.max(1, Number.parseInt(raw, 10) || 1));
}

interface PageProps {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}

export default async function BuscarPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const qRaw = typeof sp.q === "string" ? sp.q : "";
  const q = qRaw.trim().slice(0, MAX_QUERY_CHARS);
  const pageParam = typeof sp.page === "string" ? sp.page : "1";
  const page = clampPage(pageParam);

  // Atajo de boletín ANTES de embeber (mismo validador que /proyecto/[boletin]).
  if (q.length > 0 && BOLETIN_RE.test(q)) {
    redirect(`/proyecto/${q}`);
  }

  // Cobertura HONESTA (BUSQ-03): N real desde count(proyecto_embedding), NUNCA
  // hardcodeado. server-only; la key jamás llega al cliente (T-63-12/13/14).
  // `null` = count desconocido (fallo de DB); 0 = sin corpus. En ambos casos NO se
  // afirma "Busca sobre 0 proyectos" (WR-02): mejor ocultar el banner que mentir.
  const cobertura = await contarCoberturaBusqueda();

  return (
    <main className="max-w-[1120px] mx-auto px-4 md:px-8 py-8 md:py-16">
      <h1 className="sr-only">Buscar proyectos de ley</h1>
      <SearchBox initialQuery={q} />
      {cobertura !== null && cobertura > 0 && (
        <p className="text-sm text-muted-foreground mt-2">
          Busca sobre {cobertura} proyectos de ley ({ALCANCE_COBERTURA}).
        </p>
      )}

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
    // NEXT_REDIRECT es una señal interna de Next.js (redirect() lanza), no un error
    // real. Re-lanzar para que el framework lo procese correctamente (Rule 1 — bug).
    if (isRedirectError(err)) throw err;
    // Error = una llamada falló (embed / rpc / DB). Distinto de vacío/degradado.
    // Log para observabilidad (Cloudflare logs): un "search error" permanente por
    // GEMINI_API_KEY ausente o 429 era invisible sin esto.
    console.error(`buscarProyectos("${q}") falló:`, err);
    return (
      <div className="mt-6 border border-destructive/20 bg-destructive/5 rounded-[var(--radius-tile)] p-4 text-sm">
        Ocurrió un error al realizar la búsqueda. Vuelve a intentarlo en unos
        momentos.
      </div>
    );
  }

  const hayMas = vecinos.length > PAGE_SIZE * page;
  const pageSlice = vecinos.slice(PAGE_SIZE * (page - 1), PAGE_SIZE * page);

  if (pageSlice.length === 0) {
    return (
      <div className="mt-6 rounded-[var(--radius-tile)] border border-border bg-muted/40 px-6 py-8 text-center text-sm text-muted-foreground">
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
      <div className="mt-6 border border-destructive/20 bg-destructive/5 rounded-[var(--radius-tile)] p-4 text-sm">
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

  // Leer tramitacion_evento para derivar el año de cada proyecto.
  // Patrón actualidad-module: .in/.order/throw-on-error. NUNCA ?? [] para tragar fallos.
  // T-88-10: año solo de min(fecha) de tramitacion_evento; JAMÁS de fecha_captura.
  const { data: eventosData, error: eventosError } = await sb
    .from("tramitacion_evento")
    .select("boletin, fecha, tipo, descripcion")
    .in("boletin", boletines)
    .order("fecha", { ascending: true });
  if (eventosError) {
    console.error(`tramitacion_evento falló ("${q}"):`, eventosError);
    return (
      <div className="mt-6 border border-destructive/20 bg-destructive/5 rounded-[var(--radius-tile)] p-4 text-sm">
        Ocurrió un error al realizar la búsqueda. Vuelve a intentarlo en unos
        momentos.
      </div>
    );
  }
  const eventos = (eventosData as Pick<TramitacionEventoRow, "boletin" | "fecha" | "tipo" | "descripcion">[] | null) ?? [];
  /**
   * WR-02: año del proyecto = fecha del evento de INGRESO. `tipo` es un enum
   * cerrado ('tramite'|'urgencia'|'informe'|'oficio'|'votacion') que JAMÁS
   * contiene "ingreso" — la señal vive en `descripcion` (censado en PROD:
   * ~3.850 eventos con /ingreso/i en descripcion). Regla: preferir el evento
   * más antiguo cuya descripción matchee /ingreso/i; si ninguno matchea,
   * caer al evento más antiguo de cualquier tipo como proxy (orden asc
   * garantiza la min fecha al primer elemento).
   * WR-03: filtrar fechas no parseables ANTES de tomar el min para no contaminar
   * el map con valores vacíos o malformados que lexicográficamente preceden a ISO.
   */
  const minFechaPorBoletin = new Map<string, string>();
  // Agrupar por boletín — eventos ya vienen ordenados asc por fecha.
  const eventosPorBoletin = new Map<string, typeof eventos>();
  for (const ev of eventos) {
    if (!eventosPorBoletin.has(ev.boletin)) eventosPorBoletin.set(ev.boletin, []);
    eventosPorBoletin.get(ev.boletin)!.push(ev);
  }
  for (const [boletin, evs] of eventosPorBoletin) {
    // WR-03: solo fechas parseables (deriveAnio no nulo).
    const validos = evs.filter((e) => deriveAnio(e.fecha) != null);
    if (validos.length === 0) continue;
    // WR-02: preferir primer evento con "ingreso" en la DESCRIPCIÓN; si no, primer válido.
    const ingreso = validos.find((e) => /ingreso/i.test(e.descripcion ?? ""));
    minFechaPorBoletin.set(boletin, (ingreso ?? validos[0]).fecha);
  }

  // Normalizar texto libre de iniciativa a "Mensaje" | "Moción" | null (honesto).
  function normalizarIniciativa(raw: string | null): "Mensaje" | "Moción" | null {
    if (!raw) return null;
    const v = raw.toLowerCase().trim();
    if (v.includes("mensaje")) return "Mensaje";
    if (v.includes("moción") || v.includes("mocion")) return "Moción";
    return null;
  }

  // Construir BuscarSliceRow[] preservando el orden rank del retrieval (RANK-01).
  // Advisory #3: fallback truthy-trim estado→etapa antes de estadoBucket.
  // CR-01 fix: card data embebido en sliceEnriquecido (serializable) en vez de renderRow
  // (función no serializable server→client en RSC — rompe el streaming).
  const sliceEnriquecido: BuscarSliceRow[] = ordenados.map((p) => {
    const estadoInput = p.estado?.trim() || p.etapa?.trim() || null;
    const raw = porBoletin.get(p.boletin);
    return {
      boletin: p.boletin,
      titulo: p.titulo,
      anio: deriveAnio(minFechaPorBoletin.get(p.boletin) ?? null),
      iniciativa: normalizarIniciativa(p.iniciativa),
      estadoBucket: estadoBucket(estadoInput),
      camaraOrigen: p.camara_origen,
      fecha: minFechaPorBoletin.get(p.boletin) ?? null,
      // Card data (serializable — no función):
      materia: raw?.materia ?? null,
      estado: raw?.estado ?? null,
      fecha_captura: raw?.fecha_captura ?? null,
      origen: raw?.origen ?? null,
      enlace: raw?.enlace ?? null,
    };
  });

  // #32: mostrar el RANGO de la página, no `ordenados.length` como si fuera el total
  // (antes "20 resultados" aunque hubiera más). `hayMas` indica que la cuenta no termina aquí.
  const desde = PAGE_SIZE * (page - 1) + 1;
  const hasta = PAGE_SIZE * (page - 1) + ordenados.length;
  const rango = desde === hasta ? `${desde}` : `${desde}–${hasta}`;
  const countCopy = `Resultados ${rango}${hayMas ? "+" : ""} para "${q}"`;

  return (
    <>
      <p className="text-sm text-muted-foreground mt-4">{countCopy}</p>
      {/* CR-01: BuscarFiltros recibe slice serializable con card data embebido;
           renderRow eliminado (función no serializable en RSC — bug 960768f2). */}
      <BuscarFiltros
        slice={sliceEnriquecido}
      />

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
        <Card key={i} className="rounded-[var(--radius-tile)]">
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
