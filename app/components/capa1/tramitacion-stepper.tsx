import { fechaCorta } from "@/lib/format";
import {
  construirItems,
  fechaValida,
  type TimelineItem,
} from "@/components/timeline-view";
import type { EstadoActual } from "@/components/estado-actual-block";
import type { TramitacionEventoRow } from "@/lib/types";

/**
 * TramitacionStepper — capa-1 VISUAL de la Tramitación (UXCOG 55-04, UI-SPEC
 * §Per-Surface "/proyecto"). ELEVA el "¿Dónde está hoy?" existente a un stepper
 * de etapas escaneable: los hitos CLAVE (estructurales: ingreso, informes,
 * votaciones, cambios de trámite) SIEMPRE visibles, y las corridas repetitivas de
 * urgencia AGRUPADAS en una sola línea "{N} trámites de urgencia · ver todos"
 * (copy LOCKED, conteo neutro). La tramitación COMPLETA vive en el detalle
 * colapsado (`TimelineView` dentro de `DetalleColapsable`) — aquí no se pierde
 * ningún hito: sólo se resume.
 *
 * Vista PURA (RTL con fixtures; NUNCA lee de la base de datos ni importa una
 * sección de dominio). Reusa la MISMA agrupación de urgencia que la vista completa
 * (`construirItems` de timeline-view) — no re-implementa la heurística — y la
 * omisión honesta de fechas (`fechaValida`): un hito con fecha inválida muestra
 * su descripción SIN fabricar fecha (nunca "ene 1970"), y un dato no derivable se
 * omite. Petróleo queda RESERVADO al afordance de drill-down ("ver todos"); la
 * etapa actual se destaca de forma SOBRIA (peso + punto lleno neutro), NO petróleo.
 */

const CONECTOR = "before:absolute before:left-[-25px] before:top-4 before:h-full before:w-px before:bg-border";

/** Tipos de evento estructurales que SIEMPRE son hito clave en capa-1. */
const TIPOS_HITO_CLAVE = new Set(["votacion", "informe", "oficio"]);

/**
 * Un evento es HITO CLAVE (capa-1) si su `tipo` es estructural (votación/informe/
 * oficio) o su descripción marca ingreso / cambio de etapa / cambio de comisión /
 * promulgación / desenlace. Los trámites RUTINARIOS (cuenta, correcciones, acuses)
 * quedan FUERA de capa-1 — viven íntegros en el detalle colapsado (TimelineView).
 */
function esHitoClave(e: TramitacionEventoRow): boolean {
  if (TIPOS_HITO_CLAVE.has(e.tipo)) return true;
  return /\b(ingres|pasa a|comisi[oó]n|primer tr[aá]mite|segundo tr[aá]mite|tercer tr[aá]mite|promulg|publicad|aprobad|rechazad|archivad)\b/i.test(
    e.descripcion ?? "",
  );
}

/** Tope preatentivo de capa-1 (UI-SPEC: resumen ≤7 unidades, no una copia). */
const CAP_HITOS = 7;

/**
 * Reduce los ítems del timeline a los HITOS CLAVE de capa-1 (WR-03): los períodos de
 * urgencia (ya condensados en 1 línea) SIEMPRE; los eventos SOLO si son hito clave o
 * marcan el ingreso (primer evento) / la posición ACTUAL (último). La tramitación
 * EXHAUSTIVA vive en el detalle colapsado (TimelineView) — capa-1 es un resumen
 * preatentivo, NUNCA la lista completa duplicada. Cap defensivo (~7): conserva el
 * ingreso + los hitos más recientes (la posición actual queda incluida).
 */
function hitosClaveStepper(items: TimelineItem[]): TimelineItem[] {
  const idxEventos = items
    .map((it, i) => (it.kind === "evento" ? i : -1))
    .filter((i) => i >= 0);
  const primero = idxEventos[0];
  const ultimo = idxEventos[idxEventos.length - 1];
  const clave = items.filter((it, i) => {
    if (it.kind === "periodo") return true;
    return i === primero || i === ultimo || esHitoClave(it.evento);
  });
  if (clave.length <= CAP_HITOS) return clave;
  return [clave[0], ...clave.slice(clave.length - (CAP_HITOS - 1))];
}

