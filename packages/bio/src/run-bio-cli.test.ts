// run-bio-cli.test — el entry-point ensambla los colaboradores correctos y respeta el ORDEN
// LOCKED. Verifica: flags parsean, loadEnv es BOM-safe con precedencia process.env, --dry-run NO
// toca red ni R2, y el conector real acota por --fuente. Sin fetch a la red (getText inyectado por
// el propio conector con robots que niega / o fuente=all sin credenciales → dry-run).

import { describe, it, expect, afterEach } from "vitest";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { flagValue, flagValues, loadEnv, buildBioConector } from "./run-bio-cli";
import { DIPUTADOS_BIO_URL } from "./parse-diputados";

const savedArgv = process.argv;
const savedEnv = { ...process.env };

afterEach(() => {
  process.argv = savedArgv;
  process.env = savedEnv;
});

describe("flagValue / flagValues", () => {
  it("lee el valor de un flag y null si ausente", () => {
    process.argv = ["node", "cli", "--fuente", "diputados", "--dry-run"];
    expect(flagValue("--fuente")).toBe("diputados");
    expect(flagValue("--from-r2")).toBeNull();
  });

  it("lee TODAS las apariciones de un flag repetible", () => {
    process.argv = ["node", "cli", "--integrantes-file", "4884=a.html", "--integrantes-file", "5001=b.html"];
    expect(flagValues("--integrantes-file")).toEqual(["4884=a.html", "5001=b.html"]);
    expect(flagValues("--nada")).toEqual([]);
  });
});

describe("loadEnv — BOM-safe con precedencia process.env", () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("parsea .env con BOM y quita comillas", () => {
    dir = mkdtempSync(join(tmpdir(), "bio-env-"));
    writeFileSync(join(dir, ".env"), "﻿SUPABASE_API_URL=\"https://x.supabase.co\"\nR2_BUCKET=obs\n");
    delete process.env.SUPABASE_API_URL;
    delete process.env.R2_BUCKET;
    const env = loadEnv(dir);
    expect(env.SUPABASE_API_URL).toBe("https://x.supabase.co");
    expect(env.R2_BUCKET).toBe("obs");
  });

  it("process.env tiene PRECEDENCIA sobre el archivo (CI)", () => {
    dir = mkdtempSync(join(tmpdir(), "bio-env-"));
    writeFileSync(join(dir, ".env"), "SUPABASE_SECRET_KEY=del-archivo\n");
    process.env.SUPABASE_SECRET_KEY = "de-process-env";
    const env = loadEnv(dir);
    expect(env.SUPABASE_SECRET_KEY).toBe("de-process-env");
  });

  it("sin .env (CI) usa solo process.env sin lanzar", () => {
    const soloProc = mkdtempSync(join(tmpdir(), "bio-noenv-"));
    process.env.R2_ENDPOINT_URL = "https://r2.example";
    const env = loadEnv(soloProc);
    expect(env.R2_ENDPOINT_URL).toBe("https://r2.example");
    rmSync(soloProc, { recursive: true, force: true });
  });
});

describe("buildBioConector — acota por --fuente y respeta el WAF de comisiones", () => {
  it("fuente=comisiones sin catálogo → envelope con catálogo null (no fetchea www.camara.cl)", async () => {
    // Sin --xml-file: comisiones no se fetchea (WAF); el envelope queda vacío para esa fuente.
    const conector = buildBioConector({ fuente: "comisiones" });
    const env = await conector.fetchEnvelope();
    expect(env.comisionesCatalogoHtml).toBeNull();
    expect(env.diputadosXml).toBeNull(); // acotado: NO trae diputados
    expect(env.senadoresSparql).toBeNull();
    expect(Object.keys(env.integrantesPorComision)).toHaveLength(0);
  });

  it("fuente=comisiones con catálogo inyectado → lo pasa tal cual sin tocar red", async () => {
    const html = "<html><a href='integrantes.aspx?prmID=4884'>Constitución</a></html>";
    const conector = buildBioConector({
      fuente: "comisiones",
      catalogoHtml: html,
      integrantesHtml: { "4884": "<html>integrantes</html>" },
    });
    const env = await conector.fetchEnvelope();
    expect(env.comisionesCatalogoHtml).toBe(html);
    expect(env.integrantesPorComision["4884"]).toBe("<html>integrantes</html>");
    expect(env.diputadosXml).toBeNull();
  });

  it("el endpoint de diputados es retornarDiputadosPeriodoActual en opendata.camara.cl", () => {
    expect(DIPUTADOS_BIO_URL).toContain("opendata.camara.cl");
    expect(DIPUTADOS_BIO_URL).toContain("retornarDiputadosPeriodoActual");
  });
});
