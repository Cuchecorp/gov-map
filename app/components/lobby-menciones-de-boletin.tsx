import Link from "next/link";

import { createServerSupabase } from "@/lib/supabase";
import { fechaCorta, formatNombre } from "@/lib/format";
import { safeExternalHref } from "@/lib/utils";

/**
 * Sección NUEVA de la ficha de proyecto (Phase 92 — LOB-02/LOB-03). Carril de
 * MENCIÓN EXPLÍCITA: "Audiencias de lobby que mencionan este boletín" — audiencias
 * de lobby cuya MATERIA menciona EXPLÍCITAMENTE el número de este boletín en el
 * registro público de la Ley del Lobby (Ley 20.730). Consume la RPC bounded
 * `lobby_menciones_de_boletin(p_boletin)` (0062, fail-closed doble: patrón
 * determinista context-gated + existencia en `proyecto`).
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ CARRIL HERMANO, NO FUSIÓN (92-UI-SPEC §Component 3, LOCKED) — riesgo #1     │
 * │                                                                             │
 * │ Esta sección es HERMANA e INDEPENDIENTE de `#lobby-tramitacion` (0048, el   │
 * │ cruce TEMPORAL "Lobby del período" — que NO se toca). Vive en su propio     │
 * │ `<section id="lobby-menciones" class="mt-12">`. Distinción LOCKED vs 0048:  │
 * │  · Heading DISTINTO: "Audiencias de lobby que mencionan este boletín" (aquí)│
 * │    vs "Reuniones de lobby registradas en el mismo período" (0048).          │
 * │  · Criterio: mención EXPLÍCITA del número (aquí) vs coincidencia TEMPORAL.   │
 * │  · Parlamentario ENLAZADO a /parlamentario/{id} (DEPARTURE vs 0048: hay      │
 * │    evidencia dura de mención → navegación bidireccional PL→audiencia→        │
 * │    parlamentario justificada, LOB-03). En 0048 el nombre es texto plano.     │
 * │  · Leyenda DISTINTA: "mención en registro ≠ influencia/causa" (aquí) vs      │
 * │    "coincidencia temporal ≠ relación" (0048).                               │
 * │ Las dos NUNCA se fusionan; su cercanía visual no debe sugerir que son la     │
 * │ misma cosa (el rail las lista por separado).                                │
 * │                                                                             │
 * │ CERO CAUSALIDAD: la leyenda anti-causal (1×/sección) declara que la mención  │
 * │ es un dato del registro, NO influencia ni relación causal. Prohibido         │
 * │ vocabulario de "influyó / gestionó / a cambio de / afinidad".               │
 * │ CONTEO NEUTRO: el `{N}` es un hecho en Mono (total_n honesto de 0062), sin   │
 * │ ranking / score / "los más …".                                             │
 * │ IDENTIDAD: la RPC solo emite parlamentarios `estado_vinculo=confirmado`. La  │
 * │ contraparte es TEXTO CRUDO verbatim, NUNCA enlazada, sin RUT.                │
 * │ PROVENANCE por fila: "Ver fuente oficial ↗" → enlace_detalle (omitido si     │
 * │ no hay enlace; nunca fabricado).                                            │
 * │ Un vacío es un HECHO, no una virtud: el empty declara que "no hay mención    │
 * │ explícita del número" ≠ "no hubo lobby".                                    │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * `LobbyMencionesView` es PURA (props) → RTL la testea con fixtures, sin runtime
 * Supabase/Next. `LobbyMencionesSection` es el Server Component que lee la RPC.
 * NO hay `"use client"` en este archivo.
 *
 * DEGRADE HONESTO (LOAD-BEARING, espejo 0048/cruces): la migración 0062 se aplica a
 * PROD sólo en el Plan 04. El build debe renderizar con la RPC ausente sin 500 y sin
 * fabricar una banda vacía. Tres caminos distintos:
 *   1. función ausente (PGRST202 — SOLO ese código; un fallback por regex de mensaje
 *      tragaría errores REALES de schema como "column ... does not exist") → return null.
 *   2. RPC presente, 0 filas → heading + leyenda + empty honesto.
 *   3. cualquier otro error real de DB/red → throw (#34).
 */

