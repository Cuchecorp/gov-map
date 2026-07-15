import Link from "next/link";

import { createServerSupabase } from "@/lib/supabase";
import { moneyPublicEnabled } from "@/lib/money-gate";
import { LEYENDA_ANTI_INSINUACION_MONEY } from "@/lib/money-presentacion";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { fechaCorta } from "@/lib/format";
import { sourceLabel, type AporteRpcRow } from "@/lib/types";

/**
 * Sección MONEY "Aportes de campaña registrados en SERVEL" de la ficha del
 * parlamentario (Phase 15, UI-SPEC §Layout). Es la CARA CIUDADANA de la fase y
 * vive entera detrás de `moneyPublicEnabled()` (default OFF) — doble candado con
 * la RLS deny-by-default del Plan 15-01. Espejo de `contratos-de-parlamentario.tsx`.
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ GATE DE CONTENIDO (UI-SPEC, reglas LOCKED de honestidad de Phase 15)         │
 * │                                                                             │
 * │ 1. REDACCIÓN: el heading es "Aportes de campaña registrados en SERVEL" —     │
 * │    NUNCA un posesivo ("del parlamentario"/"sus aportes"). La redacción es    │
 * │    un contrato de honestidad, no cosmética.                                 │
 * │ 2. TRES ESTADOS HONESTOS textualmente distintos: "no-ingestado" /            │
 * │    "verificado sin aportes" (con fecha de corte) / "enlazado". Un vacío      │
 * │    NUNCA se lee como "limpio"/"sin aportes ✓"/positivo. Ausencia de consulta │
 * │    ≠ ausencia de aportes.                                                   │
 * │ 3. PERIODO ELECTORAL: los aportes se AGRUPAN por elección (periodo DESC) y   │
 * │    cada fila lleva su propio `Elección:` (defense in depth). Un aporte de    │
 * │    una candidatura anterior lleva caveat ámbar de grupo y JAMÁS se atribuye  │
 * │    al mandato actual sin su periodo.                                        │
 * │ 4. DONANTE: el SUJETO es el donante (`Aporta:`); su RUT NUNCA se renderiza   │
 * │    (Ley 21.719). El enlace al candidato es una línea muted SEPARADA          │
 * │    ("Asociado por nombre confirmado al candidato.") — NUNCA "por RUT" (la    │
 * │    fuente SERVEL no trae RUT; el enlace fue adjudicado/auditado por NOMBRE,  │
 * │    Plan 15-02, RE-RESUELTO A1), NUNCA un posesivo, NUNCA fusionar donante +  │
 * │    candidato en una atribución personal.                                    │
 * │ 5. ATRIBUCIÓN SERVEL = "términos de uso por verificar" (NO CC BY 4.0).       │
 * │    ProvenanceBadge por fila + fecha de corte por fila.                      │
 * │ 6. CERO cómputo: el UI no suma montos, no rankea, no calcula %. Montos       │
 * │    literales verbatim. Sin rojo/verde de severidad — ámbar SOLO frescura +  │
 * │    el caveat "periodo anterior".                                            │
 * │ 7. #34: un error real de RPC se LANZA (route boundary), nunca degrada a      │
 * │    "sin aportes".                                                           │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * `FinanciamientoView` es PURO (props) → RTL lo testea con fixtures, sin runtime
 * Supabase/Next. `FinanciamientoSection` es el Server Component que aplica el gate,
 * lee el RPC y el marcador de ingesta. NO hay `"use client"` en este archivo.
 */

const PAGE_SIZE = 20;

/** Los tres estados honestos derivados server-side (UI-SPEC §States). */
export type FinanciamientoEstado =
  | "no_ingestado"
  | "verificado_sin_aportes"
  | "enlazado";

/** Una fila de aporte lista para mostrar (sujeto = donante). */
export interface AporteRow {
  /** Identidad estable de la fila para `key` (PK compuesta en la DB). */
  fila_id: string;
  /** Elección/periodo verbatim — load-bearing, NON-NULL: agrupa + se rotula por fila. */
  eleccion: string;
  // El RPC puede devolver null (columnas nullable en la DB) → fallbacks honestos
  // en vez de crashear / mostrar celdas vacías.
  donante_nombre: string | null;
  tipo_persona: string | null;
  monto: string | null;
  fecha_aporte: string | null;
  tipo_aporte: string | null;
  origen: string;
  fecha_captura: string;
  fecha_corte: string;
  enlace: string;
}

