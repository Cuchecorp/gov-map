import { Suspense, cache } from "react";
import { notFound } from "next/navigation";

import { createServerSupabase } from "@/lib/supabase";
import { BOLETIN_RE } from "@/lib/buscar";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { FichaHeader } from "@/components/ficha-header";
import { EstadoActualBlock } from "@/components/estado-actual-block";
import { LobbyEnTramitacionSection } from "@/components/lobby-en-tramitacion";
import { TimelineView } from "@/components/timeline-view";
import { VotacionCard } from "@/components/votacion-card";
import { IdeaMatrizBlock } from "@/components/idea-matriz-block";
import { CuerposLegalesList } from "@/components/cuerpos-legales-list";
import { ProyectosSimilares } from "@/components/proyectos-similares";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { sourceLabel } from "@/lib/types";
import { extractoIdea } from "@/lib/format";
import type {
  ProyectoRow,
  ProyectoFichaRow,
  TramitacionEventoRow,
  VotacionRow,
} from "@/lib/types";

// Boletín válido (T-05-09, path injection): validador ÚNICO importado de lib/buscar (#36).

interface PageProps {
  params: Promise<{ boletin: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ProyectoPage({ params, searchParams }: PageProps) {
  const { boletin } = await params;
  const sp = await searchParams;

  // Validación del input no confiable del path (T-05-09). `.eq()` de supabase-js
  // ya parametriza, pero rechazamos formatos no-boletín antes de tocar la DB.
  if (!BOLETIN_RE.test(boletin)) {
    notFound();
  }

  // Período de urgencia expandido (SC2, server-driven): ?urgencias=<id>. Normalizado
  // como los demás params del repo (string[] → primer valor; vacío → null). Nunca se
  // interpola en SQL — se compara por igualdad contra ids de período ya conocidos
  // (T-51-17): la TimelineView sólo expande un período cuyo id derivó ella misma.
  const urgenciaExpandida =
    (Array.isArray(sp.urgencias) ? sp.urgencias[0] : sp.urgencias)?.trim() || null;

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-16">
      {/*
        53-03 (UX-01, 53-UI-SPEC §(b)) — Breadcrumb ligero: primer hijo del
        container, ANTES del header (que vive dentro del <Suspense>). El crumb NO
        necesita datos: el `boletin` es route param ya validado (BOLETIN_RE). No
        existe ruta `/proyectos` → el crumb de sección apunta a `/buscar` (superficie
        de hallazgo). Es un <nav> sobre el h1, no re-nivela headings ni mueve mt-12.
      */}
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Proyectos", href: "/buscar" },
          { label: `Boletín ${boletin}`, mono: true },
        ]}
      />
      <Suspense fallback={<FichaHeaderSkeleton />}>
        <FichaSection boletin={boletin} />
      </Suspense>

      {/*
        SC2 — "¿Dónde está hoy?" (EstadoActualBlock). PRIMER elemento tras el header,
        ANTES de #idea-matriz: responde el estado actual derivando de datos existentes
        (etapa/estado + último hito + urgencia vigente), omitiendo cada línea no
        derivable. Carril propio (superficie --background, no petróleo); no compone
        con otros dominios.
      */}
      <Suspense fallback={<EstadoActualSkeleton />}>
        <EstadoActualBlock boletin={boletin} />
      </Suspense>

      <section id="timeline" className="mt-12">
        <Suspense fallback={<TimelineSkeleton />}>
          <TimelineSection boletin={boletin} urgenciaExpandida={urgenciaExpandida} />
        </Suspense>
      </section>

      <section id="votaciones" className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Votaciones</h2>
        <Suspense fallback={<VotacionesSkeleton />}>
          <VotacionesSection boletin={boletin} />
        </Suspense>
      </section>

