// parse-camara-lobby.test — golden del parser contra el fixture real de audiencias de lobby de
// la Cámara (`listadodeaudiencias.aspx`, header + 6 filas).
//
// Verifica (Phase 24): (a) salta la cabecera repetida (<th>); (b) el sujeto pasivo va como
// asistente con rol "Sujeto Pasivo"; (c) el lobbista va como segundo asistente con rol
// "Lobbista"; (d) el nombre de asesor se preserva RAW (sin parsear el H.D.); (e) la fecha en
// español parsea a ISO + se sintetiza una clave natural `CAMARA-...`.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseCamaraLobbyAudiencias, parseFechaCamara } from "./parse-camara-lobby";
import { ROL_SUJETO_PASIVO } from "./model";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(here, "__fixtures__", "camara-listadodeaudiencias.sample.html");

function cargarFixture() {
  const html = readFileSync(FIXTURE, "utf8");
  return parseCamaraLobbyAudiencias(html, {
    enlace: "https://www.camara.cl/transparencia/listadodeaudiencias.aspx",
    fechaCaptura: "2026-06-22T00:00:00Z",
  });
}

describe("parse-camara-lobby — golden del fixture real", () => {
  it("mapea el fixture a >= 5 audiencias válidas", () => {
    const aud = cargarFixture();
    expect(aud.length).toBeGreaterThanOrEqual(5);
  });

  it("salta las filas de cabecera (ninguna audiencia tiene sujeto 'Sujeto Pasivo')", () => {
    const aud = cargarFixture();
    const sujetos = aud.flatMap((a) =>
      a.asistentes.filter((x) => x.rol === ROL_SUJETO_PASIVO).map((x) => x.nombre),
    );
    expect(sujetos.some((n) => n === "Sujeto Pasivo")).toBe(false);
  });

  it("primera audiencia: sujeto pasivo + lobbista + fecha ISO", () => {
    const aud = cargarFixture();
    const a0 = aud[0]!;
    const sujeto = a0.asistentes.find((x) => x.rol === ROL_SUJETO_PASIVO)!;
    expect(sujeto.nombre).toBe("Sofía González Cortés");
    expect(a0.fecha).not.toBeNull();
    expect(a0.fecha!.startsWith("2026-06-26")).toBe(true);
    const lobbista = a0.asistentes.find((x) => x.rol === "Lobbista");
    expect(lobbista).toBeDefined();
    expect(lobbista!.nombre.length).toBeGreaterThan(0);
  });

  it("preserva el nombre RAW del asesor (sin parsear el H.D.)", () => {
    const aud = cargarFixture();
    const conAsesor = aud.flatMap((a) => a.asistentes).find((x) =>
      x.nombre.includes("Asesor(a) H.D. Cristian Mella Andaur"),
    );
    expect(conAsesor).toBeDefined();
    expect(conAsesor!.rol).toBe(ROL_SUJETO_PASIVO);
  });

  it("sintetiza un identificador no vacío con prefijo CAMARA-", () => {
    const aud = cargarFixture();
    expect(aud.every((a) => a.identificador.startsWith("CAMARA-"))).toBe(true);
    expect(aud.every((a) => a.identificador.length > "CAMARA-".length)).toBe(true);
  });

  it("preserva fechaRaw y fija institucionCodigo = CAMARA", () => {
    const aud = cargarFixture();
    const a0 = aud[0]!;
    expect(a0.fechaRaw).toBe("26 jun. 2026");
    expect(aud.every((a) => a.institucionCodigo === "CAMARA")).toBe(true);
    expect(aud.every((a) => a.enlaceDetalle === null)).toBe(true);
  });
});

describe("parseFechaCamara", () => {
  it("parsea '26 jun. 2026' a ISO 2026-06-26", () => {
    const iso = parseFechaCamara("26 jun. 2026");
    expect(iso).not.toBeNull();
    expect(iso!.startsWith("2026-06-26")).toBe(true);
  });

  it("devuelve null ante basura (nunca fabrica)", () => {
    expect(parseFechaCamara("garbage")).toBeNull();
    expect(parseFechaCamara("")).toBeNull();
  });
});