// ── Contrato de la RPC 0062 (lobby_menciones_de_boletin) ────────────────────────
// Emite el nombre PÚBLICO del parlamentario + `parlamentario_id` (para el enlace) +
// contraparte cruda (nombre/rol/representado) SIN contraparte_id ni RUT. `total_n`
// es el conteo honesto (count(*) over ()); la RPC bounded a LIMIT 50 → filas < total_n
// significa que se truncó y usamos la variante de conteo `total_n`.
export interface LobbyMencionRow {
  identificador: string;
  fecha: string | null;
  materia: string | null;
  parlamentario_id: string | null;
  parlamentario_nombre: string;
  contraparte_nombre: string | null;
  contraparte_rol: string | null;
  representado: string | null;
  enlace_detalle: string | null;
  origen: string | null;
  fecha_captura: string | null;
  enlace: string | null;
  total_n: number | null;
}

// ── Leyenda anti-causal LOCKED (single-source) ──────────────────────────────────
// EXPORTADA para que el linter anti-insinuación la reste en NEGACIONES_LOCKED antes
// de escanear esta superficie: CONTIENE "influencia" y "relación causal" en un
// contexto que los NIEGA. Verbatim de 92-UI-SPEC §Copywriting (LOCKED).
// prettier-ignore — un SOLO string literal en una línea: el linter anti-insinuación
// resta esta leyenda VERBATIM del source (split/join); un `+` de concat entre líneas
// rompería la sustracción y "influencia" quedaría → falso-positivo (lección BLOCKER 91).
// eslint-disable-next-line
export const LEYENDA_MENCIONES_LOBBY = "La materia de estas audiencias menciona el número de este boletín en el registro público de la Ley del Lobby (Ley 20.730). La mención es un dato del registro; no implica influencia en la tramitación ni relación causal con el proyecto.";

// ── Empty state LOCKED (single-source) ──────────────────────────────────────────
// EXPORTADA para el linter: CONTIENE "actividad de lobby" en un contexto que la
// NIEGA. Verbatim de 92-UI-SPEC §Copywriting (LOCKED). NUNCA se lee como "sin
// lobby" / "limpio": declara explícitamente que sólo cuenta menciones explícitas.
// prettier-ignore — SOLO string literal en una línea (misma razón que la leyenda arriba).
// eslint-disable-next-line
export const EMPTY_MENCIONES_LOBBY = "Ninguna audiencia de lobby registrada menciona el número de este boletín en su materia, según las fuentes consultadas. Esto no describe la actividad de lobby en torno al proyecto; solo cuenta las materias que citan explícitamente este número de boletín.";

// ── Fecha ISO parseable → Date válida, o null (nunca "Invalid Date") ────────────
function fechaValida(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function plural(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

// ── Una fila de audiencia: parlamentario ENLAZADO + contraparte cruda + materia ──
function FilaMencion({ row }: { row: LobbyMencionRow }) {
  const fecha = fechaValida(row.fecha);
  const href = safeExternalHref(row.enlace_detalle);
  // Contraparte cruda verbatim (nombre + rol + representado si la fuente los publica),
  // NUNCA enlazada, JAMÁS RUT (la RPC no emite contraparte_id). Se compone la línea
  // sólo con los fragmentos presentes (honest-state); si no hay ninguno, se omite.
  const contraparteTexto = [
    row.contraparte_nombre?.trim() || null,
    row.contraparte_rol?.trim() || null,
    row.representado?.trim() || null,
  ]
    .filter((s): s is string => !!s)
    .join(" · ");

  return (
    <li className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 py-3 border-t first:border-t-0">
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <p className="text-base leading-relaxed">
          {fecha && (
            <span className="font-mono text-sm text-muted-foreground">
              {fechaCorta(fecha)} ·{" "}
            </span>
          )}
          {/* Parlamentario ENLAZADO (DEPARTURE del 0048, LOB-03): navegación
              bidireccional PL→audiencia→parlamentario. formatNombre solo re-casea el
              string RENDERIZADO; si no hay parlamentario_id, se muestra texto plano
              (la RPC exige parlamentario_id no-null, pero defendemos por si acaso). */}
          {row.parlamentario_id ? (
            <Link
              href={`/parlamentario/${row.parlamentario_id}`}
              className="font-semibold text-accent-product underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-product"
            >
              {formatNombre(row.parlamentario_nombre)}
            </Link>
          ) : (
            <span className="font-semibold">
              {formatNombre(row.parlamentario_nombre)}
            </span>
          )}
        </p>
        {contraparteTexto && (
          <p className="text-sm text-muted-foreground">
            <span className="text-muted-foreground">Contraparte: </span>
            {contraparteTexto}
          </p>
        )}
        {row.materia && (
          <div className="text-sm whitespace-pre-line leading-relaxed">
            <span className="text-muted-foreground">Asunto: </span>
            {row.materia}
          </div>
        )}
      </div>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center min-h-11 ml-auto text-sm underline underline-offset-2 text-accent-product"
        >
          Ver fuente oficial ↗
        </a>
      )}
    </li>
  );
}

