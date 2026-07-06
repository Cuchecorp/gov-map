import { createServerSupabase } from "@/lib/supabase";
import { fechaCorta } from "@/lib/format";
import { safeExternalHref } from "@/lib/utils";

/**
 * Sección SC2 de la ficha de proyecto (Phase 52 — CRUCE2). Carril de YUXTAPOSICIÓN
 * TEMPORAL: "Reuniones de lobby registradas en el mismo período" — audiencias de
 * lobby que caen en la MISMA semana ISO en que una comisión vio este boletín.
 * Consume el RPC `lobby_en_tramitacion(p_boletin)` (contrato LOCKED por 52-02).
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ GATE DE CONTENIDO (DESIGN-SYSTEM §9.1 / 52-UI-SPEC §Anti-insinuación) —      │
 * │ riesgo existencial #1                                                        │
 * │                                                                             │
 * │ 1. CARRIL AISLADO: esta sección vive en su propio `<section                 │
 * │    id="lobby-tramitacion" class="mt-12">`; NUNCA comparte un <li>/<article> │
 * │    con un voto / tally / declaración / contrato. Se compone SOLO con fechas │
 * │    de tramitación (la semana ISO en que la comisión vio el boletín).        │
 * │ 2. COINCIDENCIA, NO CAUSA: caveat obligatorio 1×/sección declarando la      │
 * │    coincidencia temporal. Prohibido "a cambio de / influyó / gestionó /     │
 * │    presionó / afinidad / porque".                                          │
 * │ 3. CONTEO NEUTRO: el `{N}` es un hecho observable en Mono, sin ranking /     │
 * │    score / "los más …" / porcentaje-como-veredicto.                        │
 * │ 4. IDENTIDAD: el RPC solo emite parlamentarios con `estado_vinculo =        │
 * │    confirmado`; el nombre es TEXTO PLANO — NO enlazado en este carril       │
 * │    (contexto de yuxtaposición, no atribución). Cero contraparte, cero RUT.  │
 * │ 5. PROVENANCE por fila (FND-08): "Ver fuente oficial ↗" → enlace_detalle.   │
 * │ 6. Un vacío es un HECHO, no una virtud: NUNCA "limpio/transparente".        │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * `LobbyEnTramitacionView` es PURA (props) → RTL la testea con fixtures, sin runtime
 * Supabase/Next. `LobbyEnTramitacionSection` es el Server Component que lee el RPC.
 * NO hay `"use client"` en este archivo.
 *
 * DEGRADE HONESTO (LOAD-BEARING, 52-UI-SPEC §Degrade honesto): la migración 0048 se
 * aplica a PROD sólo en el checkpoint de operador (52-06). El build debe renderizar
 * con la RPC ausente sin 500 y sin fabricar una banda vacía. Tres caminos distintos:
 *   1. función ausente (PGRST202, el código PostgREST de function-not-found — SOLO
 *      ese código; un fallback por regex de mensaje tragaría errores REALES de
 *      schema como "column ... does not exist", WR-01) → return null.
 *   2. RPC presente, 0 filas → heading + caveat + empty honesto.
 *   3. cualquier otro error real de DB/red → throw (#34).
 */

// ── Contrato del RPC (LOCKED por 52-02, 7 campos verbatim) ──────────────────────
export interface LobbyEnTramitacionRow {
  parlamentario_nombre: string;
  camara: string;
  materia: string | null;
  fecha_reunion: string;
  semana_iso: string;
  comision: string;
  enlace_detalle: string | null;
}

