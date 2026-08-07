// calibracion-ceguera-guard.test.ts — guard de ceguera del artefacto de calibración
// (D-133-C2.1.2, D-133-G). El escaneo cubre el DOCUMENTO COMPLETO (casos[] + glosa +
// metadatos), a cualquier profundidad — ver `<alcance_del_guard>` de 133-b-04-PLAN.md. La
// no-sobre-amplitud es propiedad de la DENYLIST (`CLAVES_DE_MAQUINA`), no del alcance.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { verificarCeguera, derivarGlosa, CLAVES_DE_MAQUINA, ItemCiegoSchema, ArtefactoCiegoSchema } from "./calibracion";

const AQUI = dirname(fileURLToPath(import.meta.url));

function artefactoBase() {
  return {
    semilla: "133-b-golden-2026",
    ventana: "2026-08-05..2026-08-07",
    glosa: derivarGlosa(),
    casos: Array.from({ length: 20 }, (_, i) => ({
      id: `id${i}`,
      titulo: `Titular ${i}`,
      descripcion: `Bajada ${i}`,
      outlet: "latercera",
      fecha: null,
    })),
  };
}

describe("calibracion-ceguera-guard — el guard escanea el documento completo", () => {
  it("(b) un ítem con etiqueta_a ⇒ FALLA", () => {
    const artefacto = artefactoBase();
    (artefacto.casos[0] as Record<string, unknown>)["etiqueta_a"] = "tramitacion_legislativa";
    expect(() => verificarCeguera(artefacto)).toThrow();
  });

  it("(c) clave de máquina ANIDADA (prefiltro.terminos en un sub-objeto) ⇒ FALLA (escaneo recursivo)", () => {
    const artefacto = artefactoBase() as Record<string, unknown>;
    // Anidada dos niveles: metadatos.extra.prefiltro — el escaneo debe alcanzar cualquier
    // profundidad, no solo el primer nivel de cada caso.
    artefacto["metadatosExtra"] = { nivel1: { prefiltro: { paso: true, terminos: ["ley"] } } };
    expect(() => verificarCeguera(artefacto)).toThrow();
  });

  it("(d) verificarCeguera sobre un artefacto con casos: [] ⇒ LANZA (cero vacuo)", () => {
    // Relleno benigno (>=20 objetos, >=100 claves, ninguna en la denylist) para que el ÚNICO
    // motivo de fallo posible sea el chequeo explícito de cero vacuo — no el piso de conteo,
    // que de otro modo también fallaría sobre un artefacto pequeño y ocultaría si la mutación
    // "quitar el throw de casos:[]" realmente muerde o no.
    const relleno = Array.from({ length: 25 }, (_, i) => ({
      campo_benigno_a: `valor${i}`,
      campo_benigno_b: `valor${i}`,
      campo_benigno_c: `valor${i}`,
      campo_benigno_d: `valor${i}`,
      campo_benigno_e: `valor${i}`,
    }));
    const artefacto = { ...artefactoBase(), casos: [], metadatosDeRelleno: relleno };
    expect(() => verificarCeguera(artefacto)).toThrow();
  });

  it("(f) el artefacto REAL congelado pasa el guard, tiene 20 ítems y ningún título vacío", () => {
    const artefacto = JSON.parse(readFileSync(join(AQUI, "calibracion-20.json"), "utf8"));
    expect(ArtefactoCiegoSchema.safeParse(artefacto).success).toBe(true);
    expect(artefacto.casos).toHaveLength(20);
    for (const c of artefacto.casos) {
      expect(ItemCiegoSchema.safeParse(c).success).toBe(true);
      expect(c.titulo.length).toBeGreaterThan(0);
    }
    const r = verificarCeguera(artefacto);
    expect(r.objetosEscaneados).toBeGreaterThanOrEqual(20);
    expect(r.clavesEscaneadas).toBeGreaterThanOrEqual(100);
  });

  it("(g) control de no-sobre-amplitud: CLAVES_DE_MAQUINA no contiene 'etiqueta' a secas, y el artefacto real (cuya glosa SÍ usa esa clave) pasa el guard", () => {
    expect(CLAVES_DE_MAQUINA.includes("etiqueta")).toBe(false);
    const artefacto = JSON.parse(readFileSync(join(AQUI, "calibracion-20.json"), "utf8"));
    expect(() => verificarCeguera(artefacto)).not.toThrow();
  });
});
