import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * MencionBoletinChip — chip-LINK "Menciona boletín N" (92-UI-SPEC §Component 2,
 * LOB-02/LOB-03). A diferencia de `PartidoChip` (chip INFORMATIVO), este chip es un
 * ENLACE navegable: la materia de una audiencia de lobby menciona EXPLÍCITAMENTE un
 * número de boletín válido → el chip navega a `/proyecto/{N}` (navegación
 * bidireccional audiencia→PL).
 *
 * ── FAIL-CLOSED (LOCKED) ────────────────────────────────────────────────────────
 * El componente NO decide si el boletín es válido: SÓLO se monta cuando el consumidor
 * ya validó (server-side, Block-B) que el boletín (a) matchea el patrón determinista
 * de `extraerBoletines` Y (b) EXISTE en `proyecto`. Nunca se fabrica un chip muerto
 * (link a un proyecto inexistente) — esa compuerta vive aguas arriba, en el Server
 * Component. Este chip asume `boletin` VÁLIDO y sólo lo pinta como enlace.
 *
 * ── NEUTRALIDAD DE COLOR (§Color, LOCKED) ───────────────────────────────────────
 * El petróleo (`accent-product`) es IDÉNTICO para todo chip de mención: codifica
 * "esto es un ENLACE" (coherente con todos los links del sitio), JAMÁS relevancia,
 * riesgo ni afinidad. NO existe color-por-tema ni color-por-boletín. Una mención es un
 * hecho neutro del registro público, no una señal de alerta.
 *
 * ── WR-04 (HTML hostil) ─────────────────────────────────────────────────────────
 * El chip YA es interactivo (es un Link). NUNCA anida un `TooltipTrigger` Radix
 * dentro del Link (focus-stop dentro de un anchor + click que compite con la
 * navegación). Toda la semántica va en el `aria-label` LOCKED.
 *
 * ── COPY LOCKED (92-UI-SPEC §Copywriting) ───────────────────────────────────────
 *   label      : "Menciona boletín {N}"  ({N} en font-mono)
 *   aria-label : "Esta materia menciona el boletín {N}; abre el proyecto."
 *
 * `LobbyView` es PURO → el chip llega ya resuelto en los datos serializados; este
 * componente no importa `@/lib/supabase` ni consulta la DB.
 */
export function MencionBoletinChip({ boletin }: { boletin: string }) {
  return (
    <Link
      href={`/proyecto/${boletin}`}
      aria-label={`Esta materia menciona el boletín ${boletin}; abre el proyecto.`}
      className={cn(
        "inline-flex min-h-11 items-center no-underline",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-product",
      )}
    >
      {/* Look de enlace petróleo, IDÉNTICO por boletín (§Color). Badge outline como
          PartidoChip, pero con acento petróleo (borde/texto) + fondo petróleo-soft. */}
      <Badge
        variant="outline"
        data-slot="mencion-boletin-chip"
        className={cn(
          "border-accent-product bg-accent-product-soft text-accent-product",
        )}
      >
        {/* Etiqueta en Sans; el número de boletín SIEMPRE en Mono (§Typography LOCKED). */}
        <span>Menciona boletín </span>
        <span className="font-mono">{boletin}</span>
      </Badge>
    </Link>
  );
}

/**
 * Helper de layout: rinde un chip por cada boletín VÁLIDO en `flex flex-wrap gap-2
 * mt-1` (92-UI-SPEC §Component 2 — los chips van BAJO la materia, en su propia fila,
 * nunca inline con el texto largo). El consumidor pasa la lista YA validada, ordenada
 * ascendente y deduplicada por el Server Component. Si la lista está vacía → no se
 * pinta nada (fail-closed: materia sin mención válida = fila normal, sin chip).
 */
export function MencionBoletinChips({ boletines }: { boletines: string[] }) {
  if (boletines.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {boletines.map((b) => (
        <MencionBoletinChip key={b} boletin={b} />
      ))}
    </div>
  );
}
