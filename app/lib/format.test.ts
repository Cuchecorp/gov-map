import { describe, it, expect } from "vitest";

import {
  relativeTimeEs,
  fechaCorta,
  esStale,
  capitalizarPrimera,
  fechaCortaSegura,
  formatNombre,
} from "./format";

const NOW = new Date("2026-05-20T12:00:00Z");

describe("relativeTimeEs", () => {
  it("< 1h → 'hace X min'", () => {
    const captured = new Date(NOW.getTime() - 25 * 60 * 1000);
    expect(relativeTimeEs(captured, NOW)).toBe("hace 25 min");
  });

  it("exactamente al borde de 1h sigue en minutos < 60", () => {
    const captured = new Date(NOW.getTime() - 59 * 60 * 1000);
    expect(relativeTimeEs(captured, NOW)).toBe("hace 59 min");
  });

  it("< 24h → 'hace X h'", () => {
    const captured = new Date(NOW.getTime() - 3 * 60 * 60 * 1000);
    expect(relativeTimeEs(captured, NOW)).toBe("hace 3 h");
  });

  it("< 7d con 1 día → singular 'día'", () => {
    const captured = new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000);
    expect(relativeTimeEs(captured, NOW)).toBe("hace 1 día");
  });

  it("< 7d con varios días → plural 'días'", () => {
    const captured = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000);
    expect(relativeTimeEs(captured, NOW)).toBe("hace 3 días");
  });

  it("≥ 7d → fecha absoluta DD MMM YYYY", () => {
    const captured = new Date("2026-05-01T12:00:00Z");
    // 19 días atrás → fecha absoluta
    expect(relativeTimeEs(captured, NOW)).toBe(fechaCorta(captured));
    expect(relativeTimeEs(captured, NOW)).toMatch(/2026/);
  });

  it("captura en el futuro (reloj desfasado) → 'hace 0 min'", () => {
    const captured = new Date(NOW.getTime() + 60 * 1000);
    expect(relativeTimeEs(captured, NOW)).toBe("hace 0 min");
  });
});

describe("fechaCorta", () => {
  it("formatea como 'DD MMM YYYY' es-CL", () => {
    const d = new Date("2026-05-14T12:00:00Z");
    const out = fechaCorta(d);
    expect(out).toMatch(/14/);
    expect(out).toMatch(/2026/);
    // mes abreviado en español (may)
    expect(out.toLowerCase()).toMatch(/may/);
  });
});

describe("esStale (umbral por cadence de ingesta, ~14 días)", () => {
  it("dato reciente (47h) → false", () => {
    const captured = new Date(NOW.getTime() - 47 * 60 * 60 * 1000);
    expect(esStale(captured, NOW)).toBe(false);
  });

  it("≤ 14d (13 días) → false", () => {
    const captured = new Date(NOW.getTime() - 13 * 24 * 60 * 60 * 1000);
    expect(esStale(captured, NOW)).toBe(false);
  });

  it("> 14d (15 días) → true", () => {
    const captured = new Date(NOW.getTime() - 15 * 24 * 60 * 60 * 1000);
    expect(esStale(captured, NOW)).toBe(true);
  });
});

describe("capitalizarPrimera", () => {
  it("capitaliza solo la primera letra, conserva la coma del locale", () => {
    expect(capitalizarPrimera("jueves, 2 de julio")).toBe("Jueves, 2 de julio");
  });

  it("cadena vacía → cadena vacía (sin crash)", () => {
    expect(capitalizarPrimera("")).toBe("");
  });
});

