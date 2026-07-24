"use server";

import { cookies } from "next/headers";

import { spikeAuthEnabled } from "@/lib/spike-auth-gate";
import { createUserClient } from "@/lib/supabase-user";

/**
 * Server actions del SPIKE auth-on-Workers (Phase 97) — flujo OTP por email.
 *
 * `enviarOtp` dispara el código de 6 dígitos (GoTrue, SMTP interno de Supabase);
 * `verificarOtp` lo canjea por una sesión y escribe Set-Cookie a través del adaptador
 * de cookies del contexto. El cliente Supabase es el USER de bajo privilegio
 * (`createUserClient`, publishable key) ligado a las cookies de la request/response —
 * NUNCA el service_role, NUNCA una tabla PII vía `.from()`, NUNCA un `.rpc()` (OTP va
 * por `supabase.auth.*`, fuera del policing del lockdown-guard).
 *
 * SEGURIDAD (V7, Ley 21.719):
 *   - JAMÁS loguear ni interpolar en mensajes de error el email ni el token.
 *   - JAMÁS interpolar el mensaje de error de GoTrue (puede echar el email o revelar
 *     estado de cuenta => enumeración): se devuelve un mensaje fijo genérico (WR-02).
 *   - Validación de FORMA y LONGITUD del input ANTES de la llamada (WR-01): los
 *     `<input type="email">` del cliente son triviales de saltar (las server actions
 *     aceptan cualquier POST body).
 *   - Gate fail-closed (CR-01): cada action se rehúsa si `SPIKE_AUTH_ENABLED` != "true".
 *     Las server actions son invocables de forma independiente del render de la página,
 *     así que NO pueden confiar en el gate de `page.tsx`.
 *   - Emails de prueba = SOLO direcciones del propio operador.
 */

// Validación de email: forma básica + cota de longitud (RFC 5321 = 254). NO usa zod (no
// está en el workspace `app`); un regex acotado basta para rechazar no-emails y strings
// enormes antes de tocar GoTrue.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254;
// OTP de Supabase = 6 dígitos.
const OTP_RE = /^\d{6}$/;

function validarEmail(email: unknown): string {
  if (typeof email !== "string") {
    throw new Error("spike-auth: email inválido");
  }
  const limpio = email.trim();
  if (limpio.length === 0 || limpio.length > EMAIL_MAX || !EMAIL_RE.test(limpio)) {
    // NUNCA echar el valor recibido en el mensaje (WR-02).
    throw new Error("spike-auth: email inválido");
  }
  return limpio;
}

function validarToken(token: unknown): string {
  if (typeof token !== "string" || !OTP_RE.test(token.trim())) {
    throw new Error("spike-auth: código OTP inválido");
  }
  return token.trim();
}

/** Construye el cliente user ligado a las cookies del contexto (para escribir Set-Cookie). */
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
 * Envía un código OTP de 6 dígitos al email dado. SIN opción de redirect por email (si
 * se pasa, Supabase manda un magic LINK en vez de un código numérico). `shouldCreateUser:true`
 * auto-crea el usuario de prueba del operador.
 */
export async function enviarOtp(email: string): Promise<void> {
  // CR-01: gate fail-closed como PRIMERA sentencia (independiente del gate de la página).
  if (!spikeAuthEnabled(process.env)) {
    throw new Error("spike-auth: deshabilitado");
  }

  // WR-01: validar forma + longitud ANTES de tocar GoTrue.
  const emailValido = validarEmail(email);

  const supabase = await clienteConCookies();
  const { error } = await supabase.auth.signInWithOtp({
    email: emailValido,
    options: { shouldCreateUser: true },
  });
  if (error) {
    // WR-02: NO interpolar el mensaje upstream de GoTrue (puede echar el email o revelar
    // estado de cuenta => enumeración). Diagnóstico server-side solo con campos no-PII.
    console.error("spike-auth: signInWithOtp falló", {
      status: (error as { status?: number }).status,
      name: error.name,
    });
    throw new Error("spike-auth: no se pudo enviar el código OTP");
  }
}

/**
 * Verifica el código OTP (`type: "email"`) y, si es válido, canjea la sesión — el
 * adaptador de cookies escribe Set-Cookie con `sb-<ref>-auth-token`.
 */
export async function verificarOtp(email: string, token: string): Promise<void> {
  // CR-01: gate fail-closed como PRIMERA sentencia (independiente del gate de la página).
  if (!spikeAuthEnabled(process.env)) {
    throw new Error("spike-auth: deshabilitado");
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
    console.error("spike-auth: verifyOtp falló", {
      status: (error as { status?: number }).status,
      name: error.name,
    });
    throw new Error("spike-auth: no se pudo verificar el código OTP");
  }
}
