import { createServerSupabase } from "@/lib/supabase";
import { fechaCorta } from "@/lib/format";
import { diaCalendarioCitacion } from "@/lib/dia-calendario";
import { BentoTile } from "@/components/bento/bento-tile";

/**
 * PanelActualidad — panel de actualidad de la landing `/` (Phase 100, PANEL-02).
 *
 * Near-clone de `actualidad-module.tsx`: Server Component (RSC puro, NUNCA
 * "use client") con el split async/View — el async lee la RPC bounded y las
 * vistas puras (`*View`) son testeables con fixtures `SenalRow[]` SIN tocar la DB.
 *
 * A diferencia del germen, NO lee `.from()` tablas crudas: consume las señales
 * YA precomputadas por la RPC `actualidad_senales_panel` (0066). CERO agregación
 * on-read (SEN-02 LOCKED): la RPC ya devuelve conteo / fecha_max / cobertura_camara.
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ REGLAS DURAS (100-UI-SPEC §Honesty Contract / §Anti-ranking — LOCKED)       │
 * │  A. La barra cívica 3px se OMITE si la cámara es null (nunca se adivina).   │
 * │  B. CONTEO NEUTRO: framing factual ("N trámites en 7 días"); CERO           │
 * │     "top / los más / la cámara más activa"; NUNCA ordenar cobertura_camara │
 * │     por conteo cross-cámara (T-52-13).                                      │
 * │  C. supresion_causa != null → la CAUSA es el cuerpo del tile, VERBATIM;     │
 * │     NUNCA lista vacía, NUNCA "0" mudo, NUNCA "sin movimiento" (SEN-03).     │
 * │  D. Error REAL de lectura → `throw` (#34); NUNCA `?? []` que fabrique       │
 * │     "sin señales". `[]` es SOLO el path legítimo de 0 filas.                │
 * │  E. Cada tile lleva fuente + fecha_max; un dato sin fuente trazable no se   │
 * │     muestra suelto.                                                         │
 * │  F. agrupacion_materia con materia='(sin materia)' se renderiza verbatim,   │
 * │     sin romper ni fabricar un tema (degradación honesta del corpus).        │
 * └───────────────────────────────────────────────────────────────────────────┘
 */

// ── Contrato de datos de la RPC (9 columnas de 0066_actualidad_rpc.sql:32-42) ───
export interface SenalRow {
  tipo_senal: string; // 'velocity'|'nuevos_ingresos'|'urgencias'|'agenda_citacion'|'agenda_sala'|'archivados'|'agrupacion_materia'
  ventana: string | null; // '7d' | '30d' | 'futuras' | null
  conteo: number;
  cobertura_camara: string | null; // 'C.Diputados' | 'Senado' | '(sin cámara)' | '2022-2026 (piso de corpus)' | null
  materia: string | null; // '(sin materia)' tolerado
  cluster_id: number | null;
  fecha_max: string | null; // timestamptz ISO
  supresion_causa: string | null; // NULL = activa; texto = suprimida CON causa
  evidencia: Record<string, unknown>; // jsonb (deserializado por supabase-js)
}

// ── Copy LOCKED (100-UI-SPEC §Copywriting) — títulos por tipo_senal ─────────────
const TITULO: Record<string, string> = {
  velocity: "Movimiento reciente",
  urgencias: "Urgencias del Ejecutivo",
  agenda_citacion: "Citaciones próximas",
  agenda_sala: "Sesiones de sala",
  nuevos_ingresos: "Nuevos ingresos",
  archivados: "Archivos y retiros",
  agrupacion_materia: "Por materia",
};

// Framing factual por tipo (100-UI-SPEC §Copywriting — denylist-safe). La fórmula
// es "{conteo} {FRAMING}"; jamás "top / los más / la cámara más activa".
const FRAMING: Record<string, string> = {
  velocity: "trámites en 7 días",
  urgencias: "urgencias fechadas en 30 días",
  agenda_citacion: "citaciones próximas",
  agenda_sala: "sesiones de sala próximas",
  nuevos_ingresos: "proyectos ingresados en 7 días",
  archivados: "movimientos de archivo o retiro fechados (30 días)",
  agrupacion_materia: "proyectos",
};

