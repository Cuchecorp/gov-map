import Link from "next/link";

import { createServerSupabase } from "@/lib/supabase";
import { moneyPublicEnabled } from "@/lib/money-gate";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { fechaCorta } from "@/lib/format";
import {
  sourceLabel,
  type AgregadoContraparteRpcRow,
  type ContratoRpcRow,
} from "@/lib/types";

/**
 * Carril MONEY "Contratos del Estado en que aparece esta empresa" de la página
 * `/contraparte/[id]` (Phase 16, 16-UI-SPEC §Page Anatomy). Es uno de DOS carriles
 * hermanos (contratos / aportes) separados por `mt-12` — la frontera de carril es la
 * regla dura ANTI-INSINUACIÓN: una contraparte de dinero y un voto JAMÁS comparten una
 * unidad de UI; esta página NO renderiza datos de voto en ninguna parte. Espejo de
 * `contratos-de-parlamentario.tsx`, cambiando el SUJETO (la empresa = sujeto de página)
 * y dispatcheando el RPC `agregado_por_contraparte` por `facet`.
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ GATE DE CONTENIDO (16-UI-SPEC, reglas LOCKED de honestidad de Phase 16)      │
 * │                                                                             │
 * │ 1. SUJETO = la empresa (jurídica) = sujeto de página; la fila foregrounda el │
 * │    hecho del lado contraparte (organismo comprador), nunca un posesivo que   │
 * │    ate el contrato a una persona.                                           │
 * │ 2. TRES ESTADOS HONESTOS textualmente distintos: "no consultado" /           │
 * │    "consultado sin contratos" / "con contratos". Un vacío NUNCA se lee como  │
 * │    "limpio"/"sin contratos ✓". Ausencia de consulta != ausencia de hechos.  │
 * │ 3. ATRIBUCIÓN ChileCompra = "mención de la fuente" (NO una licencia CC-BY).  │
 * │    ProvenanceBadge por fila + fecha de corte por fila.                      │
 * │ 4. CERO cómputo: el UI no suma montos, no rankea, no calcula %. El único     │
 * │    agregado es el CONTEO neutral. Montos verbatim o "No publicado".         │
 * │ 5. CERO insinuación: sin lenguaje causal/afinidad, sin datos de voto.        │
 * │ 6. #34: un error real de RPC se LANZA (route boundary), nunca degrada a      │
 * │    "sin contratos".                                                         │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * `ContratosPorContraparteView` es PURO (props) → RTL lo testea con fixtures, sin
 * runtime Supabase/Next. `ContratosPorContraparteSection` es el Server Component que
 * aplica el gate (defensa en profundidad; la página ya 404 con OFF), lee el RPC y
 * despacha por faceta. NO hay `"use client"` en este archivo.
 */

const PAGE_SIZE = 20;

/** Los tres estados honestos derivados server-side (16-UI-SPEC §Honest States). */
export type ContratosContraparteEstado =
  | "no_consultado"
  | "consultado_sin_contratos"
  | "con_contratos";

/** Una fila de contrato lista para mostrar (sujeto de página = la empresa). */
export interface ContratoContraparteRow {
  codigo_orden: string;
  // El RPC puede devolver null en estas columnas (nullable en la DB) → fallbacks
  // "No publicado" en vez de crashear / mostrar celdas vacías.
  proveedor_nombre: string | null;
  tipo_persona: string | null;
  organismo: string | null;
  nombre_orden: string | null;
  // Hoy SIEMPRE null (la fuente no trae monto fijo); nunca se etiqueta un no-monto.
  monto: string | null;
  fecha_oc: string | null;
  origen: string;
  fecha_captura: string;
  fecha_corte: string;
  enlace: string;
}

// ── Datos que la vista necesita (forma pura, testeable) ────────────────────────
export interface ContratosPorContraparteViewData {
  id: string;
  /** Estado honesto derivado server-side. */
  estado: ContratosContraparteEstado;
  /** Contratos de la página actual (ya paginados), orden fecha DESC. */
  contratos: ContratoContraparteRow[];
  /** Total de contratos (para "Página N de M" y el conteo neutral). */
  totalContratos: number;
  page: number;
  totalPages: number;
  /**
   * Fecha de corte de la consulta (para "consultado sin contratos"). `null` si no
   * hay marcador (estado "no consultado").
   */
  fechaCorte: string | null;
}

