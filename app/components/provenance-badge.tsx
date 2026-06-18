import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, safeExternalHref } from "@/lib/utils";
import { relativeTimeEs, esStale } from "@/lib/format";

/**
 * ProvenanceBadge — frescura + fuente (UI-SPEC §4, TRAM-09).
 *
 * Cada dato mostrado lleva "Actualizado hace X · {fuente} — fuente oficial ↗".
 * Si el dato tiene más de 48h se marca en amber (no se oculta). Si no hay
 * procedencia, se muestra "fuente desconocida" SIN enlace — nunca se omite el
 * badge (UI-SPEC §6.3: su ausencia implicaría falsamente que el dato no tiene
 * fuente).
 */
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
        "border-[--provenance-border] bg-[--provenance-bg] text-[--provenance-fg]",
        stale && "text-amber-700 border-amber-400"
      )}
    >
      <span
        className="w-1.5 h-1.5 rounded-full bg-[--provenance-fg] opacity-60"
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
