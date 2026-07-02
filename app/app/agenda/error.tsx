"use client"; // Los error boundaries deben ser Client Components.

import { useEffect } from "react";

/**
 * error — frontera de error honesta para /agenda.
 * Las secciones de la agenda hacen `throw` ante un error real de DB/red (contrato
 * #34: un fallo de datos NUNCA se degrada a un estado vacío que se leería como "sin
 * citaciones"). El Plan 50-05 (B7) añade ese `throw` a la agenda; esta frontera lo
 * captura y muestra copy sobrio en español, distinguiendo un ERROR (fallo) de una
 * ausencia de citaciones. No expone detalle técnico.
 */
export default function AgendaError({
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
      <h1 className="text-xl font-semibold">No pudimos cargar la agenda</h1>
      <p className="text-base leading-relaxed text-muted-foreground mt-4">
        Ocurrió un error al consultar los datos. Esto es una falla técnica, no una
        ausencia de información: no asumas que no hay registros.
      </p>
      <p className="mt-8 text-sm">
        <button
          onClick={() => unstable_retry()}
          className="text-primary underline underline-offset-2"
        >
          Reintentar
        </button>
      </p>
    </main>
  );
}
