import type {
  CarrilEstado,
  LobbyMateria,
} from "@/lib/parlamentario-resumen-conteos";

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
 *
 * VACÍO HONESTO (122-05, fila 5.11 de `122-CRUCES-SQL-03-LOBBY.md`, LOCKED): el
 * componente recibe el `CarrilEstado` COMPLETO, no un `number` ya colapsado. La línea
 * de conteo se emite SOLO cuando el estado es `dato`; con `vacio`/`no_ingerido`/
 * `pendiente` se OMITE — espejo de `cruces-capa1.tsx:28` (`{sector.nVotos > 0 && …}`).
 * Antes recibía `total={… ? n : 0}`, así que `no_ingerido` se imprimía como el HECHO
 * "0 reuniones": en `/parlamentario/S1338` la misma sección declaraba "—" en su
 * encabezado y "0 reuniones" tres líneas más abajo. Eso viola la regla LOCKED de
 * `lobby-de-parlamentario.tsx:47` ("'no ingestado' ≠ 'ingestado, cero'"). Quién
 * declara el 3-estado es el rótulo del carril (`conteoLabel`), su único emisor
 * legítimo. Un `dato` con n=0 SÍ imprime "0 reuniones": cero honesto, jamás se rellena
 * ni se oculta.
 */

// Máximo de barras en capa-1 (chunking ≤7 por regla de escaneo).
const TOP_N = 5;

export function LobbyCapa1({
  topMaterias,
  estado,
}: {
  topMaterias: LobbyMateria[];
  estado: CarrilEstado;
}) {
  const top = topMaterias.slice(0, TOP_N);
  const maxN = top.length > 0 ? Math.max(...top.map((m) => m.n)) : 0;

  return (
    <div className="space-y-3">
      {/*
        Conteo total neutro (HECHO, nunca framing causal). OMISIÓN HONESTA (5.11):
        sólo con `tipo === "dato"` hay un denominador conocido que imprimir. Con
        `vacio`/`no_ingerido`/`pendiente` no se pinta ningún dígito — el rótulo del
        carril ya declara el estado ("sin registros" / "—" / "pendiente").
      */}
      {estado.tipo === "dato" && (
        <p className="text-sm text-muted-foreground">
          <span className="font-mono tabular-nums">{estado.n}</span>{" "}
          {estado.n === 1 ? "reunión" : "reuniones"}
        </p>
      )}

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
