"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { etiquetaHecho, ventanaTexto } from "./arista-hecho";
import { formatNombre } from "@/lib/format";
import { safeExternalHref } from "@/lib/utils";

/**
 * <RedGraph> — isla cliente del diagrama de relaciones NET (NET-02), LAYOUT B.
 *
 * Recibe el JSON plano del RPC `subgrafo_red` (PII-safe: nodo = id/nombre/cámara)
 * y lo renderiza como un DIAGRAMA DOM legible de lectura izquierda→derecha
 * (RED-LAYOUT-B, sketch 002 variante B ★): la persona elegida (seed) a la
 * IZQUIERDA y una COLUMNA paginada de sus vecinos a la derecha, unidos por
 * conectores SVG curvos con fan-out. Reemplaza el canvas radial `@xyflow/react`
 * —que se leía apiñado (24 nodos convergiendo a un anillo de 260px)— sin cambiar
 * la firma de props: `/red` (server) sigue montando `<RedGraph subgrafo seedId>`.
 *
 * Dos filtros client-side sobre el subgrafo YA recibido (sin round-trips): por
 * TIPO de relación y por VENTANA temporal (desde/hasta). Cada hecho lleva su
 * procedencia SIEMPRE en el DOM (origen + ventana + enlace + licencia) dentro del
 * detalle inline que se abre al seleccionar cada vecino.
 *
 * ANTI-INSINUACIÓN (18-CONTEXT, 17-LEGAL-DOSSIER §2, DESIGN-SYSTEM §8, LOCKED):
 * - la fila es identidad pública confirmada (nombre + cámara), nunca la
 *   afiliación, ni una imagen del rostro, ni una insignia que valore u ordene
 *   personas;
 * - la línea/detalle es un hecho tipado con fuente y ventana; el copy describe el
 *   hecho, jamás una valoración, una medida de proximidad, ni un motivo;
 * - el orden de la columna es ALFABÉTICO es-locale y determinista (cero
 *   force-simulation); la POSICIÓN no implica afinidad; el largo o la curva de
 *   los conectores NO significan nada;
 * - el petróleo (--accent-product) vive SOLO en conectores/enlaces/focus, jamás
 *   como relleno de fila/tarjeta ni color de cámara/partido;
 * - grafo VACÍO (0 aristas) = estado honesto ("aún no hay relaciones"), NUNCA un
 *   error ni un nodo inventado.
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
   * la vista. Con seedId, el diagrama pinta la tarjeta seed a la izquierda y la
   * columna de sus vecinos 1-hop a la derecha. Sin seedId, la columna cae sobre
   * los nodos con arista visible (rama fallback determinista).
   */
  seedId?: string;
}

// Etiqueta humana sobria por tipo, para el control de filtro.
const TIPO_LABEL: Record<string, string> = {
  co_lobby_contraparte: "Audiencia de la misma contraparte",
  co_votacion: "Misma votación",
};

const CAMARA_LABEL: Record<string, string> = {
  diputados: "Cámara de Diputadas y Diputados",
  senado: "Senado",
};

// Vecinos por página de la columna (RED-LAYOUT-B): TODOS los vecinos son
// alcanzables paginando; ninguno se descarta.
const B_PAGE = 10;

// Breakpoint md de Tailwind v4 = 48rem. Bajo este ancho los conectores SVG se
// omiten (la columna sigue siendo legible sin líneas).
const MD_BREAKPOINT_PX = 48 * 16; // 48rem @ root 16px

const MICROCOPY_HECHO =
  "Una relación aquí es un hecho público documentado. No indica afinidad, acuerdo ni motivo entre las personas.";

