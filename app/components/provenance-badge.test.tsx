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
    const badge = screen.getByText(/según fuente al/).closest("span");
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
// F-01 / F-02 / F-03 / F-11 (117-01, FECHA-02) — el IDIOM del chokepoint.
//
// El badge decía "Actualizado hace 3 h". Eso afirma que el DATO cambió hace 3 horas
// cuando lo único que pasó hace 3 horas fue NUESTRA consulta a la fuente: sobre un
// proyecto sin movimiento desde 2023, insinúa actividad legislativa inexistente. El
// idiom LOCKED de la fase separa los dos hechos: la fecha que se rotula es la de la
// FUENTE ("según fuente al …"), y cuando el reloj es un recálculo interno nuestro se
// dice así explícitamente ("recalculado por el Observatorio al …"). La señal de
// recencia no se pierde: baja al tooltip.
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import path from "node:path";

describe("ProvenanceBadge — idiom LOCKED de fecha (F-01/F-02/F-03)", () => {
  const CAPTURA = new Date("2026-05-14T10:00:00Z");

  it("F-01: dice 'según fuente al {fecha}' y JAMÁS 'Actualizado'", () => {
    const { container } = render(
      <ProvenanceBadge
        capturedAt={CAPTURA}
        sourceName="Cámara"
        sourceUrl="https://www.camara.cl/fuente"
      />,
    );
    expect(container.textContent).toContain("según fuente al 14 may 2026");
    expect(container.textContent).not.toMatch(/Actualizado/);
  });

  it("F-02: `origenFecha='recalculo'` dice 'recalculado por el Observatorio al {fecha}'", () => {
    // `cruce_senal.fecha_captura` es el `now()` del FULL REBUILD diario: no es una
    // observación de la fuente, así que decir "según fuente" sería tan impreciso
    // como decir "Actualizado".
    const { container } = render(
      <ProvenanceBadge
        capturedAt={CAPTURA}
        sourceName="Observatorio"
        sourceUrl={null}
        origenFecha="recalculo"
      />,
    );
    expect(container.textContent).toContain(
      "recalculado por el Observatorio al 14 may 2026",
    );
    expect(container.textContent).not.toMatch(/según fuente al/);
  });

  it("F-02: el defecto de `origenFecha` es 'fuente' (ningún call-site existente cambia)", () => {
    const { container } = render(
      <ProvenanceBadge
        capturedAt={CAPTURA}
        sourceName="Senado"
        sourceUrl={null}
        origenFecha="fuente"
      />,
    );
    expect(container.textContent).toContain("según fuente al 14 may 2026");
  });

  it("F-03: `notaAgregacion` califica la agregación entre paréntesis", () => {
    // Un badge de SECCIÓN declara la frescura de un MAX sobre N filas — hay que decir
    // de qué fila habla la fecha.
    const { container } = render(
      <ProvenanceBadge
        capturedAt={CAPTURA}
        sourceName="Cámara"
        sourceUrl={null}
        notaAgregacion="evento más reciente"
      />,
    );
    expect(container.textContent).toContain(
      "según fuente al 14 may 2026 (evento más reciente)",
    );
  });

  it("la rama sin fecha queda INTACTA: 'Sin fecha de actualización' + 'fuente desconocida'", () => {
    render(
      <ProvenanceBadge capturedAt={null} sourceName="Cámara" sourceUrl={null} />,
    );
    expect(screen.getByText("Sin fecha de actualización")).toBeInTheDocument();
    expect(screen.getByText("fuente desconocida")).toBeInTheDocument();
  });

  it("la recencia deja de ser el rótulo: 'hace X' NO es texto visible del badge", () => {
    const { container } = render(
      <ProvenanceBadge
        capturedAt={new Date(Date.now() - 3 * 60 * 60 * 1000)}
        sourceName="Cámara"
        sourceUrl={null}
      />,
    );
    expect(container.textContent).not.toMatch(/hace \d/);
  });

  it("esStale a 15 días sigue pintando amber (cero cambio de comportamiento)", () => {
    render(
      <ProvenanceBadge
        capturedAt={new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)}
        sourceName="Senado"
        sourceUrl="https://www.senado.cl/fuente"
      />,
    );
    const outer = screen.getByText("Senado").parentElement;
    expect(outer?.className).toContain("text-amber-700");
  });

  /**
   * El tooltip de Radix sólo monta su contenido al abrirse (hover/focus), y jsdom no
   * dispara ese ciclo de forma fiable — por eso la señal de recencia y el ISO se
   * verifican por SOURCE-SCAN del chokepoint, precedente del source-scan SC7 de 115.
   * Lo que se prueba: la recencia NO se perdió, sólo dejó de ser el rótulo principal.
   */
  it("la señal de recencia sobrevive en el tooltip (source-scan del chokepoint)", () => {
    const src = readFileSync(
      path.join(import.meta.dirname, "provenance-badge.tsx"),
      "utf-8",
    );
    expect(src).toContain("capturedAt.toISOString()");
    expect(src).toContain("consultado {relativeTimeEs(capturedAt)}");
  });

  it("F-11: el JSDoc del chokepoint ya no miente (ni copy viejo ni umbral de 48h)", () => {
    const src = readFileSync(
      path.join(import.meta.dirname, "provenance-badge.tsx"),
      "utf-8",
    );
    expect(src).not.toContain("Actualizado hace X");
    expect(src).not.toContain("más de 48h");
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

  // ── WR-04/WR-05: densidad de la superficie que monta el badge ─────────────────
  //
  // El badge se usa POR FILA en listas largas (votos, patrimonio, lobby, aportes,
  // contratos). Con la leyenda visible, la misma cadena de 90 caracteres se renderizaba
  // N veces —el defecto que motivó retirar el badge por evento en SC7— y el envoltorio
  // `inline-flex flex-col` cambiaba la CAJA del badge, desalineando filas que lo colocan
  // en celdas horizontales. `densidad="lista"` corrige ambos: cero repetición visible y
  // cero cambio de estructura del DOM.

  const URL_DATOS =
    "https://opendata.camara.cl/wscamaradiputados.asmx/getVotaciones_Boletin";

  it("WR-05 (bloque): con leyenda el badge se envuelve en `inline-flex flex-col`", () => {
    const { container } = render(
      <ProvenanceBadge capturedAt={fresco()} sourceName="Cámara" sourceUrl={URL_DATOS} />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.tagName).toBe("SPAN");
    expect(wrapper.className).toContain("inline-flex");
    expect(wrapper.className).toContain("flex-col");
    // La leyenda es el segundo hijo del envoltorio (bajo el badge).
    expect(wrapper.textContent).toContain(LEYENDA_RECURSO_NO_HUMANO);
  });

  it("WR-05 (lista): NO se envuelve — la caja del badge queda idéntica a la de un destino humano", () => {
    const humano =
      "https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=14309-04";
    const { container: conDatos } = render(
      <ProvenanceBadge
        capturedAt={fresco()}
        sourceName="Cámara"
        sourceUrl={URL_DATOS}
        densidad="lista"
      />,
    );
    const cajaDatos = (conDatos.firstElementChild as HTMLElement).className;
    cleanup();
    const { container: conHumano } = render(
      <ProvenanceBadge
        capturedAt={fresco()}
        sourceName="Senado"
        sourceUrl={humano}
        densidad="lista"
      />,
    );
    const cajaHumana = (conHumano.firstElementChild as HTMLElement).className;
    // MISMA caja: sin `flex-col`, sin envoltorio extra → las filas no se desalinean.
    expect(cajaDatos).toBe(cajaHumana);
    expect(cajaDatos).not.toContain("flex-col");
  });

  it("WR-04 (lista): la leyenda NO se repite como texto visible por fila", () => {
    render(
      <ul>
        {[1, 2, 3].map((i) => (
          <li key={i}>
            <ProvenanceBadge
              capturedAt={fresco()}
              sourceName="Cámara"
              sourceUrl={URL_DATOS}
              densidad="lista"
            />
          </li>
        ))}
      </ul>,
    );
    expect(screen.queryByText(LEYENDA_RECURSO_NO_HUMANO)).not.toBeInTheDocument();
  });

  it("WR-04 (lista): la limitación sigue siendo legible — viaja en el `title` del badge", () => {
    render(
      <ProvenanceBadge
        capturedAt={fresco()}
        sourceName="Cámara"
        sourceUrl={URL_DATOS}
        densidad="lista"
      />,
    );
    // El enlace NUNCA se quita: se declara la limitación, no se esconde el destino.
    expect(screen.getByRole("link")).toHaveAttribute("href", URL_DATOS);
    const badge = screen.getByText(/según fuente al/).closest("span[title]");
    expect(badge).toHaveAttribute("title", LEYENDA_RECURSO_NO_HUMANO);
  });

  it("un destino humano NO lleva `title` en ninguna densidad (nada que declarar)", () => {
    const humano =
      "https://www.leylobby.gob.cl/instituciones/AA001/audiencias/2024/663021";
    const { container } = render(
      <ProvenanceBadge
        capturedAt={fresco()}
        sourceName="Lobby"
        sourceUrl={humano}
        densidad="lista"
      />,
    );
    expect(container.querySelector("span[title]")).toBeNull();
  });

  it("el defecto de `densidad` es `bloque` (ningún call-site existente cambia de comportamiento)", () => {
    const { container } = render(
      <ProvenanceBadge capturedAt={fresco()} sourceName="Cámara" sourceUrl={URL_DATOS} />,
    );
    expect(container.textContent).toContain(LEYENDA_RECURSO_NO_HUMANO);
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
