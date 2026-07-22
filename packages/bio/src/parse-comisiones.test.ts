// parse-comisiones.test — catálogo + membresía fail-closed por DIPID, y degradación honesta.
// HTML de fixture recortado del real (spike 2026-07-22): comisiones_permanentes.aspx +
// integrantes.aspx?prmID=4884 (Constitución). El staff (Abogado Secretario) NO trae DIPID → se
// excluye por construcción; solo se emiten integrantes con DIPID (id_diputado_camara).

import { describe, it, expect } from "vitest";
import { parseComisionesCatalogo, parseIntegrantes } from "./parse-comisiones";

// Recorte fiel del catálogo real (dos filas por comisión: nombre + link "ver").
const CATALOGO_HTML = `
<table>
  <tr>
    <td><a href="integrantes.aspx?prmID=4884">Constitución, Legislación, Justicia y Reglamento</a></td>
    <td align="center"><a href="integrantes.aspx?prmID=4884" class="ver"><i class="fa fa-search"></i></a></td>
  </tr>
  <tr>
    <td><a href="integrantes.aspx?prmID=4889">Relaciones Exteriores</a></td>
    <td align="center"><a href="integrantes.aspx?prmID=4889" class="ver"><i class="fa fa-search"></i></a></td>
  </tr>
</table>`;

// Recorte fiel de integrantes.aspx?prmID=4884 (Presidente con DIPID + staff sin DIPID).
const INTEGRANTES_HTML = `
<div class="top-integrantes"><h4>Integrantes de la Comisión</h4>
  <article class="grid-12 integrante">
    <img src="/img.aspx?prmID=GRCL872"/>
    <p><a href="../../diputados/detalle/mociones.aspx?prmID=872">Sr. Jaime Mulet Martínez</a><br/>
    <strong>Presidente</strong></p>
  </article>
  <div class="grid-12 otros-integrantes no-responsive">
    <p><strong>Abogado Secretario</strong><br/> Patricio Alberto Velásquez Weisse</p>
  </div>
  <article class="grid-3 integrante">
    <p><a href="../../diputados/detalle/mociones.aspx?prmID=1188">Sr. Otro Diputado</a><br/>
    <strong>Integrante</strong></p>
  </article>
  <article class="grid-3 integrante">
    <p><a href="../../diputados/detalle/mociones.aspx?prmID=1202">Sra. Diputada Dos</a><br/>
    <strong>Integrante</strong></p>
  </article>
</div>`;

describe("parse-comisiones — catálogo", () => {
  it("extrae comisiones únicas por prmID (dedup del link 'ver')", () => {
    const cat = parseComisionesCatalogo(CATALOGO_HTML);
    expect(cat).toHaveLength(2);
    const constitucion = cat.find((c) => c.prmId === "4884")!;
    expect(constitucion.nombre).toContain("Constitución");
    expect(constitucion.camara).toBe("diputados");
    expect(constitucion.tipo).toBe("permanente");
  });
});

describe("parse-comisiones — integrantes fail-closed por DIPID", () => {
  it("solo emite integrantes con DIPID; el staff (sin DIPID) queda excluido por construcción", () => {
    const integrantes = parseIntegrantes(INTEGRANTES_HTML);
    const dipids = integrantes.map((i) => i.dipid).sort();
    expect(dipids).toEqual(["1188", "1202", "872"]);
    // El "Abogado Secretario" NO aparece (no trae DIPID) → membresía nunca inventada.
    expect(integrantes.every((i) => /^\d+$/.test(i.dipid))).toBe(true);
  });

  it("mapea el cargo (Presidente/Integrante) del <strong> del bloque", () => {
    const integrantes = parseIntegrantes(INTEGRANTES_HTML);
    const presi = integrantes.find((i) => i.dipid === "872")!;
    expect(presi.cargo).toBe("Presidente");
    const otro = integrantes.find((i) => i.dipid === "1188")!;
    expect(otro.cargo).toBe("Integrante");
  });
});

describe("parse-comisiones — degradación honesta (fuente sin integrantes)", () => {
  it("HTML sin bloques .integrante → cero membresía (catálogo se emite igual, membresía vacía)", () => {
    const integrantes = parseIntegrantes("<div><p>sin integrantes publicados</p></div>");
    expect(integrantes).toHaveLength(0); // NUNCA inventa membresía
    const cat = parseComisionesCatalogo(CATALOGO_HTML);
    expect(cat.length).toBeGreaterThan(0); // el catálogo sí existe
  });
});
