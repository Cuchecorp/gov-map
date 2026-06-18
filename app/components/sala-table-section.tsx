import Link from "next/link";

import {
  ProvenanceBadge,
  type ProvenanceBadgeProps,
} from "@/components/provenance-badge";

/**
 * SalaTableSection — tabla semanal de sala (UI-SPEC §6). Dos modos excluyentes:
 *
 *  - `available`: la fuente del Senado trajo filas → render de la tabla
 *    estructurada (N° / Boletín / Materia / Parte de sesión), boletín enlazado a
 *    la ficha, + ProvenanceBadge de la sesión.
 *  - `degraded`: la tabla NO está disponible como dato estructurado para la
 *    Cámara → marcador HONESTO **acotado a la Cámara** con el enlace al PDF
 *    oficial. NUNCA fabrica filas, NUNCA dice "próximamente", NUNCA usa estilo
 *    destructive (no es un error — T-06-09), y NUNCA afirma que el Senado falló.
 */

export interface SalaTablaItem {
  /** Clave compuesta única en la semana (sesión + posición) — IN-01. */
  key: string;
  posicion: number;
  parteSesion: string;
  materia: string | null;
  boletin: string | null;
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
      /** La degradación de la Cámara enlaza al PDF oficial recordado por la ingesta (CR-01). */
      camaraPdfUrl: string;
      items?: undefined;
      provenance?: undefined;
      weekLabel?: string;
    };

export function SalaTableSection(props: SalaTableSectionProps) {
  if (props.mode === "degraded") {
    return <CamaraDegradedState weekLabel={props.weekLabel} camaraPdfUrl={props.camaraPdfUrl} />;
  }

  const { items, provenance, weekLabel } = props;

  if (items.length === 0) {
    // available sin filas: no fabricar; el contenedor decide qué mostrar.
    return null;
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
                Parte de sesión
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.key}
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
                  {item.parteSesion ? (
                    <span className="text-sm text-muted-foreground">
                      {item.parteSesion}
                    </span>
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

/**
 * Marcador de degradación HONESTA acotado a la CÁMARA (CR-01, CR-02): la Cámara no
 * publica la tabla de sala como dato estructurado; su único artefacto es el PDF
 * oficial (`verDoc.aspx?prmTipo=TABLASEMANAL`), cuya URL canónica es la MISMA que la
 * ingesta registró (`camaraPdfUrl`). No afirma que el Senado falló: si el Senado tiene
 * datos, se renderizan arriba; este bloque sólo habla de la Cámara.
 */
function CamaraDegradedState({
  weekLabel,
  camaraPdfUrl,
}: {
  weekLabel?: string;
  camaraPdfUrl: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-6 py-8 space-y-2">
      <p className="text-base font-semibold text-foreground">
        Cámara: tabla no disponible como dato estructurado
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        La Cámara no publica el orden del día de sala
        {weekLabel ? ` de ${weekLabel}` : " de esta semana"} en un formato de datos
        estructurado. Consúltalo en el PDF oficial.
      </p>
      <p className="text-sm text-muted-foreground">
        <a
          href={camaraPdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
          aria-label="Tabla semanal de sala de la Cámara, PDF oficial (abre en nueva pestaña)"
        >
          Ver tabla semanal de sala (PDF oficial de la Cámara) ↗
        </a>
      </p>
    </div>
  );
}
