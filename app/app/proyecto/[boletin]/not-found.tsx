import Link from "next/link";

/**
 * not-found — ficha no encontrada (UI-SPEC §6.1).
 * Copy sobrio en español; nunca dice "error" para un dato ausente; ofrece
 * buscar directamente en las fuentes oficiales.
 */
export default function ProyectoNotFound() {
  return (
    <main className="max-w-[1120px] mx-auto px-4 md:px-8 py-16 text-center">
      <h1 className="text-xl font-semibold">Proyecto no encontrado</h1>
      <p className="text-base leading-relaxed text-muted-foreground mt-4">
        No encontramos el proyecto solicitado. Es posible que aún no haya sido
        ingresado. Puedes buscarlo directamente en las fuentes oficiales:
      </p>
      <div className="flex flex-wrap items-center justify-center gap-6 mt-6 text-sm">
        <a
          href="https://www.senado.cl/appsenado/index.php?mo=tramitacion&ac=getDetalleProyecto"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
          aria-label="Buscar en el Senado (abre en nueva pestaña)"
        >
          Senado ↗
        </a>
        <a
          href="https://www.camara.cl/legislacion/ProyectosDeLey/proyectos_ley.aspx"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
          aria-label="Buscar en la Cámara (abre en nueva pestaña)"
        >
          Cámara ↗
        </a>
      </div>
      <p className="mt-8 text-sm">
        <Link href="/" className="text-primary underline underline-offset-2">
          Volver al inicio
        </Link>
      </p>
    </main>
  );
}
