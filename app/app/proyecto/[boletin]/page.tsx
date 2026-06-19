import { Suspense, cache } from "react";
import { notFound } from "next/navigation";

import { createServerSupabase } from "@/lib/supabase";
import { BOLETIN_RE } from "@/lib/buscar";
import { FichaHeader } from "@/components/ficha-header";
import { TimelineView } from "@/components/timeline-view";
import { VotacionCard } from "@/components/votacion-card";
import { IdeaMatrizBlock } from "@/components/idea-matriz-block";
import { CuerposLegalesList } from "@/components/cuerpos-legales-list";
import { ProyectosSimilares } from "@/components/proyectos-similares";
import { Skeleton } from "@/components/ui/skeleton";
import { sourceLabel } from "@/lib/types";
import type {
  ProyectoRow,
  ProyectoFichaRow,
  TramitacionEventoRow,
  VotacionRow,
} from "@/lib/types";

// Boletín válido (T-05-09, path injection): validador ÚNICO importado de lib/buscar (#36).

interface PageProps {
  params: Promise<{ boletin: string }>;
}

export default async function ProyectoPage({ params }: PageProps) {
  const { boletin } = await params;

  // Validación del input no confiable del path (T-05-09). `.eq()` de supabase-js
  // ya parametriza, pero rechazamos formatos no-boletín antes de tocar la DB.
  if (!BOLETIN_RE.test(boletin)) {
    notFound();
  }

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-16">
      <Suspense fallback={<FichaHeaderSkeleton />}>
        <FichaSection boletin={boletin} />
      </Suspense>

      <section id="timeline" className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Tramitación</h2>
        <Suspense fallback={<TimelineSkeleton />}>
          <TimelineSection boletin={boletin} />
        </Suspense>
      </section>

      <section id="votaciones" className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Votaciones</h2>
        <Suspense fallback={<VotacionesSkeleton />}>
          <VotacionesSection boletin={boletin} />
        </Suspense>
      </section>

      <section id="idea-matriz" className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Idea matriz</h2>
        <Suspense fallback={<IdeaMatrizSkeleton />}>
          <IdeaMatrizSection boletin={boletin} />
        </Suspense>
      </section>

      <section id="cuerpos-legales" className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Cuerpos legales afectados</h2>
        <Suspense fallback={<IdeaMatrizSkeleton />}>
          <CuerposLegalesSection boletin={boletin} />
        </Suspense>
      </section>

      <section id="similares" className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Proyectos similares</h2>
        <Suspense fallback={<SimilaresSkeleton />}>
          <ProyectosSimilares boletin={boletin} />
        </Suspense>
      </section>
    </main>
  );
}

// ── Ficha estructurada: idea matriz + cuerpos legales (proyecto_ficha 0011) ──
// #33: envuelto en React.cache → una sola consulta por render aunque IdeaMatrizSection y
// CuerposLegalesSection la pidan por separado (supabase-js no se deduplica como fetch).
const leerFicha = cache(
  async (boletin: string): Promise<ProyectoFichaRow | null> => {
    const sb = createServerSupabase();
    const { data } = await sb
      .from("proyecto_ficha")
      .select("*")
      .eq("boletin", boletin)
      .maybeSingle<ProyectoFichaRow>();
    return data ?? null;
  },
);

async function IdeaMatrizSection({ boletin }: { boletin: string }) {
  const ficha = await leerFicha(boletin);
  const ideaMatriz = ficha?.idea_matriz ?? null;
  // La cita lleva su propia procedencia (el texto del que se extrajo).
  const provenance =
    ideaMatriz !== null
      ? {
          capturedAt: ficha?.fecha_captura ? new Date(ficha.fecha_captura) : null,
          sourceName: sourceLabel(ficha?.origen ?? null),
          // texto_r2_path es una key R2 interna (no un enlace público): exponerla
          // como href produce un "fuente oficial" muerto que contradice el principio
          // rector (cada dato lleva enlace ORIGINAL). Hasta plumbar el
          // link_mensaje_mocion (BCN/Senado) real, mostramos fuente+fecha SIN enlace.
          sourceUrl: null,
        }
      : undefined;
  return <IdeaMatrizBlock ideaMatriz={ideaMatriz} provenance={provenance} />;
}

async function CuerposLegalesSection({ boletin }: { boletin: string }) {
  const ficha = await leerFicha(boletin);
  return <CuerposLegalesList cuerpos={ficha?.cuerpos_legales ?? []} />;
}

// ── Ficha header (proyecto) ──────────────────────────────────────────────────
async function FichaSection({ boletin }: { boletin: string }) {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("proyecto")
    .select("*")
    .eq("boletin", boletin)
    .maybeSingle<ProyectoRow>();

  // #34: distinguir "no existe" de un fallo de DB/red. `.single()` devolvía data=null en
  // AMBOS casos y el código lo trataba como 404, enmascarando errores transitorios como
  // "proyecto no encontrado". `.maybeSingle()` no lanza por 0 filas; un `error` real se
  // propaga (página de error honesta), y solo data ausente → 404.
  if (error) {
    throw new Error(`No se pudo leer el proyecto ${boletin}: ${error.message}`);
  }
  if (!data) {
    notFound();
  }

  return <FichaHeader proyecto={data} />;
}

// ── Timeline (tramitacion_evento) ────────────────────────────────────────────
async function TimelineSection({ boletin }: { boletin: string }) {
  const sb = createServerSupabase();
  const { data } = await sb
    .from("tramitacion_evento")
    .select("*")
    .eq("boletin", boletin)
    .order("fecha", { ascending: true });

  return <TimelineView eventos={(data as TramitacionEventoRow[]) ?? []} />;
}

// ── Votaciones (votacion + voto embed) ───────────────────────────────────────
async function VotacionesSection({ boletin }: { boletin: string }) {
  const sb = createServerSupabase();
  const { data } = await sb
    .from("votacion")
    .select("*, voto(*)")
    .eq("boletin", boletin)
    .order("fecha", { ascending: true });

  const votaciones = (data as VotacionRow[]) ?? [];

  if (votaciones.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Este proyecto no tiene votaciones registradas en la legislatura vigente.
      </p>
    );
  }

  return (
    <>
      {votaciones.map((v) => (
        <VotacionCard key={v.id} votacion={v} />
      ))}
    </>
  );
}

// ── Skeletons (UI-SPEC §6.2) ─────────────────────────────────────────────────
function FichaHeaderSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="flex gap-2">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-48 mt-4" />
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

function VotacionesSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}

function IdeaMatrizSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

function SimilaresSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-32 w-full rounded-lg" />
      ))}
    </div>
  );
}
