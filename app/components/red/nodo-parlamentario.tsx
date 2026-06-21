"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

/**
 * <NodoParlamentario> — nodo custom de la isla NET (NET-02).
 *
 * Proyecta la identidad pública del parlamentario y NADA más: nombre + cámara.
 * Es identidad confirmada, nunca una mención sin verificar.
 *
 * ANTI-INSINUACIÓN (18-CONTEXT §Anti-insinuación HARD, DESIGN-SYSTEM §8, LOCKED):
 * el nodo proyecta SOLO el nombre público y la cámara. No proyecta la afiliación
 * (el dato vedado por el piso PII 0018/0021/0022), ni una imagen del rostro, ni
 * el identificador tributario, ni ninguna insignia de valoración u orden de
 * personas. El RPC `subgrafo_red` jamás emite esos datos vedados, y este
 * componente jamás los pinta aunque llegaran. La cámara se muestra solo como
 * identidad institucional (cuál de las dos), nunca como color de marca.
 */

export interface NodoParlamentarioData {
  /** Nombre público del parlamentario (identidad confirmada). */
  nombre: string | null;
  /** Cámara de origen ("diputados" | "senado") — identidad institucional. */
  camara: string | null;
  /** id de respaldo cuando el nombre viene vacío. */
  id: string;
  [key: string]: unknown;
}

const CAMARA_LABEL: Record<string, string> = {
  diputados: "Cámara de Diputadas y Diputados",
  senado: "Senado",
};

export function NodoParlamentario({
  data,
}: NodeProps & { data: NodoParlamentarioData }) {
  const nombre = data.nombre?.trim() || data.id;
  const camara = data.camara?.trim() ?? null;
  const camaraLabel = camara ? (CAMARA_LABEL[camara] ?? camara) : null;

  return (
    <div className="net-nodo" role="group" aria-label={`Parlamentario: ${nombre}`}>
      {/* Conectores invisibles: el grafo dibuja aristas, no implica jerarquía. */}
      <Handle
        type="target"
        position={Position.Top}
        className="net-nodo__handle"
        isConnectable={false}
      />
      <span className="net-nodo__nombre">{nombre}</span>
      {camaraLabel ? (
        <span className="net-nodo__camara">{camaraLabel}</span>
      ) : null}
      <Handle
        type="source"
        position={Position.Bottom}
        className="net-nodo__handle"
        isConnectable={false}
      />
    </div>
  );
}
