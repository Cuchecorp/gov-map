// descubrimiento-boletines — DESCUBRIMIENTO acotado de boletines NUEVOS del año en curso para el
// cron diario de tramitación (NLB).
//
// PROBLEMA que resuelve: el set de refresh del cron es `agenda ∪ proyecto` — un proyecto de ley
// recién ingresado que nunca pasó por una citación capturada NO existe para la plataforma (caso
// testigo: 18.464-14). Este módulo agrega el diff "enumerado del año en curso menos corpus".
//
// PRESUPUESTO DE RED (a) — el descubrimiento agrega COMO MÁXIMO 2 requests extra por corrida: las
// dos ops internas de `CamaraConnector.enumerarProyectosXAnno` (retornarMocionesXAnno +
// retornarMensajesXAnno) para UN solo año, el actual. Nada más.
//
// PRESUPUESTO EN DRY-RUN (b) — ese presupuesto de 2 requests TAMBIÉN se gasta en `--dry-run` CON
// credenciales. Es coherente con el diseño existente del CLI: "el dry-run ejercita el gather + el
// fetch a las fuentes, solo se salta la escritura". No es una fuga: es la misma cota de 2 requests.
//
// POLÍTICA LOCKED (c) — el rate-limit 2–3s/host, robots.txt, UA identificatorio y la allowlist
// SSRF YA viven DENTRO de `CamaraConnector.fetch`. Aquí NO se hand-rollea ninguna de ellas: se
// invoca el connector y punto. Cualquier reimplementación local sería una regresión de la regla.
//
// COLA NATURAL (d) — los nuevos que NO caben en el `cap` de la corrida no se pierden: tras la
// primera ingesta los descubiertos YA existen en `proyecto`, así que la rotación round-robin
// (DEBT-04) los absorbe en corridas siguientes. El cap acota el pico, no la cobertura.
//
// DEGRADACIÓN HONESTA: si el WS falla, `descubrirNuevosDelAnno` devuelve [] y loguea
// `[WARN] descubrimiento omitido: <causa>`. JAMÁS relanza — la corrida del cron sigue con su set
// normal (un WS caído no puede tumbar el refresh del corpus ya conocido).

import { Fetcher, HostRateLimiter, RobotsGuard } from "@obs/ingest";
import { CamaraConnector } from "./connector-camara";

/**
 * Filtro de boletín bien formado `NNNNN-NN`. Literal COPIADO de `run-enumerar-historico-cli`
 * (no importado): ese archivo es un entrypoint one-shot de operador que no se toca.
 */
const BOLETIN_RE = /^\d{3,6}-\d{1,3}$/;

/** Cota dura de boletines nuevos incorporados por corrida (el resto lo absorbe la rotación). */
export const CAP_DESCUBRIMIENTO = 20;

/**
 * Sub-conjunto ESTRUCTURAL del connector que el descubrimiento necesita. Tiparlo así (en vez de
 * depender de la clase) permite que los tests inyecten un espía sin tocar la red.
 */
export interface ConectorDescubrimiento {
  enumerarProyectosXAnno(anno: number): Promise<string[]>;
}

/**
 * Ensambla el connector REAL con los colaboradores de @obs/ingest (política LOCKED: SSRF
 * allowlist → robots → rate-limit 2-3s → UA). Espejo VERBATIM del ensamblado de
 * `run-enumerar-historico-cli.ts`. Se exporta para que el CLI la inyecte y los tests la sustituyan.
 */
export function crearConectorDescubrimiento(): ConectorDescubrimiento {
  return new CamaraConnector({
    fetcher: new Fetcher(),
    rateLimiter: new HostRateLimiter(),
    robots: new RobotsGuard({ allowlist: {} }),
  });
}

/** Parte numérica de un boletín `NNNNN-NN` → [base, sufijo]. Solo para ordenar por recencia. */
function partes(boletin: string): [number, number] {
  const [base, sufijo] = boletin.split("-");
  return [Number(base), Number(sufijo)];
}

