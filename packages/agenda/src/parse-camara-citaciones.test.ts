// TDD del parser de citaciones de Cámara (Task 2) — cheerio sobre el HTML real.
//
// RED: importa `./parse-camara-citaciones`, que aún no existe → falla por símbolo ausente.
// GREEN: el parser recorre `article.citaciones` → `table.tabla > tbody > tr`, mapea las
// columnas fijas (Comisión|Horario|Sala|Citación|Invitados), extrae el estado del
// `<p style*="color:red">`, maneja la última columna como tabla anidada (.w40/.w30) y
// extrae boletines `N°NNNNN-NN` de la materia. Cada fila valida con `CitacionSchema`.
//
// El fixture es ground truth (HTML real de `citaciones_semana.aspx?prmSemana=2026-25`,
// 4 article.citaciones / 39 filas). Si el parser falla, se corrige el parser, no el fixture.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { parseCamaraCitaciones } from "./parse-camara-citaciones";
import { CitacionSchema } from "./model";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures");
const html = readFileSync(join(FIXTURES, "camara-citaciones-semana.html"), "utf8");

describe("parseCamaraCitaciones (HTML real de Cámara, prmSemana=2026-25)", () => {
  const citaciones = parseCamaraCitaciones(html, "2026-W25");

  it("extrae ≥1 Citacion del fixture real", () => {
    expect(citaciones.length).toBeGreaterThanOrEqual(1);
  });

  it("cada Citacion es camara='camara' con comision/horario no vacíos y semana_iso fija", () => {
    for (const c of citaciones) {
      expect(c.camara).toBe("camara");
      expect(c.comision).toBeTruthy();
      expect(c.horario).toBeTruthy();
      expect(c.semana_iso).toBe("2026-W25");
    }
  });

  it("la primera fila (Economía) trae estado 'Suspendida' y materia no vacía", () => {
    const economia = citaciones.find((c) => /Econom/i.test(c.comision));
    expect(economia).toBeDefined();
    expect(economia?.estado).toBe("Suspendida");
    expect(economia?.materia).toBeTruthy();
    // sala parseada de la 3ª columna
    expect(economia?.sala).toMatch(/Sala/i);
  });

  it("las citaciones sin estado dejan estado=null (no fabrica)", () => {
    const sinEstado = citaciones.filter((c) => c.estado === null);
    expect(sinEstado.length).toBeGreaterThanOrEqual(1);
  });

  it("extrae invitados de la celda anidada .w30 cuando existen", () => {
    const conInvitados = citaciones.find((c) => c.invitados.length > 0);
    expect(conInvitados).toBeDefined();
    expect(conInvitados?.invitados[0]?.nombre).toBeTruthy();
  });

  it("extrae al menos un boletín 'NNNNN-NN' de la materia → CitacionPunto cruzable", () => {
    const conBoletin = citaciones
      .flatMap((c) => c.puntos)
      .find((p) => p.boletin !== null);
    expect(conBoletin?.boletin).toMatch(/^\d{3,5}-\d{1,2}$/);
  });

  it("cada Citacion valida contra CitacionSchema (drift: ninguna inválida emitida)", () => {
    for (const c of citaciones) {
      expect(() => CitacionSchema.parse(c)).not.toThrow();
    }
  });

  it("genera ids sintéticos estables y únicos por fila", () => {
    const ids = citaciones.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toContain("2026-W25");
  });

  it("adjunta provenance inline (origen camara + enlace a citaciones_semana.aspx)", () => {
    const c = citaciones[0]!;
    expect(c.origen).toContain("camara");
    expect(c.enlace).toContain("citaciones_semana.aspx");
    expect(c.fecha_captura).toBeTruthy();
  });

  it("es idempotente respecto al input (mismas filas en dos corridas)", () => {
    const otra = parseCamaraCitaciones(html, "2026-W25");
    expect(otra.length).toBe(citaciones.length);
    expect(otra.map((c) => c.id)).toEqual(citaciones.map((c) => c.id));
  });
});

// WR-01: la clave natural debe ser estable bajo reordenamiento de la fuente y
// NO debe fusionar dos citaciones distintas del mismo slot.
describe("parseCamaraCitaciones — clave natural estable (WR-01)", () => {
  function fila(comision: string, horario: string, sala: string, materia: string): string {
    return `<tr><td>${comision}</td><td>${horario}</td><td>${sala}</td>` +
      `<td colspan="2"><table><tbody><tr><td class="w40">${materia}</td>` +
      `<td class="w30"></td></tr></tbody></table></td></tr>`;
  }
  function doc(...filas: string[]): string {
    return `<article class="grid-12 citaciones"><p class="fecha">LUNES, 15 DE JUNIO DE 2026</p>` +
      `<table class="tabla"><tbody>${filas.join("")}</tbody></table></article>`;
  }

  it("dos citaciones distintas en el MISMO slot (comisión+fecha+horario+sala) NO colapsan", () => {
    const a = fila("Comisión X", "10:00", "Sala 1", "Materia AAA boletín N°11111-01");
    const b = fila("Comisión X", "10:00", "Sala 1", "Materia BBB boletín N°22222-02");
    const res = parseCamaraCitaciones(doc(a, b), "2026-W25");
    expect(res.length).toBe(2);
    expect(new Set(res.map((c) => c.id)).size).toBe(2); // ids distintos
  });

  it("reordenar dos filas del mismo slot mantiene el id ligado a SU materia (no swap)", () => {
    const a = fila("Comisión X", "10:00", "Sala 1", "Materia AAA");
    const b = fila("Comisión X", "10:00", "Sala 1", "Materia BBB");
    const orden1 = parseCamaraCitaciones(doc(a, b), "2026-W25");
    const orden2 = parseCamaraCitaciones(doc(b, a), "2026-W25");
    const idDe = (res: typeof orden1, materia: string) =>
      res.find((c) => c.materia?.includes(materia))!.id;
    expect(idDe(orden1, "AAA")).toBe(idDe(orden2, "AAA"));
    expect(idDe(orden1, "BBB")).toBe(idDe(orden2, "BBB"));
    expect(idDe(orden1, "AAA")).not.toBe(idDe(orden1, "BBB"));
  });

  it("distinto sala en el mismo horario/comisión NO colisiona (ids distintos)", () => {
    const a = fila("Comisión Y", "11:00", "Sala 1", "Materia única");
    const b = fila("Comisión Y", "11:00", "Sala 2", "Materia única");
    const res = parseCamaraCitaciones(doc(a, b), "2026-W25");
    expect(res.length).toBe(2);
    expect(new Set(res.map((c) => c.id)).size).toBe(2);
  });
});
