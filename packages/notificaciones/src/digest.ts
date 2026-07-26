// @obs/notificaciones — MOTOR del digest diario (NOTIF-03/04).
//
// ██████ PATRÓN EGRESO — NO es la ingesta de dos etapas ██████
// Este paquete es el INVERSO de la ingesta. NO hay fuente que respetar, NO hay crudo
// en R2, NO hay rate-limit 2-3s/host, NO hay robots.txt: el destinatario es Resend
// (un servicio de correo), no un WAF gubernamental. La regla de DOS ETAPAS de CLAUDE.md
// (Fuentes→R2→Supabase) NO aplica — no se descarga nada, se EMITE. La ÚNICA cota es el
// hard-cap 100/día (código, Pitfall 3) + la redacción de PII (email) en TODO log (Pitfall 4).
// El email NUNCA se escribe a R2 ni a CI. Cf. 103-04-SUMMARY §"EGRESO vs dos-etapas".
//
// ── IDEMPOTENCIA POR CURSOR (Pattern 5 + precedente 0053) ─────────────────────────
// Cada (usuario, suscripción) tiene un cursor `ultimo_evento_visto` = el mayor
// `tramitacion_evento.id` ya incluido en un digest ENVIADO. `computeNovedades` solo
// devuelve eventos con `id > cursor`. El cursor avanza (a `nuevoCursor(novedades)`)
// ATÓMICAMENTE SOLO tras un envío exitoso; si el envío falla el cursor NO avanza y el
// próximo run re-intenta el mismo tramo (entrega al-menos-una-vez SIN duplicar contenido).
// Re-correr el digest sobre un tramo ya enviado ⇒ CERO novedades (idempotente).
//
// ── RESOLUCIÓN DE NOVEDADES POR TIPO (schema real 0008 + 0051) ────────────────────
//   proyecto      → tramitacion_evento WHERE boletin = objetivo_id AND id > cursor.
//   parlamentario → proyecto_autor WHERE parlamentario_id = objetivo_id
//                     AND estado_vinculo = 'confirmado' (FAIL-CLOSED: no_confirmado/NULL
//                     JAMÁS aportan) → set de boletines; LUEGO tramitacion_evento
//                     WHERE boletin = ANY(boletines) AND id > cursor.
// Cada ítem es FACTUAL (fuente+fecha+enlace directo de la fila) — CERO síntesis LLM.

import { createHmac } from "node:crypto";

// ── TOKEN OPACO DERIVADO (CR-01/CR-02, Phase 103) ─────────────────────────────────
// El link de baja del email lleva el token CRUDO; la DB guarda SOLO su hash. Para que el
// CRON pueda reproducir el crudo en el momento del envío SIN persistirlo, el token se
// DERIVA de forma determinista: raw = base64url(HMAC-SHA256(secret, `${purpose}:${id}`)).
// Debe ser BYTE-IDÉNTICO al derivador de app/app/notificaciones/token.ts (deriveToken) —
// misma fórmula HMAC-SHA256/base64url — para que hashToken(raw) === baja_token_hash de la
// fila. El secreto vive solo en el entorno (NOTIF_TOKEN_SECRET); una filtración de la DB
// NO permite forjar tokens (hace falta el secreto + el hash no es reversible).

/** Propósito del token derivado (namespacea confirm vs baja de la misma suscripción). */
export type TokenPurpose = "confirm" | "baja";

/**
 * Deriva el token opaco CRUDO (base64url) para el link del email, de forma DETERMINISTA a
 * partir del secreto de servidor + el id de la suscripción. Reproduce el mismo `raw` que
 * `deriveToken` de la app generó al suscribir (mismo HMAC-SHA256) → hashToken(raw) casa con
 * `*_token_hash` guardado. Fail-loud si falta el secreto (sin él el link sería inservible).
 */
