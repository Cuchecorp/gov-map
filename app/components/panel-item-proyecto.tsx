import Link from "next/link";
import { extractoIdea } from "@/lib/format";
import { hrefProyecto, type AnclaProyecto } from "@/lib/links-internos";

/**
 * WR-10: `enlaceFuente` viene del jsonb (`proyecto.enlace` / `citacion.enlace`),
 * campo de ORIGEN SCRAPEADO. React solo ADVIERTE ante `href="javascript:…"`, no
 * lo bloquea, y `rel="noopener noreferrer"` no cubre el esquema. Solo http/https
 * llegan al DOM; cualquier otro esquema (o URL no parseable) degrada a `null` y
 * el enlace no se emite.
 */
export function hrefExternoSeguro(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const p = new URL(u);
    return p.protocol === "https:" || p.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

/**
 * PanelItemProyecto — ítem nombrado reusable con guard `en_corpus` (Phase 128,
 * PANEL-05). RSC puro (JAMÁS "use client") — componente síncrono de
 * presentación, sin fetch propio; cada tile del panel le pasa los datos ya
 * resueltos.
 *
 * REGLA DURA (T-128-03): `enCorpus:false` NUNCA emite un `href` interno
 * `/proyecto/...` (evita un 404 de ficha inexistente) — en su lugar, si hay
 * `enlaceFuente`, emite un enlace externo con `target="_blank"` y
 * `rel="noopener noreferrer"` (T-128-02: sin `rel`, la pestaña abierta obtiene
 * `window.opener`).
 *
 * Nombre de archivo CONGELADO (D-05): `panel-item-proyecto.tsx` — declarado en
 * `SUPERFICIES_PANEL` del guard anti-insinuación; el anti-drift `(1f)` muerde
 * cualquier `panel-*.tsx` no declarado.
 *
 * Interpolación de `titulo`/`textoAlterno` SIEMPRE por JSX (escapado por
 * defecto) — JAMÁS `dangerouslySetInnerHTML` (T-128-01): el texto viene de
 * fuente externa (jsonb de la RPC).
 */
export interface PanelItemProyectoProps {
  boletin: string | null;
  titulo: string | null;
  enCorpus: boolean;
  ancla?: AnclaProyecto; // default "estado"
  detalle?: React.ReactNode; // línea de hecho fechado con verbo (la aporta cada tile)
  textoAlterno?: string | null; // usado cuando no hay boletín/corpus (p.ej. `materia`)
  enlaceFuente?: string | null; // enlace externo de la fuente para en_corpus:false
}

const MAX_TEXTO_ALTERNO = 120;

export function PanelItemProyecto({
  boletin,
  titulo,
  enCorpus,
  ancla = "estado",
  detalle,
  textoAlterno,
  enlaceFuente,
}: PanelItemProyectoProps) {
  // Etiqueta: título si existe; si no, el boletín solo (nunca "null"/"undefined"
  // fabricado). Si no hay ni título ni boletín, cae a textoAlterno más abajo.
  const etiqueta = titulo ?? boletin ?? null;

  if (enCorpus && boletin) {
    return (
      <div className="flex flex-col gap-[14px]">
        {/* WR-11: link interno ⇒ next/link (prefetch, sin full reload). */}
        <Link
          href={hrefProyecto(boletin, ancla)}
          className="text-[15px] font-medium leading-snug hover:underline"
        >
          {titulo ? `${boletin} — ${titulo}` : boletin}
        </Link>
        {detalle ? (
          <div className="text-[13px] text-muted-foreground">{detalle}</div>
        ) : null}
      </div>
    );
  }

  // en_corpus:false (o sin boletín): CERO href /proyecto interno. Si hay
  // enlaceFuente, se ofrece como enlace externo trazable a la fuente — validado
  // por esquema (WR-10).
  const hrefExterno = hrefExternoSeguro(enlaceFuente);

  return (
    <div className="flex flex-col gap-[14px]">
      {titulo ? (
        <span className="text-[15px] font-medium leading-snug">{titulo}</span>
      ) : textoAlterno ? (
        // WR-16: sin `titulo`, la `materia` es el texto descriptivo — antes
        // `etiqueta = titulo ?? boletin` ganaba y el punto no-corpus se
        // renderizaba como "18258-07" pelado, descartando la materia que la
        // fuente sí informó. El boletín pasa a complemento cuando existe.
        <span className="text-[15px] leading-snug">
          {boletin
            ? `${boletin} — ${extractoIdea(textoAlterno, MAX_TEXTO_ALTERNO)}`
            : extractoIdea(textoAlterno, MAX_TEXTO_ALTERNO)}
        </span>
      ) : etiqueta ? (
        <span className="text-[15px] font-medium leading-snug">{etiqueta}</span>
      ) : null}
      {hrefExterno ? (
        <a
          href={hrefExterno}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-muted-foreground hover:underline"
        >
          Ver fuente ↗
        </a>
      ) : null}
      {detalle ? (
        <div className="text-[13px] text-muted-foreground">{detalle}</div>
      ) : null}
    </div>
  );
}
