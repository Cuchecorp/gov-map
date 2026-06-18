import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DriftDetector, fingerprint } from "./drift";

function fixture(name: string): unknown {
  const path = fileURLToPath(new URL(`../test/fixtures/${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Store de fingerprints mock + captura de alertas insertadas. */
function fakeDriftStore(last?: string) {
  const inserted: Array<{ prev?: string; next: string }> = [];
  return {
    inserted,
    lastFingerprint: async () => last,
    insertAlert: async (rec: { prevFingerprint?: string; newFingerprint: string }) => {
      inserted.push({ prev: rec.prevFingerprint, next: rec.newFingerprint });
    },
  };
}

describe("drift", () => {
  it("Test 3a: misma forma estructural => fingerprint identico", async () => {
    const a = await fingerprint(fixture("shape-base.json"));
    const b = await fingerprint(fixture("shape-same.json"));
    expect(a).toBe(b);
  });

  it("Test 3b: forma distinta (key/tipo nuevos) => fingerprint difiere", async () => {
    const base = await fingerprint(fixture("shape-base.json"));
    const changed = await fingerprint(fixture("shape-changed.json"));
    expect(base).not.toBe(changed);
  });

  it("Test 3c: check() reporta changed=true cuando difiere del ultimo conocido", async () => {
    const base = await fingerprint(fixture("shape-base.json"));
    const store = fakeDriftStore(base);
    const detector = new DriftDetector(store);
    const changedFp = await fingerprint(fixture("shape-changed.json"));

    const result = await detector.check("camara", "proyectos", changedFp);
    expect(result.changed).toBe(true);
    expect(result.prevFingerprint).toBe(base);
  });

  it("check() reporta changed=false en primera vez (sin fingerprint previo)", async () => {
    const store = fakeDriftStore(undefined);
    const detector = new DriftDetector(store);
    const fp = await fingerprint(fixture("shape-base.json"));
    const result = await detector.check("camara", "proyectos", fp);
    expect(result.changed).toBe(false);
  });

  it("Test 4: alert() inserta drift_alert y NO lanza (la ingesta continua)", async () => {
    const store = fakeDriftStore("oldfp");
    const detector = new DriftDetector(store);
    const result = { changed: true as const, prevFingerprint: "oldfp", newFingerprint: "newfp" };

    await expect(
      detector.alert("camara", "proyectos", result),
    ).resolves.toBeUndefined();
    expect(store.inserted).toHaveLength(1);
    expect(store.inserted[0]).toEqual({ prev: "oldfp", next: "newfp" });
  });
});
