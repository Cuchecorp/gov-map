import Link from "next/link";

import { createServerSupabase } from "@/lib/supabase";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { MencionBoletinChips } from "@/components/mencion-boletin-chip";
import { extraerBoletines } from "@/lib/boletin-en-materia";
import { fechaCorta, formatNombre } from "@/lib/format";
import {
  sourceLabel,
  type LobbyAudienciaRow,
  type LobbyAudienciaRpcRow,
  type LobbyContraparteRow,
} from "@/lib/types";

/**
 * Sección INT Lobby de la ficha del parlamentario (UI-SPEC §3). Es la PRIMERA
 * sección multi-dataset de `/parlamentario/[id]` → FIJA la regla anti-insinuación
 * (carril propio) para todo el frente parlamentario (Phases 12/14–16).
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ GATE DE CONTENIDO (UI-SPEC §9.1, RELEASE GATE DE LA FASE)                    │
 * │                                                                             │
 * │ 1. CARRIL AISLADO (la regla nueva LOCKED): esta sección NUNCA referencia,   │
 * │    compone ni enlaza un voto / boletín / proyecto / declaración. Una        │
 * │    reunión de lobby y un voto JAMÁS comparten un <article>/<Card>/<li>. La  │
 * │    sección vive en su propio `<section id="lobby">` separado por mt-12.     │
 * │    Excepción ÚNICA (F-03, 53-UI-SPEC, WR-04): en los empty states (a)/(b)   │
 * │    — cero hechos de lobby presentes — la línea de continuación puede        │
 * │    enlazar la RUTA /buscar ("buscar un proyecto de ley por su idea"):       │
 * │    con cero hechos no hay nada que componer. NUNCA un /proyecto/[boletin]   │
 * │    concreto; las filas con hechos (estado (c)) mantienen la prohibición     │
 * │    ABSOLUTA.                                                                │
 * │ 2. CERO CAUSALIDAD: prohibido "se reunió para", "a cambio de", "antes de    │
 * │    votar", "que resultó en".                                                │
 * │ 3. CERO AFINIDAD/RELACIÓN sobre la contraparte: "cercano a", "vinculado a", │
 * │    "aliado de", "su lobista", "lobista habitual", "se reúne más seguido".   │
 * │ 4. CERO score / índice / ranking / flag: sin "lobby influence score", sin   │
 * │    "conflicto de interés", sin leaderboard de contrapartes. Un conteo NEUTRO │
 * │    de reuniones es el único agregado permitido.                             │
 * │ 5. CERO adjetivo de juicio: "polémico", "influyente", "oscuro",             │
 * │    "controversial", "sospechoso".                                           │
 * │ 6. Incertidumbre de identidad = caveat ÚNICO por sección (B11): las         │
 * │    contrapartes son texto crudo verbatim, su identidad no está verificada.  │
 * │ 7. PRIVACIDAD DE TERCERO ABSOLUTA: NUNCA un RUT de contraparte ni campo      │
 * │    interno; el RPC `lobby_de_parlamentario` no emite `contraparte_id`.      │
 * │ 8. PROVENANCE obligatoria por fila; si se desconoce → "fuente desconocida". │
 * │ 9. Un vacío es un HECHO, no una virtud: "no ingestado" ≠ "ingestado, cero". │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * `LobbyView` es PURO (props) → RTL lo testea con fixtures, sin runtime
 * Supabase/Next. `LobbySection` es el Server Component que lee el RPC y el
 * marcador de ingesta. NO hay `"use client"` en este archivo.
 *
 * SC6/B11 (Phase 51): la vista por DEFECTO agrupa por contraparte (orden por
 * frecuencia DESC) — responde "¿con quién se reúne más?" sin ruido. Un toggle
 * server-driven `?vista=cronologica` preserva la lista cronológica paginada
 * existente. El caveat de identidad aparece UNA vez al tope de la sección (ya no
 * un `IdentityMarker` por fila).
 */

const PAGE_SIZE = 20;

