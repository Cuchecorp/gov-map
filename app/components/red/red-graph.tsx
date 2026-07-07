"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  NodoParlamentario,
  type NodoParlamentarioData,
} from "./nodo-parlamentario";
import { AristaHecho, type AristaHechoData } from "./arista-hecho";

/**
 * <RedGraph> — isla cliente del grafo de relaciones NET (NET-02).
 *
 * Recibe como props el JSON plano que emite el RPC `subgrafo_red` (PII-safe:
 * nodo = id/nombre/cámara) y lo renderiza con `@xyflow/react` como CLIENT ISLAND
 * — esto mantiene la librería (~1.2MB) fuera del bundle server de las demás
 * rutas. La firma de props NO cambia respecto del placeholder 18-02: la ruta
 * `/red` (server) sigue montando `<RedGraph subgrafo={data} />`.
 *
 * Ofrece dos filtros client-side sobre el subgrafo YA recibido (sin round-trips):
 * por TIPO de relación y por VENTANA temporal (desde/hasta). Cada arista lleva su
 * procedencia en un tooltip (origen + ventana + enlace + licencia).
 *
 * ANTI-INSINUACIÓN (18-CONTEXT, 17-LEGAL-DOSSIER §2, DESIGN-SYSTEM §8, LOCKED):
 * - el nodo es identidad pública confirmada (nombre + cámara), nunca la
 *   afiliación, ni una imagen del rostro, ni una insignia que valore u ordene
 *   personas;
 * - la arista es un hecho tipado con fuente y ventana; el copy describe el hecho,
 *   jamás una valoración, una medida de proximidad, ni una explicación de motivo;
 * - el layout es una rejilla determinista agrupada por cámara — NUNCA una
 *   simulación física que junte nodos "próximos" (esa proximidad visual se leería
 *   como una relación entre las personas);
 * - sin medida agregada de co-ocurrencia, sin orden de personas, sin camino
 *   presentado como hallazgo;
 * - grafo VACÍO (0 aristas) = estado honesto ("aún no hay relaciones para
 *   mostrar"), NUNCA un error ni un nodo inventado.
 */

// Contrato del JSON del RPC subgrafo_red (PII-safe: nodo = id/nombre/camara).
export interface SubgrafoNodo {
  id: string;
  nombre: string | null;
  camara: string | null;
}

export interface SubgrafoArista {
  tipo: string;
  a: string;
  b: string;
  contexto: string | null;
  desde: string | null;
  hasta: string | null;
  dataset: string;
  origen: string;
  enlace: string;
  licencia: string | null;
}

export interface Subgrafo {
  nodos: SubgrafoNodo[];
  aristas: SubgrafoArista[];
}

export interface RedGraphProps {
  /** JSON plano emitido por el RPC `subgrafo_red` (nodos + aristas). */
  subgrafo: Subgrafo | null;
}

// Etiqueta humana sobria por tipo, para el control de filtro.
const TIPO_LABEL: Record<string, string> = {
  co_lobby_contraparte: "Audiencia de la misma contraparte",
  co_votacion: "Misma votación",
};

const nodeTypes = { parlamentario: NodoParlamentario };
const edgeTypes = { hecho: AristaHecho };

