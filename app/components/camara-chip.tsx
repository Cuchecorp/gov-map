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

// B8: solo las cámaras REALES tienen chip. `desconocida` NO fabrica un
// chip-alarma ("Cámara origen desconocida"): cuando la cámara no aplica el
// componente se omite (retorna null). El dato ausente NO se comunica como defecto.
const STYLES: Record<"diputados" | "senado", { label: string; className: string }> = {
  diputados: {
    label: "Cámara",
    className: "bg-[--camara-muted] text-[--camara-muted-foreground]",
  },
  senado: {
    label: "Senado",
    className: "bg-[--senado-muted] text-[--senado-muted-foreground]",
  },
};

export function CamaraChip({ camara }: { camara: string | null }) {
  const kind = classify(camara);
  // B8: cámara no aplica → se omite el chip (seguro en los 4 call-sites, todos
  // dentro de `flex flex-wrap gap-2`: omitir no deja hueco). El dot del timeline
  // (camaraDotColor) sigue degradando a neutro — ese comportamiento no cambia.
  if (kind === "desconocida") return null;
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
