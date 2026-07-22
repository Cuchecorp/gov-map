import Link from "next/link";

import { CamaraChip } from "@/components/camara-chip";
import { PartidoChip } from "@/components/partido-chip";
import { formatNombre } from "@/lib/format";
import type { CrossLinkRow } from "@/lib/types";

/**
 * CrossLinkBloque — bloque de cross-links FACTUALES anti-causales (91-UI-SPEC §4,
 * BIO-04). Cada bloque es su propia `<section className="mt-12">` (carril hermano
 * — el mt-12 es la frontera anti-insinuación LOCKED). Un parlamentario de un bloque
 * y un dato de otro dominio JAMÁS comparten un `<article>/<Card>/<li>`.
 *
 * REGLAS LOCKED (§4 + §Copywriting):
 *  - LEYENDA anti-causal 1× por bloque, VERBATIM: nunca insinúa afinidad/coordinación
 *    /causalidad. La relación es DECLARADA por una fuente oficial (militancia/
 *    comisión/autoría), no inferida.
 *  - ORDEN NEUTRAL: se preserva EXACTAMENTE el orden que emite la RPC (alfabético/
 *    cámara). NUNCA re-ordenar por `n_proyectos` — eso sería ranking de afinidad
 *    (prohibido).
 *  - CONTEO HONESTO: "{N} parlamentarios comparten {X}." con N = filas totales que
 *    emite la RPC (bounded LIMIT en canal de datos, Plan 01). NO es un ranking.
 *  - LÍMITE VISUAL 8: máx 8 filas en la ficha; si N>8 → "Ver los N" navega al
 *    directorio pre-filtrado (no expande una lista infinita en la ficha).
 *  - BLOQUE VACÍO (N=0): la `<section>` entera se OMITE (return null) — nunca se
 *    pinta una `<section>` vacía.
 *  - AUTO-EXCLUSIÓN: la garantiza la RPC (where <> p_id) — el propio parlamentario
 *    nunca aparece en sus propios bloques.
 *  - PartidoChip por fila OPCIONAL: útil en "misma comisión"/"misma zona" (el partido
 *    añade contexto); redundante en "mismo partido" → se OMITE ahí (mostrarPartido=false).
 *
 * Presentacional puro (server-friendly): recibe filas ya serializadas por el server,
 * NUNCA toca Supabase. La leyenda anti-causal se exporta para que el linter
 * anti-insinuación la reste de NEGACIONES_LOCKED (contiene "afinidad", término
 * prohibido en contexto que lo NIEGA).
 */

/**
 * Leyenda anti-causal LOCKED (91-UI-SPEC §Copywriting). VERBATIM 1× por bloque.
 * CONTIENE "afinidad" en un contexto que lo NIEGA → el linter la resta antes de
 * matchear (NEGACIONES_LOCKED), mismo tratamiento que las leyendas VOTO/MONEY.
 */
export const LEYENDA_CROSS_LINK =
  "Relación DECLARADA por una fuente oficial (militancia, comisión o autoría de proyecto). No implica afinidad, coordinación ni causalidad.";

/** Límite visual de filas por bloque en la ficha (§4). */
const LIMITE_VISUAL = 8;

export interface CrossLinkFila extends CrossLinkRow {
  /** Provenance del partido para el PartidoChip opcional por fila (omitido si null). */
  partido?: string | null;
  partido_fecha_captura?: string | null;
  partido_origen?: string | null;
}

export interface CrossLinkBloqueProps {
  /** Heading del bloque (LOCKED §Copywriting): "Del mismo partido", etc. */
  heading: string;
  /** Texto de conteo honesto: "{N} parlamentarios comparten {X}." */
  conteoTexto: string;
  /**
   * Filas en el orden EXACTO que emite la RPC. Ya bounded (LIMIT) — aquí sólo se
   * recorta a LIMITE_VISUAL para el render; el conteo honesto refleja el total.
   */
  filas: CrossLinkFila[];
  /** Total real que comparte el eje (para "Ver los N" y para el conteo). */
  totalN: number;
  /** Destino del "Ver los N" (directorio pre-filtrado). Si null, no se muestra. */
  verTodosHref: string | null;
  /** PartidoChip por fila: false en "mismo partido" (redundante). Default true. */
  mostrarPartido?: boolean;
}

export function CrossLinkBloque({
  heading,
  conteoTexto,
  filas,
  totalN,
  verTodosHref,
  mostrarPartido = true,
}: CrossLinkBloqueProps) {
  // Bloque vacío (N=0) → la <section> entera se OMITE (§4, §6).
  if (filas.length === 0) return null;

  // Orden NEUTRAL preservado: NO re-ordenar. Sólo recortar al límite visual.
  const visibles = filas.slice(0, LIMITE_VISUAL);
  const excede = totalN > LIMITE_VISUAL && verTodosHref != null;

  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold">{heading}</h2>
      {/* Leyenda anti-causal LOCKED (VERBATIM, 1× por bloque). */}
      <p className="mt-2 text-sm text-muted-foreground">{LEYENDA_CROSS_LINK}</p>
      {/* Conteo honesto (neutro, nunca ranking). */}
      <p className="mt-1 text-sm text-muted-foreground">{conteoTexto}</p>
      <ul className="mt-4 space-y-3">
        {visibles.map((p) => (
          <li key={p.id}>
            <div className="flex flex-wrap items-center gap-2">
              <CamaraChip camara={p.camara} />
              <Link
                href={`/parlamentario/${p.id}`}
                className="text-base font-semibold text-accent-product underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-product"
              >
                {formatNombre(p.nombre)}
              </Link>
              {mostrarPartido && (
                <PartidoChip
                  partido={p.partido ?? null}
                  fechaCaptura={p.partido_fecha_captura ?? null}
                  origen={p.partido_origen ?? null}
                />
              )}
              {/* Comisión compartida (solo co-comisión): dato factual del eje. */}
              {p.comision_nombre && (
                <span className="text-sm text-muted-foreground">
                  {p.comision_nombre}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {excede && (
        <a
          href={verTodosHref}
          className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-accent-product underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-product"
        >
          Ver los {totalN}
        </a>
      )}
    </section>
  );
}
