import { CamaraChip, camaraDotColor } from "@/components/camara-chip";
import { cn } from "@/lib/utils";
import { fechaCorta } from "@/lib/format";
import type { TramitacionEventoRow } from "@/lib/types";

/**
 * TimelineEvent — fila de un evento del timeline (UI-SPEC §3.2).
 * Rail izquierdo CSS (sin SVG); dot coloreado por cámara; CamaraChip + fecha
 * (mono) + tipo + descripción + "Ver fuente oficial ↗".
 *
 * SC7: el `ProvenanceBadge` por-evento se RETIRÓ (había 100+ badges idénticos en un
 * timeline largo); ahora hay UN solo badge en el heading de la sección (page.tsx).
 * La trazabilidad por dato se conserva con el link "Ver fuente oficial ↗" por evento.
 */
export function TimelineEvent({ evento }: { evento: TramitacionEventoRow }) {
  const fecha = evento.fecha ? new Date(evento.fecha) : null;

  return (
    <li className="relative mb-6 last:mb-0">
      <span
        className={cn(
          "absolute -left-[17px] top-2 w-3 h-3 rounded-full border-2 border-background",
          camaraDotColor(evento.camara)
        )}
        aria-hidden="true"
      />

      <div className="flex flex-wrap items-center gap-2">
        <CamaraChip camara={evento.camara} />
        {fecha && (
          <span className="font-mono text-sm text-muted-foreground leading-none">
            {fechaCorta(fecha)}
          </span>
        )}
      </div>

      <p className="text-sm font-semibold mt-1 capitalize">{evento.tipo}</p>
      <p className="text-base leading-relaxed mt-1">{evento.descripcion}</p>

      {evento.enlace && (
        <a
          href={evento.enlace}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline-offset-2 underline mt-2 min-h-[44px] flex items-center"
          aria-label="Ver fuente oficial (abre en nueva pestaña)"
        >
          Ver fuente oficial ↗
        </a>
      )}
    </li>
  );
}
