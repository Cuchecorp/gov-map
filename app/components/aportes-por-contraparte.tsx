import Link from "next/link";

import { createServerSupabase } from "@/lib/supabase";
import { moneyPublicEnabled } from "@/lib/money-gate";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { fechaCorta } from "@/lib/format";
import {
  sourceLabel,
  type AgregadoContraparteRpcRow,
  type AporteRpcRow,
} from "@/lib/types";

/**
 * Carril MONEY "Aportes de campaña registrados a nombre de esta empresa" de la
 * página `/contraparte/[id]` (Phase 16, 16-UI-SPEC §Page Anatomy). Es el segundo de
 * DOS carriles hermanos (contratos / aportes) separados por `mt-12` — la frontera de
 * carril es la regla dura ANTI-INSINUACIÓN: una contraparte de dinero y un voto JAMÁS
 * comparten una unidad de UI; esta página NO renderiza datos de voto. Espejo de
 * `financiamiento-de-parlamentario.tsx`, cambiando el SUJETO (la empresa = sujeto de
 * página, donante) y dispatcheando el RPC `agregado_por_contraparte` por `facet`.
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ GATE DE CONTENIDO (16-UI-SPEC, reglas LOCKED de honestidad de Phase 16)      │
 * │                                                                             │
 * │ 1. SUJETO = la empresa donante = sujeto de página; su llave/identificador    │
 * │    tributario NUNCA se renderiza (Ley 21.719; el RPC no lo proyecta). El      │
 * │    candidato receptor se muestra como hecho muted SEPARADO, jamás fusionado.  │
 * │ 2. TRES ESTADOS HONESTOS textualmente distintos: "no consultado" /           │
 * │    "consultado sin aportes" / "con aportes". Un vacío NUNCA se lee "limpio".  │
 * │ 3. PERIODO: los aportes se AGRUPAN por elección (DESC) y cada fila lleva su   │
 * │    propio `Elección:` (defensa en profundidad).                             │
 * │ 4. ATRIBUCIÓN SERVEL = "términos de uso por verificar" (NO una licencia CC-BY).│
 * │    ProvenanceBadge por fila + fecha de corte por fila.                      │
 * │ 5. CERO cómputo: el UI no suma montos, no rankea, no calcula %. El único      │
 * │    agregado es el CONTEO neutral. Montos verbatim o "No publicado".         │
 * │ 6. CERO insinuación: sin lenguaje causal/afinidad, sin datos de voto.        │
 * │ 7. #34: un error real de RPC se LANZA (route boundary), nunca degrada a       │
 * │    "sin aportes".                                                           │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * `AportesPorContraparteView` es PURO (props) → RTL lo testea con fixtures.
 * `AportesPorContraparteSection` es el Server Component: gate (defensa en profundidad)
 * → RPC → dispatch por faceta. NO hay `"use client"` en este archivo.
 */

const PAGE_SIZE = 20;

/** Los tres estados honestos derivados server-side (16-UI-SPEC §Honest States). */
export type AportesContraparteEstado =
  | "no_consultado"
  | "consultado_sin_aportes"
  | "con_aportes";

/** Una fila de aporte lista para mostrar (sujeto de página = la empresa donante). */
export interface AporteContraparteRow {
  /** Identidad estable de la fila para `key`. */
  fila_id: string;
  /** Elección/periodo verbatim — load-bearing, NON-NULL: agrupa + se rotula por fila. */
  eleccion: string;
  // El RPC puede devolver null (columnas nullable) → fallbacks honestos.
  donante_nombre: string | null;
  tipo_persona: string | null;
  monto: string | null;
  fecha_aporte: string | null;
  tipo_aporte: string | null;
  /** Candidato receptor verbatim (hecho muted SEPARADO; nunca fusionado con voto). */
  candidato_nombre_verbatim: string | null;
  origen: string;
  fecha_captura: string;
  fecha_corte: string;
  enlace: string;
}

// ── Datos que la vista necesita (forma pura, testeable) ────────────────────────
export interface AportesPorContraparteViewData {
  id: string;
  /** Estado honesto derivado server-side. */
  estado: AportesContraparteEstado;
  /** Aportes de la página actual (ya paginados), orden elección DESC / fecha DESC. */
  aportes: AporteContraparteRow[];
  /** Total de aportes (para "Página N de M" y el conteo neutral). */
  totalAportes: number;
  page: number;
  totalPages: number;
  /**
   * Fecha de corte de la consulta (para "consultado sin aportes"). `null` si no hay
   * marcador (estado "no consultado").
   */
  fechaCorte: string | null;
}

