"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  type EdgeProps,
} from "@xyflow/react";
import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { safeExternalHref } from "@/lib/utils";

/**
 * <AristaHecho> — arista custom de la isla NET (NET-02).
 *
 * Cada arista es un HECHO público tipado, con fuente y ventana temporal. La
 * etiqueta DESCRIBE el hecho ("ambos recibieron audiencia de {contraparte}")
 * acompañado de su ventana temporal; el tooltip de procedencia expone origen +
 * ventana (desde/hasta) + enlace a la fuente + licencia.
 *
 * ANTI-INSINUACIÓN (18-CONTEXT, 17-LEGAL-DOSSIER §2, DESIGN-SYSTEM §8, LOCKED):
 * el copy NUNCA expresa una valoración, una medida de proximidad, ni una
 * relación entre las personas; NUNCA una explicación de motivo. Solo el hecho
 * observable y su fuente. La licencia se muestra ÚNICAMENTE si la fila la trae
 * (mecanismo de propagación de atribución listo para aristas derivadas de
 * InfoProbidad); con licencia NULL no se afirma ninguna atribución.
 */

export interface AristaHechoData {
  tipo: string;
  /** Objeto compartido que vuelve esto un hecho (p.ej. nombre de la contraparte). */
  contexto: string | null;
  /** Ventana temporal del hecho. */
  desde: string | null;
  hasta: string | null;
  /** Procedencia inline. */
  dataset: string;
  origen: string;
  enlace: string;
  /** Atribución por fila — NULL salvo que la fuente la traiga. */
  licencia: string | null;
  [key: string]: unknown;
}

/** Fecha ISO → yyyy-mm-dd literal (sin reinterpretar). */
function fechaLiteral(iso: string | null): string | null {
  if (!iso) return null;
  // Tomamos la parte de fecha tal cual viene; no reformateamos a otra zona.
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return m ? m[1] : iso;
}

/**
 * Copy del hecho por tipo de arista. Describe la co-ocurrencia observable, sin
 * afirmar sentido compartido ni relación entre las personas.
 */
export function etiquetaHecho(tipo: string, contexto: string | null): string {
  const quien = contexto?.trim() || "la misma contraparte";
  switch (tipo) {
    case "co_lobby_contraparte":
      return `Ambos recibieron audiencia de ${quien}`;
    case "co_votacion":
      return `Registrados en la misma votación: ${quien}`;
    default:
      return `Hecho público compartido: ${quien}`;
  }
}

/** Texto de ventana temporal ("entre {desde} y {hasta}" / un solo extremo). */
export function ventanaTexto(
  desde: string | null,
  hasta: string | null,
): string | null {
  const d = fechaLiteral(desde);
  const h = fechaLiteral(hasta);
  if (d && h) return d === h ? `el ${d}` : `entre ${d} y ${h}`;
  if (d) return `desde ${d}`;
  if (h) return `hasta ${h}`;
  return null;
}

/** Etiqueta visible de la arista — sólo el contenido (sin SVG path).
 *
 * La procedencia (origen + ventana + enlace + licencia) se renderiza SIEMPRE en
 * el DOM: la trazabilidad a la fuente es un principio rector (cada dato lleva
 * fuente, fecha y enlace), no un detalle escondido tras un hover. El tooltip de
 * Radix añade la misma procedencia como ayuda visual ampliada, pero el enlace
 * canónico a la fuente está siempre disponible (y accesible por teclado). */
export function EtiquetaArista({ data }: { data: AristaHechoData }) {
  const hecho = etiquetaHecho(data.tipo, data.contexto);
  const ventana = ventanaTexto(data.desde, data.hasta);
  const enlaceSeguro = safeExternalHref(data.enlace);

  const provenancia = (
    <dl className="net-prov">
      <div className="net-prov__row">
        <dt>Fuente</dt>
        <dd>{data.origen}</dd>
      </div>
      {ventana ? (
        <div className="net-prov__row">
          <dt>Periodo</dt>
          <dd className="font-mono">{ventana}</dd>
        </div>
      ) : null}
      <div className="net-prov__row">
        <dt>Registro</dt>
        <dd>{data.dataset}</dd>
      </div>
      {data.licencia ? (
        <div className="net-prov__row">
          <dt>Licencia</dt>
          <dd>{data.licencia}</dd>
        </div>
      ) : null}
    </dl>
  );

  const enlace = enlaceSeguro ? (
    <a
      href={enlaceSeguro}
      target="_blank"
      rel="noopener noreferrer"
      className="net-prov__enlace"
    >
      Ver fuente oficial ↗
    </a>
  ) : null;

  return (
    <div className="net-arista__etiqueta nodrag nopan">
      <span className="net-arista__hecho">{hecho}</span>
      {ventana ? (
        <span className="net-arista__ventana font-mono">{ventana}</span>
      ) : null}
      <TooltipProvider delayDuration={120}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="net-arista__info"
              aria-label="Procedencia de este hecho"
            >
              <Info aria-hidden className="net-arista__info-icon" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="net-arista__provenance">
            {provenancia}
            {enlace}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {/* Procedencia siempre presente en el DOM (trazabilidad a la fuente). */}
      <div className="net-arista__fuente">
        {provenancia}
        {enlace}
      </div>
    </div>
  );
}

export function AristaHecho({
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps & { data: AristaHechoData }) {
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <>
      <BaseEdge path={edgePath} className="net-arista__path" />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
        >
          <EtiquetaArista data={data} />
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