// Orden de presentación de los tiles (DOM = orden de colapso 390px). Cada grupo
// se muestra tal como llega; NO se reordena por conteo entre cámaras (T-52-13).
const ORDEN_TIPO: string[] = [
  "velocity",
  "urgencias",
  "agenda_citacion",
  "agenda_sala",
  "nuevos_ingresos",
  "archivados",
  "agrupacion_materia",
];

// Los tipos de agenda leen `fecha_max` como date-only-midnight-UTC (contrato
// dia-calendario.ts): la parte fecha UTC ES el día chileno. El resto son
// timestamps reales con hora → fechaCorta (conversión de zona correcta).
const TIPOS_AGENDA = new Set(["agenda_citacion", "agenda_sala"]);

// ── Fecha ISO parseable → Date válida, o null (nunca "Invalid Date") ────────────
function fechaValida(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Rótulo de fecha para una señal, respetando el contrato por tipo:
 *   - agenda_* → date-only-midnight-UTC → `diaCalendarioCitacion` (sin tz shift).
 *   - resto    → timestamp real → `fechaCorta` (es-CL, tz Chile).
 * Devuelve null si la fecha no es parseable (el caller omite el rótulo).
 */
export function rotuloFecha(tipo: string, iso: string | null): string | null {
  if (!iso) return null;
  if (TIPOS_AGENDA.has(tipo)) {
    // Día publicado por la fuente (parte fecha UTC), sin conversión de zona.
    return diaCalendarioCitacion(iso);
  }
  const d = fechaValida(iso);
  return d ? fechaCorta(d) : null;
}

/**
 * Etiqueta de fuente para el footer del tile. Derivada de tipo_senal /
 * cobertura_camara (la RPC no re-emite `origen`/`dataset`). Anti-ranking: la
 * cobertura declara la cámara como PROVENIENCIA, nunca como "más activa".
 */
export function fuenteLabel(tipo: string, cobertura: string | null): string {
  if (TIPOS_AGENDA.has(tipo)) return "Agenda del Congreso";
  if (tipo === "velocity" || tipo === "archivados") return "Tramitación";
  if (tipo === "urgencias") return "Urgencias del Ejecutivo";
  if (tipo === "nuevos_ingresos") return "Proyectos de ley";
  if (tipo === "agrupacion_materia") return "Proyectos de ley";
  // Fallback trazable: la cobertura declarada, o un genérico honesto.
  return cobertura ?? "Fuentes del Congreso";
}

// ── Barra cívica 3px: proveniencia de cámara (omitida si desconocida) ───────────
// LOCKED: `bg-[var(--camara)]` / `bg-[var(--senado)]` (Tailwind v4; bare
// `-[--camara]` FALLA guard III). Deriva la cámara del literal de cobertura.
function claseCamara(cobertura: string | null): string | null {
  if (!cobertura) return null;
  const c = cobertura.toLowerCase();
  if (c.includes("diputad") || c.includes("cámara") || c.includes("camara")) {
    return "bg-[var(--camara)]";
  }
  if (c.includes("senado")) return "bg-[var(--senado)]";
  return null; // '(sin cámara)' / piso de corpus → sin barra (regla A)
}

// ════════════════════════════════════════════════════════════════════════════
// Vista pura de un tile de señal — testeable con fixtures SenalRow[]
// ════════════════════════════════════════════════════════════════════════════

export function TileSenal({
  tipo,
  filas,
  span = 2,
}: {
  tipo: string;
  filas: SenalRow[];
  span?: 2 | 4 | 6;
}) {
  const titulo = TITULO[tipo] ?? tipo;
  const framing = FRAMING[tipo] ?? "";

  return (
    <BentoTile variant="default" span={span} asChild>
      <section className="p-6">
        <h2 className="text-lg font-semibold mb-4">{titulo}</h2>
        <ul>
          {filas.map((f, idx) => {
            // ── SUPRESIÓN (regla C): la causa ES el cuerpo, VERBATIM ──────────
            if (f.supresion_causa) {
              const rotulo = rotuloFecha(tipo, f.fecha_max);
              return (
                <li
                  key={idx}
                  className="border-t border-border pt-3 first:border-t-0 first:pt-0"
                >
                  <p className="text-sm text-muted-foreground">
                    {f.supresion_causa}
                    {rotulo && (
                      <>
                        {" — en las fuentes consultadas al "}
                        <span className="font-mono">{rotulo}</span>
                      </>
                    )}
                  </p>
                </li>
              );
            }

            // ── ACTIVA: conteo factual + cobertura declarada + fecha ──────────
            const barra = claseCamara(f.cobertura_camara);
            const rotulo = rotuloFecha(tipo, f.fecha_max);
            const fuente = fuenteLabel(tipo, f.cobertura_camara);
            // agrupacion_materia: el sujeto del conteo es la materia (verbatim,
            // '(sin materia)' tolerado); no se fabrica un tema (regla F).
            const materia =
              tipo === "agrupacion_materia" ? f.materia : null;

            return (
              <li
                key={idx}
                className="flex gap-[14px] items-start border-t border-border pt-4 first:border-t-0 first:pt-0"
              >
                {/* Barra cívica 3px — proveniencia (omitida si cámara null) */}
                {barra && (
                  <span
                    aria-hidden="true"
                    className={`w-[3px] self-stretch rounded-[2px] ${barra}`}
                  />
                )}
                <div className="flex-1 min-w-0">
                  {materia && (
                    <h3 className="text-[15px] font-semibold leading-snug">
                      {materia}
                    </h3>
                  )}
                  <p className="mt-1 text-[13px]">
                    <span className="font-mono">{f.conteo}</span> {framing}
                  </p>
                  {/* Chip de cobertura: SOLO la proveniencia de cámara declarada
                      (literal ciudadano). NUNCA el token interno de ventana
                      ("30d"/"futuras"): la ventana ya la comunican el framing
                      del conteo y el footer "datos al {fecha}" (WR-01). */}
                  {f.cobertura_camara && (
                    <span className="mt-1 inline-flex items-center px-[9px] py-0.5 font-mono text-[11px] font-medium text-accent-product bg-accent-product-soft rounded-full">
                      {f.cobertura_camara}
                    </span>
                  )}
                  {/* Footer de proveniencia (regla E) — SIEMPRE fuente; fecha si hay */}
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    Fuente: {fuente}
                    {rotulo && <> · datos al {rotulo}</>}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </BentoTile>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Server Component: lee la RPC precomputada, agrupa por tipo_senal, renderiza
// ════════════════════════════════════════════════════════════════════════════

const SPAN_TIPO: Record<string, 2 | 4 | 6> = {
  velocity: 4,
  urgencias: 2,
  agenda_citacion: 4,
  agenda_sala: 4,
  nuevos_ingresos: 2,
  archivados: 2,
  agrupacion_materia: 2,
};

export async function PanelActualidad() {
  const sb = createServerSupabase();

  const { data, error } = await sb.rpc("actualidad_senales_panel", {
    p_tipo: null,
  });

  // #34: un error real de lectura ≠ "sin señales". Se lanza (NUNCA `?? []`).
  if (error) {
    throw new Error(
      `PanelActualidad: no se pudo leer actualidad_senales_panel: ${error.message}`,
    );
  }

  // `[]` SOLO representa el path legítimo de 0 filas (regla D).
  const filas = (data as SenalRow[] | null) ?? [];

  // Agrupa por tipo_senal preservando el orden de llegada (la RPC ya ordena por
  // tipo_senal, cobertura, cluster; NO se reordena por conteo — T-52-13).
  const porTipo = new Map<string, SenalRow[]>();
  for (const f of filas) {
    const arr = porTipo.get(f.tipo_senal);
    if (arr) arr.push(f);
    else porTipo.set(f.tipo_senal, [f]);
  }

  // agenda_citacion y agenda_sala son señales DISTINTAS: cada `tipo_senal` produce
  // su propio TileSenal (`porTipo` keyea por tipo_senal). Llevan títulos distintos
  // ("Citaciones próximas" / "Sesiones de sala"), NO se fusionan. El tipo_senal por
  // fila se conserva para el rótulo de fecha date-only correcto (TIPOS_AGENDA).
  const tiposPresentes = ORDEN_TIPO.filter((t) => porTipo.has(t));

  return (
    <>
      {tiposPresentes.map((tipo) => (
        <TileSenal
          key={tipo}
          tipo={tipo}
          filas={porTipo.get(tipo) ?? []}
          span={SPAN_TIPO[tipo] ?? 2}
        />
      ))}
    </>
  );
}
