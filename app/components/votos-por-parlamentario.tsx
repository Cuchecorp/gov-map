import Link from "next/link";

import { createServerSupabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { SELECCION_STYLE } from "@/components/voto-row";
import { cn } from "@/lib/utils";
import { fechaCorta, extractoIdea, conteoVotacion } from "@/lib/format";
import { sourceLabel } from "@/lib/types";
import type {
  Seleccion,
  VotoFichaRow as VotoFichaRowData,
  RebeldiaRow,
} from "@/lib/types";

/**
 * Sección VOTE de la ficha del parlamentario (UI-SPEC §3.2–§3.6).
 *
 * Sub-bloques en orden: asistencia (§3.3) → lista paginada por votación (§3.2) →
 * voto×tema (§3.4) → votó distinto a su bancada (§3.5). Cada uno con su `<h3>` y
 * su estado honesto. Los AGREGADOS (asistencia / votó distinto) se computan SOLO
 * sobre filas confirmadas — el RPC `votos_de_parlamentario` ya devuelve solo
 * confirmadas, así que las menciones no verificadas nunca entran en los conteos.
 *
 * GATE DE CONTENIDO (§9.1, release gate): ver UI-SPEC §9.1 para la lista dura de
 * términos prohibidos (relación/cercanía política, puntaje/índice/ranking,
 * adjetivos de juicio sobre un voto, y lenguaje causal). Nada de eso entra en el
 * código ni en el copy de esta sección. El heading neutro es "Votó distinto a su
 * bancada"; el nombre interno "rebeldías" jamás aparece en la UI.
 *
 * Los componentes de PRESENTACIÓN (`VotosView` y abajo) son puros: reciben datos
 * por props y se testean con fixtures (RTL), sin runtime de Supabase/Next.
 */

const PAGE_SIZE = 20;

const OPCION_LABEL: Record<Seleccion, string> = {
  si: "A favor",
  no: "En contra",
  abstencion: "Abstención",
  pareo: "Pareo",
  ausente: "Ausente",
};

const BAR_SEGMENT: Record<Seleccion, string> = {
  si: "bg-green-500",
  no: "bg-red-500",
  abstencion: "bg-amber-400",
  pareo: "bg-slate-400",
  ausente: "bg-slate-300",
};

const SELECCION_ORDEN: Seleccion[] = [
  "si",
  "no",
  "abstencion",
  "pareo",
  "ausente",
];

function slugTema(materia: string): string {
  return materia
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Hash corto y estable de una cadena (djb2 → base36). Determinista entre renders y
 * procesos (no usa Math.random ni nada de runtime), por lo que el slug desambiguado
 * de una materia es el mismo en el chip que en el href que el server vuelve a resolver.
 */
function hashCorto(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(36).slice(0, 6);
}

/**
 * Construye el mapa slug→materia desambiguando colisiones (WR-03): dos materias
 * distintas que sólo difieren en acento/puntuación/caso producen el mismo
 * `slugTema` y, sin esto, la última etiqueta ganaría y ambas materias se fundirían
 * silenciosamente en un chip. Cuando un slug ya está tomado por una materia
 * DISTINTA, se le anexa un hash corto del texto verbatim → slug único y estable.
 * El mapa devuelto va de slug (posiblemente desambiguado) a la materia verbatim.
 */
function construirMateriasMap(materias: Iterable<string>): Map<string, string> {
  const slugDeMateria = new Map<string, string>(); // materia verbatim → slug final
  const materiaDeSlug = new Map<string, string>(); // slug final → materia verbatim
  for (const materia of materias) {
    if (slugDeMateria.has(materia)) continue;
    const base = slugTema(materia);
    let slug = base;
    const ocupadaPor = materiaDeSlug.get(slug);
    if (ocupadaPor !== undefined && ocupadaPor !== materia) {
      // Colisión con una materia distinta → desambiguar con hash del verbatim.
      slug = `${base}-${hashCorto(materia)}`;
    }
    slugDeMateria.set(materia, slug);
    materiaDeSlug.set(slug, materia);
  }
  return materiaDeSlug;
}

/** Fila confirmada de la ficha con su materia derivada (proyecto, público-read). */
export type VotoFichaConMateria = VotoFichaRowData & { materia: string | null };

// ── Datos que la vista necesita (forma pura, testeable) ────────────────────────
export interface VotosViewData {
  /** filas confirmadas de la página actual (ya paginadas). */
  votos: VotoFichaConMateria[];
  /**
   * Total de votaciones del conjunto AGREGADO ("Cómo votó"/asistencia). WR-01: con un
   * tema activo es el tamaño del subconjunto filtrado (coherente con `conteos`), no el
   * global — el header refleja la misma cobertura que la lista. Sin tema, es el global.
   */
  totalVotos: number;
  /**
   * Desglose de asistencia por selección (solo confirmados). WR-01: computado sobre el
   * mismo conjunto que `totalVotos` (filtrado si hay tema activo, global si no).
   */
  conteos: Record<Seleccion, number>;
  /** votó distinto a su bancada (derivado del RPC security definer). */
  rebeldias: RebeldiaRow[];
  /** materia activa del facet (slug) o null. */
  materiaActiva: string | null;
  /** materias disponibles (label + slug) derivadas de los votos. */
  materias: { label: string; slug: string }[];
  /** paginación. */
  page: number;
  totalPages: number;
  /**
   * Total de PROYECTOS distintos con votaciones confirmadas (no de votaciones):
   * alimenta la nota de cobertura honesta. Opcional: si no se provee, la vista lo
   * deriva de los boletines distintos presentes en `votos` (cobertura conservadora).
   */
  totalProyectos?: number;
  /**
   * `true` si la ingesta de este parlamentario aún NO ha corrido (estado (c)
   * "no ingestado" — distinto de "ingestado, 0 confirmados"). Se infiere de un
   * marcador honesto; por ahora `false` cuando hay datos, `null` desconocido.
   */
  noIngestado: boolean;
  /**
   * Boletín del arco cuyo detalle está expandido (searchParam `?votosVer`), o
   * `null` si todos están colapsados (SC1). Server-driven, sin estado cliente.
   */
  votosVer: string | null;
}

/** Construye los hrefs del facet/paginación preservando los otros params. */
function buildHref(
  id: string,
  patch: Record<string, string | null>,
): string {
  const base: Record<string, string> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== null) base[k] = v;
  }
  const qs = new URLSearchParams(base).toString();
  return `/parlamentario/${id}${qs ? `?${qs}` : ""}`;
}

