import Link from "next/link";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CamaraChip } from "@/components/camara-chip";
import { formatNombre } from "@/lib/format";
import { badgeFechaCitacion } from "@/lib/dia-calendario";
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
  /**
   * Estado de cancelación verbatim de la fuente ("Suspendida"/"Sin efecto",
   * poblado en ~6-9%). Cuando presente → marca sobria. Cuando ausente → NO se
   * renderiza marca; la ausencia NUNCA equivale a "Vigente"/"Confirmada"
   * (regla LOCKED: estado ausente ≠ vigencia confirmada). Opcional →
   * backward-compatible con las llamadas existentes.
   */
  estado?: string | null;
  provenance: ProvenanceBadgeProps;
}

// CONTRATO date-only-midnight-UTC (regresión live Phase 94, ver
// `@/lib/dia-calendario`): el badge rotula el DÍA PUBLICADO por la fuente = la
// PARTE FECHA UTC de `citacion.fecha` (almacenada a medianoche UTC, hora real en
// `horario`). NO se convierte a tz America/Santiago: interpretar esa medianoche
// en Chile retrocede un día (fecha 2026-07-20T00:00Z renderizaría "19-jul").
// `badgeFechaCitacion` emite "DD-mmm" desde el día civil.

export function CitacionCard({
  comision,
  fecha,
  horario,
  sala,
  materia,
  camara,
  invitados,
  boletin,
  estado,
  provenance,
}: CitacionCardProps) {
  const fechaLabel = badgeFechaCitacion(fecha);

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
          {/* Estado de cancelación honesto (CIT-05): marca sobria en muted, sin
              badge de alarma ni --destructive. La ausencia de estado NO se
              rotula (nunca "Vigente"/"Confirmada"). */}
          {estado && (
            <span className="text-sm text-muted-foreground">· {estado}</span>
          )}
        </div>
        <h3 className="text-base font-semibold mt-1">{comision}</h3>
        {sala && (
          <p className="text-sm text-muted-foreground">{sala}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-2">
        {materia &&
          (materia.length > 220 ? (
            // IN-03: una sola fuente del texto. Cerrado → párrafo clampeado;
            // abierto (`group-open`) → se oculta el clampeado y se muestra el
            // completo, sin duplicar la materia.
            <details className="group text-base leading-relaxed">
              <p className="line-clamp-3 group-open:hidden">{materia}</p>
              <p className="hidden leading-relaxed group-open:block">{materia}</p>
              <summary className="mt-1 cursor-pointer text-sm text-primary underline underline-offset-2 list-none">
                <span className="group-open:hidden">ver más</span>
                <span className="hidden group-open:inline">ver menos</span>
              </summary>
            </details>
          ) : (
            <p className="text-base leading-relaxed">{materia}</p>
          ))}

        {invitados.length > 0 && (
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold">Invitados: </span>
            {invitados.map((inv, i) => (
              <span key={i}>
                {formatNombre(inv.nombre)}
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
