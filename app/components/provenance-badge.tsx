import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, safeExternalHref } from "@/lib/utils";
import { relativeTimeEs, esStale, fechaCorta } from "@/lib/format";
import {
  LEYENDA_RECURSO_NO_HUMANO,
  esServicioDeDatos,
} from "@/lib/recurso-no-humano";

/**
 * ProvenanceBadge — frescura + fuente (UI-SPEC §4, TRAM-09).
 *
 * Cada dato mostrado lleva "según fuente al {fecha} · {fuente} — fuente oficial ↗"
 * (o "recalculado por el Observatorio al {fecha}" cuando el reloj es un recálculo
 * interno nuestro y no una observación de la fuente).
 *
 * F-01 / F-11 (117-01, `116-FECHAS-AUDIT.md`): antes el rótulo era la RECENCIA de
 * nuestro scraping. Afirmaba que el DATO había cambiado hace X cuando lo único que ocurrió
 * fue NUESTRA consulta a la fuente — sobre un proyecto sin movimiento desde 2023
 * insinuaba actividad legislativa inexistente. La fecha de captura JAMÁS es el hecho.
 * La señal de recencia no se pierde: baja al tooltip ("consultado hace X").
 *
 * Si el dato tiene más de 14 días (umbral por cadence de ingesta, `STALE_THRESHOLD_MS`
 * en `lib/format.ts`) se marca en amber (no se oculta). Si no hay
 * procedencia, se muestra "fuente desconocida" SIN enlace — nunca se omite el
 * badge (UI-SPEC §6.3: su ausencia implicaría falsamente que el dato no tiene
 * fuente).
 */
/**
 * LEYENDA_RECURSO_NO_HUMANO / `esServicioDeDatos` (115-03, A-3/A-4/A-5).
 *
 * Viven en `@/lib/recurso-no-humano` (single-source) porque `timeline-event.tsx` también
 * los consume y el source-scan SC7 le prohíbe importar de este archivo. Se RE-EXPORTAN
 * aquí para no romper los imports existentes (`./provenance-badge`) — la definición es
 * UNA sola, jamás una copia.
 */
export {
  LEYENDA_RECURSO_NO_HUMANO,
  esServicioDeDatos,
} from "@/lib/recurso-no-humano";

export interface ProvenanceBadgeProps {
  /** Momento de captura. `null` → procedencia desconocida. */
  capturedAt: Date | null;
  /** "Cámara" | "Senado" | "BCN" — o "fuente desconocida" si null. */
  sourceName: string;
  /** Enlace directo a la fuente. `null` → sin enlace. */
  sourceUrl: string | null;
  /**
   * Densidad de la superficie que monta el badge (WR-04 de la review de 115).
   *
   * `"bloque"` (defecto) — el badge es único en su sección/encabezado: si el destino es
   * un servicio de datos, la limitación se declara como texto VISIBLE bajo el badge.
   *
   * `"lista"` — el badge se repite por FILA (votos, patrimonio, lobby, aportes,
   * contratos…). Ahí la leyenda de 90 caracteres se renderizaría N veces: es
   * exactamente el defecto que motivó retirar el badge por evento en SC7. En este modo
   * la limitación NO ocupa caja: viaja en el `title` del badge y en el tooltip, y la
   * superficie declara la limitación UNA vez por sección si corresponde. Además el badge
   * conserva su caja inline (`<span>` sin `flex-col`), de modo que las filas alineadas
   * horizontalmente no se desalinean (WR-05).
   */
  densidad?: "bloque" | "lista";
  /**
   * De QUIÉN es el reloj que marca `capturedAt` (F-02 de `116-FECHAS-AUDIT.md`).
   *
   * `"fuente"` (defecto) — `capturedAt` es cuándo consultamos a la fuente oficial ⇒
   * "según fuente al {fecha}".
   *
   * `"recalculo"` — `capturedAt` es el reloj de un proceso NUESTRO, no una observación
   * de la fuente. El caso que motivó la prop: `cruce_senal.fecha_captura` es el `now()`
   * del FULL REBUILD diario de los cruces, así que TODAS las señales comparten timestamp
   * y ninguna dice nada sobre cuándo la fuente publicó el hecho. Rotularlo "según fuente"
   * sería tan impreciso como el viejo "Actualizado" ⇒ "recalculado por el Observatorio
   * al {fecha}".
   */
  origenFecha?: "fuente" | "recalculo";
  /**
   * Califica la AGREGACIÓN cuando la fecha resume varias filas (F-03 de
   * `116-FECHAS-AUDIT.md`). Un badge de sección declara típicamente el `MAX` de las
   * fechas de N filas: sin la nota, el ciudadano no sabe de qué fila habla la fecha
   * (p.ej. `notaAgregacion="evento más reciente"` ⇒ "según fuente al 14 may 2026
   * (evento más reciente)"). Se renderiza verbatim entre paréntesis; el llamante es
   * responsable de que describa un HECHO, no un juicio.
   */
  notaAgregacion?: string;
}

