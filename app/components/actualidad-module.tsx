import Link from "next/link";

import { createServerSupabase } from "@/lib/supabase";
import { fechaCorta, conteoVotacion } from "@/lib/format";
import { safeExternalHref } from "@/lib/utils";
import { urgenciaVigente } from "@/components/estado-actual-block";
import { BentoTile } from "@/components/bento/bento-tile";
import type {
  ProyectoRow,
  TramitacionEventoRow,
  VotacionRow,
} from "@/lib/types";

/**
 * ActualidadModule — 3 bloques de actualidad del home `/` como BentoTile (Phase 78).
 *
 * Migrados desde el módulo lineal (Phase 52/53) a tiles del BentoGrid:
 *   1. "Votado esta semana"          span-4 — barra cívica por cámara
 *   2. "Urgencias vigentes"          span-2 — chip pill del tipo
 *   3. "Última actualización de datos" span-6 — strip frescura (omitido si 0 items)
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ REGLAS DURAS (52-UI-SPEC §SC4 / §Anti-insinuación)                          │
 * │  A. Cada bloque degrada a SU empty-state honesto propio e independiente;    │
 * │     la barra cívica se OMITE si camara es null (nunca se adivina cámara).   │
 * │  B. CONTEO NEUTRO: tallies en Mono en-dash (`conteoVotacion`); CERO         │
 * │     ranking / score / "los más …" / porcentaje-como-veredicto / "quién     │
 * │     ganó" (T-52-13).                                                        │
 * │  C. Lecturas 100% `.from()` sobre tablas NO-PII (votacion / proyecto /      │
 * │     tramitacion_evento / citacion / lobby_audiencia / proyecto_ficha). El   │
 * │     bloque 3 JAMÁS lee `fecha_captura` de tablas PII (aporte / contrato /   │
 * │     declaracion* / donante / cruce_senal / parlamentario) — el guard falla  │
 * │     (T-52-12, Pitfall 4).                                                   │
 * │  D. Un error REAL de lectura → `throw` (#34); NUNCA `?? []` que fabrique     │
 * │     "sin datos". El empty-state honesto es SOLO el path de 0 filas legítimo │
 * │     (T-52-15).                                                              │
 * │  E. Provenance por item: un dato sin enlace de traza no se muestra suelto.  │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Es un Server Component (RSC), NUNCA "use client". Cero JS cliente nuevo, cero
 * carrusel, cero RPC nueva. Las vistas puras (`*View`) son testeables con fixtures.
 */

// ── Inicio de la semana ISO (lunes 00:00 local) ────────────────────────────────
export function inicioSemanaIso(hoy: Date = new Date()): Date {
  const d = new Date(hoy);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=domingo … 6=sábado
  const diff = dow === 0 ? 6 : dow - 1; // días desde el lunes
  d.setDate(d.getDate() - diff);
  return d;
}

