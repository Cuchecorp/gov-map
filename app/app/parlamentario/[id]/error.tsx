"use client"; // Los error boundaries deben ser Client Components.

import { useEffect } from "react";

/**
 * error — frontera de error honesta para /parlamentario/[id].
 * Las secciones de la ficha hacen `throw` ante un error real del RPC (contrato #34:
 * un fallo de datos NUNCA se degrada a un estado vacío que se leería como "limpio").
 * Esta frontera captura ese throw y muestra copy sobrio en español, distinguiendo un
 * ERROR (fallo) de un dato ausente. No expone detalle técnico.
 */
export default function ParlamentarioError({
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
    <main className="max-w-[1120px] mx-auto px-4 md:px-8 py-16 text-center">
      <h1 className="text-xl font-semibold">No pudimos cargar esta ficha</h1>
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
