import { createServerSupabase } from "@/lib/supabase";
import { fechaCorta } from "@/lib/format";
import { fechaCivilCorta } from "@/lib/dia-calendario";
import { parseEvidenciaProyectos, urgenciaVigentePorBoletin } from "@/lib/panel-evidencia";
import { PanelTileSala } from "@/components/panel-tile-sala";
import { PanelTileComisiones } from "@/components/panel-tile-comisiones";
import { PanelTileUrgencias } from "@/components/panel-tile-urgencias";
import { PanelTileMovimiento } from "@/components/panel-tile-movimiento";
import { PanelTileVotaciones } from "@/components/panel-tile-votaciones";
import { PanelTileIngresos } from "@/components/panel-tile-ingresos";

/**
 * PanelActualidad — orquestador RSC del panel de actualidad de la landing `/`
 * (Phase 100 → rediseño Phase 128, PANEL-02/03/05/07).
 *
 * Server Component puro (RSC, NUNCA "use client"): lee la RPC bounded
 * `actualidad_senales_panel` (0066), agrupa por `tipo_senal` y delega el
 * render a los 6 tiles editoriales `panel-tile-*.tsx` (nombres CONGELADOS por
 * 126, declarados en `SUPERFICIES_PANEL`). CERO agregación on-read (SEN-02
 * LOCKED): la RPC ya devuelve conteo / fecha_max / cobertura_camara; el jsonb
 * `evidencia` trae los sujetos (boletines/títulos/comisiones/sesiones) que
 * este orquestador YA lee (128-01..05) y antes se ignoraba.
 *
 * El tile 5 (Votaciones, L4) es la única excepción: no lee esta RPC, lee
 * `public.votacion` directamente dentro de su propio wrapper async
 * (`panel-tile-votaciones.tsx`) — cero RPC nueva, cero allowlist (D-08).
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ REGLAS DURAS (100-UI-SPEC + 128-RESEARCH — LOCKED)                         │
 * │  A. La barra cívica 3px se OMITE si la cámara es null (nunca se adivina).   │
 * │     Vive en cada tile (`lib/panel-camara.ts`), no aquí.                     │
 * │  B. CONTEO NEUTRO: framing factual, nunca ranking ("top"/"los más"/"la     │
 * │     cámara más activa"); NUNCA reordenar cobertura_camara por conteo       │
 * │     cross-cámara (T-52-13).                                                │
 * │  C. supresion_causa != null → la CAUSA es el cuerpo del tile, VERBATIM;    │
 * │     NUNCA lista vacía, NUNCA "0" mudo, NUNCA "sin movimiento" (SEN-03).     │
 * │  D. Error REAL de lectura → `throw` (#34); NUNCA `?? []` que fabrique       │
 * │     "sin señales". `[]` es SOLO el path legítimo de 0 filas.                │
 * │  E. Cada tile lleva fuente + fecha_max/consultado_al; un dato sin fuente    │
 * │     trazable no se muestra suelto.                                         │
 * │  F. LINKS (PANEL-02, D-03): todo link interno pasa por el helper central   │
 * │     `lib/links-internos.ts` con guard `en_corpus` — un ítem `en_corpus:    │
 * │     false` JAMÁS emite `/proyecto/{b}` (evita el 404 de ficha inexistente); │
 * │     en su lugar, enlace externo trazable a la fuente.                      │
 * │  G. FECHAS de 3 carriles (D-05): el hecho lleva verbo en el cuerpo del tile │
 * │     (idioms de `lib/idioms-panel.ts`, single-source); el footer SOLO dice  │
 * │     "Fuente: {desde dato} · según fuente al {d}"; el molde viejo del      │
 * │     footer queda muerto (cero ocurrencias); `fecha_captura` JAMÁS visible. │
 * │  H. PRESUPUESTO (O-7): 4 ítems por tile + remanente declarado respaldado   │
 * │     por el total real del jsonb (`*_total`), nunca `items.length` a secas. │
 * │  I. `agrupacion_materia` MUERE sin tombstone (O-3): el tile no se monta,   │
 * │     la señal sigue viva en la DB. El ruteo abajo es una LISTA BLANCA       │
 * │     explícita — jamás "lo que llegue" (P8).                               │
 * └───────────────────────────────────────────────────────────────────────────┘
 */

