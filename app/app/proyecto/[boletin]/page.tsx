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
import { CrucesSection } from "@/components/cruces-de-proyecto";
import { crucesPublicEnabled } from "@/lib/cruces-gate";
import { TimelineView } from "@/components/timeline-view";
import { TramitacionStepper } from "@/components/capa1/tramitacion-stepper";
import { DetalleColapsable } from "@/components/detalle-colapsable";
import { FichaRail, type RailEntry } from "@/components/ficha-rail";
import { VotacionCard } from "@/components/votacion-card";
import { IdeaMatrizBlock } from "@/components/idea-matriz-block";
import { CuerposLegalesList } from "@/components/cuerpos-legales-list";
import { ProyectosSimilares } from "@/components/proyectos-similares";
import { AutorRow, type ProyectoAutorRow } from "@/components/autor-row";
import { ProvenanceBadge } from "@/components/provenance-badge";
import {
  ValidacionFuenteSection,
  ValidacionFuenteSkeleton,
  type SourceSnapshotRecord,
} from "@/components/validacion-fuente";
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
    <main className="max-w-[1120px] mx-auto px-4 md:px-8 py-8 md:py-16">
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
          <section id="estado" className="mt-12">
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
          <section id="timeline" className="mt-12">
            <Suspense fallback={<TimelineSkeleton />}>
              <TramitacionSection
                boletin={boletin}
                urgenciaExpandida={urgenciaExpandida}
              />
            </Suspense>
          </section>

          <section id="votaciones" className="mt-12">
            <h2 className="text-xl font-semibold mb-4">Votaciones</h2>
            <Suspense fallback={<VotacionesSkeleton />}>
              <VotacionesSection boletin={boletin} />
            </Suspense>
          </section>

          {/*
            AUTOR-02 (Phase 59) — Carril autoría: "¿Quién presentó este proyecto?"
            Guarda de identidad LOCKED: link SOLO si confirmado; IdentityMarker si no.
            Carril HERMANO (mt-12), NUNCA anidado ni compuesto con votos/lobby/dinero.
            3 estados honestos: N autores (DetalleColapsable colapsado), Mensaje del
            Ejecutivo (línea honesta), o null (ausente del DOM — moción sin datos).
            El wrapper mt-12 preserva la frontera aunque AutoresSection retorne null.
          */}
          <section id="autores" className="mt-12">
            <h2 className="text-xl font-semibold mb-4">
              ¿Quién presentó este proyecto?
            </h2>
            <Suspense fallback={<AutoresSkeleton />}>
              <AutoresSection boletin={boletin} />
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
          <section id="lobby-tramitacion" className="mt-12">
            <Suspense fallback={<LobbyTramitacionSkeleton />}>
              <LobbyEnTramitacionSection boletin={boletin} />
            </Suspense>
          </section>

          {/*
            Phase 38 (SURF-02) — Carril CRUCES: yuxtapone parlamentarios que votaron
            A FAVOR del boletín con sus reuniones de lobby EN EL SECTOR del proyecto.
            Carril HERMANO (mt-12), NUNCA anidado ni compuesto con votos/lobby. GATE
            LOCKED (Candado B): toda la sección se envuelve en
            crucesPublicEnabled(process.env) (ON en PROD desde 2026-07-02 — NO se toca
            ningún flag). El h2, el caveat y el disclosure primary de cruces viven
            DENTRO de CrucesSection/CrucesView: en el degrade honesto pre-apply
            (RPC 0049 ausente → PGRST202) retorna null sin heading huérfano; el
            wrapper mt-12 preserva la frontera (frontier rule). El nombre del
            parlamentario público se ENLAZA (DEPARTURE LOCKED); la contraparte de
            lobby sigue texto plano (52-03), dentro del propio componente.
          */}
          {crucesPublicEnabled(process.env) && (
            <section id="cruces" className="mt-12">
              <Suspense fallback={<CrucesSkeleton />}>
                <CrucesSection boletin={boletin} />
              </Suspense>
            </section>
          )}

          <section id="idea-matriz" className="mt-12">
            <h2 className="text-xl font-semibold mb-4">Idea matriz</h2>
            <Suspense fallback={<IdeaMatrizSkeleton />}>
              <IdeaMatrizSection boletin={boletin} />
            </Suspense>
          </section>

          <section id="cuerpos-legales" className="mt-12">
            <h2 className="text-xl font-semibold mb-4">
              Cuerpos legales afectados
            </h2>
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

          {/*
            TRACE-01/02/03 (Phase 89) — Sección "Valida este dato en la fuente".
            Deep-links: Senado SIEMPRE, Cámara SOLO si prm_id_camara != null, BCN omitido.
            Fecha de captura visible. Respaldo R2: fecha + hash abreviado, sin descarga,
            allowlist de prefijo tramitacion/*. safeExternalHref en todo href externo.
            Honest-error #34: un fallo real de DB/red se LANZA (nunca degrada a empty).
          */}
          <section id="validacion-fuente" className="mt-12">
            <Suspense fallback={<ValidacionFuenteSkeleton />}>
              <ValidacionFuenteServerSection boletin={boletin} />
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
// conteo de votaciones honesto, y arma las 7–8 entradas del rail (según el gate de
// cruces). La isla FichaRail
// (client, scrollspy) recibe el `header` como ReactNode server + `navEntries` YA
// serializadas — NUNCA deriva un dígito ni importa Supabase (contrato no-leak F45).
// La entrada de cruces está gated por el Candado B (crucesPublicEnabled): 7 entradas
// con el gate OFF, 8 con ON. Si el proyecto no existe, retorna
// null: FichaSection resuelve el 404 de la ruta.
export async function ProyectoRail({ boletin }: { boletin: string }) {
  const proyecto = await leerProyecto(boletin);
  if (!proyecto) return null;

  // Conteo de votaciones (3-estado honesto): un fallo real de DB/red se LANZA
  // (#34), nunca se degrada a un dígito fabricado. `head:true` = sólo el conteo.
  const sb = createServerSupabase();
  const [{ count, error }, autores] = await Promise.all([
    sb
      .from("votacion")
      .select("id", { count: "exact", head: true })
      .eq("boletin", boletin),
    leerAutores(boletin),
  ]);
  if (error) {
    throw new Error(
      `No se pudo contar las votaciones de ${boletin}: ${error.message}`,
    );
  }
  const nVotaciones = count ?? 0;
  const nAutores = autores.length;

  const navEntries: RailEntry[] = [
    { id: "estado", label: "Dónde está" },
    { id: "timeline", label: "Tramitación" },
    {
      id: "votaciones",
      label: "Votaciones",
      // Conteo sólo cuando hay dato (>0); la sección muestra el empty honesto si 0.
      count: nVotaciones > 0 ? nVotaciones : undefined,
    },
    // AUTOR-02: entrada condicional — solo si hay autores confirmados o no (> 0 filas).
    // Si 0 filas, la sección puede mostrar "Mensaje del Ejecutivo" o null; en ambos
    // casos el anchor #autores existe en el DOM (la section siempre se monta), pero
    // la entrada del rail sólo tiene sentido cuando hay autores que navegar.
    ...(nAutores > 0
      ? [{ id: "autores", label: "Autores", count: nAutores }]
      : []),
    { id: "lobby-tramitacion", label: "Lobby del período" },
    // Phase 38 (SURF-02): entrada de cruces con marcador diamante ◆, GATED por el
    // mismo Candado B que la <section id="cruces"> — sin el gate, ni el ancla ni el
    // target de scrollspy existen (sin ancla muerta). Petróleo NO se filtra a otras
    // entradas (el marker/highlight lo maneja FichaRail por-entrada).
    ...(crucesPublicEnabled(process.env)
      ? [{ id: "cruces", label: "Cruces", marker: "diamante" as const }]
      : []),
    { id: "idea-matriz", label: "Idea matriz" },
    // IN-02: #cuerpos-legales es una sección del contenido; sin su entrada el
    // scrollspy nunca la observa y el rail marca "idea-matriz" mientras se lee.
    { id: "cuerpos-legales", label: "Cuerpos legales" },
    { id: "similares", label: "Similares" },
    // TRACE-01/02/03 (Phase 89): entrada de validación de fuente — siempre presente.
    { id: "validacion-fuente", label: "Valida en fuente" },
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

// ── Autores de proyecto (AUTOR-02) ─────────────────────────────────────────────
// React.cache → una sola consulta por render aunque ProyectoRail (conteo) y
// AutoresSection (render de filas) la soliciten por separado.
export const leerAutores = cache(
  async (boletin: string): Promise<ProyectoAutorRow[]> => {
    const sb = createServerSupabase();
    const { data, error } = await sb
      .from("proyecto_autor")
      .select("*")
      .eq("boletin", boletin)
      .order("id", { ascending: true });
    // #34: un error real de DB/red NO es "sin autores". Se lanza en vez de
    // fabricar una sección vacía a partir de un fallo.
    if (error) {
      throw new Error(
        `No se pudieron leer los autores de ${boletin}: ${error.message}`,
      );
    }
    return (data as ProyectoAutorRow[]) ?? [];
  },
);

// ── AutoresSection — 3 estados honestos ──────────────────────────────────────
// Estado 1: N autores → DetalleColapsable (colapsado, conteo visible).
// Estado 2: 0 autores + iniciativa Mensaje → línea "Iniciativa del Ejecutivo".
// Estado 3: 0 autores + otro tipo → null (sección ausente del DOM).
async function AutoresSection({ boletin }: { boletin: string }) {
  const [autores, proyecto] = await Promise.all([
    leerAutores(boletin),
    leerProyecto(boletin),
  ]);

  const iniciativa = proyecto?.iniciativa ?? null;

  if (autores.length === 0) {
    if (iniciativa === "Mensaje") {
      return (
        <p className="text-sm text-muted-foreground">
          Iniciativa del Ejecutivo (Mensaje presidencial).
        </p>
      );
    }
    return null;
  }

  return (
    <DetalleColapsable n={autores.length} defaultOpen={false}>
      <ul className="divide-y divide-border">
        {autores.map((a) => (
          <AutorRow key={a.id ?? a.autor_crudo_norm} autor={a} />
        ))}
      </ul>
    </DetalleColapsable>
  );
}

// ── Validación de fuente (TRACE-01/02/03, Phase 89) ──────────────────────────
// Lee source_snapshot directamente (no RPC) — permitido bajo Camino A porque
// source_snapshot NO es PII_TABLE (lockdown-guard block B :133-144 no muerde).
// T-89-06: SOLO filtramos r2_path del registro; el componente aplica la allowlist.
// Honest-error #34: un error real de DB/red se LANZA — nunca se fabrica un empty.

async function leerSourceSnapshot(
  boletin: string,
): Promise<SourceSnapshotRecord | null> {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("source_snapshot")
    .select("content_hash, fetched_at, r2_path")
    .eq("source", "leyes")
    .eq("resource", boletin)
    .order("date_bucket", { ascending: false })
    .limit(1)
    .maybeSingle<SourceSnapshotRecord>();
  // #34: un error real de DB/red ≠ "sin snapshot". Propagar para la página de error
  // honesta en vez de fabricar un estado vacío.
  if (error) {
    throw new Error(
      `leerSourceSnapshot(${boletin}) falló: ${error.message}`,
    );
  }
  return data ?? null;
}

async function ValidacionFuenteServerSection({ boletin }: { boletin: string }) {
  // leerProyecto ya está cacheada (React.cache): cero query extra.
  const proyecto = await leerProyecto(boletin);
  if (!proyecto) return null;

  const snapshot = await leerSourceSnapshot(boletin);

  return (
    <ValidacionFuenteSection
      boletin={proyecto.boletin}
      prm_id_camara={proyecto.prm_id_camara ?? null}
      fecha_captura={proyecto.fecha_captura}
      snapshot={snapshot}
    />
  );
}

// ── Skeletons (UI-SPEC §6.2) ─────────────────────────────────────────────────
// Rail: cabecera compacta (título/boletín/estado) + 7–8 entradas de nav + caveat.
// Shape-matched a FichaRail para no producir layout shift al resolver: el conteo
// DEBE igualar a `ProyectoRail.navEntries` — 7 con el gate de cruces OFF, 8 con ON
// (WR-02). Un 6→8 producía un salto CLS visible al resolver el rail.
function RailSkeleton() {
  // Phase 89 added "validacion-fuente" → +1 entry in every configuration (WR-02).
  const nEntries = crucesPublicEnabled(process.env) ? 9 : 8;
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="space-y-1">
        {Array.from({ length: nEntries }).map((_, i) => (
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

function AutoresSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full rounded-md" />
      ))}
    </div>
  );
}

// Cruces (Phase 38): marco petróleo capa-1 (h2 + intro + caveat) + trigger primary.
// Shape-matched al render de CrucesView para no producir layout shift al resolver.
function CrucesSkeleton() {
  return (
    <div
      className="rounded-lg border-[1.5px] border-accent-product bg-card p-4 space-y-3"
      aria-hidden="true"
    >
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-11 w-48 rounded-lg" />
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
