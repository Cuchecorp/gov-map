import { describe, expect, it } from "vitest";

import { vsimPublicEnabled } from "./vsim-gate";

describe("vsimPublicEnabled (VSIM-02, candado B similitud de votación)", () => {
  it("var ausente -> false (default fail-closed)", () => {
    expect(vsimPublicEnabled({})).toBe(false);
  });

  it('"false" -> false', () => {
    expect(vsimPublicEnabled({ VSIM_PUBLIC_ENABLED: "false" })).toBe(false);
  });

  it('"1" -> false (sin truthiness laxa)', () => {
    expect(vsimPublicEnabled({ VSIM_PUBLIC_ENABLED: "1" })).toBe(false);
  });

  it('"TRUE" -> false (case-sensitive: solo el literal "true")', () => {
    expect(vsimPublicEnabled({ VSIM_PUBLIC_ENABLED: "TRUE" })).toBe(false);
  });

  it('"true" -> true (unico valor que enciende)', () => {
    expect(vsimPublicEnabled({ VSIM_PUBLIC_ENABLED: "true" })).toBe(true);
  });
});
