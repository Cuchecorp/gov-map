/**
 * panel-item-proyecto.test.tsx — ítem nombrado reusable con guard en_corpus
 * (Phase 128, PANEL-05). Control apareado: el caso `enCorpus:false` verifica
 * CERO hrefs internos Y la presencia de un enlace externo (no basta con "no
 * hay nada" — ver gotcha v12.0 "control de ausencia exige control positivo
 * apareado").
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { PanelItemProyecto } from "./panel-item-proyecto";

afterEach(cleanup);

describe("PanelItemProyecto", () => {
  it("enCorpus:true + boletín → <a href=/proyecto/{b}#estado> con boletín y título", () => {
    const { container } = render(
      <PanelItemProyecto
        boletin="16569-25"
        titulo="Proyecto de prueba"
        enCorpus={true}
      />,
    );
    const a = container.querySelector('a[href="/proyecto/16569-25#estado"]');
    expect(a).not.toBeNull();
    expect(a?.textContent).toContain("16569-25");
    expect(a?.textContent).toContain("Proyecto de prueba");
  });

  it("ancla:'timeline' → el href termina en #timeline", () => {
    const { container } = render(
      <PanelItemProyecto
        boletin="16569-25"
        titulo="Proyecto de prueba"
        enCorpus={true}
        ancla="timeline"
      />,
    );
    const a = container.querySelector('a[href$="#timeline"]');
    expect(a).not.toBeNull();
  });

  it("enCorpus:false → CERO href interno; SÍ existe enlace externo (control apareado)", () => {
    const { container } = render(
      <PanelItemProyecto
        boletin="16569-25"
        titulo="Proyecto de prueba"
        enCorpus={false}
        enlaceFuente="https://www.camara.cl/pley/pley_detalle.aspx?prmID=1"
      />,
    );
    expect(container.querySelectorAll('a[href^="/proyecto"]').length).toBe(0);
    const externo = container.querySelector('a[href^="https://"]');
    expect(externo).not.toBeNull();
  });

  it("enCorpus:false con enlaceFuente → target=_blank y rel contiene noopener+noreferrer", () => {
    const { container } = render(
      <PanelItemProyecto
        boletin="16569-25"
        titulo="Proyecto de prueba"
        enCorpus={false}
        enlaceFuente="https://www.camara.cl/pley/pley_detalle.aspx?prmID=1"
      />,
    );
    const externo = container.querySelector('a[href^="https://"]');
    expect(externo?.getAttribute("target")).toBe("_blank");
    expect(externo?.getAttribute("rel")).toContain("noopener");
    expect(externo?.getAttribute("rel")).toContain("noreferrer");
  });

  it("enCorpus:false sin boletín → renderiza textoAlterno truncado (extractoIdea)", () => {
    const materiaLarga = "palabra ".repeat(80).trim(); // > 400 caracteres
    const { container } = render(
      <PanelItemProyecto
        boletin={null}
        titulo={null}
        enCorpus={false}
        textoAlterno={materiaLarga}
      />,
    );
    expect(container.textContent).not.toContain(materiaLarga);
    expect(container.textContent?.length ?? 0).toBeLessThan(materiaLarga.length);
  });

  it("titulo:null + boletín → renderiza el boletín solo, sin 'null'/'undefined'", () => {
    const { container } = render(
      <PanelItemProyecto boletin="16569-25" titulo={null} enCorpus={true} />,
    );
    expect(container.textContent).toContain("16569-25");
    expect(container.textContent).not.toContain("null");
    expect(container.textContent).not.toContain("undefined");
  });

  it("detalle se renderiza tal cual", () => {
    const { getByText } = render(
      <PanelItemProyecto
        boletin="16569-25"
        titulo="Proyecto de prueba"
        enCorpus={true}
        detalle={<span>Citado el 4 ago</span>}
      />,
    );
    expect(getByText("Citado el 4 ago")).toBeTruthy();
  });
});
