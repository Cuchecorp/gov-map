import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, safeExternalHref } from "@/lib/utils";
import { relativeTimeEs, esStale } from "@/lib/format";
import {
  LEYENDA_RECURSO_NO_HUMANO,
  esServicioDeDatos,
} from "@/lib/recurso-no-humano";

/**
 * ProvenanceBadge — frescura + fuente (UI-SPEC §4, TRAM-09).
 *
 * Cada dato mostrado lleva "Actualizado hace X · {fuente} — fuente oficial ↗".
 * Si el dato tiene más de 48h se marca en amber (no se oculta). Si no hay
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
}

export function ProvenanceBadge({
  capturedAt,
  sourceName,
  sourceUrl,
}: ProvenanceBadgeProps) {
  const stale = capturedAt !== null && esStale(capturedAt);
  const displaySource = capturedAt === null ? "fuente desconocida" : sourceName;
  // #9: solo se enlaza si el href es http(s) seguro; un `javascript:`/`data:`
  // proveniente de la fuente se degrada a "sin enlace" en vez de inyectar script.
  const safeUrl = safeExternalHref(sourceUrl);

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-sm",
        "border-[var(--provenance-border)] bg-[var(--provenance-bg)] text-[var(--provenance-fg)]",
        stale && "text-amber-700 border-amber-400"
      )}
    >
      <span
        className="w-1.5 h-1.5 rounded-full bg-[var(--provenance-fg)] opacity-60"
        aria-hidden="true"
      />
      {capturedAt !== null ? (
        <span>Actualizado {relativeTimeEs(capturedAt)}</span>
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

  // LINK-EXT (115-03, A-3/A-4/A-5): si el destino oficial es un servicio de datos y
  // no hay página humana derivable, se DECLARA la limitación junto al badge — sin
  // quitar el enlace (el ciudadano igual puede ir) y sin fabricar una URL humana.
  // Sólo se envuelve el badge cuando hay algo que declarar: para el resto de los
  // destinos la estructura del DOM queda EXACTAMENTE igual que antes.
  if (esServicioDeDatos(safeUrl)) {
    return (
      <span className="inline-flex flex-col items-start gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{badge}</TooltipTrigger>
            <TooltipContent>
              <div className="font-mono text-xs leading-relaxed">
                {capturedAt !== null && <div>{capturedAt.toISOString()}</div>}
                {safeUrl !== null && <div>{safeUrl}</div>}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className="text-xs text-muted-foreground">
          {LEYENDA_RECURSO_NO_HUMANO}
        </span>
      </span>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <div className="font-mono text-xs leading-relaxed">
            {capturedAt !== null && <div>{capturedAt.toISOString()}</div>}
            {safeUrl !== null && <div>{safeUrl}</div>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