// Empieza (ignorando espacios) con "elección"/"eleccion" en cualquier caja, con o
// sin tilde — evita duplicar "Elección Elección 2021" cuando el verbatim ya la trae.
const YA_PREFIJA_ELECCION = /^\s*elecci[oó]n/i;

function encabezadoEleccion(eleccion: string): string {
  if (YA_PREFIJA_ELECCION.test(eleccion)) {
    return eleccion;
  }
  return `Elección ${eleccion}`;
}

/** Construye un href de paginación del carril aportes preservando el ancla. */
function buildHref(id: string, page: number): string {
  const qs = new URLSearchParams({ aportesPage: String(page) }).toString();
  return `/contraparte/${encodeURIComponent(id)}?${qs}#aportes`;
}

// ── Intro honesta (frame + atribución SERVEL "términos de uso por verificar") ───
function Intro() {
  return (
    <div className="mb-4 space-y-1">
      <p className="text-sm text-muted-foreground">
        Aportes a campañas electorales registrados por SERVEL a nombre de esta
        empresa. Se muestran tal como los publica la fuente; la asociación no implica
        juicio.
      </p>
      <p className="text-sm text-muted-foreground">
        Fuente: SERVEL — Aportes de campaña (términos de uso por verificar).
      </p>
    </div>
  );
}