// ── Fecha ISO parseable → Date válida, o null (nunca "Invalid Date") ────────────
function fechaValida(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ── Grupo por semana ISO para el summary por semana ─────────────────────────────
// UNIDAD SEMÁNTICA (WR-02): (audiencia × semana), NO (audiencia × comisión). El RPC
// emite una fila por (audiencia × semana × comisión): si DOS comisiones vieron el
// boletín la misma semana (p.ej. la temática + Hacienda), la MISMA reunión llega
// duplicada. Aquí se deduplica por audiencia dentro de la semana (mismo
// parlamentario + fecha + materia + enlace) y las comisiones se AGREGAN al grupo —
// el conteo neutro {N} cuenta reuniones reales, nunca infladas por el join.
interface GrupoSemana {
  semanaIso: string;
  /** Comisiones que vieron el boletín esa semana (distintas, orden de aparición). */
  comisiones: string[];
  rows: LobbyEnTramitacionRow[];
}

function agruparPorSemana(rows: LobbyEnTramitacionRow[]): GrupoSemana[] {
  const mapa = new Map<string, GrupoSemana>();
  const audienciasVistas = new Set<string>();
  for (const r of rows) {
    let g = mapa.get(r.semana_iso);
    if (!g) {
      g = { semanaIso: r.semana_iso, comisiones: [], rows: [] };
      mapa.set(r.semana_iso, g);
    }
    if (!g.comisiones.includes(r.comision)) g.comisiones.push(r.comision);
    // Clave de la audiencia dentro de la semana (el RPC no expone un id de
    // audiencia): misma persona + mismo instante + misma materia + mismo enlace
    // = la misma reunión citada por otra comisión → una sola fila.
    const claveAudiencia = [
      r.semana_iso,
      r.parlamentario_nombre,
      r.fecha_reunion,
      r.materia ?? "",
      r.enlace_detalle ?? "",
    ].join("∷");
    if (audienciasVistas.has(claveAudiencia)) continue;
    audienciasVistas.add(claveAudiencia);
    g.rows.push(r);
  }
  return [...mapa.values()];
}

function plural(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

// ── Una fila de audiencia: nombre PLANO (no enlace) + materia + meta Mono + fuente ─
function FilaAudiencia({ row }: { row: LobbyEnTramitacionRow }) {
  const fecha = fechaValida(row.fecha_reunion);
  const href = safeExternalHref(row.enlace_detalle);
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 py-3 border-t first:border-t-0">
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <p className="text-base leading-relaxed">
          {/* Nombre del parlamentario: TEXTO PLANO, NUNCA enlazado en este carril. */}
          <span className="text-base font-semibold">{row.parlamentario_nombre}</span>
          {row.materia && (
            <span className="text-sm text-muted-foreground"> — {row.materia}</span>
          )}
        </p>
        {/*
          Meta factual de la reunión en Mono (§9.1-safe): fecha de la audiencia +
          semana ISO de la coincidencia. Sin verbo causal. Si la fecha no parsea,
          se omite el fragmento de fecha (honest-state), nunca "Invalid Date".
        */}
        <span className="font-mono text-sm text-muted-foreground">
          {fecha
            ? `Reunión registrada el ${fechaCorta(fecha)} · semana ${row.semana_iso}`
            : `Reunión registrada · semana ${row.semana_iso}`}
        </span>
      </div>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center min-h-11 text-sm underline underline-offset-2 text-accent-product"
        >
          Ver fuente oficial ↗
        </a>
      )}
    </li>
  );
}

