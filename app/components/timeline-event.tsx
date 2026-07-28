import { CamaraChip, camaraDotColor } from "@/components/camara-chip";
import { enlaceHumanoProyecto } from "@/components/validacion-fuente";
import { cn, safeExternalHref } from "@/lib/utils";
import { fechaHechoCorta, fechaPlausible } from "@/lib/format";
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
        {/*
          F-04: blindaje LOCAL. `fecha` la construye el LLAMANTE; si no pasó por
          `fechaValida` (timeline-view), el typo de siglo real de PROD
          (boletín 18232-25, `2626-05-25`) llegaría al DOM. Fuera del rango plausible
          se OMITE el `<span>` completo — jamás un placeholder inventado; el hecho
          (tipo + descripción + fuente) sigue visible, sólo se pierde la fecha basura.

          F-05: `fechaHechoCorta`, NO `fechaCorta`. La columna `tramitacion_evento.fecha`
          mezcla DOS semánticas: filas con hora REAL del hecho (una votación a las
          00:14 UTC ocurrió el día ANTERIOR en Chile — drift real en 27 filas) y filas
          date-only DISFRAZADAS de medianoche UTC (44.569, donde la parte fecha UTC YA
          ES el día publicado). Convertir todo a la zona de Chile a ciegas rompería
          estas últimas; `fechaHechoCorta` ramifica por presencia de hora.

          F-07: rótulo del hito. Aquí la fecha NO es adyacente a la descripción (vive
          en el header junto al CamaraChip; `{evento.descripcion}` está en un `<p>`
          aparte, más abajo), así que un separador no diría de qué es la fecha. El
          rótulo usado abajo es el idiom ya registrado en el fixture del linter
          anti-insinuación (Plan 01, Task 1) — no se inventa uno distinto.
        */}
        {fecha && fechaPlausible(fecha) && (
          <span className="text-sm text-muted-foreground leading-none">
            Hito del <span className="font-mono">{fechaHechoCorta(fecha)}</span>
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