/** Bajo este nº de proyectos, la vista muestra una nota de cobertura honesta. */
const COBERTURA_BAJA_UMBRAL = 5;

/** Un proyecto agrupado: su cabecera (titulo/idea) + las etapas en que votó. */
interface ProyectoArco {
  boletin: string;
  titulo: string | null;
  idea_matriz: string | null;
  etapas: VotoFichaConMateria[];
}

// Formateador "mmm AAAA" (es-CL): "may 2026". Se usa SOLO para el rango de la
// línea-resumen del arco; el detalle sigue usando `fechaCorta` (día incluido).
const mesAnioFormatter = new Intl.DateTimeFormat("es-CL", {
  month: "short",
  year: "numeric",
});
function mesAnio(d: Date): string {
  return mesAnioFormatter.format(d);
}

/**
 * Resumen agregado de un arco de proyecto (SC1): nº de votaciones, conteo por
 * sentido y rango de meses en que votó. PURO y exportado para test. CERO
 * fabricación: `n` = etapas del arco; los conteos salen de `e.seleccion`;
 * `mesInicio`/`mesFin` = min/max de `e.fecha` formateado "mmm AAAA" (cadena vacía
 * si no hay fechas válidas → el llamador omite el rango).
 */
export interface ResumenArco {
  n: number;
  si: number;
  no: number;
  abstencion: number;
  pareo: number;
  ausente: number;
  mesInicio: string;
  mesFin: string;
}

export function resumenDeArco(arco: ProyectoArco): ResumenArco {
  const conteo: Record<Seleccion, number> = {
    si: 0,
    no: 0,
    abstencion: 0,
    pareo: 0,
    ausente: 0,
  };
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const e of arco.etapas) {
    conteo[e.seleccion] += 1;
    const t = new Date(e.fecha).getTime();
    if (!Number.isNaN(t)) {
      if (t < min) min = t;
      if (t > max) max = t;
    }
  }
  return {
    n: arco.etapas.length,
    si: conteo.si,
    no: conteo.no,
    abstencion: conteo.abstencion,
    pareo: conteo.pareo,
    ausente: conteo.ausente,
    mesInicio: Number.isFinite(min) ? mesAnio(new Date(min)) : "",
    mesFin: Number.isFinite(max) ? mesAnio(new Date(max)) : "",
  };
}

