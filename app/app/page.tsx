import { SearchBox } from "@/components/search-box";

/**
 * Landing — la home es una landing de búsqueda (UI-SPEC §2), reemplaza el
 * scaffold default de Next. Server Component shell que embebe la isla
 * `SearchBox`. La caja de búsqueda es el hero (py-16 md:py-24).
 *
 * SIN stats fabricadas (UI-SPEC §2): no se muestra "N proyectos indexados" salvo
 * que fuera un count(*) real; aquí se omite. SIN claims de marketing.
 */
export default function Home() {
  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-16 md:py-24">
      <h1 className="text-3xl font-semibold leading-tight">
        Observatorio del Congreso 360
      </h1>
      <p className="text-base text-muted-foreground mt-3 leading-relaxed">
        Busca proyectos de ley por idea o por la norma que modifican. Cada dato
        muestra su fuente, fecha y enlace original.
      </p>
      <div className="mt-8">
        <SearchBox autoFocus />
      </div>
      <p className="text-sm text-muted-foreground mt-3">
        Por ejemplo: &ldquo;protección de datos personales&rdquo; o el número de
        boletín (15234-07).
      </p>
    </main>
  );
}