/** Construye un href de paginación del carril contratos preservando el ancla. */
function buildHref(id: string, page: number): string {
  const qs = new URLSearchParams({ contratosPage: String(page) }).toString();
  return `/contraparte/${encodeURIComponent(id)}?${qs}#contratos`;
}

// ── Intro honesta (frame + atribución ChileCompra "mención de la fuente") ───────
function Intro() {
  return (
    <div className="mb-4 space-y-1">
      <p className="text-sm text-muted-foreground">
        Contratos registrados en ChileCompra (Mercado Público) en que esta empresa
        aparece como proveedora. Se muestran tal como los publica la fuente.
      </p>
      <p className="text-sm text-muted-foreground">
        Fuente: ChileCompra — Mercado Público (mención de la fuente).
      </p>
    </div>
  );
}

// ── Una fila de contrato: foregrounda el organismo comprador (lado contraparte) ──
function ContratoFila({ c }: { c: ContratoContraparteRow }) {
  const captured = c.fecha_captura ? new Date(c.fecha_captura) : null;
  const organismoTexto = c.organismo ?? "No publicado";
  const nombreOrdenTexto = c.nombre_orden ?? "No publicado";
  const fechaOcTexto = c.fecha_oc
    ? fechaCorta(new Date(c.fecha_oc))
    : "Fecha no publicada";
  const fechaCorteTexto = c.fecha_corte
    ? fechaCorta(new Date(c.fecha_corte))
    : null;

  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-2 py-4 border-t first:border-t-0">
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        {/*
          Campos LITERALES del contrato como NOUN-label + valor verbatim (<dl>).
          `nombre_orden` es la DESCRIPCIÓN de la orden (texto libre), rotulada
          honestamente — NUNCA bajo "Monto". El "Monto" cae a "No publicado" cuando
          la fuente no lo trae; jamás un no-monto. El UI NO computa nada.
        */}
        <dl className="grid grid-cols-1 gap-1 sm:grid-cols-[max-content_1fr] sm:gap-x-4">
          <dt className="text-sm text-muted-foreground">Organismo comprador:</dt>
          <dd className="text-base">{organismoTexto}</dd>
          <dt className="text-sm text-muted-foreground">Nombre de la orden:</dt>
          <dd className="text-base">{nombreOrdenTexto}</dd>
          <dt className="text-sm text-muted-foreground">Monto:</dt>
          <dd className="text-base font-mono">{c.monto ?? "No publicado"}</dd>
          <dt className="text-sm text-muted-foreground">Fecha de la orden:</dt>
          <dd className="text-base font-mono">{fechaOcTexto}</dd>
          <dt className="text-sm text-muted-foreground">Código de la orden:</dt>
          <dd className="text-base font-mono">{c.codigo_orden}</dd>
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
          sourceName={sourceLabel(c.origen)}
          sourceUrl={c.enlace}
        />
      </span>
    </li>
  );
}

