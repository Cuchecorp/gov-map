import Link from "next/link";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CamaraChip } from "@/components/camara-chip";
import {
  ProvenanceBadge,
  type ProvenanceBadgeProps,
} from "@/components/provenance-badge";

/**
 * CitacionCard — una citación de comisión de cualquier cámara (UI-SPEC §4).
 *
 * GUARDA DE IDENTIDAD (T-06-02): los invitados son gestores de interés /
 * terceros, NO parlamentarios. Se muestran como texto crudo (nombre + calidad
 * entre paréntesis). NUNCA se usa IdentityMarker ni se enlaza a
 * `/parlamentario/`. El único enlace interno es el del boletín a la ficha de
 * Fase 5 (`/proyecto/[boletin]`), cuando el punto trae boletín.
 */

export interface CitacionInvitado {
  nombre: string;
  calidad?: string | null;
}

export interface CitacionCardProps {
  comision: string;
  fecha: Date | null;
  horario: string | null;
  sala: string | null;
  materia: string | null;
  camara: "camara" | "senado";
  invitados: CitacionInvitado[];
  /** Boletín del primer punto con proyecto (cruce a la ficha). `null` → sin enlace. */
  boletin?: string | null;
  provenance: ProvenanceBadgeProps;
}

const horaFmt = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

export function CitacionCard({
  comision,
  fecha,
  horario,
  sala,
  materia,
  camara,
  invitados,
  boletin,
  provenance,
}: CitacionCardProps) {
  const fechaLabel = fecha ? horaFmt.format(fecha) : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CamaraChip camara={camara} />
          {(fechaLabel || horario) && (
            <span className="font-mono text-sm text-muted-foreground">
              {[fechaLabel, horario].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
        <h3 className="text-base font-semibold mt-1">{comision}</h3>
        {sala && (
          <p className="text-sm text-muted-foreground">{sala}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-2">
        {materia && (
          <div className="text-base leading-relaxed">
            <p className="line-clamp-3">{materia}</p>
            {materia.length > 220 && (
              <details className="mt-1 text-sm text-muted-foreground">
                <summary className="cursor-pointer text-primary underline underline-offset-2">
                  ver más
                </summary>
                <p className="mt-1 leading-relaxed">{materia}</p>
              </details>
            )}
          </div>
        )}

        {invitados.length > 0 && (
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold">Invitados: </span>
            {invitados.map((inv, i) => (
              <span key={i}>
                {inv.nombre}
                {inv.calidad && (
                  <span className="ml-1 text-muted-foreground">
                    ({inv.calidad})
                  </span>
                )}
                {i < invitados.length - 1 && ", "}
              </span>
            ))}
          </div>
        )}

        {boletin && (
          <div>
            <Link
              href={`/proyecto/${boletin}`}
              className="text-sm text-primary underline underline-offset-2"
              aria-label={`Ver proyecto Boletín N°${boletin}`}
            >
              Boletín N°{boletin} →
            </Link>
          </div>
        )}

        <div className="pt-1">
          <ProvenanceBadge {...provenance} />
        </div>
      </CardContent>
    </Card>
  );
}