// ── Datos que la vista necesita (forma pura, testeable) ────────────────────────
export interface LobbyViewData {
  id: string;
  /** audiencias de la página actual (ya paginadas), orden fecha DESC. Vista cronológica. */
  audiencias: LobbyAudienciaRow[];
  /**
   * Grupos por contraparte (orden por frecuencia DESC) sobre el conjunto COMPLETO
   * de audiencias — la vista agrupada NO se pagina (bounded a cientos). Derivado
   * server-side con `agruparPorContraparte`.
   */
  grupos: GrupoContraparte[];
  /** total de audiencias confirmadas (para "Página N de M" y el conteo neutro). */
  totalAudiencias: number;
  page: number;
  totalPages: number;
  /**
   * Vista activa. `"agrupada"` (default) responde "¿con quién se reúne más?";
   * `"cronologica"` es la lista paginada por fecha existente (toggle `?vista`).
   */
  vista: "agrupada" | "cronologica";
  /**
   * `true` si la ingesta de lobby de este parlamentario aún NO ha corrido
   * (estado (a) "no ingestado" — distinto de "ingestado, 0 confirmadas"). Se
   * infiere de la AUSENCIA de fila en `lobby_ingesta_estado`.
   */
  noIngestado: boolean;
  /**
   * B10 — cámara del parlamentario (`parlamentario_publico.camara`), para
   * parametrizar el FRAME/intro con la fuente que corresponde (senado vs
   * diputados). NO altera el `enlace` por fila (la fuente REAL del dato). Ausente
   * (`undefined`/`null`) → frame genérico sin atribuir una cámara concreta.
   */
  camara?: string | null;
}

/**
 * Una reunión dentro de un grupo por contraparte (Plan 92-02, LOB-01/LOB-02). La
 * vista agrupada HOY solo mostraba contraparte + conteo + fechas; ahora lista la
 * MATERIA por reunión (whitespace-pre-line) y sus chips de mención en la MISMA fila
 * (restricción de carril LOCKED: la mención proviene de ESA materia, es metadata de
 * la propia audiencia — no compone dos dominios). `fechaTexto` es la fecha ya
 * formateada; `materia` verbatim (null si la fuente no la publica); `boletines` son
 * las menciones VÁLIDAS (patrón + existencia) resueltas server-side.
 */
export interface GrupoReunion {
  fechaTexto: string;
  materia: string | null;
  boletines: string[];
}

/**
 * Grupo de audiencias por contraparte (SC6/B11). `contraparte` es el nombre CRUDO
 * verbatim de la fuente; `n` es el conteo NEUTRO de reuniones (único agregado
 * permitido §3.4, jamás un score/ranking); `fechas` son las fechas de cada reunión
 * ya formateadas (conservado por retro-compat con consumidores existentes);
 * `reuniones` (Plan 92-02, MAJOR-4) es la lista EXPLÍCITA por reunión con su materia
 * y chips de mención — `reuniones[i].fechaTexto === fechas[i]` por construcción.
 */
export interface GrupoContraparte {
  contraparte: string;
  n: number;
  fechas: string[];
  reuniones: GrupoReunion[];
}

/**
 * Agrupa audiencias por contraparte (nombre CRUDO verbatim), ordenado por
 * frecuencia DESC. Una audiencia cuenta 1 vez por contraparte (nombres
 * deduplicados dentro de la misma fila → no infla `n` si la fuente repite el
 * nombre). Las audiencias SIN contraparte se EXCLUYEN de la agrupación (nunca se
 * fabrica un nombre — la vista cronológica sigue mostrándolas). El sort es
 * estable → los empates conservan el orden de aparición.
 *
 * Plan 92-02 (MAJOR-4): además de `n`/`fechas` (semántica LOCKED conservada), cada
 * grupo lleva `reuniones[]` con la materia y los boletines mencionados de cada
 * audiencia — para que la vista agrupada pueda mostrar POR REUNIÓN. `fechas` y
 * `reuniones` son paralelos (mismo índice, misma reunión); la dedupe por audiencia
 * (una fila por (contraparte × audiencia)) y el orden freq-DESC se preservan.
 */
