/**
 * AgendaCobertura — banner de cobertura DECLARADA de /agenda (UI-SPEC §3, CIT-05).
 *
 * Server Component PURO de presentación: recibe la métrica DERIVADA por props
 * (NO consulta Supabase; la lectura vive en el server component de la página).
 *
 * Regla rectora (LOCKED §7 de 93-AUDITORIA-CITACIONES): NINGUNA celda dice
 * "cobertura completa". La intro LOCKED declara la parcialidad 1×. Una sola celda
 * (comisiones×Cámara) es DERIVADA (N/S/rango reflejan el estado real de la DB al
 * render); las otras tres son límites de FUENTE → texto estructural fijo.
 *
 * Tono NEUTRO — PROHIBIDO `--destructive`, ámbar o rojo (§Color): la parcialidad
 * es un HECHO declarado, no una alarma. Rangos y conteos SIEMPRE en `font-mono`.
 */

/** Métrica derivada de la DB para la celda comisiones×Cámara (no hardcodeada). */
export interface CoberturaCamaraMetrica {
  /** Total de citaciones de comisiones de la Cámara ingeridas. */
  camaraN: number;
  /**
   * Ancho del rango min→max en semanas de 7 días (aprox., derivado — IN-01). NO es
   * el conteo de semanas ISO distintas: es `floor(díasEntre/7)+1` (ver `semanasEntre`
   * en app/agenda/page.tsx). El copy la muestra como cifra derivada aproximada.
   */
  camaraSemanas: number;
  /** Fecha mínima (YYYY-MM-DD) de citación de Cámara ingerida. */
  camaraMin: string | null;
  /** Fecha máxima (YYYY-MM-DD) de citación de Cámara ingerida. */
  camaraMax: string | null;
}

export function AgendaCobertura({
  metrica,
}: {
  metrica: CoberturaCamaraMetrica;
}) {
  const { camaraN, camaraSemanas, camaraMin, camaraMax } = metrica;
  const rango =
    camaraMin && camaraMax ? `${camaraMin}→${camaraMax}` : "sin rango de fecha";

  return (
    <section
      aria-label="Cobertura de la agenda"
      className="mt-6 rounded-lg border border-border bg-muted/40 px-6 py-4"
    >
      <h2 className="text-xl font-semibold">Cobertura de la agenda</h2>

      {/* Intro LOCKED (§Copywriting) — siempre visible, verbatim. */}
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        Esta agenda muestra lo que se ha ingerido de las fuentes oficiales. La
        cobertura es parcial y se declara por origen; no es un calendario
        completo del Congreso.
      </p>

      <ul className="mt-4 space-y-2 text-sm text-muted-foreground leading-relaxed">
        {/* Celda comisiones×Cámara — DERIVADA dinámicamente (N/S/rango en mono). */}
        <li>
          Comisiones de la Cámara:{" "}
          <span className="font-mono">{camaraN}</span> citaciones ingeridas en{" "}
          <span className="font-mono">{camaraSemanas} semanas</span> (
          <span className="font-mono">{rango}</span>); el histórico completo del
          período está pendiente de carga.
        </li>

        {/* Tres celdas ESTRUCTURALES — texto fijo LOCKED (límite de la fuente). */}
        <li>
          Comisiones del Senado: al día en su ventana (próximas semanas); la
          fuente es forward-only, sin histórico disponible.
        </li>
        <li>
          Tabla de sala de la Cámara: solo la sesión vigente (PDF semanal
          procesado); sin histórico estructurado.
        </li>
        <li>
          Tabla de sala del Senado: al día en su ventana; la fuente es
          forward-only, sin histórico.
        </li>
      </ul>

      {/* Leyenda de estado LOCKED (§4) — 1× por página. */}
      <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
        Cuando una citación fue suspendida o dejada sin efecto, se muestra su
        estado según la fuente. La ausencia de esa marca significa que la fuente
        no registró una cancelación — no confirma que la sesión se realizará.
      </p>
    </section>
  );
}
