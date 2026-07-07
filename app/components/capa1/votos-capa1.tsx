import { cn } from "@/lib/utils";
import type {
  VotosBreakdown,
  Asistencia,
} from "@/lib/parlamentario-resumen-conteos";

/**
 * Capa-1 de VOTOS (UXCOG 55-02, UI-SPEC §Per-Surface "/parlamentario"). Resumen
 * PREATENTIVO siempre visible: 5 cifras Mono grandes (4 sentidos + asistencia %)
 * + la barra apilada "Cómo votó". Vista PURA — recibe `votosBreakdown` + `asistencia`
 * ya computados por `contarCarrilesSeguro` (misma fuente que VotosView → cifras
 * byte-a-byte, chip/capa-1/sección nunca desincronizan). Sin runtime Supabase.
 *
 * COLOR (UI-SPEC §Color): los colores de voto CODIFICAN el dato (verde=a favor,
 * rojo=en contra, ámbar=abstención, slate=ausente/pareo) — NO son el 10% petróleo.
 * Petróleo (`--accent-product`) está PROHIBIDO aquí; se reserva a cruces/drill-down.
 * Sin `font-bold`/700: el énfasis es SIZE + Mono + color semántico.
 */

// Colores SEMÁNTICOS de la barra (espejo del mapa de "Cómo votó" de VotosView).
const SEGMENTO: Record<keyof VotosBreakdown, string> = {
  si: "bg-green-500",
  no: "bg-red-500",
  abstencion: "bg-amber-400",
  pareo: "bg-slate-400",
  ausente: "bg-slate-300",
};

const OPCION_LABEL: Record<keyof VotosBreakdown, string> = {
  si: "A favor",
  no: "En contra",
  abstencion: "Abstención",
  pareo: "Pareo",
  ausente: "Ausente",
};

// Orden de segmentos de la barra (mismo que VotosView "Cómo votó").
const ORDEN_BARRA: (keyof VotosBreakdown)[] = [
  "si",
  "no",
  "abstencion",
  "pareo",
  "ausente",
];

// Facts preatentivos: 4 sentidos (color solo en el número). El 5º fact (asistencia)
// se arma aparte porque puede omitirse. Pareo NO es un fact (va solo en la barra).
const FACTS: { key: keyof VotosBreakdown; label: string; color: string }[] = [
  { key: "si", label: "a favor", color: "text-green-600" },
  { key: "no", label: "en contra", color: "text-red-600" },
  { key: "abstencion", label: "abstención", color: "text-amber-600" },
  { key: "ausente", label: "ausente", color: "text-slate-500" },
];

// es-CL con 1 decimal: 99,3 %. La coma decimal es la convención local.
const pctFormatter = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function VotosCapa1({
  breakdown,
  asistencia,
}: {
  breakdown: VotosBreakdown;
  asistencia: Asistencia | null;
}) {
  const totalBarra = ORDEN_BARRA.reduce((s, k) => s + breakdown[k], 0);
  // Asistencia %: presente / total. Se OMITE si no es derivable (jamás un % fabricado).
  const asistPct =
    asistencia && asistencia.total > 0
      ? pctFormatter.format((asistencia.presentes / asistencia.total) * 100)
      : null;

  return (
    <div className="space-y-3">
      {/* Cifras preatentivas (KPI 24px/600/Mono, UI-SPEC §Typography). */}
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {FACTS.map((f) => (
          <div key={f.key} className="flex flex-col">
            <span
              className={cn(
                "text-2xl font-semibold font-mono tabular-nums leading-none",
                f.color,
              )}
            >
              {breakdown[f.key]}
            </span>
            <span className="text-xs text-muted-foreground">{f.label}</span>
          </div>
        ))}
        {asistPct !== null && (
          <div className="flex flex-col">
            <span className="text-2xl font-semibold font-mono tabular-nums leading-none">
              {`${asistPct}%`}
            </span>
            <span className="text-xs text-muted-foreground">asistencia</span>
          </div>
        )}
      </div>

      {/* Barra apilada "Cómo votó" — CSS sobre colores semánticos, nunca petróleo. */}
      {totalBarra > 0 && (
        <div
          className="flex h-3 rounded-full overflow-hidden w-full"
          role="img"
          aria-label={ORDEN_BARRA.map(
            (k) => `${OPCION_LABEL[k]}: ${breakdown[k]}`,
          ).join(", ")}
        >
          {ORDEN_BARRA.map((k) =>
            breakdown[k] > 0 ? (
              <div
                key={k}
                style={{ width: `${(breakdown[k] / totalBarra) * 100}%` }}
                className={SEGMENTO[k]}
              />
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
