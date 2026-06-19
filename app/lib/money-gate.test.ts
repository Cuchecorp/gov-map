import { describe, expect, it } from "vitest";

import { moneyPublicEnabled } from "./money-gate";

describe("moneyPublicEnabled (LEGAL-01, candado B)", () => {
  it("var ausente -> false (default fail-closed)", () => {
    expect(moneyPublicEnabled({})).toBe(false);
  });

  it('"false" -> false', () => {
    expect(moneyPublicEnabled({ MONEY_PUBLIC_ENABLED: "false" })).toBe(false);
  });

  it('"1" -> false (sin truthiness laxa)', () => {
    expect(moneyPublicEnabled({ MONEY_PUBLIC_ENABLED: "1" })).toBe(false);
  });

  it('"TRUE" -> false (case-sensitive: solo el literal "true")', () => {
    expect(moneyPublicEnabled({ MONEY_PUBLIC_ENABLED: "TRUE" })).toBe(false);
  });

  it('"true" -> true (unico valor que enciende)', () => {
    expect(moneyPublicEnabled({ MONEY_PUBLIC_ENABLED: "true" })).toBe(true);
  });
});