// ── Vista pura (RTL la testea con fixtures) ────────────────────────────────────
export function ContratosPorContraparteView({
  data,
}: {
  data: ContratosPorContraparteViewData;
}) {
  const { id, estado, contratos, totalContratos, page, totalPages, fechaCorte } =
    data;

  // Estado — No consultado: NUNCA se lee como "limpio"/"sin contratos".
  if (estado === "no_consultado") {
    return (
      <>
        <Intro />
        <p className="text-sm text-muted-foreground">
          Aún no hemos consolidado los contratos de ChileCompra para esta empresa.
          Esto no significa que no existan.
        </p>
      </>
    );
  }

  // Estado — Consultado sin contratos: con fecha de corte, distinto del anterior.
  if (estado === "consultado_sin_contratos") {
    const fechaTexto = fechaCorte
      ? fechaCorta(new Date(fechaCorte))
      : "la fecha de corte";
    return (
      <>
        <Intro />
        <p className="text-sm text-muted-foreground">
          Revisamos ChileCompra para esta empresa (corte al{" "}
          <span className="font-mono">{fechaTexto}</span>) y no se registran
          contratos a esa fecha.
        </p>
      </>
    );
  }

  // Estado — Con contratos: conteo neutral + lista paginada.
  return (
    <div>
      <Intro />

      {/* Conteo NEUTRAL (único agregado permitido) — sin suma de montos, sin ranking. */}
      <p className="text-sm text-muted-foreground mb-4">
        {totalContratos}{" "}
        {totalContratos === 1
          ? "contrato registrado"
          : "contratos registrados"}
        .
      </p>

      <ul>
        {contratos.map((c) => (
          <ContratoFila key={c.codigo_orden} c={c} />
        ))}
      </ul>

      {totalPages > 1 && (
        <nav
          className="flex items-center justify-between gap-4 mt-4 text-sm"
          aria-label="Paginación de contratos"
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

// ── Server Component: gate → RPC (faceta contratos) → ContratosView ─────────────
export async function ContratosPorContraparteSection({
  id,
  searchParams,
}: {
  id: string;
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Candado de presentación (WR-02): SIEMPRE vía moneyPublicEnabled(), nunca el env
  // crudo. OFF (default) → sin DOM, sin lectura de Supabase. Defensa en profundidad:
  // la página /contraparte/[id] ya 404 entera con OFF.
  if (!moneyPublicEnabled(process.env)) {
    return null;
  }

  const sb = createServerSupabase();

  const rawPage = Array.isArray(searchParams.contratosPage)
    ? searchParams.contratosPage[0]
    : searchParams.contratosPage;
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);

  // RPC agregador, jurídica-only, prefix-dispatched por el id ('c:' → contratos).
  const { data: rpcData, error: rpcError } = await sb.rpc(
    "agregado_por_contraparte",
    { p_id: id },
  );
  // #34: error real de DB/red != "sin contratos". Se lanza → UI de error honesta.
  if (rpcError) {
    throw new Error(
      `agregado_por_contraparte falló para ${id}: ${rpcError.message}`,
    );
  }

  // El RPC devuelve 0 o 1 fila por contraparte (dispatch por id exacto). Tomamos la
  // faceta 'contrato'. Ausencia de fila → "no consultado"; presencia con 0 filas →
  // "consultado sin contratos"; con filas → "con contratos".
  const agregados = (rpcData as AgregadoContraparteRpcRow[] | null) ?? [];
  const facetaContratos = agregados.find((a) => a.facet === "contrato") ?? null;

  const filasRaw = (facetaContratos?.filas as ContratoRpcRow[] | undefined) ?? [];
  const todos: ContratoContraparteRow[] = filasRaw.map((f) => ({
    codigo_orden: f.codigo_orden,
    proveedor_nombre: f.proveedor_nombre,
    tipo_persona: f.tipo_persona,
    organismo: f.organismo,
    nombre_orden: f.nombre_orden,
    monto: f.monto,
    fecha_oc: f.fecha_oc,
    origen: f.origen,
    fecha_captura: f.fecha_captura,
    fecha_corte: f.fecha_corte,
    enlace: f.enlace,
  }));

  // Derivación de los tres estados honestos (server-side).
  let estado: ContratosContraparteEstado;
  if (todos.length > 0) {
    estado = "con_contratos";
  } else if (facetaContratos === null) {
    estado = "no_consultado";
  } else {
    estado = "consultado_sin_contratos";
  }

  // Fecha de corte para "consultado sin contratos": la de la primera fila si la
  // hubiera; en su ausencia, null (el copy cae a "la fecha de corte").
  const fechaCorte = todos[0]?.fecha_corte ?? null;

  // Paginación server-driven sobre el conjunto ya cargado.
  const totalContratos = todos.length;
  const totalPages = Math.max(1, Math.ceil(totalContratos / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const start = (pageClamped - 1) * PAGE_SIZE;
  const contratos = todos.slice(start, start + PAGE_SIZE);

  return (
    <ContratosPorContraparteView
      data={{
        id,
        estado,
        contratos,
        totalContratos,
        page: pageClamped,
        totalPages,
        fechaCorte,
      }}
    />
  );
}
