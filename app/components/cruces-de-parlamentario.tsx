import { createServerSupabase } from "@/lib/supabase";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { IdentityMarker } from "@/components/identity-marker";
import { fechaCorta, formatNombre } from "@/lib/format";
import {
  sourceLabel,
  type CruceSenalRpcRow,
  type CruceEvidenciaItem,
} from "@/lib/types";

/**
 * Sección CRUCES de la ficha del parlamentario (Phase 37, SURF-01). Superficie
 * factual de cruces parlamentario↔sector con provenance inline por evidencia.
 * Espejo directo de `lobby-de-parlamentario.tsx` adaptado a la forma agregada del
 * RPC `cruces_de_parlamentario` (0040): filas por (sector, tipo_senal) con un
 * `evidencia.items[]` crudo en vez de audiencias paginadas.
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ GATE DE CONTENIDO (DESIGN-SYSTEM §9.1, RELEASE GATE) — riesgo existencial #1 │
 * │                                                                             │
 * │ 1. CARRIL AISLADO: esta sección NUNCA referencia, compone ni enlaza un voto │
 * │    / boletín / proyecto / declaración. Una señal de cruce y un voto JAMÁS    │
 * │    comparten un <article>/<Card>/<li>. Vive en su propio `<section          │
 * │    id="cruces">` separado por mt-12.                                         │
 * │ 2. CERO CAUSALIDAD: prohibido "se reunió para", "a cambio de", "antes de     │
 * │    votar", "que resultó en".                                                │
 * │ 3. CERO AFINIDAD/RELACIÓN: "cercano a", "vinculado a", "aliado de".         │
 * │ 4. CERO score / índice / ranking / flag / "conflicto de interés". El CONTEO  │
 * │    NEUTRO de hechos es el único agregado permitido.                         │
 * │ 5. CERO adjetivo de juicio: "polémico", "influyente", "sospechoso".         │
 * │ 6. Incertidumbre de identidad = exactamente "identidad no verificada".      │
 * │ 7. PRIVACIDAD DE TERCERO ABSOLUTA: NUNCA un RUT de contraparte. El nombre    │
 * │    es CRUDO (D-10), nunca normalizado, NUNCA enlazado.                      │
 * │ 8. PROVENANCE obligatoria por evidencia (FND-08): enlace_fuente por item.   │
 * │ 9. Un vacío es un HECHO, no una virtud: NUNCA "limpio/transparente".        │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * `CrucesView` es PURO (props) → RTL lo testea con fixtures, sin runtime
 * Supabase/Next. `CrucesSection` es el Server Component que lee el RPC. NO hay
 * `"use client"` en este archivo. La sección NO se enciende: el path del RPC es
 * inalcanzable en prod hasta Phase 39 (gate OFF + RPC sin grant a anon).
 */

// ── Datos que la vista necesita (forma pura, testeable) ────────────────────────
export interface CrucesViewData {
  id: string;
  /** señales del RPC (orden conteo DESC, sector ASC), todas — sin paginación. */
  cruces: CruceSenalRpcRow[];
}

// ── Una contraparte cruda (texto), NUNCA enlace, + marca de identidad ──────────
function ContraparteCruda({ nombre }: { nombre: string }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
      {/* Nombre CRUDO (D-10) de la fuente; formatNombre solo re-casea el string
          RENDERIZADO (passthrough si ya trae mayúscula). IdentityMarker intacto. */}
      <span className="text-base">{formatNombre(nombre)}</span>
      {/*
        La contraparte NUNCA está confirmada (el RPC no emite contraparte_id ni
        estado_vinculo) → siempre texto crudo + IdentityMarker, JAMÁS un enlace.
      */}
      <IdentityMarker />
    </span>
  );
}

/**
 * Encabezado factual LOCKED por señal. Conteo NEUTRO + etiqueta del sector, sin
 * verbo causal / score / afinidad / ranking. Para `tipo_senal` desconocido (futuro)
 * degrada honesto: conteo neutro + etiqueta SIN verbo de reunión fabricado.
 */
function encabezadoSenal(s: CruceSenalRpcRow): string {
  if (s.tipo_senal === "lobby_sector") {
    return `${s.conteo} ${
      s.conteo === 1 ? "reunión" : "reuniones"
    } con gestores del sector ${s.sector_etiqueta}`;
  }
  // Degradación honesta: conteo neutro + etiqueta, sin fabricar un verbo de hecho.
  return `${s.conteo} ${
    s.conteo === 1 ? "registro" : "registros"
  } en el sector ${s.sector_etiqueta}`;
}

