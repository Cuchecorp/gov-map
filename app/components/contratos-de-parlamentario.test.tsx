import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import {
  ContratosView,
  type ContratosViewData,
  type ContratoRow,
} from "./contratos-de-parlamentario";
import { moneyPublicEnabled } from "@/lib/money-gate";

afterEach(cleanup);

// El heading exacto (LOCKED) vive en page.tsx; lo reproducimos aquí para los tests
// de presencia/ausencia (el Server Component no es trivial de montar en RTL).
const HEADING = "Contratos del Estado asociados al RUT";

// ── Fixtures ───────────────────────────────────────────────────────────────────
// Fixture FIEL al output real del parser (CR-02 / IN-02): `nombre_orden` lleva la descripción de
// la orden (texto libre); `monto` es null (la fuente NO trae un monto fijo) — antes el fixture
// inventaba `monto: "$ 124.500.000"` que el pipeline NUNCA produce, enmascarando el defecto.
function makeContrato(overrides: Partial<ContratoRow> = {}): ContratoRow {
  return {
    codigo_orden: "1509-512-SE26",
    proveedor_nombre: "Constructora Andes SpA",
    tipo_persona: "jurídica",
    organismo: "Ministerio de Obras Públicas",
    nombre_orden: "Construcción de obras viales",
    monto: null,
    fecha_oc: "2026-03-12T00:00:00Z",
    origen: "chilecompra",
    fecha_captura: "2026-06-18T00:00:00Z",
    fecha_corte: "2026-06-15T00:00:00Z",
    enlace: "https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idAcquisition=1509-512-SE26",
    ...overrides,
  };
}

function makeViewData(
  overrides: Partial<ContratosViewData> = {},
): ContratosViewData {
  return {
    id: "P00001",
    estado: "enlazado",
    contratos: [makeContrato()],
    totalContratos: 1,
    page: 1,
    totalPages: 1,
    fechaCorte: "2026-06-15T00:00:00Z",
    ...overrides,
  };
}

// Reproduce el wrapper de page.tsx: la <section id="dinero"> (heading incluido)
// SOLO se renderiza si moneyPublicEnabled(env) === true. Con OFF el heading entero
// está AUSENTE (no solo el contenido).
function renderGated(env: Record<string, string | undefined>) {
  return render(
    <>
      {moneyPublicEnabled(env) && (
        <section id="dinero" className="mt-12">
          <h2 className="text-xl font-semibold mb-4">{HEADING}</h2>
          <ContratosView data={makeViewData()} />
        </section>
      )}
    </>,
  );
}

// ── Gate de exposición (LOCKED): OFF → la sección entera ausente del HTML ────────
describe("ContratosSection — gate de exposición (UI-SPEC §Exposure Gate)", () => {
  it("con moneyPublicEnabled() === false (DEFAULT) el HEADING está AUSENTE del HTML", () => {
    const { container } = renderGated({ MONEY_PUBLIC_ENABLED: undefined });
    // El heading no aparece — no solo el contenido, el nodo <section> entero ausente.
    expect(screen.queryByText(HEADING)).toBeNull();
    expect(container.querySelector("#dinero")).toBeNull();
  });

  it("con MONEY_PUBLIC_ENABLED='false' literal el heading sigue AUSENTE (fail-closed)", () => {
    renderGated({ MONEY_PUBLIC_ENABLED: "false" });
    expect(screen.queryByText(HEADING)).toBeNull();
  });

  it("con MONEY_PUBLIC_ENABLED='true' literal el heading EXACTO aparece", () => {
    const { container } = renderGated({ MONEY_PUBLIC_ENABLED: "true" });
    expect(screen.getByText(HEADING)).toBeInTheDocument();
    expect(container.querySelector("#dinero")).not.toBeNull();
  });
});

