import Link from "next/link";

import { createServerSupabase } from "@/lib/supabase";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { IdentityMarker } from "@/components/identity-marker";
import { fechaCorta } from "@/lib/format";
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
 * │ 2. CERO CAUSALIDAD: prohibido "se reunió para", "a cambio de", "antes de    │
 * │    votar", "que resultó en".                                                │
 * │ 3. CERO AFINIDAD/RELACIÓN sobre la contraparte: "cercano a", "vinculado a", │
 * │    "aliado de", "su lobista", "lobista habitual", "se reúne más seguido".   │
 * │ 4. CERO score / índice / ranking / flag: sin "lobby influence score", sin   │
 * │    "conflicto de interés", sin leaderboard de contrapartes. Un conteo NEUTRO │
 * │    de reuniones es el único agregado permitido.                             │
 * │ 5. CERO adjetivo de juicio: "polémico", "influyente", "oscuro",             │
 * │    "controversial", "sospechoso".                                           │
 * │ 6. Incertidumbre de identidad = exactamente "identidad no verificada".      │
 * │ 7. PRIVACIDAD DE TERCERO ABSOLUTA: NUNCA un RUT de contraparte ni campo      │
 * │    interno; el RPC `lobby_de_parlamentario` no emite `contraparte_id`.      │
 * │ 8. PROVENANCE obligatoria por fila; si se desconoce → "fuente desconocida". │
 * │ 9. Un vacío es un HECHO, no una virtud: "no ingestado" ≠ "ingestado, cero". │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * `LobbyView` es PURO (props) → RTL lo testea con fixtures, sin runtime
 * Supabase/Next. `LobbySection` es el Server Component que lee el RPC y el
 * marcador de ingesta. NO hay `"use client"` en este archivo.
 */

const PAGE_SIZE = 20;

// ── Datos que la vista necesita (forma pura, testeable) ────────────────────────
export interface LobbyViewData {
  id: string;
  /** audiencias de la página actual (ya paginadas), orden fecha DESC. */
  audiencias: LobbyAudienciaRow[];
  /** total de audiencias confirmadas (para "Página N de M" y el conteo neutro). */
  totalAudiencias: number;
  page: number;
  totalPages: number;
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

/** Construye un href de paginación preservando el resto de la query. */
function buildHref(id: string, page: number): string {
  const qs = new URLSearchParams({ lobbyPage: String(page) }).toString();
  return `/parlamentario/${id}?${qs}#lobby`;
}

// ── Una contraparte cruda (texto + tipo + representado), NUNCA enlace, +marca ──
function ContraparteCruda({ c }: { c: LobbyContraparteRow }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
      {/* Nombre VERBATIM de la fuente. */}
      <span className="text-base">{c.contraparte_nombre}</span>
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
        P11: la contraparte NUNCA está confirmada (el RPC no emite contraparte_id
        ni estado_vinculo) → siempre texto crudo + IdentityMarker, JAMÁS un enlace
        (nunca un enlace muerto a una sub-maestra inexistente). §3.2.
      */}
      <IdentityMarker />
    </span>
  );
}

// ── Vista pura (RTL la testea con fixtures) ────────────────────────────────────
export function LobbyView({ data }: { data: LobbyViewData }) {
  const { id, audiencias, totalAudiencias, page, totalPages, noIngestado } = data;

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
      </>
    );
  }

  // Estado (c) — con audiencias.
  return (
    <div>
      {intro}

      {/* Conteo NEUTRO (único agregado permitido §3.4) — sin score, sin ranking. */}
      <p className="text-sm text-muted-foreground mb-4">
        {totalAudiencias}{" "}
        {totalAudiencias === 1
          ? "reunión registrada"
          : "reuniones registradas"}
        .
      </p>

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
                {/* Contraparte(s): TEXTO CRUDO + IdentityMarker, sin enlace, sin RUT. */}
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

                {/* Asunto/materia verbatim, opcional (nunca fabricado/resumido). */}
                {a.materia && (
                  <span className="text-sm">
                    <span className="text-muted-foreground">Asunto: </span>
                    {a.materia}
                  </span>
                )}
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
              href={buildHref(id, page - 1)}
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
              href={buildHref(id, page + 1)}
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

  const rawPage = Array.isArray(searchParams.lobbyPage)
    ? searchParams.lobbyPage[0]
    : searchParams.lobbyPage;
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);

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

  // Paginación server-driven sobre el conjunto ya cargado.
  const totalAudiencias = todas.length;
  const totalPages = Math.max(1, Math.ceil(totalAudiencias / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const start = (pageClamped - 1) * PAGE_SIZE;
  const audiencias = todas.slice(start, start + PAGE_SIZE);

  return (
    <LobbyView
      data={{
        id,
        audiencias,
        totalAudiencias,
        page: pageClamped,
        totalPages,
        noIngestado,
        camara,
      }}
    />
  );
}
