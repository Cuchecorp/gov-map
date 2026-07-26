import type { Metadata } from "next";
import { cookies } from "next/headers";

import { notifPublicEnabled } from "@/lib/notif-gate";
import { createUserClient } from "@/lib/supabase-user";

import {
  CONSENT_VERSION,
  cerrarSesion,
  dejarDeSeguir,
  enviarOtp,
  verificarOtp,
} from "./actions";

/**
 * /cuenta (NOTIF-01, Phase 103) — login OTP por email + lista de suscripciones +
 * centro de preferencias mínimo (frecuencia digest FIJA) + estado de consentimiento.
 * Reemplaza y absorbe el patrón de /spike-auth (eliminado este plan).
 *
 * GOTCHA PHASE 45/102 (LOCKED, load-bearing): `export const dynamic = "force-dynamic"`
 * + leer `searchParams` (Promise, Next 16) ANTES de cualquier `notFound()`. NO hay
 * notFound() aquí: sin sesión → formulario de login (empty state honesto), jamás 404/500.
 *
 * GATE (NOTIF-05): las superficies de suscripción se envuelven en
 * `notifPublicEnabled(process.env)`. Con el flag OFF (default), la lista/preferencias
 * NO se renderizan (el login OTP tampoco tiene sentido sin la superficie pública).
 *
 * SEGURIDAD (V7, 21.719): NUNCA renderizar el email crudo ni el token. La lista de
 * suscripciones se lee con el cliente USER de bajo privilegio (RLS aísla al dueño);
 * el service_role NUNCA toca esta superficie.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tu cuenta",
};

// Copy LOCKED (103-UI-SPEC §Copywriting → /cuenta).
const H1 = "Tu cuenta";
const LOGIN_INTRO =
  "Ingresa tu correo y te enviaremos un código de 6 dígitos para acceder. No usamos contraseñas.";
const CTA_ENVIAR = "Enviar código";
const CTA_VERIFICAR = "Verificar código";
const LABEL_EMAIL = "Correo electrónico";
const LABEL_CODIGO = "Código de 6 dígitos";
const SESION_INICIADA = "Sesión iniciada";
const CERRAR_SESION = "Cerrar sesión";
const H2_SUSCRIPCIONES = "Tus suscripciones";
const H2_FRECUENCIA = "Frecuencia del resumen";
const FRECUENCIA_COPY =
  "Recibes un resumen por correo una vez al día, de lunes a viernes, con las novedades de lo que sigues. No enviamos avisos instantáneos: los datos se actualizan por procesos programados.";
const EMPTY_HEADING = "Todavía no sigues nada";
const EMPTY_BODY =
  'Cuando sigas un proyecto o un parlamentario aparecerá aquí y lo incluiremos en tu resumen diario. Busca uno y pulsa "Seguir".';
const NO_INDISPONIBLE =
  "Las suscripciones no están disponibles en este momento.";

interface SuscripcionRow {
  id: string;
  tipo: "proyecto" | "parlamentario";
  objetivo_id: string;
  estado: "pendiente" | "confirmada" | "baja";
  created_at: string;
}

interface ConsentimientoRow {
  version_texto: string;
  created_at: string;
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/** Cliente user read-only para el render (las cookies son read-only en el RSC). */
async function clienteRender() {
  const cookieStore = await cookies();
  return createUserClient({
    getAll() {
      return cookieStore.getAll();
    },
    // WR-03: no-op de escritura SEGURO porque el middleware Edge cubre /cuenta y hace
    // el refresh allí (mismo patrón LOCKED de spike-auth/page.tsx). NO copiar fuera
    // del matcher del middleware.
    setAll() {},
  });
}

/** Formatea una fecha ISO como día calendario chileno (YYYY-MM-DD). */
function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export default async function CuentaPage({ searchParams }: PageProps) {
  // GOTCHA 45: searchParams (Promise) se lee PRIMERO. No hay notFound() en esta ruta.
  await searchParams;

  const supabase = await clienteRender();
  const { data: claimsData } = await supabase.auth.getClaims();
  const autenticado = typeof claimsData?.claims?.sub === "string";

  const notifOn = notifPublicEnabled(process.env);

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-16 space-y-8">
      <h1 className="text-2xl md:text-2xl font-semibold leading-tight">{H1}</h1>

      {!notifOn ? (
        <p className="text-sm text-muted-foreground">{NO_INDISPONIBLE}</p>
      ) : !autenticado ? (
        <LoginBlock />
      ) : (
        <SesionBlock supabase={supabase} />
      )}
    </main>
  );
}

