import Link from "next/link";

import { createServerSupabase } from "@/lib/supabase";
import { moneyPublicEnabled } from "@/lib/money-gate";
import { LEYENDA_ANTI_INSINUACION_MONEY } from "@/lib/money-presentacion";
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
 * │ 2. ESTADOS HONESTOS (WR-01: DOS, no tres): "no consultado" / "con contratos". │
 * │    Un vacío NUNCA se lee como "limpio"/"sin contratos ✓"; cae al estado débil  │
 * │    "aún no consolidado". Ausencia de consulta != ausencia de hechos, y el RPC  │
 * │    no puede probar un "verificado en cero" por contraparte (sin marcador).    │
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

/**
 * Estados honestos derivados server-side (16-UI-SPEC §Honest States).
 *
 * WR-01 (Phase 16): este carril tiene DOS estados, no tres. El RPC
 * `agregado_por_contraparte` agrupa con `GROUP BY` sobre la fila de hecho, de modo que
 * una contraparte sin contratos NO produce una fila de faceta vacia: produce CERO filas.
 * Ademas el id esta prefijado ('c:' despacha SOLO la faceta contratos), asi que en una
 * pagina con id 'd:' (aportes) este carril nunca se consulta. En ningun caso el RPC
 * distingue "consultado, cero contratos" de "nunca consultado" para una contraparte: NO
 * hay marcador de ingesta por contraparte (los `*_ingesta_estado` se keyean por
 * parlamentario, no por contraparte). Antes existia un tercer estado
 * `consultado_sin_contratos` que era CODIGO MUERTO y, peor, habria afirmado un
 * "verificado en cero" que la data NO prueba. Se retira: el estado vacio honesto es
 * SIEMPRE el debil "aun no consolidado / esto no significa que no existan".
 */
export type ContratosContraparteEstado = "no_consultado" | "con_contratos";

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
}

/** Construye un href de paginación del carril contratos preservando el ancla. */
function buildHref(id: string, page: number): string {
  const qs = new URLSearchParams({ contratosPage: String(page) }).toString();
  return `/contraparte/${encodeURIComponent(id)}?${qs}#contratos`;
}

// ── Leyenda anti-insinuación MONEY (MONEY-04, UI-SPEC §Leyenda) ─────────────────
// Primer hijo de CADA rama de estado del carril, ENCIMA del Intro. Constante ÚNICA
// importada (nunca inline duplicada). Tratamiento LOCKED del rail petróleo.
function LeyendaMoney() {
  return (
    <p className="text-sm text-muted-foreground border-l-[3px] border-[--primary] pl-2.5 mb-4">
      {LEYENDA_ANTI_INSINUACION_MONEY}
    </p>
  );
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
  const { id, estado, contratos, totalContratos, page, totalPages } = data;

  // Estado — No consultado / vacío honesto (WR-01): un vacío NUNCA se lee como
  // "limpio"/"sin contratos ✓". El RPC no distingue "consultado en cero" de "nunca
  // consultado" para una contraparte (sin marcador de ingesta por contraparte), así que
  // el único estado vacío honesto es el débil: "aún no consolidado".
  if (estado === "no_consultado") {
    return (
      <>
        <LeyendaMoney />
        <Intro />
        <p className="text-sm text-muted-foreground">
          Aún no hemos consolidado los contratos de ChileCompra para esta empresa.
          Esto no significa que no existan.
        </p>
      </>
    );
  }

  // Estado — Con contratos: conteo neutral + lista paginada.
  return (
    <div>
      <LeyendaMoney />
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
  // faceta 'contrato'. WR-01: el RPC agrupa con GROUP BY, así que una contraparte sin
  // contratos produce CERO filas de faceta (nunca una faceta con `filas` vacío) → solo
  // hay DOS estados: con filas → "con contratos"; sin filas → vacío honesto débil.
  const agregados = (rpcData as AgregadoContraparteRpcRow[] | null) ?? [];
  const facetaContratos = agregados.find((a) => a.facet === "contrato") ?? null;

  // WR-05/IN-02: el `conteo` del RPC es el count(*) REAL (no acotado); `filas` viene
  // ACOTADO al cap del RPC. La línea de conteo neutral usa el `conteo` real (veraz aunque
  // `filas` se haya recortado); la paginación opera sobre las `filas` efectivamente traídas.
  const conteoReal = facetaContratos?.conteo ?? 0;
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

  // Derivación de los DOS estados honestos (server-side, WR-01). `facetaContratos` solo
  // existe cuando hay ≥1 fila (el GROUP BY no emite grupos vacíos), de modo que
  // `todos.length > 0` ⟺ `facetaContratos !== null`. Sin filas → vacío honesto débil.
  const estado: ContratosContraparteEstado =
    todos.length > 0 ? "con_contratos" : "no_consultado";

  // Paginación sobre el conjunto (acotado) efectivamente traído. El conteo neutral usa el
  // `conteo` real del RPC (WR-05/IN-02): no se sintetiza desde `filas.length`, que puede
  // venir recortado por el cap.
  const totalContratos = conteoReal;
  const filasCargadas = todos.length;
  const totalPages = Math.max(1, Math.ceil(filasCargadas / PAGE_SIZE));
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
      }}
    />
  );
}
