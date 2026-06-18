import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * EtapaBadge — badge de estado/etapa del proyecto y resultado de votación
 * (UI-SPEC §3.1.1 + §3.3). Usa shadcn Badge con className (sin variantes
 * nuevas en components.json).
 */

interface EtapaVariant {
  label: string;
  className: string;
}

// Mapeo por palabra clave del estado/resultado crudo de la fuente.
function resolveVariant(value: string | null): EtapaVariant {
  const v = (value ?? "").toLowerCase();

  if (v.includes("promulg") || v.includes("ley")) {
    return {
      label: value ?? "Promulgado / Ley",
      className: "bg-emerald-100 text-emerald-800",
    };
  }
  if (v.includes("aprob")) {
    return { label: value ?? "Aprobado", className: "bg-green-100 text-green-800" };
  }
  if (v.includes("rechaz")) {
    return { label: value ?? "Rechazado", className: "bg-red-100 text-red-800" };
  }
  if (v.includes("empate")) {
    return { label: value ?? "Empate", className: "bg-amber-100 text-amber-800" };
  }
  if (v.includes("archiv")) {
    return { label: value ?? "Archivado", className: "bg-slate-100 text-slate-600" };
  }
  if (v.includes("tramit")) {
    return { label: value ?? "En tramitación", className: "bg-blue-100 text-blue-800" };
  }
  if (value && value.trim().length > 0) {
    return { label: value, className: "bg-slate-100 text-slate-600" };
  }
  return { label: "Estado desconocido", className: "bg-slate-100 text-slate-500" };
}

export function EtapaBadge({ estado }: { estado: string | null }) {
  const { label, className } = resolveVariant(estado);
  return (
    <Badge variant="outline" className={cn("border-transparent", className)}>
      {label}
    </Badge>
  );
}
