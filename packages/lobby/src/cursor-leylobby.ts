// cursor-leylobby — lógica PURA del cursor incremental de leylobby (DEBT-02).
//
// El conector leylobby YA tenía hash-check R2 por-recurso (ingest-run.ts: `existed` → [skip] sin
// novedades), pero la CLI fijaba `año=actual, página=1` en cada corrida (ingest-cli.ts:141-143) →
// nunca avanzaba al histórico y desperdiciaba requests contra un servidor volátil (Laravel/Azure,
// 403/503). Este módulo aporta el AVANCE determinista del cursor (qué recurso pedir la próxima
// corrida); la persistencia durable vive en la tabla marcador `leylobby_cursor_estado` (0053) y el
// hash-check R2 decide si ese recurso trae novedades. Cursor y hash-check son complementarios.
//
// TODO aquí es PURO (sin red ni DB) para ser testeable en unidad. Regla de diseño clave
// (Pitfall 4 / T-74-02): el avance persiste DESPUÉS de una corrida EXITOSA, y una corrida que
// degrada (leylobby bloqueada 403/503 → `degradaciones` sin audiencias) NO avanza el cursor —
// `avanzarCursor(..., { huboDatos: false })` devuelve el MISMO cursor sin modificar. Esto evita
// (a) saltarse páginas marcando cobertura falsa y (b) loops infinitos, y respeta la degradación
// honesta de `ingest-run.ts`.

import type { TareaInstitucion } from "./ingest-run";

/** Estado del cursor: hasta qué (año, página) llegó una institución. */
export interface CursorLeylobby {
  institucionCodigo: string;
  /** Año del listado de audiencias alcanzado (se recorre el histórico hacia atrás). */
  anio: number;
  /** Página (1-based) alcanzada dentro del año. */
  pagina: number;
}

/** Año mínimo del histórico de leylobby (la ley de lobby rige desde 2015). */
export const ANIO_MIN_LEYLOBBY = 2015;

/**
 * Tope de páginas por año en una corrida acotada. Al alcanzarlo, el cursor retrocede a `anio-1`.
 * Valor conservador: leylobby lista pocas páginas por institución/año; sobrestimar sólo alarga el
 * barrido, nunca pierde datos (el hash-check R2 hace [skip] de las páginas ya vistas).
 */
export const PAGINA_MAX_DEFAULT = 10;

export interface AvanzarOpts {
  /**
   * true si la corrida obtuvo datos para el recurso apuntado por el cursor. Cuando false
   * (degradación 403/503 o histórico agotado), el cursor NO avanza (Pitfall 4 / T-74-02).
   */
  huboDatos: boolean;
  /** Tope de páginas por año antes de retroceder a anio-1 (default PAGINA_MAX_DEFAULT). */
  paginaMax?: number;
  /** Año mínimo del histórico; no se retrocede por debajo (default ANIO_MIN_LEYLOBBY). */
  anioMin?: number;
}

/**
 * Avanza el cursor de forma determinista e idempotente:
 *   - `huboDatos===false` → devuelve el MISMO cursor sin modificar (degradación/agotado NO avanza).
 *   - dentro de un año, mientras `pagina < paginaMax` → `pagina+1`.
 *   - al alcanzar `paginaMax` → retrocede a `anio-1, pagina=1` (histórico hacia atrás).
 *   - al agotar el histórico (`anio<=anioMin` y `pagina>=paginaMax`) → se queda quieto (no baja de
 *     `anioMin`, evita loop); una vez ahí, sólo el hash-check R2 decidirá si hay novedades.
 *
 * Devuelve SIEMPRE un objeto nuevo; nunca muta el cursor de entrada.
 */
export function avanzarCursor(cursor: CursorLeylobby, opts: AvanzarOpts): CursorLeylobby {
  if (!opts.huboDatos) {
    // Degradación honesta o histórico agotado: NO avanza (devuelve una copia byte-idéntica).
    return { ...cursor };
  }
  const paginaMax = opts.paginaMax ?? PAGINA_MAX_DEFAULT;
  const anioMin = opts.anioMin ?? ANIO_MIN_LEYLOBBY;

  if (cursor.pagina < paginaMax) {
    return { ...cursor, pagina: cursor.pagina + 1 };
  }
  // Agotó las páginas del año → retrocede en el histórico, salvo que ya esté en anioMin.
  if (cursor.anio > anioMin) {
    return { institucionCodigo: cursor.institucionCodigo, anio: cursor.anio - 1, pagina: 1 };
  }
  // Histórico agotado (anio<=anioMin, pagina>=paginaMax): permanece quieto (no loop, no bajar).
  return { ...cursor };
}

/** Deriva la TareaInstitucion determinista (una sola página) para la próxima corrida. */
export function deriveTarea(cursor: CursorLeylobby): TareaInstitucion {
  return {
    institucionCodigo: cursor.institucionCodigo,
    year: cursor.anio,
    pages: [cursor.pagina],
  };
}

/**
 * Cursor de la primera corrida (sin fila previa en `leylobby_cursor_estado`): arranca en
 * (año actual, página 1) — el default histórico de la CLI, ahora persistible.
 */
export function cursorInicial(institucionCodigo: string): CursorLeylobby {
  return { institucionCodigo, anio: new Date().getFullYear(), pagina: 1 };
}
