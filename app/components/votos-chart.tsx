"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import type { VotoPeriodo } from "./votos-por-parlamentario";

/**
 * <VotosChart> — isla cliente Recharts (VIZ-02, "Cuándo votó"). Recibe SOLO
 * `VotoPeriodo[]` (JSON plano: strings+numbers) computado server-side por
 * `agruparVotosPorTrimestre`; jamás importa el cliente server-only de Supabase ni el
 * runtime del Server Component (solo el `type`). Mantiene Recharts FUERA del bundle
 * server, igual que `patrimonio-chart.tsx` / `red-graph.tsx`.
 *
 * HONESTIDAD (47-UI-SPEC, anti-insinuación LOCKED, espejo F46):
 * - Tipo de chart = `BarChart` APILADO DISCRETO (una barra por trimestre), NUNCA
 *   línea/área conectada: una serie continua sobre el tiempo insinuaría una
 *   "trayectoria"/"tendencia" de comportamiento — anti-insinuación HARD, idéntica a
 *   la regla F46 "stacked-NO-line".
 * - Cada barra es un trimestre; los segmentos se apilan en el orden LOCKED de sentidos
 *   (si → no → abstención → pareo → ausente), `stackId="votos"`.
 * - `YAxis allowDecimals={false}` — sólo conteos, jamás una fracción fabricada.
 * - Fills = colores SEMÁNTICOS de voto, single-source con `VotosCapa1` SEGMENTO
 *   (verde=a favor, rojo=en contra, ámbar=abstención, slate=pareo/ausente): CODIFICAN
 *   el dato. El acento petróleo de producto está PROHIBIDO aquí (se reserva a
 *   cruces/drill-down). Leyendas = labels NOUN (espejo de OPCION_LABEL).
 */

// Orden LOCKED + label NOUN + fill por sentido (single-source con VotosCapa1 SEGMENTO,
// votos-capa1.tsx). Recharts necesita fills explícitos; mapean 1:1 a los `bg-*`.
const SERIES: ReadonlyArray<{
  dataKey: keyof VotoPeriodo;
  label: string;
  fill: string;
}> = [
  { dataKey: "si", label: "A favor", fill: "hsl(142 71% 45%)" }, // bg-green-500
  { dataKey: "no", label: "En contra", fill: "hsl(0 84% 60%)" }, // bg-red-500
  { dataKey: "abstencion", label: "Abstención", fill: "hsl(43 96% 56%)" }, // bg-amber-400
  { dataKey: "pareo", label: "Pareo", fill: "hsl(215 20% 65%)" }, // bg-slate-400
  { dataKey: "ausente", label: "Ausente", fill: "hsl(213 27% 84%)" }, // bg-slate-300
];

export function VotosChart({ periodos }: { periodos: VotoPeriodo[] }) {
  return (
    <div
      className="h-72 w-full"
      role="img"
      aria-label="Número de votos por trimestre y sentido del voto"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={periodos}>
          <XAxis dataKey="periodo" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          {SERIES.map((s) => (
            <Bar
              key={s.dataKey}
              dataKey={s.dataKey}
              stackId="votos"
              name={s.label}
              fill={s.fill}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
