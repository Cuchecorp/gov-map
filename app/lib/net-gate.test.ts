import { describe, expect, it } from "vitest";

import { netPublicEnabled } from "./net-gate";

describe("netPublicEnabled (NET-02, candado B)", () => {
  it("var ausente -> false (default fail-closed)", () => {
    expect(netPublicEnabled({})).toBe(false);
  });

  it('"false" -> false', () => {
    expect(netPublicEnabled({ NET_PUBLIC_ENABLED: "false" })).toBe(false);
  });

  it('"1" -> false (sin truthiness laxa)', () => {
    expect(netPublicEnabled({ NET_PUBLIC_ENABLED: "1" })).toBe(false);
  });

  it('"TRUE" -> false (case-sensitive: solo el literal "true")', () => {
    expect(netPublicEnabled({ NET_PUBLIC_ENABLED: "TRUE" })).toBe(false);
  });

  it('"true" -> true (unico valor que enciende)', () => {
    expect(netPublicEnabled({ NET_PUBLIC_ENABLED: "true" })).toBe(true);
  });
});