// ── Vista pura (RTL la testea con fixtures) ─────────────────────────────────────
export function LobbyMencionesView({ rows }: { rows: LobbyMencionRow[] }) {
  // Leyenda anti-causal LOCKED — ÚNICA, arriba, sobre banda `--muted`.
  const leyenda = (
    <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground mb-4">
      {LEYENDA_MENCIONES_LOBBY}
    </p>
  );

  // El h2 vive DENTRO del componente (no en la page) para que el degrade honesto
  // path-1 (Section → null) NO deje un heading huérfano sin banda: nodo ausente.
  const heading = (
    <h2 className="text-xl font-semibold mb-4">
      Audiencias de lobby que mencionan este boletín
    </h2>
  );

  // Empty honesto — la RPC respondió con 0 menciones. NUNCA se lee como "sin lobby"
  // ni "limpio"; heading + leyenda se mantienen.
  if (rows.length === 0) {
    return (
      <>
        {heading}
        {leyenda}
        <p className="text-sm text-muted-foreground">{EMPTY_MENCIONES_LOBBY}</p>
      </>
    );
  }

  // Conteo honesto: la RPC bounded (LIMIT 50) emite `total_n` (count(*) over ()).
  // Si las filas mostradas < total_n, se truncó → variante `total_n`. En otro caso,
  // conteo neutro singular/plural. El total honesto viene de la primera fila (todas
  // llevan el mismo total_n del window).
  const mostradas = rows.length;
  const total = rows[0]?.total_n ?? mostradas;
  const truncado = total > mostradas;

  const conteo = truncado ? (
    <p className="text-base leading-relaxed">
      Se muestran las <span className="font-mono">{mostradas}</span> audiencias más
      recientes de <span className="font-mono">{total}</span> que mencionan este
      boletín.
    </p>
  ) : (
    <p className="text-base leading-relaxed">
      <span className="font-mono">{total}</span>{" "}
      {plural(total, "audiencia registrada menciona", "audiencias registradas mencionan")}{" "}
      este boletín.
    </p>
  );

  return (
    <div className="space-y-6">
      {heading}
      {leyenda}
      {conteo}
      <ul className="space-y-0">
        {rows.map((r, idx) => (
          <FilaMencion key={r.identificador ?? idx} row={r} />
        ))}
      </ul>
    </div>
  );
}

// ── Server Component: lee la RPC y degrada honesto de 3 caminos ─────────────────
export async function LobbyMencionesSection({ boletin }: { boletin: string }) {
  const sb = createServerSupabase();

  const { data, error } = await sb.rpc("lobby_menciones_de_boletin", {
    p_boletin: boletin,
  });

  // Camino 1: la función NO existe (PGRST202 = function-not-found de PostgREST).
  // SOLO ese código exacto → nodo AUSENTE del HTML (null), sin 500. La RPC 0062 se
  // aplica a PROD en el Plan 04: hasta entonces el sitio degrada honesto sin heading
  // huérfano; el wrapper mt-12 de la <section> preserva la frontera. NO se usa un
  // fallback por regex de mensaje ("column ... does not exist" es un error REAL de
  // schema que debe ir al camino 3, no ocultar la sección en silencio).
  if (error?.code === "PGRST202") {
    return null;
  }

  // Camino 3: un error real de DB/red ≠ "sin menciones". Se lanza para la UI de error
  // honesta (#34); NUNCA se degrada a empty (falsa exoneración).
  if (error) {
    throw new Error(
      `lobby_menciones_de_boletin falló para ${boletin}: ${error.message}`,
    );
  }

  // Camino 2: data (incluye 0 filas → empty honesto dentro de la vista).
  const rows = (data as LobbyMencionRow[] | null) ?? [];
  return <LobbyMencionesView rows={rows} />;
}
