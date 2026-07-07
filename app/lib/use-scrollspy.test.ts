import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, cleanup, act } from "@testing-library/react";

import { useScrollspy } from "./use-scrollspy";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── Mock IntersectionObserver: captura el callback y expone un disparador ──────
type IOEntryLike = {
  isIntersecting: boolean;
  target: { id: string };
  boundingClientRect: { top: number };
};

function mockIntersectionObserver() {
  let capturedCb: ((entries: IOEntryLike[]) => void) | null = null;
  const observe = vi.fn();
  const disconnect = vi.fn();

  class FakeIO {
    constructor(cb: (entries: IOEntryLike[]) => void) {
      capturedCb = cb;
    }
    observe = observe;
    disconnect = disconnect;
    unobserve = vi.fn();
    takeRecords = vi.fn();
  }
  // @ts-expect-error — inyectamos el mock global para el test.
  globalThis.IntersectionObserver = FakeIO;

  return {
    observe,
    disconnect,
    fire: (entries: IOEntryLike[]) => capturedCb?.(entries),
  };
}

describe("useScrollspy — id activo vía IntersectionObserver (UXCOG 55-01)", () => {
  it("Test 1: arranca con el primer id como activo por defecto", () => {
    mockIntersectionObserver();
    // getElementById devuelve un elemento para que observe() lo tome.
    vi.spyOn(document, "getElementById").mockImplementation(
      (id: string) => ({ id }) as unknown as HTMLElement,
    );

    const { result } = renderHook(() => useScrollspy(["votos", "lobby"]));
    expect(result.current).toBe("votos");
  });

  it("Test 2: tras un intersect mockeado devuelve el id de la sección que cruza", () => {
    const io = mockIntersectionObserver();
    vi.spyOn(document, "getElementById").mockImplementation(
      (id: string) => ({ id }) as unknown as HTMLElement,
    );

    const { result } = renderHook(() =>
      useScrollspy(["votos", "lobby", "patrimonio"]),
    );

    act(() => {
      io.fire([
        {
          isIntersecting: true,
          target: { id: "lobby" },
          boundingClientRect: { top: 20 },
        },
      ]);
    });

    expect(result.current).toBe("lobby");
  });

  it("Test 3: entre varias visibles gana la de menor top (tercio superior)", () => {
    const io = mockIntersectionObserver();
    vi.spyOn(document, "getElementById").mockImplementation(
      (id: string) => ({ id }) as unknown as HTMLElement,
    );

    const { result } = renderHook(() =>
      useScrollspy(["votos", "lobby", "patrimonio"]),
    );

    act(() => {
      io.fire([
        {
          isIntersecting: true,
          target: { id: "patrimonio" },
          boundingClientRect: { top: 300 },
        },
        {
          isIntersecting: true,
          target: { id: "votos" },
          boundingClientRect: { top: 10 },
        },
      ]);
    });

    expect(result.current).toBe("votos");
  });
});
