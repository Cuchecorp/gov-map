import { Suspense } from "react";
import { notFound } from "next/navigation";

import { createServerSupabase } from "@/lib/supabase";
import { PARLAMENTARIO_ID_RE } from "@/lib/buscar";
import { ParlamentarioHeader } from "@/components/parlamentario-header";
import { ParlamentarioResumen } from "@/components/parlamentario-resumen";
import { CarrilAccordion } from "@/components/carril-accordion";
import { VotosSection } from "@/components/votos-por-parlamentario";
import { LobbySection } from "@/components/lobby-de-parlamentario";
import { PatrimonioSection } from "@/components/patrimonio-de-parlamentario";
import { ContratosSection } from "@/components/contratos-de-parlamentario";
import { FinanciamientoSection } from "@/components/financiamiento-de-parlamentario";
import { CrucesSection } from "@/components/cruces-de-parlamentario";
import {
  contarCarrilesSeguro,
  type CarrilEstado,
} from "@/lib/parlamentario-resumen-conteos";
import { moneyPublicEnabled } from "@/lib/money-gate";
import { crucesPublicEnabled } from "@/lib/cruces-gate";
import { Skeleton } from "@/components/ui/skeleton";
import type { ParlamentarioPublicoRow } from "@/lib/types";

/**
 * /parlamentario/[id] — la ficha del parlamentario (VOTE-03/04/05 + LEG navegación).
 *
 * Shell de UNA columna NAVEGABLE (Phase 45): un resumen + índice above-fold (tras
 * la cabecera, antes del primer carril) y cada carril de dominio envuelto en un
 * `CarrilAccordion` (header con su `<h2>` siempre visible, cuerpo colapsable).
 * Cada carril sigue siendo su propia `<section className="mt-12">` HERMANA — el
 * `mt-12` es la frontera anti-insinuación LOCKED (DESIGN-SYSTEM §3/§8), NUNCA se
 * mueve al wrapper ni se colapsa. JAMÁS dos dominios en un mismo acordeón.
 *
 * `params`/`searchParams` son Promises (Next 16). El `[id]` se valida contra
 * PARLAMENTARIO_ID_RE ANTES de tocar la DB (V5). La cabecera se lee vía el RPC
 * `parlamentario_publico` (security definer) porque `parlamentario` es
 * deny-by-default: anon no lo lee directo (LEGAL-03).
 *
 * Los conteos se obtienen UNA vez vía `contarCarriles(id)` (server-only,
 * React.cache → la misma lectura la reusa `ParlamentarioResumen`). De ahí se
 * deriva el `conteo` (3-estado honesto) del header de cada acordeón y el
 * `defaultOpen` (heurística conservadora).
 */

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Conteo 3-estado HONESTO → etiqueta del header del acordeón. Espejo textual de
 * `ChipConteo` (parlamentario-resumen.tsx): `dato`→n; `vacio`→"sin registros";
 * `no_ingerido`→"—"; `pendiente`→"pendiente". NUNCA un número fabricado;
 * `vacio`/`no_ingerido`/`pendiente` JAMÁS muestran un dígito.
 */
function conteoLabel(estado: CarrilEstado): string {
  switch (estado.tipo) {
    case "dato":
      return String(estado.n);
    case "vacio":
      return "sin registros";
    case "no_ingerido":
      return "—";
    case "pendiente":
      return "pendiente";
  }
}

/**
 * Heurística de apertura por default (conservadora, determinista): se abre SOLO
 * el carril con datos sustantivos (`tipo === "dato"`, i.e. total > 0). Los
 * carriles `vacio`/`no_ingerido`/`pendiente` (sin datos o ralos) arrancan
 * colapsados — el header con su conteo honesto sigue visible, así el lector ve
 * el estado sin ruido. Regla simple para no aparentar densidad donde no la hay.
 */
function abrePorDefecto(estado: CarrilEstado): boolean {
  return estado.tipo === "dato";
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

      {/*
        Phase 45 — Resumen + índice above-fold (UI-SPEC §1.1). DESPUÉS de la
        cabecera y ANTES del primer carril: un chip por carril PRESENTE con su
        conteo/estado honesto + ancla de salto. Replica los gates cruces/money
        (lista solo carriles efectivamente en el HTML).
      */}
      <Suspense fallback={<ResumenSkeleton />}>
        <ParlamentarioResumen id={id} />
      </Suspense>

      {/*
        WR-02: los carriles y SUS CONTEOS viven tras su propio <Suspense>. Así el
        shell (cabecera + resumen) hace streaming independiente y un fallo de
        conteo degrada SOLO este subárbol (a estado honesto "—"), nunca tumba la
        ficha entera (la cabecera, aislada en su propio Suspense, sigue en pie).
        La lectura de conteos es server-only y NUNCA vuelve al cliente.
      */}
      <Suspense fallback={<CarrilesSkeleton />}>
        <CarrilesSection id={id} searchParams={sp} />
      </Suspense>
    </main>
  );
}

