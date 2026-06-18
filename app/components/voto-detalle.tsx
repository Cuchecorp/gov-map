"use client";

import { useId, useState } from "react";

import { VotoRow } from "@/components/voto-row";
import type { VotoRow as VotoRowData } from "@/lib/types";

/**
 * VotoDetalle — lista expandible del voto-a-voto (UI-SPEC §3.3, Senado).
 * Colapsado por defecto; toggle <button> con aria-expanded/aria-controls.
 * Empty state §6.1.
 */
export function VotoDetalle({ votos }: { votos: VotoRowData[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (votos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground mt-3">
        No hay desglose de votos disponible para esta votación.
      </p>
    );
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="text-sm font-semibold text-primary underline underline-offset-2 min-h-[44px] flex items-center"
      >
        {open
          ? "Ocultar votos individuales"
          : `Ver votos individuales (${votos.length})`}
      </button>

      {open && (
        <ul
          id={panelId}
          className="mt-2 max-h-96 overflow-y-auto divide-y divide-border"
        >
          {votos.map((voto, i) => (
            <VotoRow key={`${voto.mencion_nombre}-${i}`} voto={voto} />
          ))}
        </ul>
      )}
    </div>
  );
}
