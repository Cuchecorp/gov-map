"use client";

import { useState } from "react";

/**
 * AutoresList — autores en texto plano (UI-SPEC §3.1.1).
 * Si hay más de 3, muestra los primeros 3 + "+ N más" como botón que expande
 * inline (sin modal). Los nombres NUNCA son enlaces en Fase 5 (la ficha de
 * parlamentario es de un milestone posterior).
 */
export function AutoresList({ autores }: { autores: string[] }) {
  const [expanded, setExpanded] = useState(false);

  if (autores.length === 0) {
    return (
      <p className="text-sm text-muted-foreground mt-2">
        Autores no informados.
      </p>
    );
  }

  const collapsed = autores.length > 3 && !expanded;
  const shown = collapsed ? autores.slice(0, 3) : autores;
  const restantes = autores.length - 3;

  return (
    <p className="text-sm text-muted-foreground mt-2">
      {shown.join(", ")}
      {collapsed && (
        <>
          {" "}
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-primary underline underline-offset-2"
          >
            + {restantes} más
          </button>
        </>
      )}
    </p>
  );
}
