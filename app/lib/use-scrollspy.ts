"use client";

import { useEffect, useState } from "react";

/**
 * Scrollspy sin dependencias (UXCOG 55-01). Observa cada `#id` con un ÚNICO
 * `IntersectionObserver` y devuelve el id de la sección que cruza el tercio
 * superior del viewport (`rootMargin: "-20% 0px -70% 0px"`). El resultado marca
 * la entrada "actual" en `FichaRail`; NUNCA fabrica una sección — si nada cruza,
 * conserva la última activa (o `ids[0]` inicial).
 *
 * Referencia verbatim de 55-RESEARCH §Code Examples "Scrollspy hook".
 */
export function useScrollspy(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  return active;
}
