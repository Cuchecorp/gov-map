import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerSupabase } from "@/lib/supabase";
import { WeekNav } from "@/components/week-nav";
import { CitacionCard } from "@/components/citacion-card";
import {
  AgendaCobertura,
  type CoberturaCamaraMetrica,
} from "@/components/agenda-cobertura";
import { AgendaFiltros } from "@/components/agenda-filtros";
import {
  SalaTableSection,
  type SalaTablaItem,
} from "@/components/sala-table-section";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  parseISOWeek,
  getWeekBounds,
  semanaIsoKey,
  formatWeekLabel,
  type ISOWeek,
} from "@/lib/week-utils";
import { sourceLabel } from "@/lib/types";
import {
  diaCalendarioCitacion,
  dayLabelCitacion,
} from "@/lib/dia-calendario";
import {
  CAMARA_TABLA_PDF_URL,
  type CitacionRow,
  type CitacionSliceRow,
  type SesionSalaRow,
} from "@/lib/agenda-types";
import { BOLETIN_RE, MAX_QUERY_CHARS } from "@/lib/buscar";
import {
  buscarCitaciones,
  type CitacionBusquedaRow,
} from "@/lib/agenda-buscar";

/**
 * /agenda — agenda legislativa semanal (Server Component, UI-SPEC §2).
 *
 * Lee las tablas públicas de agenda de Supabase (anon, RLS public-read de
 * migración 0010). `searchParams.semana` (`YYYY-Www`) es input no confiable:
 * `parseISOWeek` valida el formato `\d{4}-W\d{2}` y degrada a la semana ISO
 * actual ante ausencia/malformado, SIN redirect (T-06-10). Las lecturas usan
 * `.eq()`/rango parametrizado de supabase-js.
 *
 * Estructura: <h1> + <WeekNav> + sección citaciones (agrupadas por día, ambas
 * cámaras) + sección tabla de sala (Senado available / Cámara siempre degradada
 * al PDF). Cada sección en su <Suspense> con skeleton.
 */

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/** Cámara válida del filtro de búsqueda, o undefined (ambas). */
function parseCamaraFiltro(v: unknown): "camara" | "senado" | undefined {
  return v === "camara" || v === "senado" ? v : undefined;
}

// CONTRATO date-only-midnight-UTC (ver `@/lib/dia-calendario`): la agrupación por
// día de la agenda usa la PARTE FECHA UTC de `citacion.fecha`/`sesion_sala.fecha`
// (el día publicado por la fuente), NO una conversión a tz America/Santiago —
// interpretar esa medianoche UTC en Chile fabrica el día anterior (regresión live
// Phase 94). `diaCalendarioCitacion`/`dayLabelCitacion` codifican ese contrato.

