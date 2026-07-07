import type { Metadata } from "next";
import Link from "next/link";

import { Separator } from "@/components/ui/separator";

/**
 * /metodologia — página mínima y honesta (twin de /sobre). Server Component estático:
 * qué fuentes se consultan HOY, qué significan los tres estados honestos con que se
 * reporta cada dato, y qué licencia rige cada dataset (conviven, no se contradicen).
 * NO promete un diccionario de datos por sección completo ni una tabla de frescura por
 * fuente: eso es trabajo de un milestone futuro (espeja la declaración de alcance que
 * /sobre ya hace). El footer global enlaza a esta ruta.
 */

export const metadata: Metadata = {
  title: "Metodología · Observatorio del Congreso",
};

export default function MetodologiaPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-16">
      <h1 className="text-3xl font-semibold leading-tight">Metodología</h1>

      <p className="mt-6 text-base leading-relaxed text-muted-foreground">
        Esta página describe, de forma honesta y acotada a su alcance actual, de dónde
        vienen los datos que se muestran, cómo se reporta cuando un dato no está
        disponible, y bajo qué licencia se publica cada fuente. Cada dato conserva además
        su fuente, su fecha y un enlace al documento original.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Qué fuentes se consultan</h2>
        <Separator className="mt-2" />
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Hoy la plataforma se alimenta de los siguientes registros públicos. La cobertura
          de cada uno se amplía de forma incremental.
        </p>
        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
          <li>· Cámara de Diputadas y Diputados (proyectos, votaciones, citaciones, tabla de sala).</li>
          <li>· Senado de la República (tramitación, votaciones, citaciones, tabla de sala).</li>
          <li>· Biblioteca del Congreso Nacional — LeyChile (textos legales).</li>
          <li>· Registros de la Ley del Lobby (Ley 20.730).</li>
          <li>· Declaraciones de patrimonio e intereses (Consejo para la Transparencia).</li>
          <li>· ChileCompra — Mercado Público (contratos y compras del Estado).</li>
          <li>· Servicio Electoral (SERVEL) — financiamiento de campañas.</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Cómo se reporta cada dato</h2>
        <Separator className="mt-2" />
        <p className="mt-4 text-sm leading-relaxed">
          La plataforma nunca inventa un dato. Cuando algo no aparece, se distingue de
          forma explícita entre tres situaciones:
        </p>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed">
          <li>
            <strong>No consultado.</strong>{" "}
            <span className="text-muted-foreground">
              La fuente todavía no se ha ingerido para ese caso; no se afirma nada sobre
              su contenido.
            </span>
          </li>
          <li>
            <strong>Consultado sin resultados.</strong>{" "}
            <span className="text-muted-foreground">
              Se revisó la fuente y no hay registros para ese caso —lo que es un dato en sí
              mismo, distinto de no haber mirado.
            </span>
          </li>
          <li>
            <strong>Error al consultar.</strong>{" "}
            <span className="text-muted-foreground">
              La fuente no se pudo procesar (documento ilegible, servicio caído); se dice
              de forma explícita y se enlaza al original.
            </span>
          </li>
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Los nombres de personas se muestran tal como los entrega la fuente. Cuando el
          registro original no trae tildes, el sitio tampoco las agrega: nunca añade
          acentos que la fuente no incluye.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Licencia por fuente</h2>
        <Separator className="mt-2" />
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Las licencias de las distintas fuentes conviven; cada dato conserva la suya. La
          compilación y el contenido propios se publican bajo{" "}
          <a
            href="https://creativecommons.org/licenses/by/4.0/deed.es"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-product underline-offset-4 hover:underline"
          >
            Creative Commons Atribución 4.0 (CC BY 4.0)
          </a>
          . Los datos de terceros mantienen sus propios términos:
        </p>
        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
          <li>· Compilación y contenido propios: CC BY 4.0.</li>
          <li>· ChileCompra — Mercado Público: se publican citando la fuente (mención de la fuente).</li>
          <li>· SERVEL: términos de uso por verificar; se enlaza siempre al registro original.</li>
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Un diccionario de datos por sección y una tabla de frescura por fuente son
          trabajo de un milestone posterior; esta página no los promete todavía.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Contacto</h2>
        <Separator className="mt-2" />
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          ¿Encontraste un dato que no cuadra con su fuente? Escríbenos a{" "}
          <a
            href="mailto:contacto@observatoriocongreso.cl"
            className="text-accent-product underline-offset-4 hover:underline"
          >
            contacto@observatoriocongreso.cl
          </a>{" "}
          con el enlace a la ficha y a la fuente original.
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
