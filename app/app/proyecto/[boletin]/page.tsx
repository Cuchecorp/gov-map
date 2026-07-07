import { Suspense, cache } from "react";
import { notFound } from "next/navigation";

import { createServerSupabase } from "@/lib/supabase";
import { BOLETIN_RE } from "@/lib/buscar";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { FichaHeader } from "@/components/ficha-header";
import {
  EstadoActualBlock,
  derivarEstadoActual,
} from "@/components/estado-actual-block";
import { LobbyEnTramitacionSection } from "@/components/lobby-en-tramitacion";
import { TimelineView } from "@/components/timeline-view";
import { TramitacionStepper } from "@/components/capa1/tramitacion-stepper";
import { DetalleColapsable } from "@/components/detalle-colapsable";
import { FichaRail, type RailEntry } from "@/components/ficha-rail";
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

// Caveat anti-causal LOCKED del rail (1× por página; principio rector +
// anti-insinuación §9.1). El rail lo pasa como prop a FichaRail (genérica).
const CAVEAT_RAIL =
  "Cada dato con fuente, fecha y enlace. La coincidencia temporal no implica relación.";

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
    <main className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-16">
      {/*
        53-03 (UX-01, 53-UI-SPEC §(b)) — Breadcrumb ligero: primer hijo del
        container, ANTES del grid. El crumb NO necesita datos: el `boletin` es route
        param ya validado (BOLETIN_RE). No existe ruta `/proyectos` → el crumb de
        sección apunta a `/buscar` (superficie de hallazgo). Es un <nav> sobre el h1,
        no re-nivela headings ni mueve mt-12.
      */}
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Proyectos", href: "/buscar" },
          { label: `Boletín ${boletin}`, mono: true },
        ]}
      />

      {/*
        UXCOG 55-04 (variante B "Informe con rail"): grid de 2 columnas en md+ —
        rail sticky (13rem) + contenido (1fr). En < md el rail colapsa a una barra
        superior horizontal (lo resuelve FichaRail). `items-start` fija el sticky.
      */}
      <div className="md:grid md:grid-cols-[13rem_1fr] md:gap-8 md:items-start">
        <Suspense fallback={<RailSkeleton />}>
          <ProyectoRail boletin={boletin} />
        </Suspense>

        <div>
          <Suspense fallback={<FichaHeaderSkeleton />}>
            <FichaSection boletin={boletin} />
          </Suspense>

          {/*
            SC2 — "¿Dónde está hoy?" (EstadoActualBlock) como carril propio #estado
            (entrada "Dónde está" del rail). Responde el estado actual derivando de
            datos existentes, omitiendo cada línea no derivable. Superficie
            --background, no petróleo; no compone con otros dominios.
          */}
          <section id="estado" className="mt-12 scroll-mt-6">
            <Suspense fallback={<EstadoActualSkeleton />}>
              <EstadoActualBlock boletin={boletin} />
            </Suspense>
          </section>

          {/*
            Tramitación (#timeline): capa-1 = TramitacionStepper SIEMPRE visible
            (eleva el "¿Dónde está hoy?" a un stepper de hitos clave + urgencia
            agrupada); capa-2 = tramitación COMPLETA colapsada en DetalleColapsable
            (TimelineView, con el mecanismo ?urgencias operando dentro). Ningún hito
            se pierde: sólo se resume en capa-1.
          */}
          <section id="timeline" className="mt-12 scroll-mt-6">
            <Suspense fallback={<TimelineSkeleton />}>
              <TramitacionSection
                boletin={boletin}
                urgenciaExpandida={urgenciaExpandida}
              />
            </Suspense>
          </section>

          <section id="votaciones" className="mt-12 scroll-mt-6">
            <h2 className="text-xl font-semibold mb-4">Votaciones</h2>
            <Suspense fallback={<VotacionesSkeleton />}>
              <VotacionesSection boletin={boletin} />
            </Suspense>
          </section>

          {/*
            SC2 (Phase 52) — Carril lobby×tramitación: yuxtaposición TEMPORAL de
            audiencias de lobby con la semana ISO en que una comisión vio el boletín.
            Carril HERMANO (mt-12), NUNCA anidado ni compuesto con votos. El nombre de
            la contraparte sigue en TEXTO PLANO no-enlazado (LOCKED 52-03), dentro del
            propio LobbyEnTramitacionSection. El h2 y el caveat viven DENTRO del
            componente: en el degrade honesto pre-apply (RPC 0048 ausente → PGRST202)
            retorna null y NO deja heading huérfano; el wrapper mt-12 preserva la
            frontera aunque el contenido esté ausente (frontier rule).
          */}
          <section id="lobby-tramitacion" className="mt-12 scroll-mt-6">
            <Suspense fallback={<LobbyTramitacionSkeleton />}>
              <LobbyEnTramitacionSection boletin={boletin} />
            </Suspense>
          </section>

          <section id="idea-matriz" className="mt-12 scroll-mt-6">
            <h2 className="text-xl font-semibold mb-4">Idea matriz</h2>
            <Suspense fallback={<IdeaMatrizSkeleton />}>
              <IdeaMatrizSection boletin={boletin} />
            </Suspense>
          </section>

          <section id="cuerpos-legales" className="mt-12 scroll-mt-6">
            <h2 className="text-xl font-semibold mb-4">
              Cuerpos legales afectados
            </h2>
            <Suspense fallback={<IdeaMatrizSkeleton />}>
              <CuerposLegalesSection boletin={boletin} />
            </Suspense>
          </section>

          <section id="similares" className="mt-12 scroll-mt-6">
            <h2 className="text-xl font-semibold mb-4">Proyectos similares</h2>
            <Suspense fallback={<SimilaresSkeleton />}>
              <ProyectosSimilares boletin={boletin} />
            </Suspense>
          </section>
        </div>
      </div>
    </main>
  );
}

