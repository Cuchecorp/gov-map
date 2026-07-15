/**
 * BrandIcon — inline SVG component for the gov-map icon.
 *
 * Geometry from 60-SELECTION.md (C — Capas que se cruzan, LOCKED).
 * Two overlapping diamonds; solid intersection. Flat petrol, no gradients.
 *
 * Default color: currentColor (hereda color del contexto). Pass an explicit color
 * when the caller needs a specific token (e.g. color="hsl(var(--accent-product))").
 */
interface BrandIconProps {
  /** Pixel size (both width and height). Default 24. */
  size?: number;
  /** SVG stroke/fill color. Default: currentColor (hereda color del contexto). */
  color?: string;
  /** Additional className for the <svg> element. */
  className?: string;
  /** aria-hidden (default true — decorative; add aria-label if standalone). */
  "aria-hidden"?: boolean | "true" | "false";
}

export function BrandIcon({
  size = 24,
  color = "currentColor",
  className,
  "aria-hidden": ariaHidden = true,
}: BrandIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden={ariaHidden}
      className={className}
      focusable="false"
    >
      <path
        d="M8.8 4.5 L15 12 L8.8 19.5 L2.6 12 Z"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M15.2 4.5 L21.4 12 L15.2 19.5 L9 12 Z"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12 8.35 L15 12 L12 15.65 L9 12 Z" fill={color} />
    </svg>
  );
}
