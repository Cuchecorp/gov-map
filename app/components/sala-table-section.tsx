import Link from "next/link";

import { EtapaBadge } from "@/components/etapa-badge";
import {
  ProvenanceBadge,
  type ProvenanceBadgeProps,
} from "@/components/provenance-badge";

/**
 * SalaTableSection — tabla semanal de sala (UI-SPEC §6). Dos modos excluyentes:
 *
 *  - `available`: la fuente del Senado trajo filas → render de la tabla
 *    estructurada (N° / Boletín / Materia / Etapa), boletín enlazado a la ficha,
 *    + ProvenanceBadge de la sesión.
 *  - `degraded`: la tabla NO está disponible (Cámara no publica un endpoint
 *    estructurado, o la semana no tiene sesión) → empty-state HONESTO con el
 *    enlace al PDF / portal oficial. NUNCA fabrica filas, NUNCA dice
 *    "próximamente", NUNCA usa estilo destructive (no es un error — T-06-09).
 */

export interface SalaTablaItem {
  posicion: number;
  parteSesion: string;
  materia: string | null;
  boletin: string | null;
  etapa: string | null;
}

export type SalaTableSectionProps =
  | {
      mode: "available";
      items: SalaTablaItem[];
      provenance: ProvenanceBadgeProps;
      weekLabel?: string;
    }
  | {
      mode: "degraded";
      items?: undefined;
      provenance?: undefined;
      weekLabel?: string;
    };

// PDF oficial de la tabla semanal de Cámara (degradación, UI-SPEC §6.2).
const CAMARA_TABLA_PDF =
  "https://www.camara.cl/trabajamos/sala_sesion.aspx";
const SENADO_SALA_URL = "https://www.senado.cl/actividad-legislativa/sala";

export function SalaTableSection(props: SalaTableSectionProps) {
  if (props.mode === "degraded") {
    return <DegradedState weekLabel={props.weekLabel} />;
  }

  const { items, provenance, weekLabel } = props;

  if (items.length === 0) {
    return <DegradedState weekLabel={weekLabel} />;
  }

  return (
    <div>
      <ProvenanceBadge {...provenance} />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <caption className="sr-only">
            Orden del día de sala
            {weekLabel ? ` — ${weekLabel}` : ""}
          </caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground font-semibold text-left">
              <th scope="col" className="py-2 pr-4">
                N°
              </th>
              <th scope="col" className="py-2 pr-4">
                Boletín
              </th>
              <th scope="col" className="py-2 pr-4">
                Materia
              </th>
              <th scope="col" className="py-2">
                Etapa
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.posicion}
                className="border-b border-border last:border-0 hover:bg-muted/50"
              >
                <td className="py-2 pr-4 font-mono text-sm align-top">
                  {item.posicion}
                </td>
                <td className="py-2 pr-4 align-top">
                  {item.boletin ? (
                    <Link
                      href={`/proyecto/${item.boletin}`}
                      className="text-primary underline underline-offset-2"
                      aria-label={`Ver proyecto Boletín N°${item.boletin}`}
                    >
                      N°{item.boletin}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-2 pr-4 leading-relaxed align-top">
                  {item.materia ?? "—"}
                </td>
                <td className="py-2 align-top">
                  {item.etapa ? (
                    <EtapaBadge estado={item.etapa} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DegradedState({ weekLabel }: { weekLabel?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-6 py-8 text-center space-y-2">
      <p className="text-base font-semibold text-foreground">
        Tabla de sala no disponible
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        El organismo no ha publicado el orden del día de sala
        {weekLabel ? ` para ${weekLabel}` : " para esta semana"}, o la fuente no
        pudo obtenerse de forma confiable.
      </p>
      <p className="text-sm text-muted-foreground">
        Puedes consultar directamente en{" "}
        <a
          href={CAMARA_TABLA_PDF}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
          aria-label="Sala de la Cámara (abre en nueva pestaña)"
        >
          Cámara ↗
        </a>{" "}
        o{" "}
        <a
          href={SENADO_SALA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
          aria-label="Sala del Senado (abre en nueva pestaña)"
        >
          Senado ↗
        </a>
        .
      </p>
    </div>
  );
}
