import { extractoIdea } from "@/lib/format";
import { hrefProyecto, type AnclaProyecto } from "@/lib/links-internos";

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
        <a
          href={hrefProyecto(boletin, ancla)}
          className="text-[15px] font-medium leading-snug hover:underline"
        >
          {titulo ? `${boletin} — ${titulo}` : boletin}
        </a>
        {detalle ? (
          <div className="text-[13px] text-muted-foreground">{detalle}</div>
        ) : null}
      </div>
    );
  }

  // en_corpus:false (o sin boletín): CERO href /proyecto interno. Si hay
  // enlaceFuente, se ofrece como enlace externo trazable a la fuente.
  return (
    <div className="flex flex-col gap-[14px]">
      {etiqueta ? (
        <span className="text-[15px] font-medium leading-snug">{etiqueta}</span>
      ) : textoAlterno ? (
        <span className="text-[15px] leading-snug">
          {extractoIdea(textoAlterno, MAX_TEXTO_ALTERNO)}
        </span>
      ) : null}
      {enlaceFuente ? (
        <a
          href={enlaceFuente}
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
