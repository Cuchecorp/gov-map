import Link from "next/link";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EtapaBadge } from "@/components/etapa-badge";
import { CamaraChip } from "@/components/camara-chip";
import {
  ProvenanceBadge,
  type ProvenanceBadgeProps,
} from "@/components/provenance-badge";

/**
 * SearchResultCard — ficha resumida en la lista de resultados (UI-SPEC §5).
 * Server Component. Espeja la estructura de `CitacionCard` reusando el design
 * system: Card/CardHeader/CardContent + EtapaBadge + CamaraChip + ProvenanceBadge.
 *
 * SIN PUNTAJE (UI-SPEC §5): nunca se muestra cercanía coseno, porcentaje de
 * coincidencia ni rank; el orden comunica la relevancia implícitamente. El
 * título enlaza a la ficha (`/proyecto/{boletin}`, interno — nunca nueva pestaña).
 */

export interface SearchResultCardProps {
  boletin: string;
  titulo: string;
  materia: string | null;
  estado: string | null;
  camaraOrigen: string | null;
  provenance: ProvenanceBadgeProps;
}

export function SearchResultCard({
  boletin,
  titulo,
  materia,
  estado,
  camaraOrigen,
  provenance,
}: SearchResultCardProps) {
  return (
    <Card className="rounded-[var(--radius-tile)]">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <EtapaBadge estado={estado} />
          <CamaraChip camara={camaraOrigen} />
          <span className="font-mono text-sm text-muted-foreground">
            Boletín N°{boletin}
          </span>
        </div>
        <h3 className="text-base font-semibold mt-1">
          <Link
            href={`/proyecto/${boletin}`}
            className="hover:text-primary hover:underline underline-offset-2"
          >
            {titulo}
          </Link>
        </h3>
      </CardHeader>

      <CardContent className="space-y-2">
        {materia && (
          <p className="text-sm text-muted-foreground line-clamp-2">{materia}</p>
        )}
        <div className="pt-1">
          <ProvenanceBadge {...provenance} />
        </div>
      </CardContent>
    </Card>
  );
}
