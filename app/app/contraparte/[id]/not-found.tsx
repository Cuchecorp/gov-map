import Link from "next/link";

/**
 * not-found — contraparte no encontrada (16-UI-SPEC §Honest States, Gate OFF).
 * Copy sobrio en español; nunca dice "error" para un dato ausente; nunca se lee
 * como un registro limpio. Este archivo TAMBIÉN sirve el 404 del gate OFF (cuando
 * `/contraparte/[id]/page.tsx` llama `notFound()` con `moneyPublicEnabled()` falso):
 * NO contiene NINGÚN heading MONEY ni dato de contraparte. Espejo de
 * /parlamentario/[id]/not-found.
 */
export default function ContraparteNotFound() {
  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-16 text-center">
      <h1 className="text-xl font-semibold">Contraparte no encontrada</h1>
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