describe("formatNombre (display-only, Contract 1 · Phase 54)", () => {
  // Tabla del UI-SPEC — strings 100% minúsculas SÍ se transforman.
  it("'gonzalez sofia' → 'Gonzalez Sofia' (sin tildes nuevas)", () => {
    expect(formatNombre("gonzalez sofia")).toBe("Gonzalez Sofia");
  });

  it("'maria de los angeles' → 'Maria de los Angeles' (partículas no-iniciales en minúscula)", () => {
    expect(formatNombre("maria de los angeles")).toBe("Maria de los Angeles");
  });

  it("'de la maza carlos' → 'De la Maza Carlos' (partícula como primer token SÍ capitaliza)", () => {
    expect(formatNombre("de la maza carlos")).toBe("De la Maza Carlos");
  });

  it("'o'higgins' → 'O'Higgins' (apóstrofe preservado, sub-token capitalizado)", () => {
    expect(formatNombre("o'higgins")).toBe("O'Higgins");
  });

  it("'perez-mackenna' → 'Perez-Mackenna' (guion preservado, sub-token capitalizado)", () => {
    expect(formatNombre("perez-mackenna")).toBe("Perez-Mackenna");
  });

  it("'irarrazaval  juan' (doble espacio) → 'Irarrazaval Juan' (colapsa whitespace)", () => {
    expect(formatNombre("irarrazaval  juan")).toBe("Irarrazaval Juan");
  });

  it("'Boris Barrera Moreno' (mixed case) → verbatim (passthrough)", () => {
    expect(formatNombre("Boris Barrera Moreno")).toBe("Boris Barrera Moreno");
  });

  it("'AFP HABITAT' (all caps) → verbatim (passthrough, nunca 'Afp Habitat')", () => {
    expect(formatNombre("AFP HABITAT")).toBe("AFP HABITAT");
  });

  it("null / undefined / '' / '   ' → '' (callers conservan su null-fallback)", () => {
    expect(formatNombre(null)).toBe("");
    expect(formatNombre(undefined)).toBe("");
    expect(formatNombre("")).toBe("");
    expect(formatNombre("   ")).toBe("");
  });

  // Datos reales (censo PROD 2026-07-07, ver 54-RESEARCH §Real-Data Findings).
  it("dato real: 'enrique rysselberghe van' → 'Enrique Rysselberghe van' (partícula en posición FINAL)", () => {
    expect(formatNombre("enrique rysselberghe van")).toBe("Enrique Rysselberghe van");
  });

  it("dato real: 'camara chilena de la construcción' → 'Camara Chilena de la Construcción' (partículas consecutivas, tilde lowercase preexistente intacta)", () => {
    expect(formatNombre("camara chilena de la construcción")).toBe(
      "Camara Chilena de la Construcción",
    );
  });

  it("dato real: 'fundación mas familia Ñuble' → verbatim (passthrough vía \\p{Lu}, Ñ sin A-Z)", () => {
    expect(formatNombre("fundación mas familia Ñuble")).toBe("fundación mas familia Ñuble");
  });

  it("dato real: 'kypco spa' → 'Kypco Spa' (sigla lowercase queda Title Case — limitación cosmética conocida)", () => {
    expect(formatNombre("kypco spa")).toBe("Kypco Spa");
  });

  it("idempotencia: formatNombre(formatNombre(x)) === formatNombre(x) para todos los casos", () => {
    const casos = [
      "gonzalez sofia",
      "maria de los angeles",
      "de la maza carlos",
      "o'higgins",
      "perez-mackenna",
      "irarrazaval  juan",
      "Boris Barrera Moreno",
      "AFP HABITAT",
      "enrique rysselberghe van",
      "camara chilena de la construcción",
      "fundación mas familia Ñuble",
      "kypco spa",
      "",
      "   ",
    ];
    for (const x of casos) {
      const once = formatNombre(x);
      expect(formatNombre(once)).toBe(once);
    }
  });
});

describe("fechaCortaSegura (degrada, nunca 'Invalid Date')", () => {
  it("null → fallback honesto", () => {
    expect(fechaCortaSegura(null)).toBe("fecha no informada");
  });

  it("cadena vacía → fallback honesto", () => {
    expect(fechaCortaSegura("")).toBe("fecha no informada");
  });

  it("no-ISO → fallback honesto", () => {
    expect(fechaCortaSegura("no-es-fecha")).toBe("fecha no informada");
  });

  it("ISO válida → mismo output que fechaCorta(new Date(iso))", () => {
    expect(fechaCortaSegura("2024-03-15")).toBe(fechaCorta(new Date("2024-03-15")));
  });

  it("nunca retorna la cadena 'Invalid Date'", () => {
    expect(fechaCortaSegura("2024-13-99")).toBe("fecha no informada");
  });
});
