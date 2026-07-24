import type { ReactNode } from "react";

import { LEYENDA_CROSS_LINK } from "@/components/cross-links-parlamentario";

/**
 * RelacionesSection — wrapper de COMPOSICIÓN que des-entierra el bloque de relaciones
 * de la ficha (REL-02, 101-UI-SPEC §Interaction "Ficha — relations block"). Envuelve
 * los CUATRO `CrossLinkBloque` ya montados (copartidarios / misma zona / co-comisión /
 * co-autoría) en una `<section id="relaciones">` above-the-fold, con heading + leyenda
 * de grupo + grid 2×2 responsive.
 *
 * COMPOSICIÓN PURA (Discreción del plan, variante children): recibe los 4 bloques YA
 * renderizados por el server (`page.tsx` conserva los readers `getCopartidarios` etc. y
 * los sub-componentes `CrossLink*`). Así `CrossLinkBloque` y su reader quedan
 * BYTE-INTACTOS — este componente sólo aporta el wrapper, el heading, la leyenda de
 * grupo y el layout. No toca Supabase, no re-ordena, no re-cuenta.
 *
 * FRONTERA mt-12 LOCKED (101-UI-SPEC §Spacing): la `<section id="relaciones">` es
 * HERMANA de las secciones vecinas (militancias / carriles) a `mt-12` — la frontera
 * anti-insinuación entre dominios se preserva ENTRE la sección de relaciones y sus
 * hermanas. Los `CrossLinkBloque` internos emiten cada uno su propia `<section mt-12>`;
 * dentro del grid ese mt-12 doble-espaciaría, así que se NEUTRALIZA SOLO al nivel de
 * celda con `[&>section]:mt-0` — SIN tocar `CrossLinkBloque` (Pitfall A4). El mt-12
 * inter-dominio (esta sección ↔ sus vecinas) queda intacto; el mt-0 es puramente
 * intra-sección de layout visual.
 *
 * LEYENDA DE GRUPO: reusa `LEYENDA_CROSS_LINK` VERBATIM (single-source en
 * cross-links-parlamentario.tsx; ya en NEGACIONES_LOCKED del linter). Es CONTEXTO
 * ADITIVO a nivel de sección — cada `CrossLinkBloque` interno CONSERVA su propia copia
 * de la leyenda (no se despoja la leyenda por bloque).
 *
 * CANDADOS DE RÉGIMEN (101-UI-SPEC §Typography/§Color): cero-hex, tokens tipográficos
 * (text-xl heading / text-sm leyenda), `font-semibold` matcheando los carriles. Ningún
 * hex, ningún `text-[Npx]`.
 *
 * Presentacional puro (server-friendly): si todos los bloques hijos retornan null (N=0),
 * la sección aún se monta con heading+leyenda pero sin filas — el contrato de OMISIÓN
 * total (todas las N=0 → no pintar sección) lo resuelve `page.tsx` a nivel de montaje si
 * se desea; aquí el wrapper es agnóstico y se apoya en el `return null` de cada bloque.
 */
export function RelacionesSection({ children }: { children: ReactNode }) {
  return (
    <section id="relaciones" className="mt-12">
      <h2 className="text-xl font-semibold">
        Relaciones con otros parlamentarios
      </h2>
      {/* Leyenda de grupo (VERBATIM LEYENDA_CROSS_LINK, 1× a nivel de sección). */}
      <p className="mt-2 text-sm text-muted-foreground">{LEYENDA_CROSS_LINK}</p>
      {/*
        Grid 2×2 responsive (1 col móvil, 2 cols md+). `[&>section]:mt-0` neutraliza el
        mt-12 interno que cada CrossLinkBloque emite (Pitfall A4) SIN tocar el componente;
        el gap-4 del grid provee el ritmo intra-sección. La frontera mt-12 vive en la
        <section id="relaciones"> misma (arriba), entre esta sección y sus hermanas.
      */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 [&>section]:mt-0">
        {children}
      </div>
    </section>
  );
}
