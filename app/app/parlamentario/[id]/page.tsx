import { Suspense, cache } from "react";
import { notFound } from "next/navigation";

import { createServerSupabase } from "@/lib/supabase";
import { PARLAMENTARIO_ID_RE } from "@/lib/buscar";
import { ParlamentarioHeader } from "@/components/parlamentario-header";
import {
  construirChips,
  type ResumenChip,
} from "@/components/parlamentario-resumen";
import { FichaRail, type RailEntry } from "@/components/ficha-rail";
import { DetalleColapsable } from "@/components/detalle-colapsable";
import { CamaraChip } from "@/components/camara-chip";
import { VotosCapa1 } from "@/components/capa1/votos-capa1";
import { LobbyCapa1 } from "@/components/capa1/lobby-capa1";
import { PatrimonioCapa1 } from "@/components/capa1/patrimonio-capa1";
import { CrucesCapa1 } from "@/components/capa1/cruces-capa1";
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
import { netPublicEnabled } from "@/lib/net-gate";
import { formatNombre } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import type { ParlamentarioPublicoRow } from "@/lib/types";

/**
 * /parlamentario/[id] — la ficha del parlamentario (VOTE-03/04/05 + UXCOG 55-03).
 *
 * Variante B "Informe con rail" (UXCOG): grid `max-w-5xl` de dos columnas —
 * rail sticky (`FichaRail`, 13rem) + contenido (1fr). El rail concentra la
 * cabecera compacta + el índice gate-aware + el caveat anti-causal 1×. Cada
 * carril de dominio muestra su capa-1 (resumen PREATENTIVO) SIEMPRE visible fuera
 * del disclosure y envuelve SOLO el detalle (`*Section`) en `DetalleColapsable`
 * (default CERRADO): el estado por defecto baja de ~28.000px a un orden de
 * ~5.000px SIN perder ningún dato (todo accesible al expandir).
 *
 * Cada carril sigue siendo su propia `<section className="mt-12 scroll-mt-6">`
 * HERMANA — el `mt-12` es la frontera anti-insinuación LOCKED (DESIGN-SYSTEM
 * §3/§8), NUNCA se mueve al wrapper ni se colapsa. JAMÁS dos dominios en una
 * misma unidad; la capa-1 vive FUERA del disclosure, solo el detalle colapsa.
 *
 * `params`/`searchParams` son Promises (Next 16). El `[id]` se valida contra
 * PARLAMENTARIO_ID_RE ANTES de tocar la DB (V5). La cabecera se lee vía el RPC
 * `parlamentario_publico` (security definer) porque `parlamentario` es
 * deny-by-default: anon no lo lee directo (LEGAL-03).
 *
 * Los conteos se obtienen UNA vez vía `contarCarrilesSeguro(id)` (server-only,
 * React.cache → la misma lectura la reusan el rail y los carriles). De ahí se
 * derivan las cifras de cada capa-1 (55-02) y el `conteo` 3-estado honesto.
 */

// Caveat anti-causal LOCKED del rail (1× por página; principio rector +
// anti-insinuación §9.1). El rail lo pasa como prop a FichaRail (genérica).
const CAVEAT_RAIL =
  "Cada dato con fuente, fecha y enlace. La coincidencia temporal no implica relación.";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Conteo 3-estado HONESTO → etiqueta textual. Espejo de `ChipConteo`
 * (parlamentario-resumen.tsx): `dato`→n; `vacio`→"sin registros";
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
 * Mapea un chip del índice (`construirChips`, gate-aware) a una `RailEntry`. El
 * `id` = `href` sin `#` (coincide con el `id` de la `<section>` → scrollspy y
 * salto funcionan). El conteo llega YA formateado 3-estado (la isla NUNCA deriva
 * un dígito). El carril de cruces lleva el marcador "diamante" (sobrio, petróleo).
 */
