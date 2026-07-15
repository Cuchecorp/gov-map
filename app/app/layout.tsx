import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { GlobalHeader } from "@/components/global-header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Toggle noindex (Phase 20): fail-closed hasta la pasada legal Ley 21.719.
// Espejo del patrón de `lib/money-gate.ts`: SOLO el literal "true" indexa; ausente
// o cualquier otro valor => noindex,nofollow. Para indexar tras el sign-off legal,
// setear la var del Worker `PUBLIC_INDEXABLE=true` (punto de cambio único; no requiere
// editar código). Sin prefijo NEXT_PUBLIC_: se evalúa server-side, no viaja al cliente.
export function generateMetadata(): Metadata {
  const indexable = process.env.PUBLIC_INDEXABLE === "true";
  return {
    title: "Observatorio del Congreso 360",
    description:
      "Consulta y cruza datos públicos del Congreso de Chile: proyectos de ley, tramitación y votaciones, con trazabilidad a la fuente.",
    robots: indexable ? undefined : { index: false, follow: false },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <GlobalHeader />
        {children}
        {/*
          Footer global (SC8): atribución + licencia CC BY 4.0 con SCOPE-CAVEAT.
          La línea de licencia cubre SOLO la compilación propia; NO reafirma ni
          contradice las atribuciones por-dataset (ChileCompra "mención de la
          fuente", SERVEL "términos por verificar") que viven en sus secciones
          y en /metodologia — por eso el footer global NO nombra esos datasets.
        */}
        <footer className="mt-16 border-t">
          <div className="max-w-[1120px] mx-auto px-6 py-8 text-sm text-muted-foreground">
            <p className="leading-relaxed">
              Datos de fuentes públicas del Congreso de Chile, con fuente, fecha y
              enlace en cada dato.
            </p>
            <p className="mt-3 leading-relaxed">
              Contenido bajo{" "}
              <a
                href="https://creativecommons.org/licenses/by/4.0/deed.es"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-product underline-offset-4 hover:underline"
              >
                CC BY 4.0
              </a>{" "}
              — atribución a Observatorio del Congreso 360. Esta licencia cubre la
              compilación propia; cada fuente conserva sus propios términos, indicados
              en su sección y en la metodología.
            </p>
            <nav className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1">
              <Link
                href="/metodologia"
                className="inline-flex min-h-11 items-center text-accent-product underline-offset-4 hover:underline"
              >
                Metodología
              </Link>
              <Link
                href="/sobre"
                className="inline-flex min-h-11 items-center text-accent-product underline-offset-4 hover:underline"
              >
                Sobre el proyecto
              </Link>
              <a
                href="mailto:contacto@observatoriocongreso.cl"
                className="inline-flex min-h-11 items-center text-accent-product underline-offset-4 hover:underline"
              >
                Contacto
              </a>
            </nav>
            <p className="mt-4 text-xs leading-relaxed">
              Fuente, fecha y enlace en cada dato · Sin afirmar intención ni causalidad.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