// ── Fecha ISO parseable → Date válida, o null (nunca "Invalid Date") ────────────
function fechaValida(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ── Helper: label legible de cámara (diputados → "Cámara", senado → "Senado") ───
function camaraLabel(c: "diputados" | "senado"): string {
  return c === "diputados" ? "Cámara" : "Senado";
}

// ════════════════════════════════════════════════════════════════════════════
// BLOQUE 1 — "Votado esta semana" (span-4)
// ════════════════════════════════════════════════════════════════════════════

export interface VotadoItem {
  boletin: string;
  /** Título del proyecto (lookup a `proyecto`); null → se muestra el boletín. */
  titulo: string | null;
  /** Desenlace factual; null → se OMITE la frase, se conserva el hecho fechado. */
  resultado: string | null;
  totalSi: number;
  totalNo: number;
  fecha: Date;
  /** Enlace a la fuente oficial de la votación. */
  enlace: string | null;
  /** Cámara que votó; null → barra omitida honestamente (nunca se adivina). */
  camara: "diputados" | "senado" | null;
}

export function VotadoEstaSemanaView({ items }: { items: VotadoItem[] }) {
  return (
    <BentoTile variant="default" span={4} asChild>
      <section className="p-6">
        <h2 className="text-lg font-semibold mb-4">Votado esta semana</h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin votaciones registradas esta semana en las fuentes consultadas.
          </p>
        ) : (
          <ul>
            {items.map((it, idx) => {
              const href = safeExternalHref(it.enlace);
              return (
                <li
                  key={`${it.boletin}-${idx}`}
                  className="flex gap-[14px] items-start border-t border-border pt-4 first:border-t-0 first:pt-0"
                >
                  {/* Barra cívica 3px — provenance de cámara (omitida si unknown) */}
                  {it.camara && (
                    <span
                      aria-hidden="true"
                      className={`w-[3px] self-stretch rounded-[2px] ${
                        it.camara === "diputados"
                          ? "bg-[var(--camara)]"
                          : "bg-[var(--senado)]"
                      }`}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-semibold leading-snug">
                      {it.titulo ?? (
                        <span className="font-mono">{it.boletin}</span>
                      )}
                    </h3>
                    {/* Desenlace factual — se OMITE si `resultado` es null */}
                    {it.resultado && (
                      <p className="mt-1 text-[13px]">
                        El proyecto fue {it.resultado}{" "}
                        <span className="font-mono">
                          {conteoVotacion(it.totalSi, it.totalNo)}
                        </span>
                        .
                      </p>
                    )}
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {it.camara
                        ? `${fechaCorta(it.fecha)} · ${camaraLabel(it.camara)}`
                        : `Votación del ${fechaCorta(it.fecha)}`}
                    </p>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex min-h-11 items-center text-[13px] underline underline-offset-2 text-accent-product"
                      >
                        Ver fuente oficial ↗
                      </a>
                    ) : (
                      <Link
                        href={`/proyecto/${it.boletin}`}
                        className="mt-1 inline-flex min-h-11 items-center text-[13px] underline underline-offset-2 text-accent-product"
                      >
                        Ver proyecto →
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </BentoTile>
  );
}

export async function VotadoEstaSemana() {
  const sb = createServerSupabase();

  // Bounded: votaciones de la semana ISO vigente, más recientes primero.
  const { data, error } = await sb
    .from("votacion")
    .select("boletin, resultado, total_si, total_no, fecha, enlace, camara")
    .gte("fecha", inicioSemanaIso().toISOString())
    .order("fecha", { ascending: false })
    .limit(6);

  // #34: un error real de lectura ≠ "sin votaciones". Se lanza (nunca `?? []`).
  if (error) {
    throw new Error(`VotadoEstaSemana: no se pudo leer votacion: ${error.message}`);
  }

  const votaciones =
    (data as Pick<
      VotacionRow,
      "boletin" | "resultado" | "total_si" | "total_no" | "fecha" | "enlace" | "camara"
    >[] | null) ?? [];

  // Lookup de títulos (NO-PII) por boletín; título ausente → se muestra el boletín.
  const titulos = await leerTitulos(
    sb,
    votaciones.map((v) => v.boletin),
  );

  const items: VotadoItem[] = votaciones
    .map((v): VotadoItem | null => {
      const fecha = fechaValida(v.fecha);
      if (!fecha) return null; // fecha inválida → no se fabrica el hecho fechado
      return {
        boletin: v.boletin,
        titulo: titulos.get(v.boletin) ?? null,
        resultado: v.resultado?.trim() || null,
        totalSi: v.total_si,
        totalNo: v.total_no,
        fecha,
        enlace: v.enlace,
        camara: v.camara ?? null,
      };
    })
    .filter((x): x is VotadoItem => x !== null);

  return <VotadoEstaSemanaView items={items} />;
}

// ════════════════════════════════════════════════════════════════════════════
// BLOQUE 2 — "Urgencias vigentes" span-2 (REUSA `urgenciaVigente`)
// ════════════════════════════════════════════════════════════════════════════

export interface UrgenciaItem {
  boletin: string;
  titulo: string | null;
  tipo: string;
  desde: Date;
}

export function UrgenciasVigentesView({ items }: { items: UrgenciaItem[] }) {
  return (
    <BentoTile variant="default" span={2} asChild>
      <section className="p-6">
        <h2 className="text-lg font-semibold mb-4">Urgencias vigentes</h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay urgencias vigentes registradas esta semana.
          </p>
        ) : (
          <ul>
            {items.map((it, idx) => (
              <li
                key={`${it.boletin}-${idx}`}
                className="border-t border-border pt-3 first:border-t-0 first:pt-0"
              >
                {/* Chip pill del tipo verbatim */}
                <span className="inline-flex items-center px-[9px] py-0.5 font-mono text-[11px] font-medium text-accent-product bg-accent-product-soft rounded-full">
                  {it.tipo}
                </span>
                <h3 className="mt-1 text-sm font-semibold leading-snug">
                  {it.titulo ?? (
                    <span className="font-mono">{it.boletin}</span>
                  )}
                </h3>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  desde {fechaCorta(it.desde)}
                </p>
                <Link
                  href={`/proyecto/${it.boletin}`}
                  className="mt-1 inline-flex min-h-11 items-center text-sm underline underline-offset-2 text-accent-product"
                >
                  Ver proyecto →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </BentoTile>
  );
}

export async function UrgenciasVigentes() {
  const sb = createServerSupabase();

  // Bounded: eventos de urgencia más recientes.
  const { data, error } = await sb
    .from("tramitacion_evento")
    .select("*")
    .ilike("descripcion", "%urgencia%")
    .order("fecha", { ascending: false })
    .limit(120);

  // #34: un error real de lectura ≠ "sin urgencias". Se lanza (nunca `?? []`).
  if (error) {
    throw new Error(
      `UrgenciasVigentes: no se pudo leer tramitacion_evento: ${error.message}`,
    );
  }

  const eventos = (data as TramitacionEventoRow[] | null) ?? [];

  // Agrupa por boletín y deriva la urgencia vigente reusando el helper F51.
  const porBoletin = new Map<string, TramitacionEventoRow[]>();
  for (const e of eventos) {
    const arr = porBoletin.get(e.boletin);
    if (arr) arr.push(e);
    else porBoletin.set(e.boletin, [e]);
  }

  const vigentes: { boletin: string; tipo: string; desde: Date }[] = [];
  for (const [boletin, evs] of porBoletin) {
    const urg = urgenciaVigente(evs);
    if (urg) vigentes.push({ boletin, tipo: urg.tipo, desde: urg.desde });
  }

  // Más recientes primero; acotado a un puñado.
  vigentes.sort((a, b) => b.desde.getTime() - a.desde.getTime());
  const top = vigentes.slice(0, 6);

  const titulos = await leerTitulos(
    sb,
    top.map((v) => v.boletin),
  );

  const items: UrgenciaItem[] = top.map((v) => ({
    boletin: v.boletin,
    titulo: titulos.get(v.boletin) ?? null,
    tipo: v.tipo,
    desde: v.desde,
  }));

  return <UrgenciasVigentesView items={items} />;
}

// ════════════════════════════════════════════════════════════════════════════
// BLOQUE 3 — "Última actualización de datos" strip span-6
// ════════════════════════════════════════════════════════════════════════════

export interface FrescuraItem {
  fuente: string;
  fecha: Date;
}

export function UltimaActualizacionView({ items }: { items: FrescuraItem[] }) {
  // OMITIR el tile cuando no hay datos (decisión Phase 78 — "condicional si no hay datos")
  if (items.length === 0) return null;

  return (
    <BentoTile variant="default" span={6} asChild>
      <section className="py-[18px] px-6 flex items-center flex-wrap gap-y-2.5 gap-x-[22px]">
        <span className="text-[13px] font-semibold text-foreground mr-1.5">
          Última actualización de datos
        </span>
        {items.map((it) => (
          <span key={it.fuente} className="inline-flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full bg-accent-product"
              aria-hidden="true"
            />
            <span className="text-[13px] text-muted-foreground">{it.fuente}</span>
            <span className="font-mono text-[13px] text-foreground">
              {fechaCorta(it.fecha)}
            </span>
          </span>
        ))}
      </section>
    </BentoTile>
  );
}

// Tablas NO-PII con su etiqueta legible. NUNCA se incluye una tabla PII (aporte /
// contrato / declaracion* / donante / cruce_senal / parlamentario): el guard falla
// y sería fuga (T-52-12). Transparencia de frescura, NO ranking de actividad.
const FUENTES_FRESCURA: { tabla: string; fuente: string }[] = [
  { tabla: "votacion", fuente: "Votaciones" },
  { tabla: "proyecto", fuente: "Proyectos de ley" },
  { tabla: "tramitacion_evento", fuente: "Tramitación" },
  { tabla: "citacion", fuente: "Citaciones" },
  { tabla: "lobby_audiencia", fuente: "Lobby" },
  { tabla: "proyecto_ficha", fuente: "Fichas de proyecto" },
];

export async function UltimaActualizacion() {
  const sb = createServerSupabase();

  const resultados = await Promise.all(
    FUENTES_FRESCURA.map(async ({ tabla, fuente }) => {
      const { data, error } = await sb
        .from(tabla)
        .select("fecha_captura")
        .order("fecha_captura", { ascending: false })
        .limit(1)
        .maybeSingle<{ fecha_captura: string | null }>();

      // #34: un error real de lectura ≠ "sin frescura". Se lanza (nunca `?? []`).
      if (error) {
        throw new Error(
          `UltimaActualizacion: no se pudo leer ${tabla}: ${error.message}`,
        );
      }

      const fecha = fechaValida(data?.fecha_captura);
      return fecha ? ({ fuente, fecha } satisfies FrescuraItem) : null;
    }),
  );

  const items = resultados.filter((x): x is FrescuraItem => x !== null);
  return <UltimaActualizacionView items={items} />;
}

// ── Lookup de títulos de proyecto por boletín (tabla NO-PII) ────────────────────
async function leerTitulos(
  sb: ReturnType<typeof createServerSupabase>,
  boletines: string[],
): Promise<Map<string, string>> {
  const unicos = [...new Set(boletines)].filter(Boolean);
  if (unicos.length === 0) return new Map();

  const { data, error } = await sb
    .from("proyecto")
    .select("boletin, titulo")
    .in("boletin", unicos);

  if (error) {
    throw new Error(`leerTitulos: no se pudo leer proyecto: ${error.message}`);
  }

  const rows = (data as Pick<ProyectoRow, "boletin" | "titulo">[] | null) ?? [];
  const mapa = new Map<string, string>();
  for (const r of rows) {
    const t = r.titulo?.trim();
    if (t) mapa.set(r.boletin, t);
  }
  return mapa;
}
