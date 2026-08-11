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
 * Honest-error (#34): un fallo real de DB/red se LANZA, nunca se degrada a
 * "sin prensa". `boletines_detectados` está vacía en todas las filas hoy — el
 * empty es el estado normal, no un defecto de la sección.
 *
 * El h2 vive DENTRO del componente (regla de frontera, page.tsx:193-215): el
 * degrade honesto nunca deja un heading huérfano.
 */

interface NoticiaDeProyectoRow {
  url_hash: string;
  titular: string;
  outlet: string | null;
  fecha_pub: string | null;
  url: string;
}

const NOTA_METODO =
  "Vínculo por mención textual del boletín en titular o bajada (detección determinista). No implica relación entre el medio y el proyecto.";

export async function NoticiasDeProyecto({ boletin }: { boletin: string }) {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("noticia")
    .select("url_hash, titular, outlet, fecha_pub, url")
    .contains("boletines_detectados", [boletin])
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

  if (noticias.length === 0) {
    return (
      <>
        <h2 className="text-xl font-semibold mb-4">
          Prensa que menciona este boletín
        </h2>
        <p className="text-sm text-muted-foreground">
          Ningún titular o bajada de la prensa monitoreada menciona textualmente
          este boletín.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">{NOTA_METODO}</p>
      </>
    );
  }

  return (
    <>
      <h2 className="text-xl font-semibold mb-4">
        Prensa que menciona este boletín
      </h2>
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
      <p className="mt-4 text-sm text-muted-foreground">{NOTA_METODO}</p>
    </>
  );
}
