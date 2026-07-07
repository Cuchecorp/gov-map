"use client"; // Los error boundaries deben ser Client Components.

import { useEffect } from "react";

/**
 * error — frontera de error honesta para `/` (el home).
 * Desde Phase 52 la portada es `force-dynamic` y lee datos vivos (módulo de
 * actualidad: votacion / tramitacion_evento / proyecto / citacion /
 * lobby_audiencia / proyecto_ficha). Cada bloque hace `throw` ante un error real
 * de DB/red (contrato #34: un fallo de datos NUNCA se degrada a un estado vacío
 * que se leería como "sin datos"). Sin esta frontera, un error transitorio en un
 * bloque bajo el fold reemplazaba TODA la portada — hero y buscador incluidos —
 * con el 500 genérico de Next (CR-01). Aquí se captura y se muestra copy sobrio
 * en español, distinguiendo un ERROR (fallo) de una ausencia de información.
 * No expone detalle técnico. El header global (layout) sigue visible.
 */
export default function HomeError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-16 text-center">
      <h1 className="text-xl font-semibold">No pudimos cargar la portada</h1>
      <p className="text-base leading-relaxed text-muted-foreground mt-4">
        Ocurrió un error al consultar los datos. Esto es una falla técnica, no una
        ausencia de información: no asumas que no hay registros.
      </p>
      <p className="mt-8 text-sm">
        <button
          onClick={() => unstable_retry()}
          className="text-accent-product underline underline-offset-2"
        >
          Reintentar
        </button>
      </p>
    </main>
  );
}