/** ISO → epoch ms; null si no hay fecha. */
function ms(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/**
 * Nombre de display de un nodo con fallback WR-05: `nombre?.trim() || id`. El
 * patrón previo `nombre ?? id` NO atrapaba `""` ni cadenas de solo-espacios (la
 * columna es text nullable) → una fila con `nombre: ""` producía un texto
 * accesible vacío y ordenaba antes que todo. Un solo helper mantiene la semántica
 * de fallback en sort + render.
 */
function displayNombre(n: { nombre: string | null; id: string }): string {
  return formatNombre(n.nombre?.trim() || n.id);
}

function camaraLabel(camara: string | null): string | null {
  if (!camara) return null;
  return CAMARA_LABEL[camara] ?? camara;
}

function camaraClase(camara: string | null): string | null {
  if (camara === "diputados") return "net-b-row--camara";
  if (camara === "senado") return "net-b-row--senado";
  return null;
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** Chip de cámara: borde civic 1.5px, background transparente, JAMÁS relleno. */
function ChipCamara({ camara }: { camara: string | null }) {
  const label = camaraLabel(camara);
  if (!label) return null;
  const clase =
    camara === "senado"
      ? "net-chip net-chip--senado"
      : "net-chip net-chip--camara";
  return <span className={clase}>{label}</span>;
}

/**
 * Bloque de detalle inline de un vecino: por cada hecho seed↔vecino, la etiqueta
 * del hecho + su ventana + la procedencia (Fuente / Periodo / Registro / enlace)
 * SIEMPRE en el DOM, la microcopy anti-insinuación, y el link a la red del vecino.
 */
function DetalleVecino({
  vecinoId,
  hechos,
}: {
  vecinoId: string;
  hechos: SubgrafoArista[];
}) {
  return (
    <div className="net-b-row__detalle">
      {hechos.map((h, i) => {
        const ventana = ventanaTexto(h.desde, h.hasta);
        const enlaceSeguro = safeExternalHref(h.enlace);
        return (
          <div key={`${h.tipo}-${i}`} className="net-b-hecho">
            <span className="net-b-hecho__label">
              {etiquetaHecho(h.tipo, h.contexto)}
            </span>
            {ventana ? (
              <span className="net-b-hecho__ventana font-mono">{ventana}</span>
            ) : null}
            <dl className="net-prov">
              <div className="net-prov__row">
                <dt>Fuente</dt>
                <dd>{h.origen}</dd>
              </div>
              {ventana ? (
                <div className="net-prov__row">
                  <dt>Periodo</dt>
                  <dd className="font-mono">{ventana}</dd>
                </div>
              ) : null}
              <div className="net-prov__row">
                <dt>Registro</dt>
                <dd>{h.dataset}</dd>
              </div>
              {h.licencia ? (
                <div className="net-prov__row">
                  <dt>Licencia</dt>
                  <dd>{h.licencia}</dd>
                </div>
              ) : null}
              {enlaceSeguro ? (
                <div className="net-prov__row">
                  <dt aria-hidden="true"></dt>
                  <dd>
                    <a
                      href={enlaceSeguro}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="net-prov__enlace"
                    >
                      Ver fuente oficial ↗
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        );
      })}
      <p className="net-microcopy">{MICROCOPY_HECHO}</p>
      <p className="net-b-row__vernred">
        <Link href={`/red?seed=${vecinoId}`} className="net-b-link">
          Ver la red de esta persona →
        </Link>
      </p>
    </div>
  );
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

  // Estado de filtros: tipos OCULTOS (deseleccionados = set vacío ⇒ todos
  // visibles) + ventana temporal. Trackear ocultos (no activos) evita que un tipo
  // nuevo, llegado por un cambio de subgrafo sin remount, nazca destildado.
  const [tiposOcultos, setTiposOcultos] = useState<Set<string>>(new Set());
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");

  // Estado de la columna: página actual + vecino seleccionado (detalle abierto).
  const [bPage, setBPage] = useState(0);
  const [bSel, setBSel] = useState<string | null>(null);

  // Cambiar un filtro RESETEA a página 1 y cierra el detalle (el conjunto de
  // vecinos cambió → la página previa podría no existir y la selección podría
  // haber salido del set visible).
  const resetPager = useCallback(() => {
    setBPage(0);
    setBSel(null);
  }, []);

  const toggleTipo = (tipo: string) => {
    setTiposOcultos((prev) => {
      const next = new Set(prev);
      if (next.has(tipo)) next.delete(tipo);
      else next.add(tipo);
      return next;
    });
    resetPager();
  };

  // Aristas visibles = pasan el filtro de tipo Y el de ventana temporal.
  const aristasVisibles = useMemo(() => {
    const desdeMs = ms(desde ? `${desde}T00:00:00Z` : null);
    const hastaMs = ms(hasta ? `${hasta}T23:59:59Z` : null);
    return aristas.filter((a) => {
      if (tiposOcultos.has(a.tipo)) return false;
      const aDesde = ms(a.desde);
      const aHasta = ms(a.hasta);
      if (desdeMs !== null && aHasta !== null && aHasta < desdeMs) return false;
      if (hastaMs !== null && aDesde !== null && aDesde > hastaMs) return false;
      return true;
    });
  }, [aristas, tiposOcultos, desde, hasta]);

  const seedNodo = useMemo(
    () => (seedId ? (nodos.find((n) => n.id === seedId) ?? null) : null),
    [nodos, seedId],
  );

  // Vecinos del seed = el OTRO extremo de cada arista visible que toca el seed,
  // en orden ALFABÉTICO es-locale (criterio neutral declarado, jamás por peso).
  // WR-04: excluir explícitamente el self-loop del seed. Debe vivir ANTES del
  // early-return para no violar las reglas de hooks.
  const seedNeighbors = useMemo(() => {
    if (!seedId) return [];
    const ids = new Set<string>();
    for (const a of aristasVisibles) {
      if (a.a === seedId && a.b !== seedId) ids.add(a.b);
      else if (a.b === seedId && a.a !== seedId) ids.add(a.a);
    }
    return nodos
      .filter((n) => ids.has(n.id))
      .sort((x, y) => displayNombre(x).localeCompare(displayNombre(y), "es"));
  }, [aristasVisibles, nodos, seedId]);

  // Rama fallback SIN seedNodo: la columna cae sobre los nodos con arista visible
  // (determinista, orden alfabético), excluyendo el seedId si estuviera presente.
  const nodosVisibles = useMemo(() => {
    const ids = new Set<string>();
    aristasVisibles.forEach((a) => {
      ids.add(a.a);
      ids.add(a.b);
    });
    return nodos
      .filter((n) => ids.has(n.id) && n.id !== seedId)
      .sort((x, y) => displayNombre(x).localeCompare(displayNombre(y), "es"));
  }, [aristasVisibles, nodos, seedId]);

  // La columna final: con seedNodo → sus vecinos; sin él → nodosVisibles.
  const columna = seedNodo ? seedNeighbors : nodosVisibles;

  // Hechos seed↔vecino por vecino (para el detalle inline). Solo con seedNodo.
  const hechosPorVecino = useMemo(() => {
    const map = new Map<string, SubgrafoArista[]>();
    if (!seedNodo) return map;
    for (const v of seedNeighbors) {
      map.set(
        v.id,
        aristasVisibles.filter(
          (a) =>
            (a.a === seedNodo.id && a.b === v.id) ||
            (a.b === seedNodo.id && a.a === v.id),
        ),
      );
    }
    return map;
  }, [seedNodo, seedNeighbors, aristasVisibles]);

  const totalHechos = useMemo(() => {
    let s = 0;
    for (const arr of hechosPorVecino.values()) s += arr.length;
    return s;
  }, [hechosPorVecino]);

  // Paginación sobre TODA la columna.
  const totalVecinos = columna.length;
  const totalPages = Math.max(1, Math.ceil(totalVecinos / B_PAGE));
  const pageStart = bPage * B_PAGE;
  const pageItems = columna.slice(pageStart, pageStart + B_PAGE);

  // ── Conectores SVG (fan-out) ────────────────────────────────────────────────
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const seedRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const drawConn = useCallback(() => {
    const svg = svgRef.current;
    const cont = layoutRef.current;
    const seedEl = seedRef.current;
    // DEFENSIVO: sin contenedor, sin seed (rama fallback), oculto (offsetParent
    // null en móvil/jsdom), o bajo el breakpoint md → no dibujamos (jsdom da
    // ceros; móvil omite líneas por diseño).
    if (!svg || !cont || !seedEl) return;
    if (!cont.offsetParent) {
      svg.innerHTML = "";
      return;
    }
    if (typeof window !== "undefined" && window.innerWidth < MD_BREAKPOINT_PX) {
      svg.innerHTML = "";
      return;
    }
    const cr = cont.getBoundingClientRect();
    if (cr.width === 0 || cr.height === 0) {
      svg.innerHTML = "";
      return;
    }
    svg.setAttribute("viewBox", `0 0 ${cr.width} ${cr.height}`);
    svg.style.width = `${cr.width}px`;
    svg.style.height = `${cr.height}px`;
    const sr = seedEl.getBoundingClientRect();
    const rows = Array.prototype.slice.call(
      cont.querySelectorAll(".net-b-row"),
    ) as HTMLElement[];
    const n = rows.length;
    let html = "";
    rows.forEach((row, k) => {
      // Salida REPARTIDA verticalmente por el borde derecho del seed (fan-out):
      // NUNCA convergen a un punto.
      const pad = 18;
      const span = Math.max(sr.height - pad * 2, 1);
      const sx = sr.right - cr.left;
      const sy = sr.top - cr.top + pad + (n > 1 ? (span * k) / (n - 1) : span / 2);
      const rr = row.getBoundingClientRect();
      const ex = rr.left - cr.left;
      const ey = rr.top - cr.top + Math.min(rr.height, 40) / 2 + 2;
      const mx = (sx + ex) / 2;
      const sel = bSel !== null && row.getAttribute("data-vecino") === bSel;
      const w = sel ? 2.5 : 1.5;
      const op = bSel !== null ? (sel ? 1 : 0.13) : 0.5;
      html +=
        `<path d="M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}" ` +
        `fill="none" stroke="hsl(var(--accent-product))" stroke-width="${w}" opacity="${op}"/>`;
    });
    svg.innerHTML = html;
  }, [bSel]);

  const scheduleDraw = useCallback(() => {
    if (typeof window === "undefined") return;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(drawConn);
  }, [drawConn]);

  // Redibujar tras cada layout (página/selección/columna) + en resize.
  useLayoutEffect(() => {
    scheduleDraw();
  }, [scheduleDraw, bPage, bSel, pageItems.length, totalVecinos]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cont = layoutRef.current;
    const onResize = () => scheduleDraw();
    window.addEventListener("resize", onResize);
    let ro: ResizeObserver | null = null;
    if (cont && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => scheduleDraw());
      ro.observe(cont);
    }
    return () => {
      window.removeEventListener("resize", onResize);
      if (ro) ro.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [scheduleDraw]);

  // ── Estado honesto: grafo genuinamente sin relaciones (0 aristas). ───────────
  if (aristas.length === 0) {
    return (
      <section aria-label="Diagrama de relaciones" className="mt-8">
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

  // CR-01: el seed puede quedar sin ningún vecino visible tras los filtros
  // (sobrevive una arista vecino↔vecino, pero mueren las seed↔vecino) → su propio
  // estado honesto, nunca el seed suelto ni la columna vacía sin mensaje.
  const sinVecinosVisibles = totalVecinos === 0;

  const seedNombre = seedNodo ? displayNombre(seedNodo) : null;

  return (
    <section aria-label="Diagrama de relaciones" className="mt-8">
      {/* Leyenda "Cómo leer este diagrama": paso a paso LOCKED anti-insinuación. */}
      <details className="net-leyenda" open>
        <summary className="net-leyenda__summary">
          Cómo leer este diagrama
        </summary>
        <ol className="net-leyenda__ol">
          <li>
            <strong>A la izquierda</strong>, la persona elegida.{" "}
            <strong>A la derecha</strong>, en una columna, sus vecinos en orden
            alfabético.
          </li>
          <li>
            <strong>Cada línea</strong> conecta a la persona elegida con un
            vecino y representa uno o más hechos públicos compartidos. El largo o
            la curva de la línea <strong>no significan</strong> nada.
          </li>
          <li>
            Pulsa un vecino para <strong>destacar su línea</strong> y ver el
            detalle: qué hechos comparten, cuándo, y el enlace a la fuente
            original.
          </li>
          <li>
            Una relación es un hecho documentado (audiencia de la misma
            contraparte de lobby, misma votación). <strong>Nunca</strong> indica
            afinidad, acuerdo ni motivo.
          </li>
          <li>
            El filo izquierdo de cada tarjeta indica la cámara:{" "}
            <ChipCamara camara="diputados" /> <ChipCamara camara="senado" />
          </li>
        </ol>
        <p className="net-leyenda__fuente">
          Fuente: Ley del Lobby (Ley 20.730) y votaciones de sala · datos
          ingestados por este observatorio.
        </p>
      </details>

      {/* Nota móvil: bajo el breakpoint md los conectores se omiten. */}
      <p className="net-b-nota-movil">
        En pantallas angostas las líneas se omiten; el orden sigue siendo
        alfabético y el detalle se abre igual al pulsar cada vecino.
      </p>

      {/* Controles de filtro: por tipo de relación y por ventana temporal. */}
      <div className="net-filtros" role="group" aria-label="Filtros del diagrama">
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
              onChange={(e) => {
                setDesde(e.target.value);
                resetPager();
              }}
              aria-label="Desde (fecha)"
              className="font-mono"
            />
          </label>
          <label className="net-filtros__fecha">
            <span>Hasta</span>
            <input
              type="date"
              value={hasta}
              onChange={(e) => {
                setHasta(e.target.value);
                resetPager();
              }}
              aria-label="Hasta (fecha)"
              className="font-mono"
            />
          </label>
        </div>
      </div>

      {sinVecinosVisibles ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Ninguna relación coincide con los filtros seleccionados. Ajusta el tipo
          o el periodo para ver los hechos disponibles.
        </p>
      ) : (
        <>
          <div className="net-b-layout" ref={layoutRef}>
            {/* Conectores SVG (fan-out) — solo decorativos (aria-hidden). */}
            <svg
              ref={svgRef}
              className="net-b-conn"
              aria-hidden="true"
              role="presentation"
            />

            {/* Tarjeta seed a la IZQUIERDA (solo en el path con seedNodo). */}
            {seedNodo ? (
              <div className="net-b-seedcol">
                <div className="net-b-seed" ref={seedRef}>
                  <div className="net-b-seed__nombre">
                    {seedNombre ?? seedNodo.id}
                  </div>
                  <div className="net-b-seed__chip">
                    <ChipCamara camara={seedNodo.camara} />
                  </div>
                  <p className="net-b-seednote">
                    {plural(totalVecinos, "vecino", "vecinos")} ·{" "}
                    {plural(
                      totalHechos,
                      "hecho documentado",
                      "hechos documentados",
                    )}
                    .
                  </p>
                  <p className="net-b-seednote">
                    El orden de la columna es alfabético; la posición no implica
                    afinidad.
                  </p>
                </div>
              </div>
            ) : (
              // Rama fallback (sin seedNodo): aviso sobrio; la columna se puebla
              // sobre nodosVisibles sin tarjeta seed ni conectores.
              <div className="net-b-seedcol">
                <p className="net-b-seednote">
                  Estas son las relaciones disponibles, en orden alfabético. La
                  posición no implica afinidad.
                </p>
              </div>
            )}

            {/* Columna de vecinos. */}
            <div className="net-b-list">
              {pageItems.map((v) => {
                const sel = bSel === v.id;
                const clases = [
                  "net-b-row",
                  camaraClase(v.camara),
                  sel ? "net-b-row--sel" : null,
                ]
                  .filter(Boolean)
                  .join(" ");
                const hechos = hechosPorVecino.get(v.id) ?? [];
                return (
                  <div
                    key={v.id}
                    data-vecino={v.id}
                    className={clases}
                    tabIndex={0}
                    role="button"
                    aria-expanded={sel}
                    aria-label={`Vecino: ${displayNombre(v)}`}
                    onClick={() => setBSel(sel ? null : v.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setBSel(sel ? null : v.id);
                      }
                    }}
                  >
                    <div className="net-b-row__fila">
                      <span className="net-b-row__nombre">
                        {displayNombre(v)}
                      </span>
                      <ChipCamara camara={v.camara} />
                      {seedNodo ? (
                        <span className="net-b-row__nhechos">
                          {plural(hechos.length, "hecho", "hechos")} →
                        </span>
                      ) : null}
                    </div>
                    {sel && seedNodo ? (
                      <DetalleVecino vecinoId={v.id} hechos={hechos} />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pager honesto: cubre TODOS los vecinos, conteo verdadero. */}
          <div className="net-b-pager">
            <button
              type="button"
              className="net-b-pager__btn"
              onClick={() => {
                setBPage((p) => Math.max(0, p - 1));
                setBSel(null);
              }}
              disabled={bPage === 0}
            >
              ← Anteriores
            </button>
            <button
              type="button"
              className="net-b-pager__btn"
              onClick={() => {
                setBPage((p) => Math.min(totalPages - 1, p + 1));
                setBSel(null);
              }}
              disabled={bPage >= totalPages - 1}
            >
              Siguientes →
            </button>
            <span className="net-b-pager__estado">
              Vecinos {pageStart + 1}–
              {Math.min(pageStart + B_PAGE, totalVecinos)} de {totalVecinos} ·
              página {bPage + 1} de {totalPages} · orden alfabético
            </span>
          </div>
        </>
      )}
    </section>
  );
}
