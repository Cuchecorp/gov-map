import Link from "next/link";

import { createServerSupabase } from "@/lib/supabase";
import { moneyPublicEnabled } from "@/lib/money-gate";
import { LEYENDA_ANTI_INSINUACION_MONEY } from "@/lib/money-presentacion";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { fechaCorta } from "@/lib/format";
import { sourceLabel, type ContratoRpcRow } from "@/lib/types";

/**
 * Sección MONEY "Contratos del Estado asociados al RUT" de la ficha del
 * parlamentario (Phase 14, UI-SPEC §Layout). Es la CARA CIUDADANA de la fase y
 * vive entera detrás de `moneyPublicEnabled()` (default OFF) — doble candado con
 * la RLS deny-by-default del Plan 14-01. Espejo de `lobby-de-parlamentario.tsx`
 * (estados honestos) + `patrimonio-de-parlamentario.tsx` (disciplina <dl>).
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ GATE DE CONTENIDO (UI-SPEC, reglas LOCKED de honestidad de Phase 14)         │
 * │                                                                             │
 * │ 1. REDACCIÓN: el heading es "Contratos del Estado asociados al RUT" — NUNCA  │
 * │    un posesivo ("del parlamentario"/"del diputado"/"de {nombre}"). La        │
 * │    redacción es un contrato de honestidad, no cosmética.                    │
 * │ 2. TRES ESTADOS HONESTOS textualmente distintos: "no consultado todavía" /   │
 * │    "consultado sin contratos" / "enlazado". Un vacío NUNCA se lee como       │
 * │    "limpio"/"sin contratos ✓"/positivo. Ausencia de consulta ≠ ausencia de  │
 * │    contratos.                                                                │
 * │ 3. PERSONA JURÍDICA: el SUJETO es la entidad proveedora; el enlace al        │
 * │    parlamentario es una línea muted SEPARADA ("Enlazado por RUT al           │
 * │    parlamentario."). NUNCA un posesivo, NUNCA fusionar entidad + parlamen-   │
 * │    tario en una atribución personal.                                        │
 * │ 4. ATRIBUCIÓN ChileCompra = "mención de la fuente" (NO CC BY 4.0).          │
 * │    ProvenanceBadge por fila + fecha de corte por fila.                      │
 * │ 5. CERO cómputo: el UI no suma montos, no rankea, no calcula %. Montos       │
 * │    literales verbatim. Sin rojo/verde de severidad — ámbar SOLO frescura.   │
 * │ 6. #34: un error real de RPC se LANZA (route boundary), nunca degrada a      │
 * │    "sin contratos".                                                         │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * `ContratosView` es PURO (props) → RTL lo testea con fixtures, sin runtime
 * Supabase/Next. `ContratosSection` es el Server Component que aplica el gate,
 * lee el RPC y el marcador de ingesta. NO hay `"use client"` en este archivo.
 */

const PAGE_SIZE = 20;

/** Los tres estados honestos derivados server-side (UI-SPEC §Layout). */
export type ContratosEstado =
  | "no_consultado"
  | "consultado_sin_contratos"
  | "enlazado";

/** Una fila de contrato lista para mostrar (sujeto = entidad proveedora). */
export interface ContratoRow {
  codigo_orden: string;
  // WR-01: el RPC puede devolver null en estas columnas (son nullable en la DB). El tipo lo
  // refleja y el render usa fallbacks "no publicado" en vez de crashear / mostrar celdas vacías.
  proveedor_nombre: string | null;
  tipo_persona: string | null;
  organismo: string | null;
  // CR-02: nombre/descripción de la orden (texto libre). NO es un monto.
  nombre_orden: string | null;
  // CR-02: hoy SIEMPRE null (la fuente no trae un monto fijo); nunca se etiqueta un no-monto.
  monto: string | null;
  fecha_oc: string | null;
  origen: string;
  fecha_captura: string;
  fecha_corte: string;
  enlace: string;
}

// ── Datos que la vista necesita (forma pura, testeable) ────────────────────────
export interface ContratosViewData {
  id: string;
  /** Estado honesto derivado server-side. */
  estado: ContratosEstado;
  /** Contratos de la página actual (ya paginados), orden fecha DESC. */
  contratos: ContratoRow[];
  /** Total de contratos enlazados (para "Página N de M" y el conteo neutro). */
  totalContratos: number;
  page: number;
  totalPages: number;
  /**
   * Fecha de corte de la consulta por RUT (para el estado "consultado sin
   * contratos"). `null` si no hay marcador (estado "no consultado").
   */
  fechaCorte: string | null;
}

