import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import {
  FinanciamientoView,
  type FinanciamientoViewData,
  type AporteRow,
} from "./financiamiento-de-parlamentario";
import { moneyPublicEnabled } from "@/lib/money-gate";

afterEach(cleanup);

// El heading exacto (LOCKED) vive en page.tsx; lo reproducimos aquí para los tests
// de presencia/ausencia (el Server Component no es trivial de montar en RTL).
const HEADING = "Aportes de campaña registrados en SERVEL";

// La frase EXACTA de la asociación al candidato (A1: por NOMBRE, nunca por RUT).
const ASOCIACION = "Asociado por nombre confirmado al candidato.";

// ── Fixtures ───────────────────────────────────────────────────────────────────
function makeAporte(overrides: Partial<AporteRow> = {}): AporteRow {
  return {
    fila_id: "Elección 2021#2021-08-01#0",
    eleccion: "Elección 2021",
    donante_nombre: "María Soto",
    tipo_persona: "natural",
    monto: "$ 500.000",
    fecha_aporte: "2021-08-01T00:00:00Z",
    tipo_aporte: "aporte con publicidad",
    origen: "servel",
    fecha_captura: "2026-06-18T00:00:00Z",
    fecha_corte: "2026-06-15T00:00:00Z",
    enlace: "https://www.servel.cl/aportes/2021/maria-soto",
    ...overrides,
  };
}

function makeViewData(
  overrides: Partial<FinanciamientoViewData> = {},
): FinanciamientoViewData {
  return {
    id: "P00001",
    estado: "enlazado",
    aportes: [makeAporte()],
    totalAportes: 1,
    page: 1,
    totalPages: 1,
    fechaCorte: "2026-06-15T00:00:00Z",
    eleccionActual: null,
    ...overrides,
  };
}

// Reproduce el wrapper de page.tsx: la <section id="financiamiento"> (heading
// incluido) SOLO se renderiza si moneyPublicEnabled(env) === true. Con OFF el
// heading entero está AUSENTE (no solo el contenido).
function renderGated(env: Record<string, string | undefined>) {
  return render(
    <>
      {moneyPublicEnabled(env) && (
        <section id="financiamiento" className="mt-12">
          <h2 className="text-xl font-semibold mb-4">{HEADING}</h2>
          <FinanciamientoView data={makeViewData()} />
        </section>
      )}
    </>,
  );
}

// ── Gate de exposición (LOCKED): OFF → la sección entera ausente del HTML ────────
describe("FinanciamientoSection — gate de exposición (UI-SPEC §Exposure Gate)", () => {
  it("con moneyPublicEnabled() === false (DEFAULT) el HEADING está AUSENTE del HTML", () => {
    const { container } = renderGated({ MONEY_PUBLIC_ENABLED: undefined });
    // El heading no aparece — no solo el contenido, el nodo <section> entero ausente.
    expect(screen.queryByText(HEADING)).toBeNull();
    expect(container.querySelector("#financiamiento")).toBeNull();
  });

  it("con MONEY_PUBLIC_ENABLED='false' literal el heading sigue AUSENTE (fail-closed)", () => {
    renderGated({ MONEY_PUBLIC_ENABLED: "false" });
    expect(screen.queryByText(HEADING)).toBeNull();
  });

  it("con MONEY_PUBLIC_ENABLED='true' literal el heading EXACTO aparece", () => {
    const { container } = renderGated({ MONEY_PUBLIC_ENABLED: "true" });
    expect(screen.getByText(HEADING)).toBeInTheDocument();
    expect(container.querySelector("#financiamiento")).not.toBeNull();
  });
});

// ── Redacción (LOCKED): asociado por NOMBRE confirmado, NUNCA "por RUT" ──────────
describe("FinanciamientoView — honestidad del enlace (A1: por nombre, no por RUT)", () => {
  it("el intro enmarca los aportes como asociados al candidato por su NOMBRE, no por RUT", () => {
    const { container } = render(<FinanciamientoView data={makeViewData()} />);
    expect(
      screen.getByText(/asociados a este candidato por su nombre/i),
    ).toBeInTheDocument();
    const texto = container.textContent ?? "";
    // NUNCA afirma "por RUT" en ninguna copy (intro/asociación/corte).
    expect(texto).not.toMatch(/por RUT/i);
    // Sin posesivos prohibidos sobre el aporte.
    expect(texto).not.toMatch(/sus aportes|aporte del (diputado|senador|parlamentario)/i);
  });

  it("la línea de asociación es EXACTA 'Asociado por nombre confirmado al candidato.' y NO contiene 'por RUT'", () => {
    const { container } = render(<FinanciamientoView data={makeViewData()} />);
    // La frase exacta está presente.
    expect(screen.getByText(ASOCIACION)).toBeInTheDocument();
    // "por RUT" está AUSENTE de toda la copy de asociación del candidato.
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/por RUT/i);
  });

  it("la atribución es SERVEL 'términos de uso por verificar', NO CC BY 4.0", () => {
    const { container } = render(<FinanciamientoView data={makeViewData()} />);
    expect(screen.getByText(/términos de uso por verificar/i)).toBeInTheDocument();
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/CC BY 4\.0/i);
  });
});