export function agruparPorContraparte(
  audiencias: LobbyAudienciaRow[],
): GrupoContraparte[] {
  const porNombre = new Map<
    string,
    { n: number; fechas: string[]; reuniones: GrupoReunion[] }
  >();
  const orden: string[] = [];

  for (const a of audiencias) {
    const fechaTexto = a.fecha
      ? fechaCorta(new Date(a.fecha))
      : a.fecha_raw ?? "Fecha no publicada";
    const reunion: GrupoReunion = {
      fechaTexto,
      materia: a.materia,
      boletines: a.boletines_mencionados ?? [],
    };
    // Nombres crudos ÚNICOS dentro de la audiencia → cuenta 1 por contraparte.
    const nombresUnicos = new Set(
      a.contrapartes
        .map((c) => c.contraparte_nombre)
        .filter((n): n is string => Boolean(n)),
    );
    for (const nombre of nombresUnicos) {
      let g = porNombre.get(nombre);
      if (!g) {
        g = { n: 0, fechas: [], reuniones: [] };
        porNombre.set(nombre, g);
        orden.push(nombre);
      }
      g.n += 1;
      g.fechas.push(fechaTexto);
      g.reuniones.push(reunion);
    }
  }

  const grupos: GrupoContraparte[] = [];
  for (const contraparte of orden) {
    const g = porNombre.get(contraparte);
    if (g)
      grupos.push({
        contraparte,
        n: g.n,
        fechas: g.fechas,
        reuniones: g.reuniones,
      });
  }
  // Orden por frecuencia DESC; `sort` es estable → empates conservan aparición.
  return grupos.sort((a, b) => b.n - a.n);
}

/**
 * Normaliza el searchParam `?vista` a un enum efectivo (fail-safe): SOLO el valor
 * literal `"cronologica"` activa la vista cronológica; cualquier otro valor
 * (`undefined`, `""`, `"basura"`, etc.) → `"agrupada"` (default). Nunca alcanza
 * SQL crudo (T-51-12).
 */
export function normalizarVista(
  raw: string | string[] | undefined,
): "agrupada" | "cronologica" {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "cronologica" ? "cronologica" : "agrupada";
}

/**
 * B10 — frase de fuente del FRAME de lobby, parametrizada por la cámara real del
 * parlamentario. Antes el intro/empty-state atribuían SIEMPRE "la Cámara
 * (camara.cl/transparencia)", fabricando trazabilidad falsa en fichas de senador.
 * Normalización idéntica a `classify` en `camara-chip.tsx`. El enlace por fila
 * (`sourceUrl={a.enlace}`) es la fuente real y NO se toca — esto es solo el frame.
 */
function fuenteLobbyPorCamara(camara: string | null): string {
  const v = (camara ?? "").toLowerCase();
  if (v.includes("senado")) {
    return "el registro de la Ley del Lobby del Senado";
  }
  if (v.includes("diput") || v.includes("cámara") || v.includes("camara")) {
    return "el registro oficial de la Cámara (camara.cl/transparencia)";
  }
  // Cámara desconocida → frame genérico honesto, sin atribuir una cámara.
  return "el registro oficial de la Ley del Lobby";
}

/** Construye un href de paginación preservando la vista cronológica y el ancla. */
function buildHref(id: string, page: number, vista: "agrupada" | "cronologica"): string {
  const params: Record<string, string> = { lobbyPage: String(page) };
  // La paginación solo existe en la vista cronológica → preservar el toggle.
  if (vista === "cronologica") params.vista = "cronologica";
  const qs = new URLSearchParams(params).toString();
  return `/parlamentario/${id}?${qs}#lobby`;
}

