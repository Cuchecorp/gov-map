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
import {
  VOTO_PRESENTACION,
  SELECCION_ORDEN,
} from "@/lib/voto-presentacion";

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
 * - Fills = colores SEMÁNTICOS de voto, SINGLE-SOURCE real vía `VOTO_PRESENTACION`
 *   (lib/voto-presentacion.ts): el MISMO objeto alimenta este chart, los segmentos
 *   capa-1 y los badges de voto-row — no hay literales duplicados que puedan
 *   desincronizar (47 IN-01/IN-02). Verde=a favor, rojo=en contra, ámbar=abstención,
 *   slate=pareo/ausente: CODIFICAN el dato. El acento petróleo de producto está
 *   PROHIBIDO aquí (se reserva a cruces/drill-down). Leyendas = labels NOUN.
 */

// Series del stacked BarChart, derivadas del orden LOCKED + el mapa único de
// presentación. Recharts necesita `fill` como literal → se lee de VOTO_PRESENTACION,
// donde el hsl vive JUNTO a su clase `bg-*` (imposible desincronizar).
const SERIES: ReadonlyArray<{
  dataKey: keyof VotoPeriodo;
  label: string;
  fill: string;
}> = SELECCION_ORDEN.map((sel) => ({
  dataKey: sel,
  label: VOTO_PRESENTACION[sel].label,
  fill: VOTO_PRESENTACION[sel].fill,
}));

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
