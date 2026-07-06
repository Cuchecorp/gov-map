import Link from "next/link";
import { Suspense } from "react";

import { createServerSupabase } from "@/lib/supabase";
import { fechaCorta, conteoVotacion } from "@/lib/format";
import { safeExternalHref } from "@/lib/utils";
import { sourceLabel } from "@/lib/types";
import { urgenciaVigente } from "@/components/estado-actual-block";
import type {
  ProyectoRow,
  TramitacionEventoRow,
  VotacionRow,
} from "@/lib/types";

/**
 * ActualidadModule — módulo de actualidad del home `/` (SC4, 52-UI-SPEC §SC4).
 *
 * Tres bloques compactos server-rendered BAJO el hero que convierten la portada
 * de "solo buscador" en razón de retorno diario (diagnóstico §2.5):
 *   1. "Votado esta semana"          — últimas votaciones con desenlace factual.
 *   2. "Urgencias vigentes"          — urgencias en vigor (REUSA `urgenciaVigente`).
 *   3. "Última actualización de datos" — `max(fecha_captura)` por fuente NO-PII.
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ REGLAS DURAS (52-UI-SPEC §SC4 / §Anti-insinuación)                          │
 * │  A. Cada bloque degrada a SU empty-state honesto propio e independiente;    │
 * │     el módulo NUNCA se oculta entero (T-52-15).                             │
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
// "Votado esta semana" filtra por la semana ISO vigente (lunes → hoy), no por una
// ventana rodante arbitraria: el ciudadano lee "esta semana" como la semana natural.
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

// ── Panel `--card` compartido por los 3 sub-bloques ─────────────────────────────
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">{children}</div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// BLOQUE 1 — "Votado esta semana"
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
}

export function VotadoEstaSemanaView({ items }: { items: VotadoItem[] }) {
  return (
    <Panel>
      <h2 className="text-lg font-semibold mb-4">Votado esta semana</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sin votaciones registradas esta semana en las fuentes consultadas.
        </p>
      ) : (
        <ul className="space-y-4">
          {items.map((it, idx) => {
            // Traza: enlace externo seguro; si falta, cae a la ficha interna (la
            // traza nunca se pierde — SC7 / §Anti-insinuación 7).
            const href = safeExternalHref(it.enlace);
            return (
              <li
                key={`${it.boletin}-${idx}`}
                className="border-t pt-4 first:border-t-0 first:pt-0"
              >
                <h3 className="text-base font-semibold leading-snug">
                  {it.titulo ?? (
                    <span className="font-mono">{it.boletin}</span>
                  )}
                </h3>
                {/* Desenlace factual — se OMITE si `resultado` es null; nunca "quién ganó". */}
                {it.resultado && (
                  <p className="mt-1 text-sm">
                    El proyecto fue {it.resultado}{" "}
                    <span className="font-mono">
                      {conteoVotacion(it.totalSi, it.totalNo)}
                    </span>
                    .
                  </p>
                )}
                <p className="mt-1 font-mono text-sm text-muted-foreground">
                  Votación del {fechaCorta(it.fecha)}
                </p>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center text-sm underline underline-offset-2 text-accent-product"
                  >
                    Ver fuente oficial ↗
                  </a>
                ) : (
                  <Link
                    href={`/proyecto/${it.boletin}`}
                    className="mt-1 inline-flex items-center text-sm underline underline-offset-2 text-accent-product"
                  >
                    Ver proyecto →
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export async function VotadoEstaSemana() {
  const sb = createServerSupabase();

  // Bounded: votaciones de la semana ISO vigente, más recientes primero.
  const { data, error } = await sb
    .from("votacion")
    .select("boletin, resultado, total_si, total_no, fecha, enlace")
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
      "boletin" | "resultado" | "total_si" | "total_no" | "fecha" | "enlace"
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
      };
    })
    .filter((x): x is VotadoItem => x !== null);

  return <VotadoEstaSemanaView items={items} />;
}

// ════════════════════════════════════════════════════════════════════════════
// BLOQUE 2 — "Urgencias vigentes" (REUSA `urgenciaVigente` de estado-actual-block)
// ════════════════════════════════════════════════════════════════════════════

