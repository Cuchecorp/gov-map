import { describe, expect, it } from "vitest";

import { safeExternalHref } from "./utils";

describe("safeExternalHref (XSS guard #9 — solo http/https)", () => {
  it("https → pasa", () => {
    expect(safeExternalHref("https://www.camara.cl/x")).toBe(
      "https://www.camara.cl/x",
    );
  });

  it("http → pasa", () => {
    expect(safeExternalHref("http://senado.cl")).toBe("http://senado.cl");
  });

  it.each([
    ["javascript:alert(1)"],
    ["JavaScript:alert(1)"],
    ["data:text/html,<script>1</script>"],
    ["vbscript:msgbox(1)"],
    ["mailto:x@y.cl"],
    ["//evil.com"],
    ["not a url"],
  ])("esquema/forma no segura → null (%s)", (mal) => {
    expect(safeExternalHref(mal)).toBeNull();
  });

  it("null / undefined / vacío → null", () => {
    expect(safeExternalHref(null)).toBeNull();
    expect(safeExternalHref(undefined)).toBeNull();
    expect(safeExternalHref("")).toBeNull();
  });
});