/** Construye un href de paginación preservando el resto de la query. */
function buildHref(id: string, page: number): string {
  const qs = new URLSearchParams({ contratosPage: String(page) }).toString();
  return `/parlamentario/${id}?${qs}#dinero`;
}

// ── Leyenda anti-insinuación MONEY (MONEY-04, UI-SPEC §Leyenda) ─────────────────
// Primer hijo de CADA rama de estado, ENCIMA del Intro: el marco honesto precede a
// cualquier dato. Constante ÚNICA importada (nunca inline duplicada). Tratamiento
// LOCKED: rail petróleo `border-l-[3px] border-[var(--primary)] pl-2.5 mb-4`, sobrio.
function LeyendaMoney() {
  return (
    <p className="text-sm text-muted-foreground border-l-[3px] border-[var(--primary)] pl-2.5 mb-4">
      {LEYENDA_ANTI_INSINUACION_MONEY}
    </p>
  );
}

// ── Intro honesta (frame + atribución ChileCompra "mención de la fuente") ───────
function Intro() {
  return (
    <div className="mb-4 space-y-1">
      <p className="text-sm text-muted-foreground">
        Contratos del Estado registrados en ChileCompra (Mercado Público)
        asociados al RUT de este parlamentario. Se muestran tal como los publica
        la fuente; la asociación es por RUT exacto y no implica que el contrato
        sea del parlamentario.
      </p>
      <p className="text-sm text-muted-foreground">
        Fuente: ChileCompra — Mercado Público (mención de la fuente). Datos
        consultados por RUT, con su fecha de corte.
      </p>
    </div>
  );
}

