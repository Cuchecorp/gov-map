import { describe, expect, it } from "vitest";

import { adminRevisionEnabled } from "./admin-gate";

describe("adminRevisionEnabled (ENT-04, fail-closed)", () => {
  it("var ausente -> false (default fail-closed)", () => {
    expect(adminRevisionEnabled({})).toBe(false);
  });

  it('"false" -> false', () => {
    expect(adminRevisionEnabled({ ADMIN_REVISION_ENABLED: "false" })).toBe(false);
  });

  it('"1" -> false (sin truthiness laxa)', () => {
    expect(adminRevisionEnabled({ ADMIN_REVISION_ENABLED: "1" })).toBe(false);
  });

  it('"TRUE" -> false (case-sensitive: solo el literal "true")', () => {
    expect(adminRevisionEnabled({ ADMIN_REVISION_ENABLED: "TRUE" })).toBe(false);
  });

  it('"true" -> true (unico valor que enciende la ruta admin)', () => {
    expect(adminRevisionEnabled({ ADMIN_REVISION_ENABLED: "true" })).toBe(true);
  });
});
