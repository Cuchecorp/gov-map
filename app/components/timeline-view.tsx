import Link from "next/link";

import { TimelineEvent } from "@/components/timeline-event";
import type { TramitacionEventoRow } from "@/lib/types";

/**
 * TimelineView — timeline de DOS niveles (UI-SPEC §SC2, Pitfall 3 LOCKED).
 *
 * Los HITOS ESTRUCTURALES (informe, oficio, votación, cambio de trámite…) SIEMPRE
 * están visibles, sin paginación. Sólo los PARES REPETITIVOS de urgencia (que
 * enterraban la señal — "Suma" renovada N veces) se colapsan en UNA línea por
 * período, expandible server-driven vía `?urgencias=<id>`.
 *
 * Heurística CONSERVADORA (Pitfall 3): sólo colapsa runs contiguos de eventos-
 * urgencia del MISMO tipo y de longitud ≥ 2. Cualquier otra cosa se renderiza como
 * `TimelineEvent` normal (T-51-15: nunca esconder un hito estructural). Los RETIROS
 * de urgencia ("retira … la urgencia") NUNCA se colapsan ni se cuentan: un retiro no
 * es una renovación — cortan el run y se muestran como hito normal (espejo de
 * `urgenciaVigente` en estado-actual-block.tsx, que también distingue retira).
 */

const mesAnioFormatter = new Intl.DateTimeFormat("es-CL", {
  month: "short",
  year: "numeric",
});
function mesAnio(d: Date): string {
  return mesAnioFormatter.format(d);
}

