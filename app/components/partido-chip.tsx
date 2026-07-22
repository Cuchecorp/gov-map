import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fechaCorta } from "@/lib/format";
import { sourceLabel } from "@/lib/types";

/**
 * PartidoChip — chip REUTILIZABLE del partido de la militancia VIGENTE (91-UI-SPEC
 * §Component 2). Espejo estructural de `CamaraChip`, pero con una diferencia LOCKED:
 *
 *   NEUTRALIDAD DE COLOR (§Color): el chip usa fondo `bg-muted` + `border-border` +
 *   texto `text-foreground`, IDÉNTICO para TODOS los partidos. NO existe una paleta
 *   partidista — el color JAMÁS codifica bloque, afinidad ni identidad política
 *   (principio anti-insinuación). Esto lo separa de CamaraChip, que sí usa color
 *   institucional (cámara/senado).
 *
 * OMISIÓN HONESTA: sin partido (null/vacío) → retorna `null` (se OMITE), espejo
 * EXACTO de CamaraChip desconocida. NUNCA "Sin partido" ni placeholder — el dato
 * ausente no se comunica como defecto.
 *
 * PROVENANCE: el subtexto "según {fuente} al {fecha}" vive en un Tooltip Radix
 * (idiom ProvenanceBadge) para no saturar la fila de chips; la fecha va en font-mono
 * (`fechaCorta`). El chip NUNCA dice "actual" sin la fecha de fuente. El `aria-label`
 * expone partido + fuente + fecha a lectores de pantalla.
 *
 * Consumido por: header de ficha (Plan 02) y cross-links/directorio (Plan 03).
 */
export function PartidoChip({
  partido,
  fechaCaptura,
  origen,
}: {
  partido: string | null;
  fechaCaptura: string | Date | null;
  origen: string | null;
}) {
  // Omisión honesta: sin partido → no se renderiza nada (espejo CamaraChip).
  const nombre = (partido ?? "").trim();
  if (nombre === "") return null;

  const fuente = sourceLabel(origen);
  const fecha =
    fechaCaptura != null
      ? fechaCorta(
          fechaCaptura instanceof Date ? fechaCaptura : new Date(fechaCaptura),
        )
      : null;

  // Subtexto de procedencia LOCKED. Si no hay fecha, el chip sigue mostrando la
  // fuente (nunca "actual" a secas) — pero jamás fabrica una fecha.
  const provenance = fecha
    ? `según ${fuente} al ${fecha}`
    : `según ${fuente}`;

  const aria = `Partido: ${nombre}, ${provenance}`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            data-slot="partido-chip"
            aria-label={aria}
            // NEUTRO — bg-muted idéntico por partido; JAMÁS color partidista.
            className={cn("bg-muted border-border text-foreground")}
          >
            {nombre}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <span className="text-xs">
            según {fuente}
            {fecha && (
              <>
                {" al "}
                <span className="font-mono">{fecha}</span>
              </>
            )}
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
