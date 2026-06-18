import { describe, expect, it } from "vitest";
import {
  assertAllowedUrl,
  extraHostsFromEnv,
  HostNotAllowedError,
} from "./allowlist";

describe("assertAllowedUrl (CR-03)", () => {
  it("permite hosts gubernamentales https (y sus subdominios)", () => {
    for (const url of [
      "https://www.camara.cl/x",
      "https://opendata.camara.cl/x",
      "https://tramitacion.senado.cl/x",
      "https://web-back.senado.cl/x",
      "https://www.bcn.cl/x",
      "https://nuevo.leychile.cl/x",
      "https://leylobby.gob.cl/x",
      "https://datos.cplt.cl/x",
      "https://infoprobidad.cl/x",
      "https://api.mercadopublico.cl/x",
    ]) {
      expect(() => assertAllowedUrl(url)).not.toThrow();
    }
  });

  it("rechaza hosts no allowlisted", () => {
    expect(() => assertAllowedUrl("https://evil.example.com/x")).toThrow(
      HostNotAllowedError,
    );
    // camara.cl.evil.com no debe matchear el sufijo camara.cl.
    expect(() => assertAllowedUrl("https://camara.cl.evil.com/x")).toThrow(
      HostNotAllowedError,
    );
  });

  it("rechaza http (no https) para hosts gubernamentales", () => {
    expect(() => assertAllowedUrl("http://www.camara.cl/x")).toThrow(
      HostNotAllowedError,
    );
  });

  it("rechaza targets internos aunque vinieran disfrazados", () => {
    for (const url of [
      "http://169.254.169.254/latest/meta-data/",
      "http://metadata.google.internal/x",
      "http://localhost/x",
      "http://127.0.0.1/x",
      "http://0.0.0.0/x",
      "http://10.1.2.3/x",
      "http://172.16.0.1/x",
      "http://192.168.0.1/x",
      "http://[::1]/x",
      "http://[fe80::1]/x",
      "http://[fc00::1]/x",
    ]) {
      expect(() => assertAllowedUrl(url)).toThrow(HostNotAllowedError);
    }
  });

  it("rechaza URLs malformadas con error controlado (no TypeError)", () => {
    expect(() => assertAllowedUrl("no-es-una-url")).toThrow(HostNotAllowedError);
  });

  it("extraHosts permite hosts de test exactos sobre http", () => {
    expect(() =>
      assertAllowedUrl("https://dummy.local/echo", { extraHosts: ["dummy.local"] }),
    ).not.toThrow();
    expect(() =>
      assertAllowedUrl("http://dummy.local/echo", { extraHosts: ["dummy.local"] }),
    ).not.toThrow();
    // extraHost no convierte a un host interno en permitido.
    expect(() =>
      assertAllowedUrl("http://127.0.0.1/x", { extraHosts: ["127.0.0.1"] }),
    ).toThrow(HostNotAllowedError);
  });

  it("extraHostsFromEnv parsea coma-separados y filtra vacios", () => {
    expect(extraHostsFromEnv("dummy.local, a.test ,")).toEqual([
      "dummy.local",
      "a.test",
    ]);
    expect(extraHostsFromEnv(undefined)).toEqual([]);
    expect(extraHostsFromEnv("")).toEqual([]);
  });
});
