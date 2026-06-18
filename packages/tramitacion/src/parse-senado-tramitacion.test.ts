import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseSenadoTramitacion } from "./parse-senado-tramitacion";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures");
const xml = readFileSync(join(FIXTURES, "senado-tramitacion.xml"), "utf8");

describe("parseSenadoTramitacion — Proyecto (descripcion)", () => {
  const { proyecto } = parseSenadoTramitacion(xml);

  it("deriva boletin completo + boletin_num base (Pitfall 1)", () => {
    expect(proyecto.boletin).toBe("18296-05");
    expect(proyecto.boletin_num).toBe("18296");
  });

  it("deriva titulo, iniciativa, camara_origen", () => {
    expect(proyecto.titulo).toContain("endeudamiento");
    expect(proyecto.iniciativa).toBe("Mensaje");
    expect(proyecto.camara_origen).toBe("C.Diputados");
  });

  it("estado/etapa/subetapa con trim (estado viene con espacio final)", () => {
    expect(proyecto.estado).toBe("En tramitación");
    expect(proyecto.etapa).toBe("Segundo trámite constitucional (Senado)");
    expect(proyecto.subetapa).toBe("Primer informe de comisión de Hacienda");
  });

  it("provenance inline presente", () => {
    expect(proyecto.origen).toBe("senado-wspublico");
    expect(proyecto.enlace).toContain("senado.cl");
  });
});

describe("parseSenadoTramitacion — link_mensaje_mocion (SEM-01, sidecar)", () => {
  it("extrae link_mensaje_mocion del <descripcion> cuando el XML lo trae", () => {
    const { linkMensajeMocion } = parseSenadoTramitacion(xml);
    expect(linkMensajeMocion).toContain("tipodoc=mensaje_mocion");
    expect(linkMensajeMocion).toContain("iddocto=18974");
  });

  it("link_mensaje_mocion es null cuando el <descripcion> no lo trae (degradación)", () => {
    const sinLink = `<?xml version="1.0"?><proyectos><proyecto><descripcion>` +
      `<boletin>99999-99</boletin><titulo>Sin link</titulo></descripcion></proyecto></proyectos>`;
    const { linkMensajeMocion } = parseSenadoTramitacion(sinLink);
    expect(linkMensajeMocion).toBeNull();
  });
});

describe("parseSenadoTramitacion — TramitacionEvento[]", () => {
  const { eventos } = parseSenadoTramitacion(xml);

  it("materializa tramites + urgencias + informes + oficios", () => {
    const tipos = new Set(eventos.map((e) => e.tipo));
    expect(tipos.has("tramite")).toBe(true);
    expect(tipos.has("urgencia")).toBe(true);
    expect(tipos.has("informe")).toBe(true);
    expect(tipos.has("oficio")).toBe(true);
  });

  it("eventos con fecha ISO parseada (dd/mm/yyyy → ISO)", () => {
    const tramite = eventos.find((e) => e.tipo === "tramite");
    expect(tramite?.fecha).toMatch(/^2026-06-03T/);
  });

  it("informes llevan LINK_INFORME como enlace", () => {
    const informe = eventos.find((e) => e.tipo === "informe");
    expect(informe?.enlace).toContain("tipodoc=info");
  });

  it("oficios llevan LINK_OFICIO como enlace", () => {
    const oficio = eventos.find((e) => e.tipo === "oficio");
    expect(oficio?.enlace).toContain("tipodoc=ofic");
  });

  it("cada evento referencia el boletín completo del proyecto", () => {
    for (const e of eventos) expect(e.boletin).toBe("18296-05");
  });
});