export function ProvenanceBadge({
  capturedAt,
  sourceName,
  sourceUrl,
  densidad = "bloque",
  origenFecha = "fuente",
  notaAgregacion,
}: ProvenanceBadgeProps) {
  const stale = capturedAt !== null && esStale(capturedAt);
  const displaySource = capturedAt === null ? "fuente desconocida" : sourceName;
  // #9: solo se enlaza si el href es http(s) seguro; un `javascript:`/`data:`
  // proveniente de la fuente se degrada a "sin enlace" en vez de inyectar script.
  const safeUrl = safeExternalHref(sourceUrl);

  // LINK-EXT (115-03, A-3/A-4/A-5): destino oficial que es un servicio de datos y no
  // tiene página humana derivable → hay algo que DECLARAR.
  const declarar = esServicioDeDatos(safeUrl);

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-sm",
        "border-[var(--provenance-border)] bg-[var(--provenance-bg)] text-[var(--provenance-fg)]",
        stale && "text-amber-700 border-amber-400"
      )}
      title={declarar ? LEYENDA_RECURSO_NO_HUMANO : undefined}
    >
      <span
        className="w-1.5 h-1.5 rounded-full bg-[var(--provenance-fg)] opacity-60"
        aria-hidden="true"
      />
      {capturedAt !== null ? (
        // F-01: se rotula la FECHA (un hecho fechado y verificable), no la recencia de
        // nuestro scraping. El prefijo declara DE QUIÉN es el reloj (F-02) y la nota
        // opcional califica la agregación cuando la fecha resume N filas (F-03).
        <span>
          {origenFecha === "recalculo"
            ? "recalculado por el Observatorio al "
            : "según fuente al "}
          {fechaCorta(capturedAt)}
          {notaAgregacion !== undefined && ` (${notaAgregacion})`}
        </span>
      ) : (
        <span>Sin fecha de actualización</span>
      )}
      <span aria-hidden="true">·</span>
      <span>{displaySource}</span>
      {safeUrl !== null && (
        <>
          <span aria-hidden="true">—</span>
          <a
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
            aria-label={`Fuente oficial: ${displaySource} (abre en nueva pestaña)`}
          >
            fuente oficial ↗
          </a>
        </>
      )}
    </span>
  );

  // Sin procedencia: no hay timestamp/URL crudos que mostrar en tooltip.
  if (capturedAt === null && safeUrl === null) {
    return badge;
  }

  // IN-06: UN solo bloque de tooltip (antes estaba escrito dos veces, una por rama de
  // retorno — una edición futura de uno de los dos habría derivado en silencio).
  // La leyenda también viaja aquí: en `densidad="lista"` es el único lugar donde el
  // ciudadano la puede leer completa sin que se repita N veces.
  const conTooltip = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <div className="font-mono text-xs leading-relaxed">
            {capturedAt !== null && <div>{capturedAt.toISOString()}</div>}
            {/* F-01: la recencia NO desaparece — deja de ser el rótulo principal y
                pasa a ser lo que siempre fue: cuándo consultamos nosotros. */}
            {capturedAt !== null && (
              <div>consultado {relativeTimeEs(capturedAt)}</div>
            )}
            {safeUrl !== null && <div>{safeUrl}</div>}
            {declarar && <div>{LEYENDA_RECURSO_NO_HUMANO}</div>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  // LINK-EXT (115-03, A-3/A-4/A-5): si el destino oficial es un servicio de datos y
  // no hay página humana derivable, se DECLARA la limitación junto al badge — sin
  // quitar el enlace (el ciudadano igual puede ir) y sin fabricar una URL humana.
  //
  // WR-04/WR-05: sólo en `densidad="bloque"`. En una LISTA la leyenda se renderizaría
  // por fila (el defecto que motivó SC7) y el envoltorio `inline-flex flex-col`
  // cambiaría la caja del badge, desalineando filas que lo colocan en celdas
  // horizontales. En `densidad="lista"` la limitación viaja en el `title` del badge y
  // en el tooltip, y la estructura del DOM queda EXACTAMENTE igual que sin declaración.
  if (declarar && densidad === "bloque") {
    return (
      <span className="inline-flex flex-col items-start gap-1">
        {conTooltip}
        <span className="text-xs text-muted-foreground">
          {LEYENDA_RECURSO_NO_HUMANO}
        </span>
      </span>
    );
  }

  return conTooltip;
}