// ── Una fila de contrato: SUJETO = entidad proveedora, enlace en línea SEPARADA ─
function ContratoFila({ c }: { c: ContratoRow }) {
  const captured = c.fecha_captura ? new Date(c.fecha_captura) : null;
  // WR-01: `tipo_persona` puede ser null → guardar antes de `.toLowerCase()` (no crashear la fila).
  const tipoPersona = (c.tipo_persona ?? "").toLowerCase();
  const esJuridica = tipoPersona.includes("jur");
  const proveedorTexto = c.proveedor_nombre ?? "Proveedor no publicado";
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
        {/* SUJETO = la entidad proveedora (text-base, el elemento prominente). */}
        <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-base">Proveedor: {proveedorTexto}</span>
          <span className="text-sm text-muted-foreground">
            ({esJuridica ? "persona jurídica" : "persona natural"})
          </span>
        </span>

        {/*
          El enlace al parlamentario es una línea muted SEPARADA — NUNCA un
          posesivo, NUNCA fusionada con la entidad en una atribución personal.
        */}
        <span className="text-sm text-muted-foreground">
          Enlazado por RUT al parlamentario.
        </span>

        {/*
          Campos LITERALES del contrato como NOUN-label + valor verbatim (<dl>).
          CR-02: `nombre_orden` es el NOMBRE/DESCRIPCIÓN de la orden (texto libre), rotulado
          honestamente — NUNCA bajo "Monto". El "Monto" SOLO se muestra cuando existe un monto
          real (`c.monto != null`); hoy la fuente no lo trae → "No publicado", nunca un no-monto.
        */}
        <dl className="grid grid-cols-1 gap-1 sm:grid-cols-[max-content_1fr] sm:gap-x-4 mt-1">
          <dt className="text-sm text-muted-foreground">Organismo comprador:</dt>
          <dd className="text-base">{organismoTexto}</dd>
          <dt className="text-sm text-muted-foreground">Nombre de la orden:</dt>
          <dd className="text-base">{nombreOrdenTexto}</dd>
          <dt className="text-sm text-muted-foreground">Monto:</dt>
          <dd className="text-base font-mono">
            {c.monto ?? "No publicado"}
          </dd>
          <dt className="text-sm text-muted-foreground">Fecha de la orden:</dt>
          <dd className="text-base font-mono">{fechaOcTexto}</dd>
          <dt className="text-sm text-muted-foreground">Código de la orden:</dt>
          <dd className="text-base font-mono">{c.codigo_orden}</dd>
        </dl>

        {/* Fecha de corte por fila, distinta de la fecha de captura. */}
        {fechaCorteTexto && (
          <span className="text-sm text-muted-foreground">
            Consultado por RUT, corte al{" "}
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
export function ContratosView({ data }: { data: ContratosViewData }) {
  const { id, estado, contratos, totalContratos, page, totalPages, fechaCorte } =
    data;

  // Estado — No consultado todavía: NUNCA se lee como "limpio"/"sin contratos".
  if (estado === "no_consultado") {
    return (
      <>
        <LeyendaMoney />
        <Intro />
        <p className="text-sm text-muted-foreground">
          Aún no hemos consultado ChileCompra para el RUT de este parlamentario.
          Esto no significa que no existan contratos asociados — la consulta por
          RUT se está incorporando.
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
        <LeyendaMoney />
        <Intro />
        <p className="text-sm text-muted-foreground">
          Consultamos ChileCompra por el RUT de este parlamentario (corte al{" "}
          <span className="font-mono">{fechaTexto}</span>) y no se registran
          contratos asociados a ese RUT a esa fecha.
        </p>
      </>
    );
  }

  // Estado — Enlazado: conteo neutro + lista paginada.
  return (
    <div>
      <LeyendaMoney />
      <Intro />

      {/* Conteo NEUTRO (único agregado permitido) — sin suma de montos, sin ranking. */}
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

/** Marcador de ingesta por parlamentario (Plan 14-01), leído vía `.maybeSingle()`. */
interface ContratosIngestaEstado {
  parlamentario_id: string;
  ingestado_hasta: string | null;
  fecha_captura: string;
}

// ── Server Component: gate → RPC → marcador → ContratosView ─────────────────────
export async function ContratosSection({
  id,
  searchParams,
}: {
  id: string;
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Candado de presentación (WR-02): SIEMPRE vía moneyPublicEnabled(), nunca el
  // env crudo. OFF (default) → sin DOM, sin lectura de Supabase. Doble candado con
  // la RLS deny-by-default del Plan 14-01.
  if (!moneyPublicEnabled(process.env)) {
    return null;
  }

  const sb = createServerSupabase();

  const rawPage = Array.isArray(searchParams.contratosPage)
    ? searchParams.contratosPage[0]
    : searchParams.contratosPage;
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);

  // Contratos enlazados por RUT-exacto (el RPC ya filtra por p_id, orden fecha DESC).
  const { data: rpcData, error: rpcError } = await sb.rpc(
    "contratos_de_parlamentario",
    { p_id: id },
  );
  // #34: error real de DB/red ≠ "sin contratos". Se lanza → UI de error honesta.
  if (rpcError) {
    throw new Error(
      `contratos_de_parlamentario falló para ${id}: ${rpcError.message}`,
    );
  }
  const filas = (rpcData as ContratoRpcRow[] | null) ?? [];
  const todos: ContratoRow[] = filas.map((f) => ({
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

  // Marcador de ingesta: AUSENCIA de fila (o sin RUT interno) = "no consultado
  // todavía"; presencia + 0 filas = "consultado sin contratos"; +filas = "enlazado".
  const { data: estadoData, error: estadoError } = await sb
    .from("contratos_ingesta_estado")
    .select("parlamentario_id, ingestado_hasta, fecha_captura")
    .eq("parlamentario_id", id)
    .maybeSingle<ContratosIngestaEstado>();
  if (estadoError) {
    throw new Error(
      `contratos_ingesta_estado falló para ${id}: ${estadoError.message}`,
    );
  }

  // Derivación de los tres estados honestos (server-side).
  let estado: ContratosEstado;
  if (todos.length > 0) {
    estado = "enlazado";
  } else if (estadoData === null) {
    // Sin marcador (o RUT interno no poblado, deuda IDENT-10) → no consultado.
    estado = "no_consultado";
  } else {
    estado = "consultado_sin_contratos";
  }

  // Fecha de corte para el estado "consultado sin contratos".
  const fechaCorte = estadoData?.ingestado_hasta ?? null;

  // Paginación server-driven sobre el conjunto ya cargado.
  const totalContratos = todos.length;
  const totalPages = Math.max(1, Math.ceil(totalContratos / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const start = (pageClamped - 1) * PAGE_SIZE;
  const contratos = todos.slice(start, start + PAGE_SIZE);

  return (
    <ContratosView
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
