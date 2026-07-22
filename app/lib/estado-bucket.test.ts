import { describe, expect, it } from "vitest";
import { ETIQUETA_BUCKET, deriveAnio, estadoBucket } from "./estado-bucket";

// ---------------------------------------------------------------------------
// estadoBucket — normalizador texto-libre → bucket enum
// ---------------------------------------------------------------------------

describe("estadoBucket", () => {
  // 6 buckets nominales (del censo PROD + ejemplos del plan)
  it("mapea 'Publicado' → publicado_ley", () => {
    expect(estadoBucket("Publicado")).toBe("publicado_ley");
  });

  it("mapea 'Publicada como ley' → publicado_ley", () => {
    expect(estadoBucket("Publicada como ley")).toBe("publicado_ley");
  });

  it("mapea 'Tramitación terminada' → publicado_ley", () => {
    expect(estadoBucket("Tramitación terminada")).toBe("publicado_ley");
  });

  it("mapea 'En tramitación' → en_tramitacion", () => {
    expect(estadoBucket("En tramitación")).toBe("en_tramitacion");
  });

  it("mapea 'En tramitación (segundo trámite)' → en_tramitacion", () => {
    expect(estadoBucket("En tramitación (segundo trámite)")).toBe("en_tramitacion");
  });

  it("mapea 'Primer trámite constitucional (C.Diputados)' → en_tramitacion", () => {
    expect(estadoBucket("Primer trámite constitucional (C.Diputados)")).toBe("en_tramitacion");
  });

  it("mapea 'Archivado' → archivado", () => {
    expect(estadoBucket("Archivado")).toBe("archivado");
  });

  it("mapea 'Rechazado' → rechazado", () => {
    expect(estadoBucket("Rechazado")).toBe("rechazado");
  });

  it("mapea 'Comisión Mixta por rechazo de idea de legislar (Senado)' → rechazado", () => {
    expect(estadoBucket("Comisión Mixta por rechazo de idea de legislar (Senado)")).toBe(
      "rechazado",
    );
  });

  it("mapea 'Retirado' → retirado", () => {
    expect(estadoBucket("Retirado")).toBe("retirado");
  });

  // sin_dato — fallbacks honestos
  it("null → sin_dato", () => {
    expect(estadoBucket(null)).toBe("sin_dato");
  });

  it("cadena vacía → sin_dato", () => {
    expect(estadoBucket("")).toBe("sin_dato");
  });

  it("texto no mapeado → sin_dato (nunca folding silencioso)", () => {
    expect(estadoBucket("cualquier cosa no mapeada")).toBe("sin_dato");
    expect(estadoBucket("estado desconocido xyz")).toBe("sin_dato");
  });

  it("solo espacios → sin_dato", () => {
    expect(estadoBucket("   ")).toBe("sin_dato");
  });

  // REGLA ORDER-MATTERS: texto compuesto con tokens de tramitación Y de ley
  // El bug latente de EtapaBadge bucketea "En tramitación … ley" → publicado_ley
  // porque testa "ley" ANTES que "tramit". Aquí los terminales van primero en la
  // tabla, pero "publicado_ley" (token "ley") y "en_tramitacion" (token "tramit")
  // coexisten. El texto compuesto con "tramit" ACTIVO no debe caer a publicado_ley.
  it("texto compuesto 'En tramitación (segundo trámite) — ley en …' → en_tramitacion (order-matters)", () => {
    // Este caso prueba que el token "ley" embebido en un compuesto de tramitación
    // no lo escala a publicado_ley cuando la frase claramente está en trámite.
    // Nuestro patrón usa "public"/"promulg"/"terminada" (no "ley" solo), así que
    // el texto de tramitación no hace match en publicado_ley y cae a en_tramitacion.
    expect(estadoBucket("En tramitación (segundo trámite) — ley en proceso")).toBe(
      "en_tramitacion",
    );
  });

  // Insensitivity a mayúsculas
  it("insensible a mayúsculas", () => {
    expect(estadoBucket("RECHAZADO")).toBe("rechazado");
    expect(estadoBucket("en tramitación")).toBe("en_tramitacion");
  });
});

// ---------------------------------------------------------------------------
// ETIQUETA_BUCKET — labels display LOCKED
// ---------------------------------------------------------------------------

describe("ETIQUETA_BUCKET", () => {
  it("todos los buckets tienen etiqueta", () => {
    const buckets = [
      "en_tramitacion",
      "publicado_ley",
      "archivado",
      "rechazado",
      "retirado",
      "sin_dato",
    ] as const;
    for (const b of buckets) {
      expect(ETIQUETA_BUCKET[b]).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// deriveAnio — ISO → año honesto (nunca un año fabricado)
// ---------------------------------------------------------------------------

describe("deriveAnio", () => {
  // Casos válidos
  it("ISO completo con TZ → año", () => {
    expect(deriveAnio("2023-05-14T00:00:00Z")).toBe(2023);
  });

  it("ISO fecha sin hora → año", () => {
    expect(deriveAnio("2019-01-01")).toBe(2019);
  });

  it("año edge 2000 → 2000", () => {
    expect(deriveAnio("2000-12-31")).toBe(2000);
  });

  // Casos no parseables → null (NUNCA un año fabricado)
  it("null → null", () => {
    expect(deriveAnio(null)).toBeNull();
  });

  it("cadena vacía → null", () => {
    expect(deriveAnio("")).toBeNull();
  });

  it("texto basura → null", () => {
    expect(deriveAnio("no-es-fecha")).toBeNull();
  });

  it("string que empieza con letras → null", () => {
    expect(deriveAnio("abc-01-01")).toBeNull();
  });

  it("string incompleto '202' → null", () => {
    expect(deriveAnio("202")).toBeNull();
  });
});
