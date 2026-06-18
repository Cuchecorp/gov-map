import { EtapaBadge } from "@/components/etapa-badge";
import { CamaraChip } from "@/components/camara-chip";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { AutoresList } from "@/components/autores-list";
import { Badge } from "@/components/ui/badge";
import type { ProyectoRow } from "@/lib/types";
import { sourceLabel } from "@/lib/types";

/**
 * FichaHeader — bloque cabecera del proyecto (UI-SPEC §3.1.1).
 * EtapaBadge + CamaraChip + título + boletín (mono) + chips iniciativa/materia
 * + autores (texto plano, nunca enlaces en Fase 5) + ProvenanceBadge.
 */
export function FichaHeader({ proyecto }: { proyecto: ProyectoRow }) {
  const capturedAt = proyecto.fecha_captura
    ? new Date(proyecto.fecha_captura)
    : null;

  return (
    <header>
      <div className="flex flex-wrap gap-2">
        <EtapaBadge estado={proyecto.estado ?? proyecto.etapa} />
        <CamaraChip camara={proyecto.camara_origen} />
      </div>

      <h1 className="text-3xl font-semibold leading-tight mt-4">
        {proyecto.titulo}
      </h1>

      <p className="text-sm font-normal text-muted-foreground mt-1 font-mono leading-none">
        Boletín N°{proyecto.boletin}
      </p>

      <div className="flex flex-wrap gap-2 mt-3 text-sm">
        {proyecto.iniciativa && (
          <Badge
            variant="secondary"
            className="font-normal"
            aria-label={`Iniciativa: ${proyecto.iniciativa}`}
          >
            {proyecto.iniciativa}
          </Badge>
        )}
        {proyecto.materia && (
          <Badge
            variant="secondary"
            className="font-normal"
            aria-label={`Materia: ${proyecto.materia}`}
          >
            {proyecto.materia}
          </Badge>
        )}
      </div>

      <AutoresList autores={proyecto.autores ?? []} />

      <div className="mt-4">
        <ProvenanceBadge
          capturedAt={capturedAt}
          sourceName={sourceLabel(proyecto.origen)}
          sourceUrl={proyecto.enlace || null}
        />
      </div>
    </header>
  );
}
