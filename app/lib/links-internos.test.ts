import { describe, expect, it } from "vitest";
import { hrefProyecto, hrefAgenda, semanaIsoDeFecha } from "@/lib/links-internos";

describe("links-internos", () => {
  describe("hrefProyecto", () => {
    it("boletín + ancla 'estado' produce /proyecto/{b}#estado", () => {
      expect(hrefProyecto("16569-25", "estado")).toBe("/proyecto/16569-25#estado");
    });

    it("ancla 'timeline' produce #timeline", () => {
      expect(hrefProyecto("16569-25", "timeline")).toBe("/proyecto/16569-25#timeline");
    });

    it("ancla 'votaciones' produce #votaciones", () => {
      expect(hrefProyecto("16569-25", "votaciones")).toBe("/proyecto/16569-25#votaciones");
    });

    it("el boletín se pasa por encodeURIComponent (caracteres raros no rompen la URL)", () => {
      expect(hrefProyecto("16569/25 raro", "estado")).toBe(
        `/proyecto/${encodeURIComponent("16569/25 raro")}#estado`,
      );
      expect(hrefProyecto("16569/25 raro", "estado")).not.toContain(" ");
    });
  });

  describe("hrefAgenda", () => {
    it("query ANTES del fragmento: /agenda?semana=2026-W32#tabla-sala", () => {
      expect(hrefAgenda("tabla-sala", "2026-W32")).toBe("/agenda?semana=2026-W32#tabla-sala");
    });

    it("MUERDE el orden invertido (query nunca después del hash)", () => {
      const href = hrefAgenda("tabla-sala", "2026-W32");
      expect(href).not.toContain("#tabla-sala?");
    });

    it("sin semana: /agenda#citaciones (sin ?semana= vacío)", () => {
      expect(hrefAgenda("citaciones", null)).toBe("/agenda#citaciones");
    });

    it("sin semana (undefined): /agenda#citaciones", () => {
      expect(hrefAgenda("citaciones")).toBe("/agenda#citaciones");
    });

    it("semana malformada omite el query, nunca emite semana= inválido", () => {
      const href = hrefAgenda("resultados", "basura");
      expect(href).toBe("/agenda#resultados");
      expect(href).not.toContain("semana=");
    });
  });

  describe("semanaIsoDeFecha", () => {
    it("'2026-08-04' produce '2026-W32' (date-only medianoche UTC, sin conversión de zona)", () => {
      expect(semanaIsoDeFecha("2026-08-04")).toBe("2026-W32");
    });

    it("null produce null", () => {
      expect(semanaIsoDeFecha(null)).toBeNull();
    });

    it("undefined produce null", () => {
      expect(semanaIsoDeFecha(undefined)).toBeNull();
    });

    it("fecha no parseable produce null", () => {
      expect(semanaIsoDeFecha("no-fecha")).toBeNull();
    });
  });
});
