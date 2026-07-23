"use server";

import { cookies } from "next/headers";

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
 * SEGURIDAD (V7, Ley 21.719): JAMÁS loguear ni interpolar en mensajes de error el email
 * ni el token. Validación de input ANTES de la llamada. Emails de prueba = SOLO
 * direcciones del propio operador.
 */

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
  if (typeof email !== "string" || email.trim() === "") {
    throw new Error("spike-auth: el email no puede estar vacío");
  }

  const supabase = await clienteConCookies();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) {
    // NUNCA interpolar el email: solo el mensaje de GoTrue (sin PII del input).
    throw new Error(`spike-auth: signInWithOtp falló: ${error.message}`);
  }
}

/**
 * Verifica el código OTP (`type: "email"`) y, si es válido, canjea la sesión — el
 * adaptador de cookies escribe Set-Cookie con `sb-<ref>-auth-token`.
 */
export async function verificarOtp(email: string, token: string): Promise<void> {
  if (typeof email !== "string" || email.trim() === "") {
    throw new Error("spike-auth: el email no puede estar vacío");
  }
  if (typeof token !== "string" || token.trim() === "") {
    throw new Error("spike-auth: el token OTP no puede estar vacío");
  }

  const supabase = await clienteConCookies();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) {
    // NUNCA interpolar email ni token: solo el mensaje de GoTrue.
    throw new Error(`spike-auth: verifyOtp falló: ${error.message}`);
  }
}
