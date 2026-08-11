import type { Metadata } from "next";
import Link from "next/link";

import { Separator } from "@/components/ui/separator";

/**
 * /metodologia/prensa — "Cómo clasificamos las noticias" (Phase 137). Server
 * Component estático, twin de /metodologia. Describe qué se monitorea, la
 * taxonomía con nombres humanos (D-133-G: CERO literales snake_case en app/,
 * verificado por el guard G2 de `packages/news`), la vara de medición y su
 * limitación declarada, los umbrales pre-registrados y su resultado, y por qué
 * el vínculo noticia→proyecto es HOY solo por mención textual del boletín.
 *
 * Prosa descriptiva, cero causalidad, cero vocabulario de
 * `app/lib/terminos-insinuacion.ts`. Cada cifra viaja con su n e IC95.
 */

export const metadata: Metadata = {
  title: "Cómo clasificamos las noticias · Observatorio del Congreso",
};

export default function MetodologiaPrensaPage() {
  return (
    <main className="max-w-[1120px] mx-auto px-4 md:px-8 py-8 md:py-16">
      <h1 className="text-3xl font-semibold leading-tight">
        Cómo clasificamos las noticias
      </h1>

      <p className="mt-6 text-base leading-relaxed text-muted-foreground">
        Esta página describe, de forma honesta y verificable, qué prensa se monitorea,
        cómo se clasifica cada titular, con qué vara se midió esa clasificación antes de
        usarla, y por qué —hoy— ninguna noticia se vincula a una ficha de proyecto por su
        clasificación. Cada cifra de esta página viaja con su tamaño de muestra (n) y su
        intervalo de confianza.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Qué se monitorea</h2>
        <Separator className="mt-2" />
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          La plataforma sigue por RSS a cinco medios chilenos: La Tercera, La Cuarta,
          Ex-Ante, BioBioChile y Cooperativa. De cada noticia se guarda solo el titular y
          la bajada públicos que el propio medio publica en su feed — el texto completo de
          la noticia no se almacena ni se muestra en ningún lugar del sitio.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">La taxonomía</h2>
        <Separator className="mt-2" />
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Cada titular y bajada se clasifica en una de seis clases, a partir de lo que el
          propio texto dice —nunca de lo que el lector podría inferir sobre el tema—:
        </p>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed">
          <li>
            <strong>Tramitación legislativa.</strong>{" "}
            <span className="text-muted-foreground">
              El texto informa un hecho ocurrido en la tramitación de un proyecto en el
              Congreso (ingreso, comisión, sala, votación, indicación, urgencia, veto,
              despacho, o el número de un boletín).
            </span>
          </li>
          <li>
            <strong>Actividad parlamentaria.</strong>{" "}
            <span className="text-muted-foreground">
              El texto trata la actuación pública de un parlamentario en ejercicio,
              nombrado explícitamente: una declaración, una comisión investigadora, lobby
              o audiencias, patrimonio e intereses, ética y sanciones, o asistencia.
            </span>
          </li>
          <li>
            <strong>Ley vigente.</strong>{" "}
            <span className="text-muted-foreground">
              El texto trata una norma ya promulgada o publicada, su reglamento, su
              entrada en vigencia o sus efectos —sin mencionar además un acto de
              tramitación, que movería el titular a la clase anterior.
            </span>
          </li>
          <li>
            <strong>Política no legislativa.</strong>{" "}
            <span className="text-muted-foreground">
              Contenido político contingente sin acto de tramitación ni actuación
              parlamentaria nombrada: elecciones, partidos, gabinete, encuestas,
              municipios, tribunales no constitucionales, y anuncios del Ejecutivo que el
              texto no vincula a un trámite concreto.
            </span>
          </li>
          <li>
            <strong>No legislativa.</strong>{" "}
            <span className="text-muted-foreground">
              Todo lo demás: farándula, deportes, policial, internacional, economía,
              servicio. Se espera que sea la mayoría de la prensa monitoreada.
            </span>
          </li>
          <li>
            <strong>Ambiguo.</strong>{" "}
            <span className="text-muted-foreground">
              El titular y la bajada no alcanzan para decidir entre dos clases en
              competencia. No es "no sé": es que la evidencia disponible en el texto no
              basta para resolverlo.
            </span>
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">La vara antes de medir</h2>
        <Separator className="mt-2" />
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Antes de medir cualquier clasificador, se construyó un conjunto de referencia
          (golden set) de 159 casos, etiquetado por dos anotadores independientes —ambos
          modelos de inteligencia artificial de la misma familia, un dato relevante para
          leer las cifras— con arbitraje de un tercer modelo sobre los desacuerdos. Sobre
          los 154 casos doble-anotados del conjunto (los 5 restantes se incorporaron en un
          paso posterior de sobre-muestreo dirigido), el acuerdo bruto entre anotadores fue
          88,96 %; el coeficiente kappa de Cohen —que descuenta el acuerdo esperable por
          azar— fue 0,83 (intervalo de confianza 95 %: 0,75–0,91, n=154).
        </p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Limitación declarada, no disimulada: por decisión del operador, la calibración
          de referencia se hizo con un modelo de inteligencia artificial distinto,
          actuando en sustitución del operador humano. El acuerdo entre un anotador
          humano y el clasificador en producción no está medido — se declara aquí como
          ausente, no se estima ni se aproxima con otra cifra.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Umbrales pre-registrados y resultado</h2>
        <Separator className="mt-2" />
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Los umbrales de aprobación se fijaron antes de correr el clasificador sobre el
          golden set (pre-registro). El clasificador en producción (DeepSeek) aprobó con
          una exactitud macro de 87,66 % (intervalo de confianza 95 %: 81,3–91,8 %),
          medida sobre las tres clases del golden set con al menos 8 casos cada una.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Dos clases —tramitación legislativa y actividad parlamentaria— quedaron con un
          tamaño de muestra insuficiente (menos de 25 casos) para medir su propio umbral
          de precisión. Por una regla fijada antes del experimento, ninguna noticia se
          vincula automáticamente a una ficha de proyecto o de parlamentario por su
          clasificación mientras esa medición no exista. Es la razón por la que, hoy, el
          vínculo entre una noticia y un proyecto de ley es solo por mención textual del
          número de boletín en el titular o la bajada: un criterio determinista y
          verificable, no una inferencia del clasificador.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Limitaciones</h2>
        <Separator className="mt-2" />
        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
          <li>
            · Esta página describe el desempeño medido sobre los cinco medios
            monitoreados hoy; no dice nada sobre otros medios ni sobre la prensa chilena
            en general.
          </li>
          <li>
            · No se midió la estabilidad del clasificador en el tiempo: las cifras de
            esta página corresponden a la corrida descrita, no a una garantía continua.
          </li>
          <li>
            · La composición del conjunto de evaluación es artificial por diseño —se
            construyó para cubrir las seis clases, no para reflejar la mezcla real de
            titulares que produce la prensa día a día.
          </li>
          <li>
            · Toda cifra de esta página viaja con su tamaño de muestra (n) y su intervalo
            de confianza; ninguna se presenta sola.
          </li>
          <li>
            · El conjunto de evaluación está dominado por un solo medio: La Tercera
            representa aproximadamente el 68 % del estrato que pasó el filtro de
            selección.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Trazabilidad</h2>
        <Separator className="mt-2" />
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Los artefactos que respaldan esta página están congelados con hash sha256 en el
          repositorio público del proyecto, con su historial de cambios registrado:
        </p>
        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground font-mono">
          <li>· Taxonomía: 90981888…</li>
          <li>· Umbrales: e4285944…</li>
          <li>· Conjunto de referencia (golden set): 47ace935…</li>
          <li>· Veredicto del clasificador: 8fa3a690…</li>
        </ul>
      </section>

      <p className="mt-12 text-sm">
        <Link
          href="/metodologia"
          className="text-accent-product underline-offset-4 hover:underline"
        >
          ← Volver a Metodología
        </Link>
      </p>
    </main>
  );
}