export default async function AgendaPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const semanaParam = typeof sp.semana === "string" ? sp.semana : undefined;
  const { year, week } = parseISOWeek(semanaParam);

  // Input no confiable: trim + cap ≤300 (mismo cap que /buscar).
  const qRaw = typeof sp.q === "string" ? sp.q : "";
  const q = qRaw.trim().slice(0, MAX_QUERY_CHARS);
  const camaraFiltro = parseCamaraFiltro(sp.camara);

  // Atajo de boletín ANTES de renderizar (cruce directo a la ficha; espeja /buscar).
  if (q.length > 0 && BOLETIN_RE.test(q)) {
    redirect(`/proyecto/${q}`);
  }

  const buscando = q.length > 0;

  return (
    <main className="max-w-[1120px] mx-auto px-4 md:px-8 py-8 md:py-16">
      <h1 className="text-3xl font-semibold leading-tight">Agenda legislativa</h1>

      {/* Buscador de citaciones (SSR-first: el form GET funciona sin JS; no embebe). */}
      <form role="search" action="/agenda" method="get" className="mt-4 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Busca por comisión, materia, invitado o boletín…"
          aria-label="Buscar citaciones de comisiones"
          className="h-11 flex-1 rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {camaraFiltro && <input type="hidden" name="camara" value={camaraFiltro} />}
        <button
          type="submit"
          className="h-11 rounded-md bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90"
        >
          Buscar
        </button>
      </form>

      {buscando ? (
        <section id="resultados" className="mt-6">
          <CamaraFiltro q={q} camara={camaraFiltro} />
          <Suspense key={`${q}::${camaraFiltro ?? "all"}`} fallback={<CitacionesSkeleton />}>
            <ResultadosBusqueda q={q} camara={camaraFiltro} />
          </Suspense>
          <p className="mt-8 text-sm">
            <Link
              href="/agenda"
              className="inline-flex min-h-11 items-center text-accent-product underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ← Volver a la vista semanal
            </Link>
          </p>
        </section>
      ) : (
        <>
          {/* Banner de cobertura DECLARADA (CIT-05) bajo el <h1> y ANTES del
              WeekNav (contexto antes de navegar). Solo en la vista semanal. */}
          <Suspense fallback={<CoberturaSkeleton />}>
            <CoberturaBanner />
          </Suspense>

          <div className="mt-6">
            <WeekNav year={year} week={week} />
          </div>

          <section id="citaciones" className="mt-8">
            <h2 className="text-xl font-semibold">Citaciones de comisiones</h2>
            <Suspense fallback={<CitacionesSkeleton />}>
              <CitacionesSection year={year} week={week} />
            </Suspense>
          </section>

          <section id="tabla-sala" className="mt-12">
            <h2 className="text-xl font-semibold">Tabla de sala</h2>
            <Suspense fallback={<SalaTableSkeleton />}>
              <SalaTableServer year={year} week={week} />
            </Suspense>
          </section>
        </>
      )}
    </main>
  );
}

