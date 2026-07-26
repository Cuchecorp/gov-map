import { cookies } from "next/headers";

import { notifPublicEnabled } from "@/lib/notif-gate";
import { createUserClient } from "@/lib/supabase-user";
import { seguir, dejarDeSeguir } from "@/app/cuenta/actions";

/**
 * Botón "Seguir" / "Siguiendo" (NOTIF-05, Phase 103) — en las fichas de proyecto y
 * parlamentario. Server Component: la PRIMERA sentencia es el gate fail-closed
 * `if (!notifPublicEnabled(process.env)) return null;` (flag OFF ⇒ AUSENTE del DOM,
 * NO css-hidden, NO render — cero nodo, espejo de comparar/page.tsx:501-502).
 *
 * El estado de seguimiento se deriva SERVER-SIDE del cliente USER (RLS aísla al dueño);
 * un usuario sin sesión ve "Seguir" → click lleva a `/cuenta?next=…` (no hay toggle sin
 * sesión). Con sesión, el toggle usa las Server Actions `seguir`/`dejarDeSeguir` (RLS
 * aplica, user_id server-derived). `aria-pressed` refleja el estado; 44px de touch
 * target (`min-h-[2.75rem]`). NUNCA usa `--camara`/`--senado` como fill (anti-insinuación
 * LOCKED): petróleo (accent-product) para el estado activo, outline para no-siguiendo.
 */

interface SeguirButtonProps {
  tipo: "proyecto" | "parlamentario";
  objetivoId: string;
  /** Ruta de retorno tras login (para el usuario logged-out). */
  next: string;
}

/** Lee sesión + si el usuario ya sigue el objetivo (cliente USER, RLS aísla al dueño). */
async function leerEstado(
  tipo: "proyecto" | "parlamentario",
  objetivoId: string,
): Promise<{ autenticado: boolean; siguiendo: boolean }> {
  const cookieStore = await cookies();
  const supabase = createUserClient({
    getAll() {
      return cookieStore.getAll();
    },
    // WR-03: no-op de escritura (el middleware Edge cubre las fichas y refresca allí).
    setAll() {},
  });

  const { data: claimsData } = await supabase.auth.getClaims();
  const autenticado = typeof claimsData?.claims?.sub === "string";
  if (!autenticado) {
    return { autenticado: false, siguiendo: false };
  }

  // Existencia de una suscripción NO dada de baja para este objetivo (RLS scoped a own).
  const { data, error } = await supabase
    .from("suscripcion")
    .select("id")
    .eq("tipo", tipo)
    .eq("objetivo_id", objetivoId)
    .neq("estado", "baja")
    .limit(1);
  if (error) {
    // #34: un error real de DB/red ≠ "no sigue". Se lanza en vez de fabricar el estado.
    throw new Error(`seguir-button: no se pudo leer el estado: ${error.message}`);
  }
  return { autenticado: true, siguiendo: (data?.length ?? 0) > 0 };
}

export async function SeguirButton({ tipo, objetivoId, next }: SeguirButtonProps) {
  // Gate fail-closed como PRIMERA sentencia: flag OFF ⇒ ausente del DOM (NO css-hidden).
  if (!notifPublicEnabled(process.env)) return null;

  const { autenticado, siguiendo } = await leerEstado(tipo, objetivoId);

  // Logged-out: link a /cuenta con next (no hay toggle sin sesión).
  if (!autenticado) {
    return (
      <a
        href={`/cuenta?next=${encodeURIComponent(next)}`}
        className="inline-flex items-center justify-center rounded-lg border border-accent-product px-4 text-sm font-semibold text-accent-product min-h-[2.75rem] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-product"
      >
        Seguir
      </a>
    );
  }

  async function accionToggle() {
    "use server";
    if (siguiendo) {
      await dejarDeSeguir(tipo, objetivoId);
    } else {
      await seguir(tipo, objetivoId);
    }
  }

  return (
    <form action={accionToggle}>
      <button
        type="submit"
        aria-pressed={siguiendo}
        className={
          siguiendo
            ? "group inline-flex items-center justify-center rounded-lg bg-accent-product px-4 text-sm font-semibold text-background min-h-[2.75rem] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-product"
            : "inline-flex items-center justify-center rounded-lg border border-accent-product px-4 text-sm font-semibold text-accent-product min-h-[2.75rem] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-product"
        }
      >
        {siguiendo ? (
          <>
            <span className="group-hover:hidden group-focus:hidden">Siguiendo</span>
            <span className="hidden text-destructive group-hover:inline group-focus:inline">
              Dejar de seguir
            </span>
          </>
        ) : (
          "Seguir"
        )}
      </button>
    </form>
  );
}
