import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
      </body>
    </html>
  );
}
