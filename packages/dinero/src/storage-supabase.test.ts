// storage-supabase.test — subida idempotente del crudo a Supabase Storage con cliente fake.
//
// Invariantes:
//  - clave versionada servel/<eleccionSlug>/<fecha>/<sha256hex>.xlsx.
//  - idempotente: un 409/duplicate/exists se traga (no error); otro error THROW.

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseStorageServel, claveCrudo, sha256Hex } from "./storage-supabase";

/** Cliente fake: captura las subidas y permite simular un error de upload. */
function fakeClient(uploadError: { message: string } | null = null) {
  const uploads: { bucket: string; key: string; bytes: Uint8Array }[] = [];
  const client = {
    storage: {
      from(bucket: string) {
        return {
          async upload(key: string, bytes: Uint8Array) {
            uploads.push({ bucket, key, bytes });
            return uploadError ? { data: null, error: uploadError } : { data: { path: key }, error: null };
          },
        };
      },
    },
  } as unknown as SupabaseClient;
  return { client, uploads };
}

const BYTES = new Uint8Array([1, 2, 3, 4, 5]);

describe("SupabaseStorageServel — subida idempotente con clave versionada", () => {
  it("clave versionada servel/<eleccionSlug>/<fecha>/<sha256hex>.xlsx", () => {
    const key = claveCrudo("DIPUTADO - DISTRITO 23 - 2025", "2026-06-19", BYTES);
    expect(key).toBe(`servel/diputado-distrito-23-2025/2026-06-19/${sha256Hex(BYTES)}.xlsx`);
  });

  it("subirCrudo OK -> sube con la clave versionada y la devuelve", async () => {
    const { client, uploads } = fakeClient();
    const storage = new SupabaseStorageServel({ url: "x", serviceKey: "k", client });
    const key = await storage.subirCrudo("crudo-servel", "Senador - Circ 5 - 2025", "2026-06-19", BYTES);
    expect(uploads.length).toBe(1);
    expect(uploads[0]!.bucket).toBe("crudo-servel");
    expect(uploads[0]!.key).toBe(key);
    expect(key).toContain("servel/senador-circ-5-2025/2026-06-19/");
  });

  it("idempotente: un error 'already exists' se traga (no error), devuelve la clave", async () => {
    const { client } = fakeClient({ message: "The resource already exists" });
    const storage = new SupabaseStorageServel({ url: "x", serviceKey: "k", client });
    const key = await storage.subirCrudo("crudo-servel", "Eleccion 2025", "2026-06-19", BYTES);
    expect(key).toContain("servel/eleccion-2025/2026-06-19/");
  });

  it("idempotente: un 409 (Duplicate) se traga", async () => {
    const { client } = fakeClient({ message: "Duplicate (409)" });
    const storage = new SupabaseStorageServel({ url: "x", serviceKey: "k", client });
    await expect(
      storage.subirCrudo("crudo-servel", "Eleccion 2025", "2026-06-19", BYTES),
    ).resolves.toContain("servel/");
  });

  it("un error distinto THROW (sin interpolar la service key)", async () => {
    const { client } = fakeClient({ message: "permission denied for bucket" });
    const storage = new SupabaseStorageServel({ url: "x", serviceKey: "SECRET-KEY", client });
    await expect(
      storage.subirCrudo("crudo-servel", "Eleccion 2025", "2026-06-19", BYTES),
    ).rejects.toThrow(/storage SERVEL: permission denied/);
    // El error NUNCA debe contener la service key.
    try {
      await storage.subirCrudo("crudo-servel", "Eleccion 2025", "2026-06-19", BYTES);
    } catch (e) {
      expect(String((e as Error).message)).not.toContain("SECRET-KEY");
    }
  });
});
