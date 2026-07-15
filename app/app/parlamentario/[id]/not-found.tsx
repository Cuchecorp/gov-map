import Link from "next/link";

/**
 * not-found — parlamentario no encontrado (UI-SPEC §6.1).
 * Copy sobrio en español; nunca dice "error" para un dato ausente; nunca se lee
 * como un registro limpio. Espejo de /proyecto/[boletin]/not-found.
 */
export default function ParlamentarioNotFound() {
  return (
    <main className="max-w-[1120px] mx-auto px-4 md:px-8 py-16 text-center">
      <h1 className="text-xl font-semibold">Parlamentario no encontrado</h1>
      <p className="text-base leading-relaxed text-muted-foreground mt-4">
        No encontramos a este parlamentario en el registro. Es posible que el
        identificador sea incorrecto.
      </p>
      <p className="mt-8 text-sm">
        <Link href="/" className="text-primary underline underline-offset-2">
          Volver al inicio
        </Link>
      </p>
    </main>
  );
}
