/**
 * enlace-humano-proyecto.test.ts — helper puro enlaceHumanoProyecto
 *
 * Regla rectora: el link "fuente oficial" de la ficha DEBE aterrizar en la ficha
 * HUMANA del Senado, nunca en el endpoint WS XML (wspublico/tramitacion.php). El
 * helper reruta SOLO ese endpoint por host+path; todo lo demás pasa verbatim.
 *
 * Detección por HOST (tramitacion.senado.cl) + PATH (/wspublico/), NUNCA por
 * substring suelto: un boletín en el query no debe gatillar el rewrite.
 */
import { describe, it, expect } from "vitest";

import { enlaceHumanoProyecto, buildSenadoUrl } from "./validacion-fuente";

describe("enlaceHumanoProyecto — reruta wspublico→ficha humana Senado", () => {
  it("wspublico + boletín con sufijo → buildSenadoUrl(boletin) (boletin_ini, host appsenado)", () => {
    const out = enlaceHumanoProyecto(
      "https://tramitacion.senado.cl/wspublico/tramitacion.php",
      "16456-35",
    );
    expect(out).toBe(buildSenadoUrl("16456-35"));
    expect(out).toContain("boletin_ini=16456-35");
    expect(out).toContain("appsenado");
    expect(out).not.toContain("/wspublico/");
  });

  it("wspublico con querystring y host en mayúsculas → mismo rewrite (host case-insensitive, robusto a query)", () => {
    const out = enlaceHumanoProyecto(
      "https://Tramitacion.Senado.CL/wspublico/tramitacion.php?prmBOLETIN=99999-99",
      "16456-35",
    );
    // El boletín del query (99999-99) NO debe gatillar nada: se usa el boletin arg.
    expect(out).toBe(buildSenadoUrl("16456-35"));
    expect(out).toContain("boletin_ini=16456-35");
    expect(out).not.toContain("99999-99");
  });

  it("enlace Senado NO-wspublico (ficha humana) → VERBATIM", () => {
    const enlace =
      "https://www.senado.cl/appsenado/index.php?mo=tramitacion&ac=getDetalle&boletin_ini=16456-35";
    expect(enlaceHumanoProyecto(enlace, "16456-35")).toBe(enlace);
  });

  it("enlace de Cámara → VERBATIM (host distinto, no se toca)", () => {
    const enlace =
      "https://www.camara.cl/legislacion/ProyectosDeLey/tramitacion.aspx?prmID=17024&prmBOLETIN=16456-35";
    expect(enlaceHumanoProyecto(enlace, "16456-35")).toBe(enlace);
  });

  it("host tramitacion.senado.cl pero path SIN /wspublico/ → VERBATIM (detección por path)", () => {
    const enlace =
      "https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=16456-35";
    expect(enlaceHumanoProyecto(enlace, "16456-35")).toBe(enlace);
  });

  it("string vacío → verbatim (string vacío; el guard del badge decide si linkea)", () => {
    expect(enlaceHumanoProyecto("", "16456-35")).toBe("");
    expect(enlaceHumanoProyecto("   ", "16456-35")).toBe("   ");
  });

  it("enlace malformado que no parsea como URL → VERBATIM (no lanza)", () => {
    const malformado = "no-es-una-url-::://???";
    expect(() => enlaceHumanoProyecto(malformado, "16456-35")).not.toThrow();
    expect(enlaceHumanoProyecto(malformado, "16456-35")).toBe(malformado);
  });

  it("un boletín tipo wspublico en el QUERY de otro host NO gatilla el rewrite", () => {
    const enlace = "https://example.com/x?ref=wspublico/tramitacion.php";
    expect(enlaceHumanoProyecto(enlace, "16456-35")).toBe(enlace);
  });
});
