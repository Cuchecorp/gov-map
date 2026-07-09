import type { MetadataRoute } from "next";

/**
 * Web App Manifest — Next.js file convention.
 * Phase 60 (BRAND-02): icon/identity integration.
 *
 * Icons: generated from master SVG (60-SELECTION.md) via scripts/generate-brand-assets.mjs.
 * theme_color / background_color match design-system tokens:
 *   petrol  #2A5859  (--accent-product hsl(183 38% 26%))
 *   cream   #FAF8F3  (--background hsl(40 33% 97%))
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "gov-map",
    short_name: "gov-map",
    description:
      "Consulta y cruza datos públicos del Congreso de Chile: proyectos de ley, tramitación y votaciones, con trazabilidad a la fuente.",
    start_url: "/",
    display: "standalone",
    theme_color: "#2A5859",
    background_color: "#FAF8F3",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
