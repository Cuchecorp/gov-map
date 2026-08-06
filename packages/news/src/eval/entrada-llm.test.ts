import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { construirEntradaLlm, coberturaTerminos, type CasoParaCobertura } from "./entrada-llm";
import { despojarHtml, fold, truncarDescripcion, terminosQueMatchean } from "../prefiltro-lexico";
import { parseRss } from "../parse-rss";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "__fixtures__");
const leer = (f: string) => readFileSync(join(FIXTURES, f), "utf8");
const SLUGS = ["biobiochile", "cooperativa", "latercera", "lacuarta", "exante"];

describe("construirEntradaLlm — D-133-F2 / D-133-J1", () => {
  it("construirEntradaLlm conserva tildes y mayúsculas (no foldea)", () => {
    const entrada = construirEntradaLlm({
      titulo: "El Senado APROBÓ la Reforma Previsional",
      descripcion: "La Comisión de Hacienda votó a favor con modificaciones.",
    });
    expect(entrada.titulo).toBe("El Senado APROBÓ la Reforma Previsional");
    expect(entrada.descripcion).toBe(
      "La Comisión de Hacienda votó a favor con modificaciones.",
    );
  });

  it("construirEntradaLlm no trunca el título (solo la descripción compite con el pre-filtro)", () => {
    const tituloLargo = "Titular ".repeat(200).trim(); // muy por sobre el límite de descripción
    const entrada = construirEntradaLlm({ titulo: tituloLargo, descripcion: null });
    expect(entrada.titulo).toBe(tituloLargo);
    expect(entrada.descripcion).toBe("");
  });
});

describe("coberturaTerminos — anti-cero-vacuo (T-133-14)", () => {
  it("coberturaTerminos([]) LANZA, jamás devuelve 1.0", () => {
    expect(() => coberturaTerminos([])).toThrow();
  });
});

describe("coberturaTerminos — frontera de palabra, no substring (T-133-13)", () => {
  it('no cuenta un término que es substring de otra palabra, pero SÍ lo cuenta como palabra completa', () => {
    const comoSubcadena: CasoParaCobertura = {
      entrada_llm: {
        titulo: "Reportaje de decoración",
        descripcion: "El mueble quedó ubicado en la antesala del edificio.",
      },
      prefiltro: { terminos: ["sala"] },
    };
    const comoPalabraCompleta: CasoParaCobertura = {
      entrada_llm: {
        titulo: "La sala del Senado sesionó",
        descripcion: "Se aprobó el proyecto.",
      },
      prefiltro: { terminos: ["sala"] },
    };
    expect(coberturaTerminos([comoSubcadena])).toBe(0);
    expect(coberturaTerminos([comoPalabraCompleta])).toBe(1);
  });
});

describe("D-133-J1.4 — divergencia de cortes foldeado vs sin-foldear, medida sobre los 5 fixtures reales", () => {
  it("comparativo de índices de corte: >=5 fixtures, >0 ítems con descripción, y terminos_perdidos === 0", () => {
    let nFixtures = 0;
    let nItemsConDescripcion = 0;
    let nDivergentes = 0;
    let terminosPerdidosTotal = 0;
    const terminosPerdidosDetalle: string[] = [];
    let primerDivergente: {
      link: string;
      largoFoldeado: number;
      largoSinFoldear: number;
      corteFoldeado: string;
      corteSinFoldear: string;
    } | null = null;

    for (const slug of SLUGS) {
      nFixtures++;
      const xml = leer(`${slug}.xml`);
      const { items } = parseRss(xml, slug);
      for (const item of items) {
        if (!item.descripcion) continue;
        nItemsConDescripcion++;

        const despojado = despojarHtml(item.descripcion);
        const foldeadoDespojado = fold(despojado);

        // Corte A: truncarDescripcion aplicado al texto FOLDEADO (lo que decide el pre-filtro).
        const corteFoldeado = truncarDescripcion(foldeadoDespojado);
        // Corte B: truncarDescripcion aplicado al texto despojado SIN foldear (lo que hace
        // entrada_llm/construirEntradaLlm), refoldeado DESPUÉS para poder comparar con A
        // en el mismo espacio de comparación (foldeado).
        const corteSinFoldearRaw = truncarDescripcion(despojado);
        const corteSinFoldearRefoldeado = fold(corteSinFoldearRaw);

        const divergen = corteFoldeado !== corteSinFoldearRefoldeado;
        if (divergen) {
          nDivergentes++;
          if (!primerDivergente) {
            primerDivergente = {
              link: item.link,
              largoFoldeado: foldeadoDespojado.length,
              largoSinFoldear: despojado.length,
              corteFoldeado,
              corteSinFoldear: corteSinFoldearRefoldeado,
            };
          }

          // Paso 3: daño real — ¿algún término del vocabulario que matcheaba DENTRO del
          // corte foldeado queda FUERA del corte sin-foldear-refoldeado?
          const terminosEnTextoCompleto = terminosQueMatchean(item.titulo, item.descripcion);
          for (const termino of terminosEnTextoCompleto) {
            const dentroDeA = new RegExp(`(^|[^a-z0-9])${termino}([^a-z0-9]|$)`).test(
              corteFoldeado,
            );
            const dentroDeB = new RegExp(`(^|[^a-z0-9])${termino}([^a-z0-9]|$)`).test(
              corteSinFoldearRefoldeado,
            );
            if (dentroDeA && !dentroDeB) {
              terminosPerdidosTotal++;
              terminosPerdidosDetalle.push(`${slug}/${item.link}: "${termino}"`);
            }
          }
        }
      }
    }

    // Anti-cero-vacuo (obligatorio por acceptance_criteria).
    expect(nFixtures).toBeGreaterThanOrEqual(5);
    expect(nItemsConDescripcion).toBeGreaterThan(0);

    // Reporte — cifras citadas literalmente en el SUMMARY.
    // eslint-disable-next-line no-console
    console.log(
      `=== D-133-J1.4: fixtures=${nFixtures} items_con_descripcion=${nItemsConDescripcion} ` +
        `divergentes=${nDivergentes} terminos_perdidos=${terminosPerdidosTotal} ===`,
    );
    if (primerDivergente) {
      // eslint-disable-next-line no-console
      console.log(
        `=== Primer divergente: ${primerDivergente.link} | largoFoldeado=${primerDivergente.largoFoldeado} ` +
          `largoSinFoldear=${primerDivergente.largoSinFoldear} ` +
          `corteFoldeado.length=${primerDivergente.corteFoldeado.length} ` +
          `corteSinFoldear.length=${primerDivergente.corteSinFoldear.length} ===`,
      );
    }
    if (terminosPerdidosDetalle.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`=== Términos perdidos: ${terminosPerdidosDetalle.join(" | ")} ===`);
    }

    // La aserción que protege D-133-F2.2: ningún término del vocabulario que el pre-filtro
    // vio queda fuera del input real del clasificador por el cambio de espacio de folding.
    expect(terminosPerdidosTotal).toBe(0);
  });
});
