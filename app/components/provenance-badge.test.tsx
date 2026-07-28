import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { ProvenanceBadge } from "./provenance-badge";

afterEach(cleanup);

describe("ProvenanceBadge — frescura + fuente (TRAM-09, UI-SPEC §4)", () => {
  it("dato fresco (<48h) → sin override amber, con enlace a la fuente", () => {
    const capturedAt = new Date(Date.now() - 3 * 60 * 60 * 1000); // hace 3h
    render(
      <ProvenanceBadge
        capturedAt={capturedAt}
        sourceName="Cámara"
        sourceUrl="https://www.camara.cl/fuente"
      />
    );
    expect(screen.getByText(/Cámara/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Fuente oficial: Cámara/ });
    expect(link).toHaveAttribute("href", "https://www.camara.cl/fuente");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    // El span del badge NO debe llevar las clases amber de staleness.
    const badge = screen.getByText(/Actualizado/).closest("span");
    expect(badge?.className).not.toMatch(/amber/);
  });

  it("dato stale (>14d) → aplica override amber (text-amber-700 border-amber-400)", () => {
    const capturedAt = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000); // hace 15 días
    render(
      <ProvenanceBadge
        capturedAt={capturedAt}
        sourceName="Senado"
        sourceUrl="https://www.senado.cl/fuente"
      />
    );
    // El contenedor del badge es el padre directo del span "Senado".
    const outer = screen.getByText("Senado").parentElement;
    expect(outer?.className).toContain("text-amber-700");
    expect(outer?.className).toContain("border-amber-400");
  });

  it("sin procedencia (capturedAt null, sourceUrl null) → 'fuente desconocida', sin enlace, badge presente", () => {
    render(
      <ProvenanceBadge capturedAt={null} sourceName="Cámara" sourceUrl={null} />
    );
    // Nunca se oculta el badge (UI-SPEC §6.3).
    expect(screen.getByText("fuente desconocida")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("#9: un sourceUrl con esquema peligroso (javascript:) NO se enlaza (anti-XSS)", () => {
    const capturedAt = new Date(Date.now() - 3 * 60 * 60 * 1000);
    render(
      <ProvenanceBadge
        capturedAt={capturedAt}
        sourceName="Cámara"
        // eslint-disable-next-line no-script-url
        sourceUrl={"javascript:alert(1)"}
      />
    );
    // El dato sigue mostrándose, pero degradado a "sin enlace" (no inyecta script).
    expect(screen.getByText(/Cámara/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// LINK-EXT (115-03, A-3/A-4/A-5) — limitación DECLARADA cuando el destino oficial
// es un servicio de datos y no existe página humana derivable.
//
// Evidencia (115-VEREDICTO §4): `opendata.camara.cl/...getVotaciones_Boletin`
// responde 500 `Falta el parámetro: prmBoletin` y el destino humano de la Cámara
// exige `prm_id_camara`, dato que no acompaña a `tramitacion_evento` ni a
// `votacion` (A-3); `web-back.senado.cl/api/*` y los `/wspublico/*` sin parámetro
// de fila entregan JSON/XML a una máquina, sin identidad de la que derivar una URL
// humana (A-4); `datos.cplt.cl/sparql` recibe una consulta mal formada persistida
// por la INGESTA (A-5, deuda registrada en deferred-items.md).
//
// El copy declara el FORMATO en que la fuente publica el dato — jamás una
// intención de la fuente (el carril LINK-EXT del linter anti-insinuación caza
// "oculta"/"esconde"/"se niega a"/"censura").
// ---------------------------------------------------------------------------
import { LEYENDA_RECURSO_NO_HUMANO, esServicioDeDatos } from "./provenance-badge";

describe("ProvenanceBadge — limitación declarada de recurso no-humano (LINK-EXT)", () => {
  const fresco = () => new Date(Date.now() - 3 * 60 * 60 * 1000);

  it("la leyenda es factual: describe el formato, sin atribuir intención a la fuente", () => {
    expect(LEYENDA_RECURSO_NO_HUMANO).toBe(
      "La fuente oficial publica este dato como servicio de datos, no como página de consulta.",
    );
    expect(LEYENDA_RECURSO_NO_HUMANO).not.toMatch(
      /oculta|esconde|censura|no quiere|se niega/i,
    );
  });

  it.each([
    ["A-3 opendata.camara.cl", "https://opendata.camara.cl/wscamaradiputados.asmx/getVotaciones_Boletin"],
    ["A-4 web-back.senado.cl/api", "https://web-back.senado.cl/api/weekly_table?limit=100"],
    ["A-4 tramitacion.senado.cl/wspublico", "https://tramitacion.senado.cl/wspublico/senadores_vigentes.php"],
    ["A-5 datos.cplt.cl/sparql", "https://datos.cplt.cl/sparql?query=alessandri%20vergara"],
  ])("%s → el badge DECLARA la limitación (y conserva el enlace)", (_caso, url) => {
    render(
      <ProvenanceBadge capturedAt={fresco()} sourceName="Cámara" sourceUrl={url} />,
    );
    expect(screen.getByText(LEYENDA_RECURSO_NO_HUMANO)).toBeInTheDocument();
    // La limitación se declara SIN quitar el enlace: el ciudadano igual puede ir.
    expect(screen.getByRole("link")).toHaveAttribute("href", url);
  });

  it.each([
    ["ficha humana del Senado", "https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=14309-04"],
    ["ficha humana de la Cámara", "https://www.camara.cl/legislacion/ProyectosDeLey/tramitacion.aspx?prmID=11502&prmBOLETIN=10986-24"],
    ["audiencia de Ley Lobby", "https://www.leylobby.gob.cl/instituciones/AA001/audiencias/2024/663021"],
  ])("%s → NINGUNA leyenda (el destino SÍ es una página de consulta)", (_caso, url) => {
    render(
      <ProvenanceBadge capturedAt={fresco()} sourceName="Senado" sourceUrl={url} />,
    );
    expect(screen.queryByText(LEYENDA_RECURSO_NO_HUMANO)).not.toBeInTheDocument();
  });

  it("sin enlace → no se declara nada (no hay destino del que hablar)", () => {
    render(
      <ProvenanceBadge capturedAt={fresco()} sourceName="Senado" sourceUrl={null} />,
    );
    expect(screen.queryByText(LEYENDA_RECURSO_NO_HUMANO)).not.toBeInTheDocument();
  });

  it("`esServicioDeDatos` decide por host+path, jamás por substring suelto", () => {
    // El literal "wspublico" en el QUERY de otro host NO debe gatillar la leyenda.
    expect(
      esServicioDeDatos("https://www.senado.cl/buscar?q=wspublico"),
    ).toBe(false);
    // Host correcto pero path humano → false.
    expect(
      esServicioDeDatos(
        "https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=1-1",
      ),
    ).toBe(false);
    expect(esServicioDeDatos(null)).toBe(false);
    expect(esServicioDeDatos("no-es-una-url")).toBe(false);
  });
});