export function deriveRawToken(
  secret: string,
  purpose: TokenPurpose,
  suscripcionId: string,
): string {
  if (!secret) {
    throw new Error(
      "deriveRawToken: falta NOTIF_TOKEN_SECRET. Sin él el link de baja del email no " +
        "puede derivarse (hashToken(raw) no casaría con baja_token_hash).",
    );
  }
  return createHmac("sha256", secret).update(`${purpose}:${suscripcionId}`).digest("base64url");
}

/** Cliente Supabase mínimo que este motor necesita (real o fake en tests). */
export interface DbLike {
  from(table: string): QueryLike;
}

/** Builder encadenable mínimo (subconjunto de PostgREST usado aquí). */
export interface QueryLike {
  select(cols: string): QueryLike;
  eq(col: string, val: string): QueryLike;
  in(col: string, vals: string[]): QueryLike;
  gt(col: string, val: number): QueryLike;
  order(col: string, opts?: { ascending?: boolean }): QueryLike;
  range(from: number, to: number): Promise<{ data: unknown[] | null; error: { message: string } | null }>;
}

export interface Suscripcion {
  tipo: "proyecto" | "parlamentario";
  objetivo_id: string;
}

/** Fila de novedad factual (columnas REALES de tramitacion_evento — 0008). */
export interface NovedadEvento {
  id: number;
  boletin: string;
  fecha: string | null;
  tipo: string;
  descripcion: string | null;
  enlace: string | null;
  origen: string;
}

/** Página bajo el cap de PostgREST (1000) — mismo idiom que @obs/actualidad. */
const PAGE_SIZE = 1000;

/** Cap DURO de envíos por día (Resend free tier). Pitfall 3. */
export const HARD_CAP_DIARIO = 100;

/**
 * Redacta un email para logs/CI (Pitfall 4, disciplina WR-02). NUNCA devuelve el valor
 * crudo: conserva la primera letra del local-part y el dominio, hashea el resto. Si el
 * input no parece un email, redacta por completo. El email JAMÁS aparece crudo en un log.
 */
export function redactEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0 || at === email.length - 1) return "<REDACTED>";
  const local = email.slice(0, at);
  const dominio = email.slice(at + 1);
  const inicial = local[0] ?? "";
  return `${inicial}***@${dominio}`;
}

/** El mayor id de la lista de novedades = nuevo cursor (avanza SOLO en envío exitoso). */
export function nuevoCursor(novedades: NovedadEvento[], cursorActual: number): number {
  let max = cursorActual;
  for (const n of novedades) if (n.id > max) max = n.id;
  return max;
}

/** Mapea una fila cruda de PostgREST a NovedadEvento (columnas reales 0008). */
function aNovedad(r: Record<string, unknown>): NovedadEvento | null {
  const id = typeof r.id === "number" ? r.id : Number(r.id);
  const boletin = typeof r.boletin === "string" ? r.boletin : null;
  if (!Number.isFinite(id) || !boletin) return null;
  return {
    id,
    boletin,
    fecha: typeof r.fecha === "string" ? r.fecha : null,
    tipo: typeof r.tipo === "string" ? r.tipo : "",
    descripcion: typeof r.descripcion === "string" ? r.descripcion : null,
    enlace: typeof r.enlace === "string" ? r.enlace : null,
    origen: typeof r.origen === "string" ? r.origen : "",
  };
}

/** Lee tramitacion_evento (boletines ⊆ los dados) con id > cursor, paginado y ordenado por id. */
async function eventosDeBoletines(
  db: DbLike,
  boletines: string[],
  cursor: number,
): Promise<NovedadEvento[]> {
  if (boletines.length === 0) return [];
  const out: NovedadEvento[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await db
      .from("tramitacion_evento")
      .select("id,boletin,fecha,tipo,descripcion,enlace,origen")
      .in("boletin", boletines)
      .gt("id", cursor)
      .order("id", { ascending: true })
      .range(from, to);
    if (error) throw new Error(`computeNovedades: tramitacion_evento: ${error.message}`);
    const page = (data as Record<string, unknown>[] | null) ?? [];
    for (const r of page) {
      const n = aNovedad(r);
      if (n) out.push(n);
    }
    if (page.length < PAGE_SIZE) break;
  }
  return out;
}

