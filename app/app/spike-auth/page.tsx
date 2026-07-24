import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { spikeAuthEnabled } from "@/lib/spike-auth-gate";
import { createUserClient } from "@/lib/supabase-user";

import { enviarOtp, verificarOtp } from "./actions";

/**
 * /spike-auth — ruta de prueba NO ENLAZADA del SPIKE auth-on-Workers (Phase 97).
 *
 * NO aparece en navegación ni en el home (no se toca app/app/page.tsx). Ejerce el flujo
 * OTP (send/verify) por server actions y muestra el ESTADO de sesión vía `getClaims()`
 * del cliente user de bajo privilegio. Superficie mínima de de-risk: el valor está en
 * probar, sobre el deploy real (Plan 02), que el middleware + Set-Cookie + refresh
 * sobreviven el pipeline OpenNext.
 *
 * SEGURIDAD (V7, 21.719): NUNCA renderizar el email crudo ni el token. Solo se muestra
 * SI hay sesión y claims mínimos no sensibles.
 */

export const dynamic = "force-dynamic";

// Nunca indexar esta ruta de spike, aun cuando el flag esté encendido en preview.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Lee el estado de sesión sin escribir cookies (contexto de render, read-only). */
async function leerSesion(): Promise<{ autenticado: boolean; expira: string | null }> {
  const cookieStore = await cookies();
  const supabase = createUserClient({
    getAll() {
      return cookieStore.getAll();
    },
    // En el render (Server Component) las cookies son read-only: no-op de escritura.
    setAll() {
      // WR-03: este no-op es SEGURO SOLO porque el matcher del middleware cubre /spike-auth
      // y realiza el refresh (re-emite Set-Cookie) allí. Si `getClaims()` gatilla un refresh
      // en background durante el render, las cookies nuevas se descartan aquí — aceptable
      // porque el middleware ya las escribió. NO copiar este patrón a una ruta FUERA del
      // matcher del middleware ni con el middleware deshabilitado: el usuario vería "sin
      // sesión" o un expiry stale mientras el token refrescado se pierde. Para leer sesión
      // fuera del path del middleware, usar un Route Handler / Server Action con cookies
      // escribibles.
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    return { autenticado: false, expira: null };
  }
  // Claim mínimo NO sensible: expiry (epoch). NUNCA exponer email ni token.
  const exp = typeof claims.exp === "number" ? new Date(claims.exp * 1000).toISOString() : null;
  return { autenticado: true, expira: exp };
}

export default async function SpikeAuthPage() {
  // CR-01: gate fail-closed. Con SPIKE_AUTH_ENABLED sin setear (producción) la ruta 404
  // en tiempo de request (force-dynamic evita el bake estático). El operador la enciende
  // solo en preview. Las server actions repiten este gate por su cuenta (no confían en él).
  if (!spikeAuthEnabled(process.env)) notFound();

  const { autenticado, expira } = await leerSesion();

  async function accionEnviar(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    await enviarOtp(email);
  }

  async function accionVerificar(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const token = String(formData.get("token") ?? "");
    await verificarOtp(email, token);
  }

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-16">
      <h1 className="text-xl font-semibold">Spike auth (interno)</h1>
      <p className="text-sm text-muted-foreground mt-2">
        Ruta de prueba no enlazada del spike auth-on-Workers. Ejerce el flujo OTP por
        email para verificar que la sesión Supabase Auth sobrevive el pipeline OpenNext.
        No es una página pública.
      </p>

      <p className="text-sm mt-6">
        Estado de sesión:{" "}
        <strong>{autenticado ? "con sesión" : "sin sesión"}</strong>
        {autenticado && expira ? (
          <span className="text-muted-foreground"> · access token expira {expira}</span>
        ) : null}
      </p>

      <form action={accionEnviar} className="mt-8 space-y-2">
        <label className="block text-sm font-medium" htmlFor="email-enviar">
          Email (solo direcciones propias del operador)
        </label>
        <input
          id="email-enviar"
          name="email"
          type="email"
          required
          className="border rounded-lg px-3 py-2 w-full max-w-sm"
        />
        <button type="submit" className="border rounded-lg px-4 py-2">
          Enviar código OTP
        </button>
      </form>

      <form action={accionVerificar} className="mt-8 space-y-2">
        <label className="block text-sm font-medium" htmlFor="email-verificar">
          Email
        </label>
        <input
          id="email-verificar"
          name="email"
          type="email"
          required
          className="border rounded-lg px-3 py-2 w-full max-w-sm"
        />
        <label className="block text-sm font-medium" htmlFor="token-verificar">
          Código de 6 dígitos
        </label>
        <input
          id="token-verificar"
          name="token"
          type="text"
          inputMode="numeric"
          required
          className="border rounded-lg px-3 py-2 w-full max-w-sm"
        />
        <button type="submit" className="border rounded-lg px-4 py-2">
          Verificar código
        </button>
      </form>
    </main>
  );
}