// ── Tres estados honestos textualmente distintos (LOCKED) ───────────────────────
describe("FinanciamientoView — tres estados honestos textualmente distintos", () => {
  it("(a) No ingestado → copy distinto; NUNCA 'limpio'/'sin aportes ✓'", () => {
    const { container } = render(
      <FinanciamientoView
        data={makeViewData({
          estado: "no_ingestado",
          aportes: [],
          totalAportes: 0,
          fechaCorte: null,
        })}
      />,
    );
    expect(
      screen.getByText(/Aún no hemos ingerido los aportes de campaña de este candidato desde\s+SERVEL/i),
    ).toBeInTheDocument();
    // Los otros dos estados NO se muestran.
    expect(screen.queryByText(/no se registran\s+aportes asociados/i)).toBeNull();
    expect(screen.queryByText(/aporte registrado|aportes registrados/i)).toBeNull();
    // Un vacío NUNCA se lee como virtud/limpieza.
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/limpio|impecable|sin aportes ✓|no tiene aportes|✓/i);
  });

  it("(b) Verificado sin aportes → copy con fecha de corte, distinto de (a)", () => {
    render(
      <FinanciamientoView
        data={makeViewData({
          estado: "verificado_sin_aportes",
          aportes: [],
          totalAportes: 0,
          fechaCorte: "2026-06-15T00:00:00Z",
        })}
      />,
    );
    expect(
      screen.getByText(/no se registran\s+aportes asociados a ese candidato a esa fecha/i),
    ).toBeInTheDocument();
    // Distinto del estado (a).
    expect(screen.queryByText(/Aún no hemos ingerido los aportes/i)).toBeNull();
    // NO afirma "por RUT" (la fuente no tiene RUT).
    expect(screen.getByText(/Consultamos SERVEL por este candidato/i)).toBeInTheDocument();
  });

  it("(c) Enlazado → conteo neutro + filas; distinto de (a) y (b)", () => {
    render(<FinanciamientoView data={makeViewData()} />);
    expect(screen.getByText(/1 aporte registrado/i)).toBeInTheDocument();
    expect(screen.getByText(/Aporta: María Soto/)).toBeInTheDocument();
    expect(screen.queryByText(/Aún no hemos ingerido los aportes/i)).toBeNull();
    expect(screen.queryByText(/no se registran\s+aportes asociados/i)).toBeNull();
  });
});

// ── Donante como sujeto (LOCKED): sin posesivo, RUT del donante NUNCA renderizado ─
describe("FinanciamientoView — donante como sujeto (sin posesivo, sin RUT donante)", () => {
  it("muestra el donante como sujeto + '(persona natural)' + línea de asociación separada", () => {
    const { container } = render(
      <FinanciamientoView
        data={makeViewData({
          aportes: [makeAporte({ tipo_persona: "natural" })],
        })}
      />,
    );
    // Sujeto = el donante (verbatim).
    expect(screen.getByText(/Aporta: María Soto/)).toBeInTheDocument();
    // Etiqueta de tipo de persona.
    expect(screen.getByText(/\(persona natural\)/)).toBeInTheDocument();
    // La asociación al candidato es una línea SEPARADA, por NOMBRE, no un posesivo.
    expect(screen.getByText(ASOCIACION)).toBeInTheDocument();
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/sus aportes|aporte del (diputado|senador|parlamentario)/i);
  });

  it("una persona jurídica usa el mismo encuadre neutro de donante-sujeto", () => {
    render(
      <FinanciamientoView
        data={makeViewData({
          aportes: [
            makeAporte({ tipo_persona: "jurídica", donante_nombre: "Constructora Andes SpA" }),
          ],
        })}
      />,
    );
    expect(screen.getByText(/Aporta: Constructora Andes SpA/)).toBeInTheDocument();
    expect(screen.getByText(/\(persona jurídica\)/)).toBeInTheDocument();
    expect(screen.getByText(ASOCIACION)).toBeInTheDocument();
  });

  it("el RUT del donante NUNCA se renderiza (Ley 21.719), aun si se cuela en el fixture", () => {
    // AporteRow no tiene campo de RUT (la View no puede renderizarlo); este test
    // documenta el invariante: el render no contiene ningún patrón de RUT chileno.
    const { container } = render(
      <FinanciamientoView
        data={makeViewData({
          aportes: [makeAporte({ donante_nombre: "María Soto" })],
        })}
      />,
    );
    const texto = container.textContent ?? "";
    // Patrón de RUT chileno (12.345.678-9 / 12345678-K). Debe estar AUSENTE.
    expect(texto).not.toMatch(/\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/);
    expect(texto).not.toMatch(/RUT/i);
  });
});

