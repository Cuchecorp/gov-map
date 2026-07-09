import type { AusenciaContextoRow } from "@/lib/types";

/**
 * Sub-bloque FACTUAL del comparativo de ausencias (VIZ-03), montado DENTRO del
 * detalle de Votaciones (capa-2), inmediatamente después de "Cómo votó" y antes de
 * "Por tema" (placement LOCKED en 49-UI-SPEC).
 *
 * PRESENTACIÓN PURA: recibe un shape plano ya resuelto por el server (o `null`) y
 * NUNCA importa el cliente Supabase (frontera cliente/server LOCKED, F45). Si el
 * shape es `null` (RPC ausente pre-apply / degrade honesto resuelto en el server)
 * → renderiza NADA (omisión honesta; capa-1 y el resto del detalle quedan intactos).
 *
 * Anti-insinuación (LOCKED, 49-UI-SPEC §Anti-Insinuación): CERO adjetivo, CERO color
 * en las cifras (un % rojo = veredicto implícito, PROHIBIDO), CERO chart/barra —
 * sólo texto + Mono. La mediana es un HECHO distribucional neutro, jamás un veredicto.
 * Fabricación PROHIBIDA: si una cifra falta (null / no derivable) se OMITE esa línea,
 * nunca se inventa un número (regla de omisión honesta F47).
 */

// es-CL con 1 decimal: la coma decimal es la convención local (paridad con capa-1
// `pctFormatter`). tasa_propia / mediana_camara son RATIO [0,1] → formatear *100.
const pctFormatter = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function AusenciasContexto({
  data,
}: {
  data: AusenciaContextoRow | null;
}) {
  // Degrade honesto: el server ya resolvió PGRST202→null. Sin fila, sin bloque.
  if (data === null) return null;

  // Fabrication guard: N/M deben ser derivables y M>0 (nunca dividir por cero). El
  // server ya no envía shape con M=0, pero se protege igual (omisión honesta).
  const hayPropia =
    typeof data.n_ausencias === "number" &&
    typeof data.m_votaciones === "number" &&
    data.m_votaciones > 0 &&
    typeof data.tasa_propia === "number";

  // Mediana: SOLO si viene poblada (null → se omite la línea, nunca se fabrica). El
  // guard incluye K (IN-01): el contrato garantiza K>=1 cuando hay fila, pero la línea
  // imprime `k_parlamentarios` — se exige que sea un número >=1 para no imprimir
  // "(null parlamentarios)" si el contrato llegara a derivar (misma disciplina anti-
  // fabricación que la línea propia).
  const hayMediana =
    typeof data.mediana_camara === "number" &&
    typeof data.k_parlamentarios === "number" &&
    data.k_parlamentarios >= 1;

  // Si no hay ninguna cifra que mostrar, no se renderiza un bloque vacío.
  if (!hayPropia && !hayMediana) return null;

  const pctPropia = hayPropia
    ? pctFormatter.format(data.tasa_propia * 100)
    : null;
  const pctMediana = hayMediana
    ? pctFormatter.format((data.mediana_camara as number) * 100)
    : null;

  return (
    <div>
      <h3 className="text-sm font-semibold">¿Falta más o menos que la mediana de su cámara?</h3>

      {hayPropia && (
        <p className="text-sm text-muted-foreground mt-2">
          {"Ausente en "}
          <span className="font-mono tabular-nums">{data.n_ausencias}</span>
          {" de "}
          <span className="font-mono tabular-nums">{data.m_votaciones}</span>
          {" votaciones ("}
          <span className="font-mono tabular-nums">{pctPropia}%</span>
          {")."}
        </p>
      )}

      {hayMediana && (
        <p className="text-sm text-muted-foreground mt-2">
          {"Mediana de su cámara: "}
          <span className="font-mono tabular-nums">{pctMediana}%</span>
          {" ("}
          <span className="font-mono tabular-nums">{data.k_parlamentarios}</span>
          {data.k_parlamentarios === 1
            ? " parlamentario)."
            : " parlamentarios)."}
        </p>
      )}

      <p className="text-sm text-muted-foreground mt-2">
        Sobre las votaciones ingestadas por este observatorio, no la historia
        completa.
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Fuente: Cámara de Diputadas y Diputados / Senado de Chile ·
        datos ingestados por este observatorio.
      </p>
    </div>
  );
}
