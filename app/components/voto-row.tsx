import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { IdentityMarker } from "@/components/identity-marker";
import { formatNombre } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { VotoRow as VotoRowData, Seleccion } from "@/lib/types";

/**
 * VotoRow — fila de un voto individual (UI-SPEC §3.3 + §5, guarda TRAM-06).
 *
 * GUARDA DE IDENTIDAD (riesgo existencial #1): el nombre se muestra como enlace
 * a la ficha del parlamentario SOLO si `estado_vinculo === 'confirmado'` Y
 * `parlamentario_id` está presente. En cualquier otro caso se muestra el nombre
 * crudo (`mencion_nombre`) en un <span> acompañado de <IdentityMarker/>.
 * NUNCA se afirma una identidad no confirmada como enlace.
 */

export const SELECCION_STYLE: Record<
  Seleccion,
  { label: string; className: string }
> = {
  si: { label: "Sí", className: "bg-green-100 text-green-800" },
  no: { label: "No", className: "bg-red-100 text-red-800" },
  abstencion: { label: "Abstención", className: "bg-amber-100 text-amber-800" },
  pareo: { label: "Pareo", className: "bg-slate-100 text-slate-600" },
  // VOTE-03 (UI-SPEC §3.2): asistencia rendida con fidelidad — "Ausente" NUNCA se
  // colapsa a "no votó". Slate neutro, sin color de juicio. Siempre con label de texto.
  ausente: { label: "Ausente", className: "bg-slate-100 text-slate-500" },
};

export function VotoRow({ voto }: { voto: VotoRowData }) {
  const confirmado =
    voto.estado_vinculo === "confirmado" && voto.parlamentario_id != null;

  const sel = SELECCION_STYLE[voto.seleccion];

  return (
    <li className="flex items-center justify-between gap-2 py-1 text-sm">
      <span className="flex items-center">
        {confirmado ? (
          <Link
            href={`/parlamentario/${voto.parlamentario_id}`}
            className="text-primary underline underline-offset-2"
          >
            {formatNombre(voto.mencion_nombre)}
          </Link>
        ) : (
          <>
            <span>{formatNombre(voto.mencion_nombre)}</span>
            <IdentityMarker />
          </>
        )}
      </span>
      <Badge
        variant="outline"
        className={cn("border-transparent shrink-0", sel.className)}
      >
        {sel.label}
      </Badge>
    </li>
  );
}
