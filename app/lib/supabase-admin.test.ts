import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Captura los argumentos con que se construye el cliente service-role sin tocar red.
const createClientMock = vi.fn(() => ({ __admin: true }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (url: string, key: string, opts: unknown) =>
    createClientMock(url, key, opts),
}));

import { createAdminSupabase } from "./supabase-admin";

const URL_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_KEY",
] as const;

describe("createAdminSupabase (APP-01 — service key fallback union)", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    createClientMock.mockClear();
    saved = {};
    for (const k of URL_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of URL_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("usa SUPABASE_SECRET_KEY (nombre canonico que setea Cloudflare/.env)", () => {
    process.env.SUPABASE_URL = "https://proj.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_canonico";
    createAdminSupabase();
    expect(createClientMock).toHaveBeenCalledWith(
      "https://proj.supabase.co",
      "sb_secret_canonico",
      expect.anything(),
    );
  });

  it("cae a SUPABASE_SERVICE_KEY si SECRET_KEY ausente (alias historico de CLIs)", () => {
    process.env.SUPABASE_URL = "https://proj.supabase.co";
    process.env.SUPABASE_SERVICE_KEY = "sb_service_alias";
    createAdminSupabase();
    expect(createClientMock).toHaveBeenCalledWith(
      "https://proj.supabase.co",
      "sb_service_alias",
      expect.anything(),
    );
  });

  it("PREFIERE SECRET_KEY sobre SERVICE_KEY cuando ambas estan", () => {
    process.env.SUPABASE_URL = "https://proj.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_preferida";
    process.env.SUPABASE_SERVICE_KEY = "sb_service_ignorada";
    createAdminSupabase();
    expect(createClientMock).toHaveBeenCalledWith(
      "https://proj.supabase.co",
      "sb_secret_preferida",
      expect.anything(),
    );
  });

  it("lanza (fail-closed) si falta la service key bajo ambos nombres", () => {
    process.env.SUPABASE_URL = "https://proj.supabase.co";
    expect(() => createAdminSupabase()).toThrow(/service key/i);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("lanza si falta SUPABASE_URL", () => {
    process.env.SUPABASE_SECRET_KEY = "sb_secret_canonico";
    expect(() => createAdminSupabase()).toThrow(/SUPABASE_URL/);
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
