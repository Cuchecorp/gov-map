import type {
  PatrimonioDeclaracion,
  RangoAnios,
} from "@/lib/parlamentario-resumen-conteos";

/**
 * Capa-1 de PATRIMONIO (UXCOG 55-02, UI-SPEC §Per-Surface "/parlamentario"). Resumen
 * PREATENTIVO: una tira de mini-columnas de declaraciones por año + "N declaraciones
 * · rango de años". Vista PURA — recibe `patrimonioPorDeclaracion` + `rangoAnios` ya
 * computados por `contarCarrilesSeguro`. Sin runtime Supabase.
 *
 * F46 (LOCKED): capa-1 patrimonio NUNCA renderiza un monto (los montos son URIs CPLT,
 * no cifras) ni un conteo de ítems por declaración (los bienes viven en un RPC aparte,
 * deliberadamente NO leído). La mini-columna encode el CONTEO DE DECLARACIONES por año
 * (métrica basada en conteo, derivada de las filas ya leídas) — nunca un monto, nunca
 * un ítem fabricado. Petróleo PROHIBIDO aquí (reservado a cruces). Sin `font-bold`/700.
 */

// Bajo 2 declaraciones no se dibuja la tira: una sola no es una trayectoria (espejo
// del degrade <2 de patrimonio-chart, marco de CONTEO — jamás "tendencia").
const MIN_DECLARACIONES = 2;

interface AnioColumna {
  anio: number;
  conteo: number;
  tipos: string[];
}

/** Agrupa las declaraciones por año (asc), contando cuántas hay y qué tipos. PURO. */
function columnasPorAnio(porDeclaracion: PatrimonioDeclaracion[]): AnioColumna[] {
  const porAnio = new Map<number, AnioColumna>();
  for (const d of porDeclaracion) {
    const col = porAnio.get(d.anio) ?? { anio: d.anio, conteo: 0, tipos: [] };
    col.conteo += 1;
    if (!col.tipos.includes(d.tipo)) col.tipos.push(d.tipo);
    porAnio.set(d.anio, col);
  }
  return [...porAnio.values()].sort((a, b) => a.anio - b.anio);
}

export function PatrimonioCapa1({
  porDeclaracion,
  rangoAnios,
}: {
  porDeclaracion: PatrimonioDeclaracion[];
  rangoAnios: RangoAnios | null;
}) {
  const n = porDeclaracion.length;

  // Degradación honesta: <2 declaraciones no es una trayectoria (marco de CONTEO,
  // nunca "tendencia" — F46/anti-insinuación).
  if (n < MIN_DECLARACIONES) {
    return (
      <p className="text-sm text-muted-foreground">
        {n === 0
          ? "Aún no hay declaraciones de patrimonio ingeridas en las fuentes consultadas."
          : "Datos insuficientes para mostrar el conteo por año (se registra 1 declaración)."}
      </p>
    );
  }

  const columnas = columnasPorAnio(porDeclaracion);
  const maxConteo = Math.max(...columnas.map((c) => c.conteo));

  return (
    <div className="space-y-3">
      {/* Tira de mini-columnas: altura ∝ nº de DECLARACIONES del año (nunca montos). */}
      <div className="flex items-end gap-2 h-16" role="img" aria-label="Declaraciones de patrimonio por año">
        {columnas.map((c) => (
          <div
            key={c.anio}
            data-anio={c.anio}
            data-conteo={c.conteo}
            className="flex h-full flex-col items-center justify-end gap-1"
            title={`${c.anio}: ${c.conteo} ${
              c.conteo === 1 ? "declaración" : "declaraciones"
            } (${c.tipos.join(", ")})`}
          >
            {/* Track flex-1 con altura RESOLUBLE (la columna es h-full): sin este
                contexto de altura definido, el `height: N%` de la barra colapsaba a 0
                y en PROD sólo se veían las etiquetas de año. */}
            <span className="flex w-6 flex-1 items-end" aria-hidden="true">
              <span
                className="block w-full rounded-t bg-muted-foreground"
                style={{ height: `${(c.conteo / maxConteo) * 100}%` }}
              />
            </span>
            <span className="text-xs font-mono tabular-nums text-muted-foreground">
              {c.anio}
            </span>
          </div>
        ))}
      </div>

      {/* Resumen "N declaraciones · min–max" (Mono para las cifras). */}
      <p className="text-sm text-muted-foreground">
        <span className="font-mono tabular-nums">{n}</span>{" "}
        {n === 1 ? "declaración" : "declaraciones"}
        {rangoAnios && (
          <>
            {" · "}
            <span className="font-mono tabular-nums">
              {rangoAnios.min === rangoAnios.max
                ? rangoAnios.min
                : `${rangoAnios.min}–${rangoAnios.max}`}
            </span>
          </>
        )}
      </p>
    </div>
  );
}
