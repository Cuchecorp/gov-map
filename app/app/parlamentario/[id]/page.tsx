import { Suspense } from "react";
import { notFound } from "next/navigation";

import { createServerSupabase } from "@/lib/supabase";
import { PARLAMENTARIO_ID_RE } from "@/lib/buscar";
import { ParlamentarioHeader } from "@/components/parlamentario-header";
import { VotosSection } from "@/components/votos-por-parlamentario";
import { LobbySection } from "@/components/lobby-de-parlamentario";
import { PatrimonioSection } from "@/components/patrimonio-de-parlamentario";
import { ContratosSection } from "@/components/contratos-de-parlamentario";
import { FinanciamientoSection } from "@/components/financiamiento-de-parlamentario";
import { moneyPublicEnabled } from "@/lib/money-gate";
import { Skeleton } from "@/components/ui/skeleton";
import type { ParlamentarioPublicoRow } from "@/lib/types";

/**
 * /parlamentario/[id] — la PRIMERA ficha del parlamentario (VOTE-03/04/05).
 *
 * Shell de UNA columna con secciones APILABLES e independientes: hoy solo VOTE;
 * Phase 11+ (INT lobby/patrimonio) y 14–16 (MONEY) APILAN su propia `<section>`
 * DESPUÉS, cada una con su `<h2>`, su Suspense y su empty honesto — sin anidar en
 * `#votos`. El shell mantiene válida la jerarquía h1 → h2 → h3 al crecer.
 *
 * `params`/`searchParams` son Promises (Next 16). El `[id]` se valida contra
 * PARLAMENTARIO_ID_RE ANTES de tocar la DB (V5). La cabecera se lee vía el RPC
 * `parlamentario_publico` (security definer) porque `parlamentario` es
 * deny-by-default: anon no lo lee directo (LEGAL-03).
 */

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ParlamentarioPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  if (!PARLAMENTARIO_ID_RE.test(id)) {
    notFound();
  }

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-16">
      <Suspense fallback={<ParlamentarioHeaderSkeleton />}>
        <HeaderSection id={id} />
      </Suspense>

      <section id="votos" className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Votaciones</h2>
        <Suspense fallback={<VotosSkeleton />}>
          <VotosSection id={id} searchParams={sp} />
        </Suspense>
      </section>

      {/*
        Phase 11 — INT Lobby (§3.0). SIBLING de #votos, NUNCA anidada: el mt-12 es
        la frontera de carril (anti-insinuación §9.1). Una reunión de lobby y un
        voto JAMÁS comparten un <article>/<Card>/<li>. Su propio <h2> + Suspense +
        empty honesto.
      */}
      <section id="lobby" className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Reuniones de lobby</h2>
        <Suspense fallback={<LobbySkeleton />}>
          <LobbySection id={id} searchParams={sp} />
        </Suspense>
      </section>

      {/*
        Phase 12 — INT Patrimonio/Intereses (§3.0). SIBLING de #lobby, NUNCA
        anidada: el mt-12 es la frontera de carril (anti-insinuación §9.1). Una
        declaración y un voto/reunión JAMÁS comparten un <article>/<Card>/<li>/<tr>.
        Su propio <h2> + Suspense + empty honesto + comparación SOLO-datos sin
        veredicto (INT-04/05). CC BY 4.0 visible en el intro Y en el caption.
      */}
      <section id="patrimonio" className="mt-12">
        <h2 className="text-xl font-semibold mb-4">
          Declaraciones de patrimonio e intereses
        </h2>
        <Suspense fallback={<PatrimonioSkeleton />}>
          <PatrimonioSection id={id} searchParams={sp} />
        </Suspense>
      </section>

      {/*
        Phase 14 — MONEY Contratos (UI-SPEC §Exposure Gate). SIBLING de #patrimonio,
        NUNCA anidada: el mt-12 es la frontera de carril (anti-insinuación §9.1).
        GATE LOCKED: TODA la <section id="dinero"> — incluido su <h2> — se envuelve en
        moneyPublicEnabled(process.env). Con OFF (default) el nodo entero, heading
        incluido, está AUSENTE del HTML; NO se depende de que ContratosSection retorne
        null para ocultar el heading. moneyPublicEnabled es server-only (chokepoint
        WR-02): NUNCA leer MONEY_PUBLIC_ENABLED crudo. Heading EXACTO, sin posesivo.
      */}
      {moneyPublicEnabled(process.env) && (
        <section id="dinero" className="mt-12">
          <h2 className="text-xl font-semibold mb-4">
            Contratos del Estado asociados al RUT
          </h2>
          <Suspense fallback={<ContratosSkeleton />}>
            <ContratosSection id={id} searchParams={sp} />
          </Suspense>
        </section>
      )}

      {/*
        Phase 15 — MONEY Financiamiento (UI-SPEC §Exposure Gate). SIBLING de
        #dinero (contratos), NUNCA anidada: el mt-12 es la frontera de carril
        (anti-insinuación §9.1). GATE LOCKED: TODA la <section id="financiamiento">
        — incluido su <h2> — se envuelve en moneyPublicEnabled(process.env). Con OFF
        (default) el nodo entero, heading incluido, está AUSENTE del HTML; NO se
        depende de que FinanciamientoSection retorne null para ocultar el heading.
        moneyPublicEnabled es server-only (chokepoint WR-02): NUNCA leer
        MONEY_PUBLIC_ENABLED crudo. Heading EXACTO, sin posesivo. A1: el enlace al
        candidato es por NOMBRE confirmado (SERVEL no trae RUT), nunca por RUT.
      */}
      {moneyPublicEnabled(process.env) && (
        <section id="financiamiento" className="mt-12">
          <h2 className="text-xl font-semibold mb-4">
            Aportes de campaña registrados en SERVEL
          </h2>
          <Suspense fallback={<FinanciamientoSkeleton />}>
            {/*
              `eleccionActual` se deriva del periodo PÚBLICO del parlamentario
              (`parlamentario_publico.periodo`) para que el caveat ámbar de
              "candidatura anterior" pueda dispararse contra datos reales. El
              wrapper lo resuelve server-side; si el periodo no es derivable, pasa
              null (conservador: ningún grupo se etiqueta "anterior").
            */}
            <FinanciamientoSectionConPeriodo id={id} searchParams={sp} />
          </Suspense>
        </section>
      )}

      {/*
        Phase 22 — honest-state MONEY (DESIGN-SYSTEM §7/§8.6, CONTEXT decisión 6).
        Cuando MONEY está OFF (default), en vez de SILENCIO el ciudadano ve que la
        sección existe y POR QUÉ aún no se muestra. Es MUTUAMENTE EXCLUYENTE con las
        secciones reales #dinero/#financiamiento (ON futuro). CLAVE anti-insinuación:
        este bloque NO toca Supabase, NO compone con un voto, NO menciona monto/
        contrato/donante — sólo el texto legal LOCKED. Carril propio mt-12 (SIBLING,
        nunca anidado en #votos); su propia <section> con su <h2>.
      */}
      {!moneyPublicEnabled(process.env) && (
        <section id="financiamiento-pendiente" className="mt-12">
          <h2 className="text-xl font-semibold mb-4">
            Financiamiento y contratos del Estado
          </h2>
          <p className="text-sm text-muted-foreground">
            Pendiente de revisión legal (Ley 21.719) antes de publicarse.
          </p>
        </section>
      )}
    </main>
  );
}