// ── Contrato de datos de la RPC (9 columnas de 0066_actualidad_rpc.sql:32-42) ───
export interface SenalRow {
  tipo_senal: string; // 'velocity'|'nuevos_ingresos'|'urgencias'|'agenda_citacion'|'agenda_sala'|'archivados'|'agrupacion_materia'
  ventana: string | null; // '7d' | '30d' | 'futuras' | null
  conteo: number;
  cobertura_camara: string | null; // 'Cámara de Diputados' | 'Senado' | '(sin cámara)' | '2022-2026 (piso de corpus)' | null
  materia: string | null; // '(sin materia)' tolerado (agrupacion_materia, tile muerto — O-3)
  cluster_id: number | null;
  fecha_max: string | null; // timestamptz ISO
  supresion_causa: string | null; // NULL = activa; texto = suprimida CON causa
  evidencia: Record<string, unknown>; // jsonb (deserializado por supabase-js) — sujetos (128-01..05)
}

// Los tipos de agenda leen `fecha_max` como date-only-midnight-UTC (contrato
// dia-calendario.ts): la parte fecha UTC ES el día chileno. El resto son
// timestamps reales con hora → fechaCorta (conversión de zona correcta).
const TIPOS_AGENDA = new Set(["agenda_citacion", "agenda_sala"]);

