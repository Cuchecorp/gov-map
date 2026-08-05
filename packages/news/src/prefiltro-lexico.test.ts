import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  VOCABULARIO_LEGISLATIVO,
  esLegislativo,
  despojarHtml,
  fold,
  terminosQueMatchean,
} from "./prefiltro-lexico";
import { parseRss } from "./parse-rss";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__");
const leer = (f: string) => readFileSync(join(FIXTURES, f), "utf8");

describe("prefiltro-lexico — vocabulario congelado", () => {
  it("VOCABULARIO_LEGISLATIVO está congelado", () => {
    expect(Object.isFrozen(VOCABULARIO_LEGISLATIVO)).toBe(true);
  });

  it("VOCABULARIO_LEGISLATIVO.length congelado como literal (regresión)", () => {
    expect(VOCABULARIO_LEGISLATIVO.length).toBe(30);
  });
});

describe("prefiltro-lexico — casos positivos reales (titulares de los fixtures)", () => {
  // Titulares reales tomados de los fixtures capturados en 132-01 (los literales del
  // plan no coinciden exactamente con la corrida real del feed — los reemplazamos por
  // los titulares legislativos reales presentes en los fixtures, mismo espíritu).
  it("Congreso despacha la Megarreforma del Gobierno: cómo votaron en el Senado y qué queda pendiente (lacuarta)", () => {
    expect(
      esLegislativo(
        "Congreso despacha la Megarreforma del Gobierno: cómo votaron en el Senado y qué queda pendiente",
      ),
    ).toBe(true);
  });

  it("Ejecutivo repondrá indicaciones rechazadas a Sala Cuna Universal mientras se discute su financiamiento (biobiochile)", () => {
    expect(
      esLegislativo(
        "Ejecutivo repondrá indicaciones rechazadas a Sala Cuna Universal mientras se discute su financiamiento",
      ),
    ).toBe(true);
  });

  it("Caso Rodríguez, título+descripción reales de exante (matchea por senador/urgencia en la descripción)", () => {
    expect(
      esLegislativo(
        "Caso Rodríguez: El inevitable encontrón de alto calibre que protagonizaron Squella y Alvarado (y por qué está lejos de terminar)",
        "El gobierno busca con urgencia un reemplazante del ex subsecretario Rodríguez, tarea a cargo del ministro Quiroz. El senador Squella no retrocedió en sus dichos.",
      ),
    ).toBe(true);
  });
});

describe("prefiltro-lexico — diacríticos y variantes", () => {
  it.each([
    "Comisión de Hacienda",
    "comision de hacienda",
    "COMISIÓN DE HACIENDA",
    "boletín 12.345",
    "boletin 12345",
  ])("%s pasa", (titulo) => {
    expect(esLegislativo(titulo)).toBe(true);
  });
});

describe("prefiltro-lexico — frontera de palabra (anti-subcadena, premortem F-4)", () => {
  // Negativos: un texto.includes(t) los daría por positivos (subcadena de un término
  // corto del vocabulario); con frontera de palabra deben DESCARTAR.
  it('"Receta de ensalada de verano" descarta (contiene "sala" por subcadena)', () => {
    expect(esLegislativo("Receta de ensalada de verano")).toBe(false);
  });
  it('"Reajuste salarial en el retail" descarta (contiene "sala" por subcadena)', () => {
    expect(esLegislativo("Reajuste salarial en el retail")).toBe(false);
  });
  it('"Nueva leyenda del fútbol chileno" descarta (contiene "ley" por subcadena)', () => {
    expect(esLegislativo("Nueva leyenda del fútbol chileno")).toBe(false);
  });
  it('"Bradley Cooper estrena película" descarta (contiene "ley" por subcadena)', () => {
    expect(esLegislativo("Bradley Cooper estrena película")).toBe(false);
  });
  it('"Grupo de veteranos conmemora" descarta (contiene "veto" por subcadena)', () => {
    expect(esLegislativo("Grupo de veteranos conmemora")).toBe(false);
  });
  it('"Comisario detenido" descarta (contiene "comis", no "comision")', () => {
    expect(esLegislativo("Comisario detenido")).toBe(false);
  });

  // Positivos de frontera: la palabra completa SÍ debe pasar.
  it('"La sala del Senado aprobó" pasa (palabra completa "sala")', () => {
    expect(esLegislativo("La sala del Senado aprobó")).toBe(true);
  });
  it('"la ley de presupuestos" pasa (palabra completa "ley")', () => {
    expect(esLegislativo("la ley de presupuestos")).toBe(true);
  });
  it('"veto presidencial" pasa (palabra completa "veto")', () => {
    expect(esLegislativo("veto presidencial")).toBe(true);
  });
  it('"Comisión mixta" pasa (palabra completa "comision")', () => {
    expect(esLegislativo("Comisión mixta")).toBe(true);
  });
});

describe("prefiltro-lexico — recall-first (D-06)", () => {
  it('un titular que solo menciona "ministro" (no en vocabulario) descarta si nada más matchea', () => {
    expect(esLegislativo("El ministro visitó la feria de emprendedores")).toBe(false);
  });
  it("un titular sin ninguna palabra del vocabulario descarta", () => {
    expect(esLegislativo("El clima estará soleado este fin de semana")).toBe(false);
  });
});

