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
import {
  AristaHecho,
  type AristaHechoData,
  etiquetaHecho,
  ventanaTexto,
} from "./arista-hecho";
import { formatNombre } from "@/lib/format";
import { safeExternalHref } from "@/lib/utils";

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
 * - el layout es radial ego-céntrico determinista: el parlamentario elegido va al
 *   centro y sus vecinos se ordenan por orden alfabético en el anillo — la posición
 *   en el anillo es orden alfabético, no cercanía; jamás una simulación física
 *   (esa proximidad visual se leería como una relación entre las personas);
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
  /**
   * Semilla del ego-framing (55-05): id del parlamentario desde el que se abrió
   * la vista. Con seedId, el grafo se centra en su vecindario inmediato (seed +
   * nodos 1-hop) vía `fitViewOptions.nodes`, en vez del fitView global de 136
   * nodos; y el nodo semilla se marca sobrio (no-ranking). Sin seedId, fitView
   * global (shipped). Solo props de @xyflow/react ya disponibles — cero física.
   */
  seedId?: string;
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

// Geometría radial (píxeles DENTRO del canvas SVG, NO el scale de 4px de página).
const RING1_R = 260; // primer anillo de vecinos directos
const RING2_R = 460; // anillo de desborde cuando pasan de 12 vecinos
const CAP = 24; // tope duro de vecinos renderizados (RED-01)

/**
 * Layout RADIAL ego-céntrico determinista (trig pura); jamás una simulación
 * física. `index` es el índice ALFABÉTICO del vecino en el anillo (0-based) y
 * `total` la cantidad de vecinos renderizados. El seed va en {x:0,y:0}; cada
 * vecino cae en el ángulo `theta = -π/2 + 2π·inRing/countInRing` (12 en punto,
 * horario). La POSICIÓN EN EL ANILLO ES ORDEN ALFABÉTICO, NO CERCANÍA
 * (anti-insinuación LOCKED): es función pura de (índice alfabético, cantidad de
 * vecinos), byte-idéntica en cada render, no una medida de afinidad entre
 * personas.
 */
function radialPos(index: number, total: number): { x: number; y: number } {
  const perRing = 12; // capacidad del anillo 1 antes de desbordar al anillo 2
  const ring = index < perRing ? 0 : 1;
  const R = ring === 0 ? RING1_R : RING2_R;
  const inRing = ring === 0 ? index : index - perRing;
  const countInRing =
    ring === 0 ? Math.min(total, perRing) : total - perRing;
  const theta =
    -Math.PI / 2 + (2 * Math.PI * inRing) / Math.max(countInRing, 1);
  return {
    x: Math.round(R * Math.cos(theta)),
    y: Math.round(R * Math.sin(theta)),
  };
}

