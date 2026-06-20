import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { IdentityMarker } from "@/components/identity-marker";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { SELECCION_STYLE } from "@/components/voto-row";
import { cn } from "@/lib/utils";
import { sourceLabel } from "@/lib/types";
import type {
  Seleccion,
  VotoFichaRow as VotoFichaRowData,
  VotoFichaMencion,
} from "@/lib/types";

/**
 * VotoFichaRow — fila de un voto en la ficha del PARLAMENTARIO (UI-SPEC §3.2).
 *
 * Hermano de `VotoRow` (que vive en la ficha del PROYECTO). Aquí la subjetividad
 * es el parlamentario, así que la fila muestra la opción del parlamentario sobre
 * UNA votación + el boletín enlazado + ProvenanceBadge.
 *
 * Dos guardas distintas, NO confundir:
 *   - Enlace al PROYECTO (`/proyecto/${boletin}`): ruta interna confiable; el
 *     proyecto existe. SIEMPRE se enlaza.
 *   - Enlace/atribución del PARLAMENTARIO (estado (b), §3.6): una mención cuyo
 *     `estado_vinculo` NO es 'confirmado' NUNCA se atribuye a esta ficha; se
 *     muestra el nombre crudo + <IdentityMarker/>. El RPC confirmado no emite
 *     menciones no verificadas, pero el componente las soporta (fixtures de test).
 *
 * Copy de opciones = UI-SPEC §9 ("A favor"/"En contra"/...), distinta de la del
 * proyecto ("Sí"/"No"); reutiliza el className a11y-safe de SELECCION_STYLE.
 */

const OPCION_LABEL: Record<Seleccion, string> = {
  si: "A favor",
  no: "En contra",
  abstencion: "Abstención",
  pareo: "Pareo",
  ausente: "Ausente",
};

function OpcionChip({ seleccion }: { seleccion: Seleccion }) {
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent shrink-0", SELECCION_STYLE[seleccion].className)}
    >
      {OPCION_LABEL[seleccion]}
    </Badge>
  );
}

/** Fila confirmada (estado (a)): la subjetividad es este parlamentario. */
export function VotoFichaRow({ voto }: { voto: VotoFichaRowData }) {
  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-sm border-t first:border-t-0">
      <OpcionChip seleccion={voto.seleccion} />
      <Link
        href={`/proyecto/${voto.boletin}`}
        className="font-mono text-primary underline underline-offset-2"
      >
        Boletín N°{voto.boletin}
      </Link>
      <span className="ml-auto">
        <ProvenanceBadge
          capturedAt={voto.fecha_captura ? new Date(voto.fecha_captura) : null}
          sourceName={sourceLabel(voto.origen)}
          sourceUrl={voto.enlace ?? null}
        />
      </span>
    </li>
  );
}

/**
 * Mención NO verificada (estado (b), §3.6): vive fuera de los agregados, en el
 * área "menciones sin verificar". El nombre crudo se muestra con IdentityMarker
 * y NUNCA enlaza a esta ficha. El boletín sí enlaza (ruta interna confiable).
 */
export function VotoFichaMencionRow({ voto }: { voto: VotoFichaMencion }) {
  const confirmado =
    voto.estado_vinculo === "confirmado" && voto.parlamentario_id != null;

  // Si por alguna razón llega confirmada por aquí, se degrada a la fila normal.
  if (confirmado) {
    return (
      <VotoFichaRow
        voto={{
          votacion_id: voto.votacion_id,
          boletin: voto.boletin,
          fecha: voto.fecha,
          seleccion: voto.seleccion,
          etapa: null,
          camara: voto.camara,
          origen: voto.origen,
          fecha_captura: voto.fecha_captura,
          enlace: voto.enlace,
          // Sustancia/desenlace (0028): la mención cruda no los trae → null honesto.
          titulo: null,
          idea_matriz: null,
          resultado: null,
          total_si: null,
          total_no: null,
          total_abstencion: null,
          total_pareo: null,
          quorum: null,
        }}
      />
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-sm border-t first:border-t-0">
      <OpcionChip seleccion={voto.seleccion} />
      <Link
        href={`/proyecto/${voto.boletin}`}
        className="font-mono text-primary underline underline-offset-2"
      >
        Boletín N°{voto.boletin}
      </Link>
      <span className="flex items-center">
        <span>{voto.mencion_nombre}</span>
        <IdentityMarker />
      </span>
      <span className="ml-auto">
        <ProvenanceBadge
          capturedAt={voto.fecha_captura ? new Date(voto.fecha_captura) : null}
          sourceName={sourceLabel(voto.origen)}
          sourceUrl={voto.enlace ?? null}
        />
      </span>
    </li>
  );
}