// ── Datos que la vista necesita (forma pura, testeable) ────────────────────────
export interface FinanciamientoViewData {
  id: string;
  /** Estado honesto derivado server-side. */
  estado: FinanciamientoEstado;
  /** Aportes de la página actual (ya paginados), orden elección DESC / fecha DESC. */
  aportes: AporteRow[];
  /** Total de aportes enlazados (para "Página N de M" y el conteo neutro). */
  totalAportes: number;
  page: number;
  totalPages: number;
  /**
   * Fecha de corte de la consulta (para el estado "verificado sin aportes").
   * `null` si no hay marcador (estado "no ingestado").
   */
  fechaCorte: string | null;
  /**
   * Periodo/elección del mandato actual, si es derivable. Cuando es no-null, un
   * grupo cuya `eleccion` no coincide se marca como candidatura anterior (caveat
   * ámbar). Si es `null` (no derivable), NO se afirma un periodo anterior (la
   * heurística es conservadora: nunca etiqueta de más).
   */
  eleccionActual: string | null;
}

/**
 * Encabezado de grupo de elección, SIN duplicar la palabra "Elección".
 *
 * El valor verbatim del RPC (`g.eleccion`) a veces YA empieza con "Elección"
 * ("Elección 2021") y a veces NO ("DIPUTADO - DISTRITO 23 - 2021"). Antes el UI
 * prefijaba "Elección " siempre → "Elección Elección 2021" (defecto visual).
 *
 * Regla: si el valor verbatim ya empieza con "Elección"/"ELECCIÓN" (case- y
 * accent-tolerant), se renderiza TAL CUAL (verbatim, sin tocar). Si NO empieza
 * así, se prefija "Elección " para que el encabezado siga leyéndose como el de
 * una elección. En ningún caso se altera el contenido del valor verbatim.
 */
// Empieza (ignorando espacios iniciales) con la palabra "elección"/"eleccion"
// en cualquier caja y con o sin tilde. Solo necesitamos los dos códepoints de la
// "o"/"ó" (U+006F / U+00F3), evitando rangos de marcas combinantes invisibles.
const YA_PREFIJA_ELECCION = /^\s*elecci[oó]n/i;

function encabezadoEleccion(eleccion: string): string {
  // Si el verbatim ya trae la palabra "Elección", se muestra TAL CUAL (sin
  // duplicar). Si no, se prefija para que el encabezado lea como una elección.
  if (YA_PREFIJA_ELECCION.test(eleccion)) {
    return eleccion;
  }
  return `Elección ${eleccion}`;
}

/** Construye un href de paginación preservando el resto de la query. */
function buildHref(id: string, page: number): string {
  const qs = new URLSearchParams({ financiamientoPage: String(page) }).toString();
  return `/parlamentario/${id}?${qs}#financiamiento`;
}

// ── Leyenda anti-insinuación MONEY (MONEY-04, UI-SPEC §Leyenda) ─────────────────
// Primer hijo de CADA rama de estado, ENCIMA del Intro. Constante ÚNICA importada
// (nunca inline duplicada) — la misma leyenda de las 4 superficies MONEY. Base NOMBRE
// aquí: el enlace del aporte JAMÁS se rotula "por RUT" (eso vive sólo en la leyenda
// general, que habla del "vínculo por RUT" como concepto — no del enlace de ESTE aporte).
function LeyendaMoney() {
  return (
    <p className="text-sm text-muted-foreground border-l-[3px] border-[var(--primary)] pl-2.5 mb-4">
      {LEYENDA_ANTI_INSINUACION_MONEY}
    </p>
  );
}

