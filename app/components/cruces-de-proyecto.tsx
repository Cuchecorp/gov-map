import { createServerSupabase } from "@/lib/supabase";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { IdentityMarker } from "@/components/identity-marker";
import { DetalleColapsable } from "@/components/detalle-colapsable";
import { fechaCortaSegura, formatNombre } from "@/lib/format";
import {
  sourceLabel,
  type CruceProyectoRow,
  type CruceEvidenciaItem,
} from "@/lib/types";

/**
 * Sección CRUCES de la ficha del PROYECTO (Phase 38, SURF-02). Superficie factual
 * que yuxtapone, en la ficha de un proyecto, los parlamentarios que registran un
 * voto A FAVOR del boletín con sus reuniones de lobby EN EL SECTOR del proyecto,
 * con provenance inline por evidencia. Consume el RPC `cruces_de_proyecto(p_boletin)`
 * (contrato 38-01, `CruceProyectoRow`). Hereda la gramática visual de F55 verbatim
 * (cero tokens/deps nuevos).
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ GATE DE CONTENIDO (DESIGN-SYSTEM §9.1, 38-UI-SPEC §Anti-insinuación) —       │
 * │ riesgo existencial #1                                                        │
 * │                                                                             │
 * │ 1. CARRIL AISLADO: vive en su propio `<section id="cruces" class="mt-12">`; │
 * │    un voto y una señal de lobby JAMÁS comparten un <article>/<li>/<tr>. La  │
 * │    línea "Votó a favor" y el conteo de reuniones son líneas SEPARADAS,      │
 * │    nunca una frase causal.                                                   │
 * │ 2. CERO CAUSALIDAD/AFINIDAD: prohibido "a cambio de", "antes de votar",     │
 * │    "cercano a", "vinculado a", "afinidad", "porque", "influencia".          │
 * │ 3. CONTEO NEUTRO: el `{N}` es un hecho observable en Mono, sin ranking /     │
 * │    score / "los más …" / porcentaje-como-veredicto.                        │
 * │ 4. CAVEAT anti-causal EXACTAMENTE 1× por render (texto LOCKED).             │
 * │ 5. IDENTIDAD (DEPARTURE LOCKED 38-UI-SPEC): el SUJETO es el parlamentario   │
 * │    PÚBLICO → su nombre es un ENLACE a /parlamentario/[id] (proyección       │
 * │    PII-safe, nunca partido/rut). La CONTRAPARTE de lobby (tercero privado), │
 * │    si aparece en la evidencia, sigue TEXTO PLANO + IdentityMarker (52-03).  │
 * │ 6. PROVENANCE por evidencia (FND-08): enlace_fuente por item; capturedAt =  │
 * │    fecha_captura del cruce (nivel señal, WR-02), NO item.fecha.             │
 * │ 7. Un vacío es un HECHO, no una virtud: NUNCA "limpio/transparente".        │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * `CrucesView` es PURA (props) → RTL la testea con fixtures, sin runtime
 * Supabase/Next. `CrucesSection` es el Server Component que lee el RPC. NO hay
 * `"use client"` en este archivo.
 *
 * DEGRADE HONESTO (LOAD-BEARING, 38-UI-SPEC §Degrade honesto): la migración 0049 se
 * aplica a PROD sólo en el checkpoint de operador (Plan 03). El build debe renderizar
 * con la RPC ausente sin 500 y sin fabricar una banda vacía. Tres caminos distintos
 * (espejo EXACTO de `lobby-en-tramitacion.tsx:248-276`, NO el de cruces-de-parlamentario):
 *   1. función ausente (PGRST202, el código PostgREST de function-not-found — SOLO
 *      ese código; un fallback por regex de mensaje tragaría errores REALES de
 *      schema como "column ... does not exist", WR-01) → return null.
 *   2. RPC presente, 0 filas → h2 + caveat + empty honesto.
 *   3. cualquier otro error real de DB/red → throw (#34).
 */

// Caveat anti-causal LOCKED (reutilizado verbatim de CrucesCapa1). Aparece
// EXACTAMENTE 1× por render de la sección (sign-off condición 1).
const CAVEAT_CRUCES =
  "La coincidencia temporal no implica relación entre la reunión y el voto.";

/**
 * Encabezado factual LOCKED por parlamentario. Conteo NEUTRO + etiqueta del sector,
 * sin verbo causal / score / afinidad / ranking. Para `tipo_senal` desconocido
 * (futuro) degrada honesto: conteo neutro + etiqueta SIN verbo de reunión fabricado.
 */