/** Fecha ISO parseable → Date válida, o null. */
function fechaValida(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * `true` si el evento es de urgencia (heurística LOCKED, Pitfall 3): o su `tipo` es
 * "urgencia", o es un "tramite" cuya descripción menciona urgencia ("hace presente
 * la urgencia …" / "retira … urgencia"). TODO evento fuera de este patrón es un hito
 * estructural y se renderiza normal, SIEMPRE visible.
 */
export function esEventoUrgencia(e: TramitacionEventoRow): boolean {
  return (
    e.tipo === "urgencia" ||
    (e.tipo === "tramite" && /urgencia/i.test(e.descripcion ?? ""))
  );
}

/**
 * `true` si el evento de urgencia es un RETIRO ("retira … la urgencia …"). Un retiro
 * NO es parte del par repetitivo presenta/renueva: colapsarlo lo contaría como
 * "evento de urgencia" del mismo tipo y fabricaría una afirmación falsa. Corta el
 * run colapsable y se renderiza como `TimelineEvent` normal, siempre visible.
 */
export function esRetiroUrgencia(e: TramitacionEventoRow): boolean {
  return /retira/i.test(e.descripcion ?? "");
}

/**
 * Tipo NORMALIZADO de urgencia (para agrupar runs del mismo tipo). Para `tipo:
 * "urgencia"` es la descripción cruda (el TIPO: "Suma"/"Simple"); para un `tramite`
 * de urgencia, el texto tras "urgencia …". Fallback "urgencia" si no se captura.
 */
function tipoUrgenciaKey(e: TramitacionEventoRow): string {
  if (e.tipo === "urgencia") return (e.descripcion ?? "").trim().toLowerCase();
  const m = (e.descripcion ?? "").match(/urgencia\s+([^.,;]+)/i);
  return m ? m[1].trim().toLowerCase() : "urgencia";
}

/** Tipo de urgencia para MOSTRAR (caso original de la fuente, sin bajar a minúsculas). */
function tipoUrgenciaDisplay(e: TramitacionEventoRow): string {
  if (e.tipo === "urgencia") return (e.descripcion ?? "").trim() || "sin tipo";
  const m = (e.descripcion ?? "").match(/urgencia\s+([^.,;]+)/i);
  return m ? m[1].trim() : "sin tipo";
}

/** Un período de urgencia colapsable (run contiguo del mismo tipo, longitud ≥ 2). */
export interface PeriodoUrgencia {
  /** Id estable server-driven ("u1", "u2", …) — se compara por igualdad (T-51-17). */
  id: string;
  /** Tipo para mostrar (caso de la fuente). */
  tipo: string;
  /** Eventos del período (en orden). */
  eventos: TramitacionEventoRow[];
  /**
   * Primer/último evento del run CON fecha válida. `null` cuando ningún evento del
   * run tiene fecha parseable → la línea colapsada OMITE el rango (nunca se muestra
   * una fecha fabricada tipo "ene 1970"; idiom fechaValida/fechaCortaSegura).
   */
  desde: Date | null;
  hasta: Date | null;
}

type TimelineItem =
  | { kind: "evento"; evento: TramitacionEventoRow; key: string }
  | { kind: "periodo"; periodo: PeriodoUrgencia };

/**
 * Construye los ítems ordenados del timeline: hitos estructurales sueltos + períodos
 * de urgencia colapsados. Sólo colapsa runs CONTIGUOS de eventos-urgencia del mismo
 * tipo con longitud ≥ 2 (un evento-urgencia aislado se renderiza normal — no es un
 * "par" repetitivo). PURO. El orden de entrada se preserva por fecha ASC.
 */
function construirItems(eventos: TramitacionEventoRow[]): TimelineItem[] {
  const ordenados = [...eventos].sort((a, b) => {
    const da = fechaValida(a.fecha)?.getTime() ?? 0;
    const db = fechaValida(b.fecha)?.getTime() ?? 0;
    return da - db;
  });

  const items: TimelineItem[] = [];
  let i = 0;
  let periodoIdx = 0;
  while (i < ordenados.length) {
    const e = ordenados[i];
    // Un RETIRO de urgencia no es colapsable (no es una renovación): hito normal.
    if (!esEventoUrgencia(e) || esRetiroUrgencia(e)) {
      items.push({ kind: "evento", evento: e, key: `${e.camara}-${e.fecha}-${e.tipo}-${i}` });
      i += 1;
      continue;
    }
    // Run contiguo de eventos-urgencia del MISMO tipo normalizado (los retiros
    // cortan el run: quedan fuera y se renderizan como evento normal).
    const key = tipoUrgenciaKey(e);
    let j = i + 1;
    while (
      j < ordenados.length &&
      esEventoUrgencia(ordenados[j]) &&
      !esRetiroUrgencia(ordenados[j]) &&
      tipoUrgenciaKey(ordenados[j]) === key
    ) {
      j += 1;
    }
    const run = ordenados.slice(i, j);
    if (run.length >= 2) {
      periodoIdx += 1;
      // Rango SOLO de fechas válidas del run (el sort manda las inválidas al inicio
      // con time 0 — usarlas fabricaría "ene 1970"). Sin fecha válida → null (la
      // línea colapsada omite el rango, nunca epoch).
      const fechasValidas = run
        .map((e) => fechaValida(e.fecha))
        .filter((d): d is Date => d !== null);
      const desde = fechasValidas[0] ?? null;
      const hasta = fechasValidas.length > 0 ? fechasValidas[fechasValidas.length - 1] : null;
      items.push({
        kind: "periodo",
        periodo: {
          id: `u${periodoIdx}`,
          tipo: tipoUrgenciaDisplay(run[0]),
          eventos: run,
          desde,
          hasta,
        },
      });
    } else {
      items.push({
        kind: "evento",
        evento: run[0],
        key: `${run[0].camara}-${run[0].fecha}-${run[0].tipo}-${i}`,
      });
    }
    i = j;
  }
  return items;
}

/**
 * Períodos de urgencia colapsables derivados de los eventos (PURO, exportado para
 * test). Sólo runs contiguos del mismo tipo con ≥ 2 eventos.
 */
export function paresDeUrgencia(
  eventos: TramitacionEventoRow[],
): PeriodoUrgencia[] {
  return construirItems(eventos)
    .filter((it): it is { kind: "periodo"; periodo: PeriodoUrgencia } => it.kind === "periodo")
    .map((it) => it.periodo);
}

/** href server-driven para expandir/colapsar un período de urgencia (ancla #timeline). */
function buildUrgenciasHref(
  boletin: string,
  periodoId: string,
  abierto: boolean,
): string {
  const qs = new URLSearchParams();
  if (!abierto) qs.set("urgencias", periodoId);
  const q = qs.toString();
  return `/proyecto/${boletin}${q ? `?${q}` : ""}#timeline`;
}

/**
 * Línea colapsada de un período de urgencia. Conteo NEUTRO ("N eventos"), sin
 * semántica de renovación: "renovada N veces" contaba la presentación inicial como
 * renovación (N eventos ≠ N renovaciones) — una afirmación fabricada. Si el run no
 * tiene NINGUNA fecha válida, se omite el rango (nunca una fecha fabricada).
 */
function periodoLinea(p: PeriodoUrgencia): string {
  const base = `Urgencia ${p.tipo}: ${p.eventos.length} eventos`;
  if (p.desde === null || p.hasta === null) return base;
  const mesX = mesAnio(p.desde);
  const mesY = mesAnio(p.hasta);
  const rango = mesX === mesY ? `en ${mesX}` : `entre ${mesX} y ${mesY}`;
  return `${base} ${rango}`;
}

export function TimelineView({
  eventos,
  boletin,
  urgenciaExpandida = null,
}: {
  eventos: TramitacionEventoRow[];
  boletin: string;
  urgenciaExpandida?: string | null;
}) {
  if (eventos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay eventos de tramitación registrados para este proyecto.
      </p>
    );
  }

  const items = construirItems(eventos);

  return (
    <ul className="relative pl-8 border-l-2 border-border">
      {items.map((item) => {
        if (item.kind === "evento") {
          return <TimelineEvent key={item.key} evento={item.evento} />;
        }
        const p = item.periodo;
        const abierto = urgenciaExpandida === p.id;
        if (abierto) {
          return (
            <li key={p.id} className="mb-6 last:mb-0">
              <ul>
                {p.eventos.map((e, k) => (
                  <TimelineEvent key={`${p.id}-${e.fecha}-${k}`} evento={e} />
                ))}
              </ul>
              <Link
                href={buildUrgenciasHref(boletin, p.id, true)}
                className="inline-flex items-center min-h-11 text-sm text-accent-product underline underline-offset-2"
              >
                Ocultar urgencias
              </Link>
            </li>
          );
        }
        return (
          <li key={p.id} className="relative mb-6 last:mb-0">
            <span
              className="absolute -left-[17px] top-2 w-3 h-3 rounded-full border-2 border-background bg-muted-foreground/50"
              aria-hidden="true"
            />
            <p className="text-base leading-relaxed text-muted-foreground">
              {periodoLinea(p)} —{" "}
              <Link
                href={buildUrgenciasHref(boletin, p.id, false)}
                className="text-accent-product underline underline-offset-2"
              >
                ver todas
              </Link>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