// ── Toggle server-driven entre vista agrupada y cronológica (SC6) ──────────────
function VistaToggle({
  id,
  vista,
}: {
  id: string;
  vista: "agrupada" | "cronologica";
}) {
  const agrupadaActiva = vista !== "cronologica";
  // Estado activo petróleo (UI-SPEC §0 reserved-for #3): subrayado --accent-product.
  const activoCls =
    "text-accent-product underline decoration-2 decoration-accent-product underline-offset-4 font-semibold inline-flex items-center min-h-11";
  const inactivoCls =
    "text-accent-product underline underline-offset-2 inline-flex items-center min-h-11";
  return (
    <nav
      className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4 text-sm"
      aria-label="Vista de reuniones de lobby"
    >
      <Link
        href={`/parlamentario/${id}#lobby`}
        aria-current={agrupadaActiva ? "true" : undefined}
        className={agrupadaActiva ? activoCls : inactivoCls}
      >
        Agrupar por contraparte
      </Link>
      <Link
        href={`/parlamentario/${id}?vista=cronologica#lobby`}
        aria-current={!agrupadaActiva ? "true" : undefined}
        className={!agrupadaActiva ? activoCls : inactivoCls}
      >
        Ver en orden cronológico
      </Link>
    </nav>
  );
}

// ── Una contraparte cruda (texto + tipo + representado), NUNCA enlace ──────────
function ContraparteCruda({ c }: { c: LobbyContraparteRow }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
      {/* Nombre de la fuente; formatNombre solo re-casea si viene 100% minúscula (F54 Contract 1, passthrough si ya trae mayúscula). */}
      <span className="text-base">{formatNombre(c.contraparte_nombre)}</span>
      {/* Rol/tipo crudo (si la fuente lo publica), como metadata, sin editorializar. */}
      {c.contraparte_tipo && (
        <span className="text-sm text-muted-foreground">({c.contraparte_tipo})</span>
      )}
      {c.representado && (
        <span className="text-sm text-muted-foreground">
          en representación de {c.representado}
        </span>
      )}
      {/*
        P11/B11: la contraparte NUNCA está confirmada (el RPC no emite
        contraparte_id ni estado_vinculo) → siempre texto crudo, JAMÁS un enlace
        (nunca un enlace muerto a una sub-maestra inexistente). §3.2. El caveat de
        identidad único al tope de la sección (SC6) reemplaza el IdentityMarker
        por fila que antes vivía aquí.
      */}
    </span>
  );
}

// ── Caveat de identidad ÚNICO por sección (B11) — reemplaza el marcador por fila ─
function CaveatIdentidad() {
  return (
    <p
      className="text-sm mb-4 px-3 py-2 rounded border
                 bg-identity-warn-bg text-identity-warn-fg
                 border-identity-warn-border"
    >
      Las contrapartes se muestran tal como las registra la fuente; su identidad
      no está verificada.
    </p>
  );
}

