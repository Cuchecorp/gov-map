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
/**
 * LEYENDA_RECURSO_NO_HUMANO (115-03, acciones A-3/A-4/A-5 de `115-VEREDICTO.md`).
 *
 * Hay destinos oficiales para los que NO existe una página de consulta derivable con
 * los datos en mano: `opendata.camara.cl/...getVotaciones_Boletin` exige un `prmID`
 * que no acompaña a `tramitacion_evento` ni a `votacion` (A-3); `web-back.senado.cl/api/*`
 * y los `/wspublico/*` sin parámetro de fila entregan JSON/XML a una máquina, y su
 * `?limit=100` es paginación, no identidad (A-4); `datos.cplt.cl/sparql` recibe una
 * consulta persistida por la INGESTA, deuda registrada aparte (A-5). En vez de fabricar
 * una URL humana o de callar, se DECLARA la limitación.
 *
 * El copy describe el FORMATO en que la fuente publica el dato. JAMÁS su intención: que
 * un organismo publique un servicio de datos no significa que oculte, esconda ni se
 * niegue a publicar nada (el carril LINK-EXT de `anti-insinuacion-guard.test.ts` caza
 * ese vocabulario, y verifica que ESTA leyenda esté limpia).
 */
export const LEYENDA_RECURSO_NO_HUMANO =
  "La fuente oficial publica este dato como servicio de datos, no como página de consulta.";

/**
 * `true` si el destino es un servicio de datos oficial sin página humana derivable.
 *
 * Lista CERRADA derivada de la muestra live de `115-MUESTRA.json` (§2 del veredicto),
 * decidida SIEMPRE por host + path, NUNCA por substring suelto del string completo: el
 * literal "wspublico" en el query de otro host no debe declarar nada. Si la URL no
 * parsea, se devuelve `false` — se declara sólo lo que se puede probar.
 */
export function esServicioDeDatos(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();
    // A-3: los web services de la Cámara (`*.asmx`) — el host entero es de datos.
    if (host === "opendata.camara.cl") return true;
    // A-4: la API del portal del Senado (paginación, sin identidad de fila).
    if (host === "web-back.senado.cl" && path.startsWith("/api/")) return true;
    // A-4: los endpoints WS del Senado que no son la ficha humana.
    if (host === "tramitacion.senado.cl" && path.includes("/wspublico/")) return true;
    // A-5: el endpoint SPARQL del Consejo para la Transparencia.
    if (host === "datos.cplt.cl" && path.includes("/sparql")) return true;
  } catch {
    // URL malformada → no se afirma nada sobre ella.
  }
  return false;
}

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
