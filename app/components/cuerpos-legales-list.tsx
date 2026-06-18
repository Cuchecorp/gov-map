import type { CuerpoLegalRow } from "@/lib/types";

/**
 * CuerposLegalesList — lista normalizada de cuerpos legales afectados
 * (norma + artículos citados), UI-SPEC §6.1.
 *
 * Lista honesta: si no se identificó ninguno (no extraído o texto no
 * disponible), un párrafo factual — nunca afirma que el proyecto no afecte
 * normas, solo que no se identificaron a partir del texto disponible.
 */

export interface CuerposLegalesListProps {
  cuerpos: CuerpoLegalRow[];
}

export function CuerposLegalesList({ cuerpos }: CuerposLegalesListProps) {
  if (cuerpos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No se identificaron cuerpos legales afectados a partir del texto
        disponible.
      </p>
    );
  }

  return (
    <ul className="space-y-1 text-sm">
      {cuerpos.map((c, i) => (
        <li key={`${c.norma}-${i}`} className="leading-relaxed">
          <span className="font-medium text-foreground">{c.norma}</span>
          {c.articulos?.length ? (
            <span className="text-muted-foreground">
              {" "}
              — {c.articulos.join(", ")}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
