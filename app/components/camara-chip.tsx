import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * CamaraChip — chip visual Cámara vs Senado (UI-SPEC §3.1.1).
 * Colores institucionales (NO partidistas): Cámara azul, Senado burdeos.
 * Acepta tanto el valor de `votacion.camara` ("diputados"/"senado") como el
 * `proyecto.camara_origen` o `evento.camara` en texto libre.
 */

type CamaraKind = "diputados" | "senado" | "desconocida";

function classify(value: string | null): CamaraKind {
  const v = (value ?? "").toLowerCase();
  if (v.includes("senado")) return "senado";
  if (v.includes("diput") || v.includes("cámara") || v.includes("camara")) {
    return "diputados";
  }
  return "desconocida";
}

const STYLES: Record<CamaraKind, { label: string; className: string }> = {
  diputados: {
    label: "Cámara",
    className: "bg-[--camara-muted] text-[--camara-muted-foreground]",
  },
  senado: {
    label: "Senado",
    className: "bg-[--senado-muted] text-[--senado-muted-foreground]",
  },
  desconocida: {
    label: "Cámara origen desconocida",
    className: "bg-muted text-muted-foreground",
  },
};

export function CamaraChip({ camara }: { camara: string | null }) {
  const kind = classify(camara);
  const { label, className } = STYLES[kind];
  return (
    <Badge variant="outline" className={cn("border-transparent", className)}>
      {label}
    </Badge>
  );
}

/** Token de color del dot del rail del timeline, por cámara. */
export function camaraDotColor(camara: string | null): string {
  const kind = classify(camara);
  if (kind === "senado") return "bg-[--senado]";
  if (kind === "diputados") return "bg-[--camara]";
  return "bg-muted-foreground";
}
