import type { Metadata } from "next";
import Link from "next/link";

import { Separator } from "@/components/ui/separator";

/**
 * /sobre — "¿Cómo leer esto?" (UI-SPEC §11.1 onboarding). Server Component, contenido
 * estático honesto: qué es la plataforma, el principio de trazabilidad + no-causalidad,
 * las fuentes, cómo navegarla, y la licencia. NO promete features no disponibles
 * (degradación honesta). El diccionario de datos por sección + frescura por fuente es
 * trabajo del milestone de Metodología.
 */

export const metadata: Metadata = {
  title: "Sobre el proyecto · Observatorio del Congreso",
};

export default function SobrePage() {
  return (
    <main className="max-w-[1120px] mx-auto px-4 md:px-8 py-8 md:py-16">
      <h1 className="text-3xl font-semibold leading-tight">Sobre el proyecto</h1>

      <p className="mt-6 text-base leading-relaxed text-muted-foreground">
        Observatorio del Congreso reúne en un solo lugar datos públicos del Congreso de
        Chile —proyectos de ley, su tramitación y votaciones, y la actividad de las y los
        parlamentarios— para que cualquier persona pueda consultarlos y cruzarlos.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">El principio</h2>
        <Separator className="mt-2" />
        <p className="mt-4 text-sm leading-relaxed">
          Cada dato que se muestra lleva su <strong>fuente, su fecha y un enlace al
          documento original</strong>. La plataforma reporta qué pasó, cuándo y según qué
          fuente —<strong>sin afirmar intención ni causalidad</strong>. Cuando un dato no
          está disponible (porque la fuente no lo publica como dato estructurado, o el
          documento no se pudo procesar), se dice de forma explícita y se enlaza al
          original; nunca se inventa.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Fuentes</h2>
        <Separator className="mt-2" />
        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
          <li>· Cámara de Diputadas y Diputados (proyectos, votaciones, citaciones, tabla de sala).</li>
          <li>· Senado de la República (tramitación, votaciones, citaciones, tabla de sala).</li>
          <li>· Biblioteca del Congreso Nacional — LeyChile (textos legales).</li>
          <li>· Registros de la Ley del Lobby, declaraciones de patrimonio e intereses, y el Servicio Electoral (SERVEL).</li>
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          La cobertura de cada fuente se amplía de forma incremental; la fecha de la última
          actualización acompaña a cada dato.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Cómo navegarla</h2>
        <Separator className="mt-2" />
        <ul className="mt-4 space-y-2 text-sm leading-relaxed">
          <li>
            <Link href="/buscar" className="text-accent-product underline-offset-4 hover:underline">
              Buscar proyectos
            </Link>{" "}
            <span className="text-muted-foreground">
              por una idea (p. ej. &ldquo;protección de datos personales&rdquo;) o por número de boletín.
            </span>
          </li>
          <li>
            <Link href="/agenda" className="text-accent-product underline-offset-4 hover:underline">
              Agenda legislativa
            </Link>{" "}
            <span className="text-muted-foreground">
              — citaciones de comisiones y tabla de sala de la semana, con buscador.
            </span>
          </li>
          <li>
            <Link href="/parlamentarios" className="text-accent-product underline-offset-4 hover:underline">
              Parlamentarios
            </Link>{" "}
            <span className="text-muted-foreground">
              — qué presentan y cómo votan, con enlace a cada fuente.
            </span>
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Licencia y uso</h2>
        <Separator className="mt-2" />
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Los datos y el contenido se publican bajo{" "}
          <a
            href="https://creativecommons.org/licenses/by/4.0/deed.es"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-product underline-offset-4 hover:underline"
          >
            Creative Commons Atribución 4.0 (CC BY 4.0)
          </a>
          . Podés reutilizarlos citando &ldquo;Observatorio del Congreso&rdquo; con enlace a
          la fuente. Cada dato conserva además su procedencia original para verificación.
        </p>
      </section>

      <p className="mt-12 text-sm">
        <Link href="/" className="text-accent-product underline-offset-4 hover:underline">
          ← Volver al inicio
        </Link>
      </p>
    </main>
  );
}
