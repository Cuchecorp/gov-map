import { describe, expect, it } from "vitest";
import { makeProvenance } from "@obs/core";
import { SnapshotWriter } from "./snapshot";

/** DB mock que captura la fila insertada en source_snapshot. */
function fakeSnapshotStore() {
  const rows: Array<Record<string, unknown>> = [];
  return {
    rows,
    insertSnapshot: async (row: Record<string, unknown>) => {
      rows.push(row);
      return { id: rows.length };
    },
  };
}

describe("SnapshotWriter.write", () => {
  it("Test 5: persiste r2Path, contentHash, fingerprint y provenance (FND-08)", async () => {
    const store = fakeSnapshotStore();
    const writer = new SnapshotWriter(store);
    const provenance = makeProvenance("camara", "https://camara.cl/doGet.asmx");

    const ref = await writer.write({
      source: "camara",
      resource: "proyectos",
      cacheKey: "abc123",
      r2Path: "camara/proyectos/2026-06-17/deadbeef.json",
      contentHash: "deadbeef",
      fingerprint: "fp-xyz",
      dateBucket: "2026-06-17",
      provenance,
    });

    expect(ref.r2Path).toBe("camara/proyectos/2026-06-17/deadbeef.json");
    expect(ref.contentHash).toBe("deadbeef");
    expect(ref.snapshotId).toBe(1);

    const row = store.rows[0]!;
    expect(row["r2_path"]).toBe("camara/proyectos/2026-06-17/deadbeef.json");
    expect(row["content_hash"]).toBe("deadbeef");
    expect(row["fingerprint"]).toBe("fp-xyz");
    // Provenance capturada al ingestar (FND-08).
    expect(row["source"]).toBe("camara");
    expect(row["source_url"]).toBe("https://camara.cl/doGet.asmx");
    expect(row["fetched_at"]).toBe(provenance.fetchedAt);
  });
});
