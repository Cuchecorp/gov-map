import { TimelineEvent } from "@/components/timeline-event";
import type { TramitacionEventoRow } from "@/lib/types";

/**
 * TimelineView — contenedor vertical del timeline (UI-SPEC §3.2).
 * Lista CSS con rail izquierdo. El orden lo provee el servidor (fecha ASC,
 * eventos de ambas cámaras ya fusionados por boletín). Empty state §6.1.
 */
export function TimelineView({ eventos }: { eventos: TramitacionEventoRow[] }) {
  if (eventos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay eventos de tramitación registrados para este proyecto.
      </p>
    );
  }

  return (
    <ul className="relative pl-8 border-l-2 border-border">
      {eventos.map((evento, i) => (
        <TimelineEvent
          key={`${evento.camara}-${evento.fecha}-${evento.tipo}-${i}`}
          evento={evento}
        />
      ))}
    </ul>
  );
}
