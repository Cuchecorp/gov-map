import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import {
  LobbyMencionesView,
  LEYENDA_MENCIONES_LOBBY,
  EMPTY_MENCIONES_LOBBY,
  COBERTURA_MENCIONES_LOBBY,
  type LobbyMencionRow,
} from "./lobby-menciones-de-boletin";

afterEach(cleanup);

// ── Fixtures ───────────────────────────────────────────────────────────────────
function makeMencion(overrides: Partial<LobbyMencionRow> = {}): LobbyMencionRow {
  return {
    identificador: "AQ001AW1442944",
    fecha: "2026-05-14T13:00:00Z",
    materia: "Discutir el boletín 14309-04 sobre reforma al sistema de salud.",
    parlamentario_id: "P00001",
    parlamentario_nombre: "juana rosa pérez",
    contraparte_nombre: "Inmobiliaria Andes SpA",
    contraparte_rol: "gestor de intereses",
    representado: "Andes Holding",
    enlace_detalle:
      "https://www.leylobby.gob.cl/instituciones/AQ001/audiencias/2026/AW1442944",
    origen: "leylobby.gob.cl",
    fecha_captura: "2026-06-18T00:00:00Z",
    enlace: null,
    total_n: 1,
    ...overrides,
  };
}

describe("LobbyMencionesView — sección de menciones explícitas", () => {
  it("muestra heading LOCKED + leyenda anti-causal LOCKED", () => {
    render(<LobbyMencionesView rows={[makeMencion()]} />);
    expect(
      screen.getByRole("heading", {
        name: "Audiencias de lobby que mencionan este boletín",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(LEYENDA_MENCIONES_LOBBY)).toBeInTheDocument();
  });

  it("enlaza el parlamentario a /parlamentario/{id} (navegación bidireccional LOB-03)", () => {
    render(<LobbyMencionesView rows={[makeMencion()]} />);
    const link = screen.getByRole("link", { name: /juana/i });
    expect(link).toHaveAttribute("href", "/parlamentario/P00001");
    // acento petróleo (color de enlace navegable) — no color semántico de alerta.
    expect(link.className).toContain("text-accent-product");
  });

  it("renderiza la materia COMPLETA en bloque whitespace-pre-line (sin clamp)", () => {
    const materia = "Línea 1 del asunto.\nLínea 2 con más detalle verbatim.";
    render(<LobbyMencionesView rows={[makeMencion({ materia })]} />);
    const asunto = screen.getByText(/Línea 2 con más detalle/);
    // el contenedor de la materia es whitespace-pre-line leading-relaxed, jamás clamp.
    const bloque = asunto.closest("div")!;
    expect(bloque.className).toContain("whitespace-pre-line");
    expect(bloque.className).toContain("leading-relaxed");
    expect(bloque.className).not.toContain("line-clamp");
    expect(bloque.className).not.toContain("truncate");
    expect(bloque.className).not.toContain("max-h");
  });

  it("muestra la contraparte como texto plano SIN enlace (nunca RUT, nunca link)", () => {
    render(<LobbyMencionesView rows={[makeMencion()]} />);
    const contraparte = screen.getByText(/Inmobiliaria Andes SpA/);
    // No es un <a> ni un <Link> (texto crudo verbatim).
    expect(contraparte.closest("a")).toBeNull();
    expect(screen.getByText(/gestor de intereses/)).toBeInTheDocument();
  });

  it("conteo honesto singular", () => {
    render(<LobbyMencionesView rows={[makeMencion({ total_n: 1 })]} />);
    expect(
      screen.getByText(/audiencia registrada menciona/),
    ).toBeInTheDocument();
  });

  it("conteo honesto plural", () => {
    const rows = [
      makeMencion({ identificador: "A1", total_n: 2 }),
      makeMencion({ identificador: "A2", total_n: 2 }),
    ];
    render(<LobbyMencionesView rows={rows} />);
    expect(
      screen.getByText(/audiencias registradas mencionan/),
    ).toBeInTheDocument();
  });

  it("conteo truncado usa la variante total_n cuando las filas < total", () => {
    // 2 filas mostradas pero total_n=50 (LIMIT bounded alcanzado).
    const rows = [
      makeMencion({ identificador: "A1", total_n: 50 }),
      makeMencion({ identificador: "A2", total_n: 50 }),
    ];
    render(<LobbyMencionesView rows={rows} />);
    expect(
      screen.getByText(/Se muestran las/),
    ).toBeInTheDocument();
    expect(screen.getByText(/audiencias más/)).toBeInTheDocument();
  });

  it("empty honesto verbatim (0 menciones) — NUNCA 'sin lobby'; mantiene heading + leyenda", () => {
    render(<LobbyMencionesView rows={[]} />);
    expect(
      screen.getByRole("heading", {
        name: "Audiencias de lobby que mencionan este boletín",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(LEYENDA_MENCIONES_LOBBY)).toBeInTheDocument();
    expect(screen.getByText(EMPTY_MENCIONES_LOBBY)).toBeInTheDocument();
  });

  it("provenance: 'Ver fuente oficial ↗' presente cuando hay enlace_detalle", () => {
    render(<LobbyMencionesView rows={[makeMencion()]} />);
    expect(
      screen.getByRole("link", { name: /Ver fuente oficial/ }),
    ).toHaveAttribute("target", "_blank");
  });

  it("provenance: 'Ver fuente oficial ↗' omitido cuando enlace_detalle es null (nunca fabricado)", () => {
    render(<LobbyMencionesView rows={[makeMencion({ enlace_detalle: null })]} />);
    expect(
      screen.queryByRole("link", { name: /Ver fuente oficial/ }),
    ).toBeNull();
  });

  it("la leyenda LOCKED contiene 'influencia' y 'relación causal' en contexto que las NIEGA", () => {
    // Guard de single-source: si el copy cambia y deja de negar, el linter fallará.
    expect(LEYENDA_MENCIONES_LOBBY).toMatch(/no implica influencia/);
    expect(LEYENDA_MENCIONES_LOBBY).toMatch(/ni relación causal/);
    expect(EMPTY_MENCIONES_LOBBY).toMatch(/no describe la actividad de lobby/);
  });
});

// ── F-07 (117-03): rótulo del hecho en las menciones de lobby ───────────────────
describe("LobbyMencionesView — F-07: rótulo de la fecha de la reunión", () => {
  it("rotula 'Reunión del' con el día de la audiencia", () => {
    const { container } = render(
      <LobbyMencionesView rows={[makeMencion({ fecha: "2026-05-14T13:00:00Z" })]} />,
    );
    expect(container.textContent ?? "").toContain("Reunión del 14 may 2026");
  });

  // Esta superficie NO monta ProvenanceBadge (a diferencia de las otras tres del
  // carril): no hay una segunda fecha EN LA FILA, así que el assert de coexistencia
  // no aplica. Se ancla el hecho para que un badge futuro no entre sin rótulo.
  //
  // 122-05 (fila 5.12): el assert se acota al `<li>` de la fila. Antes miraba todo el
  // contenedor, pero la línea de cobertura declarada de 5.12 introduce
  // deliberadamente el idiom "según fuente al …" a nivel de SECCIÓN (es la fecha de
  // observación de la cifra de cobertura, no la procedencia de una audiencia). El
  // hecho que este test protege —la FILA no lleva fecha de badge— se conserva intacto;
  // lo que cambió es el alcance, no la regla.
  it("no hay idiom de captura EN LA FILA porque esta superficie no lleva badge", () => {
    const { container } = render(
      <LobbyMencionesView rows={[makeMencion({ fecha: "2026-05-14T13:00:00Z" })]} />,
    );
    const fila = container.querySelector("li");
    expect(fila).not.toBeNull();
    expect(fila?.textContent ?? "").not.toContain("según fuente al");
    // "captura" pelada sigue PROHIBIDA en toda la superficie (TERMINOS_PROHIBIDOS).
    expect(container.textContent ?? "").not.toMatch(/captura/i);
  });
});

/**
 * 122-05, fila 5.12 de `122-CRUCES-SQL-03-LOBBY.md` — cobertura parcial DECLARADA.
 *
 * Hallazgo: la superficie declaraba el CRITERIO (leyenda `:87` y empty `:95`, ambos
 * honestos) pero NUNCA cuantificaba la parcialidad. Un lector de `/proyecto/14309-04`
 * veía "1 audiencia registrada menciona este boletín" sin enterarse de que sólo el
 * 3,8 % de las audiencias confirmadas entra siquiera en este canal.
 *
 * Cifra recalculada contra PROD con la query verbatim de 92-04 (`Q-L07`) el
 * 2026-07-29: 195 de 5.106 = 3,82 % sobre 82 boletines distintos — idéntica a 92-04.
 *
 * Decisión adjudicada por 122-05: la cifra se HORNEA con su fecha explícita (derivarla
 * exigiría una RPC pública nueva = aguja completa: secdef PII-safe, `search_path`,
 * bounded, doble-revoke, `PUBLIC_RPC_ALLOWLIST` — coste desproporcionado para una
 * línea de copy). Se re-verifica con `Q-L07` en cada milestone.
 */
describe("LobbyMencionesView — 5.12: cobertura parcial declarada", () => {
  it("declara la cobertura en el camino CON filas, ANTES del conteo", () => {
    const { container } = render(
      <LobbyMencionesView rows={[makeMencion()]} />,
    );
    const texto = container.textContent ?? "";
    expect(texto).toContain(COBERTURA_MENCIONES_LOBBY);
    // La parcialidad se lee ANTES que el número, y DESPUÉS de la leyenda anti-causal.
    expect(texto.indexOf(LEYENDA_MENCIONES_LOBBY)).toBeLessThan(
      texto.indexOf(COBERTURA_MENCIONES_LOBBY),
    );
    expect(texto.indexOf(COBERTURA_MENCIONES_LOBBY)).toBeLessThan(
      texto.indexOf("audiencia registrada menciona"),
    );
  });

  it("declara la cobertura en el camino EMPTY (donde más se puede leer un 0 como 'no hubo lobby')", () => {
    const { container } = render(<LobbyMencionesView rows={[]} />);
    expect(container.textContent ?? "").toContain(COBERTURA_MENCIONES_LOBBY);
  });

  it("declara la cobertura en el camino TRUNCADO", () => {
    const { container } = render(
      <LobbyMencionesView rows={[makeMencion({ total_n: 80 })]} />,
    );
    const texto = container.textContent ?? "";
    expect(texto).toContain(COBERTURA_MENCIONES_LOBBY);
    expect(texto).toContain("Se muestran");
  });

  it("la cifra viaja SIEMPRE con su fecha y con el idiom aprobado, nunca con 'captura' pelada", () => {
    expect(COBERTURA_MENCIONES_LOBBY).toContain("según fuente al");
    expect(COBERTURA_MENCIONES_LOBBY).toMatch(/29 jul 2026/);
    expect(COBERTURA_MENCIONES_LOBBY).not.toMatch(/captura/i);
    // Ambos números presentes: el parcial NUNCA se presenta como total.
    expect(COBERTURA_MENCIONES_LOBBY).toContain("195");
    expect(COBERTURA_MENCIONES_LOBBY).toContain("5.106");
    expect(COBERTURA_MENCIONES_LOBBY).toContain("3,8 %");
  });

  /**
   * W-02 del code-review de 122 — el denominador del copy era MÁS ANCHO que el medido.
   *
   * `Q-L07` filtra `estado_vinculo='confirmado' AND parlamentario_id IS NOT NULL AND
   * materia IS NOT NULL`: el universo contado son las audiencias confirmadas con
   * parlamentario **y materia**. El copy decía sólo "con parlamentario identificado",
   * publicando el 3,8 % contra un universo que NO es el que se contó. Si existieran
   * audiencias confirmadas sin materia, el porcentaje sería falso por construcción.
   *
   * El assert es ESTRUCTURAL, no sobre la redacción: la cláusula que califica al
   * denominador (todo lo anterior al paréntesis del porcentaje) debe nombrar AMBAS
   * restricciones de `Q-L07`. Así el copy puede reescribirse sin romper el test, pero
   * no puede volver a ensancharse en silencio.
   */
  it("el denominador nombra el universo EXACTO medido por Q-L07 (parlamentario Y materia)", () => {
    // La cláusula del denominador es todo lo anterior al verbo del numerador
    // ("… audiencias <calificadores> CITAN el número de un boletín …"). Se exige que
    // el split ocurra para que el test no pueda pasar en vacío leyendo la frase entera
    // (donde "materia" aparece, pero como parte del NUMERADOR).
    const partes = COBERTURA_MENCIONES_LOBBY.split(/\bcitan\b/i);
    expect(
      partes,
      "El copy ya no tiene el verbo del numerador: re-ancla este test antes de tocarlo.",
    ).toHaveLength(2);
    const denominador = partes[0];
    expect(denominador).toMatch(/parlamentario/i);
    expect(denominador).toMatch(/materia/i);
  });

  it("CERO causalidad/intención en la línea de cobertura (negative-match §9.1)", () => {
    expect(COBERTURA_MENCIONES_LOBBY).not.toMatch(
      /influencia|a cambio de|oculta|esconde|punta del iceberg|subregistro|cifra negra|en realidad son/i,
    );
  });
});
