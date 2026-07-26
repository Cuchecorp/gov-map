import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Helper service_role DEDICADO para la búsqueda login-less de suscripciones por token
 * opaco (NOTIF-04, Phase 103) — confirmación de doble opt-in + baja one-click.
 *
 * SEPARADO POR DISEÑO de `app/lib/supabase.ts` (el chokepoint service_role público del
 * sitio). El lockdown-guard PROHÍBE `.from('suscripcion')` desde `app/lib/supabase.ts`
 * (Block D/E), y TOLERA explícitamente ESTE módulo vía la allowlist `NOTIF_SERVICE_TS`:
 * es el ÚNICO punto de acceso service_role a las tablas de-usuario fuera del carril de
 * sesión de usuario (`createUserClient` + RLS). Mantenerlo en un módulo aparte evita que
 * un refactor filtre acceso a tablas de-usuario al chokepoint PII (RESEARCH §Pattern 6 +
 * T-103-22).
 *
 * MODELO DE AUTORIZACIÓN: el token opaco ES la autorización. No hay sesión. El link del
 * email lleva el token CRUDO; aquí se busca por su HASH sha256 (el crudo nunca toca la
 * DB). service_role BYPASSA RLS a propósito — porque la capacidad la porta el token, no
 * un `auth.uid()`. La búsqueda es por igualdad de hash contra `confirm_token_hash` /
 * `baja_token_hash` (256 bits de aleatoriedad → no enumerable, T-103-10).
 *
 * `import "server-only"` (línea 1) garantiza que la service key jamás viaje al bundle
 * del navegador.
 *
 * Variables de entorno requeridas (fail-loud si faltan): SUPABASE_URL + SUPABASE_SECRET_KEY.
 */

export interface Suscripcion {
  id: string;
  user_id: string;
  tipo: "proyecto" | "parlamentario";
  objetivo_id: string;
  estado: "pendiente" | "confirmada" | "baja";
  confirm_token_hash: string | null;
  baja_token_hash: string | null;
  confirm_expira_at: string | null;
  created_at: string;
}

/** Columnas seleccionadas en las búsquedas por token (sin exponer el hash del otro token). */
const SELECT_COLS =
  "id, user_id, tipo, objetivo_id, estado, confirm_token_hash, baja_token_hash, confirm_expira_at, created_at";

/**
 * Construye el cliente service_role dedicado (SUPABASE_SECRET_KEY, RLS bypass). Separado
 * de `createServerSupabase` de `app/lib/supabase.ts` a propósito (ver JSDoc del módulo).
 */