/**
 * Href server-driven del toggle de detalle por arco (SC1), replicando el patrón
 * `buildVerHref` de patrimonio: setea (o quita) el searchParam `votosVer` y ancla
 * en `#votos`. Si el arco ya está abierto, el link lo CIERRA (quita votosVer).
 */
function buildVotosVerHref(id: string, boletin: string, abierto: boolean): string {
  const qs = new URLSearchParams();
  if (!abierto) qs.set("votosVer", boletin);
  const q = qs.toString();
  return `/parlamentario/${id}${q ? `?${q}` : ""}#votos`;
}

// Sentidos en orden de despliegue para la línea-resumen, con su etiqueta en
// minúscula ("1 a favor · 2 en contra"). Se omite cualquier sentido en 0.
const RESUMEN_SENTIDOS: { key: Exclude<keyof ResumenArco, "n" | "mesInicio" | "mesFin">; label: string }[] = [
  { key: "si", label: "a favor" },
  { key: "no", label: "en contra" },
  { key: "abstencion", label: "abstención" },
  { key: "pareo", label: "pareo" },
  { key: "ausente", label: "ausente" },
];

/**
 * Agrupa las votaciones por `boletin` preservando el orden de aparición (el RPC
 * ya las ordena por fecha). Cada grupo es el ARCO de un proyecto: una cabecera con
 * su sustancia + las etapas votadas. CERO fabricación: titulo/idea se toman de la
 * primera fila del grupo (LEFT JOIN → null honesto).
 */
function agruparPorProyecto(votos: VotoFichaConMateria[]): ProyectoArco[] {
  const orden: string[] = [];
  const porBoletin = new Map<string, ProyectoArco>();
  for (const v of votos) {
    let g = porBoletin.get(v.boletin);
    if (!g) {
      g = {
        boletin: v.boletin,
        titulo: v.titulo,
        idea_matriz: v.idea_matriz,
        etapas: [],
      };
      porBoletin.set(v.boletin, g);
      orden.push(v.boletin);
    }
    g.etapas.push(v);
  }
  return orden.map((b) => porBoletin.get(b)!);
}

/**
 * Línea-resumen del arco (SC1): "Votó en {N} ocasiones sobre este proyecto: {a} a
 * favor · {b} en contra …, entre {mesInicio} y {mesFin}." Mono para N/tallies/rango;
 * OMITE cualquier sentido en 0. Cuando mesInicio === mesFin dice "en {mes}" (sin
 * repetir el mismo mes). PURO — hecho factual, cero juicio (DESIGN-SYSTEM §6/§8).
 */
function ResumenLinea({ resumen }: { resumen: ResumenArco }) {
  const tallies = RESUMEN_SENTIDOS.map((s) => ({
    label: s.label,
    n: resumen[s.key],
  })).filter((t) => t.n > 0);

  const hayRango = resumen.mesInicio !== "" && resumen.mesFin !== "";
  const mismoMes = resumen.mesInicio === resumen.mesFin;

  return (
    <p className="text-sm text-muted-foreground mt-2">
      Votó en <span className="font-mono">{resumen.n}</span>{" "}
      {resumen.n === 1 ? "ocasión" : "ocasiones"} sobre este proyecto
      {tallies.length > 0 && (
        <>
          :{" "}
          {tallies.map((t, i) => (
            <span key={t.label}>
              {i > 0 && " · "}
              <span className="font-mono">{t.n}</span> {t.label}
            </span>
          ))}
        </>
      )}
      {hayRango && (
        <>
          ,{" "}
          {mismoMes ? (
            <>
              en <span className="font-mono">{resumen.mesInicio}</span>
            </>
          ) : (
            <>
              entre <span className="font-mono">{resumen.mesInicio}</span> y{" "}
              <span className="font-mono">{resumen.mesFin}</span>
            </>
          )}
        </>
      )}
      .
    </p>
  );
}