function chipToRailEntry(ch: ResumenChip): RailEntry {
  const id = ch.href.replace(/^#/, "");
  return {
    id,
    label: ch.label,
    count: conteoLabel(ch.estado),
    marker: id === "cruces" ? "diamante" : undefined,
  };
}

/**
 * WR-02: lectura ÚNICA y deduplicada del RPC público `parlamentario_publico`.
 * `HeaderSection`, `ParlamentarioRail`, `LobbySectionConCamara` y
 * `FinanciamientoSectionConPeriodo` necesitan la MISMA fila (nombre/cámara/periodo)
 * en el mismo request. `React.cache` deduplica: una sola RPC por request, cero
 * copy-paste, mismo #34 (un error real de DB/red se LANZA → UI de error honesta,
 * nunca se degrada). `.maybeSingle()` no lanza por 0 filas → el llamador distingue
 * "no existe" (data null → 404 en Header) de un fallo real (error → throw). CERO
 * RPC nueva.
 */
const getParlamentarioPublico = cache(async (id: string) => {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .rpc("parlamentario_publico", { p_id: id })
    .maybeSingle<ParlamentarioPublicoRow>();
  if (error) {
    throw new Error(
      `parlamentario_publico falló para ${id}: ${error.message}`,
    );
  }
  return data;
});

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
    <main className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-16">
      {/*
        UXCOG 55-03 (variante B "Informe con rail"): grid de 2 columnas en md+ —
        rail sticky (13rem) + contenido (1fr). En < md el rail colapsa a una barra
        superior horizontal (lo resuelve FichaRail). `items-start` fija el sticky.
      */}
      <div className="md:grid md:grid-cols-[13rem_1fr] md:gap-8 md:items-start">
        <Suspense fallback={<RailSkeleton />}>
          <ParlamentarioRail id={id} />
        </Suspense>

        <div>
          <Suspense fallback={<ParlamentarioHeaderSkeleton />}>
            <HeaderSection id={id} />
          </Suspense>

          {/*
            B21b — Enlace gated a /red?seed=<id>. Aparece SOLO cuando
            netPublicEnabled(process.env) es true (espejo EXACTO de los gates
            cruces/money): con OFF (default fail-closed) el nodo ENTERO está AUSENTE
            del DOM (no oculto por CSS ni dependiendo de que un hijo retorne null).
            netPublicEnabled es server-only (chokepoint): NUNCA leer
            NET_PUBLIC_ENABLED crudo. El enlace es navegación PURA — NO compone
            hechos de otro parlamentario, así que no cruza la frontera
            anti-insinuación (mt-12 se respeta igual). `id` ya validó contra
            PARLAMENTARIO_ID_RE al inicio de la page. Copy SOBRIO, sin
            influencia/conexiones/afinidad/score/causa. ENCENDER el flag = deuda
            F17 (firma legal humana); un agente NUNCA lo flipea.
          */}
          {netPublicEnabled(process.env) && (
            <nav aria-label="Relaciones entre parlamentarios" className="mt-12">
              <a
                href={`/red?seed=${id}`}
                className="text-sm font-medium underline underline-offset-4"
              >
                Ver relaciones con otros parlamentarios
              </a>
            </nav>
          )}

          {/*
            WR-02: los carriles y SUS CONTEOS viven tras su propio <Suspense>. Así
            el shell (rail + cabecera) hace streaming independiente y un fallo de
            conteo degrada SOLO este subárbol (a estado honesto "—"), nunca tumba
            la ficha entera. La lectura de conteos es server-only y NUNCA vuelve al
            cliente.
          */}
          <Suspense fallback={<CarrilesSkeleton />}>
            <CarrilesSection id={id} searchParams={sp} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

// ── Rail sticky de la ficha (UXCOG 55-03) ──────────────────────────────────────
// Server component: lee la cabecera pública (nombre/cámara/periodo) vía la lectura
// CACHEADA `getParlamentarioPublico` (dedup con HeaderSection — React.cache) + los
// conteos gate-aware, y arma las entradas del rail vía `construirChips` (misma
// fuente que el índice above-fold anterior → orden LOCKED y gates espejo de
// page.tsx). La isla FichaRail (client, scrollspy) recibe el `header` como
// ReactNode server + `navEntries` YA serializadas — NUNCA deriva un dígito ni
// importa Supabase (contrato no-leak F45). Si el parlamentario no existe, retorna
// null: HeaderSection resuelve el 404 de la ruta.
export async function ParlamentarioRail({ id }: { id: string }) {
  const data = await getParlamentarioPublico(id);
  if (!data) return null;

  // WR-02: lectura segura de conteos — un fallo degrada a estado honesto "—",
  // nunca tumba el rail. React.cache dedup con CarrilesSection (una sola lectura).
  const conteos = await contarCarrilesSeguro(id);
  const navEntries: RailEntry[] = construirChips(conteos).map(chipToRailEntry);

  // Cabecera compacta del rail (mirror 55-04): chip cámara + nombre (display-only,
  // formatNombre) + periodo Mono. El <h1> real vive UNA vez en HeaderSection
  // (columna de contenido) — el rail usa un <p> para no re-nivelar headings.
  const nombreDisplay = formatNombre(data.nombre);
  const header = (
    <div>
      <div className="flex flex-wrap gap-2">
        <CamaraChip camara={data.camara} />
      </div>
      <p className="mt-2 text-sm font-semibold leading-snug">{nombreDisplay}</p>
      {data.periodo && (
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {data.periodo}
        </p>
      )}
    </div>
  );

  return (
    <FichaRail header={header} navEntries={navEntries} caveat={CAVEAT_RAIL} />
  );
}

/**
 * Lista de carriles de dominio (server component). Lee los conteos 3-estado UNA
 * vez vía `contarCarrilesSeguro(id)` — React.cache deduplica la lectura que
 * también hace `ParlamentarioRail`, y el wrapper DEGRADA un fallo de conteo a
 * estado honesto "desconocido" (—) en vez de lanzar (WR-02). De cada carril: el
 * `<h2>` + conteo (siempre visible) → la capa-1 (resumen preatentivo, SIEMPRE
 * visible, alimentada por `contarCarrilesSeguro`) → el detalle (`*Section`)
 * envuelto en `DetalleColapsable` (CERRADO por defecto; el `*Section` server pasa
 * como children — contrato no-leak F45). Respeta los gates cruces/money
 * internamente (espejo byte-a-byte): el carril sólo aparece si su candado está
 * abierto.
 *
 * Vive tras un <Suspense> en la página (WR-02): el shell streamea independiente;
 * un fallo de este subárbol no derriba el rail/cabecera.
 */
export async function CarrilesSection({
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
        Cada carril = su propia <section id className="mt-12 scroll-mt-6"> HERMANA.
        El mt-12 es la frontera anti-insinuación LOCKED (DESIGN-SYSTEM §3/§8); NO se
        mueve al DetalleColapsable. `scroll-mt-6` compensa el salto del rail. La
        capa-1 vive FUERA del disclosure; solo el detalle colapsa (default cerrado).
      */}
      <section id="votos" className="mt-12 scroll-mt-6">
        <CarrilHeader titulo="Votaciones" conteo={conteoLabel(conteos.votos)} />
        <VotosCapa1
          breakdown={conteos.votosBreakdown}
          asistencia={conteos.asistencia}
        />
        {conteos.votos.tipo === "dato" && (
          <div className="mt-4">
            <DetalleColapsable n={conteos.votos.n}>
              <Suspense fallback={<VotosSkeleton />}>
                {/* Paginación server existente (?votosPage/?materia) intacta DENTRO
                    del disclosure — se conserva, no se duplica con un paginador
                    cliente en conflicto. */}
                <VotosSection id={id} searchParams={sp} />
              </Suspense>
            </DetalleColapsable>
          </div>
        )}
      </section>

      {/*
        Phase 11 — INT Lobby (§3.0). SIBLING de #votos, NUNCA anidada: el mt-12 es
        la frontera de carril (anti-insinuación §9.1). Una reunión de lobby y un
        voto JAMÁS comparten un <article>/<Card>/<li>.
      */}
      <section id="lobby" className="mt-12 scroll-mt-6">
        <CarrilHeader
          titulo="Reuniones de lobby"
          conteo={conteoLabel(conteos.lobby)}
        />
        <LobbyCapa1
          topMaterias={conteos.lobbyTopMaterias}
          total={conteos.lobby.tipo === "dato" ? conteos.lobby.n : 0}
        />
        {conteos.lobby.tipo === "dato" && (
          <div className="mt-4">
            <DetalleColapsable n={conteos.lobby.n}>
              <Suspense fallback={<LobbySkeleton />}>
                {/*
                  B10: el frame/intro de lobby refleja la cámara REAL del
                  parlamentario. El wrapper deriva `camara` del RPC público
                  `parlamentario_publico` (ya allowlisted). El enlace por fila
                  (fuente real) no se toca.
                */}
                <LobbySectionConCamara id={id} searchParams={sp} />
              </Suspense>
            </DetalleColapsable>
          </div>
        )}
      </section>

      {/*
        Phase 12 — INT Patrimonio/Intereses (§3.0). SIBLING de #lobby, NUNCA
        anidada. Una declaración y un voto/reunión JAMÁS comparten un
        <article>/<Card>/<li>/<tr>. Comparación SOLO-datos sin veredicto dentro del
        detalle (INT-04/05).
      */}
      <section id="patrimonio" className="mt-12 scroll-mt-6">
        <CarrilHeader
          titulo="Declaraciones de patrimonio e intereses"
          conteo={conteoLabel(conteos.patrimonio)}
        />
        <PatrimonioCapa1
          porDeclaracion={conteos.patrimonioPorDeclaracion}
          rangoAnios={conteos.rangoAnios}
        />
        {conteos.patrimonio.tipo === "dato" && (
          <div className="mt-4">
            <DetalleColapsable n={conteos.patrimonio.n}>
              <Suspense fallback={<PatrimonioSkeleton />}>
                <PatrimonioSection id={id} searchParams={sp} />
              </Suspense>
            </DetalleColapsable>
          </div>
        )}
      </section>

      {/*
        Phase 37 — SURF Cruces sector (SURF-01). SIBLING de #patrimonio, NUNCA
        anidada. Posición LOCKED: DESPUÉS de #patrimonio y ANTES de las secciones
        MONEY gated. GATE LOCKED (Candado B): TODA la <section id="cruces"> se
        envuelve en crucesPublicEnabled(process.env). Con OFF (default) el nodo
        entero está AUSENTE del HTML; NO se depende de que un hijo retorne null.
        crucesPublicEnabled es server-only (chokepoint WR-02). Con el gate OFF,
        `crucesSectores` llega `[]` y la sección no se renderiza (no se pinta una
        capa-1 vacía). La capa-1 `CrucesCapa1` es la ÚNICA superficie con petróleo
        (marco + h2). El CTA PRIMARIO petróleo "Explorar los N cruces" es el TRIGGER
        del DetalleColapsable de cruces (variante `primary`) — UN solo control que
        expande el detalle, no un anchor extra que sólo hacía scroll. ENCENDER el flag
        = Phase 39 (firma legal).
      */}
      {crucesPublicEnabled(process.env) && (
        <section id="cruces" className="mt-12 scroll-mt-6">
          <CrucesCapa1
            sectores={conteos.crucesSectores}
            conteo={conteoLabel(conteos.cruces)}
          />
          {conteos.cruces.tipo === "dato" && (
            <div id="cruces-detalle" className="mt-4 scroll-mt-6">
              <DetalleColapsable
                n={conteos.cruces.n}
                triggerVariant="primary"
                triggerLabel={`Explorar los ${conteos.cruces.n} cruces`}
              >
                <Suspense fallback={<CrucesSkeleton />}>
                  <CrucesSection id={id} />
                </Suspense>
              </DetalleColapsable>
            </div>
          )}
        </section>
      )}

      {/*
        Phase 14 — MONEY Contratos (UI-SPEC §Exposure Gate). SIBLING de
        #patrimonio, NUNCA anidada. GATE LOCKED: TODA la <section id="dinero"> se
        envuelve en moneyPublicEnabled(process.env). Con OFF (default) el nodo
        entero está AUSENTE del HTML. moneyPublicEnabled es server-only (chokepoint
        WR-02). WR-01: este header refleja SOLO contratos (`conteos.dineroContratos`),
        nunca el combinado. MONEY no tiene capa-1 (gated/future): cuando hay dato se
        colapsa el detalle, y cuando no, la sección muestra su empty-state honesto.
      */}
      {moneyPublicEnabled(process.env) && (
        <section id="dinero" className="mt-12 scroll-mt-6">
          <CarrilHeader
            titulo="Contratos del Estado asociados al RUT"
            conteo={conteoLabel(conteos.dineroContratos)}
          />
          {conteos.dineroContratos.tipo === "dato" ? (
            <div className="mt-4">
              <DetalleColapsable n={conteos.dineroContratos.n}>
                <Suspense fallback={<ContratosSkeleton />}>
                  <ContratosSection id={id} searchParams={sp} />
                </Suspense>
              </DetalleColapsable>
            </div>
          ) : (
            <Suspense fallback={<ContratosSkeleton />}>
              <ContratosSection id={id} searchParams={sp} />
            </Suspense>
          )}
        </section>
      )}

      {/*
        Phase 15 — MONEY Financiamiento (UI-SPEC §Exposure Gate). SIBLING de
        #dinero, NUNCA anidada. GATE LOCKED igual que #dinero. A1: el enlace al
        candidato es por NOMBRE confirmado (SERVEL no trae RUT), nunca por RUT.
      */}
      {moneyPublicEnabled(process.env) && (
        <section id="financiamiento" className="mt-12 scroll-mt-6">
          <CarrilHeader
            titulo="Aportes de campaña registrados en SERVEL"
            conteo={conteoLabel(conteos.dineroAportes)}
          />
          {conteos.dineroAportes.tipo === "dato" ? (
            <div className="mt-4">
              <DetalleColapsable n={conteos.dineroAportes.n}>
                <Suspense fallback={<FinanciamientoSkeleton />}>
                  {/*
                    `eleccionActual` se deriva del periodo PÚBLICO del parlamentario
                    para que el caveat ámbar de "candidatura anterior" pueda
                    dispararse contra datos reales.
                  */}
                  <FinanciamientoSectionConPeriodo id={id} searchParams={sp} />
                </Suspense>
              </DetalleColapsable>
            </div>
          ) : (
            <Suspense fallback={<FinanciamientoSkeleton />}>
              <FinanciamientoSectionConPeriodo id={id} searchParams={sp} />
            </Suspense>
          )}
        </section>
      )}

      {/*
        Phase 22 — honest-state MONEY (DESIGN-SYSTEM §7/§8.6). Cuando MONEY está OFF
        (default), en vez de SILENCIO el ciudadano ve que la sección existe y POR
        QUÉ aún no se muestra. MUTUAMENTE EXCLUYENTE con #dinero/#financiamiento
        (ON futuro). Este bloque NO toca Supabase, NO compone con un voto, NO
        menciona monto/contrato/donante — sólo el texto legal LOCKED. Carril propio
        mt-12 (SIBLING); `opacity-60` lo comunica como pendiente sin ocultarlo. El
        gate !moneyPublicEnabled y el texto legal se conservan VERBATIM.
      */}
      {!moneyPublicEnabled(process.env) && (
        <section
          id="financiamiento-pendiente"
          className="mt-12 scroll-mt-6 opacity-60"
        >
          <h2 className="text-xl font-semibold mb-2">
            Financiamiento y contratos del Estado
          </h2>
          <p className="text-sm text-muted-foreground">
            Pendiente de revisión legal (Ley 21.719) antes de publicarse.
          </p>
        </section>
      )}
    </>
  );
}