// ── Vista pura (RTL la testea con fixtures) ────────────────────────────────────
export function CrucesView({ data }: { data: CrucesViewData }) {
  const { cruces } = data;

  // ── Línea de intro honesta — el frame ANTES de cualquier señal ───────────────
  const intro = (
    <p className="text-sm text-muted-foreground mb-4">
      Cruces de sector construidos a partir de las audiencias registradas bajo la
      Ley del Lobby (Ley 20.730). Cada hecho se muestra tal como lo publica la
      fuente oficial; el enlace de cada evidencia apunta al registro original.
    </p>
  );

  // Empty honesto — cero cruces. NUNCA se lee como "limpio" ni "transparente".
  if (cruces.length === 0) {
    return (
      <>
        {intro}
        <p className="text-sm text-muted-foreground">
          No se registran cruces de sector para este parlamentario con los datos
          actuales. La cobertura de la Ley del Lobby se sigue incorporando.
        </p>
      </>
    );
  }

  return (
    <div className="space-y-8">
      {intro}

      {cruces.map((s) => (
        <div key={`${s.sector_id}-${s.tipo_senal}`}>
          {/* Encabezado factual: conteo NEUTRO (único agregado) + etiqueta. */}
          <h3 className="text-base font-medium mb-3">{encabezadoSenal(s)}</h3>

          <ul className="space-y-4">
            {s.evidencia.items.map((item: CruceEvidenciaItem, idx: number) => (
              <li
                // El materializador (0039) emite UN item por (audiencia × contraparte):
                // una audiencia con N contrapartes en el mismo sector produce N items
                // con el MISMO audiencia_id → la clave DEBE incluir el índice, o React
                // colapsaría filas con clave duplicada y SOLTARÍA silenciosamente una
                // contraparte de la evidencia (violación FND-08). El índice basta porque
                // la lista es estática (SSR, sin reordenamiento).
                key={`${s.sector_id}-${item.audiencia_id}-${idx}`}
                className="flex flex-wrap items-start gap-x-3 gap-y-2 py-3 border-t first:border-t-0"
              >
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  {/* Contraparte: TEXTO CRUDO + IdentityMarker, sin enlace, sin RUT. */}
                  <span>
                    <span className="text-sm text-muted-foreground">
                      Contraparte:{" "}
                    </span>
                    <ContraparteCruda nombre={item.contraparte_nombre_crudo} />
                  </span>
                  {/*
                    Fecha de la REUNIÓN como texto FACTUAL plano (§9.1-safe): sin
                    verbo causal, no es frescura del dato (esa va en el badge). Si la
                    fuente no publica la fecha, se omite la línea (honest-state).
                  */}
                  {item.fecha && (
                    <span className="text-xs text-muted-foreground">
                      Reunión registrada el {fechaCorta(new Date(item.fecha))}
                    </span>
                  )}
                </div>

                {/*
                  ProvenanceBadge por evidencia (FND-08). capturedAt = s.fecha_captura
                  (fecha de materialización del cruce, nivel señal — proyectada por 0041,
                  CRUCEN-01), NO item.fecha. Mata el stale-amber falso del WR-02 (la fecha
                  de la reunión es antigua y marcaba amber sobre una fecha de evento).
                  Nota de honestidad (R6): el badge refleja la frescura del REBUILD del
                  pipeline (fecha_captura = now() en el FULL REBUILD diario, cron '23 3 * * *'),
                  no la frescura de la fuente/reunión. Si el cron se pausa, todos los badges
                  envejecen a amber juntos — señal honesta.
                */}
                <span className="ml-auto">
                  <ProvenanceBadge
                    capturedAt={new Date(s.fecha_captura)}
                    sourceName={sourceLabel("lobby")}
                    sourceUrl={item.enlace_fuente}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ── Server Component: lee el RPC y arma la CrucesView ───────────────────────────
export async function CrucesSection({ id }: { id: string }) {
  const sb = createServerSupabase();

  const { data, error } = await sb.rpc("cruces_de_parlamentario", { p_id: id });
  // #34: error real de DB/red ≠ "sin cruces". Se lanza para la UI de error honesta;
  // NUNCA se degrada a empty (eso sería una falsa exoneración).
  if (error) {
    throw new Error(
      `cruces_de_parlamentario falló para ${id}: ${error.message}`,
    );
  }

  const cruces = (data as CruceSenalRpcRow[] | null) ?? [];

  return <CrucesView data={{ id, cruces }} />;
}