// ── Redacción (LOCKED): "asociados al RUT", nunca un posesivo ────────────────────
describe("ContratosView — redacción asociada al RUT (contrato de honestidad)", () => {
  it("el intro enmarca los contratos como asociados al RUT, no del parlamentario", () => {
    const { container } = render(<ContratosView data={makeViewData()} />);
    expect(
      screen.getByText(/asociados al RUT de este parlamentario/i),
    ).toBeInTheDocument();
    const texto = container.textContent ?? "";
    expect(texto).toMatch(/no implica que el contrato sea del parlamentario/i);
    // Sin posesivos prohibidos sobre el contrato.
    expect(texto).not.toMatch(/su contrato|contrato del (diputado|senador|parlamentario)/i);
  });

  it("la atribución es ChileCompra 'mención de la fuente', NO CC BY 4.0", () => {
    const { container } = render(<ContratosView data={makeViewData()} />);
    expect(screen.getByText(/mención de la fuente/i)).toBeInTheDocument();
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/CC BY 4\.0/i);
  });
});

// ── Tres estados honestos textualmente distintos (LOCKED) ───────────────────────
describe("ContratosView — tres estados honestos textualmente distintos", () => {
  it("(a) No consultado todavía → copy distinto; NUNCA 'limpio'/'sin contratos ✓'", () => {
    const { container } = render(
      <ContratosView
        data={makeViewData({
          estado: "no_consultado",
          contratos: [],
          totalContratos: 0,
          fechaCorte: null,
        })}
      />,
    );
    expect(
      screen.getByText(/Aún no hemos consultado ChileCompra para el RUT/i),
    ).toBeInTheDocument();
    // Los otros dos estados NO se muestran.
    expect(screen.queryByText(/no se registran contratos asociados/i)).toBeNull();
    expect(screen.queryByText(/contrato registrado|contratos registrados/i)).toBeNull();
    // Un vacío NUNCA se lee como virtud/limpieza.
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/limpio|impecable|sin contratos ✓|no tiene contratos|✓/i);
  });

  it("(b) Consultado sin contratos → copy con fecha de corte, distinto de (a)", () => {
    render(
      <ContratosView
        data={makeViewData({
          estado: "consultado_sin_contratos",
          contratos: [],
          totalContratos: 0,
          fechaCorte: "2026-06-15T00:00:00Z",
        })}
      />,
    );
    expect(
      screen.getByText(/no se registran contratos asociados a ese RUT a esa fecha/i),
    ).toBeInTheDocument();
    // Distinto del estado (a).
    expect(screen.queryByText(/Aún no hemos consultado ChileCompra/i)).toBeNull();
  });

  it("(c) Enlazado → conteo neutro + filas; distinto de (a) y (b)", () => {
    render(<ContratosView data={makeViewData()} />);
    expect(screen.getByText(/1 contrato registrado/i)).toBeInTheDocument();
    expect(screen.getByText(/Constructora Andes SpA/)).toBeInTheDocument();
    expect(screen.queryByText(/Aún no hemos consultado ChileCompra/i)).toBeNull();
    expect(screen.queryByText(/no se registran contratos asociados/i)).toBeNull();
  });
});

// ── Persona jurídica (LOCKED): sujeto proveedor + enlace en línea SEPARADA ───────
describe("ContratosView — persona jurídica (sujeto proveedor, sin posesivo)", () => {
  it("muestra la entidad proveedora como sujeto + '(persona jurídica)' + línea de enlace separada", () => {
    const { container } = render(
      <ContratosView
        data={makeViewData({
          contratos: [makeContrato({ tipo_persona: "jurídica" })],
        })}
      />,
    );
    // Sujeto = entidad proveedora.
    expect(screen.getByText(/Proveedor: Constructora Andes SpA/)).toBeInTheDocument();
    // Etiqueta de tipo de persona.
    expect(screen.getByText(/\(persona jurídica\)/)).toBeInTheDocument();
    // El enlace al parlamentario es una línea SEPARADA, no un posesivo.
    expect(
      screen.getByText("Enlazado por RUT al parlamentario."),
    ).toBeInTheDocument();
    const texto = container.textContent ?? "";
    // NUNCA un posesivo que fusione entidad + parlamentario.
    expect(texto).not.toMatch(/su contrato|contrato del (diputado|senador|parlamentario)/i);
  });

  it("una persona natural usa el mismo encuadre neutro de sujeto proveedor", () => {
    render(
      <ContratosView
        data={makeViewData({
          contratos: [
            makeContrato({ tipo_persona: "natural", proveedor_nombre: "Juan Pérez" }),
          ],
        })}
      />,
    );
    expect(screen.getByText(/Proveedor: Juan Pérez/)).toBeInTheDocument();
    expect(screen.getByText(/\(persona natural\)/)).toBeInTheDocument();
    expect(
      screen.getByText("Enlazado por RUT al parlamentario."),
    ).toBeInTheDocument();
  });
});