// ── Vista pura (RTL la testea con fixtures) ─────────────────────────────────────
export function LobbyEnTramitacionView({
  rows,
}: {
  rows: LobbyEnTramitacionRow[];
}) {
  // Caveat anti-causal — ÚNICO, arriba, sobre banda `--muted`. Declara la
  // coincidencia temporal explícitamente (52-UI-SPEC §SC2, banned-vocab-safe).
  const caveat = (
    <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground mb-4">
      Se muestran por coincidencia de fechas: en la misma semana en que una
      comisión vio este proyecto. La coincidencia temporal no implica relación
      entre la reunión y la tramitación del proyecto.
    </p>
  );

  // El h2 vive DENTRO del componente (no en la page) para que el degrade honesto
  // path-1 (Section → null) NO deje un heading huérfano sin banda: nodo ausente.
  const heading = (
    <h2 className="text-xl font-semibold mb-4">
      Reuniones de lobby registradas en el mismo período
    </h2>
  );

  // Empty honesto — la RPC respondió con 0 coincidencias. NUNCA se lee como
  // "limpio" ni "transparente"; heading + caveat se mantienen.
  if (rows.length === 0) {
    return (
      <>
        {heading}
        {caveat}
        <p className="text-sm text-muted-foreground">
          No se registran reuniones de lobby en las semanas en que una comisión
          vio este proyecto, según las fuentes consultadas.
        </p>
      </>
    );
  }

  const grupos = agruparPorSemana(rows);
  // Total DEDUPLICADO (WR-02): reuniones reales, no filas del join por comisión.
  const total = grupos.reduce((n, g) => n + g.rows.length, 0);

  return (
    <div className="space-y-6">
      {heading}
      {caveat}

      {/*
        Summary de conteo NEUTRO. Una sola semana con una sola comisión → línea
        única con {N} en Mono. En otro caso → una línea por semana (semana +
        comisión(es) + conteo), cada {N} en Mono. El {N} cuenta reuniones
        DEDUPLICADAS (WR-02). Cero ranking / score / "los más …".
      */}
      {grupos.length === 1 && grupos[0]!.comisiones.length === 1 ? (
        <p className="text-base leading-relaxed">
          En la misma semana en que la comisión vio este proyecto se registraron{" "}
          <span className="font-mono">{total}</span>{" "}
          {plural(total, "reunión", "reuniones")} de lobby.
        </p>
      ) : (
        <ul className="space-y-1 text-base leading-relaxed">
          {grupos.map((g) => (
            <li key={g.semanaIso}>
              Semana <span className="font-mono">{g.semanaIso}</span> ·{" "}
              {plural(g.comisiones.length, "comisión", "comisiones")}{" "}
              {g.comisiones.join(", ")}:{" "}
              <span className="font-mono">{g.rows.length}</span>{" "}
              {plural(g.rows.length, "reunión", "reuniones")}.
            </li>
          ))}
        </ul>
      )}

      {grupos.map((g) => (
        <ul key={`filas-${g.semanaIso}`} className="space-y-0">
          {g.rows.map((r, idx) => (
            <FilaAudiencia key={`${g.semanaIso}-${r.parlamentario_nombre}-${idx}`} row={r} />
          ))}
        </ul>
      ))}
    </div>
  );
}

// ── Server Component: lee el RPC y degrada honesto de 3 caminos ─────────────────
export async function LobbyEnTramitacionSection({ boletin }: { boletin: string }) {
  const sb = createServerSupabase();

  const { data, error } = await sb.rpc("lobby_en_tramitacion", {
    p_boletin: boletin,
  });

  // Camino 1: la función NO existe (PGRST202 = function-not-found de PostgREST).
  // SOLO ese código exacto → nodo AUSENTE del HTML (null), sin 500. NO se usa un
  // fallback por regex de mensaje: "column ... does not exist" / "relation ...
  // does not exist" son errores REALES de schema que deben ir al camino 3 (throw),
  // no ocultar la sección en silencio (WR-01, degrade-honesto).
  if (error?.code === "PGRST202") {
    return null;
  }

  // Camino 3: un error real de DB/red ≠ "sin coincidencias". Se lanza para la UI
  // de error honesta (#34); NUNCA se degrada a empty (falsa exoneración). Sin
  // blanket-catch: sólo el código específico de función-ausente cae al camino 1.
  if (error) {
    throw new Error(
      `lobby_en_tramitacion falló para ${boletin}: ${error.message}`,
    );
  }

  // Camino 2: data (incluye 0 filas → empty honesto dentro de la vista).
  const rows = (data as LobbyEnTramitacionRow[] | null) ?? [];
  return <LobbyEnTramitacionView rows={rows} />;
}
