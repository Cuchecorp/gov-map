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

function LineaUrgenciaAgrupada({ n }: { n: number }) {
  return (
    <li className={"relative " + CONECTOR}>
      <span
        aria-hidden="true"
        className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-muted-foreground/40"
      />
      <p className="text-sm leading-snug text-muted-foreground">
        {/* Copy LOCKED (UI-SPEC §Copywriting): conteo NEUTRO, sin verbo causal. */}
        {n} trámites de urgencia{" · "}
        {/* Afordance de drill-down (petróleo permitido): salta al detalle completo. */}
        <a
          href="#timeline"
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
}: {
  /** Eventos de tramitación YA leídos por el server (vista pura). */
  eventos: TramitacionEventoRow[];
  /** Estado derivado (reusa `derivarEstadoActual`); cada campo opcional se omite. */
  estado: EstadoActual;
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
  const items: TimelineItem[] = construirItems(eventos);

  // El último ítem-evento es la posición ACTUAL (marca sobria, no-ranking).
  let ultimoEventoIdx = -1;
  items.forEach((it, i) => {
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
        {items.map((item, i) =>
          item.kind === "periodo" ? (
            <LineaUrgenciaAgrupada
              key={item.periodo.id}
              n={item.periodo.eventos.length}
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