/**
 * Resuelve las novedades de UNA suscripción con id > cursor (idempotente).
 *   - proyecto: eventos del boletín objetivo.
 *   - parlamentario: eventos de los boletines que el parlamentario AUTORÓ con
 *     estado_vinculo='confirmado' (fail-closed: no_confirmado/NULL aportan CERO).
 * Devuelve la lista ordenada por id (el mayor id = el nuevo cursor tras enviar).
 */
export async function computeNovedades(
  suscripcion: Suscripcion,
  cursor: number,
  db: DbLike,
): Promise<NovedadEvento[]> {
  if (suscripcion.tipo === "proyecto") {
    return eventosDeBoletines(db, [suscripcion.objetivo_id], cursor);
  }

  // parlamentario: PRIMERO resolver boletines autorados CONFIRMADO (fail-closed).
  const boletines = new Set<string>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await db
      .from("proyecto_autor")
      .select("boletin")
      .eq("parlamentario_id", suscripcion.objetivo_id)
      .eq("estado_vinculo", "confirmado") // NUNCA no_confirmado/NULL (T-103-21)
      .order("boletin", { ascending: true })
      .range(from, to);
    if (error) throw new Error(`computeNovedades: proyecto_autor: ${error.message}`);
    const page = (data as Record<string, unknown>[] | null) ?? [];
    for (const r of page) {
      if (typeof r.boletin === "string") boletines.add(r.boletin);
    }
    if (page.length < PAGE_SIZE) break;
  }
  if (boletines.size === 0) return []; // sin autorías confirmadas ⇒ CERO novedades
  return eventosDeBoletines(db, Array.from(boletines), cursor);
}

/** Un usuario pendiente de digest (para el cap). */
export interface PendingUser {
  user_id: string;
  suscripcion_id: string;
  cursor: number;
}

/**
 * WR-03: filtra los usuarios cuyo digest tendría CONTENIDO — al menos un grupo con
 * `novedades.length > 0`. Un usuario cuyos TODOS los grupos están vacíos NO recibe correo
 * (no se quema slot del hard-cap 100/día en un mail sin novedades ni se daña la reputación
 * anti-spam). Se aplica ANTES de `enforceCap` para que los usuarios con novedades reales
 * tengan prioridad sobre los vacíos. Genérico sobre `{ grupos: { nov: unknown[] }[] }`.
 */
export function filtrarConNovedades<
  T extends { grupos: { nov: NovedadEvento[] }[] },
>(usuarios: T[]): T[] {
  return usuarios.filter((u) => u.grupos.some((g) => g.nov.length > 0));
}

/**
 * Aplica el cap DURO 100/día: devuelve los primeros `cap` usuarios a enviar y deja el
 * RESTO en cola (`diferidos`) con su cursor SIN avanzar → quedan para el próximo run
 * (degrade honesto, nunca se pierden — Pitfall 3 / T-103-14).
 */
export function enforceCap<T>(
  pendingUsers: T[],
  cap: number = HARD_CAP_DIARIO,
): { aEnviar: T[]; diferidos: T[] } {
  if (pendingUsers.length <= cap) return { aEnviar: pendingUsers, diferidos: [] };
  return { aEnviar: pendingUsers.slice(0, cap), diferidos: pendingUsers.slice(cap) };
}

/**
 * Nota honesta cuando una suscripción no tiene novedades: JAMÁS silencio. Declara la
 * fecha de las fuentes consultadas (UI-SPEC S5 "no-news note"). Sin afirmar que "no pasó
 * nada", solo que no hay novedades REGISTRADAS al corte.
 */
export function notaSinNovedades(fecha: string): string {
  return `Sin novedades registradas hoy para lo que sigues, según las fuentes consultadas al ${fecha}.`;
}
