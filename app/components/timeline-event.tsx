import { CamaraChip, camaraDotColor } from "@/components/camara-chip";
import { enlaceHumanoProyecto } from "@/components/validacion-fuente";
import { cn, safeExternalHref } from "@/lib/utils";
import { fechaCorta } from "@/lib/format";
import type { TramitacionEventoRow } from "@/lib/types";

/**
 * TimelineEvent — fila de un evento del timeline (UI-SPEC §3.2).
 * Rail izquierdo CSS (sin SVG); dot coloreado por cámara; CamaraChip + fecha
 * (mono) + tipo + descripción + "Ver fuente oficial ↗".
 *
 * SC7: el `ProvenanceBadge` por-evento se RETIRÓ (había 100+ badges idénticos en un
 * timeline largo); ahora hay UN solo badge en el heading de la sección (page.tsx).
 * La trazabilidad por dato se conserva con el link "Ver fuente oficial ↗" por evento.
 */
export function TimelineEvent({ evento }: { evento: TramitacionEventoRow }) {
  const fecha = evento.fecha ? new Date(evento.fecha) : null;

  // LINK-EXT (115-03, A-2). Dos correcciones sobre el mismo href:
  //  (1) `enlaceHumanoProyecto` — en PROD las 982 filas de `tramitacion_evento` con
  //      host `tramitacion.senado.cl` tienen path `/wspublico/` (115-VEREDICTO §3), y
  //      ese endpoint devuelve XML VACÍO a quien hace clic. El rewrite lo lleva a la
  //      ficha humana del boletín. El boletín NO se threadea desde `timeline-view`:
  //      viaja DENTRO de la fila (`TramitacionEventoRow.boletin` es `string`
  //      no-nulable, `lib/types.ts:32-33`, 0 nulos en PROD). Cualquier otro host o
  //      path se devuelve verbatim (el rewrite decide por host+path, no por substring).
  //  (2) `safeExternalHref` — este `<a>` era el ÚLTIMO emisor externo del sitio que se
  //      saltaba el guard anti-XSS que el resto ya aplica (validacion-fuente.tsx:123).
  //      Si el guard devuelve null, NO se emite el `<a>`: se pierde el enlace, jamás
  //      el hecho (el evento sigue visible).
  const hrefFuente = evento.enlace
    ? safeExternalHref(enlaceHumanoProyecto(evento.enlace, evento.boletin))
    : null;

  return (
    <li className="relative mb-6 last:mb-0">
      <span
        className={cn(
          "absolute -left-[17px] top-2 w-3 h-3 rounded-full border-2 border-background",
          camaraDotColor(evento.camara)
        )}
        aria-hidden="true"
      />

      <div className="flex flex-wrap items-center gap-2">
        <CamaraChip camara={evento.camara} />
        {fecha && (
          <span className="font-mono text-sm text-muted-foreground leading-none">
            {fechaCorta(fecha)}
          </span>
        )}
      </div>

      <p className="text-sm font-semibold mt-1 capitalize">{evento.tipo}</p>
      <p className="text-base leading-relaxed mt-1">{evento.descripcion}</p>

      {hrefFuente !== null && (
        <a
          href={hrefFuente}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline-offset-2 underline mt-2 min-h-[44px] flex items-center"
          aria-label="Ver fuente oficial (abre en nueva pestaña)"
        >
          Ver fuente oficial ↗
        </a>
      )}
    </li>
  );
}
