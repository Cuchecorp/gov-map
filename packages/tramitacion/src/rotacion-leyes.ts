// rotacion-leyes — selección round-robin PURA + lectura paginada del corpus para el cron
// leyes-weekly (DEBT-04).
//
// Dos piezas, ambas testeables SIN red:
//   1. `leerCorpusPaginado`  — lee el corpus COMPLETO vía `.order('boletin').range()` paginado
//                              (espeja packages/fichas/src/writer-supabase.ts:124-143). Resuelve
//                              el cap ~1000 de PostgREST: sin `.range()`, `.select()` recortaba a
//                              ~1000 de 3.657 filas (bug 1k-cap oculto).
//   2. `seleccionarRotado`   — dada la agenda (prioridad), el corpus completo, un `offset` y un
//                              `limite`, arma la ventana de la semana: agenda PRIMERO, luego la
//                              COLA (corpus menos agenda) empezando en `offset` con WRAP-AROUND
//                              circular. Devuelve `nuevoOffset` para persistir → sucesivas
//                              corridas cubren rebanadas DISTINTAS round-robin, garantizando que
//                              TODA la cola se recorre a lo largo de las semanas (ningún proyecto
//                              queda indefinidamente sin refrescar) sin cambiar la cadencia.
//
// fail-loud PRESERVADO: un error de lectura LANZA (no devuelve []) para que el cron salga != 0
// visible en vez de un no-op verde silencioso (T-74-06). Solo se propaga `error.message` de
// PostgREST — nunca la service key ni la URL con password (T-74-08).
//
// MONEY/SERVEL EXCLUIDOS por construcción: este módulo solo opera sobre `proyecto`/
// `citacion_punto`/`sesion_tabla_item` (tramitación de leyes). NO referencia ninguna tabla de
// dinero ni de padrón electoral — el test lo afirma por grep de esos nombres de tabla.

/** Filtro de boletín bien formado `NNNNN-NN` (espeja BOLETIN_RE del CLI). */
const BOLETIN_RE = /^\d{3,6}-\d{1,3}$/;

/** Tamaño de página de PostgREST (cap ~1000). Espeja el PAGE de fichas/writer-supabase. */
const PAGE = 1000;

/**
 * Sub-conjunto ESTRUCTURAL del cliente supabase-js que `leerCorpusPaginado` necesita:
 * `.from(tabla).select('boletin').order('boletin', {ascending}).range(from, to)`.
 * Se tipa estructuralmente para no acoplar el módulo puro al tipo genérico-profundo del SDK
 * (el CLI hace el cast al invocar).
 */
export interface ClienteCorpus {
  from(tabla: string): {
    select(cols: string): {
      order(
        columna: string,
        opts: { ascending: boolean },
      ): {
        range(
          from: number,
          to: number,
        ): PromiseLike<{
          data: Array<{ boletin: string | null }> | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
}

/**
 * Lee TODOS los boletines de `tabla` paginando con `.order('boletin').range()` (WR-01: orden
 * estable → páginas deterministas). Resuelve el cap 1k. LANZA ante `error` (fail-loud), con
 * solo `error.message`.
 */
export async function leerCorpusPaginado(
  cliente: ClienteCorpus,
  tabla: string,
): Promise<string[]> {
  const todos: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await cliente
      .from(tabla)
      .select("boletin")
      // WR-01: orden estable por la clave natural → páginas deterministas entre requests HTTP
      // independientes (sin ORDER BY PostgREST no garantiza orden → filas saltadas/duplicadas
      // ante writes concurrentes). Con orden estable el paginado a >1k es correcto y reproducible.
      .order("boletin", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`leerCorpusPaginado (${tabla}) falló: ${error.message}`);
    const filas = (data ?? []) as Array<{ boletin: string | null }>;
    for (const f of filas) {
      if (typeof f.boletin === "string") todos.push(f.boletin);
    }
    if (filas.length < PAGE) break;
  }
  return todos;
}

/**
 * Avanza el offset de rotación de forma circular: `(offset + n) mod tamañoCola`. Nunca devuelve
 * un valor ≥ tamañoCola; con cola vacía devuelve 0 (sin división por cero).
 */
export function avanzarOffset(
  offset: number,
  n: number,
  tamañoCola: number,
): number {
  if (tamañoCola <= 0) return 0;
  return (offset + n) % tamañoCola;
}

export interface SeleccionRotadaInput {
  /** Boletines de agenda (actividad reciente) — PRIORIDAD absoluta. */
  agenda: string[];
  /** Corpus completo (todos los `proyecto.boletin`) ya paginado. */
  corpus: string[];
  /** Offset de rotación actual sobre la COLA (corpus menos agenda). */
  offset: number;
  /** Presupuesto total de la ventana (agenda + cola). */
  limite: number;
}

export interface SeleccionRotadaResult {
  /** Ventana de la semana: agenda dedup + rebanada rotada de la cola, recortada a `limite`. */
  seleccion: string[];
  /** Nuevo offset a persistir (mod tamaño de la cola). */
  nuevoOffset: number;
}

/**
 * Selección PURA de la ventana de la semana:
 *   1. Agenda PRIMERO (dedup, respeta BOLETIN_RE) — prioridad de actividad reciente.
 *   2. COLA = corpus menos los boletines ya cubiertos por agenda (sin gastar doble presupuesto).
 *   3. Toma `limite - agenda.length` de la cola empezando en `offset`, con WRAP-AROUND circular
 *      → round-robin: sucesivas corridas cubren rebanadas distintas hasta recorrer toda la cola.
 *   4. `nuevoOffset = (offset + tomadosDeCola) mod cola.length` para persistir.
 *
 * No hace red — el llamador provee agenda y corpus ya leídos. No lanza por cola vacía
 * (offset → 0). Preserva la exclusión MONEY/SERVEL (opera solo sobre los boletines dados).
 */
export function seleccionarRotado(input: SeleccionRotadaInput): SeleccionRotadaResult {
  const { agenda, corpus, offset, limite } = input;

  // 1. Agenda dedup + bien formada (idiom `push` del CLI: Set de vistos + orden preservado).
  const vistos = new Set<string>();
  const agendaLimpia: string[] = [];
  for (const b of agenda) {
    if (BOLETIN_RE.test(b) && !vistos.has(b)) {
      vistos.add(b);
      agendaLimpia.push(b);
    }
  }

  // 2. Cola = corpus (bien formado, dedup) MENOS lo ya cubierto por agenda.
  const cola: string[] = [];
  const enCola = new Set<string>();
  for (const b of corpus) {
    if (BOLETIN_RE.test(b) && !vistos.has(b) && !enCola.has(b)) {
      enCola.add(b);
      cola.push(b);
    }
  }

  const seleccion = [...agendaLimpia];
  const presupuestoCola = Math.max(0, limite - agendaLimpia.length);

  if (cola.length === 0 || presupuestoCola === 0) {
    return {
      seleccion: seleccion.slice(0, limite),
      nuevoOffset: avanzarOffset(offset, 0, cola.length),
    };
  }

  // 3. Rebanada rotada de la cola desde `offset` con wrap-around circular.
  const inicio = ((offset % cola.length) + cola.length) % cola.length;
  const tomar = Math.min(presupuestoCola, cola.length);
  for (let i = 0; i < tomar; i++) {
    seleccion.push(cola[(inicio + i) % cola.length]!);
  }

  // 4. Nuevo offset (mod cola.length).
  return {
    seleccion: seleccion.slice(0, limite),
    nuevoOffset: avanzarOffset(inicio, tomar, cola.length),
  };
}
