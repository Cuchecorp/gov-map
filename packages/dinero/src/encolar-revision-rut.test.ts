// encolar-revision-rut.test — PKG-02: un fallo de `enqueueRevision` NO debe abortar
// la corrida (best-effort) Y debe loguearse (antes se tragaba en silencio).

import { describe, it, expect, vi, afterEach } from "vitest";
import type {
  PipelineWriter,
  FilaVinculo,
  FilaAudit,
  CasoRevision,
} from "@obs/adjudication";
import type { MencionForanea } from "@obs/adjudication";
import { encolarRevisionRut, type CandidatoRevisionRut } from "./reconciliar-contrato";

class ThrowingWriter implements PipelineWriter {
  async upsertVinculo(_v: FilaVinculo): Promise<number | null> {
    return 1;
  }
  async appendAudit(_row: FilaAudit): Promise<void> {}
  async enqueueRevision(_caso: CasoRevision): Promise<void> {
    throw new Error("supabase down");
  }
}

class OkWriter implements PipelineWriter {
  colas: CasoRevision[] = [];
  async upsertVinculo(_v: FilaVinculo): Promise<number | null> {
    return 1;
  }
  async appendAudit(_row: FilaAudit): Promise<void> {}
  async enqueueRevision(caso: CasoRevision): Promise<void> {
    this.colas.push(caso);
  }
}

const mencion: MencionForanea = {
  nombreOriginal: "Proveedora Ltda.",
  nombreNormalizado: "proveedora ltda",
  tokens: ["proveedora", "ltda"],
  camara: "senado",
  periodo: "2022-2026",
  region: null,
};

const candidato: CandidatoRevisionRut = {
  parlamentarioId: "S00042",
  rutCandidato: "12345678-5",
  proveedorNombre: "Proveedora Ltda.",
  provenance: { origen: "chilecompra", fecha_captura: "2026-06-24", enlace: "https://x" },
};

afterEach(() => vi.restoreAllMocks());

describe("encolarRevisionRut (PKG-02)", () => {
  it("un enqueueRevision que lanza NO aborta (best-effort) y SE loguea", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      encolarRevisionRut(new ThrowingWriter(), mencion, candidato),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledOnce();
    // El log nombra al parlamentario candidato (traza para ops).
    expect(spy.mock.calls[0]?.join(" ")).toContain("S00042");
  });

  it("camino feliz: encola el caso sin RUT crudo en el payload minimizado", async () => {
    const w = new OkWriter();
    await encolarRevisionRut(w, mencion, candidato);
    expect(w.colas).toHaveLength(1);
    // Minimizacion: el RUT crudo NUNCA viaja en el caso encolado.
    expect(JSON.stringify(w.colas[0])).not.toContain("12345678-5");
  });
});
