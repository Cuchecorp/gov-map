import { describe, it, expect } from "vitest";

import {
  diaCalendarioCitacion,
  badgeFechaCitacion,
  fechaCivilCorta,
  dayLabelCitacion,
} from "./dia-calendario";

/**
 * Contrato date-only-midnight-UTC (regresión live Phase 94). `citacion.fecha` y
 * `sesion_sala.fecha` se almacenan como MEDIANOCHE UTC date-only; la hora real vive
 * en `horario` (texto). La parte fecha UTC ES el día publicado por la fuente — NO se
 * convierte de zona. Interpretar 00:00Z en America/Santiago fabrica el día anterior.
 */
describe("diaCalendarioCitacion — parte fecha UTC (día publicado), sin conversión de zona", () => {
  it("fixture midnight-UTC + horario texto: 2026-07-20T00:00Z (lunes 20, horario '10:30') → 2026-07-20", () => {
    // El caso exacto de la regresión: tz Chile retrocedía a domingo 19.
    const fecha = "2026-07-20T00:00:00+00:00"; // date-only midnight-UTC (contrato)
    const horario = "10:30"; // hora real vive aparte
    expect(diaCalendarioCitacion(fecha)).toBe("2026-07-20");
    // El horario NO altera el día publicado (son columnas independientes).
    expect(horario).toBe("10:30");
  });

  it("citación de HOY 2026-07-22T00:00Z → 2026-07-22 (no el 21)", () => {
    expect(diaCalendarioCitacion("2026-07-22T00:00:00Z")).toBe("2026-07-22");
  });

  it("acepta Date además de string", () => {
    expect(diaCalendarioCitacion(new Date("2026-07-20T00:00:00Z"))).toBe(
      "2026-07-20",
    );
  });

  it("null / undefined / fecha inválida → null (nunca 'Invalid Date')", () => {
    expect(diaCalendarioCitacion(null)).toBeNull();
    expect(diaCalendarioCitacion(undefined)).toBeNull();
    expect(diaCalendarioCitacion("no-es-fecha")).toBeNull();
  });
});

describe("badgeFechaCitacion — 'DD-mmm' del día publicado", () => {
  it("2026-07-20T00:00Z → '20-jul' (NUNCA '19-jul')", () => {
    expect(badgeFechaCitacion("2026-07-20T00:00:00Z")).toBe("20-jul");
  });

  it("2026-01-05T00:00Z → '05-ene'", () => {
    expect(badgeFechaCitacion("2026-01-05T00:00:00Z")).toBe("05-ene");
  });

  it("fecha inválida → null (el caller omite el badge)", () => {
    expect(badgeFechaCitacion(null)).toBeNull();
    expect(badgeFechaCitacion("no-es-fecha")).toBeNull();
  });
});

/**
 * CR-01 (117-REVIEW): las superficies HISTÓRICAS (citaciones pasadas, tabla de sala,
 * panel de actualidad) necesitan el AÑO. `badgeFechaCitacion` lo omite por diseño —
 * es el badge compacto de /agenda. `fechaCivilCorta` lo trae, con la MISMA regla
 * date-only (parte fecha UTC = día publicado, cero conversión de zona).
 */
describe("fechaCivilCorta — 'DD mmm YYYY' del día publicado (con AÑO)", () => {
  it("2026-07-20T00:00Z → '20 jul 2026' (NUNCA '19 jul 2026')", () => {
    expect(fechaCivilCorta("2026-07-20T00:00:00Z")).toBe("20 jul 2026");
  });

  it("sesión histórica 2021-07-20T00:00Z → '20 jul 2021' (el año NO se pierde)", () => {
    // El defecto que CR-01 cierra: "20-jul" se leía como el año en curso.
    expect(fechaCivilCorta("2021-07-20T00:00:00Z")).toBe("20 jul 2021");
    expect(badgeFechaCitacion("2021-07-20T00:00:00Z")).toBe("20-jul"); // sin año
  });

  it("2026-01-05T00:00Z → '05 ene 2026'", () => {
    expect(fechaCivilCorta("2026-01-05T00:00:00Z")).toBe("05 ene 2026");
  });

  it("23:00Z NO retrocede de día ni de año (cero conversión de zona)", () => {
    // Ningún huso distinto de UTC deja este par intacto.
    expect(fechaCivilCorta("2025-12-31T23:00:00Z")).toBe("31 dic 2025");
  });

  it("fecha inválida → null (el caller omite la fecha)", () => {
    expect(fechaCivilCorta(null)).toBeNull();
    expect(fechaCivilCorta(undefined)).toBeNull();
    expect(fechaCivilCorta("no-es-fecha")).toBeNull();
  });
});

describe("dayLabelCitacion — 'Weekday D de mes' del día publicado, capitalizado", () => {
  it("2026-07-20T00:00Z → 'Lunes 20 de julio' (NUNCA 'Domingo 19 de julio')", () => {
    expect(dayLabelCitacion("2026-07-20T00:00:00Z")).toBe("Lunes 20 de julio");
  });

  it("2026-07-22T00:00Z → 'Miércoles 22 de julio'", () => {
    expect(dayLabelCitacion("2026-07-22T00:00:00Z")).toBe("Miércoles 22 de julio");
  });

  it("fecha inválida → null (el caller degrada a 'Sin fecha asignada')", () => {
    expect(dayLabelCitacion(null)).toBeNull();
    expect(dayLabelCitacion("no-es-fecha")).toBeNull();
  });
});
