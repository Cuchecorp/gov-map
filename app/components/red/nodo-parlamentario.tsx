"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

import { formatNombre } from "@/lib/format";

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
  /** Nodo de partida del ego-framing (55-05): marca sobria de wayfinding —
   *  señala DESDE QUÉ parlamentario se centró la vista, NO un orden ni valoración. */
  esSeed?: boolean;
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
  // Display-only (F54 Contract 1): re-casea el nombre RENDERIZADO en label + aria.
  // El id de respaldo (D####/S####) trae mayúscula → passthrough.
  const nombreDisplay = formatNombre(nombre);
  // Ego-framing (55-05): marca sobria del nodo de partida. Es wayfinding (desde
  // quién se centró la vista), NO un ranking — sin puntaje, sin insignia de valor.
  const esSeed = data.esSeed === true;

  return (
    <div
      className={esSeed ? "net-nodo net-nodo--seed" : "net-nodo"}
      role="group"
      aria-label={`Parlamentario: ${nombreDisplay}${esSeed ? " (punto de partida)" : ""}`}
    >
      {/* Conectores invisibles: el grafo dibuja aristas, no implica jerarquía. */}
      <Handle
        type="target"
        position={Position.Top}
        className="net-nodo__handle"
        isConnectable={false}
      />
      <span className="net-nodo__nombre">{nombreDisplay}</span>
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
