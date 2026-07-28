// catalog.test — invariantes del catálogo de frescura que no dependen de la DB.

import { describe, it, expect } from "vitest";
import { CATALOG } from "./catalog";
import { SOURCES_SNAPSHOT_CONOCIDOS } from "./query-runner";

// ---------------------------------------------------------------------------------------------
// WR-05 (119-REVIEW) — `r2SnapshotSignal` consultaba `where source = '<fuente del catálogo>'`.
// Para probidad eso era `'probidad'`, pero el conector escribe `'infoprobidad'`: la señal
// reportaba "n/d (sin snapshots)" HABIENDO crudo (`infoprobidad|3` en PROD). El registro de
// cierre de la fase lo evidenciaba sin notarlo.
// ---------------------------------------------------------------------------------------------
describe("WR-05 — el rótulo de source_snapshot es el que el CONECTOR escribe", () => {
  it("probidad declara explícitamente su rótulo `infoprobidad`", () => {
    const probidad = CATALOG.find((c) => c.fuente === "probidad");
    expect(probidad).toBeDefined();
    expect(probidad!.sourceSnapshot).toBe("infoprobidad");
  });

  it("toda entrada con `sourceSnapshot` declarado apunta a un rótulo CONOCIDO", () => {
    // Si no, la señal cae en "n/d (sin snapshots)" para siempre y nadie se entera: un typo en el
    // rótulo sería indistinguible de "esta fuente no deja crudo".
    for (const cfg of CATALOG) {
      if (cfg.sourceSnapshot === undefined) continue;
      expect(SOURCES_SNAPSHOT_CONOCIDOS).toContain(cfg.sourceSnapshot);
    }
  });

  it("`sourceSnapshot` sólo se declara cuando DIFIERE de `fuente` (si no, es ruido)", () => {
    for (const cfg of CATALOG) {
      if (cfg.sourceSnapshot === undefined) continue;
      expect(cfg.sourceSnapshot).not.toBe(cfg.fuente);
    }
  });
});