/**
 * Lista de carriles de dominio (server component). Lee los conteos 3-estado UNA
 * vez vía `contarCarrilesSeguro(id)` — React.cache deduplica la lectura que
 * también hace `ParlamentarioResumen`, y el wrapper DEGRADA un fallo de conteo a
 * estado honesto "desconocido" (—) en vez de lanzar (WR-02). De ahí deriva el
 * `conteo` del header y el `defaultOpen` de cada acordeón. Respeta los gates
 * cruces/money internamente (espejo byte-a-byte): el carril sólo aparece si su
 * candado está abierto.
 *
 * Vive tras un <Suspense> en la página (WR-02): el shell (cabecera + resumen)
 * streamea independiente; un fallo de este subárbol no derriba la cabecera, y un
 * fallo de conteo ya no lanza (degrada honesto) — la ficha nunca se cae entera
 * por un error transitorio de un solo carril.
 */
async function CarrilesSection({
  id,
  searchParams,
}: {
  id: string;
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const conteos = await contarCarrilesSeguro(id);
  const sp = searchParams;

  return (
    <>
      {/*
        Cada carril = su propia <section id className="mt-12"> HERMANA. El mt-12 es
        la frontera anti-insinuación LOCKED (DESIGN-SYSTEM §3/§8); NO se mueve al
        CarrilAccordion. El <h2> del carril migra al header del acordeón (titulo=),
        que queda SIEMPRE visible (preserva h1→h2→h3). UN acordeón por dominio.
      */}
      <section id="votos" className="mt-12">
        <CarrilAccordion
          titulo="Votaciones"
          conteo={conteoLabel(conteos.votos)}
          defaultOpen={abrePorDefecto(conteos.votos)}
        >
          <Suspense fallback={<VotosSkeleton />}>
            <VotosSection id={id} searchParams={sp} />
          </Suspense>
        </CarrilAccordion>
      </section>

      {/*
        Phase 11 — INT Lobby (§3.0). SIBLING de #votos, NUNCA anidada: el mt-12 es
        la frontera de carril (anti-insinuación §9.1). Una reunión de lobby y un
        voto JAMÁS comparten un <article>/<Card>/<li>. Su propio acordeón.
      */}
      <section id="lobby" className="mt-12">
        <CarrilAccordion
          titulo="Reuniones de lobby"
          conteo={conteoLabel(conteos.lobby)}
          defaultOpen={abrePorDefecto(conteos.lobby)}
        >
          <Suspense fallback={<LobbySkeleton />}>
            <LobbySection id={id} searchParams={sp} />
          </Suspense>
        </CarrilAccordion>
      </section>

      {/*
        Phase 12 — INT Patrimonio/Intereses (§3.0). SIBLING de #lobby, NUNCA
        anidada: el mt-12 es la frontera de carril (anti-insinuación §9.1). Una
        declaración y un voto/reunión JAMÁS comparten un <article>/<Card>/<li>/<tr>.
        Su propio acordeón + comparación SOLO-datos sin veredicto (INT-04/05).
      */}
      <section id="patrimonio" className="mt-12">
        <CarrilAccordion
          titulo="Declaraciones de patrimonio e intereses"
          conteo={conteoLabel(conteos.patrimonio)}
          defaultOpen={abrePorDefecto(conteos.patrimonio)}
        >
          <Suspense fallback={<PatrimonioSkeleton />}>
            <PatrimonioSection id={id} searchParams={sp} />
          </Suspense>
        </CarrilAccordion>
      </section>

      {/*
        Phase 37 — SURF Cruces sector (SURF-01, CONTEXT decisión de posición).
        SIBLING de #patrimonio, NUNCA anidada: el mt-12 es la frontera de carril
        (anti-insinuación §9.1). Una señal de cruce y un voto/reunión JAMÁS comparten
        un <article>/<Card>/<li>. Posición LOCKED: DESPUÉS de #patrimonio y ANTES de
        las secciones MONEY gated, para no leerse como un "score" pegado a #lobby.
        GATE LOCKED (Candado B): TODA la <section id="cruces"> — incluido su header de
        acordeón — se envuelve en crucesPublicEnabled(process.env). Con OFF (default)
        el nodo entero, header incluido, está AUSENTE del HTML; NO se depende de que
        CrucesSection retorne null para ocultar el heading. crucesPublicEnabled es
        server-only (chokepoint WR-02): NUNCA leer CRUCES_PUBLIC_ENABLED crudo. Heading
        factual, sin posesivo. ENCENDER el flag = Phase 39 (firma legal humana).
      */}
      {crucesPublicEnabled(process.env) && (
        <section id="cruces" className="mt-12">
          <CarrilAccordion
            titulo="Cruces con sectores"
            conteo={conteoLabel(conteos.cruces)}
            defaultOpen={abrePorDefecto(conteos.cruces)}
          >
            <Suspense fallback={<CrucesSkeleton />}>
              <CrucesSection id={id} />
            </Suspense>
          </CarrilAccordion>
        </section>
      )}

      {/*
        Phase 14 — MONEY Contratos (UI-SPEC §Exposure Gate). SIBLING de #patrimonio,
        NUNCA anidada: el mt-12 es la frontera de carril (anti-insinuación §9.1).
        GATE LOCKED: TODA la <section id="dinero"> — incluido su header de acordeón —
        se envuelve en moneyPublicEnabled(process.env). Con OFF (default) el nodo
        entero, header incluido, está AUSENTE del HTML; NO se depende de que
        ContratosSection retorne null para ocultar el heading. moneyPublicEnabled es
        server-only (chokepoint WR-02): NUNCA leer MONEY_PUBLIC_ENABLED crudo. Heading
        EXACTO, sin posesivo. WR-01: este header refleja SOLO contratos
        (`conteos.dineroContratos`), nunca el combinado contratos+aportes.
      */}
      {moneyPublicEnabled(process.env) && (
        <section id="dinero" className="mt-12">
          <CarrilAccordion
            titulo="Contratos del Estado asociados al RUT"
            conteo={conteoLabel(conteos.dineroContratos)}
            defaultOpen={abrePorDefecto(conteos.dineroContratos)}
          >
            <Suspense fallback={<ContratosSkeleton />}>
              <ContratosSection id={id} searchParams={sp} />
            </Suspense>
          </CarrilAccordion>
        </section>
      )}

      {/*
        Phase 15 — MONEY Financiamiento (UI-SPEC §Exposure Gate). SIBLING de
        #dinero (contratos), NUNCA anidada: el mt-12 es la frontera de carril
        (anti-insinuación §9.1). GATE LOCKED: TODA la <section id="financiamiento">
        — incluido su header de acordeón — se envuelve en moneyPublicEnabled(process.env).
        Con OFF (default) el nodo entero, header incluido, está AUSENTE del HTML; NO se
        depende de que FinanciamientoSection retorne null para ocultar el heading.
        moneyPublicEnabled es server-only (chokepoint WR-02): NUNCA leer
        MONEY_PUBLIC_ENABLED crudo. Heading EXACTO, sin posesivo. A1: el enlace al
        candidato es por NOMBRE confirmado (SERVEL no trae RUT), nunca por RUT.
      */}
      {moneyPublicEnabled(process.env) && (
        <section id="financiamiento" className="mt-12">
          <CarrilAccordion
            titulo="Aportes de campaña registrados en SERVEL"
            conteo={conteoLabel(conteos.dineroAportes)}
            defaultOpen={abrePorDefecto(conteos.dineroAportes)}
          >
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
          </CarrilAccordion>
        </section>
      )}

      {/*
        Phase 22 — honest-state MONEY (DESIGN-SYSTEM §7/§8.6, CONTEXT decisión 6).
        Cuando MONEY está OFF (default), en vez de SILENCIO el ciudadano ve que la
        sección existe y POR QUÉ aún no se muestra. Es MUTUAMENTE EXCLUYENTE con las
        secciones reales #dinero/#financiamiento (ON futuro). CLAVE anti-insinuación:
        este bloque NO toca Supabase, NO compone con un voto, NO menciona monto/
        contrato/donante — sólo el texto legal LOCKED. Carril propio mt-12 (SIBLING,
        nunca anidado en #votos); su propio acordeón con conteo "pendiente". El gate
        !moneyPublicEnabled y el texto legal se conservan VERBATIM.
      */}
      {!moneyPublicEnabled(process.env) && (
        <section id="financiamiento-pendiente" className="mt-12">
          <CarrilAccordion
            titulo="Financiamiento y contratos del Estado"
            conteo={conteoLabel({ tipo: "pendiente" })}
            defaultOpen={false}
          >
            <p className="text-sm text-muted-foreground">
              Pendiente de revisión legal (Ley 21.719) antes de publicarse.
            </p>
          </CarrilAccordion>
        </section>
      )}
    </>
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

// Shape-matched a ResumenView: fila de chips (índice above-fold) (§1.1).
function ResumenSkeleton() {
  return (
    <div className="mt-6 flex flex-wrap gap-2" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-40 rounded-full" />
      ))}
    </div>
  );
}

// Shape-matched a la lista de carriles: una fila de header de acordeón por
// carril (título + conteo), mientras los conteos 3-estado resuelven (WR-02).
function CarrilesSkeleton() {
  return (
    <div className="space-y-12" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="mt-12 first:mt-12">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-5 w-10" />
          </div>
        </div>
      ))}
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

// Shape-matched a CrucesView: línea de intro + 3 filas de señal (encabezado de
// conteo + evidencia con provenance). Espejo de LobbySkeleton (§6.2).
function CrucesSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-4 w-3/4" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
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
