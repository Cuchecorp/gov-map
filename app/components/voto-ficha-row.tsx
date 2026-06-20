import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { IdentityMarker } from "@/components/identity-marker";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { SELECCION_STYLE } from "@/components/voto-row";
import { cn } from "@/lib/utils";
import { sourceLabel } from "@/lib/types";
import { extractoIdea, conteoVotacion } from "@/lib/format";
import type {
  Seleccion,
  VotoFichaRow as VotoFichaRowData,
  VotoFichaMencion,
} from "@/lib/types";

/**
 * VotoFichaRow — fila de un voto en la ficha del PARLAMENTARIO (UI-SPEC §3.2, §9).
 *
 * Hermano de `VotoRow` (que vive en la ficha del PROYECTO). Aquí la subjetividad
 * es el parlamentario. Phase 22 la hace INSTRUCTIVA: ya no muestra sólo el chip +
 * boletín, sino la SUSTANCIA del proyecto (titulo + extracto literal de la idea
 * matriz, o el honest-state "no disponible aún" cuando es null — NUNCA fabricado)
 * y el DESENLACE de la votación (cómo votó la persona enmarcado contra el
 * resultado + el conteo total_si–total_no en Mono). El framing del desenlace es un
 * HECHO de la votación (DESIGN-SYSTEM §8), nunca una valoración del voto.
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
 *
 * Anti-insinuación (DESIGN-SYSTEM §6/§8): cero adjetivo/juicio sobre el voto, cero
 * lenguaje causal, cero score; el nombre interno "rebeldías" JAMÁS aparece aquí.
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

/** Forma mínima de sustancia/desenlace que comparten fila confirmada y mención. */
interface SustanciaDesenlace {
  seleccion: Seleccion;
  titulo: string | null;
  idea_matriz: string | null;
  resultado: string | null;
  total_si: number | null;
  total_no: number | null;
}

/**
 * Bloque de SUSTANCIA (idea matriz o honest-state) + DESENLACE (cómo votó la
 * persona contra el resultado de la votación). PURO; cero fabricación. La idea se
 * trunca LITERAL (`extractoIdea`); el desenlace sólo se muestra si hay `resultado`.
 */
function SustanciaYDesenlace({
  seleccion,
  idea_matriz,
  resultado,
  total_si,
  total_no,
}: SustanciaDesenlace) {
  const hayConteo = total_si != null && total_no != null;
  return (
    <div className="w-full space-y-1">
      <p className="text-sm text-muted-foreground">
        {idea_matriz
          ? `De qué trata: ${extractoIdea(idea_matriz)}`
          : "De qué trata: no disponible aún"}
      </p>
      {resultado && (
        <p className="text-sm text-muted-foreground">
          Votó {OPCION_LABEL[seleccion]} · el proyecto fue {resultado}
          {hayConteo && (
            <>
              {" "}
              <span className="font-mono">
                {conteoVotacion(total_si, total_no)}
              </span>
            </>
          )}
        </p>
      )}
    </div>
  );
}

/** Fila confirmada (estado (a)): la subjetividad es este parlamentario. */
export function VotoFichaRow({ voto }: { voto: VotoFichaRowData }) {
  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-sm border-t first:border-t-0">
      <OpcionChip seleccion={voto.seleccion} />
      {/* Titulo prominente (Body); fallback honesto al boletín cuando es null. */}
      {voto.titulo ? (
        <Link
          href={`/proyecto/${voto.boletin}`}
          className="text-base text-primary underline underline-offset-2"
        >
          {voto.titulo}
        </Link>
      ) : (
        <Link
          href={`/proyecto/${voto.boletin}`}
          className="font-mono text-primary underline underline-offset-2"
        >
          Boletín N°{voto.boletin}
        </Link>
      )}
      <span className="ml-auto">
        <ProvenanceBadge
          capturedAt={voto.fecha_captura ? new Date(voto.fecha_captura) : null}
          sourceName={sourceLabel(voto.origen)}
          sourceUrl={voto.enlace ?? null}
        />
      </span>
      <SustanciaYDesenlace
        seleccion={voto.seleccion}
        titulo={voto.titulo}
        idea_matriz={voto.idea_matriz}
        resultado={voto.resultado}
        total_si={voto.total_si}
        total_no={voto.total_no}
      />
    </li>
  );
}

/**
 * Mención NO verificada (estado (b), §3.6): vive fuera de los agregados, en el
 * área "menciones sin verificar". El nombre crudo se muestra con IdentityMarker
 * y NUNCA enlaza a esta ficha. El boletín sí enlaza (ruta interna confiable).
 * Phase 22: muestra la misma sustancia/desenlace que la fila confirmada cuando la
 * fuente los trae, conservando su IdentityMarker.
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
          // Sustancia/desenlace (0028): se traspasa lo que la mención traiga.
          titulo: voto.titulo ?? null,
          idea_matriz: voto.idea_matriz ?? null,
          resultado: voto.resultado ?? null,
          total_si: voto.total_si ?? null,
          total_no: voto.total_no ?? null,
          total_abstencion: voto.total_abstencion ?? null,
          total_pareo: voto.total_pareo ?? null,
          quorum: voto.quorum ?? null,
        }}
      />
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-sm border-t first:border-t-0">
      <OpcionChip seleccion={voto.seleccion} />
      {voto.titulo ? (
        <Link
          href={`/proyecto/${voto.boletin}`}
          className="text-base text-primary underline underline-offset-2"
        >
          {voto.titulo}
        </Link>
      ) : (
        <Link
          href={`/proyecto/${voto.boletin}`}
          className="font-mono text-primary underline underline-offset-2"
        >
          Boletín N°{voto.boletin}
        </Link>
      )}
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
      <SustanciaYDesenlace
        seleccion={voto.seleccion}
        titulo={voto.titulo ?? null}
        idea_matriz={voto.idea_matriz ?? null}
        resultado={voto.resultado ?? null}
        total_si={voto.total_si ?? null}
        total_no={voto.total_no ?? null}
      />
    </li>
  );
}