// ── Tratamiento de periodo (LOCKED): agrupación por elección + caveat anterior ───
describe("FinanciamientoView — agrupación por elección + caveat de periodo anterior", () => {
  it("agrupa los aportes por elección con header de grupo mono", () => {
    render(
      <FinanciamientoView
        data={makeViewData({
          aportes: [
            makeAporte({ fila_id: "g1#a", eleccion: "Elección 2021" }),
            makeAporte({ fila_id: "g2#a", eleccion: "Elección 2017" }),
          ],
          totalAportes: 2,
        })}
      />,
    );
    expect(screen.getByText("Elección Elección 2021")).toBeInTheDocument();
    expect(screen.getByText("Elección Elección 2017")).toBeInTheDocument();
  });

  it("cada fila lleva su propio 'Elección:' (defense in depth)", () => {
    render(<FinanciamientoView data={makeViewData()} />);
    // El <dt> de la fila.
    expect(screen.getByText("Elección:")).toBeInTheDocument();
  });

  it("un grupo de candidatura anterior muestra el caveat amber; el actual NO", () => {
    const { container } = render(
      <FinanciamientoView
        data={makeViewData({
          aportes: [
            makeAporte({ fila_id: "g1#a", eleccion: "Elección 2021" }),
            makeAporte({ fila_id: "g2#a", eleccion: "Elección 2017" }),
          ],
          totalAportes: 2,
          // El mandato actual es 2021 → 2017 es candidatura anterior.
          eleccionActual: "Elección 2021",
        })}
      />,
    );
    // Caveat presente para el periodo anterior.
    const caveat = screen.getByText(
      /Aporte de una candidatura anterior \(Elección 2017\)\. No corresponde\s+al mandato actual\./i,
    );
    expect(caveat).toBeInTheDocument();
    // Amber = SOLO frescura/caveat, nunca severidad (sin rojo/verde).
    expect(caveat.className).toMatch(/amber/);
    // El periodo actual (2021) NO lleva caveat.
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/candidatura anterior \(Elección 2021\)/i);
  });

  it("sin eleccionActual derivable, NO se etiqueta ningún grupo como anterior (conservador)", () => {
    const { container } = render(
      <FinanciamientoView
        data={makeViewData({
          aportes: [
            makeAporte({ fila_id: "g1#a", eleccion: "Elección 2021" }),
            makeAporte({ fila_id: "g2#a", eleccion: "Elección 2017" }),
          ],
          totalAportes: 2,
          eleccionActual: null,
        })}
      />,
    );
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/candidatura anterior/i);
  });
});

// ── ProvenanceBadge por fila + cero cómputo/severidad ───────────────────────────
describe("FinanciamientoView — provenance por fila + cero cómputo", () => {
  it("cada aporte trae un ProvenanceBadge (SERVEL) con enlace a la fuente", () => {
    render(
      <FinanciamientoView
        data={makeViewData({
          aportes: [
            makeAporte({ fila_id: "A1" }),
            makeAporte({ fila_id: "A2" }),
          ],
          totalAportes: 2,
        })}
      />,
    );
    expect(screen.getAllByText(/fuente oficial ↗/i).length).toBe(2);
    expect(screen.getAllByText(/SERVEL/i).length).toBeGreaterThanOrEqual(2);
  });

  it("el monto se muestra literal verbatim; el UI no suma ni rankea", () => {
    const { container } = render(
      <FinanciamientoView
        data={makeViewData({
          aportes: [
            makeAporte({ fila_id: "A1", monto: "$ 100" }),
            makeAporte({ fila_id: "A2", monto: "$ 200" }),
          ],
          totalAportes: 2,
        })}
      />,
    );
    const texto = container.textContent ?? "";
    expect(texto).toContain("$ 100");
    expect(texto).toContain("$ 200");
    // Sin lenguaje de suma/total/ranking/veredicto.
    expect(texto).not.toMatch(/total aportado|suma|monto total|mayor aporte|ranking|%/i);
  });

  it("con monto null muestra 'No publicado' — nunca un cero ni un monto fabricado", () => {
    render(
      <FinanciamientoView
        data={makeViewData({
          aportes: [makeAporte({ fila_id: "A1", monto: null })],
        })}
      />,
    );
    const montoDt = screen.getByText("Monto:");
    const montoDd = montoDt.nextElementSibling;
    expect(montoDd?.textContent).toBe("No publicado");
    expect(montoDd?.textContent).not.toContain("0");
  });

  it("tolera columnas null del RPC sin crashear la fila (tipo_persona/donante/fecha)", () => {
    const { container } = render(
      <FinanciamientoView
        data={makeViewData({
          aportes: [
            makeAporte({
              fila_id: "A1",
              donante_nombre: null,
              tipo_persona: null,
              monto: null,
              fecha_aporte: null,
              tipo_aporte: null,
            }),
          ],
        })}
      />,
    );
    const texto = container.textContent ?? "";
    expect(texto).toContain("Donante no publicado");
    expect(texto).toContain("No publicado");
    expect(texto).toContain("Fecha no publicada");
    // tipo_persona null → encuadre neutro por defecto (persona natural), sin throw.
    expect(screen.getByText(/\(persona natural\)/)).toBeInTheDocument();
  });
});