// ── Rail sticky de la ficha (UXCOG 55-04) ─────────────────────────────────────
// Server component: lee la cabecera del proyecto (título/boletín/estado) vía la
// lectura CACHEADA `leerProyecto` (dedup con FichaSection — React.cache) + un
// conteo de votaciones honesto, y arma las 6 entradas del rail. La isla FichaRail
// (client, scrollspy) recibe el `header` como ReactNode server + `navEntries` YA
// serializadas — NUNCA deriva un dígito ni importa Supabase (contrato no-leak F45).
// El proyecto no tiene carriles gated (cruces/money viven en /parlamentario), así
// que las 6 entradas están SIEMPRE presentes. Si el proyecto no existe, retorna
// null: FichaSection resuelve el 404 de la ruta.
export async function ProyectoRail({ boletin }: { boletin: string }) {
  const proyecto = await leerProyecto(boletin);
  if (!proyecto) return null;

  // Conteo de votaciones (3-estado honesto): un fallo real de DB/red se LANZA
  // (#34), nunca se degrada a un dígito fabricado. `head:true` = sólo el conteo.
  const sb = createServerSupabase();
  const { count, error } = await sb
    .from("votacion")
    .select("id", { count: "exact", head: true })
    .eq("boletin", boletin);
  if (error) {
    throw new Error(
      `No se pudo contar las votaciones de ${boletin}: ${error.message}`,
    );
  }
  const nVotaciones = count ?? 0;

  const navEntries: RailEntry[] = [
    { id: "estado", label: "Dónde está" },
    { id: "timeline", label: "Tramitación" },
    {
      id: "votaciones",
      label: "Votaciones",
      // Conteo sólo cuando hay dato (>0); la sección muestra el empty honesto si 0.
      count: nVotaciones > 0 ? nVotaciones : undefined,
    },
    { id: "lobby-tramitacion", label: "Lobby del período" },
    { id: "idea-matriz", label: "Idea matriz" },
    { id: "similares", label: "Similares" },
  ];

  const estadoTexto = proyecto.estado?.trim() || proyecto.etapa?.trim() || null;
  const header = (
    <div>
      <p className="text-sm font-semibold leading-snug">{proyecto.titulo}</p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">
        Boletín N°{proyecto.boletin}
      </p>
      {estadoTexto && (
        <p className="mt-1 text-xs text-muted-foreground">{estadoTexto}</p>
      )}
    </div>
  );

  return (
    <FichaRail header={header} navEntries={navEntries} caveat={CAVEAT_RAIL} />
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

// ── Lectura cacheada del proyecto (cabecera + etapa/estado) ───────────────────
// #33/WR-02: envuelta en React.cache → UNA sola consulta por render aunque la
// pidan FichaSection (cabecera), ProyectoRail (título/boletín/estado del rail) y
// TramitacionSection (etapa/estado para derivar el stepper). #34: un error real de
// DB/red se LANZA (nunca se degrada); `.maybeSingle()` no lanza por 0 filas → data
// null = "no existe" (el llamador decide el 404).
export const leerProyecto = cache(
  async (boletin: string): Promise<ProyectoRow | null> => {
    const sb = createServerSupabase();
    const { data, error } = await sb
      .from("proyecto")
      .select("*")
      .eq("boletin", boletin)
      .maybeSingle<ProyectoRow>();
    if (error) {
      throw new Error(
        `No se pudo leer el proyecto ${boletin}: ${error.message}`,
      );
    }
    return data ?? null;
  },
);

// ── Ficha header (proyecto) ──────────────────────────────────────────────────
async function FichaSection({ boletin }: { boletin: string }) {
  // #34: distinguir "no existe" de un fallo de DB/red. `leerProyecto` lanza ante
  // error real; data ausente (null) → 404. Lectura CACHEADA (dedup con el rail).
  const data = await leerProyecto(boletin);
  if (!data) {
    notFound();
  }

  return <FichaHeader proyecto={data} />;
}

// ── Tramitación: stepper capa-1 + timeline completo colapsado ─────────────────
export async function TramitacionSection({
  boletin,
  urgenciaExpandida,
}: {
  boletin: string;
  urgenciaExpandida: string | null;
}) {
  const sb = createServerSupabase();
  const [{ data, error }, proyecto] = await Promise.all([
    sb
      .from("tramitacion_evento")
      .select("*")
      .eq("boletin", boletin)
      .order("fecha", { ascending: true }),
    // Etapa/estado para elevar el "¿Dónde está hoy?" en el stepper (dedup cache).
    leerProyecto(boletin),
  ]);

  // #34 honest-error: un fallo real de DB/red ≠ "sin tramitación". Se lanza para la
  // página de error honesta en vez de fabricar un timeline vacío (que se leería como
  // "no hay eventos registrados").
  if (error) {
    throw new Error(
      `No se pudo leer la tramitación de ${boletin}: ${error.message}`,
    );
  }

  const eventos = (data as TramitacionEventoRow[]) ?? [];

  // Estado derivado para el stepper (reusa `derivarEstadoActual`): etapa/estado +
  // último hito + urgencia vigente, cada uno omitido si no es derivable. `hoy`
  // default; citaciones vacías (la citación vive en el bloque #estado completo).
  const estado = derivarEstadoActual(
    { etapa: proyecto?.etapa ?? null, estado: proyecto?.estado ?? null },
    eventos,
  );

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

      {/* Capa-1: stepper de etapas SIEMPRE visible (hitos clave + urgencia agrupada). */}
      <TramitacionStepper eventos={eventos} estado={estado} boletin={boletin} />

      {/* Capa-2: tramitación COMPLETA colapsada. Arranca ABIERTO cuando la URL trae
          ?urgencias=<id> (deep-link de "ver todos" en capa-1, WR-04) para que el
          período expandido dentro del TimelineView sea VISIBLE al aterrizar. El
          mecanismo server ?urgencias sigue operando DENTRO del TimelineView. Ningún
          hito se pierde: el detalle contiene todos los eventos. */}
      {eventos.length > 0 && (
        <div className="mt-4">
          <DetalleColapsable
            n={eventos.length}
            defaultOpen={urgenciaExpandida != null}
          >
            <TimelineView
              eventos={eventos}
              boletin={boletin}
              urgenciaExpandida={urgenciaExpandida}
            />
          </DetalleColapsable>
        </div>
      )}
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
// Rail: cabecera compacta (título/boletín/estado) + 6 entradas de nav + caveat.
// Shape-matched a FichaRail para no producir layout shift al resolver.
function RailSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="space-y-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}

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
