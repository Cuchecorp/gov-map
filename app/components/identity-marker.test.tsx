import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

/**
 * Tests RTL de <IdentityMarker> (54-04 Contract 5b, Wave 0 gap de 54-RESEARCH
 * §Validation Architecture).
 *
 * Contrato: el marker "identidad no verificada" usa las utilities PLANAS del
 * design system (bg-identity-warn-bg / text-identity-warn-fg /
 * border-identity-warn-border) registradas vía @theme inline — NO la sintaxis
 * arbitrary-var v3 `bg-[--identity-warn-bg]`, que compilaba a CSS inválido y
 * dejaba el marker sin su fondo/texto/borde ámbar. El fix RESTAURA el visual.
 */

import { IdentityMarker } from "./identity-marker";

afterEach(cleanup);

describe("IdentityMarker — Contract 5b: utilities planas identity-warn", () => {
  it("usa las utilities planas bg-/text-/border-identity-warn-*", () => {
    const { container } = render(<IdentityMarker />);
    const span = container.querySelector("span") as HTMLElement;
    expect(span.className).toContain("bg-identity-warn-bg");
    expect(span.className).toContain("text-identity-warn-fg");
    expect(span.className).toContain("border-identity-warn-border");
  });

  it("NO usa la sintaxis arbitrary-var v3 (bg-[--identity-warn-bg])", () => {
    const { container } = render(<IdentityMarker />);
    const span = container.querySelector("span") as HTMLElement;
    expect(span.className).not.toContain("[--identity-warn-bg]");
    expect(span.className).not.toContain("[--identity-warn-fg]");
    expect(span.className).not.toContain("[--identity-warn-border]");
  });

  it("conserva el texto y el aria-label 'identidad no verificada'", () => {
    const { container } = render(<IdentityMarker />);
    const span = container.querySelector("span") as HTMLElement;
    expect(span).toHaveAttribute("aria-label", "identidad no verificada");
    expect(span.textContent).toContain("identidad no verificada");
  });
});
