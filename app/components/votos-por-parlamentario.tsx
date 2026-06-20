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

/** Fila confirmada de la ficha con su materia derivada (proyecto, público-read). */
export type VotoFichaConMateria = VotoFichaRowData & { materia: string | null };

// ── Datos que la vista necesita (forma pura, testeable) ────────────────────────
export interface VotosViewData {
  /** filas confirmadas de la página actual (ya paginadas). */
  votos: VotoFichaConMateria[];
  /** total de votaciones confirmadas (para "Página N de M" y asistencia cruda). */
  totalVotos: number;
  /** desglose de asistencia por selección (solo confirmados). */
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
 * Cabecera de proyecto (titulo enlazado + extracto de idea o honest-state) + las
 * etapas votadas bajo él (cada una: opción + etapa + desenlace factual). PURO.
 * El framing del desenlace es un HECHO de la votación (DESIGN-SYSTEM §8), nunca
 * un juicio del voto.
 */
function ProyectoGrupo({ grupo }: { grupo: ProyectoArco }) {
  return (
    <li className="border-t first:border-t-0 pt-4">
      {/* Cabecera del proyecto — el titulo aparece UNA vez por arco. */}
      {grupo.titulo ? (
        <Link
          href={`/proyecto/${grupo.boletin}`}
          className="text-base text-primary underline underline-offset-2"
        >
          {grupo.titulo}
        </Link>
      ) : (
        <Link
          href={`/proyecto/${grupo.boletin}`}
          className="font-mono text-primary underline underline-offset-2"
        >
          Boletín N°{grupo.boletin}
        </Link>
      )}
      <p className="text-sm text-muted-foreground mt-1">
        {grupo.idea_matriz
          ? `De qué trata: ${extractoIdea(grupo.idea_matriz)}`
          : "De qué trata: no disponible aún"}
      </p>

      {/* Etapas votadas — la trayectoria del proyecto en su tramitación. */}
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
              {e.etapa && <span className="text-muted-foreground">{e.etapa}</span>}
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
  const { votos, totalVotos, conteos, rebeldias, materiaActiva, materias, page, totalPages, noIngestado, totalProyectos: totalProyectosProp } =
    data;
  // Cobertura: nº de proyectos distintos. Si el server no lo pasó, se deriva de
  // los boletines distintos en la página (conservador, nunca aparenta más).
  const totalProyectos =
    totalProyectosProp ?? new Set(votos.map((v) => v.boletin)).size;

  // Estado (c) — no ingestado: NUNCA se lee como "limpio". Distingue "no
  // consultado todavía" de "consultado, sin votos confirmados".
  if (noIngestado) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hemos ingerido las votaciones de este parlamentario. Esto no
        significa que no haya votado — los datos se están incorporando.
      </p>
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
                Presente en {presentes} de {totalConteos} votaciones · Ausente en{" "}
                {ausentes}.
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
                "inline-flex items-center min-h-[44px]",
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
                  "inline-flex items-center min-h-[44px]",
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
            {agruparPorProyecto(votos).map((grupo) => (
              <ProyectoGrupo key={grupo.boletin} grupo={grupo} />
            ))}
          </ul>
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
                className="text-primary underline underline-offset-2 inline-flex items-center min-h-[44px]"
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
                className="text-primary underline underline-offset-2 inline-flex items-center min-h-[44px]"
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
              Votó distinto a la mayoría de su bancada {rebeldias.length}{" "}
              {rebeldias.length === 1 ? "vez" : "veces"}.
            </p>
            <ul className="mt-2">
              {rebeldias.map((r) => (
                <li
                  key={r.votacion_id}
                  className="flex flex-wrap items-center gap-2 py-2 text-sm border-t first:border-t-0"
                >
                  <Link
                    href={`/proyecto/${r.boletin}`}
                    className="font-mono text-primary underline underline-offset-2"
                  >
                    Boletín N°{r.boletin}
                  </Link>
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

  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);

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
    const { data: proyectos } = await sb
      .from("proyecto")
      .select("boletin, materia")
      .in("boletin", boletines);
    for (const p of (proyectos as { boletin: string; materia: string | null }[]) ??
      []) {
      materiaPorBoletin.set(p.boletin, p.materia ?? null);
    }
  }

  const todasConMateria = todas.map((v) => ({
    ...v,
    materia: materiaPorBoletin.get(v.boletin) ?? null,
  }));

  // Materias disponibles (faceta) — derivadas, deduplicadas, ordenadas.
  const materiasMap = new Map<string, string>();
  for (const v of todasConMateria) {
    if (v.materia) materiasMap.set(slugTema(v.materia), v.materia);
  }
  const materias = [...materiasMap.entries()]
    .map(([slug, label]) => ({ slug, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));

  // Filtro por tema (faceta cruda, sin score).
  const filtradas = materiaActiva
    ? todasConMateria.filter((v) => v.materia && slugTema(v.materia) === materiaActiva)
    : todasConMateria;

  // Conteos de asistencia (SOLO confirmados; el RPC ya devuelve solo esos).
  const conteos: Record<Seleccion, number> = {
    si: 0,
    no: 0,
    abstencion: 0,
    pareo: 0,
    ausente: 0,
  };
  for (const v of todasConMateria) conteos[v.seleccion] += 1;

  // Paginación server-driven sobre el conjunto (filtrado) ya cargado.
  const totalVotos = filtradas.length;
  const totalPages = Math.max(1, Math.ceil(totalVotos / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const start = (pageClamped - 1) * PAGE_SIZE;
  const votos = filtradas.slice(start, start + PAGE_SIZE);

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

  // Cobertura: nº de proyectos DISTINTOS con votaciones confirmadas (sobre TODO el
  // conjunto, no la página) — alimenta la nota honesta. Cero exhaustividad fingida.
  const totalProyectos = new Set(todasConMateria.map((v) => v.boletin)).size;

  return (
    <VotosView
      id={id}
      data={{
        votos,
        totalVotos: todasConMateria.length,
        conteos,
        rebeldias,
        materiaActiva,
        materias,
        page: pageClamped,
        totalPages,
        noIngestado: false,
        totalProyectos,
      }}
    />
  );
}
