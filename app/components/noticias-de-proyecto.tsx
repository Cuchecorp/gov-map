import { createServerSupabase } from "@/lib/supabase";
import { fechaHechoCortaSegura } from "@/lib/format";
import { safeExternalHref } from "@/lib/utils";

/**
 * Sección "Prensa" de la ficha de proyecto (Phase 137) — noticias de la prensa
 * monitoreada cuyo titular o bajada MENCIONA TEXTUALMENTE el número de este
 * boletín (`noticia.boletines_detectados`, detección determinista — NO
 * clasificación por tema). El vínculo noticia→proyecto es SOLO por mención
 * textual: la clasificación temática de la noticia (ver /metodologia/prensa)
 * NO enruta ninguna noticia a ninguna ficha hoy — clases con n insuficiente
 * quedan sin medir, y por regla previa al experimento nada se vincula
 * automáticamente mientras eso no se mida (D-133-D2, fail-closed).
 *
 * `NoticiasDeProyectoView` es PURA (props) → RTL la testea con fixtures, sin
 * runtime Supabase/Next. `NoticiasDeProyecto` es el Server Component que lee
 * la tabla. Honest-error (#34): un fallo real de DB/red se LANZA, nunca se
 * degrada a "sin prensa". `boletines_detectados` está vacía en todas las
 * filas hoy — el empty es el estado normal, no un defecto de la sección.
 *
 * El h2 vive DENTRO de la vista (regla de frontera, page.tsx:193-215): el
 * degrade honesto nunca deja un heading huérfano.
 */

export interface NoticiaDeProyectoRow {
  url_hash: string;
  titular: string;
  outlet: string | null;
  fecha_pub: string | null;
  url: string;
}

// prettier-ignore — SOLO string literal en una línea (el linter anti-insinuación
// resta esta nota VERBATIM del source si algún día negara un término prohibido;
// hoy no niega ninguno, así que no requiere entrada en NEGACIONES_LOCKED).
// eslint-disable-next-line
export const NOTA_METODO_PRENSA = "Vínculo por mención textual del boletín en titular o bajada (detección determinista). No implica relación entre el medio y el proyecto.";

// eslint-disable-next-line
export const EMPTY_PRENSA = "Ningún titular o bajada de la prensa monitoreada menciona textualmente este boletín.";

// ── Vista pura (RTL la testea con fixtures) ─────────────────────────────────────
export function NoticiasDeProyectoView({
  noticias,
}: {
  noticias: NoticiaDeProyectoRow[];
}) {
  const heading = (
    <h2 className="text-xl font-semibold mb-4">
      Prensa que menciona este boletín
    </h2>
  );

  if (noticias.length === 0) {
    return (
      <>
        {heading}
        <p className="text-sm text-muted-foreground">{EMPTY_PRENSA}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          {NOTA_METODO_PRENSA}
        </p>
      </>
    );
  }

  return (
    <>
      {heading}
      <ul className="divide-y divide-border">
        {noticias.map((n) => {
          const href = safeExternalHref(n.url);
          return (
            <li key={n.url_hash} className="py-3 first:pt-0">
              <p className="text-base leading-relaxed">
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 text-accent-product"
                  >
                    {n.titular}
                  </a>
                ) : (
                  n.titular
                )}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {n.outlet ?? "Medio no informado"} ·{" "}
                <span className="font-mono">
                  {fechaHechoCortaSegura(n.fecha_pub)}
                </span>
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm text-muted-foreground">
        {NOTA_METODO_PRENSA}
      </p>
    </>
  );
}

// ── Server Component: lee `noticia` filtrando por mención textual del boletín ──
//
// Dos formas canónicas de mención (regla de `extraerBoletines`): con sufijo ("14309-04")
// y base pelada ("14309", cuando el texto dice "boletín 14309"). La base solo se atribuye
// a ESTA ficha si es ÚNICA en `proyecto` (misma regla fail-closed del resolver de 134:
// base compartida por dos sufijos ⇒ ambigua ⇒ no se atribuye a ninguno).
export async function NoticiasDeProyecto({ boletin }: { boletin: string }) {
  const sb = createServerSupabase();
  const base = boletin.split("-")[0] ?? boletin;

  const { count: proyectosConBase, error: errorBase } = await sb
    .from("proyecto")
    .select("boletin", { count: "exact", head: true })
    .eq("boletin_num", base);
  if (errorBase) {
    throw new Error(`No se pudo verificar la unicidad del boletín ${boletin}: ${errorBase.message}`);
  }
  const baseEsUnica = proyectosConBase === 1;

  const filtro = baseEsUnica
    ? `boletines_detectados.cs.{${boletin}},boletines_detectados.cs.{${base}}`
    : `boletines_detectados.cs.{${boletin}}`;
  const { data, error } = await sb
    .from("noticia")
    .select("url_hash, titular, outlet, fecha_pub, url")
    .or(filtro)
    .order("fecha_pub", { ascending: false })
    .limit(20);

  // #34 honest-error: un fallo real de DB/red no es "ninguna noticia menciona este
  // boletín" — se lanza para la página de error honesta en vez de fabricar un
  // silencio que se leería como ausencia de cobertura.
  if (error) {
    throw new Error(
      `No se pudo leer la prensa que menciona el boletín ${boletin}: ${error.message}`,
    );
  }

  const noticias = (data as NoticiaDeProyectoRow[] | null) ?? [];
  return <NoticiasDeProyectoView noticias={noticias} />;
}