function clienteServicio(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en el entorno del servidor. " +
        "El helper notif-service (búsqueda de suscripción por token opaco) requiere la " +
        "service key (sb_secret_...). Configúralas con los valores del proyecto Supabase.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Busca la suscripción por el hash del token de CONFIRMACIÓN (doble opt-in). */
export async function buscarSuscripcionPorConfirmToken(
  hash: string,
): Promise<Suscripcion | null> {
  const sb = clienteServicio();
  const { data, error } = await sb
    .from("suscripcion")
    .select(SELECT_COLS)
    .eq("confirm_token_hash", hash)
    .maybeSingle<Suscripcion>();
  // #34: un error real de DB/red ≠ "token inválido". Se lanza (la página muestra su
  // error honesto), jamás se degrada a "no encontrado" a partir de un fallo.
  if (error) {
    throw new Error(`buscarSuscripcionPorConfirmToken falló: ${error.message}`);
  }
  return data ?? null;
}

/** Busca la suscripción por el hash del token de BAJA (unsubscribe one-click). */
export async function buscarSuscripcionPorBajaToken(
  hash: string,
): Promise<Suscripcion | null> {
  const sb = clienteServicio();
  const { data, error } = await sb
    .from("suscripcion")
    .select(SELECT_COLS)
    .eq("baja_token_hash", hash)
    .maybeSingle<Suscripcion>();
  if (error) {
    throw new Error(`buscarSuscripcionPorBajaToken falló: ${error.message}`);
  }
  return data ?? null;
}

/**
 * Marca la suscripción como confirmada (doble opt-in completado).
 *
 * WR-02: la ventana de confirmación se re-valida EN EL WRITE, no solo en la página. El
 * update filtra `confirm_expira_at > now()` (o NULL = sin ventana) → un token expirado NO
 * confirma AUNQUE el caller omita el chequeo. Así la invariante "estado='confirmada'
 * implica que ocurrió una confirmación VIGENTE" se sostiene server-side sin importar quién
 * llame (la página, un RPC futuro, un script). Se devuelve si hubo o no confirmación real
 * para que el caller distinga "confirmado" de "token vencido → copy de inválido".
 */
export async function marcarConfirmada(id: string): Promise<boolean> {
  const sb = clienteServicio();
  const ahora = new Date().toISOString();
  const { data, error } = await sb
    .from("suscripcion")
    .update({ estado: "confirmada" })
    .eq("id", id)
    // Ventana vigente O sin ventana (NULL). `or` de PostgREST: gt|is.
    .or(`confirm_expira_at.gt.${ahora},confirm_expira_at.is.null`)
    .select("id");
  if (error) {
    throw new Error(`marcarConfirmada falló: ${error.message}`);
  }
  // Sin filas afectadas ⇒ la ventana estaba vencida (o la fila no existe) → NO se confirmó.
  return Array.isArray(data) && data.length > 0;
}

/**
 * Da de baja (unsubscribe one-click, 21.719) BORRANDO la fila.
 *
 * WR-01: se BORRA (no se flipea `estado='baja'`) para ALINEAR con la baja de UI
 * (`dejarDeSeguir` en cuenta/actions.ts, que hace DELETE). Antes esta ruta dejaba la fila
 * con `estado='baja'` y, como la tabla tiene `unique (user_id, tipo, objetivo_id)`, un
 * re-seguir posterior chocaba con esa fila superviviente (el INSERT de `seguir` fallaba con
 * el error genérico) mientras la UI mostraba al usuario como "no siguiendo" — botón vivo
 * pero permanentemente roto. Borrar deja ambas rutas de baja en UNA sola representación
 * ("baja = fila ausente"), así el re-seguir es siempre un INSERT limpio con id/token nuevos.
 * El FK de notificacion_envio es `on delete cascade` → el cursor de envío se limpia con la
 * baja (el re-seguir arranca de cero, correcto).
 */
export async function marcarBaja(id: string): Promise<void> {
  const sb = clienteServicio();
  const { error } = await sb
    .from("suscripcion")
    .delete()
    .eq("id", id);
  if (error) {
    throw new Error(`marcarBaja falló: ${error.message}`);
  }
}

/**
 * Baja A NIVEL USUARIO del digest (CR-03, unsubscribe one-click 21.719): BORRA TODAS las
 * suscripciones del usuario.
 *
 * El digest es UN correo por usuario que agrega TODAS sus suscripciones confirmadas, y el
 * footer/`List-Unsubscribe` header llevan UN solo token (el de baja por-usuario). Un click
 * DEBE detener el correo entero — no una sola de N suscripciones (la baja por-fila dejaba las
 * demás vivas y el próximo digest seguía llegando). Aquí se borran TODAS las filas del user;
 * el FK de notificacion_envio es `on delete cascade` → los cursores de envío se limpian. El
 * `userId` viene de un token de baja por-usuario ya VERIFICADO por firma HMAC (la landing lo
 * valida antes de llamar aquí); service_role bypassa RLS a propósito (la capacidad la porta el
 * token verificado, no un auth.uid()). Devuelve cuántas filas se borraron (0 = ya sin
 * suscripciones = igual OK: el usuario queda sin digest).
 */
export async function marcarBajaUsuario(userId: string): Promise<number> {
  const sb = clienteServicio();
  const { data, error } = await sb
    .from("suscripcion")
    .delete()
    .eq("user_id", userId)
    .select("id");
  if (error) {
    throw new Error(`marcarBajaUsuario falló: ${error.message}`);
  }
  return Array.isArray(data) ? data.length : 0;
}
