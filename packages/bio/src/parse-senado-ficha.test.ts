// parse-senado-ficha.test — fallback conservador: extrae partido SOLO de pares estructurados
// (dt/dd, th/td) y prefiere null antes que un best-guess del sibling (WR-05).

import { describe, it, expect } from "vitest";
import { parseSenadoFicha } from "./parse-senado-ficha";

describe("parseSenadoFicha — pares estructurados", () => {
  it("extrae el partido de <dt>Partido</dt><dd>X</dd>", () => {
    const html = `<dl><dt>Partido</dt><dd>Renovación Nacional</dd></dl>`;
    expect(parseSenadoFicha(html, "999").partido).toBe("Renovación Nacional");
  });

  it("extrae el partido de <th>Partido político</th><td>X</td>", () => {
    const html = `<table><tr><th>Partido político</th><td>Partido Socialista</td></tr></table>`;
    expect(parseSenadoFicha(html, "999").partido).toBe("Partido Socialista");
  });

  it("propaga el parlidSenado recibido", () => {
    const html = `<dl><dt>Partido</dt><dd>PPD</dd></dl>`;
    expect(parseSenadoFicha(html, "1234").parlidSenado).toBe("1234");
  });
});

describe("parseSenadoFicha — WR-05: no captura decoys ni siblings arbitrarios", () => {
  it("un <h2>Partido…</h2> suelto (decoy) NO fabrica partido → null", () => {
    // Antes: strong/b/span/label sueltos capturaban el sibling arbitrario. Ahora se ignoran.
    const html = `<h2>Partido de la agenda legislativa</h2><p>Texto no relacionado que sigue.</p>`;
    expect(parseSenadoFicha(html, "999").partido).toBeNull();
  });

  it("<strong>Partido:</strong> suelto (no dt/th) NO captura el sibling → null", () => {
    const html = `<div><strong>Partido:</strong> <span>Comisión de Hacienda</span></div>`;
    expect(parseSenadoFicha(html, "999").partido).toBeNull();
  });

  it("valor '(sin especificar)' se rechaza → null (no fabrica)", () => {
    const html = `<dl><dt>Partido</dt><dd>(sin especificar)</dd></dl>`;
    expect(parseSenadoFicha(html, "999").partido).toBeNull();
  });

  it("sin par estructural (dt sin dd) → null", () => {
    const html = `<dl><dt>Partido</dt></dl>`;
    expect(parseSenadoFicha(html, "999").partido).toBeNull();
  });
});
