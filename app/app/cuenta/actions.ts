"use server";

import { cookies } from "next/headers";

import { notifPublicEnabled } from "@/lib/notif-gate";
import { createUserClient } from "@/lib/supabase-user";
import { BOLETIN_RE, PARLAMENTARIO_ID_RE } from "@/lib/buscar";

import { generarToken } from "../notificaciones/token";

/**
 * Server Actions de /cuenta (NOTIF-01, Phase 103) — login OTP por email +
 * suscribir/desuscribir con sesión de usuario (RLS aplica).
 *
 * AUTH (clonado de spike-auth/actions.ts, LOCKED Phase 97): `enviarOtp` dispara el
 * código de 6 dígitos (GoTrue); `verificarOtp` lo canjea por una sesión escribiendo
 * Set-Cookie vía el adaptador de cookies del contexto. El cliente Supabase es el USER
 * de bajo privilegio (`createUserClient`, publishable key) — NUNCA el service_role.
 *
 * SUSCRIPCIÓN (NOTIF-01, Pitfall 5): `seguir`/`dejarDeSeguir` construyen el mismo
 * cliente user (RLS aplica) y derivan `user_id` de `getClaims()` sub SERVER-SIDE,
 * JAMÁS de la FormData del cliente (un POST puede forjar cualquier user_id; la RLS
 * `with check ((select auth.uid()) = user_id)` es el backstop). La suscripción nace
 * en estado 'pendiente' (doble opt-in: el email de confirmación lo envía el Plan 04);
 * aquí se generan los hashes de token confirm/baja. Al crear una suscripción se
 * registra además un `consentimiento` (base de licitud 21.719).
 *
 * SEGURIDAD (V7, Ley 21.719):
 *   - JAMÁS loguear ni interpolar en errores el email ni el token (WR-02): mensaje
 *     genérico fijo; diagnóstico server-side solo con { status, name }.
 *   - Validación de FORMA/LONGITUD del input ANTES de tocar GoTrue (WR-01).
 *   - Gate fail-closed (CR-01) como PRIMERA sentencia: cada action se rehúsa si
 *     `NOTIF_PUBLIC_ENABLED` != "true". Las server actions son invocables
 *     independientemente del render de la página → NO confían en el gate de page.tsx.
 */

// Validación de email: forma básica + cota de longitud (RFC 5321 = 254).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254;
// OTP de Supabase = 6 dígitos.
const OTP_RE = /^\d{6}$/;

/** Versión del texto de consentimiento informado vigente (21.719 — trazabilidad). */
export const CONSENT_VERSION = "1";
/** Método de captura del consentimiento (doble opt-in por email). */
const CONSENT_METODO = "doble_opt_in_email";

function validarEmail(email: unknown): string {
  if (typeof email !== "string") {
    throw new Error("cuenta: email inválido");
  }
  const limpio = email.trim();
  if (limpio.length === 0 || limpio.length > EMAIL_MAX || !EMAIL_RE.test(limpio)) {
    // NUNCA echar el valor recibido en el mensaje (WR-02).
    throw new Error("cuenta: email inválido");
  }
  return limpio;
}

function validarToken(token: unknown): string {
  if (typeof token !== "string" || !OTP_RE.test(token.trim())) {
    throw new Error("cuenta: código OTP inválido");
  }
  return token.trim();
}

/**
 * Valida el par (tipo, objetivo_id) de una suscripción. `tipo` ∈ {proyecto,
 * parlamentario}; `objetivo_id` con el formato de su tipo (boletín / id parlamentario).
 * NUNCA se interpola el valor en el error (WR-02).
 */
function validarObjetivo(
  tipo: unknown,
  objetivoId: unknown,
): { tipo: "proyecto" | "parlamentario"; objetivoId: string } {
  if (tipo !== "proyecto" && tipo !== "parlamentario") {
    throw new Error("cuenta: tipo de suscripción inválido");
  }
  if (typeof objetivoId !== "string") {
    throw new Error("cuenta: objetivo inválido");
  }
  const limpio = objetivoId.trim();
  const re = tipo === "proyecto" ? BOLETIN_RE : PARLAMENTARIO_ID_RE;
  if (!re.test(limpio)) {
    throw new Error("cuenta: objetivo inválido");
  }
  return { tipo, objetivoId: limpio };
}

/** Construye el cliente user ligado a las cookies del contexto (para Set-Cookie). */
async function clienteConCookies() {
  const cookieStore = await cookies();
  return createUserClient({
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      // En Server Actions `cookies()` es escribible; escribir cada cookie de sesión.
      cookiesToSet.forEach(({ name, value, options }) => {
        cookieStore.set(name, value, options);
      });
    },
  });
}

/**
 * Deriva el `user_id` (sub) de la sesión SERVER-SIDE vía `getClaims()`. Lanza si no
 * hay sesión. NUNCA se lee de la FormData del cliente (Pitfall 5, T-103-08).
 */
async function userIdDeSesion(
  supabase: Awaited<ReturnType<typeof clienteConCookies>>,
): Promise<string> {
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (typeof sub !== "string" || sub.length === 0) {
    throw new Error("cuenta: sin sesión");
  }
  return sub;
}

/**
 * Envía un código OTP de 6 dígitos al email dado. `shouldCreateUser:true` auto-crea
 * la cuenta ciudadana en el primer acceso. Sin redirect por email (si se pasa,
 * Supabase manda un magic LINK en vez de un código numérico).
 */