      {/*
        SC2 (Phase 52) — Carril lobby×tramitación: yuxtaposición TEMPORAL de
        audiencias de lobby con la semana ISO en que una comisión vio el boletín.
        Carril HERMANO (mt-12), NUNCA anidado ni compuesto con votos. El h2 y el
        caveat viven DENTRO del componente: en el degrade honesto pre-apply
        (RPC 0048 ausente → PGRST202) `LobbyEnTramitacionSection` retorna null y
        NO deja heading huérfano; el wrapper mt-12 preserva la frontera aunque el
        contenido esté ausente (frontier rule, 52-UI-SPEC §Spacing).
      */}
      <section id="lobby-tramitacion" className="mt-12">
        <Suspense fallback={<LobbyTramitacionSkeleton />}>
          <LobbyEnTramitacionSection boletin={boletin} />
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
export const leerFicha = cache(
  async (boletin: string): Promise<ProyectoFichaRow | null> => {
    const sb = createServerSupabase();
    const { data, error } = await sb
      .from("proyecto_ficha")
      .select("*")
      .eq("boletin", boletin)
      .maybeSingle<ProyectoFichaRow>();
    // #34: un error de DB NO es "sin ficha". Tragar el error fabricaria el estado
    // honesto "idea matriz no disponible" a partir de una falla → propagar.
    if (error) {
      throw new Error(`leerFicha(${boletin}) falló: ${error.message}`);
    }
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
async function TimelineSection({
  boletin,
  urgenciaExpandida,
}: {
  boletin: string;
  urgenciaExpandida: string | null;
}) {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("tramitacion_evento")
    .select("*")
    .eq("boletin", boletin)
    .order("fecha", { ascending: true });

  // #34 honest-error: un fallo real de DB/red ≠ "sin tramitación". Se lanza para la
  // página de error honesta en vez de fabricar un timeline vacío (que se leería como
  // "no hay eventos registrados").
  if (error) {
    throw new Error(
      `No se pudo leer la tramitación de ${boletin}: ${error.message}`,
    );
  }

  const eventos = (data as TramitacionEventoRow[]) ?? [];

  // SC7: UN ProvenanceBadge por sección (aquí, en el heading), en vez de 100+ badges
  // idénticos (uno por evento). Frescura = el `fecha_captura` MÁS RECIENTE del set
  // (esStale/14d lo evalúa el propio badge); la fuente = el `origen` de ese evento.
  // Cada evento CONSERVA su link "Ver fuente oficial ↗" (trazabilidad por dato, SC7).
  const masReciente = eventos.reduce<TramitacionEventoRow | null>((acc, e) => {
    if (!e.fecha_captura) return acc;
    if (!acc) return e;
    return new Date(e.fecha_captura) > new Date(acc.fecha_captura) ? e : acc;
  }, null);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-semibold">Tramitación</h2>
        {masReciente && (
          <ProvenanceBadge
            capturedAt={new Date(masReciente.fecha_captura)}
            sourceName={sourceLabel(masReciente.origen)}
            sourceUrl={null}
          />
        )}
      </div>
      <TimelineView
        eventos={eventos}
        boletin={boletin}
        urgenciaExpandida={urgenciaExpandida}
      />
    </>
  );
}

// ── Votaciones (votacion + voto embed) ───────────────────────────────────────
async function VotacionesSection({ boletin }: { boletin: string }) {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("votacion")
    .select("*, voto(*)")
    .eq("boletin", boletin)
    .order("fecha", { ascending: true });

  // #34 honest-error: un fallo real de DB/red ≠ "sin votaciones". Sin esto, un error
  // transitorio caería a `?? []` y renderizaría "no tiene votaciones registradas" —
  // fabricando un HECHO ("no tiene votaciones") a partir de un error. Se lanza.
  if (error) {
    throw new Error(
      `No se pudieron leer las votaciones de ${boletin}: ${error.message}`,
    );
  }

  const votaciones = (data as VotacionRow[]) ?? [];

  if (votaciones.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Este proyecto no tiene votaciones registradas en la legislatura vigente.
      </p>
    );
  }

  // ESPEJO (Phase 22, SC6): conecta la votación con la idea matriz DEL PROPIO
  // proyecto — el ciudadano entiende QUÉ se votó sin salir de la ficha. Se lee de
  // la `leerFicha` ya cacheada (React.cache → cero query extra; la misma fila que
  // sirve a #idea-matriz). La sección de votaciones sigue siendo carril propio
  // (#votaciones, sibling mt-12 de #idea-matriz): esto NO anida ni compone con
  // dinero/lobby, sólo recuerda de qué trata el proyecto + ancla a la idea completa.
  // idea_matriz null → se omite la línea de contexto (honest-state: el bloque
  // #idea-matriz ya muestra "no disponible aún"); NUNCA se fabrica texto.
  const ficha = await leerFicha(boletin);
  const ideaMatriz = ficha?.idea_matriz ?? null;

  return (
    <>
      {ideaMatriz && (
        <p className="text-sm text-muted-foreground mb-6">
          Qué se votó: {extractoIdea(ideaMatriz)}{" "}
          <a
            href="#idea-matriz"
            className="text-primary underline underline-offset-2"
          >
            Ver la idea matriz completa
          </a>
        </p>
      )}
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

function EstadoActualSkeleton() {
  return (
    <div
      className="mt-6 rounded-lg border p-6 space-y-2"
      aria-hidden="true"
    >
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
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

function LobbyTramitacionSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-16 w-full rounded-md" />
      <Skeleton className="h-4 w-1/2" />
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
