import type { Seleccion } from "@/lib/types";

/**
 * Presentación SEMÁNTICA del sentido de voto — ÚNICA fuente de verdad (47 IN-01/IN-02).
 *
 * Antes este mapa vivía triplicado (`SERIES` en votos-chart, `BAR_SEGMENT`/`OPCION_LABEL`
 * en votos-por-parlamentario, `SEGMENTO` en votos-capa1) con riesgo de desincronización
 * silenciosa. Aquí se centraliza: label NOUN + clase Tailwind `bg-*` (capa-1/segmentos) +
 * fill `hsl(...)` (Recharts, que necesita literales). Los tres derivan del MISMO objeto.
 *
 * HONESTIDAD (47-UI-SPEC, LOCKED): los colores CODIFICAN el dato (verde=a favor,
 * rojo=en contra, ámbar=abstención, slate=pareo/ausente). El acento petróleo de producto
 * está PROHIBIDO aquí (se reserva a cruces/drill-down). El `fill` hsl mapea 1:1 al `bgClass`
 * Tailwind (green-500 = hsl(142 71% 45%), etc.) — al vivir juntos ya no pueden desincronizar.
 */
export interface VotoPresentacion {
  /** Label NOUN para leyendas/badges ("A favor"/"En contra"/…). */
  label: string;
  /** Clase Tailwind del segmento/barra capa-1 (bg-green-500, …). */
  bgClass: string;
  /** Fill hsl explícito para Recharts (mapea 1:1 al `bgClass`). */
  fill: string;
}

export const VOTO_PRESENTACION: Record<Seleccion, VotoPresentacion> = {
  si: { label: "A favor", bgClass: "bg-green-500", fill: "hsl(142 71% 45%)" },
  no: { label: "En contra", bgClass: "bg-red-500", fill: "hsl(0 84% 60%)" },
  abstencion: {
    label: "Abstención",
    bgClass: "bg-amber-400",
    fill: "hsl(43 96% 56%)",
  },
  pareo: { label: "Pareo", bgClass: "bg-slate-400", fill: "hsl(215 20% 65%)" },
  ausente: { label: "Ausente", bgClass: "bg-slate-300", fill: "hsl(213 27% 84%)" },
};

/** Orden LOCKED de sentidos: si → no → abstención → pareo → ausente. */
export const SELECCION_ORDEN: Seleccion[] = [
  "si",
  "no",
  "abstencion",
  "pareo",
  "ausente",
];

/**
 * Leyenda anti-insinuación (VERBATIM LOCKED — 68-UI-SPEC §Leyenda / CONTEXT §decisions,
 * REQUIREMENTS VOTO-04). ÚNICA fuente de verdad, byte-idéntica: la consumen TODAS las
 * superficies de voto (ficha del parlamentario `votos-por-parlamentario.tsx` bloque 0 y
 * ficha del proyecto / Senado `voto-detalle.tsx` a nivel de la votación). NO duplicar el
 * string en ningún componente — importar desde aquí.
 *
 * OJO (guard): este string NIEGA "disciplina" ("No medimos disciplina ni motivo."). El
 * `anti-insinuacion-guard.test.ts` lo RESTA (NEGACIONES_LOCKED) antes de matchear, así que
 * la leyenda que enfuerza la regla no se auto-caza. Si se edita el copy aquí, debe editarse
 * verbatim en NEGACIONES_LOCKED del guard también.
 */
export const LEYENDA_ANTI_INSINUACION =
  "Un voto es un hecho observable. Ausente o pareo no equivalen a votar en contra. No medimos disciplina ni motivo.";