// ── Fecha ISO parseable → Date válida, o null (nunca "Invalid Date") ────────────
function fechaValida(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Rótulo de fecha para una señal, respetando el contrato por tipo:
 *   - agenda_* → date-only-midnight-UTC → `fechaCivilCorta` (sin tz shift).
 *   - resto    → timestamp real → `fechaCorta` (es-CL).
 * Devuelve null si la fecha no es parseable (el caller omite el rótulo).
 *
 * F-14: la rama agenda_* devolvía el DÍA CIVIL en formato ISO (`2026-08-10`) y lo
 * rendía tal cual a público general y prensa. Ahora se rinde en es-CL sin tocar el
 * ruteo por tipo.
 *
 * WR-05 (117-REVIEW): UN SOLO formato, CON AÑO, en las dos ramas. Con
 * `badgeFechaCitacion` la rama agenda daba "10-ago" (sin año) y la otra "10 ago 2026"
 * (con año), y ambas señales se listan una junto a otra en el MISMO panel: el
 * ciudadano veía dos convenciones distintas y una sin año. `fechaCivilCorta` es la
 * variante con año del MISMO helper date-only (CR-01), así que el ruteo por tipo
 * sigue haciendo lo único que debe hacer aquí: decidir si se convierte de zona o no.
 *
 * Matiz que PROD aportó (audit §1.3, última fila): TODAS las señales llegan con
 * `fecha_max` a medianoche UTC, no sólo las agenda_* — así que la rama `fechaCorta`
 * también está formateando date-only de facto. Lo que la mantiene correcta es el
 * `timeZone: "UTC"` explícito que 117-01 fijó en `format.ts`, NO el huso del
 * entorno donde corra el proceso. Convertir esa rama a la zona de Chile correría
 * el día hacia atrás.
 */
export function rotuloFecha(tipo: string, iso: string | null): string | null {
  if (!iso) return null;
  if (TIPOS_AGENDA.has(tipo)) {
    // Día publicado por la fuente (parte fecha UTC), sin conversión de zona.
    return fechaCivilCorta(iso);
  }
  const d = fechaValida(iso);
  return d ? fechaCorta(d) : null;
}

// ════════════════════════════════════════════════════════════════════════════
// Ruteo de señales → tiles editoriales (D-01, O-5: sala primero)
// ════════════════════════════════════════════════════════════════════════════

// FILTRO EXPLÍCITO (O-3/P8): `agrupacion_materia` sigue emitiendo 10 filas en
// la DB — el tile murió sin tombstone, la señal NO. El ruteo NO puede ser "lo
// que llegue": esta lista blanca es la única puerta de entrada a un tile.
// Cualquier `tipo_senal` fuera de esta lista (incluida `agrupacion_materia`)
// se descarta en silencio del render, sin descartarse de la DB.
const TIPOS_RENDERIZADOS = new Set([
  "agenda_sala",
  "agenda_citacion",
  "urgencias",
  "velocity",
  "nuevos_ingresos",
  "archivados",
]);

/**
 * Vista PURA del panel: ruteo whitelist + cruce L5 + ORDEN D-01 + spans.
 *
 * WR-04 (129-REVIEW): esto vivía inline en `PanelActualidad` (async, lee Supabase),
 * así que ningún test podía montar el orquestador REAL en jsdom — la suite validaba
 * una RÉPLICA del ruteo escrita a mano en el propio test, y un reordenamiento de los
 * tiles aquí dejaba esa réplica (y su verde) intactos. Extraído a un componente SÍNCRONO
 * para que los tests monten ESTE código y no una copia.
 *
 * `slotVotaciones` existe porque el tile 5 es el único async (lee `public.votacion` en
 * su propio wrapper, D-08): PROD inyecta `<PanelTileVotaciones />` y los tests inyectan
 * su vista pura. Todo lo demás —qué tiles, en qué orden, con qué props— es el código real.
 */
export function PanelActualidadView({
  filas,
  slotVotaciones,
}: {
  filas: SenalRow[];
  slotVotaciones: React.ReactNode;
}) {
  // Agrupa por tipo_senal preservando el orden de llegada (la RPC ya ordena por
  // tipo_senal, cobertura, cluster; NO se reordena por conteo — T-52-13).
  // FILTRO EXPLÍCITO (O-3/P8): fuera de TIPOS_RENDERIZADOS, la fila se ignora.
  const porTipo = new Map<string, SenalRow[]>();
  for (const f of filas) {
    if (!TIPOS_RENDERIZADOS.has(f.tipo_senal)) continue;
    const arr = porTipo.get(f.tipo_senal);
    if (arr) arr.push(f);
    else porTipo.set(f.tipo_senal, [f]);
  }

  const filasSala = porTipo.get("agenda_sala") ?? [];
  const filasComisiones = porTipo.get("agenda_citacion") ?? [];
  const filasUrgencias = porTipo.get("urgencias") ?? [];
  const filasMovimiento = porTipo.get("velocity") ?? [];
  const filasIngresos = porTipo.get("nuevos_ingresos") ?? [];
  const filasArchivados = porTipo.get("archivados") ?? [];

  // CRUCE L5 EN RENDER (O-4): la urgencia MÁS RECIENTE por boletín, derivada de
  // la evidencia de `urgencias` — yuxtaposición de dos hechos fechados, jamás
  // una relación. Alimenta los chips de los tiles 1 (sala) y 2 (comisiones).
  // Es una derivación en render, no una señal nueva ni una RPC nueva (D-08).
  const itemsUrgencias = filasUrgencias.flatMap(
    (f) => parseEvidenciaProyectos(f.evidencia).items,
  );
  const urgenciasVigentes = urgenciaVigentePorBoletin(itemsUrgencias);

  // ORDEN D-01 (O-5: sala PRIMERO): sala → comisiones → urgencias →
  // movimiento → votaciones → ingresos. El tile materia NO se monta.
  return (
    <>
      <PanelTileSala filas={filasSala} urgencias={urgenciasVigentes} />
      <PanelTileComisiones filas={filasComisiones} urgencias={urgenciasVigentes} />
      <PanelTileUrgencias filas={filasUrgencias} />
      <PanelTileMovimiento filas={filasMovimiento} />
      {slotVotaciones}
      <PanelTileIngresos ingresos={filasIngresos} archivados={filasArchivados} />
    </>
  );
}

export async function PanelActualidad() {
  const sb = createServerSupabase();

  const { data, error } = await sb.rpc("actualidad_senales_panel", {
    p_tipo: null,
  });

  // #34: un error real de lectura ≠ "sin señales". Se lanza (NUNCA `?? []`).
  if (error) {
    throw new Error(
      `PanelActualidad: no se pudo leer actualidad_senales_panel: ${error.message}`,
    );
  }

  // `[]` SOLO representa el path legítimo de 0 filas (regla D).
  const filas = (data as SenalRow[] | null) ?? [];

  // Todo el ruteo/orden/cruce L5 vive en la vista pura (WR-04): este wrapper solo
  // hace I/O. El tile 5 (async, lee `public.votacion`) se inyecta como slot.
  return (
    <PanelActualidadView filas={filas} slotVotaciones={<PanelTileVotaciones />} />
  );
}
