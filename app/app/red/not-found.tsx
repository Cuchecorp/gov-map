import Link from "next/link";

/**
 * not-found — la sección de relaciones (NET) no está disponible
 * (16-UI-SPEC §Honest States, Gate OFF). Copy sobrio en español; nunca dice
 * "error". Este archivo sirve el 404 del candado B OFF: cuando
 * `/red/page.tsx` llama `notFound()` con `netPublicEnabled()` falso, NO contiene
 * NINGÚN heading ni dato de NET (cero filtración de DOM mientras OFF). También
 * cubre una semilla inválida. Espejo de /contraparte/[id]/not-found.
 */
export default function RedNotFound() {
  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-16 text-center">
      <h1 className="text-xl font-semibold">Página no encontrada</h1>
      <p className="text-base leading-relaxed text-muted-foreground mt-4">
        No encontramos esta página. Es posible que el identificador sea incorrecto.
      </p>
      <p className="mt-8 text-sm">
        <Link href="/" className="text-primary underline underline-offset-2">
          Volver al inicio
        </Link>
      </p>
    </main>
  );
}