// ── Vista pura (RTL la testea con fixtures) ────────────────────────────────────
export function LobbyView({ data }: { data: LobbyViewData }) {
  const {
    id,
    audiencias,
    grupos,
    totalAudiencias,
    page,
    totalPages,
    noIngestado,
    vista,
  } = data;

  // B10 — frase de fuente del FRAME según la cámara REAL del parlamentario. Para
  // senadores no se dirá "la Cámara (camara.cl/transparencia)". El enlace por fila
  // (fuente real) NO se toca; esto es solo el texto del frame/intro.
  const fuente = fuenteLobbyPorCamara(data.camara ?? null);

  // ── Línea de intro honesta (§3.1) — el frame ANTES de cualquier fila ──────────
  const intro = (
    <p className="text-sm text-muted-foreground mb-4">
      Audiencias registradas bajo la Ley del Lobby (Ley 20.730). Cada reunión se
      muestra tal como la publica {fuente}; el enlace de cada fila apunta a la
      fuente.
    </p>
  );

  // Estado (a) — NO ingestado: NUNCA se lee como "limpio" ni "no se reúne".
  if (noIngestado) {
    return (
      <>
        {intro}
        <p className="text-sm text-muted-foreground">
          Aún no hemos ingerido las reuniones de lobby de este parlamentario. Esto
          no significa que no se haya reunido — los datos de la Ley del Lobby se
          están incorporando.
        </p>
        <p className="text-sm mt-2">
          Mientras tanto, puedes{" "}
          <Link
            href="/buscar"
            className="inline-flex min-h-11 items-center text-accent-product underline underline-offset-2"
          >
            buscar un proyecto de ley por su idea{" "}
            <span aria-hidden="true" className="pl-1">→</span>
          </Link>
          .
        </p>
      </>
    );
  }

  // Estado (b) — ingestado, cero audiencias confirmadas.
  if (totalAudiencias === 0) {
    return (
      <>
        {intro}
        <p className="text-sm text-muted-foreground">
          No se registran reuniones de lobby confirmadas para este parlamentario en
          el periodo consultado, según {fuente}.
        </p>
        <p className="text-sm mt-2">
          Mientras tanto, puedes{" "}
          <Link
            href="/buscar"
            className="inline-flex min-h-11 items-center text-accent-product underline underline-offset-2"
          >
            buscar un proyecto de ley por su idea{" "}
            <span aria-hidden="true" className="pl-1">→</span>
          </Link>
          .
        </p>
      </>
    );
  }

  // Estado (c) — con audiencias. Caveat 1×/sección + toggle + conteo neutro, luego
  // la vista activa (agrupada por defecto, o cronológica paginada tras el toggle).
  return (
    <div>
      {intro}

      {/* Caveat de identidad ÚNICO al tope (B11) — no por fila. */}
      <CaveatIdentidad />

      {/* Toggle server-driven agrupada ↔ cronológica. */}
      <VistaToggle id={id} vista={vista} />

      {/* Conteo NEUTRO (único agregado permitido §3.4) — sin score, sin ranking. */}
      <p className="text-sm text-muted-foreground mb-4">
        {totalAudiencias}{" "}
        {totalAudiencias === 1 ? "reunión registrada" : "reuniones registradas"}.
      </p>

      {vista === "cronologica" ? (
        <VistaCronologica id={id} audiencias={audiencias} page={page} totalPages={totalPages} />
      ) : (
        <VistaAgrupada grupos={grupos} />
      )}
    </div>
  );
}