describe("prefiltro-lexico — HTML despojado (Pitfall 7, T-132-11)", () => {
  it("una description con <script>var senado=1</script> y sin término visible DESCARTA", () => {
    const descripcion = "<p>Reportaje sobre el clima de hoy.</p><script>var senado=1;</script>";
    expect(esLegislativo("El clima de hoy", descripcion)).toBe(false);
  });

  it("despojarHtml elimina el <script> con su contenido", () => {
    const html = "<p>hola</p><script>var senado=1;</script><p>mundo</p>";
    expect(despojarHtml(html)).toBe("hola mundo");
  });

  it("despojarHtml decodifica entidades básicas", () => {
    expect(despojarHtml("&quot;hola&quot; &amp; &lt;mundo&gt;")).toBe('"hola" & <mundo>');
  });
});

describe("prefiltro-lexico — fold y determinismo", () => {
  it("fold: NFD + strip diacríticos + lower", () => {
    expect(fold("COMISIÓN")).toBe("comision");
  });

  it("determinismo: la misma entrada devuelve el mismo resultado", () => {
    const t = "Comisión de Hacienda vota indicaciones";
    expect(esLegislativo(t)).toBe(esLegislativo(t));
  });
});

describe("prefiltro-lexico — tasa de paso sobre los 5 feeds reales (REPORTE, no assert de rango)", () => {
  const SLUGS = ["biobiochile", "cooperativa", "latercera", "lacuarta", "exante"];

  it("tasa agregada > 0% y < 100% (cero fuerte por ambos lados)", () => {
    let totalItems = 0;
    let totalPasan = 0;
    const porOutlet: Record<string, { pasan: number; total: number }> = {};

    for (const slug of SLUGS) {
      const xml = leer(`${slug}.xml`);
      const { items } = parseRss(xml, slug);
      let pasan = 0;
      for (const it of items) {
        if (esLegislativo(it.titulo, it.descripcion)) pasan++;
      }
      porOutlet[slug] = { pasan, total: items.length };
      totalItems += items.length;
      totalPasan += pasan;
    }

    // eslint-disable-next-line no-console
    console.log("=== Tasa de paso del pre-filtro léxico (132-04, reporte) ===");
    for (const [slug, { pasan, total }] of Object.entries(porOutlet)) {
      const pct = total > 0 ? ((pasan / total) * 100).toFixed(1) : "0.0";
      // eslint-disable-next-line no-console
      console.log(`${slug}: ${pasan}/${total} (${pct}%)`);
    }
    const pctAgregado = (totalPasan / totalItems) * 100;
    // eslint-disable-next-line no-console
    console.log(`AGREGADO: ${totalPasan}/${totalItems} (${pctAgregado.toFixed(1)}%)`);

    expect(pctAgregado).toBeGreaterThan(0);
    expect(pctAgregado).toBeLessThan(100);
  });
});

describe("prefiltro-lexico — muestra de términos que matchean (depuración de tasa)", () => {
  it("terminosQueMatchean devuelve los términos que dispararon el match", () => {
    expect(terminosQueMatchean("El Senado aprobó el proyecto de ley")).toEqual(
      expect.arrayContaining(["senado", "proyecto de ley", "ley"]),
    );
    expect(terminosQueMatchean("El clima estará soleado")).toEqual([]);
  });
});

describe("prefiltro-lexico — truncado en frontera de palabra (WR-13, D-06 recall-first)", () => {
  it("un término legislativo que cruza el límite de 600 chars igual matchea (relleno + término partido por el corte en seco)", () => {
    // Relleno no-legislativo hasta justo antes del char 600, luego el término
    // "proyecto de ley" arrancando ANTES de 600 y terminando DESPUÉS — el
    // slice(0, 600) a secas lo parte a mitad de palabra.
    const relleno = "palabra ".repeat(75); // 600 chars exactos de relleno inocuo
    const descripcion = relleno.slice(0, 590) + "el proyecto de ley fue votado hoy";
    expect(esLegislativo("Titular neutro", descripcion)).toBe(true);
  });

  it("control apareado: misma longitud, relleno NO legislativo después del límite ⇒ sigue descartando", () => {
    const relleno = "palabra ".repeat(75);
    const descripcion = relleno.slice(0, 590) + "un gato subio al techo ayer";
    expect(esLegislativo("Titular neutro", descripcion)).toBe(false);
  });

  it("VOCABULARIO_LEGISLATIVO no fue podado: sigue teniendo al menos 30 términos", () => {
    expect(VOCABULARIO_LEGISLATIVO.length).toBeGreaterThanOrEqual(30);
  });
});

// ── Mutaciones obligatorias (ejecutadas manualmente y revertidas — ver SUMMARY) ──
// (1) quitar el fold NFD ⇒ cae el caso "COMISIÓN DE HACIENDA"
// (2) quitar el despojo de <script> ⇒ cae el caso del script con "senado"
// (3) vaciar VOCABULARIO_LEGISLATIVO ⇒ caen los 3 casos positivos
// (4) reemplazar el matching por frontera por texto.includes(t) ⇒ caen 4/6 negativos de frontera
//     (ensalada/salarial/leyenda/Bradley); "veteranos" no contiene "veto" como subcadena literal
//     y "Comisario" no contiene "comision" como subcadena literal, así que esos 2 sobreviven a
//     esta mutación puntual — la prueba de que SON casos de frontera real la da la RegExp con
//     frontera explícita que sí los distingue de "comisión"/"veto" en los positivos de arriba.
