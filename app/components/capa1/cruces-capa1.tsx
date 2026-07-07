import type { CruceSector } from "@/lib/parlamentario-resumen-conteos";

/**
 * Capa-1 de CRUCES (UXCOG 55-02, UI-SPEC §Per-Surface "/parlamentario"). ÚNICA
 * superficie de la página capa-1 que usa petróleo (`--accent-product`): marco 1.5px,
 * `<h2>` en petróleo y el botón PRIMARIO "Explorar los N cruces" (dispara el
 * drill-down; en la página lo conecta 55-03 al DetalleColapsable de cruces). Vista
 * PURA — recibe `crucesSectores` + `total` ya computados por `contarCarrilesSeguro`.
 *
 * ANTI-INSINUACIÓN (§9.1, LOCKED): los chips muestran CONTEOS NEUTROS lado a lado
 * ("sector · N reuniones"), agregando "· M votos" SOLO cuando M>0 (omisión honesta:
 * no se pinta una dimensión de votos que la fuente no trae hoy). NUNCA se compone
 * reunión+voto en una frase causal. El caveat de cruces aparece 1× (texto LOCKED).
 */

const CAVEAT_CRUCES =
  "La coincidencia temporal no implica relación entre la reunión y el voto.";

function Chip({ sector }: { sector: CruceSector }) {
  return (
    <li className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-sm">
      <span className="text-foreground/90">{sector.sector}</span>
      {" · "}
      <span className="font-mono tabular-nums">{sector.nReuniones}</span>{" "}
      {sector.nReuniones === 1 ? "reunión" : "reuniones"}
      {/* Dimensión de votos SOLO cuando la fuente la trae (omisión honesta). */}
      {sector.nVotos > 0 && (
        <>
          {" · "}
          <span className="font-mono tabular-nums">{sector.nVotos}</span>{" "}
          {sector.nVotos === 1 ? "voto" : "votos"}
        </>
      )}
    </li>
  );
}

export function CrucesCapa1({
  sectores,
  total,
}: {
  sectores: CruceSector[];
  total: number;
}) {
  return (
    <div className="rounded-lg border-[1.5px] border-accent-product bg-card p-4 space-y-3">
      <h2 className="text-lg font-semibold text-accent-product">
        Cruces con sectores
      </h2>

      {sectores.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {sectores.map((s) => (
            <Chip key={s.sector} sector={s} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Aún no se registran cruces con sectores en las fuentes consultadas.
        </p>
      )}

      {/* Botón PRIMARIO petróleo — el único énfasis de la página (drill-down). */}
      {total > 0 && (
        <button
          type="button"
          className="min-h-11 rounded-lg bg-accent-product px-6 font-semibold text-background hover:bg-accent-product/90"
        >
          Explorar los {total} cruces
        </button>
      )}

      {/* Caveat de cruces (LOCKED, 1×). */}
      <p className="text-xs text-muted-foreground">{CAVEAT_CRUCES}</p>
    </div>
  );
}