// ── ProvenanceBadge por fila + cero cómputo/severidad ───────────────────────────
describe("ContratosView — provenance por fila + cero cómputo", () => {
  it("cada contrato trae un ProvenanceBadge (ChileCompra) con enlace a la fuente", () => {
    render(
      <ContratosView
        data={makeViewData({
          contratos: [
            makeContrato({ codigo_orden: "C1" }),
            makeContrato({ codigo_orden: "C2" }),
          ],
          totalContratos: 2,
        })}
      />,
    );
    expect(screen.getAllByText(/fuente oficial ↗/i).length).toBe(2);
    expect(screen.getAllByText(/ChileCompra/i).length).toBeGreaterThanOrEqual(2);
  });

  it("cuando existe un monto real se muestra literal verbatim; el UI no suma ni rankea", () => {
    const { container } = render(
      <ContratosView
        data={makeViewData({
          contratos: [
            makeContrato({ codigo_orden: "C1", monto: "$ 100" }),
            makeContrato({ codigo_orden: "C2", monto: "$ 200" }),
          ],
          totalContratos: 2,
        })}
      />,
    );
    const texto = container.textContent ?? "";
    expect(texto).toContain("$ 100");
    expect(texto).toContain("$ 200");
    // Sin lenguaje de suma/total/ranking/veredicto.
    expect(texto).not.toMatch(/total|suma|monto total|mayor contrato|ranking|%/i);
  });

  // CR-02: honestidad del campo "Monto" — un no-monto NUNCA se presenta como dinero.
  it("muestra el nombre de la orden bajo un rótulo honesto, NO bajo 'Monto'", () => {
    render(
      <ContratosView
        data={makeViewData({
          contratos: [
            makeContrato({
              codigo_orden: "C1",
              nombre_orden: "Compra de insumos de oficina",
              monto: null,
            }),
          ],
        })}
      />,
    );
    // El nombre/descripción de la orden aparece bajo su rótulo honesto.
    expect(screen.getByText("Nombre de la orden:")).toBeInTheDocument();
    expect(
      screen.getByText("Compra de insumos de oficina"),
    ).toBeInTheDocument();
    // Con `monto` null, "Monto:" muestra "No publicado" — nunca la descripción como si fuera dinero.
    const montoDt = screen.getByText("Monto:");
    const montoDd = montoDt.nextElementSibling;
    expect(montoDd?.textContent).toBe("No publicado");
    expect(montoDd?.textContent).not.toContain("Compra de insumos");
  });

  it("WR-01: tolera columnas null del RPC sin crashear la fila (tipo_persona/organismo/monto)", () => {
    const { container } = render(
      <ContratosView
        data={makeViewData({
          contratos: [
            makeContrato({
              codigo_orden: "C1",
              proveedor_nombre: null,
              tipo_persona: null,
              organismo: null,
              nombre_orden: null,
              monto: null,
            }),
          ],
        })}
      />,
    );
    const texto = container.textContent ?? "";
    // No crashea y rinde fallbacks honestos en vez de celdas vacías.
    expect(texto).toContain("Proveedor no publicado");
    expect(texto).toContain("No publicado");
    // tipo_persona null → encuadre neutro por defecto (persona natural), sin throw.
    expect(screen.getByText(/\(persona natural\)/)).toBeInTheDocument();
  });
});