/** Bloque de login (logged-out): formulario enviar → verificar. */
function LoginBlock() {
  async function accionEnviar(formData: FormData) {
    "use server";
    await enviarOtp(String(formData.get("email") ?? ""));
  }
  async function accionVerificar(formData: FormData) {
    "use server";
    await verificarOtp(
      String(formData.get("email") ?? ""),
      String(formData.get("token") ?? ""),
    );
  }

  return (
    <section className="space-y-6">
      <p className="text-sm text-muted-foreground">{LOGIN_INTRO}</p>

      <form action={accionEnviar} className="space-y-2">
        <label className="block text-sm font-semibold" htmlFor="email-enviar">
          {LABEL_EMAIL}
        </label>
        <input
          id="email-enviar"
          name="email"
          type="email"
          required
          className="border rounded-lg px-3 py-2 w-full max-w-sm min-h-[2.75rem]"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-lg bg-accent-product px-4 py-2 text-sm font-semibold text-background min-h-[2.75rem]"
        >
          {CTA_ENVIAR}
        </button>
      </form>

      <form action={accionVerificar} className="space-y-2">
        <label className="block text-sm font-semibold" htmlFor="email-verificar">
          {LABEL_EMAIL}
        </label>
        <input
          id="email-verificar"
          name="email"
          type="email"
          required
          className="border rounded-lg px-3 py-2 w-full max-w-sm min-h-[2.75rem]"
        />
        <label className="block text-sm font-semibold" htmlFor="token-verificar">
          {LABEL_CODIGO}
        </label>
        <input
          id="token-verificar"
          name="token"
          type="text"
          inputMode="numeric"
          required
          className="border rounded-lg px-3 py-2 w-full max-w-sm min-h-[2.75rem]"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-lg bg-accent-product px-4 py-2 text-sm font-semibold text-background min-h-[2.75rem]"
        >
          {CTA_VERIFICAR}
        </button>
      </form>
    </section>
  );
}

/** Bloque de sesión (logged-in): banner + suscripciones + frecuencia + consentimiento. */
async function SesionBlock({
  supabase,
}: {
  supabase: Awaited<ReturnType<typeof clienteRender>>;
}) {
  // Lecturas con el cliente USER (RLS aísla al dueño). Un error real LANZA (#34):
  // una lista vacía honesta es `[]` SIN error, jamás una degradación silenciosa.
  const [{ data: suscData, error: suscErr }, { data: consData, error: consErr }] =
    await Promise.all([
      supabase
        .from("suscripcion")
        .select("id, tipo, objetivo_id, estado, created_at")
        .neq("estado", "baja")
        .order("created_at", { ascending: false }),
      supabase
        .from("consentimiento")
        .select("version_texto, created_at")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
  if (suscErr) {
    throw new Error(`cuenta: no se pudieron leer las suscripciones: ${suscErr.message}`);
  }
  if (consErr) {
    throw new Error(`cuenta: no se pudo leer el consentimiento: ${consErr.message}`);
  }
  const suscripciones = (suscData ?? []) as SuscripcionRow[];
  const consentimiento = ((consData ?? []) as ConsentimientoRow[])[0] ?? null;

  async function accionCerrarSesion() {
    "use server";
    await cerrarSesion();
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm font-semibold">{SESION_INICIADA}</p>
        <form action={accionCerrarSesion}>
          <button
            type="submit"
            className="text-sm font-semibold text-destructive min-h-[2.75rem] px-2"
          >
            {CERRAR_SESION}
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{H2_SUSCRIPCIONES}</h2>
        {suscripciones.length === 0 ? (
          <div className="rounded-lg border bg-muted/40 p-6">
            <p className="text-sm font-semibold">{EMPTY_HEADING}</p>
            <p className="mt-2 text-sm text-muted-foreground">{EMPTY_BODY}</p>
          </div>
        ) : (
          <ul className="space-y-6">
            {suscripciones.map((s) => (
              <SuscripcionItem key={s.id} suscripcion={s} />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{H2_FRECUENCIA}</h2>
        <p className="text-sm text-muted-foreground">{FRECUENCIA_COPY}</p>
      </section>

      {consentimiento && (
        <section>
          <p className="text-sm text-muted-foreground">
            Consentimiento registrado el {fechaCorta(consentimiento.created_at)} ·
            versión {consentimiento.version_texto} del texto informado.
          </p>
        </section>
      )}
    </div>
  );
}

/** Una fila de suscripción con chip de tipo + fecha + baja inline. */
function SuscripcionItem({ suscripcion }: { suscripcion: SuscripcionRow }) {
  const tipoLabel = suscripcion.tipo === "proyecto" ? "Proyecto" : "Parlamentario";

  async function accionBaja() {
    "use server";
    await dejarDeSeguir(suscripcion.tipo, suscripcion.objetivo_id);
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{suscripcion.objetivo_id}</span>
          <span className="rounded border border-input px-2 py-0.5 text-xs">
            {tipoLabel}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Suscrito el {fechaCorta(suscripcion.created_at)}
        </p>
      </div>
      <form action={accionBaja}>
        <button
          type="submit"
          className="text-sm font-semibold text-destructive min-h-[2.75rem] px-2"
        >
          Dejar de seguir
        </button>
      </form>
    </li>
  );
}

// Re-export para tests / consumidores server-side (contrato de versión de consentimiento).
export { CONSENT_VERSION };
