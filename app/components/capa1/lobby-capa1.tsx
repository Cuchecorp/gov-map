import type { LobbyMateria } from "@/lib/parlamentario-resumen-conteos";

/**
 * Capa-1 de LOBBY (UXCOG 55-02, UI-SPEC §Per-Surface "/parlamentario"). Resumen
 * PREATENTIVO: barras horizontales top-N por materia (asunto verbatim de la fuente)
 * + conteo total NEUTRO de reuniones. Vista PURA — recibe `lobbyTopMaterias` + el
 * total ya computados por `contarCarrilesSeguro`. Sin runtime Supabase.
 *
 * COLOR (UI-SPEC §Color): las barras usan color NEUTRO (`--muted-foreground`) —
 * petróleo está PROHIBIDO aquí (reservado a cruces/drill-down). El conteo es un
 * HECHO neutro (§9.1): "N reuniones", nunca un framing de relación/afinidad. El
 * nombre de la contraparte NO aparece en capa-1 (va al detalle, plano no-enlazado).
 */

// Máximo de barras en capa-1 (chunking ≤7 por regla de escaneo).
const TOP_N = 5;

export function LobbyCapa1({
  topMaterias,
  total,
}: {
  topMaterias: LobbyMateria[];
  total: number;
}) {
  const top = topMaterias.slice(0, TOP_N);
  const maxN = top.length > 0 ? Math.max(...top.map((m) => m.n)) : 0;

  return (
    <div className="space-y-3">
      {/* Conteo total neutro (HECHO, nunca framing causal). */}
      <p className="text-sm text-muted-foreground">
        <span className="font-mono tabular-nums">{total}</span>{" "}
        {total === 1 ? "reunión" : "reuniones"}
      </p>

      {top.length > 0 ? (
        <ul className="space-y-1.5">
          {top.map((m) => (
            <li key={m.materia} className="flex items-center gap-2">
              <span
                className="text-sm text-foreground/90 w-40 shrink-0 truncate"
                title={m.materia}
              >
                {m.materia}
              </span>
              <span
                className="flex-1 h-2 rounded-full bg-muted overflow-hidden"
                aria-hidden="true"
              >
                <span
                  className="block h-full bg-muted-foreground"
                  style={{ width: `${maxN > 0 ? (m.n / maxN) * 100 : 0}%` }}
                />
              </span>
              <span className="text-xs font-mono tabular-nums text-muted-foreground w-6 text-right">
                {m.n}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        // Degradación honesta: sin materias publicadas, solo el conteo total.
        <p className="text-xs text-muted-foreground">
          Aún no hay materias publicadas en las fuentes consultadas.
        </p>
      )}
    </div>
  );
}