// ── Filtro por cámara (links que preservan q) ────────────────────────────────
function CamaraFiltro({
  q,
  camara,
}: {
  q: string;
  camara: "camara" | "senado" | undefined;
}) {
  const opciones: { label: string; value: "camara" | "senado" | undefined }[] = [
    { label: "Ambas", value: undefined },
    { label: "Cámara", value: "camara" },
    { label: "Senado", value: "senado" },
  ];
  const href = (value: "camara" | "senado" | undefined) =>
    `/agenda?q=${encodeURIComponent(q)}${value ? `&camara=${value}` : ""}`;
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por cámara">
      {opciones.map((o) => {
        const activa = o.value === camara;
        return (
          <Link
            key={o.label}
            href={href(o.value)}
            aria-current={activa ? "true" : undefined}
            className={[
              "inline-flex min-h-9 items-center rounded-full border px-3 text-sm transition-colors",
              activa
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-muted hover:border-primary/50",
            ].join(" ")}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

// ── Resultados de búsqueda (agrupados por comisión) ──────────────────────────
async function ResultadosBusqueda({
  q,
  camara,
}: {
  q: string;
  camara: "camara" | "senado" | undefined;
}) {
  let filas: CitacionBusquedaRow[];
  try {
    filas = await buscarCitaciones(q, { camara });
  } catch {
    // Error = el RPC falló (grant/RLS/red/DB). Distinto de "sin resultados".
    return (
      <div className="mt-6 border border-destructive/20 bg-destructive/5 rounded-[var(--radius-tile)] p-4 text-sm">
        Ocurrió un error al buscar en la agenda. Vuelve a intentarlo en unos momentos.
      </div>
    );
  }

  if (filas.length === 0) {
    return (
      <div className="mt-6 rounded-[var(--radius-tile)] border border-border bg-muted/40 px-6 py-8 text-center text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">Sin resultados</p>
        <p className="mt-1">
          No se encontraron citaciones para &ldquo;{q}&rdquo;. Prueba con otra comisión,
          materia, nombre o número de boletín.
        </p>
      </div>
    );
  }

  // Agrupar por comisión (índice además del orden por día — "todo mejor estructurado").
  const grupos = new Map<string, CitacionBusquedaRow[]>();
  for (const f of filas) {
    const arr = grupos.get(f.comision) ?? [];
    arr.push(f);
    grupos.set(f.comision, arr);
  }

  const camaraLabel = (c: "camara" | "senado") =>
    c === "camara" ? "Cámara" : "Senado";

  return (
    <div className="mt-6">
      <p className="text-sm text-muted-foreground">
        {filas.length} resultado{filas.length === 1 ? "" : "s"} para &ldquo;{q}&rdquo;
      </p>
      <div className="mt-6 space-y-8">
        {Array.from(grupos.entries()).map(([comision, items]) => (
          <div key={comision}>
            <h3 className="text-base font-semibold">{comision}</h3>
            <Separator className="mt-1" />
            <ul className="mt-3 space-y-3">
              {items.map((c) => (
                <li key={c.id} className="rounded-[var(--radius-tile)] border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                      {camaraLabel(c.camara)}
                    </span>
                    {dayLabelCitacion(c.fecha) && (
                      <span>{dayLabelCitacion(c.fecha)}</span>
                    )}
                    {c.estado && <span className="text-foreground">· {c.estado}</span>}
                  </div>
                  {c.materia && (
                    <p className="mt-2 text-sm leading-relaxed">{c.materia}</p>
                  )}
                  {c.boletin && (
                    <p className="mt-2 text-sm">
                      <Link
                        href={`/proyecto/${c.boletin}`}
                        className="font-mono text-primary underline underline-offset-2"
                        aria-label={`Ver proyecto Boletín N°${c.boletin}`}
                      >
                        Boletín N°{c.boletin}
                      </Link>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Banner de cobertura declarada (métrica Cámara derivada, sin cap 1k) ──────
/**
 * Deriva la métrica de cobertura de comisiones×Cámara SIN traer todas las filas
 * (plan-checker MINOR 4): conteo exacto vía `count: "exact", head: true` (no
 * transporta filas), y min/max fecha vía `.order(...).limit(1)`. El nº de
 * semanas ISO se DERIVA del rango min→max (no un count(distinct) exacto — se
 * declara como rango). Las tres celdas estructurales son texto fijo (banner).
 */
async function derivarMetricaCamara(): Promise<CoberturaCamaraMetrica> {
  const sb = createServerSupabase();

  const [countRes, minRes, maxRes] = await Promise.all([
    sb
      .from("citacion")
      .select("*", { count: "exact", head: true })
      .eq("camara", "camara"),
    sb
      .from("citacion")
      .select("fecha")
      .eq("camara", "camara")
      .not("fecha", "is", null)
      .order("fecha", { ascending: true })
      .limit(1),
    sb
      .from("citacion")
      .select("fecha")
      .eq("camara", "camara")
      .not("fecha", "is", null)
      .order("fecha", { ascending: false })
      .limit(1),
  ]);

  // #34: frontera de error honesta — un fallo real de DB/red se lanza; NUNCA se
  // fabrica un banner con métricas cero silenciosas.
  if (countRes.error) {
    throw new Error(`cobertura Cámara (count) falló: ${countRes.error.message}`);
  }
  if (minRes.error) {
    throw new Error(`cobertura Cámara (min fecha) falló: ${minRes.error.message}`);
  }
  if (maxRes.error) {
    throw new Error(`cobertura Cámara (max fecha) falló: ${maxRes.error.message}`);
  }

  const minFecha = (minRes.data as { fecha: string }[] | null)?.[0]?.fecha ?? null;
  const maxFecha = (maxRes.data as { fecha: string }[] | null)?.[0]?.fecha ?? null;
  // Contrato date-only-midnight-UTC: el min/max de cobertura es el día publicado
  // (parte fecha UTC), no una conversión de zona (que retrocedería un día).
  const camaraMin = minFecha ? diaCalendarioCitacion(minFecha) : null;
  const camaraMax = maxFecha ? diaCalendarioCitacion(maxFecha) : null;

  return {
    camaraN: countRes.count ?? 0,
    camaraSemanas: semanasEntre(camaraMin, camaraMax),
    camaraMin,
    camaraMax,
  };
}

/**
 * Ancho del rango min→max expresado en semanas de 7 días (aprox., derivado — IN-01).
 * NO cuenta semanas ISO distintas ni lunes-Chile distintos: computa
 * `floor(díasEntre / 7) + 1`, el número de "cubos" de 7 días que abarca el rango
 * inclusive (p.ej. un rango de 7 días devuelve 2). El banner declara la cifra como
 * un rango derivado aproximado y prohíbe leerla como "cobertura completa", así que
 * la aproximación es honesta; este JSDoc describe EXACTAMENTE lo que el código mide
 * (antes decía "semanas ISO / lunes-Chile distintos", que el código no calcula).
 * Si falta algún extremo → 0.
 */
function semanasEntre(min: string | null, max: string | null): number {
  if (!min || !max) return 0;
  const d0 = new Date(`${min}T12:00:00Z`);
  const d1 = new Date(`${max}T12:00:00Z`);
  const dias = Math.floor((d1.getTime() - d0.getTime()) / 86_400_000);
  if (dias < 0) return 0;
  return Math.floor(dias / 7) + 1;
}

async function CoberturaBanner() {
  const metrica = await derivarMetricaCamara();
  return <AgendaCobertura metrica={metrica} />;
}

function CoberturaSkeleton() {
  return (
    <div
      className="mt-6 rounded-lg border border-border bg-muted/40 px-6 py-4 space-y-2"
      aria-hidden="true"
    >
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

// ── Citaciones (ambas cámaras, agrupadas por día) ────────────────────────────
// Exportada (named) para poder testear el empty-state con RTL, igual que
// `Resultados` en /buscar. Next.js solo trata el default export como la página.
export async function CitacionesSection({ year, week }: ISOWeek) {
  const key = semanaIsoKey(year, week);
  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("citacion")
    .select("*, citacion_invitado(*), citacion_punto(*)")
    .eq("semana_iso", key)
    .order("fecha", { ascending: true })
    .order("camara", { ascending: true })
    .order("comision", { ascending: true });

  // #34: error real de DB/red ≠ "sin citaciones". Se lanza para la frontera de
  // error honesta (agenda/error.tsx); NUNCA se degrada a "No hay citaciones".
  if (error) {
    throw new Error(`citacion falló para semana ${key}: ${error.message}`);
  }

  const citaciones = (data as CitacionRow[]) ?? [];

  if (citaciones.length === 0) {
    return (
      <>
        <p className="mt-4 text-sm text-muted-foreground">
          No hay citaciones de comisiones registradas para esta semana.
        </p>
        <p className="text-sm mt-2">
          Puedes{" "}
          <Link
            href="/buscar"
            className="inline-flex min-h-11 items-center text-accent-product underline underline-offset-2"
          >
            buscar un proyecto de ley por su idea{" "}
            <span aria-hidden="true" className="pl-1">→</span>
          </Link>
          .
        </p>
      </>
    );
  }

  // SLICE PLANO serializable → island de filtros (CIT-04, contrato FichaRail).
  // DECISIÓN del orquestador: el island `AgendaFiltros` es el ÚNICO renderer del
  // listado por día post-hidratación (renderiza la MISMA `CitacionCard` que este
  // Server Component produce en SSR — cero divergencia). El server arma el slice
  // completo (estado + provenance + invitados, todos NO-PII por 0010); el island
  // solo filtra/agrupa EN MEMORIA. `dayKey` (día calendario chileno YYYY-MM-DD) y
  // `dayLabel` se calculan AQUÍ en el SERVER — NUNCA en el cliente (no se duplica
  // lógica en el navegador). Por el CONTRATO date-only-midnight-UTC de
  // `citacion.fecha` (ver `@/lib/dia-calendario`) el día es la PARTE FECHA UTC (el
  // día publicado), NO una conversión a tz Chile — que fabricaría el día anterior.
  // Las fechas cruzan como ISO string (JSON-serializable).
  const slice: CitacionSliceRow[] = citaciones.map((c) => {
    const dayKey = diaCalendarioCitacion(c.fecha) ?? "sin-fecha";
    const dayLabel = dayLabelCitacion(c.fecha) ?? "Sin fecha asignada";
    const boletines = (c.citacion_punto ?? [])
      .map((p) => p.boletin)
      .filter((b): b is string => b != null);
    return {
      id: c.id,
      camara: c.camara,
      comision: c.comision,
      fecha: c.fecha,
      dayKey,
      dayLabel,
      horario: c.horario,
      sala: c.sala,
      materia: c.materia,
      estado: c.estado,
      boletines,
      boletin: primerBoletin(c),
      invitados: (c.citacion_invitado ?? []).map((inv) => ({
        nombre: inv.nombre,
        calidad: inv.calidad,
      })),
      provenance: {
        capturedAt: c.fecha_captura ?? null,
        sourceName: sourceLabel(c.origen),
        sourceUrl: c.enlace ?? null,
      },
    };
  });

  // El island envuelve la presentación por día de la semana cargada (hidratación
  // progresiva: el SSR de `AgendaFiltros` produce el primer render; al hidratar,
  // los filtros de periodista quedan operativos). El buscador FTS global
  // (`buscarCitaciones`) coexiste intacto — se maneja en la rama `buscando`.
  return (
    <div className="mt-4">
      <AgendaFiltros slice={slice} />
    </div>
  );
}

/** Primer punto con boletín (cruce a la ficha de Fase 5). */
function primerBoletin(c: CitacionRow): string | null {
  const puntos = (c.citacion_punto ?? [])
    .slice()
    .sort((a, b) => a.posicion - b.posicion);
  const conBoletin = puntos.find((p) => p.boletin);
  return conBoletin?.boletin ?? null;
}

// ── Tabla de sala (Senado + Cámara; cada cámara available o degradada) ───────
type SalaProvenance = { capturedAt: Date | null; sourceName: string; sourceUrl: string | null };

/** Lee las sesiones de sala de UNA cámara en la ventana semi-abierta de la semana y aplana sus
 *  ítems (clave compuesta sesión+posición). Devuelve también la procedencia de la 1ª sesión. */
function aplanarSesiones(rows: SesionSalaRow[]): {
  items: SalaTablaItem[];
  provenance: SalaProvenance | null;
} {
  const items: SalaTablaItem[] = [];
  let provenance: SalaProvenance | null = null;
  for (const s of rows) {
    if (!provenance) {
      provenance = {
        capturedAt: s.fecha_captura ? new Date(s.fecha_captura) : null,
        sourceName: sourceLabel(s.origen),
        sourceUrl: s.enlace ?? null,
      };
    }
    const tabla = (s.sesion_tabla_item ?? []).slice().sort((a, b) => a.posicion - b.posicion);
    for (const it of tabla) {
      items.push({
        // IN-01: clave compuesta (sesión + posición) — única en la semana.
        key: `${s.id}:${it.posicion}`,
        posicion: it.posicion,
        parteSesion: it.parte_sesion,
        materia: it.materia,
        boletin: it.boletin,
      });
    }
  }
  return { items, provenance };
}

async function SalaTableServer({ year, week }: ISOWeek) {
  const { start, end } = getWeekBounds(year, week);
  // WR-06: rango semi-abierto [lunes 00:00Z, lunes SIGUIENTE 00:00Z) para tolerar
  // componente horario dentro del domingo (no-medianoche / DB TZ ≠ UTC).
  const nextMonday = new Date(end);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 1);
  nextMonday.setUTCHours(0, 0, 0, 0);
  const sb = createServerSupabase();

  // Ambas cámaras en paralelo (lecturas anon, RLS public-read de 0010).
  const [senadoRes, camaraRes] = await Promise.all([
    sb
      .from("sesion_sala")
      .select("*, sesion_tabla_item(*)")
      .eq("camara", "senado")
      .gte("fecha", start.toISOString())
      .lt("fecha", nextMonday.toISOString())
      .order("fecha", { ascending: true }),
    sb
      .from("sesion_sala")
      .select("*, sesion_tabla_item(*)")
      .eq("camara", "camara")
      .gte("fecha", start.toISOString())
      .lt("fecha", nextMonday.toISOString())
      .order("fecha", { ascending: true }),
  ]);

  // #34: un error real de DB/red de cualquiera de las dos cámaras se lanza para
  // la frontera de error honesta; NUNCA se degrada a tabla vacía / PDF fabricado.
  if (senadoRes.error) {
    throw new Error(`sesion_sala (senado) falló: ${senadoRes.error.message}`);
  }
  if (camaraRes.error) {
    throw new Error(`sesion_sala (cámara) falló: ${camaraRes.error.message}`);
  }

  const sesionesSenado = (senadoRes.data as SesionSalaRow[]) ?? [];
  const sesionesCamara = (camaraRes.data as SesionSalaRow[]) ?? [];
  const weekLabel = formatWeekLabel(year, week);

  // WR-05: la tabla del Senado es FORWARD-ONLY. Si la semana no tiene filas,
  // distinguir "fuera de la ventana capturada" de "sin sesión".
  let fueraDeVentanaSenado = false;
  if (sesionesSenado.length === 0) {
    const { data: primera, error: probeError } = await sb
      .from("sesion_sala")
      .select("fecha")
      .eq("camara", "senado")
      .order("fecha", { ascending: true })
      .limit(1);
    // #34: un fallo del probe NO debe fabricar `fueraDeVentanaSenado`; se lanza.
    if (probeError) {
      throw new Error(
        `sesion_sala (probe forward-only senado) falló: ${probeError.message}`,
      );
    }
    const primeraFecha = (primera as { fecha: string }[] | null)?.[0]?.fecha;
    if (primeraFecha && nextMonday.toISOString() <= new Date(primeraFecha).toISOString()) {
      fueraDeVentanaSenado = true;
    }
  }

  const senado = aplanarSesiones(sesionesSenado);
  const camara = aplanarSesiones(sesionesCamara);

  return (
    <div className="mt-4 space-y-10">
      {/* ── Senado ───────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold">Senado</h3>
        {senado.items.length > 0 && senado.provenance ? (
          <SalaTableSection
            mode="available"
            items={senado.items}
            provenance={senado.provenance}
            weekLabel={weekLabel}
          />
        ) : fueraDeVentanaSenado ? (
          <p className="text-sm text-muted-foreground leading-relaxed">
            La tabla de sala del Senado se publica con ventana hacia adelante (sin
            histórico){weekLabel ? ` — ${weekLabel}` : ""} es anterior al inicio de
            la ingesta, por lo que no se registró su orden del día.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground leading-relaxed">
            No hay tabla de sala del Senado registrada para esta semana.
          </p>
        )}
      </div>

      {/* ── Cámara de Diputados (DeepSeek-desde-PDF; degrada al PDF si la ingesta
            no produjo filas — CR-01/CR-02, acotado a la Cámara) ────────────── */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold">Cámara de Diputadas y Diputados</h3>
        {camara.items.length > 0 && camara.provenance ? (
          <SalaTableSection
            mode="available"
            items={camara.items}
            provenance={camara.provenance}
            weekLabel={weekLabel}
          />
        ) : (
          <SalaTableSection
            mode="degraded"
            weekLabel={weekLabel}
            camaraPdfUrl={CAMARA_TABLA_PDF_URL}
          />
        )}
      </div>
    </div>
  );
}

// ── Skeletons (UI-SPEC §7.2) ─────────────────────────────────────────────────
function CitacionesSkeleton() {
  return (
    <div className="mt-4 space-y-4" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border bg-card p-6 space-y-2"
        >
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-28" />
          </div>
          <Skeleton className="h-5 w-3/4 mt-2" />
          <Skeleton className="h-4 w-24 mt-1" />
          <Skeleton className="h-4 w-full mt-2" />
          <Skeleton className="h-5 w-40 mt-2" />
        </div>
      ))}
    </div>
  );
}

function SalaTableSkeleton() {
  return (
    <div className="mt-4 space-y-2" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