export function RedGraph({ subgrafo, seedId }: RedGraphProps) {
  const nodos = useMemo(() => subgrafo?.nodos ?? [], [subgrafo]);
  const aristas = useMemo(() => subgrafo?.aristas ?? [], [subgrafo]);

  // Tipos presentes en el subgrafo (el control es genérico; en el MVP suele ser
  // solo co_lobby_contraparte).
  const tiposPresentes = useMemo(
    () => Array.from(new Set(aristas.map((a) => a.tipo))),
    [aristas],
  );

  // Estado de filtros: tipos OCULTOS (deseleccionados) + ventana temporal.
  // WR-05 (53-REVIEW): se trackean los tipos DESTILDADOS (set vacío = todos
  // visibles), no los activos. Un set de "activos" inicializado desde
  // `tiposPresentes` al montar queda OBSOLETO si `subgrafo` cambia sin remount
  // (p.ej. un futuro <Link> a /red?seed=…): un tipo nuevo llegaría destildado y
  // sus aristas filtradas → "Ninguna relación coincide" sin tocar nada. Con el
  // set de ocultos, todo tipo nuevo nace visible por defecto.
  const [tiposOcultos, setTiposOcultos] = useState<Set<string>>(new Set());
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");

  const toggleTipo = (tipo: string) => {
    setTiposOcultos((prev) => {
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
      if (tiposOcultos.has(a.tipo)) return false;
      const aDesde = ms(a.desde);
      const aHasta = ms(a.hasta);
      // La arista solapa la ventana seleccionada (extremos abiertos permitidos).
      if (desdeMs !== null && aHasta !== null && aHasta < desdeMs) return false;
      if (hastaMs !== null && aDesde !== null && aDesde > hastaMs) return false;
      return true;
    });
  }, [aristas, tiposOcultos, desde, hasta]);

  // Vecinos del seed = el OTRO extremo de cada arista VISIBLE que toca el seed.
  // (El subgrafo también trae aristas vecino↔vecino; ésas NO son vecinos nuevos
  // del seed.) Orden ALFABÉTICO por nombre de display — criterio neutral y
  // declarado (RED-02); JAMÁS por peso/co-ocurrencia. Debe vivir ANTES del
  // early-return (`aristas.length === 0`) para no violar las reglas de hooks.
  const seedNeighbors = useMemo(() => {
    if (!seedId) return [];
    const ids = new Set<string>();
    for (const a of aristasVisibles) {
      if (a.a === seedId) ids.add(a.b);
      else if (a.b === seedId) ids.add(a.a);
    }
    return nodos
      .filter((n) => ids.has(n.id))
      .sort((x, y) =>
        formatNombre(x.nombre ?? x.id).localeCompare(
          formatNombre(y.nombre ?? y.id),
          "es",
        ),
      );
  }, [aristasVisibles, nodos, seedId]);

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
            <span aria-hidden="true" className="pl-1">→</span>
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

  // Cap duro (RED-01): renderizamos como máximo 24 vecinos alfabéticos; el resto
  // va al control honesto "N vecinos más" (cada uno un Link a /red?seed=<id>).
  const rendered = seedNeighbors.slice(0, CAP);
  const overflow = seedNeighbors.slice(CAP);

  // El set renderizado con seed = [seed, ...rendered]. Sin él construimos el
  // conjunto de nodos que llegan al lienzo.
  const seedNodo = seedId
    ? (nodos.find((n) => n.id === seedId) ?? null)
    : null;

  let rfNodes: Node<NodoParlamentarioData>[];
  // IDs de los nodos efectivamente montados en el lienzo (para filtrar aristas).
  let renderedIds: Set<string>;

  if (seedNodo) {
    // Path CON seed (foco de la fase): seed al centro + vecinos alfabéticos en
    // el anillo radial. DOM invariant (RED-01): |rfNodes| === rendered.length + 1.
    rfNodes = [
      {
        id: seedNodo.id,
        type: "parlamentario",
        position: { x: 0, y: 0 },
        data: {
          nombre: seedNodo.nombre,
          camara: seedNodo.camara,
          id: seedNodo.id,
          esSeed: true,
        },
      },
      ...rendered.map((n, i) => ({
        id: n.id,
        type: "parlamentario",
        position: radialPos(i, rendered.length),
        data: {
          nombre: n.nombre,
          camara: n.camara,
          id: n.id,
          esSeed: false,
        },
      })),
    ];
    renderedIds = new Set([seedNodo.id, ...rendered.map((n) => n.id)]);
  } else {
    // Rama fallback legacy SIN seed (o seed ausente de toda arista visible): no
    // hay centro ego, así que conservamos el render mínimo de todos los nodos con
    // arista visible, posicionados radialmente por índice de llegada (determinista,
    // sin física). El foco de la fase es el path CON seed; esta rama sólo evita
    // romper el render sin-seed.
    rfNodes = nodosVisibles.map((n, i) => ({
      id: n.id,
      type: "parlamentario",
      position: radialPos(i, nodosVisibles.length),
      data: {
        nombre: n.nombre,
        camara: n.camara,
        id: n.id,
        esSeed: false,
      },
    }));
    renderedIds = new Set(nodosVisibles.map((n) => n.id));
  }

  // Ego-framing (55-05): con seedId, encuadra el vecindario inmediato del seed
  // (los nodos efectivamente montados) vía `fitViewOptions.nodes`. Sin seedId, se
  // conserva el fitView global shipped.
  const fitViewOptions = seedId
    ? {
        padding: 0.2,
        nodes: Array.from(renderedIds).map((id) => ({ id })),
        minZoom: 0.2,
      }
    : { padding: 0.05 };

  // Sólo dibujamos aristas cuyos DOS extremos estén en el set renderizado — así no
  // trazamos líneas a vecinos capados.
  const rfEdges: Edge<AristaHechoData>[] = aristasVisibles
    .filter((a) => renderedIds.has(a.a) && renderedIds.has(a.b))
    .map((a, i) => ({
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

  // Lista de vecinos para el fallback móvil <768px (RED-02): a 390px un anillo de
  // 24 nodos es ilegible; la forma honesta y usable es una LISTA de vecinos con su
  // hecho + procedencia. Cada fila = un vecino renderizado + las aristas seed↔vecino
  // (el hecho compartido). Solo se arma cuando hay seed y al menos un vecino
  // renderizado; el estado vacío (0 aristas) ya retornó antes.
  const seedNombreDisplay = seedNodo
    ? formatNombre(seedNodo.nombre ?? seedNodo.id)
    : null;
  const vecinosLista = seedNodo
    ? rendered.map((vecino) => {
        const hechos = aristasVisibles.filter(
          (a) =>
            (a.a === seedNodo.id && a.b === vecino.id) ||
            (a.b === seedNodo.id && a.a === vecino.id),
        );
        return { vecino, hechos };
      })
    : [];

  return (
    <section aria-label="Grafo de relaciones" className="mt-8">
      {/* Leyenda de lectura: qué es un nodo, qué es una arista (COMP-03). */}
      <div className="mb-4 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Cómo leer este grafo</p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong className="font-medium text-foreground">Nodo</strong>: un
            parlamentario con identidad confirmada (nombre y cámara).
          </li>
          <li>
            <strong className="font-medium text-foreground">Línea</strong>: un
            hecho público que vincula a dos parlamentarios, por ejemplo haber
            recibido audiencia de la misma contraparte de lobby. Cada línea
            lleva su fuente, ventana temporal y enlace al registro original.
          </li>
          <li>
            La posición en el anillo es orden alfabético, no cercanía: el
            parlamentario elegido va al centro y sus vecinos se ordenan
            alfabéticamente alrededor. La distancia o el ángulo no indican
            afinidad ni relación entre las personas.
          </li>
        </ul>
        <p className="text-xs mt-1">
          Fuente: Ley del Lobby (Ley 20.730) · datos ingestados por este
          observatorio.
        </p>
      </div>
      {/* Controles de filtro: por tipo de relación y por ventana temporal. */}
      <div className="net-filtros" role="group" aria-label="Filtros del grafo">
        <fieldset className="net-filtros__tipos">
          <legend className="net-filtros__legend">Tipo de relación</legend>
          {tiposPresentes.map((tipo) => (
            <label key={tipo} className="net-filtros__tipo">
              <input
                type="checkbox"
                checked={!tiposOcultos.has(tipo)}
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
        <>
          {/* Canvas radial SOLO ≥768px (RED-02): a 390px el anillo es ilegible,
              así que el canvas se oculta en móvil y en su lugar va la lista de
              vecinos (abajo). El wrapper hidden md:block mantiene el lienzo con sus
              clases token h-96 md:h-120 byte-idénticas. */}
          <div className="hidden md:block">
            {/* Altura por token adaptativa: h-96=384px móvil / md:h-120=480px ≥768px
                (sin inline style, sin arbitrary [Npx]). */}
            <div className="net-lienzo mt-4 h-96 md:h-120">
              <ReactFlowProvider>
                <ReactFlow
                  nodes={rfNodes}
                  edges={rfEdges}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  fitView
                  fitViewOptions={fitViewOptions}
                  minZoom={0.2}
                  proOptions={{ hideAttribution: true }}
                >
                  <Background />
                  <Controls showInteractive={false} />
                </ReactFlow>
              </ReactFlowProvider>
            </div>
          </div>

          {/* Fallback móvil <768px (RED-02): lista honesta de vecinos con enlaces.
              Cada fila lleva el nombre + cámara del vecino, el/los hecho(s)
              compartido(s) con su ventana temporal, y el enlace a la fuente oficial
              (procedencia SIEMPRE en el DOM, trazabilidad rector). Cada fila es un
              Link a /red?seed=<id> para saltar a su propio ego-network. Solo con
              seed y ≥1 vecino renderizado. */}
          {vecinosLista.length > 0 && (
            <ul className="net-vecinos md:hidden mt-4" aria-label="Vecinos">
              <li className="net-vecinos__heading">
                Vecinos de {seedNombreDisplay ?? "este parlamentario"}
              </li>
              {vecinosLista.map(({ vecino, hechos }) => {
                const camaraLabel =
                  vecino.camara === "senado"
                    ? "Senado"
                    : vecino.camara === "diputados"
                      ? "Cámara de Diputadas y Diputados"
                      : null;
                return (
                  <li key={vecino.id} className="net-vecinos__item">
                    <Link
                      href={`/red?seed=${vecino.id}`}
                      className="net-vecinos__fila"
                    >
                      <span className="net-vecinos__nombre">
                        {formatNombre(vecino.nombre ?? vecino.id)}
                      </span>
                      {camaraLabel ? (
                        <span className="net-vecinos__camara">
                          {camaraLabel}
                        </span>
                      ) : null}
                    </Link>
                    <ul className="net-vecinos__hechos">
                      {hechos.map((h, i) => {
                        const ventana = ventanaTexto(h.desde, h.hasta);
                        const enlaceSeguro = safeExternalHref(h.enlace);
                        return (
                          <li
                            key={`${h.tipo}-${i}`}
                            className="net-vecinos__hecho"
                          >
                            <span>{etiquetaHecho(h.tipo, h.contexto)}</span>
                            {ventana ? (
                              <span className="net-vecinos__ventana font-mono">
                                {ventana}
                              </span>
                            ) : null}
                            <span className="net-vecinos__prov">
                              Fuente: {h.origen}
                              {enlaceSeguro ? (
                                <>
                                  {" · "}
                                  <a
                                    href={enlaceSeguro}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="net-vecinos__enlace"
                                  >
                                    Ver fuente oficial ↗
                                  </a>
                                </>
                              ) : null}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
          {/* Truncación honesta (RED-01): si el seed tiene más de 24 vecinos
              directos, se muestran los primeros 24 alfabéticos en el anillo y el
              resto se lista aquí — cada nombre un Link a su propio ego-network.
              NUNCA se descartan vecinos en silencio; el conteo es verdadero
              (total − 24). Sin force-simulation, sin orden por peso. */}
          {overflow.length > 0 && (
            <div className="net-vecinos-mas mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              <p>
                Se muestran los primeros {CAP} vecinos en orden alfabético.
              </p>
              <p className="mt-1 font-medium text-foreground">
                Ver {overflow.length} vecinos más
              </p>
              <ul className="mt-2 space-y-1">
                {overflow.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={`/red?seed=${n.id}`}
                      className="inline-flex min-h-11 items-center text-accent-product underline underline-offset-2"
                    >
                      {formatNombre(n.nombre ?? n.id)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
