import { describe, expect, it } from "vitest";

import { crucesPublicEnabled } from "./cruces-gate";

describe("crucesPublicEnabled (SURF-01, candado B)", () => {
  it("var ausente -> false (default fail-closed)", () => {
    expect(crucesPublicEnabled({})).toBe(false);
  });

  it('"false" -> false', () => {
    expect(crucesPublicEnabled({ CRUCES_PUBLIC_ENABLED: "false" })).toBe(false);
  });

  it('"1" -> false (sin truthiness laxa)', () => {
    expect(crucesPublicEnabled({ CRUCES_PUBLIC_ENABLED: "1" })).toBe(false);
  });

  it('"TRUE" -> false (case-sensitive: solo el literal "true")', () => {
    expect(crucesPublicEnabled({ CRUCES_PUBLIC_ENABLED: "TRUE" })).toBe(false);
  });

  it('"true" -> true (unico valor que enciende)', () => {
    expect(crucesPublicEnabled({ CRUCES_PUBLIC_ENABLED: "true" })).toBe(true);
  });
});