// ── Intro honesta (frame + atribución SERVEL "términos por verificar") ──────────
// HONESTIDAD DEL ENLACE (RE-RESUELTO A1): SERVEL no trae RUT; el aporte se ASOCIA
// AL CANDIDATO POR SU NOMBRE (identidad confirmada contra la maestra). El intro lo
// dice así — NUNCA "por RUT exacto" (la base del match cambió respecto del UI-SPEC).
function Intro() {
  return (
    <div className="mb-4 space-y-1">
      <p className="text-sm text-muted-foreground">
        Aportes a campañas electorales registrados por el Servicio Electoral
        (SERVEL), asociados a este candidato por su nombre, con identidad
        confirmada contra la maestra. Se muestran tal como los publica la fuente;
        la asociación no implica juicio sobre el aporte ni sobre quien aporta.
      </p>
      <p className="text-sm text-muted-foreground">
        Fuente: SERVEL — Aportes de campaña (términos de uso por verificar). Cada
        aporte se muestra con su elección/periodo, fecha y enlace.
      </p>
    </div>
  );
}

// ── Una fila de aporte: SUJETO = donante, enlace al candidato en línea SEPARADA ──
function AporteFila({ a }: { a: AporteRow }) {
  const captured = a.fecha_captura ? new Date(a.fecha_captura) : null;
  // `tipo_persona` puede ser null → guardar antes de `.toLowerCase()` (no crashear la fila).
  const tipoPersona = (a.tipo_persona ?? "").toLowerCase();
  const esJuridica = tipoPersona.includes("jur");
  const donanteTexto = a.donante_nombre ?? "Donante no publicado";
  const fechaAporteTexto = a.fecha_aporte
    ? fechaCorta(new Date(a.fecha_aporte))
    : "Fecha no publicada";
  const fechaCorteTexto = a.fecha_corte
    ? fechaCorta(new Date(a.fecha_corte))
    : null;

  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-2 py-4 border-t first:border-t-0">
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        {/* SUJETO = el donante (text-base, el elemento prominente). El RUT del
            donante NUNCA se renderiza (Ley 21.719). */}
        <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-base">Aporta: {donanteTexto}</span>
          <span className="text-sm text-muted-foreground">
            ({esJuridica ? "persona jurídica" : "persona natural"})
          </span>
        </span>

        {/*
          El enlace al candidato es una línea muted SEPARADA — POR NOMBRE
          CONFIRMADO (la fuente no trae RUT; el enlace fue adjudicado/auditado por
          NOMBRE, Plan 15-02, RE-RESUELTO A1). NUNCA "por RUT", NUNCA un posesivo,
          NUNCA fusionada con el donante en una atribución personal.
        */}
        <span className="text-sm text-muted-foreground">
          Asociado por nombre confirmado al candidato.
        </span>

        {/*
          Campos LITERALES del aporte como NOUN-label + valor verbatim (<dl>).
          `Elección:` es LOAD-BEARING y SIEMPRE presente (defense in depth): una
          fila sacada de contexto sigue mostrando su periodo. El UI NO computa nada.
        */}
        <dl className="grid grid-cols-1 gap-1 sm:grid-cols-[max-content_1fr] sm:gap-x-4 mt-1">
          <dt className="text-sm text-muted-foreground">Elección:</dt>
          <dd className="text-base">{a.eleccion}</dd>
          <dt className="text-sm text-muted-foreground">Fecha del aporte:</dt>
          <dd className="text-base font-mono">{fechaAporteTexto}</dd>
          <dt className="text-sm text-muted-foreground">Monto:</dt>
          <dd className="text-base font-mono">{a.monto ?? "No publicado"}</dd>
          <dt className="text-sm text-muted-foreground">Tipo de aporte:</dt>
          <dd className="text-base">{a.tipo_aporte ?? "No publicado"}</dd>
        </dl>

        {/* Fecha de corte por fila, distinta de la fecha de captura. NO "por RUT". */}
        {fechaCorteTexto && (
          <span className="text-sm text-muted-foreground">
            Consultado por nombre del candidato, corte al{" "}
            <span className="font-mono">{fechaCorteTexto}</span>.
          </span>
        )}
      </div>

      {/* ProvenanceBadge por fila, obligatorio; ámbar = frescura, nunca juicio. */}
      <span className="ml-auto">
        <ProvenanceBadge
          capturedAt={captured}
          sourceName={sourceLabel(a.origen)}
          sourceUrl={a.enlace}
        />
      </span>
    </li>
  );
}

