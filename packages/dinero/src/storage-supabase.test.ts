// storage-supabase.test — subida idempotente del crudo a Supabase Storage con cliente fake.
//
// Invariantes:
//  - clave versionada servel/<eleccionSlug>/<fecha>/<sha256hex>.xlsx.
//  - idempotente: un 409/duplicate/exists se traga (no error); otro error THROW.

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseStorageServel, claveCrudo, sha256Hex } from "./storage-supabase";

/** Cliente fake: captura las subidas y permite simular un error de upload (mensaje + campos estructurados). */
function fakeClient(uploadError: Record<string, unknown> | null = null) {
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

  it("idempotente: el mensaje canonico 'The resource already exists' se traga (no error)", async () => {
    const { client } = fakeClient({ message: "The resource already exists" });
    const storage = new SupabaseStorageServel({ url: "x", serviceKey: "k", client });
    const key = await storage.subirCrudo("crudo-servel", "Eleccion 2025", "2026-06-19", BYTES);
    expect(key).toContain("servel/eleccion-2025/2026-06-19/");
  });

  it("idempotente: statusCode 409 estructurado se traga", async () => {
    const { client } = fakeClient({ statusCode: "409", message: "Duplicate", error: "Duplicate" });
    const storage = new SupabaseStorageServel({ url: "x", serviceKey: "k", client });
    await expect(
      storage.subirCrudo("crudo-servel", "Eleccion 2025", "2026-06-19", BYTES),
    ).resolves.toContain("servel/");
  });

  it("idempotente: error canonico 'Duplicate' (sin statusCode) se traga", async () => {
    const { client } = fakeClient({ error: "Duplicate", message: "..." });
    const storage = new SupabaseStorageServel({ url: "x", serviceKey: "k", client });
    await expect(
      storage.subirCrudo("crudo-servel", "Eleccion 2025", "2026-06-19", BYTES),
    ).resolves.toContain("servel/");
  });

  it("WR-03: 'Bucket not found' (statusCode 404) NO se traga -> THROW (no es idempotencia)", async () => {
    // Antes el regex laxo /exists|.../ no lo tocaba, pero un mensaje "does not exist" SI lo habria
    // tragado como exito falso. La logica estructurada lo trata como fallo real -> THROW.
    const { client } = fakeClient({ statusCode: "404", error: "Bucket not found", message: "Bucket not found" });
    const storage = new SupabaseStorageServel({ url: "x", serviceKey: "k", client });
    await expect(
      storage.subirCrudo("crudo-servel", "Eleccion 2025", "2026-06-19", BYTES),
    ).rejects.toThrow(/storage SERVEL: Bucket not found/);
  });

  it("WR-03: un mensaje con substring 'exist' pero no-duplicado NO se traga -> THROW", async () => {
    // "The bucket does not exist" contiene "exist" -> el regex viejo lo habria tragado como exito.
    const { client } = fakeClient({ statusCode: "404", message: "The bucket does not exist" });
    const storage = new SupabaseStorageServel({ url: "x", serviceKey: "k", client });
    await expect(
      storage.subirCrudo("crudo-servel", "Eleccion 2025", "2026-06-19", BYTES),
    ).rejects.toThrow(/storage SERVEL: The bucket does not exist/);
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
