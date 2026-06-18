import {
  ProvenanceBadge,
  type ProvenanceBadgeProps,
} from "@/components/provenance-badge";

/**
 * IdeaMatrizBlock — la idea matriz LITERAL (cita textual del texto fuente) o el
 * estado honesto "no disponible" (UI-SPEC §6.1).
 *
 * La idea matriz es una cita verbatim (extracción literal, nunca abstractiva):
 * se renderiza en `<blockquote>` para señalar que es textual, no editorial, con
 * su propia procedencia (el texto del que se extrajo).
 *
 * Degradación honesta first-class (T-07-13): cuando `ideaMatriz` es null (texto
 * íntegro no obtenible), se muestra un bloque gris (`bg-muted/40`, jamás estilo
 * de error/destructivo — la ausencia NO es un error), sin fabricar resumen,
 * sin "próximamente", sin negar que el proyecto tenga idea matriz.
 */

export interface IdeaMatrizBlockProps {
  /** Cita literal, o `null` si el texto fuente no se obtuvo (degradación honesta). */
  ideaMatriz: string | null;
  /** Procedencia de la cita (BCN / Senado). Solo se usa cuando hay cita. */
  provenance?: ProvenanceBadgeProps;
}

export function IdeaMatrizBlock({ ideaMatriz, provenance }: IdeaMatrizBlockProps) {
  if (ideaMatriz === null || ideaMatriz.trim().length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 px-6 py-6 text-sm text-muted-foreground leading-relaxed">
        <p className="font-semibold text-foreground">Idea matriz no disponible</p>
        <p className="mt-1">
          El texto íntegro de este proyecto no pudo obtenerse de la fuente
          oficial, por lo que no se ha extraído su idea matriz. Puedes consultar
          el proyecto completo en la fuente original.
        </p>
      </div>
    );
  }

  return (
    <div>
      <blockquote className="border-l-2 border-border pl-4 text-base leading-relaxed text-foreground">
        {ideaMatriz}
      </blockquote>
      {provenance && (
        <div className="mt-3">
          <ProvenanceBadge {...provenance} />
        </div>
      )}
    </div>
  );
}
