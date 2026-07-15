import { cn } from "@/lib/utils";

/**
 * BentoGrid — grid 6 columnas colapsable (Phase 76-01).
 *
 * Server Component (SIN "use client"). Wrapper div con grid 6-col en ≥md,
 * colapsa a 1 col en <md con orden DOM = orden visual (sin reorden CSS).
 *
 * gap-[14px]: arbitrary off-step intencional del mockup — NO redondear a gap-4/gap-3.
 * [grid-auto-rows:minmax(0,auto)]: arbitrary intencional.
 *
 * Las tiles hijas (BentoTile) controlan su span con md:col-span-N.
 * No montar en ninguna página hasta Phase 77-78.
 */

interface BentoGridProps {
  children?: React.ReactNode;
  className?: string;
}

export function BentoGrid({ children, className }: BentoGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-[14px] md:grid-cols-6 [grid-auto-rows:minmax(0,auto)]",
        className
      )}
    >
      {children}
    </div>
  );
}