/** ISO → epoch ms; null si no hay fecha. */
function ms(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/**
 * Layout determinista por CARRIL de cámara (rejilla pura); jamás una simulación
 * física. `laneIndex` es el índice LOCAL del nodo DENTRO de su carril de cámara
 * (contador separado por cámara), NO el índice global — así las columnas avanzan
 * por-carril y cada cámara ocupa su propia banda horizontal (senado = banda 1,
 * resto = banda 0). La proximidad visual NO codifica relación (anti-insinuación
 * LOCKED): es una rejilla fija por posición de llegada al carril, no una medida de
 * cercanía entre personas.
 */
function posicion(
  laneIndex: number,
  camara: string | null,
): { x: number; y: number } {
  const COL = 220;
  const ROW = 140;
  const fila = camara === "senado" ? 1 : 0; // banda por cámara
  const col = Math.floor(laneIndex / 3);
  const row = laneIndex % 3;
  return { x: col * COL, y: fila * ROW * 3 + row * ROW };
}

export function RedGraph({ subgrafo }: RedGraphProps) {
  const nodos = useMemo(() => subgrafo?.nodos ?? [], [subgrafo]);
  const aristas = useMemo(() => subgrafo?.aristas ?? [], [subgrafo]);

  // Tipos presentes en el subgrafo (el control es genérico; en el MVP suele ser
  // solo co_lobby_contraparte).
  const tiposPresentes = useMemo(
    () => Array.from(new Set(aristas.map((a) => a.tipo))),
    [aristas],
  );

  // Estado de filtros: tipos activos + ventana temporal.
  const [tiposActivos, setTiposActivos] = useState<Set<string>>(
    () => new Set(tiposPresentes),
  );
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");

  const toggleTipo = (tipo: string) => {
    setTiposActivos((prev) => {
      const next = new Set(prev);
      if (next.has(tipo)) next.delete(tipo);
      else next.add(tipo);
      return next;
    });
  };

  // Aristas visibles = pasan el filtro de tipo Y el de ventana temporal.
  const aristasVisibles = useMemo(() => {
    const desdeMs = ms(desde ? `${desde}T00:00:00Z` : null);
    const hastaMs = ms(hasta ? `${hasta}T23:59:59Z` : null);
    return aristas.filter((a) => {
      if (!tiposActivos.has(a.tipo)) return false;
      const aDesde = ms(a.desde);
      const aHasta = ms(a.hasta);
      // La arista solapa la ventana seleccionada (extremos abiertos permitidos).
      if (desdeMs !== null && aHasta !== null && aHasta < desdeMs) return false;
      if (hastaMs !== null && aDesde !== null && aDesde > hastaMs) return false;
      return true;
    });
  }, [aristas, tiposActivos, desde, hasta]);

  // Estado honesto: el grafo puede venir genuinamente sin relaciones. NO es un
  // error — se nombra el hecho de que aún no hay aristas, sin inventar nodos.
  if (aristas.length === 0) {
    return (
      <section aria-label="Grafo de relaciones" className="mt-8">
        <p className="text-base leading-relaxed text-muted-foreground">
          Aún no hay relaciones para mostrar para este parlamentario. Cuando
          existan hechos públicos que vinculen a dos parlamentarios —por
          ejemplo, haber recibido audiencia de la misma contraparte de lobby—
          aparecerán aquí, cada uno con su fuente y su fecha.
        </p>
        <p className="text-sm mt-2">
          Vuelve al{" "}
          <Link
            href="/parlamentarios"
            className="inline-flex min-h-11 items-center text-accent-product underline underline-offset-2"
          >
            directorio de parlamentarios{" "}
            <span aria-hidden="true">→</span>
          </Link>
          .
        </p>
      </section>
    );
  }

  // Nodos que aún participan de alguna arista visible.
  const nodosVisiblesIds = new Set<string>();
  aristasVisibles.forEach((a) => {
    nodosVisiblesIds.add(a.a);
    nodosVisiblesIds.add(a.b);
  });

  // B20a — Solo los nodos que participan de alguna arista VISIBLE llegan al
  // lienzo: un nodo huérfano flotando se leería como una persona "suelta" sin
  // hecho que la vincule. El early-return de `aristas.length === 0` (arriba) cubre
  // el grafo genuinamente vacío; este filtro cubre el caso de filtros que dejan
  // nodos sin arista visible.
  const nodosVisibles = nodos.filter((n) => nodosVisiblesIds.has(n.id));

  // B20b — Contador por carril: el índice que alimenta `posicion` es LOCAL a la
  // cámara del nodo, no global, de modo que los carriles existan de verdad (las
  // columnas avanzan DENTRO de cada banda de cámara, no a través de ambas).
  const laneCounters: Record<string, number> = {};
  const rfNodes: Node<NodoParlamentarioData>[] = nodosVisibles.map((n) => {
    const lane = n.camara === "senado" ? "senado" : "diputados";
    const laneIndex = laneCounters[lane] ?? 0;
    laneCounters[lane] = laneIndex + 1;
    return {
      id: n.id,
      type: "parlamentario",
      position: posicion(laneIndex, n.camara),
      data: { nombre: n.nombre, camara: n.camara, id: n.id },
    };
  });

  const rfEdges: Edge<AristaHechoData>[] = aristasVisibles.map((a, i) => ({
    id: `${a.tipo}-${a.a}-${a.b}-${i}`,
    type: "hecho",
    source: a.a,
    target: a.b,
    data: {
      tipo: a.tipo,
      contexto: a.contexto,
      desde: a.desde,
      hasta: a.hasta,
      dataset: a.dataset,
      origen: a.origen,
      enlace: a.enlace,
      licencia: a.licencia,
    },
  }));

  return (
    <section aria-label="Grafo de relaciones" className="mt-8">
      {/* Controles de filtro: por tipo de relación y por ventana temporal. */}
      <div className="net-filtros" role="group" aria-label="Filtros del grafo">
        <fieldset className="net-filtros__tipos">
          <legend className="net-filtros__legend">Tipo de relación</legend>
          {tiposPresentes.map((tipo) => (
            <label key={tipo} className="net-filtros__tipo">
              <input
                type="checkbox"
                checked={tiposActivos.has(tipo)}
                onChange={() => toggleTipo(tipo)}
                aria-label={`Tipo de relación: ${TIPO_LABEL[tipo] ?? tipo}`}
              />
              <span>{TIPO_LABEL[tipo] ?? tipo}</span>
            </label>
          ))}
        </fieldset>
        <div className="net-filtros__ventana">
          <label className="net-filtros__fecha">
            <span>Desde</span>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              aria-label="Desde (fecha)"
              className="font-mono"
            />
          </label>
          <label className="net-filtros__fecha">
            <span>Hasta</span>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              aria-label="Hasta (fecha)"
              className="font-mono"
            />
          </label>
        </div>
      </div>

      {aristasVisibles.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Ninguna relación coincide con los filtros seleccionados. Ajusta el
          tipo o el periodo para ver los hechos disponibles.
        </p>
      ) : (
        <div className="net-lienzo mt-4" style={{ height: 480 }}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls showInteractive={false} />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      )}
    </section>
  );
}
