// ── Barra cívica 3px: proveniencia de cámara (omitida si desconocida) ───────────
// LOCKED: `bg-[var(--camara)]` / `bg-[var(--senado)]` (Tailwind v4; bare
// `-[--camara]` FALLA guard III). Deriva la cámara del literal de cobertura.
export function claseCamara(cobertura: string | null): string | null {
  if (!cobertura) return null;
  const c = cobertura.toLowerCase();
  if (c.includes("diputad") || c.includes("cámara") || c.includes("camara")) {
    return "bg-[var(--camara)]";
  }
  if (c.includes("senado")) return "bg-[var(--senado)]";
  return null; // '(sin cámara)' / piso de corpus → sin barra (regla A)
}
