/**
 * Cierre de filas de la GRILLA COMPLETA de la portada (WR-03 / WR-04, 129-REVIEW).
 *
 * POR QUÉ ESTE ARCHIVO EXISTE
 * ───────────────────────────
 * El invariante C-01 ("cero huecos interiores en la grilla bento") NO es una
 * propiedad del panel: depende de `hero(4) + accent(2)` y de los 3 entry tiles, que
 * viven en `app/page.tsx`, MÁS los 6 tiles del panel. `panel-actualidad.test.tsx`
 * solo puede ver los 6 del panel, así que un cambio del hero a span 6 reintroducía
 * el defecto C-01 con aquella suite en verde.
 *
 * Además, C-01 razonó sobre el panel RESUELTO y olvidó el estado de CARGA: mientras
 * la RPC no responde, quien ocupa el lugar del panel entero es el fallback del
 * Suspense. Las dos configuraciones se cubren aquí:
 *
 *   (a) CARGANDO  → hero(4)+accent(2) | skeleton(6) | entry(2)×3
 *   (b) RESUELTO  → hero(4)+accent(2) | sala(6) | comisiones(4)+urgencias(2)
 *                   | movimiento(6) | votaciones(4)+ingresos(2) | entry(2)×3
 *
 * Se monta `<Home />` REAL (no una réplica) y, para el panel, `PanelActualidadView`
 * REAL — el mismo componente que corre en PROD. Lo único inyectado es el tile 5, que
 * es async por diseño (lee `public.votacion` en su wrapper, D-08).
 *
 * jsdom-safe: se leen CLASES (`md:col-span-N`), jamás píxeles.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Interruptor del estado de carga, compartido con la factory hoisteada del mock.
const estado = vi.hoisted(() => ({ suspende: false }));

// El panel real es un RSC async que lee Supabase. Se sustituye por un componente
// SÍNCRONO cuyo cuerpo es la vista REAL del orquestador (`PanelActualidadView`),
// de modo que los spans y el ORDEN bajo prueba son los de producción.
vi.mock("@/components/panel-actualidad", async () => {
  const real = await vi.importActual<
    typeof import("@/components/panel-actualidad")
  >("@/components/panel-actualidad");
  const { PanelTileVotacionesView } = await vi.importActual<
    typeof import("@/components/panel-tile-votaciones")
  >("@/components/panel-tile-votaciones");
  // Suspende para siempre ⇒ React pinta el fallback del Suspense de `page.tsx`,
  // que es exactamente lo que audita el caso (a).
  const nunca = new Promise<void>(() => {});
  return {
    ...real,
    PanelActualidad: () => {
      if (estado.suspende) throw nunca;
      return (
      <real.PanelActualidadView
        // `[]` es el path legítimo de 0 filas (regla D): cada tile se monta con su
        // causa de ausencia declarada y —lo que importa aquí— con su span real.
        filas={[]}
        slotVotaciones={
          <PanelTileVotacionesView items={[]} fechaFuente={null} />
        }
      />
      );
    },
  };
});

import Home from "./page";

afterEach(() => {
  cleanup();
  estado.suspende = false;
});

/** Spans `md:col-span-N` en orden DOM, leídos de las clases REALES de BentoTile. */
function spansEnOrden(container: HTMLElement): number[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[class*="md:col-span-"]'),
  ).map((el) => Number(el.className.match(/md:col-span-(\d+)/)![1]));
}

/** Auto-placement de una grilla de 6 columnas: ningún tile excede el remanente. */
function assertCierraFilas(spans: number[]) {
  let acumulado = 0;
  for (const s of spans) {
    expect(s).toBeLessThanOrEqual(6);
    expect(
      acumulado + s,
      `hueco interior: acumulado ${acumulado} + span ${s} > 6 en la secuencia ${spans.join("·")}`,
    ).toBeLessThanOrEqual(6);
    acumulado = (acumulado + s) % 6;
  }
  // La última fila también cierra: cero remanente al final de la grilla.
  expect(acumulado, `remanente final en la secuencia ${spans.join("·")}`).toBe(0);
}

describe("C-01 (grilla COMPLETA de `/`) — cero huecos interiores", () => {
  it("(b) panel RESUELTO: hero + accent + los 6 tiles + los 3 entry tiles cierran filas de 6", () => {
    const { container } = render(<Home />);
    const spans = spansEnOrden(container);

    // Control positivo APAREADO: sin esto, una secuencia vacía "cerraría filas"
    // de forma vacua. 2 (hero+accent) + 6 (panel) + 3 (entry) = 11 tiles.
    expect(spans).toHaveLength(11);
    // …y los 6 tiles del panel están REALMENTE montados (no un stub vacío).
    expect(container.querySelectorAll("h2").length).toBeGreaterThanOrEqual(6);

    assertCierraFilas(spans);
  });

  it("(a) panel CARGANDO: el fallback del Suspense ocupa el lugar del panel entero y la grilla sigue cerrando", () => {
    // WR-03: el fallback reemplaza a los 6 tiles (3 filas de 6), así que debe
    // ocupar una fila COMPLETA. Con span 4 la fila de carga era skeleton(4)+entry(2)
    // y al resolver saltaba a sala(6): reflow de media portada (CLS), y los 3 entry
    // tiles cerraban 4+2 | 2+2 dejando remanente de 2.
    estado.suspende = true;

    const { container } = render(<Home />);
    const spans = spansEnOrden(container);

    // Control positivo APAREADO: el fallback SÍ está montado (y el panel NO).
    const skeleton = container.querySelector('[aria-hidden="true"][class*="md:col-span-"]');
    expect(skeleton).not.toBeNull();
    // 2 (hero+accent) + 1 (skeleton) + 3 (entry) = 6 tiles.
    expect(spans).toHaveLength(6);

    assertCierraFilas(spans);
  });
});
