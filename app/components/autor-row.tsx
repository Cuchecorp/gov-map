import Link from "next/link";

import { IdentityMarker } from "@/components/identity-marker";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { sourceLabel } from "@/lib/types";

/**
 * Fila de un autor de proyecto (AUTOR-02, guarda de identidad TRAM-06 espejo).
 *
 * GUARDA DE IDENTIDAD (riesgo existencial #1): el nombre se muestra como enlace
 * a la ficha del parlamentario SOLO si `estado_vinculo === 'confirmado'` Y
 * `parlamentario_id` está presente. En cualquier otro caso se muestra el nombre
 * crudo acompañado de <IdentityMarker/>.
 * NUNCA se afirma una identidad no confirmada como enlace.
 *
 * Copy sobrio: no se usa vocabulario causal ni se insinúa intención.
 * Este componente NO compone con votos, lobby ni dinero.
 */

/** Fila plana de proyecto_autor (espejo del DDL 0051). */
export interface ProyectoAutorRow {
  id?: number;
  boletin: string;
  autor_crudo: string;
  autor_crudo_norm: string;
  parlamentario_id: string | null;
  metodo: string | null;
  estado_vinculo: string | null;
  origen: string;
  fecha_captura: string;
  enlace: string;
}

export function AutorRow({ autor }: { autor: ProyectoAutorRow }) {
  const confirmado =
    autor.estado_vinculo === "confirmado" && autor.parlamentario_id != null;

  return (
    <li className="flex flex-wrap items-start justify-between gap-2 py-1.5 text-sm">
      <span className="flex items-center gap-1 flex-wrap">
        {confirmado ? (
          <Link
            href={`/parlamentario/${autor.parlamentario_id}`}
            className="text-primary underline underline-offset-2"
          >
            {autor.autor_crudo}
          </Link>
        ) : (
          <>
            <span>{autor.autor_crudo}</span>
            <IdentityMarker />
          </>
        )}
      </span>
      <ProvenanceBadge
        capturedAt={
          autor.fecha_captura ? new Date(autor.fecha_captura) : null
        }
        sourceName={sourceLabel(autor.origen)}
        sourceUrl={autor.enlace || null}
      />
    </li>
  );
}