/** Un grupo de aportes de una misma elección (UI-SPEC §Layout — period treatment). */
interface GrupoEleccion {
  eleccion: string;
  aportes: AporteRow[];
  /** true → candidatura anterior al mandato actual: caveat ámbar de grupo. */
  esAnterior: boolean;
}

/** Extrae el último año de 4 dígitos (19xx/20xx) de un string, o null. */
function extraerAnio(s: string | null): number | null {
  if (!s) return null;
  const matches = s.match(/\b(19|20)\d{2}\b/g);
  if (!matches || matches.length === 0) return null;
  // El año MÁS RECIENTE del string (un rango "2022-2026" → 2026).
  return Math.max(...matches.map((m) => Number.parseInt(m, 10)));
}

/**
 * ¿El grupo `eleccion` corresponde a una candidatura ANTERIOR a `eleccionActual`?
 *
 * Heurística CONSERVADORA (nunca etiqueta de más): solo devuelve true cuando
 * conocemos el mandato actual Y podemos compararlo con confianza. Dos caminos:
 *   1. Coincidencia/diferencia textual exacta del verbatim (cuando ambos son el
 *      mismo tipo de string, p.ej. "Elección 2021" vs "Elección 2017").
 *   2. Comparación por AÑO: si de ambos lados se extrae un año de 4 dígitos y el
 *      del grupo es ESTRICTAMENTE menor al del mandato actual → anterior. Esto
 *      tolera formatos distintos ("Elección 2017" del aporte vs "2022-2026" del
 *      periodo del parlamentario).
 * Si `eleccionActual` es null, o no se puede extraer año de algún lado y los
 * strings no son comparables, NO se marca anterior (defense in depth: el
 * `Elección:` por fila ya impide atribuir un aporte previo al mandato actual).
 */
function esGrupoAnterior(
  eleccion: string,
  eleccionActual: string | null,
): boolean {
  if (eleccionActual === null) return false;
  // Camino 1: verbatim idéntico → es el mandato actual, NO anterior.
  if (eleccion === eleccionActual) return false;
  // Camino 2: comparación por año (estrictamente menor = anterior).
  const anioGrupo = extraerAnio(eleccion);
  const anioActual = extraerAnio(eleccionActual);
  if (anioGrupo !== null && anioActual !== null) {
    return anioGrupo < anioActual;
  }
  // No comparable por año: solo marcar anterior si el verbatim difiere Y el
  // actual no aporta año (preserva el comportamiento textual previo de fixtures
  // donde ambos lados son el mismo formato "Elección YYYY").
  if (anioGrupo === null && anioActual === null) {
    return eleccion !== eleccionActual;
  }
  // Un lado tiene año y el otro no → no comparable con confianza → conservador.
  return false;
}

/**
 * Agrupa los aportes (ya ordenados elección DESC / fecha DESC por el RPC) por
 * `eleccion`, preservando el orden. Marca como anterior todo grupo cuya elección
 * precede a `eleccionActual` (ver `esGrupoAnterior`) — SOLO cuando `eleccionActual`
 * es derivable (no-null). Heurística conservadora: si no conocemos el periodo del
 * mandato actual, NO afirmamos que un grupo sea "anterior" (nunca etiqueta de más).
 */
function agruparPorEleccion(
  aportes: AporteRow[],
  eleccionActual: string | null,
): GrupoEleccion[] {
  const grupos: GrupoEleccion[] = [];
  for (const a of aportes) {
    let grupo = grupos.find((g) => g.eleccion === a.eleccion);
    if (!grupo) {
      grupo = {
        eleccion: a.eleccion,
        aportes: [],
        esAnterior: esGrupoAnterior(a.eleccion, eleccionActual),
      };
      grupos.push(grupo);
    }
    grupo.aportes.push(a);
  }
  return grupos;
}

