import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * BentoTile — tile bento con variants default/accent + prop span (Phase 76-01).
 *
 * Server Component (SIN "use client"). Patrón cva + cn + forwardRef + asChild/Slot,
 * verbatim de app/components/ui/button.tsx.
 *
 * Tokens de color: CERO hex hardcodeado — todo por token existente (D4 regla;
 * candado formal Phase 80). rounded-[var(--radius-tile)] consume el token definido en
 * globals.css en este mismo plan.
 *
 * Polimorfismo asChild: tile puede envolver un <Link> full-card (Phase 77-78)
 * sin duplicar focus-visible/min-h. El elemento base es <div> (no <button>).
 *
 * No montar en ninguna página hasta Phase 77-78.
 */

const bentoTileVariants = cva(
  "rounded-[var(--radius-tile)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-11",
  {
    variants: {
      variant: {
        default: "bg-card border border-border hover:border-accent-product",
        // dark-stable fill (--bento-accent-fill pinned a petróleo); text-accent-product-foreground ≥7:1; hover derivado (warning #2)
        accent: "bg-bento-accent-fill text-accent-product-foreground hover:bg-bento-accent-fill/90",
      },
      span: {
        2: "md:col-span-2",
        4: "md:col-span-4",
        6: "md:col-span-6",
      },
    },
    defaultVariants: {
      variant: "default",
      span: 2,
    },
  }
);

export interface BentoTileProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof bentoTileVariants> {
  asChild?: boolean;
}

const BentoTile = React.forwardRef<HTMLDivElement, BentoTileProps>(
  ({ className, variant, span, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";
    return (
      <Comp
        className={cn(bentoTileVariants({ variant, span, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
BentoTile.displayName = "BentoTile";

export { BentoTile, bentoTileVariants };
