import { CamaraChip, camaraDotColor } from "@/components/camara-chip";
import { enlaceHumanoProyecto } from "@/components/validacion-fuente";
import { cn, safeExternalHref } from "@/lib/utils";
import { fechaCorta } from "@/lib/format";
import {
  LEYENDA_RECURSO_NO_HUMANO,
  esServicioDeDatos,
} from "@/lib/recurso-no-humano";
import type { TramitacionEventoRow } from "@/lib/types";

/**
 * Href FINAL de la fuente de un evento (post-rewrite A-2, post-guard anti-XSS), o
 * `null` si no hay enlace emitible. Exportado (CR-01): `TimelineView` lo reusa para
 * decidir, SIN re-derivar la lógica, si la lista contiene algún destino que sea un
 * servicio de datos y por tanto debe declarar la limitación UNA vez por contenedor.
 *
 * (1) `enlaceHumanoProyecto` — en PROD las 982 filas de `tramitacion_evento` con
 *     host `tramitacion.senado.cl` tienen path `/wspublico/` (115-VEREDICTO §3), y
 *     ese endpoint devuelve XML VACÍO a quien hace clic. El rewrite lo lleva a la
 *     ficha humana del boletín. El boletín NO se threadea desde `timeline-view`:
 *     viaja DENTRO de la fila (`TramitacionEventoRow.boletin` es `string`
 *     no-nulable, `lib/types.ts:32-33`, 0 nulos en PROD). Cualquier otro host o
 *     path se devuelve verbatim (el rewrite decide por host+path, no por substring).
 * (2) `safeExternalHref` — este `<a>` era el ÚLTIMO emisor externo del sitio que se
 *     saltaba el guard anti-XSS que el resto ya aplica (validacion-fuente.tsx:123).
 *     Si el guard devuelve null, NO se emite el `<a>`: se pierde el enlace, jamás
 *     el hecho (el evento sigue visible).
 */
export function hrefFuenteDeEvento(
  evento: TramitacionEventoRow,
): string | null {
  return evento.enlace
    ? safeExternalHref(enlaceHumanoProyecto(evento.enlace, evento.boletin))
    : null;
}

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

  // LINK-EXT (115-03, A-2): rewrite a recurso humano + guard anti-XSS (ver JSDoc de
  // `hrefFuenteDeEvento`).
  const hrefFuente = hrefFuenteDeEvento(evento);

  // LINK-EXT (115-03, A-3 — CR-01 de la review). Tras el rewrite A-2 los enlaces del
  // Senado ya apuntan al recurso humano; los que QUEDAN apuntando a un servicio de
  // datos son, sobre todo, las 3.797 filas de `opendata.camara.cl` (respuesta live:
  // HTTP 500 "Falta el parámetro: prmBoletin"). Rotularlos "fuente oficial" sin decir
  // a QUÉ se llega sería una afirmación falsa hacia el ciudadano.
  //
  // WR-04 (patrón SC7): en una lista larga la leyenda NO se repite por fila — el texto
  // visible se declara UNA vez por contenedor en `TimelineView`. Por fila la limitación
  // viaja en el nombre accesible y en el `title`, que no ocupan caja ni se duplican
  // visualmente.
  const esDatos = esServicioDeDatos(hrefFuente);
  const etiquetaFuente = esDatos
    ? `Ver fuente oficial (abre en nueva pestaña). ${LEYENDA_RECURSO_NO_HUMANO}`
    : "Ver fuente oficial (abre en nueva pestaña)";

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
          aria-label={etiquetaFuente}
          title={esDatos ? LEYENDA_RECURSO_NO_HUMANO : undefined}
        >
          Ver fuente oficial ↗
        </a>
      )}
    </li>
  );
}