// ── Wrapper MONEY Financiamiento: deriva `eleccionActual` del periodo público ───
// El periodo del mandato actual NO viene del RPC de aportes ni del marcador; vive
// en `parlamentario_publico.periodo` (campo público, no sensible). Lo leemos aquí
// y lo pasamos EXPLÍCITO a FinanciamientoSection para que el caveat ámbar de
// "candidatura anterior" pueda dispararse. Conservador: ante un periodo nulo o un
// fallo, se pasa null (ningún grupo se etiqueta "anterior"); un error real de DB
// NO se degrada a "sin aportes" — eso lo decide FinanciamientoSection con su RPC.
async function FinanciamientoSectionConPeriodo({
  id,
  searchParams,
}: {
  id: string;
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .rpc("parlamentario_publico", { p_id: id })
    .maybeSingle<ParlamentarioPublicoRow>();
  // #34: un error real de DB/red se lanza (UI de error honesta), nunca se degrada.
  if (error) {
    throw new Error(
      `parlamentario_publico falló para ${id}: ${error.message}`,
    );
  }
  // periodo ausente (null) → conservador: eleccionActual null, sin caveat anterior.
  const eleccionActual = data?.periodo ?? null;

  return (
    <FinanciamientoSection
      id={id}
      searchParams={searchParams}
      eleccionActual={eleccionActual}
    />
  );
}

// ── Cabecera (RPC parlamentario_publico, deny-by-default → 404 honesto) ────────
async function HeaderSection({ id }: { id: string }) {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .rpc("parlamentario_publico", { p_id: id })
    .maybeSingle<ParlamentarioPublicoRow>();

  // #34: distinguir "no existe" (→ 404) de un fallo real de DB/red (→ error
  // honesto). `.maybeSingle()` no lanza por 0 filas; un `error` real se propaga.
  if (error) {
    throw new Error(
      `No se pudo leer el parlamentario ${id}: ${error.message}`,
    );
  }
  if (!data) {
    notFound();
  }

  return <ParlamentarioHeader parlamentario={data} />;
}

// ── Skeletons (UI-SPEC §6.2) ───────────────────────────────────────────────────
function ParlamentarioHeaderSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="flex gap-2">
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-56 mt-4" />
    </div>
  );
}

function VotosSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-10 w-full rounded-lg" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

// Shape-matched a LobbyView: línea de intro + 3 filas de audiencia (§6.2).
function LobbySkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-4 w-3/4" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

// Shape-matched a PatrimonioView: línea de intro + atribución + 3 filas de
// versión (barra de fecha prominente + tipo + bloque de campos + provenance) (§6.2).
function PatrimonioSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2 border-t pt-4 first:border-t-0">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-8 w-40 rounded-md" />
        </div>
      ))}
    </div>
  );
}

// Shape-matched a ContratosView: línea de intro + línea de atribución + 3 filas de
// contrato (sujeto proveedor + campos + provenance) (UI-SPEC §Loading state).
function ContratosSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

// Shape-matched a FinanciamientoView: línea de intro + línea de atribución + 3
// filas de aporte (sujeto donante + campos + provenance) (UI-SPEC §Loading State).
function FinanciamientoSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}
