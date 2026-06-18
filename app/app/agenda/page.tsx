import { Suspense } from "react";

import { createServerSupabase } from "@/lib/supabase";
import { WeekNav } from "@/components/week-nav";
import { CitacionCard } from "@/components/citacion-card";
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
import type {
  CitacionRow,
  SesionSalaRow,
} from "@/lib/agenda-types";

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

export default async function AgendaPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const semanaParam = typeof sp.semana === "string" ? sp.semana : undefined;
  const { year, week } = parseISOWeek(semanaParam);

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-16">
      <h1 className="text-3xl font-semibold leading-tight">Agenda legislativa</h1>

      <div className="mt-4">
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
    </main>
  );
}

// ── Citaciones (ambas cámaras, agrupadas por día) ────────────────────────────
async function CitacionesSection({ year, week }: ISOWeek) {
  const key = semanaIsoKey(year, week);
  const sb = createServerSupabase();
  const { data } = await sb
    .from("citacion")
    .select("*, citacion_invitado(*), citacion_punto(*)")
    .eq("semana_iso", key)
    .order("fecha", { ascending: true })
    .order("camara", { ascending: true })
    .order("comision", { ascending: true });

  const citaciones = (data as CitacionRow[]) ?? [];

  if (citaciones.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        No hay citaciones de comisiones registradas para esta semana.
      </p>
    );
  }

  // Agrupar por día (clave = fecha YYYY-MM-DD; las sin fecha van a un grupo aparte).
  const grupos = new Map<string, CitacionRow[]>();
  for (const c of citaciones) {
    const dayKey = c.fecha ? c.fecha.slice(0, 10) : "sin-fecha";
    const arr = grupos.get(dayKey) ?? [];
    arr.push(c);
    grupos.set(dayKey, arr);
  }

  const diaFmt = new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  return (
    <div className="mt-4">
      {Array.from(grupos.entries()).map(([dayKey, items]) => (
        <div key={dayKey}>
          <div className="mt-6 mb-3">
            <h3 className="text-base font-semibold capitalize">
              {dayKey === "sin-fecha"
                ? "Sin fecha asignada"
                : diaFmt.format(new Date(`${dayKey}T00:00:00Z`))}
            </h3>
            <Separator className="mt-1" />
          </div>
          <div className="space-y-4">
            {items.map((c) => (
              <CitacionCard
                key={c.id}
                comision={c.comision}
                fecha={c.fecha ? new Date(c.fecha) : null}
                horario={c.horario}
                sala={c.sala}
                materia={c.materia}
                camara={c.camara}
                invitados={(c.citacion_invitado ?? []).map((inv) => ({
                  nombre: inv.nombre,
                  calidad: inv.calidad,
                }))}
                boletin={primerBoletin(c)}
                provenance={{
                  capturedAt: c.fecha_captura ? new Date(c.fecha_captura) : null,
                  sourceName: sourceLabel(c.origen),
                  sourceUrl: c.enlace ?? null,
                }}
              />
            ))}
          </div>
        </div>
      ))}
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

// ── Tabla de sala (Senado available / Cámara siempre degradada) ──────────────
async function SalaTableServer({ year, week }: ISOWeek) {
  const { start, end } = getWeekBounds(year, week);
  const sb = createServerSupabase();
  const { data } = await sb
    .from("sesion_sala")
    .select("*, sesion_tabla_item(*)")
    .eq("camara", "senado")
    .gte("fecha", start.toISOString())
    .lte("fecha", endOfDay(end))
    .order("fecha", { ascending: true });

  const sesiones = (data as SesionSalaRow[]) ?? [];
  const weekLabel = formatWeekLabel(year, week);

  // Aplanar los ítems de todas las sesiones del Senado de la semana.
  const items: SalaTablaItem[] = [];
  let provenance: { capturedAt: Date | null; sourceName: string; sourceUrl: string | null } | null =
    null;
  for (const s of sesiones) {
    if (!provenance) {
      provenance = {
        capturedAt: s.fecha_captura ? new Date(s.fecha_captura) : null,
        sourceName: sourceLabel(s.origen),
        sourceUrl: s.enlace ?? null,
      };
    }
    const tabla = (s.sesion_tabla_item ?? [])
      .slice()
      .sort((a, b) => a.posicion - b.posicion);
    for (const it of tabla) {
      items.push({
        posicion: it.posicion,
        parteSesion: it.parte_sesion,
        materia: it.materia,
        boletin: it.boletin,
        etapa: it.parte_sesion,
      });
    }
  }

  return (
    <div className="mt-4 space-y-8">
      {items.length > 0 && provenance && (
        <SalaTableSection
          mode="available"
          items={items}
          provenance={provenance}
          weekLabel={weekLabel}
        />
      )}
      {/* La tabla de sala de Cámara no tiene fuente estructurada: degradación
          honesta SIEMPRE visible (UI-SPEC §6.2, T-06-09). */}
      <SalaTableSection mode="degraded" weekLabel={weekLabel} />
    </div>
  );
}

/** Fin del día (23:59:59.999Z) de una fecha para el filtro de rango inclusivo. */
function endOfDay(d: Date): string {
  const e = new Date(d);
  e.setUTCHours(23, 59, 59, 999);
  return e.toISOString();
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