/**
 * Cabecera de proyecto (titulo enlazado + extracto de idea o honest-state). Por
 * defecto muestra UNA línea-resumen del arco (SC1); con `?votosVer=<boletin>` para
 * ESTE arco se expanden las etapas individuales (opción + etapa + desenlace
 * factual). PURO. El framing del desenlace es un HECHO de la votación
 * (DESIGN-SYSTEM §8), nunca un juicio del voto.
 */
function ProyectoGrupo({
  id,
  grupo,
  votosVer,
}: {
  id: string;
  grupo: ProyectoArco;
  votosVer: string | null;
}) {
  const abierto = votosVer === grupo.boletin;
  return (
    <li className="border-t first:border-t-0 pt-4">
      {/* Cabecera del proyecto — el titulo aparece UNA vez por arco. */}
      {grupo.titulo ? (
        <Link
          href={`/proyecto/${grupo.boletin}`}
          className="text-base text-accent-product underline underline-offset-2"
        >
          {grupo.titulo}
        </Link>
      ) : (
        <Link
          href={`/proyecto/${grupo.boletin}`}
          className="font-mono text-accent-product underline underline-offset-2"
        >
          Boletín N°{grupo.boletin}
        </Link>
      )}
      {/* Idea matriz: se muestra cuando existe. Si es null, NO se repite el
          honest-state por arco (sería ruido); una única nota de sección lo cubre
          más abajo en VotosView. */}
      {grupo.idea_matriz && (
        <p className="text-sm text-muted-foreground mt-1">
          De qué trata: {extractoIdea(grupo.idea_matriz)}
        </p>
      )}

      {abierto ? (
        /* Detalle abierto — etapas votadas, la trayectoria en su tramitación. */
        <ul className="mt-2 space-y-1">
          {grupo.etapas.map((e) => {
            const hayConteo = e.total_si != null && e.total_no != null;
            return (
              <li
                key={e.votacion_id}
                className="flex flex-wrap items-center gap-2 py-1 text-sm"
              >
                <Badge
                  variant="outline"
                  className={cn(
                    "border-transparent shrink-0",
                    SELECCION_STYLE[e.seleccion].className,
                  )}
                >
                  {OPCION_LABEL[e.seleccion]}
                </Badge>
                {e.etapa && (
                  <span className="text-muted-foreground">{e.etapa}</span>
                )}
                <span className="font-mono text-muted-foreground">
                  {fechaCorta(new Date(e.fecha))}
                </span>
                {e.resultado && (
                  <span className="text-muted-foreground">
                    · el proyecto fue {e.resultado}
                    {hayConteo && (
                      <>
                        {" "}
                        <span className="font-mono">
                          {conteoVotacion(e.total_si!, e.total_no!)}
                        </span>
                      </>
                    )}
                  </span>
                )}
                <span className="ml-auto">
                  <ProvenanceBadge
                    capturedAt={e.fecha_captura ? new Date(e.fecha_captura) : null}
                    sourceName={sourceLabel(e.origen)}
                    sourceUrl={e.enlace ?? null}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        /* Colapsado (default) — la línea-resumen del arco sin perder ningún dato. */
        <ResumenLinea resumen={resumenDeArco(grupo)} />
      )}

      {/* Afford server-driven: abre/cierra el detalle vía ?votosVer (SC1). */}
      <Link
        href={buildVotosVerHref(id, grupo.boletin, abierto)}
        className="inline-flex items-center min-h-11 text-sm text-accent-product underline underline-offset-2"
      >
        {abierto ? "Ocultar detalle" : "Ver detalle"}
      </Link>
    </li>
  );
}

// ── Vista pura (RTL la testea con fixtures) ────────────────────────────────────
export function VotosView({
  id,
  data,
}: {
  id: string;
  data: VotosViewData;
}) {
  const { votos, totalVotos, conteos, rebeldias, materiaActiva, materias, page, totalPages, noIngestado, votosVer, totalProyectos: totalProyectosProp } =
    data;
  // Cobertura: nº de proyectos distintos. Si el server no lo pasó, se deriva de
  // los boletines distintos en la página (conservador, nunca aparenta más).
  const totalProyectos =
    totalProyectosProp ?? new Set(votos.map((v) => v.boletin)).size;

  // Estado (c) — no ingestado: NUNCA se lee como "limpio". Distingue "no
  // consultado todavía" de "consultado, sin votos confirmados".
  if (noIngestado) {
    return (
      <>
        <p className="text-sm text-muted-foreground">
          Aún no hemos ingerido las votaciones de este parlamentario. Esto no
          significa que no haya votado — los datos se están incorporando.
        </p>
        <p className="text-sm mt-2">
          Puedes explorar{" "}
          <Link
            href="/parlamentarios"
            className="inline-flex min-h-11 items-center text-accent-product underline underline-offset-2"
          >
            otros parlamentarios en el directorio{" "}
            <span aria-hidden="true" className="pl-1">→</span>
          </Link>
          .
        </p>
      </>
    );
  }

  // Estado (c) — ingestado, cero confirmados.
  if (totalVotos === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay votaciones confirmadas para este parlamentario en la legislatura
        vigente.
      </p>
    );
  }

  const totalConteos = SELECCION_ORDEN.reduce((s, k) => s + conteos[k], 0);
  // Asistencia REAL (presente vs ausente) — derivada de `ausente`, NO del sentido
  // del voto. Presente = total − ausente; sólo se afirma si hay ausentes (cero
  // fabricación de asistencia perfecta).
  const ausentes = conteos.ausente;
  const presentes = totalConteos - ausentes;

  // Arcos por proyecto (una sola pasada, reusada por la lista y la nota de sección).
  const arcos = agruparPorProyecto(votos);
  // Honest-state de idea matriz: si AL MENOS un arco no la tiene, se dice UNA vez
  // por sección (no por arco). Repetir "no disponible aún" en cada arco es ruido.
  const hayArcoSinIdea = arcos.some((g) => !g.idea_matriz);

  return (
    <div className="space-y-10">
      {/* ── Cómo votó — desglose del SENTIDO del voto (NO asistencia) ──────── */}
      <div>
        <h3 className="text-sm font-semibold">Cómo votó</h3>
        {totalConteos > 0 ? (
          <>
            <div
              className="flex h-4 rounded-full overflow-hidden w-full mt-2"
              role="img"
              aria-label={SELECCION_ORDEN.map(
                (k) => `${OPCION_LABEL[k]}: ${conteos[k]}`,
              ).join(", ")}
            >
              {SELECCION_ORDEN.map((k) =>
                conteos[k] > 0 ? (
                  <div
                    key={k}
                    style={{ width: `${(conteos[k] / totalConteos) * 100}%` }}
                    className={BAR_SEGMENT[k]}
                    aria-label={`${OPCION_LABEL[k]}: ${conteos[k]}`}
                  />
                ) : null,
              )}
            </div>
            {/* a11y: cada conteo repetido en texto (nunca solo color). */}
            <p className="text-sm text-muted-foreground mt-2 font-mono">
              {SELECCION_ORDEN.map(
                (k) => `${OPCION_LABEL[k]} ${conteos[k]}`,
              ).join(" · ")}
            </p>
            {/* Asistencia REAL como métrica propia, separada del sentido. */}
            {ausentes > 0 ? (
              <p className="text-sm text-muted-foreground mt-1">
                Presente en{" "}
                <span className="font-mono">
                  {presentes} de {totalConteos}
                </span>{" "}
                votaciones · Ausente en <span className="font-mono">{ausentes}</span>.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">
                Emitió {totalConteos} votos registrados.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground mt-2">
            Emitió 0 votos registrados.
          </p>
        )}
      </div>

      {/* ── Voto × tema (§3.4) — faceta, sin score ────────────────────────── */}
      {materias.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">Por tema</h3>
          <div className="flex flex-wrap gap-2 mt-2">
            <Link
              href={buildHref(id, { materia: null })}
              className={cn(
                "inline-flex items-center min-h-11",
                materiaActiva === null && "border-b-2 border-primary",
              )}
            >
              <Badge variant="secondary" className="font-normal">
                Todas
              </Badge>
            </Link>
            {materias.map((m) => (
              <Link
                key={m.slug}
                href={buildHref(id, { materia: m.slug })}
                className={cn(
                  "inline-flex items-center min-h-11",
                  materiaActiva === m.slug && "border-b-2 border-primary",
                )}
              >
                <Badge variant="secondary" className="font-normal">
                  {m.label}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Votaciones agrupadas POR PROYECTO — el arco (§3.2/§4) ─────────── */}
      <div>
        {/* Línea explicativa neutra del significado de a favor/en contra (LOCKED). */}
        <p className="text-sm text-muted-foreground">
          A favor / En contra se refiere a aprobar o rechazar el proyecto en esa
          etapa de su tramitación.
        </p>

        {votos.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-4">
            {materiaActiva
              ? "No hay votaciones registradas en proyectos sobre este tema."
              : "No hay votaciones confirmadas para este parlamentario en la legislatura vigente."}
          </p>
        ) : (
          <ul className="mt-4 space-y-6">
            {arcos.map((grupo) => (
              <ProyectoGrupo
                key={grupo.boletin}
                id={id}
                grupo={grupo}
                votosVer={votosVer}
              />
            ))}
          </ul>
        )}

        {/* Idea matriz aún no disponible en ≥1 proyecto: se dice UNA vez por
            sección (espejo del bloque de cobertura), nunca por arco. HECHO honesto,
            sin fabricar la idea (§9.1). */}
        {votos.length > 0 && hayArcoSinIdea && (
          <p className="text-sm text-muted-foreground mt-4">
            En algunos proyectos, la idea matriz aún no está disponible en las
            fuentes consultadas; se irá incorporando.
          </p>
        )}

        {/* Cobertura honesta: con pocos proyectos NO se aparenta exhaustividad. */}
        {votos.length > 0 && totalProyectos <= COBERTURA_BAJA_UMBRAL && (
          <p className="text-sm text-muted-foreground mt-4">
            Se registran votaciones de {totalProyectos}{" "}
            {totalProyectos === 1 ? "proyecto" : "proyectos"} en las fuentes
            consultadas; la cobertura se está ampliando.
          </p>
        )}

        {totalPages > 1 && (
          <nav
            className="flex items-center justify-between gap-4 mt-4 text-sm"
            aria-label="Paginación de votaciones"
          >
            {page > 1 ? (
              <Link
                href={buildHref(id, {
                  votosPage: String(page - 1),
                  materia: materiaActiva,
                })}
                className="text-accent-product underline underline-offset-2 inline-flex items-center min-h-11"
              >
                Anteriores
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
            <span className="text-muted-foreground font-mono">
              Página {page} de {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={buildHref(id, {
                  votosPage: String(page + 1),
                  materia: materiaActiva,
                })}
                className="text-accent-product underline underline-offset-2 inline-flex items-center min-h-11"
              >
                Siguientes
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
          </nav>
        )}
      </div>

      {/* ── Votó distinto a su bancada (§3.5) — conteo+lista, sin juicio ───── */}
      <div>
        <h3 className="text-sm font-semibold">Votó distinto a su bancada</h3>
        {rebeldias.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-2">
            No se registran votaciones en que haya votado distinto a su bancada.
          </p>
        ) : (
          <>
            <p className="text-base mt-2">
              Votó distinto a la mayoría de su bancada{" "}
              <span className="font-mono">{rebeldias.length}</span>{" "}
              {rebeldias.length === 1 ? "vez" : "veces"}.
            </p>
            <ul className="mt-2">
              {rebeldias.map((r) => (
                <li
                  key={r.votacion_id}
                  className="flex flex-wrap items-center gap-2 py-2 text-sm border-t first:border-t-0"
                >
                  {/* Título del proyecto cuando el RPC 0047 lo hidrata; fallback
                      honesto al boletín mientras 0047 no esté aplicada (titulo
                      null/undefined → NUNCA se fabrica un título). */}
                  {r.titulo ? (
                    <Link
                      href={`/proyecto/${r.boletin}`}
                      className="text-base text-accent-product underline underline-offset-2"
                    >
                      {r.titulo}
                    </Link>
                  ) : (
                    <Link
                      href={`/proyecto/${r.boletin}`}
                      className="font-mono text-accent-product underline underline-offset-2"
                    >
                      Boletín N°{r.boletin}
                    </Link>
                  )}
                  {r.etapa && (
                    <span className="text-muted-foreground">{r.etapa}</span>
                  )}
                  <span className="font-mono text-muted-foreground">
                    {fechaCorta(new Date(r.fecha))}
                  </span>
                  <span className="text-muted-foreground">
                    Su voto: {OPCION_LABEL[r.seleccion_propia]} · Mayoría de su
                    bancada: {OPCION_LABEL[r.mayoria_bancada]}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground mt-2">
              Se compara el voto del parlamentario con la opción mayoritaria de su
              bancada en esa misma votación.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Normaliza el parámetro `votosPage` del query string. WR-04: rechaza entrada no
 * numérica y basura final ("3abc" → 1, no 3); exige dígitos puros. El clamp por arriba
 * (contra `totalPages`) se hace en el derivador una vez conocido el nº de páginas. PURO.
 */
export function normalizarPagina(rawPage: string | undefined): number {
  const t = (rawPage ?? "").trim();
  return /^\d+$/.test(t) ? Math.max(1, Number.parseInt(t, 10)) : 1;
}

/**
 * Derivación PURA de `VotosViewData` a partir de las filas confirmadas (ya con materia
 * resuelta), el tema activo y la página pedida. Concentra los invariantes WR-01..WR-04
 * fuera del Server Component para poder pinnearlos con fixtures:
 *  - WR-01: agregado ("Cómo votó"/asistencia) sobre el conjunto FILTRADO si hay tema.
 *  - WR-02: agrupa por proyecto ANTES de paginar; pagina sobre arcos (cero arco partido).
 *  - WR-03: filtra con el slug FINAL desambiguado (consistente con los chips).
 *  - WR-04: la página ya viene normalizada; aquí sólo se clampa contra totalPages.
 * CERO fabricación: titulo/idea/materia se toman verbatim (null honesto).
 */
export function derivarVotosViewData({
  todasConMateria,
  materiaActiva,
  page,
  rebeldias,
  votosVer = null,
}: {
  todasConMateria: VotoFichaConMateria[];
  materiaActiva: string | null;
  page: number;
  rebeldias: RebeldiaRow[];
  votosVer?: string | null;
}): VotosViewData {
  // Materias disponibles (faceta) — derivadas, deduplicadas, ordenadas. WR-03: el
  // mapa slug→materia desambigua colisiones de slug para que dos materias distintas
  // (p.ej. "Niñez" vs "Ninez") NO se fundan en un solo chip.
  const materiaDeSlug = construirMateriasMap(
    todasConMateria.flatMap((v) => (v.materia ? [v.materia] : [])),
  );
  // Mapa inverso (materia verbatim → slug final) para filtrar de forma consistente.
  const slugDeMateria = new Map<string, string>();
  for (const [slug, label] of materiaDeSlug) slugDeMateria.set(label, slug);

  const materias = [...materiaDeSlug.entries()]
    .map(([slug, label]) => ({ slug, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));

  // Filtro por tema (faceta cruda, sin score). Usa el slug FINAL (desambiguado) por
  // materia, no `slugTema` directo — así el filtro casa con el chip mostrado (WR-03).
  const filtradas = materiaActiva
    ? todasConMateria.filter(
        (v) => v.materia && slugDeMateria.get(v.materia) === materiaActiva,
      )
    : todasConMateria;

  // Conteos de asistencia. WR-01: cuando hay un tema activo, el agregado ("Cómo votó",
  // presente/ausente) se computa sobre el MISMO conjunto filtrado que la lista muestra
  // — de lo contrario el ciudadano vería un desglose global bajo una etiqueta de tema.
  // Sin tema activo, `filtradas === todasConMateria` (agregado global). SOLO confirmados.
  const conteoSet = materiaActiva ? filtradas : todasConMateria;
  const conteos: Record<Seleccion, number> = {
    si: 0,
    no: 0,
    abstencion: 0,
    pareo: 0,
    ausente: 0,
  };
  for (const v of conteoSet) conteos[v.seleccion] += 1;

  // WR-02: agrupar POR PROYECTO antes de paginar, luego paginar sobre los ARCOS. Si se
  // paginara la lista plana primero, un proyecto cuyas etapas cruzan el borde de página
  // se partiría en dos cabeceras idénticas (una por página), rompiendo el invariante
  // "el titulo aparece UNA vez por arco". Aquí la página agrupa proyectos completos.
  const arcos = agruparPorProyecto(filtradas);
  const totalPages = Math.max(1, Math.ceil(arcos.length / PAGE_SIZE));
  const pageClamped = Math.min(Math.max(1, page), totalPages);
  const start = (pageClamped - 1) * PAGE_SIZE;
  // La vista re-agrupa por boletín, así que pasamos las etapas (planas) de los arcos
  // de esta página: misma agrupación reconstruida, ningún proyecto partido.
  const votos = arcos.slice(start, start + PAGE_SIZE).flatMap((a) => a.etapas);
  // total para "Cómo votó"/asistencia = tamaño del conjunto agregado (WR-01 coherente).
  const totalVotos = conteoSet.length;

  // Cobertura: nº de proyectos DISTINTOS con votaciones confirmadas (sobre TODO el
  // conjunto, no la página) — alimenta la nota honesta. Cero exhaustividad fingida.
  const totalProyectos = new Set(todasConMateria.map((v) => v.boletin)).size;

  return {
    votos,
    totalVotos,
    conteos,
    rebeldias,
    materiaActiva,
    materias,
    page: pageClamped,
    totalPages,
    noIngestado: false,
    votosVer,
    totalProyectos,
  };
}

// ── Server Component: lee los RPCs + materias y arma la VotosView ──────────────
export async function VotosSection({
  id,
  searchParams,
}: {
  id: string;
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const sb = createServerSupabase();

  const rawPage = Array.isArray(searchParams.votosPage)
    ? searchParams.votosPage[0]
    : searchParams.votosPage;
  const materiaActiva = (
    Array.isArray(searchParams.materia)
      ? searchParams.materia[0]
      : searchParams.materia
  )?.trim() || null;

  // Arco expandido (SC1): server-driven vía ?votosVer, normalizado como los demás
  // params del repo (string[] → primer valor; vacío → null). Nunca se interpola en
  // SQL: es una comparación de igualdad contra boletines ya conocidos (T-51-05).
  const votosVer = (
    Array.isArray(searchParams.votosVer)
      ? searchParams.votosVer[0]
      : searchParams.votosVer
  )?.trim() || null;

  const page = normalizarPagina(rawPage);

  // Conteos de asistencia + total: sobre TODAS las confirmadas (no solo la
  // página). Se piden hasta un techo alto en una sola llamada; el orden ya viene
  // por fecha DESC del RPC. (Para volúmenes grandes, mover a un RPC de conteo.)
  const { data: todasData, error: todasError } = await sb.rpc(
    "votos_de_parlamentario",
    { p_id: id, p_limit: 1000, p_offset: 0 },
  );
  // #34: error real de DB/red ≠ "sin votos". Se lanza para la UI de error honesta.
  if (todasError) {
    throw new Error(
      `votos_de_parlamentario falló para ${id}: ${todasError.message}`,
    );
  }
  const todas = (todasData as VotoFichaRowData[] | null) ?? [];

  // Materia por boletín: `proyecto` es público-read (0008). Cero materia
  // fabricada — solo lo que la tabla trae.
  const boletines = [...new Set(todas.map((v) => v.boletin))];
  const materiaPorBoletin = new Map<string, string | null>();
  if (boletines.length > 0) {
    const { data: proyectos, error: materiaError } = await sb
      .from("proyecto")
      .select("boletin, materia")
      .in("boletin", boletines);
    // Enriquecimiento SECUNDARIO: a diferencia del RPC de votos, un fallo aquí NO
    // debe tirar la página (ya tiene los votos reales). Log para observabilidad y
    // se sigue con materia=null (degradación honesta, no error de página).
    if (materiaError) {
      console.error(
        `hidratación de materia falló para ${id} (votos sin materia):`,
        materiaError,
      );
    }
    for (const p of (proyectos as { boletin: string; materia: string | null }[]) ??
      []) {
      materiaPorBoletin.set(p.boletin, p.materia ?? null);
    }
  }

  const todasConMateria = todas.map((v) => ({
    ...v,
    materia: materiaPorBoletin.get(v.boletin) ?? null,
  }));

  // Votó distinto a su bancada (RPC security definer; partido nunca llega a anon).
  const { data: rebData, error: rebError } = await sb.rpc(
    "rebeldias_de_parlamentario",
    { p_id: id },
  );
  if (rebError) {
    throw new Error(
      `rebeldias_de_parlamentario falló para ${id}: ${rebError.message}`,
    );
  }
  const rebeldias = (rebData as RebeldiaRow[] | null) ?? [];

  const data = derivarVotosViewData({
    todasConMateria,
    materiaActiva,
    page,
    rebeldias,
    votosVer,
  });

  return (
    <VotosView
      id={id}
      data={data}
    />
  );
}