export interface UrgenciaItem {
  boletin: string;
  titulo: string | null;
  tipo: string;
  desde: Date;
}

export function UrgenciasVigentesView({ items }: { items: UrgenciaItem[] }) {
  return (
    <Panel>
      <h2 className="text-lg font-semibold mb-4">Urgencias vigentes</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay urgencias vigentes registradas esta semana.
        </p>
      ) : (
        <ul className="space-y-4">
          {items.map((it, idx) => (
            <li
              key={`${it.boletin}-${idx}`}
              className="border-t pt-4 first:border-t-0 first:pt-0"
            >
              <p className="text-sm leading-snug">
                {it.titulo ?? (
                  <span className="font-mono">{it.boletin}</span>
                )}{" "}
                — urgencia {it.tipo} vigente desde el{" "}
                <span className="font-mono">{fechaCorta(it.desde)}</span>.
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {it.boletin}
              </p>
              <Link
                href={`/proyecto/${it.boletin}`}
                className="mt-1 inline-flex items-center text-sm underline underline-offset-2 text-accent-product"
              >
                Ver proyecto →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export async function UrgenciasVigentes() {
  const sb = createServerSupabase();

  // Bounded: eventos de urgencia (hace presente / retira) más recientes. Se lee un
  // subconjunto acotado; `urgenciaVigente` deriva por boletín el último "hace
  // presente" sin "retira" posterior dentro de la ventana.
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

  // Más recientes primero; acotado a un puñado (no es un ranking, es un corte).
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
// BLOQUE 3 — "Última actualización de datos" (max fecha_captura por fuente NO-PII)
// ════════════════════════════════════════════════════════════════════════════

export interface FrescuraItem {
  fuente: string;
  fecha: Date;
}

export function UltimaActualizacionView({ items }: { items: FrescuraItem[] }) {
  return (
    <Panel>
      <h2 className="text-lg font-semibold mb-4">Última actualización de datos</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún no hay registros de actualización disponibles.
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((it) => (
            <li key={it.fuente}>
              {it.fuente}: actualizada el{" "}
              <span className="font-mono">{fechaCorta(it.fecha)}</span>.
            </li>
          ))}
        </ul>
      )}
    </Panel>
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
// Devuelve un Map boletín → título. Un error real se lanza (#34); un boletín sin
// fila queda ausente del Map (el bloque muestra el boletín en su lugar).
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

// ════════════════════════════════════════════════════════════════════════════
// MÓDULO — compone los 3 bloques bajo el hero (grid stacked-en-móvil)
// ════════════════════════════════════════════════════════════════════════════

// Skeleton acotado por bloque (estado de carga honesto: NO afirma dato alguno).
function BloqueSkeleton() {
  return (
    <div
      className="rounded-lg border border-border bg-card p-6"
      aria-hidden="true"
    >
      <div className="h-5 w-1/2 rounded bg-muted" />
      <div className="mt-4 h-4 w-full rounded bg-muted" />
      <div className="mt-2 h-4 w-3/4 rounded bg-muted" />
    </div>
  );
}

/**
 * Módulo de actualidad. Cada sub-bloque va bajo su propio `<Suspense>` para que
 * un bloque lento no bloquee a los otros (streaming independiente); cada uno
 * degrada a su empty-state honesto propio. Sin intro editorial: los 3 headings
 * (h2) se sostienen solos (52-UI-SPEC §SC4).
 */
export function ActualidadModule() {
  return (
    <section
      aria-label="Actualidad"
      className="mx-auto max-w-5xl px-4 pb-16 md:px-8 md:pb-24"
    >
      <div className="grid gap-6 md:grid-cols-3">
        <Suspense fallback={<BloqueSkeleton />}>
          <VotadoEstaSemana />
        </Suspense>
        <Suspense fallback={<BloqueSkeleton />}>
          <UrgenciasVigentes />
        </Suspense>
        <Suspense fallback={<BloqueSkeleton />}>
          <UltimaActualizacion />
        </Suspense>
      </div>
    </section>
  );
}
