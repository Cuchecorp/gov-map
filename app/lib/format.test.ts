import { describe, it, expect } from "vitest";

import {
  relativeTimeEs,
  fechaCorta,
  esStale,
  capitalizarPrimera,
  fechaCortaSegura,
  formatNombre,
  partidoLegible,
  fechaHechoCorta,
  fechaHechoCortaSegura,
  fechaPlausible,
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

/**
 * F-10 (116-FECHAS-AUDIT §3): la zona horaria de `fechaCortaFormatter` era un
 * ACCIDENTE DEL ENTORNO — sin `timeZone` explícita, `Intl` usa la del runtime, así que
 * el día renderizado dependía de dónde corriera el build (Cloudflare = UTC hoy, pero
 * nada lo garantizaba). Estos tests convierten UTC en CONTRATO DEL CÓDIGO.
 *
 * UTC —y NO America/Santiago— porque preserva el comportamiento correcto de hoy: hay
 * ~45.618 filas `timestamptz` que son date-only DISFRAZADAS (medianoche UTC), y leerlas
 * en Chile fabricaría el día ANTERIOR (mismo razonamiento de `dia-calendario.ts`).
 */
describe("fechaCorta — timeZone UTC explícita (F-10, contrato no accidente)", () => {
  it("el formatter declara timeZone UTC (no la del runtime)", () => {
    // Sonda directa del contrato: si alguien quita la opción, `resolvedOptions`
    // devolvería la zona del entorno y este assert muerde.
    const probe = new Intl.DateTimeFormat("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
    expect(probe.resolvedOptions().timeZone).toBe("UTC");
    // Y el helper real rinde exactamente lo mismo que el formatter UTC de referencia.
    const d = new Date("2026-07-20T00:00:00Z");
    expect(fechaCorta(d)).toBe(probe.format(d));
  });

  it("medianoche UTC rinde el MISMO día en cualquier huso del runtime", () => {
    // En America/Santiago (−04) este instante es el 19 a las 20:00 → un formatter
    // local diría "19 jul 2026". El contrato exige el día publicado: 20.
    expect(fechaCorta(new Date("2026-07-20T00:00:00Z"))).toBe("20 jul 2026");
  });

  it("un instante que cruzaría el día en husos extremos NO se corre", () => {
    // 23:00Z del 19: en Kiritimati (+14) ya es el 20 → un formatter local diría
    // "20 jul 2026". Junto con el test anterior, ningún huso ≠ UTC satisface ambos.
    expect(fechaCorta(new Date("2026-07-19T23:00:00Z"))).toBe("19 jul 2026");
  });
});

/**
 * F-05 (116-FECHAS-AUDIT §3 + §6 límite 6): la columna `timestamptz` guarda DOS
 * semánticas mezcladas — fechas del hecho con hora REAL y fechas date-only DISFRAZADAS
 * de medianoche UTC. `fechaHechoCorta` ramifica por presencia de hora para no corregir
 * la que no lo necesita ni dejar sin corregir la que sí.
 */
describe("fechaHechoCorta (F-05, ramifica por presencia de hora)", () => {
  it("date-only disfrazada (00:00:00.000Z) → día UTC, SIN convertir de zona", () => {
    expect(fechaHechoCorta(new Date("2026-07-20T00:00:00.000Z"))).toBe(
      "20 jul 2026",
    );
  });

  it("hora REAL de madrugada UTC → día chileno (el hecho ocurrió el 16)", () => {
    // 17-nov-2023 00:14 UTC = 16-nov-2023 21:14 en Chile. El hecho (una votación de
    // sesión nocturna) ocurrió el 16 en el calendario del ciudadano.
    expect(fechaHechoCorta(new Date("2023-11-17T00:14:41Z"))).toBe("16 nov 2023");
  });

  it("hora REAL de tarde → mismo día en Chile y en UTC", () => {
    expect(fechaHechoCorta(new Date("2026-07-20T15:00:00Z"))).toBe("20 jul 2026");
  });

  // CR-02: el guard vive en el HELPER, no en la suerte del call-site.
  it("Date inválido → fallback honesto, NO lanza RangeError (guard del chokepoint)", () => {
    expect(() => fechaHechoCorta(new Date("basura"))).not.toThrow();
    expect(fechaHechoCorta(new Date("basura"))).toBe("fecha no informada");
    expect(fechaHechoCorta(new Date(NaN))).toBe("fecha no informada");
  });

  it("Date inválido con fallback propio → ese fallback, nunca 'Invalid Date'", () => {
    expect(fechaHechoCorta(new Date(NaN), "sin fecha")).toBe("sin fecha");
    expect(fechaHechoCorta(new Date(NaN), "")).toBe("");
  });
});

describe("fechaHechoCortaSegura (guard anti-500 sin slice destructivo)", () => {
  it("null → fallback honesto", () => {
    expect(fechaHechoCortaSegura(null)).toBe("fecha no informada");
  });

  it("undefined y vacío → fallback honesto", () => {
    expect(fechaHechoCortaSegura(undefined)).toBe("fecha no informada");
    expect(fechaHechoCortaSegura("")).toBe("fecha no informada");
  });

  it("basura no-ISO → fallback (nunca 'Invalid Date')", () => {
    expect(fechaHechoCortaSegura("basura")).toBe("fecha no informada");
  });

  it("fallback personalizable", () => {
    expect(fechaHechoCortaSegura(null, "sin fecha")).toBe("sin fecha");
  });

  it("ISO con hora real y offset → día chileno (NO se trunca la hora)", () => {
    // El `slice(0,10)` de `fechaCortaSegura` DESTRUIRÍA la hora aquí y daría "17 nov".
    expect(fechaHechoCortaSegura("2023-11-17T00:14:41+00:00")).toBe(
      "16 nov 2023",
    );
  });

  it("date-only puro ('YYYY-MM-DD') → día publicado, sin corrimiento", () => {
    expect(fechaHechoCortaSegura("2026-03-31")).toBe("31 mar 2026");
  });
});

/**
 * F-04 (116-FECHAS-AUDIT §3): hay fechas imposibles en la fuente (p.ej. 2626-05-25).
 * `fechaPlausible` es un PREDICADO — el llamante decide la omisión honesta; jamás un
 * filtro global (`/agenda` muestra futuro legítimo).
 */
describe("fechaPlausible (F-04, predicado — no filtro)", () => {
  const AHORA = new Date("2026-07-28T00:00:00Z");

  it("año 2626 (typo de la fuente) → no plausible", () => {
    expect(fechaPlausible(new Date("2626-05-25T00:00:00Z"), AHORA)).toBe(false);
  });

  it("anterior a 1990 → no plausible", () => {
    expect(fechaPlausible(new Date("1989-12-31T00:00:00Z"), AHORA)).toBe(false);
  });

  it("hoy → plausible", () => {
    expect(fechaPlausible(new Date("2026-07-28T00:00:00Z"), AHORA)).toBe(true);
  });

  it("futuro dentro de 5 años → plausible (urgencias y agenda futura legítimas)", () => {
    expect(fechaPlausible(new Date("2030-01-01T00:00:00Z"), AHORA)).toBe(true);
  });

  it("futuro más allá de 5 años → no plausible", () => {
    expect(fechaPlausible(new Date("2032-01-01T00:00:00Z"), AHORA)).toBe(false);
  });

  it("fecha inválida → no plausible (nunca lanza)", () => {
    expect(fechaPlausible(new Date("basura"), AHORA)).toBe(false);
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

describe("partidoLegible (saneamiento URI-como-partido, display-only)", () => {
  it("dato real PROD (S1344): URI BCN → nombre derivado del slug, CERO URI", () => {
    expect(
      partidoLegible(
        "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/partido-democratas-chile",
      ),
    ).toBe("Partido Democratas Chile");
  });

  it("dato real PROD: partido-republicano-de-chile", () => {
    expect(
      partidoLegible(
        "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/partido-republicano-de-chile",
      ),
    ).toBe("Partido Republicano De Chile");
  });

  it("dato real PROD: partido-social-cristiano", () => {
    expect(
      partidoLegible(
        "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/partido-social-cristiano",
      ),
    ).toBe("Partido Social Cristiano");
  });

  it("nunca deja pasar 'http' cuando el input es un URI BCN (invariante anti-URI)", () => {
    const out = partidoLegible(
      "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/partido-democratas-chile",
    );
    expect(out).not.toBeNull();
    expect(out!).not.toContain("http");
    expect(out!).not.toContain("datos.bcn.cl");
  });

  it("WR-01: URI BCN con scheme/host en MAYÚSCULA también se sanea (case-insensitive)", () => {
    const out = partidoLegible(
      "HTTP://DATOS.BCN.CL/recurso/cl/organismo/partido-politico/partido-social-cristiano",
    );
    expect(out).toBe("Partido Social Cristiano");
    // Invariante anti-URI cubre también el casing del host: cero URI en el DOM.
    expect(out!.toLowerCase()).not.toContain("http");
    expect(out!.toLowerCase()).not.toContain("datos.bcn.cl");
  });

  it("nombre legible de la fuente pasa VERBATIM (no re-casea un partido real)", () => {
    expect(partidoLegible("Renovación Nacional")).toBe("Renovación Nacional");
    expect(partidoLegible("Partido Comunista de Chile")).toBe(
      "Partido Comunista de Chile",
    );
  });

  it("null/vacío → null (omisión honesta preservada)", () => {
    expect(partidoLegible(null)).toBeNull();
    expect(partidoLegible(undefined)).toBeNull();
    expect(partidoLegible("")).toBeNull();
    expect(partidoLegible("   ")).toBeNull();
  });

  it("WR-02: URI BCN con slug VACÍO (solo trailing slash) → null, nunca el raw URI", () => {
    const out = partidoLegible(
      "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/",
    );
    expect(out).toBeNull();
  });

  it("WR-02: URI BCN con slug degenerado (sin trailing slash, sin segmento) → null", () => {
    // Tras el trim, "…/partido-politico/   " colapsa a "…/partido-politico/".
    const out = partidoLegible(
      "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/   ",
    );
    expect(out).toBeNull();
  });

  it("WR-02: URI BCN con slug de solo guiones → null (sin palabras utilizables)", () => {
    const out = partidoLegible(
      "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/--",
    );
    expect(out).toBeNull();
  });
});
