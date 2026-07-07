import type { ReactNode } from "react";

import type { CruceSector } from "@/lib/parlamentario-resumen-conteos";

/**
 * Capa-1 de CRUCES (UXCOG 55-02, UI-SPEC §Per-Surface "/parlamentario"). ÚNICA
 * superficie de la página capa-1 que usa petróleo (`--accent-product`): marco 1.5px
 * y `<h2>` en petróleo. El CTA PRIMARIO "Explorar los N cruces" ya NO vive aquí como
 * un anchor separado: es el TRIGGER del `DetalleColapsable` de cruces (variante
 * `primary`), un ÚNICO control que expande el detalle en vez de dos controles (un
 * anchor que sólo hacía scroll + un disclosure "Ver detalle"). Vista PURA — recibe
 * `crucesSectores` ya computados por `contarCarrilesSeguro`.
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
    <li className="inline-block rounded-full border border-border bg-card px-3 py-1 text-sm">
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
  conteo,
}: {
  sectores: CruceSector[];
  /** Conteo 3-estado YA formateado por el server (honesto); SIEMPRE visible junto al h2. */
  conteo?: ReactNode;
}) {
  return (
    <div className="rounded-lg border-[1.5px] border-accent-product bg-card p-4 space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-accent-product">
        <span>Cruces con sectores</span>
        {conteo != null && (
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {conteo}
          </span>
        )}
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

      {/* El CTA PRIMARIO petróleo "Explorar los N cruces" NO vive aquí: es el trigger
          del DetalleColapsable de cruces (variante `primary`) en la página server —
          UN solo control que expande el detalle, no un anchor extra que sólo hace
          scroll a un disclosure cerrado. */}

      {/* Caveat de cruces (LOCKED, 1×). */}
      <p className="text-xs text-muted-foreground">{CAVEAT_CRUCES}</p>
    </div>
  );
}