// ── Vista pura (RTL la testea con fixtures) ────────────────────────────────────
export function FinanciamientoView({ data }: { data: FinanciamientoViewData }) {
  const {
    id,
    estado,
    aportes,
    totalAportes,
    page,
    totalPages,
    fechaCorte,
    eleccionActual,
  } = data;

  // Estado — No ingestado: NUNCA se lee como "limpio"/"sin aportes".
  if (estado === "no_ingestado") {
    return (
      <>
        <LeyendaMoney />
        <Intro />
        <p className="text-sm text-muted-foreground">
          Aún no hemos ingerido los aportes de campaña de este candidato desde
          SERVEL. Esto no significa que no existan aportes — los datos de SERVEL
          se están incorporando.
        </p>
      </>
    );
  }

  // Estado — Verificado sin aportes: con fecha de corte, distinto del anterior.
  // NO "por el RUT de este candidato" (la fuente no tiene RUT) → "por este candidato".
  if (estado === "verificado_sin_aportes") {
    const fechaTexto = fechaCorte
      ? fechaCorta(new Date(fechaCorte))
      : "la fecha de corte";
    return (
      <>
        <LeyendaMoney />
        <Intro />
        <p className="text-sm text-muted-foreground">
          Consultamos SERVEL por este candidato (corte al{" "}
          <span className="font-mono">{fechaTexto}</span>) y no se registran
          aportes asociados a ese candidato a esa fecha.
        </p>
      </>
    );
  }

  // Estado — Enlazado: conteo neutro + lista AGRUPADA por elección + paginación.
  const grupos = agruparPorEleccion(aportes, eleccionActual);
  return (
    <div>
      <LeyendaMoney />
      <Intro />

      {/* Conteo NEUTRO (único agregado permitido) — sin suma de montos, sin ranking. */}
      <p className="text-sm text-muted-foreground mb-4">
        {totalAportes}{" "}
        {totalAportes === 1 ? "aporte registrado" : "aportes registrados"}.
      </p>

      <ul>
        {grupos.map((g) => (
          <li key={g.eleccion} className="mt-6 first:mt-0">
            {/* Header de grupo: la elección/periodo (mono). El verbatim ya suele
                traer "Elección"; `encabezadoEleccion` evita duplicar la palabra. */}
            <h3 className="text-sm font-semibold font-mono mb-1">
              {encabezadoEleccion(g.eleccion)}
            </h3>

            {/*
              Caveat de candidatura anterior (ámbar = SOLO frescura/caveat, jamás
              severidad), una vez por grupo de periodo anterior: un aporte previo
              JAMÁS se atribuye al mandato actual sin su periodo.
            */}
            {g.esAnterior && (
              <p className="text-sm text-amber-700 mb-2">
                Aporte de una candidatura anterior ({g.eleccion}). No corresponde
                al mandato actual.
              </p>
            )}

            <ul>
              {g.aportes.map((a) => (
                <AporteFila key={a.fila_id} a={a} />
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <nav
          className="flex items-center justify-between gap-4 mt-4 text-sm"
          aria-label="Paginación de aportes"
        >
          {page > 1 ? (
            <Link
              href={buildHref(id, page - 1)}
              className="text-primary underline underline-offset-2 inline-flex items-center min-h-[44px]"
            >
              Anteriores
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
          <span className="text-muted-foreground font-mono">
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={buildHref(id, page + 1)}
              className="text-primary underline underline-offset-2 inline-flex items-center min-h-[44px]"
            >
              Siguientes
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
        </nav>
      )}
    </div>
  );
}

/** Marcador de ingesta por parlamentario (Plan 15-01), leído vía `.maybeSingle()`. */
interface AportesIngestaEstado {
  parlamentario_id: string;
  ingestado_hasta: string | null;
  fecha_captura: string;
}

// ── Server Component: gate → RPC → marcador → FinanciamientoView ─────────────────
export async function FinanciamientoSection({
  id,
  searchParams,
  /**
   * Periodo/elección del mandato ACTUAL del parlamentario, provisto por la página
   * (derivado de `ParlamentarioPublicoRow.periodo`, ya público). Cuando es no-null
   * y comparable, un grupo cuya elección lo precede recibe el caveat ámbar de
   * candidatura anterior. `undefined`/`null` (default) → conservador: ningún grupo
   * se etiqueta "anterior" (el `Elección:` por fila sigue siendo la defensa activa).
   */
  eleccionActual = null,
}: {
  id: string;
  searchParams: { [key: string]: string | string[] | undefined };
  eleccionActual?: string | null;
}) {
  // Candado de presentación (WR-02): SIEMPRE vía moneyPublicEnabled(), nunca el
  // env crudo. OFF (default) → sin DOM, sin lectura de Supabase. Doble candado con
  // la RLS deny-by-default del Plan 15-01.
  if (!moneyPublicEnabled(process.env)) {
    return null;
  }

  const sb = createServerSupabase();

  const rawPage = Array.isArray(searchParams.financiamientoPage)
    ? searchParams.financiamientoPage[0]
    : searchParams.financiamientoPage;
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);

  // Aportes enlazados por NOMBRE confirmado del candidato (el RPC ya filtra por
  // p_id, orden elección DESC / fecha DESC). El RPC NUNCA proyecta RUT de donante.
  const { data: rpcData, error: rpcError } = await sb.rpc(
    "aportes_de_parlamentario",
    { p_id: id },
  );
  // #34: error real de DB/red ≠ "sin aportes". Se lanza → UI de error honesta.
  if (rpcError) {
    throw new Error(
      `aportes_de_parlamentario falló para ${id}: ${rpcError.message}`,
    );
  }
  const filas = (rpcData as AporteRpcRow[] | null) ?? [];
  const todos: AporteRow[] = filas.map((f, i) => ({
    // PK compuesta (fuente_id, fecha_corte) no se proyecta; un índice estable por
    // posición basta para `key` dentro del render ordenado del RPC.
    fila_id: `${f.eleccion}#${f.fecha_aporte ?? ""}#${i}`,
    eleccion: f.eleccion,
    donante_nombre: f.donante_nombre,
    tipo_persona: f.tipo_persona,
    monto: f.monto,
    fecha_aporte: f.fecha_aporte,
    tipo_aporte: f.tipo_aporte,
    origen: f.origen,
    fecha_captura: f.fecha_captura,
    fecha_corte: f.fecha_corte,
    enlace: f.enlace,
  }));

  // Marcador de ingesta: AUSENCIA de fila = "no ingestado"; presencia + 0 filas =
  // "verificado sin aportes"; +filas = "enlazado".
  const { data: estadoData, error: estadoError } = await sb
    .from("aportes_ingesta_estado")
    .select("parlamentario_id, ingestado_hasta, fecha_captura")
    .eq("parlamentario_id", id)
    .maybeSingle<AportesIngestaEstado>();
  if (estadoError) {
    throw new Error(
      `aportes_ingesta_estado falló para ${id}: ${estadoError.message}`,
    );
  }

  // Derivación de los tres estados honestos (server-side).
  let estado: FinanciamientoEstado;
  if (todos.length > 0) {
    estado = "enlazado";
  } else if (estadoData === null) {
    estado = "no_ingestado";
  } else {
    estado = "verificado_sin_aportes";
  }

  // Fecha de corte para el estado "verificado sin aportes".
  const fechaCorte = estadoData?.ingestado_hasta ?? null;

  // Periodo del mandato actual: lo provee la página desde
  // `ParlamentarioPublicoRow.periodo` (público). Si llega null/undefined, la
  // heurística es conservadora → ningún grupo se etiqueta "anterior". El
  // `Elección:` por fila (defense in depth) ya impide atribuir un aporte previo
  // al mandato actual aunque el periodo no se conozca.

  // Paginación server-driven sobre el conjunto ya cargado.
  const totalAportes = todos.length;
  const totalPages = Math.max(1, Math.ceil(totalAportes / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const start = (pageClamped - 1) * PAGE_SIZE;
  const aportes = todos.slice(start, start + PAGE_SIZE);

  return (
    <FinanciamientoView
      data={{
        id,
        estado,
        aportes,
        totalAportes,
        page: pageClamped,
        totalPages,
        fechaCorte,
        eleccionActual,
      }}
    />
  );
}
