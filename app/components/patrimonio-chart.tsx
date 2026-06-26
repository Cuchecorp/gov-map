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

import type { SeriePunto } from "./patrimonio-de-parlamentario";

/**
 * <PatrimonioChart> — isla cliente Recharts (VIZ-02). Recibe SOLO `SeriePunto[]`
 * (JSON plano: strings+numbers) computado server-side por `seriePatrimonio()`; jamás
 * importa el cliente server-only de Supabase ni el runtime del Server Component
 * (solo el `type`). Mantiene Recharts FUERA del bundle server, igual que
 * `red-graph.tsx` con `@xyflow/react`.
 *
 * HONESTIDAD (46-CONTEXT, DESIGN-SYSTEM §6, LOCKED):
 * - Tipo de chart = `BarChart` APILADO discreto (una barra por declaración), NUNCA
 *   línea/área conectada: una línea entre versiones incomparables (periódica vs
 *   rectificación) insinuaría una "tendencia" de riqueza — anti-insinuación HARD.
 * - Cada barra es una categoría compuesta `anio + tipo_declaracion`: dos
 *   declaraciones del mismo año pero distinto tipo quedan como DOS barras
 *   distintas, nunca fundidas en una sola banda comparable.
 * - SOLO conteos de ítems; NUNCA un monto (los montos son URIs CPLT, no cifras —
 *   el caveat lo dice el shell server).
 * - Fills = rampa petróleo neutra; PROHIBIDO reusar los tokens de identidad
 *   institucional (lectura política). Leyendas = labels NOUN (espejo de
 *   `ORDEN_GRUPOS_BIENES`).
 */

// Orden + label NOUN + fill por `tipo_bien` (espejo de ORDEN_GRUPOS_BIENES, sin
// importar runtime del Server Component). Rampa petróleo→pizarra neutra: ninguna
// serie carga lectura política (no reusa los tokens de identidad institucional).
const SERIES: ReadonlyArray<{
  dataKey: keyof SeriePunto;
  label: string;
  fill: string;
}> = [
  { dataKey: "inmueble", label: "Bienes inmuebles", fill: "hsl(183 38% 24%)" },
  { dataKey: "actividad", label: "Actividades e intereses", fill: "hsl(183 32% 34%)" },
  { dataKey: "accion_derecho", label: "Acciones y derechos", fill: "hsl(190 26% 44%)" },
  { dataKey: "valor", label: "Valores", fill: "hsl(200 20% 54%)" },
  { dataKey: "mueble", label: "Bienes muebles", fill: "hsl(210 16% 64%)" },
  { dataKey: "pasivo", label: "Pasivos", fill: "hsl(215 14% 74%)" },
];

// Categoría compuesta del eje X: año + tipo de declaración → dos declaraciones del
// mismo año pero distinto tipo NO se fusionan en una sola banda (render-honesty).
function categoria(p: SeriePunto): string {
  return `${p.anio} · ${p.tipo_declaracion}`;
}

export function PatrimonioChart({ serie }: { serie: SeriePunto[] }) {
  const datos = serie.map((p) => ({ ...p, categoria: categoria(p) }));

  return (
    <div
      className="h-72 w-full"
      role="img"
      aria-label="N.º de bienes declarados por declaración (año y tipo)"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos}>
          <XAxis dataKey="categoria" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          {SERIES.map((s) => (
            <Bar
              key={s.dataKey}
              dataKey={s.dataKey}
              stackId="bienes"
              name={s.label}
              fill={s.fill}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