// ── Header de carril: <h2> + conteo 3-estado (SIEMPRE visible, fuera del detalle) ─
function CarrilHeader({
  titulo,
  conteo,
}: {
  titulo: string;
  conteo: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
      <h2 className="text-xl font-semibold">{titulo}</h2>
      <span className="text-sm text-muted-foreground">{conteo}</span>
    </div>
  );
}

// ── Wrapper B10 Lobby: deriva `camara` para parametrizar el frame de la fuente ──
// La cámara del parlamentario NO llega a LobbySection por props; vive en
// `parlamentario_publico.camara` (campo público, no sensible). La leemos aquí y la
// pasamos EXPLÍCITA a LobbySection para que el intro/empty-state atribuyan la
// fuente que corresponde (senado vs diputados). Espejo VERBATIM de
// FinanciamientoSectionConPeriodo: un error real de DB/red se lanza (#34), nunca se
// degrada; cámara ausente (null) → frame genérico honesto. El enlace por fila
// (fuente real) no se toca. CERO RPC nueva: `parlamentario_publico` ya allowlisted.
async function LobbySectionConCamara({
  id,
  searchParams,
}: {
  id: string;
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // WR-02: lectura deduplicada (React.cache) — misma fila que Header/Rail.
  const data = await getParlamentarioPublico(id);
  const camara = data?.camara ?? null;

  return (
    <LobbySection id={id} searchParams={searchParams} camara={camara} />
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
  // WR-02: lectura deduplicada (React.cache) — misma fila que Header/Rail/Lobby.
  const data = await getParlamentarioPublico(id);
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
// Exportada para RTL (53-03): prueba por comportamiento que la cabecera monta el
// breadcrumb con el nombre real del RPC cacheado (path RPC → ParlamentarioHeader →
// Breadcrumbs) sin RPC extra. Un named export arbitrario es ignorado por el router
// (espejo de CarrilesSection ya exportada).
export async function HeaderSection({ id }: { id: string }) {
  // WR-02: lectura deduplicada (React.cache) — misma fila que Rail/Lobby/Financiamiento.
  // #34: un error real de DB/red se lanza dentro del lector (UI de error honesta);
  // `.maybeSingle()` no lanza por 0 filas → data null = "no existe" → 404.
  const data = await getParlamentarioPublico(id);
  if (!data) {
    notFound();
  }

  return <ParlamentarioHeader parlamentario={data} />;
}

// ── Skeletons (UI-SPEC §6.2, anti-CLS IN-02/IN-03) ─────────────────────────────
// Rail: cabecera compacta (chip cámara + nombre + periodo) + 5 entradas de nav +
// caveat. Shape-matched a FichaRail para no producir layout shift al resolver.
function RailSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="space-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}

function ParlamentarioHeaderSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {/* Fila placeholder del breadcrumb (anti-CLS, IN-03): matchea la caja real
          del <Breadcrumbs> que hace stream-in encima del header. */}
      <Skeleton className="h-4 w-40" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-56 mt-4" />
    </div>
  );
}

// Shape-matched a la lista de carriles (UXCOG 55-03): por carril, un header
// (título + conteo) + un bloque de capa-1 (cifras/mini-visual) SIEMPRE visible —
// NO headers de acordeón (esa era la forma F45). Anti-CLS al swap.
function CarrilesSkeleton() {
  return (
    <div aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="mt-12 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-5 w-10" />
          </div>
          {/* Placeholder de capa-1: bloque de cifras preatentivas. */}
          <div className="flex gap-4">
            <Skeleton className="h-12 w-16" />
            <Skeleton className="h-12 w-16" />
            <Skeleton className="h-12 w-16" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
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