// ── Una fila de aporte: el candidato receptor es un hecho muted SEPARADO ─────────
function AporteFila({ a }: { a: AporteContraparteRow }) {
  const captured = a.fecha_captura ? new Date(a.fecha_captura) : null;
  const fechaAporteTexto = a.fecha_aporte
    ? fechaCorta(new Date(a.fecha_aporte))
    : "Fecha no publicada";
  const fechaCorteTexto = a.fecha_corte
    ? fechaCorta(new Date(a.fecha_corte))
    : null;

  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-2 py-4 border-t first:border-t-0">
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        {/*
          El candidato receptor es una línea muted SEPARADA — registrado verbatim,
          jamás fusionado con un voto ni con una atribución personal. El
          identificador tributario del donante (la empresa) NUNCA se renderiza.
        */}
        {a.candidato_nombre_verbatim && (
          <span className="text-sm text-muted-foreground">
            Registrado a la campaña de {a.candidato_nombre_verbatim}.
          </span>
        )}

        {/*
          Campos LITERALES del aporte como NOUN-label + valor verbatim (<dl>).
          `Elección:` es LOAD-BEARING y SIEMPRE presente (defensa en profundidad).
          El UI NO computa nada.
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

        {/* Fecha de corte por fila, distinta de la fecha de captura. */}
        {fechaCorteTexto && (
          <span className="text-sm text-muted-foreground">
            Consolidado, corte al{" "}
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

/** Un grupo de aportes de una misma elección (16-UI-SPEC §Row Layout). */
interface GrupoEleccion {
  eleccion: string;
  aportes: AporteContraparteRow[];
}

/**
 * Agrupa los aportes (ya ordenados elección DESC / fecha DESC por el RPC) por
 * `eleccion`, preservando el orden. No hay caveat de "candidatura anterior" aquí: el
 * sujeto de página es la empresa, no un candidato — pero el periodo SIEMPRE se muestra.
 */
function agruparPorEleccion(aportes: AporteContraparteRow[]): GrupoEleccion[] {
  const grupos: GrupoEleccion[] = [];
  for (const a of aportes) {
    let grupo = grupos.find((g) => g.eleccion === a.eleccion);
    if (!grupo) {
      grupo = { eleccion: a.eleccion, aportes: [] };
      grupos.push(grupo);
    }
    grupo.aportes.push(a);
  }
  return grupos;
}

// ── Vista pura (RTL la testea con fixtures) ────────────────────────────────────
export function AportesPorContraparteView({
  data,
}: {
  data: AportesPorContraparteViewData;
}) {
  const { id, estado, aportes, totalAportes, page, totalPages, fechaCorte } = data;

  // Estado — No consultado: NUNCA se lee como "limpio"/"sin aportes".
  if (estado === "no_consultado") {
    return (
      <>
        <Intro />
        <p className="text-sm text-muted-foreground">
          Aún no hemos consolidado los aportes de SERVEL para esta empresa. Esto no
          significa que no existan.
        </p>
      </>
    );
  }

  // Estado — Consultado sin aportes: con fecha de corte, distinto del anterior.
  if (estado === "consultado_sin_aportes") {
    const fechaTexto = fechaCorte
      ? fechaCorta(new Date(fechaCorte))
      : "la fecha de corte";
    return (
      <>
        <Intro />
        <p className="text-sm text-muted-foreground">
          Revisamos SERVEL para esta empresa (corte al{" "}
          <span className="font-mono">{fechaTexto}</span>) y no se registran aportes
          a esa fecha.
        </p>
      </>
    );
  }

  // Estado — Con aportes: conteo neutral + lista AGRUPADA por elección + paginación.
  const grupos = agruparPorEleccion(aportes);
  return (
    <div>
      <Intro />

      {/* Conteo NEUTRAL (único agregado permitido) — sin suma de montos, sin ranking. */}
      <p className="text-sm text-muted-foreground mb-4">
        {totalAportes}{" "}
        {totalAportes === 1 ? "aporte registrado" : "aportes registrados"}.
      </p>

      <ul>
        {grupos.map((g) => (
          <li key={g.eleccion} className="mt-6 first:mt-0">
            <h3 className="text-sm font-semibold font-mono mb-1">
              {encabezadoEleccion(g.eleccion)}
            </h3>
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

// ── Server Component: gate → RPC (faceta aportes) → AportesView ─────────────────
export async function AportesPorContraparteSection({
  id,
  searchParams,
}: {
  id: string;
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Candado de presentación (WR-02): SIEMPRE vía moneyPublicEnabled(). OFF (default)
  // → sin DOM. Defensa en profundidad: la página ya 404 entera con OFF.
  if (!moneyPublicEnabled(process.env)) {
    return null;
  }

  const sb = createServerSupabase();

  const rawPage = Array.isArray(searchParams.aportesPage)
    ? searchParams.aportesPage[0]
    : searchParams.aportesPage;
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);

  // RPC agregador, jurídica-only, prefix-dispatched por el id ('d:' → aportes).
  const { data: rpcData, error: rpcError } = await sb.rpc(
    "agregado_por_contraparte",
    { p_id: id },
  );
  // #34: error real de DB/red != "sin aportes". Se lanza → UI de error honesta.
  if (rpcError) {
    throw new Error(
      `agregado_por_contraparte falló para ${id}: ${rpcError.message}`,
    );
  }

  const agregados = (rpcData as AgregadoContraparteRpcRow[] | null) ?? [];
  const facetaAportes = agregados.find((a) => a.facet === "aporte") ?? null;

  const filasRaw = (facetaAportes?.filas as AporteRpcRow[] | undefined) ?? [];
  const todos: AporteContraparteRow[] = filasRaw.map((f, i) => ({
    fila_id: `${f.eleccion}#${f.fecha_aporte ?? ""}#${i}`,
    eleccion: f.eleccion,
    donante_nombre: f.donante_nombre,
    tipo_persona: f.tipo_persona,
    monto: f.monto,
    fecha_aporte: f.fecha_aporte,
    tipo_aporte: f.tipo_aporte,
    candidato_nombre_verbatim: f.candidato_nombre_verbatim,
    origen: f.origen,
    fecha_captura: f.fecha_captura,
    fecha_corte: f.fecha_corte,
    enlace: f.enlace,
  }));

  // Derivación de los tres estados honestos (server-side).
  let estado: AportesContraparteEstado;
  if (todos.length > 0) {
    estado = "con_aportes";
  } else if (facetaAportes === null) {
    estado = "no_consultado";
  } else {
    estado = "consultado_sin_aportes";
  }

  const fechaCorte = todos[0]?.fecha_corte ?? null;

  // Paginación server-driven sobre el conjunto ya cargado.
  const totalAportes = todos.length;
  const totalPages = Math.max(1, Math.ceil(totalAportes / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const start = (pageClamped - 1) * PAGE_SIZE;
  const aportes = todos.slice(start, start + PAGE_SIZE);

  return (
    <AportesPorContraparteView
      data={{
        id,
        estado,
        aportes,
        totalAportes,
        page: pageClamped,
        totalPages,
        fechaCorte,
      }}
    />
  );
}