function PasoEvento({
  evento,
  actual,
}: {
  evento: TramitacionEventoRow;
  actual: boolean;
}) {
  const d = fechaValida(evento.fecha);
  return (
    <li className={"relative " + CONECTOR}>
      <span
        aria-hidden="true"
        className={
          "absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background " +
          (actual ? "bg-foreground" : "bg-muted-foreground/40")
        }
      />
      <p
        className={
          "text-sm leading-snug " +
          (actual ? "font-semibold text-foreground" : "text-foreground/80")
        }
      >
        {evento.descripcion}
        {/* Omisión honesta: fecha sólo si es válida (nunca epoch/"ene 1970"). */}
        {d && (
          <span className="ml-2 font-mono text-xs text-muted-foreground">
            {fechaCorta(d)}
          </span>
        )}
      </p>
    </li>
  );
}

function LineaUrgenciaAgrupada({
  n,
  boletin,
  periodoId,
}: {
  n: number;
  boletin: string;
  periodoId: string;
}) {
  // MISMO deep-link que la vista completa (buildUrgenciasHref): el param ?urgencias
  // expande ESTE período dentro del TimelineView, y la página abre el detalle
  // colapsado (defaultOpen) cuando el param está presente. Así "ver todos" revela de
  // verdad los N trámites (WR-04), no salta a la propia sección sin mostrar nada.
  const qs = new URLSearchParams({ urgencias: periodoId });
  const href = `/proyecto/${boletin}?${qs.toString()}#timeline`;
  return (
    <li className={"relative " + CONECTOR}>
      <span
        aria-hidden="true"
        className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-muted-foreground/40"
      />
      <p className="text-sm leading-snug text-muted-foreground">
        {/* Copy LOCKED (UI-SPEC §Copywriting): conteo NEUTRO, sin verbo causal. */}
        {n} trámites de urgencia{" · "}
        {/* Afordance de drill-down (petróleo permitido): expande el período completo. */}
        <a
          href={href}
          className="text-accent-product underline underline-offset-2"
        >
          ver todos
        </a>
      </p>
    </li>
  );
}

export function TramitacionStepper({
  eventos,
  estado,
  boletin,
}: {
  /** Eventos de tramitación YA leídos por el server (vista pura). */
  eventos: TramitacionEventoRow[];
  /** Estado derivado (reusa `derivarEstadoActual`); cada campo opcional se omite. */
  estado: EstadoActual;
  /** Boletín del proyecto: construye el deep-link real de "ver todos" (WR-04). */
  boletin: string;
}) {
  if (eventos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay etapas de tramitación registradas para este proyecto.
      </p>
    );
  }

  // MISMA agrupación que la vista completa: hitos estructurales sueltos + corridas
  // de urgencia repetitivas ≥2 colapsadas en un período (una sola fuente de verdad).
  // Luego se REDUCE a los hitos clave: capa-1 resume, el detalle (TimelineView) lista
  // TODO. Así el evento rutinario no se renderiza dos veces (WR-03).
  const hitos: TimelineItem[] = hitosClaveStepper(construirItems(eventos));

  // El último ítem-evento es la posición ACTUAL (marca sobria, no-ranking).
  let ultimoEventoIdx = -1;
  hitos.forEach((it, i) => {
    if (it.kind === "evento") ultimoEventoIdx = i;
  });

  return (
    <div className="space-y-3">
      {/*
        ELEVA "¿Dónde está hoy?": la etapa actual + la urgencia vigente derivadas
        (reuso de `derivarEstadoActual`/`urgenciaVigente`). Cada línea se omite si
        no es derivable (nunca "—"). El bloque #estado (EstadoActualBlock) sigue
        dando la respuesta textual completa; aquí es el encabezado del stepper.
      */}
      {(estado.etapaLinea || estado.urgenciaVigente) && (
        <div className="space-y-0.5">
          {estado.etapaLinea && (
            <p className="text-base font-medium leading-snug">
              {estado.etapaLinea}
            </p>
          )}
          {estado.urgenciaVigente && (
            <p className="text-sm text-muted-foreground">
              Urgencia {estado.urgenciaVigente.tipo} vigente desde el{" "}
              <span className="font-mono">
                {fechaCorta(estado.urgenciaVigente.desde)}
              </span>
              .
            </p>
          )}
        </div>
      )}

      {/* Stepper de etapas: hitos clave siempre visibles + urgencia agrupada. */}
      <ol className="relative ml-1 space-y-2 pl-6">
        {hitos.map((item, i) =>
          item.kind === "periodo" ? (
            <LineaUrgenciaAgrupada
              key={item.periodo.id}
              n={item.periodo.eventos.length}
              boletin={boletin}
              periodoId={item.periodo.id}
            />
          ) : (
            <PasoEvento
              key={item.key}
              evento={item.evento}
              actual={i === ultimoEventoIdx}
            />
          ),
        )}
      </ol>
    </div>
  );
}