// ── Vista agrupada por contraparte (DEFAULT, freq DESC) ────────────────────────
function VistaAgrupada({ grupos }: { grupos: GrupoContraparte[] }) {
  return (
    <ul className="space-y-4">
      {grupos.map((g) => (
        <li key={g.contraparte} className="py-3 border-t first:border-t-0">
          {/* Contraparte VERBATIM (h3) — NUNCA enlazada. */}
          <h3 className="text-base font-semibold">{g.contraparte}</h3>
          {/* Conteo neutro (Mono). "{contraparte} — {N} reuniones". */}
          <p className="text-sm text-muted-foreground">
            <span aria-hidden="true">— </span>
            <span className="font-mono">{g.n}</span>{" "}
            {g.n === 1 ? "reunión" : "reuniones"}
          </p>
          {/*
            Plan 92-02 (LOB-01): la materia COMPLETA por reunión dentro del grupo.
            HOY la vista agrupada no la mostraba → el usuario no podía leer de qué
            trató cada reunión sin cambiar a cronológica. Cada reunión lleva su fecha
            (Mono) + materia legible (whitespace-pre-line, sin clamp) + sus chips de
            mención en la MISMA fila (carril LOCKED — la mención es metadata de ESA
            materia). Los chips NO son un voto/declaración → no violan carril aislado.
          */}
          <ul className="mt-2 space-y-2">
            {g.reuniones.map((r, i) => (
              <li key={`${g.contraparte}-${i}`} className="min-w-0">
                <span className="font-mono text-sm text-muted-foreground">
                  {r.fechaTexto}
                </span>
                {r.materia && (
                  <div className="text-sm whitespace-pre-line leading-relaxed">
                    <span className="text-muted-foreground">Asunto: </span>
                    {r.materia}
                  </div>
                )}
                {/* Chips "Menciona boletín N" (fail-closed doble, ya validados). */}
                <MencionBoletinChips boletines={r.boletines} />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

// ── Vista cronológica paginada (preservada intacta tras el toggle) ─────────────
function VistaCronologica({
  id,
  audiencias,
  page,
  totalPages,
}: {
  id: string;
  audiencias: LobbyAudienciaRow[];
  page: number;
  totalPages: number;
}) {
  return (
    <>
      <ul className="space-y-4">
        {audiencias.map((a) => {
          const captured = a.fecha_captura ? new Date(a.fecha_captura) : null;
          const fechaTexto = a.fecha
            ? fechaCorta(new Date(a.fecha))
            : a.fecha_raw ?? "Fecha no publicada";
          return (
            <li
              key={a.identificador}
              className="flex flex-wrap items-start gap-x-3 gap-y-2 py-3 border-t first:border-t-0"
            >
              {/* Fecha de la audiencia (mono). */}
              <span className="font-mono text-sm text-muted-foreground">
                {fechaTexto}
              </span>

              <div className="flex flex-col gap-1 min-w-0 flex-1">
                {/* Contraparte(s): TEXTO CRUDO, sin enlace, sin RUT. */}
                {a.contrapartes.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {a.contrapartes.map((c, i) => (
                      <span key={`${a.identificador}-${i}`}>
                        <span className="text-sm text-muted-foreground">
                          Contraparte:{" "}
                        </span>
                        <ContraparteCruda c={c} />
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Contraparte no publicada por la fuente.
                  </span>
                )}

                {/*
                  Asunto/materia verbatim, opcional (nunca fabricado/resumido).
                  Plan 92-02 (LOB-01): bloque (`<div>`) con `whitespace-pre-line`
                  `leading-relaxed` para leer la materia multilínea ENTERA — un
                  `<span>` inline no honra los `\n` de la fuente. PROHIBIDO
                  line-clamp/truncate/max-h; el `min-w-0` del contenedor padre (arriba)
                  permite el wrap sin desbordar. Materia SELECCIONABLE, sin "ver más".
                */}
                {a.materia && (
                  <div className="text-sm whitespace-pre-line leading-relaxed">
                    <span className="text-muted-foreground">Asunto: </span>
                    {a.materia}
                  </div>
                )}

                {/*
                  Chips "Menciona boletín N" (LOB-02/LOB-03) — BAJO la materia, en su
                  propia fila (no inline: rompería el wrap del texto largo). Ya
                  validados server-side (fail-closed doble); `[]` → no se pinta nada.
                */}
                <MencionBoletinChips boletines={a.boletines_mencionados ?? []} />
              </div>

              {/* ProvenanceBadge por fila, obligatorio (§3.2). */}
              <span className="ml-auto">
                <ProvenanceBadge
                  capturedAt={captured}
                  sourceName={sourceLabel(a.origen)}
                  sourceUrl={a.enlace}
                />
              </span>
            </li>
          );
        })}
      </ul>

      {totalPages > 1 && (
        <nav
          className="flex items-center justify-between gap-4 mt-4 text-sm"
          aria-label="Paginación de reuniones de lobby"
        >
          {page > 1 ? (
            <Link
              href={buildHref(id, page - 1, "cronologica")}
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
              href={buildHref(id, page + 1, "cronologica")}
              className="text-accent-product underline underline-offset-2 inline-flex items-center min-h-11"
            >
              Siguientes
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
        </nav>
      )}
    </>
  );
}

/**
 * Agrupa las filas crudas del RPC (left join → una fila por contraparte) en
 * audiencias (1 audiencia con sus N contrapartes), preservando el orden fecha
 * DESC que ya trae el RPC.
 */
export function agruparAudiencias(
  filas: LobbyAudienciaRpcRow[],
): LobbyAudienciaRow[] {
  const porId = new Map<string, LobbyAudienciaRow>();
  const orden: string[] = [];

  for (const f of filas) {
    let aud = porId.get(f.identificador);
    if (!aud) {
      aud = {
        identificador: f.identificador,
        fecha: f.fecha,
        fecha_raw: f.fecha_raw,
        materia: f.materia,
        contrapartes: [],
        origen: f.origen,
        fecha_captura: f.fecha_captura,
        enlace: f.enlace ?? f.enlace_detalle,
      };
      porId.set(f.identificador, aud);
      orden.push(f.identificador);
    }
    // El left join trae contraparte_nombre null cuando la audiencia no tiene
    // contraparte → no se fabrica ninguna fila de contraparte.
    if (f.contraparte_nombre) {
      aud.contrapartes.push({
        contraparte_nombre: f.contraparte_nombre,
        contraparte_tipo: f.contraparte_rol, // alias UI-SPEC §10 (rol → tipo)
        representado: f.representado,
      });
    }
  }

  // `orden` solo contiene ids ya insertados en `porId` por construcción; el filter
  // sustituye el non-null assertion (`!`) por una guarda real sin cambiar la salida.
  return orden
    .map((id) => porId.get(id))
    .filter((a): a is NonNullable<typeof a> => a !== undefined);
}

/**
 * WIRE DE CHIPS server-side (Plan 92-02, LOB-02/LOB-03, fail-closed DOBLE, Block-B).
 *
 * Dado el conjunto COMPLETO de audiencias, resuelve para cada una la lista de
 * boletines VÁLIDOS que su materia menciona: (1) patrón — `extraerBoletines` sobre
 * `a.materia`; (2) existencia — el boletín DEBE existir en `public.proyecto`. Los que
 * matchean el patrón pero NO existen se DESCARTAN (fail-closed #2 — jamás un chip
 * muerto). `proyecto` NO es PII y ya se lee server-side (Block-B) → la validación vive
 * aquí, nunca en el island. El error real de la query se PROPAGA (return de error) —
 * NUNCA degrada a "sin chips" (#34): eso lo maneja el llamador lanzando.
 *
 * BOUND del `.in()` (MAJOR-5): el set de candidatos = ⋃ extraerBoletines(materia) sobre
 * TODAS las audiencias confirmadas del parlamentario (bounded a cientos por el RPC), ya
 * DEDUPLICADO. Cota superior teórica = (audiencias) × (boletines por materia). Para no
 * asumir que el producto queda bajo el cap de PostgREST (~1000 valores por `.in()`), el
 * lote se PAGINA en trozos de `IN_CHUNK` (< 1000) y se unen los existentes: así el bound
 * por request es SIEMPRE `IN_CHUNK` < 1000, independiente del volumen del parlamentario.
 */
const IN_CHUNK = 500; // < cap PostgREST (~1000) por `.in()` — bound duro por request.

async function resolverBoletinesMencionados(
  sb: ReturnType<typeof createServerSupabase>,
  audiencias: LobbyAudienciaRow[],
): Promise<{ error: string | null }> {
  // 1) Patrón: extraer candidatos por audiencia (memo por audiencia para el paso 3).
  const porAudiencia = new Map<string, string[]>();
  const candidatos = new Set<string>();
  for (const a of audiencias) {
    const bs = extraerBoletines(a.materia);
    porAudiencia.set(a.identificador, bs);
    for (const b of bs) candidatos.add(b);
  }

  // Sin candidatos → nada que validar; cada audiencia queda sin chip (fail-closed).
  if (candidatos.size === 0) {
    for (const a of audiencias) a.boletines_mencionados = [];
    return { error: null };
  }

  // 2) Existencia: UNA query batched por trozo (`in('boletin', chunk)`), bound < 1000.
  const todos = [...candidatos];
  const existentes = new Set<string>();
  for (let i = 0; i < todos.length; i += IN_CHUNK) {
    const chunk = todos.slice(i, i + IN_CHUNK);
    const { data, error } = await sb
      .from("proyecto")
      .select("boletin")
      .in("boletin", chunk);
    if (error) {
      // #34: error real de DB/red — se PROPAGA al llamador (nunca "sin chips").
      return { error: error.message };
    }
    for (const row of (data as { boletin: string }[] | null) ?? []) {
      existentes.add(row.boletin);
    }
  }

  // 3) Adjuntar a cada audiencia SOLO los boletines patrón-Y-existencia (dedupe/orden
  //    los preserva `extraerBoletines`). Los inexistentes se descartan (fail-closed #2).
  for (const a of audiencias) {
    const bs = porAudiencia.get(a.identificador) ?? [];
    a.boletines_mencionados = bs.filter((b) => existentes.has(b));
  }
  return { error: null };
}

// ── Server Component: lee el RPC + el marcador de ingesta y arma la LobbyView ───
export async function LobbySection({
  id,
  searchParams,
  camara,
}: {
  id: string;
  searchParams: { [key: string]: string | string[] | undefined };
  /**
   * B10 — cámara del parlamentario, derivada por el wrapper de page.tsx vía el RPC
   * `parlamentario_publico` (ya allowlisted). Parametriza SOLO el frame/intro; el
   * enlace por fila (fuente real) no depende de esto.
   */
  camara: string | null;
}) {
  const sb = createServerSupabase();

  const single = (k: string): string | undefined => {
    const v = searchParams[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const page = Math.max(1, Number.parseInt(single("lobbyPage") ?? "1", 10) || 1);
  // Toggle server-driven (SC6): normalización fail-safe del searchParam ?vista.
  const vista = normalizarVista(searchParams.vista);

  // Audiencias confirmadas (el RPC solo devuelve confirmadas, orden fecha DESC).
  const { data: rpcData, error: rpcError } = await sb.rpc(
    "lobby_de_parlamentario",
    { p_id: id },
  );
  // #34: error real de DB/red ≠ "sin reuniones". Se lanza para la UI de error honesta.
  if (rpcError) {
    throw new Error(
      `lobby_de_parlamentario falló para ${id}: ${rpcError.message}`,
    );
  }
  const filas = (rpcData as LobbyAudienciaRpcRow[] | null) ?? [];
  const todas = agruparAudiencias(filas);

  // WIRE DE CHIPS (LOB-02/LOB-03): resuelve server-side, sobre el conjunto COMPLETO,
  // los boletines mencionados VÁLIDOS (patrón + existencia) y los adjunta in-place a
  // cada audiencia de `todas` — así fluyen tanto al slice paginado (cronológica) como
  // a los grupos (agrupada). El error real se LANZA (#34); nunca degrada a "sin chips".
  const { error: chipsError } = await resolverBoletinesMencionados(sb, todas);
  if (chipsError) {
    throw new Error(
      `validación de boletines mencionados falló para ${id}: ${chipsError}`,
    );
  }

  // Estado honesto (a) vs (b): la AUSENCIA de fila en lobby_ingesta_estado = "no
  // ingestado todavía"; la presencia (aunque con 0 audiencias) = "ingestado, cero".
  const { data: estadoData, error: estadoError } = await sb
    .from("lobby_ingesta_estado")
    .select("parlamentario_id")
    .eq("parlamentario_id", id)
    .maybeSingle<{ parlamentario_id: string }>();
  if (estadoError) {
    throw new Error(
      `lobby_ingesta_estado falló para ${id}: ${estadoError.message}`,
    );
  }
  const noIngestado = estadoData === null && todas.length === 0;

  // Paginación server-driven sobre el conjunto ya cargado (vista cronológica).
  const totalAudiencias = todas.length;
  const totalPages = Math.max(1, Math.ceil(totalAudiencias / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const start = (pageClamped - 1) * PAGE_SIZE;
  const audiencias = todas.slice(start, start + PAGE_SIZE);

  // Agrupación por contraparte sobre el conjunto COMPLETO (vista agrupada, default).
  const grupos = agruparPorContraparte(todas);

  return (
    <LobbyView
      data={{
        id,
        audiencias,
        grupos,
        totalAudiencias,
        page: pageClamped,
        totalPages,
        vista,
        noIngestado,
        camara,
      }}
    />
  );
}