export interface SeleccionarNuevosInput {
  /** Boletines enumerados del WS (crudos, posiblemente con basura/duplicados). */
  enumerados: string[];
  /** Corpus ya presente en `proyecto` (lo que NO es nuevo). */
  corpus: string[];
  /** Cota dura de la selección. */
  cap: number;
}

/**
 * Diff PURO: enumerados bien formados y deduplicados, MENOS lo ya presente en `corpus`
 * (comparación por string exacto tras `trim`), ordenados por RECENCIA (número de boletín
 * descendente; desempate por sufijo descendente) y recortados a `cap`.
 */
export function seleccionarNuevos(input: SeleccionarNuevosInput): string[] {
  const { enumerados, corpus, cap } = input;

  const yaEsta = new Set<string>();
  for (const b of corpus) {
    if (typeof b === "string") yaEsta.add(b.trim());
  }

  const vistos = new Set<string>();
  const nuevos: string[] = [];
  for (const crudo of enumerados) {
    if (typeof crudo !== "string") continue;
    const b = crudo.trim();
    if (!BOLETIN_RE.test(b)) continue;
    if (yaEsta.has(b) || vistos.has(b)) continue;
    vistos.add(b);
    nuevos.push(b);
  }

  nuevos.sort((a, b) => {
    const [baseA, sufA] = partes(a);
    const [baseB, sufB] = partes(b);
    return baseB - baseA || sufB - sufA;
  });

  return nuevos.slice(0, Math.max(0, cap));
}

export interface IntercalarInput {
  /** Ventana ya seleccionada por la rotación (pedida con `limite - nuevos.length`). */
  seleccion: string[];
  /** Boletines de agenda (prioridad absoluta: actividad reciente). */
  agenda: string[];
  /** Boletines nuevos descubiertos. */
  nuevos: string[];
  /** Presupuesto total de la ventana final. */
  limite: number;
}

/**
 * Compone la ventana FINAL: `dedupe([...agendaPresenteEnSeleccion, ...nuevos, ...restoDeSeleccion])`
 * recortado a `limite`. Con `nuevos` vacío el resultado es IDÉNTICO a `seleccion` (el orden de la
 * rotación se preserva: la agenda ya venía primero desde `seleccionarRotado`).
 */
export function intercalarDescubrimiento(input: IntercalarInput): string[] {
  const { seleccion, agenda, nuevos, limite } = input;

  const enAgenda = new Set(agenda);
  const deAgenda = seleccion.filter((b) => enAgenda.has(b));
  const resto = seleccion.filter((b) => !enAgenda.has(b));

  const out: string[] = [];
  const vistos = new Set<string>();
  for (const b of [...deAgenda, ...nuevos, ...resto]) {
    if (vistos.has(b)) continue;
    vistos.add(b);
    out.push(b);
  }
  return out.slice(0, Math.max(0, limite));
}

export interface DescubrirInput {
  conector: ConectorDescubrimiento;
  anno: number;
  corpus: string[];
  cap: number;
  log: (m: string) => void;
}

/**
 * Llama `enumerarProyectosXAnno(anno)` UNA vez (= 2 requests internos, ver cabecera) y aplica
 * `seleccionarNuevos`. Ante CUALQUIER fallo degrada a `[]` con `[WARN] descubrimiento omitido:
 * <causa>` — nunca relanza: el cron sigue con su set normal.
 */
export async function descubrirNuevosDelAnno(
  input: DescubrirInput,
): Promise<string[]> {
  const { conector, anno, corpus, cap, log } = input;
  let enumerados: string[];
  try {
    enumerados = await conector.enumerarProyectosXAnno(anno);
  } catch (e) {
    log(`[WARN] descubrimiento omitido: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
  return seleccionarNuevos({ enumerados, corpus, cap });
}