function encabezadoReuniones(row: CruceProyectoRow): string {
  if (row.tipo_senal === "lobby_sector") {
    return `${row.conteo} ${
      row.conteo === 1 ? "reunión" : "reuniones"
    } con gestores del sector ${row.sector_etiqueta}`;
  }
  // Degradación honesta: conteo neutro + etiqueta, sin fabricar un verbo de hecho.
  return `${row.conteo} ${
    row.conteo === 1 ? "registro" : "registros"
  } en el sector ${row.sector_etiqueta}`;
}

// ── Una contraparte cruda (tercero privado): TEXTO PLANO + IdentityMarker, NUNCA
//    enlace, NUNCA RUT. La regla 52-03 gobierna las CONTRAPARTES; el parlamentario
//    sujeto sí se enlaza (DEPARTURE LOCKED). ────────────────────────────────────
function ContraparteCruda({ nombre }: { nombre: string }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
      <span className="text-sm">{formatNombre(nombre)}</span>
      <IdentityMarker />
    </span>
  );
}

// ── Grupo por parlamentario: nombre ENLACE + línea de voto SEPARADA + conteo neutro
//    de reuniones + lista de evidencia con provenance. NUNCA es un <article>/<li>
//    que componga voto+reunión: son líneas factuales lado a lado (§9.1 regla 1). ──
function GrupoParlamentario({ row }: { row: CruceProyectoRow }) {
  return (
    <div className="space-y-3">
      {/* Nombre del parlamentario PÚBLICO = ENLACE a su ficha (DEPARTURE LOCKED
          38-UI-SPEC): el sujeto es enlazable, a diferencia de la contraparte de
          lobby. `formatNombre` sólo re-casea el string RENDERIZADO; la React key
          en el llamador conserva el id estable. */}
      <a
        href={`/parlamentario/${row.parlamentario_id}`}
        className="inline-flex min-h-11 items-center text-base underline underline-offset-4 text-accent-product"
      >
        {formatNombre(row.nombre_normalizado)}
      </a>

      {/* Línea de voto FACTUAL, SEPARADA — nunca compuesta con la reunión en una
          frase causal (§9.1 regla 1; dossier 17 §2). */}
      <p className="text-sm">Votó a favor de este proyecto</p>

      {/* Encabezado factual: conteo NEUTRO (único agregado permitido) + etiqueta. */}
      <h3 className="text-base font-medium">{encabezadoReuniones(row)}</h3>

      <ul className="space-y-4">
        {row.evidencia.items.map((item: CruceEvidenciaItem, idx: number) => (
          <li
            // El materializador (0039) emite UN item por (audiencia × contraparte):
            // una audiencia con N contrapartes en el mismo sector produce N items
            // con el MISMO audiencia_id → la clave DEBE incluir el índice, o React
            // colapsaría filas con clave duplicada y SOLTARÍA silenciosamente una
            // contraparte de la evidencia (violación FND-08).
            key={`${row.sector_id}-${item.audiencia_id}-${idx}`}
            className="flex flex-wrap items-start gap-x-3 gap-y-2 py-3 border-t first:border-t-0"
          >
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              {/* Contraparte (tercero privado): TEXTO PLANO + IdentityMarker, sin
                  enlace, sin RUT (52-03 intacta). */}
              <span>
                <span className="text-sm text-muted-foreground">
                  Contraparte:{" "}
                </span>
                <ContraparteCruda nombre={item.contraparte_nombre_crudo} />
              </span>
              {/* Fecha de la REUNIÓN como texto FACTUAL plano (§9.1-safe): sin
                  verbo causal, no es frescura del dato (esa va en el badge). Si la
                  fuente no publica la fecha, se omite la línea (honest-state). */}
              {item.fecha && (
                <span className="font-mono text-xs text-muted-foreground">
                  Reunión registrada el {fechaCortaSegura(item.fecha)}
                </span>
              )}
            </div>

            {/* ProvenanceBadge por evidencia (FND-08). capturedAt = row.fecha_captura
                (frescura del rebuild del cruce, nivel señal — WR-02/F41), NO item.fecha. */}
            <span className="ml-auto">
              <ProvenanceBadge
                capturedAt={new Date(row.fecha_captura)}
                sourceName={sourceLabel("lobby")}
                sourceUrl={item.enlace_fuente}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Vista pura (RTL la testea con fixtures) ────────────────────────────────────
export function CrucesView({ rows }: { rows: CruceProyectoRow[] }) {
  const n = rows.length;

  // Conteo 3-estado honesto (Mono, tabular-nums): "{N} parlamentarios" cuando N>0,
  // "sin registros" cuando 0. El estado "—" (sin ingesta) NUNCA llega aquí: es el
  // degrade→null del Server Component (RPC ausente).
  const conteoLabel =
    n > 0 ? `${n} ${n === 1 ? "parlamentario" : "parlamentarios"}` : "sin registros";

  // El h2 vive DENTRO del componente (no en la page) para que el degrade honesto
  // path-1 (Section → null) NO deje un heading huérfano sin marco: nodo ausente.
  // ÚNICA superficie de la sección con petróleo (marco 1.5px + h2 en petróleo).
  const heading = (
    <h2 className="flex items-center gap-2 text-lg font-semibold text-accent-product">
      <span>Cruces con el sector del proyecto</span>
      <span className="ml-auto font-mono text-sm font-normal tabular-nums text-muted-foreground">
        {conteoLabel}
      </span>
    </h2>
  );

  // Intro factual LOCKED (38-UI-SPEC §Copywriting) — el frame ANTES de todo detalle.
  const intro = (
    <p className="text-sm text-muted-foreground">
      Parlamentarios que registran un voto a favor de este proyecto y, por
      separado, audiencias de lobby registradas en el sector del proyecto. Cada
      hecho se muestra tal como lo publica la fuente oficial; el enlace de cada
      evidencia apunta al registro original. Un cruce solo yuxtapone hechos
      fechados; no afirma intención ni causa.
    </p>
  );

  // Caveat anti-causal — ÚNICO (1×) por render (sign-off condición 1).
  const caveat = <p className="text-xs text-muted-foreground">{CAVEAT_CRUCES}</p>;

  // Empty honesto — la RPC respondió con 0 filas. NUNCA se lee como "limpio" ni
  // "transparente"; heading + caveat se mantienen (marco petróleo persiste).
  if (n === 0) {
    return (
      <div className="rounded-lg border-[1.5px] border-accent-product bg-card p-4 space-y-3">
        {heading}
        {intro}
        <p className="text-sm text-muted-foreground">
          Aún no se registran parlamentarios con cruces en el sector de este
          proyecto en las fuentes consultadas.
        </p>
        {caveat}
      </div>
    );
  }

  // Capa-1 = marco petróleo (h2 + intro + caveat) SIEMPRE visible; las filas por
  // parlamentario van DENTRO del DetalleColapsable primary (disclosure inverso,
  // arranca colapsado). Datos YA fetcheados por el Server Component: NO hay
  // lazy-fetch (espejo del patrón /parlamentario/[id] page.tsx:362-382).
  return (
    <div className="rounded-lg border-[1.5px] border-accent-product bg-card p-4 space-y-3">
      {heading}
      {intro}
      {caveat}
      <DetalleColapsable
        n={n}
        triggerVariant="primary"
        triggerLabel={`Explorar los ${n} cruces`}
      >
        <div className="space-y-6">
          {rows.map((row) => (
            <GrupoParlamentario
              key={`${row.parlamentario_id}-${row.sector_id}`}
              row={row}
            />
          ))}
        </div>
      </DetalleColapsable>
    </div>
  );
}

// ── Server Component: lee el RPC y degrada honesto de 3 caminos ─────────────────
export async function CrucesSection({ boletin }: { boletin: string }) {
  const sb = createServerSupabase();

  const { data, error } = await sb.rpc("cruces_de_proyecto", {
    p_boletin: boletin,
  });

  // Camino 1: la función NO existe (PGRST202 = function-not-found de PostgREST).
  // SOLO ese código exacto → nodo AUSENTE del HTML (null), sin 500. NO se usa un
  // fallback por regex de mensaje: "column ... does not exist" / "relation ...
  // does not exist" son errores REALES de schema que deben ir al camino 3 (throw),
  // no ocultar la sección en silencio (WR-01, degrade-honesto).
  if (error?.code === "PGRST202") {
    return null;
  }

  // Camino 3: un error real de DB/red ≠ "sin cruces". Se lanza para la UI de error
  // honesta (#34); NUNCA se degrada a empty (falsa exoneración). Sin blanket-catch:
  // sólo el código específico de función-ausente cae al camino 1.
  if (error) {
    throw new Error(
      `cruces_de_proyecto falló para ${boletin}: ${error.message}`,
    );
  }

  // Camino 2: data (incluye 0 filas → empty honesto dentro de la vista).
  const rows = (data as CruceProyectoRow[] | null) ?? [];
  return <CrucesView rows={rows} />;
}