export async function enviarOtp(email: string): Promise<void> {
  // CR-01: gate fail-closed como PRIMERA sentencia.
  if (!notifPublicEnabled(process.env)) {
    throw new Error("cuenta: deshabilitado");
  }

  // WR-01: validar forma + longitud ANTES de tocar GoTrue.
  const emailValido = validarEmail(email);

  const supabase = await clienteConCookies();
  const { error } = await supabase.auth.signInWithOtp({
    email: emailValido,
    options: { shouldCreateUser: true },
  });
  if (error) {
    // WR-02: NO interpolar el mensaje upstream de GoTrue (puede echar el email o
    // revelar estado de cuenta => enumeración). Diagnóstico solo con campos no-PII.
    console.error("cuenta: signInWithOtp falló", {
      status: (error as { status?: number }).status,
      name: error.name,
    });
    throw new Error("cuenta: no se pudo enviar el código");
  }
}

/**
 * Verifica el código OTP (`type: "email"`) y, si es válido, canjea la sesión — el
 * adaptador de cookies escribe Set-Cookie con `sb-<ref>-auth-token`.
 */
export async function verificarOtp(email: string, token: string): Promise<void> {
  // CR-01: gate fail-closed como PRIMERA sentencia.
  if (!notifPublicEnabled(process.env)) {
    throw new Error("cuenta: deshabilitado");
  }

  // WR-01: validar forma del email y del OTP (6 dígitos) ANTES de tocar GoTrue.
  const emailValido = validarEmail(email);
  const tokenValido = validarToken(token);

  const supabase = await clienteConCookies();
  const { error } = await supabase.auth.verifyOtp({
    email: emailValido,
    token: tokenValido,
    type: "email",
  });
  if (error) {
    // WR-02: NO interpolar email/token ni el mensaje upstream de GoTrue.
    console.error("cuenta: verifyOtp falló", {
      status: (error as { status?: number }).status,
      name: error.name,
    });
    throw new Error("cuenta: no se pudo verificar el código");
  }
}

/** Cierra la sesión del usuario (borra las cookies de sesión vía el adaptador). */
export async function cerrarSesion(): Promise<void> {
  const supabase = await clienteConCookies();
  await supabase.auth.signOut();
}

/**
 * Suscribe al usuario a un objetivo (proyecto/parlamentario) — doble opt-in.
 * `user_id` SIEMPRE del sub de sesión (Pitfall 5), NUNCA de la FormData. Estado inicial
 * 'pendiente'; se generan los hashes de token confirm/baja (el email de confirmación
 * lo envía el Plan 04). Al crear la suscripción se registra el consentimiento (21.719).
 * La RLS `with check ((select auth.uid()) = user_id)` es el backstop del user_id.
 */
export async function seguir(tipo: unknown, objetivoId: unknown): Promise<void> {
  // CR-01: gate fail-closed como PRIMERA sentencia.
  if (!notifPublicEnabled(process.env)) {
    throw new Error("cuenta: deshabilitado");
  }

  const objetivo = validarObjetivo(tipo, objetivoId);
  const supabase = await clienteConCookies();
  const userId = await userIdDeSesion(supabase);

  // Tokens opacos: la DB guarda SOLO el hash; el raw viajará en el email (Plan 04).
  const confirm = generarToken();
  const baja = generarToken();
  // Ventana de confirmación del doble opt-in (48 h).
  const confirmExpiraAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const { error: errSusc } = await supabase.from("suscripcion").insert({
    user_id: userId,
    tipo: objetivo.tipo,
    objetivo_id: objetivo.objetivoId,
    estado: "pendiente",
    confirm_token_hash: confirm.hash,
    baja_token_hash: baja.hash,
    confirm_expira_at: confirmExpiraAt,
  });
  if (errSusc) {
    console.error("cuenta: insert suscripcion falló", {
      code: (errSusc as { code?: string }).code,
      name: (errSusc as { name?: string }).name,
    });
    throw new Error("cuenta: no se pudo completar la acción");
  }

  // Consentimiento (base de licitud 21.719) — append-only, insert-own.
  const { error: errCons } = await supabase.from("consentimiento").insert({
    user_id: userId,
    version_texto: CONSENT_VERSION,
    metodo: CONSENT_METODO,
  });
  if (errCons) {
    console.error("cuenta: insert consentimiento falló", {
      code: (errCons as { code?: string }).code,
      name: (errCons as { name?: string }).name,
    });
    throw new Error("cuenta: no se pudo completar la acción");
  }
}

/**
 * Da de baja una suscripción del usuario. Scoped a lo propio por RLS
 * (`using ((select auth.uid()) = user_id)`) + el filtro por (user_id, tipo,
 * objetivo_id) derivado de la sesión, NUNCA de un id de fila del cliente.
 */
export async function dejarDeSeguir(
  tipo: unknown,
  objetivoId: unknown,
): Promise<void> {
  // CR-01: gate fail-closed como PRIMERA sentencia.
  if (!notifPublicEnabled(process.env)) {
    throw new Error("cuenta: deshabilitado");
  }

  const objetivo = validarObjetivo(tipo, objetivoId);
  const supabase = await clienteConCookies();
  const userId = await userIdDeSesion(supabase);

  const { error } = await supabase
    .from("suscripcion")
    .delete()
    .eq("user_id", userId)
    .eq("tipo", objetivo.tipo)
    .eq("objetivo_id", objetivo.objetivoId);
  if (error) {
    console.error("cuenta: delete suscripcion falló", {
      code: (error as { code?: string }).code,
      name: (error as { name?: string }).name,
    });
    throw new Error("cuenta: no se pudo completar la acción");
  }
}
