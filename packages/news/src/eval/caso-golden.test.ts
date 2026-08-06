import { describe, it, expect } from "vitest";
import { CasoGoldenSchema } from "./caso-golden";

/** Fixture SINTÉTICO — no es un caso real etiquetado. 133-a no etiqueta ningún caso. */
function casoValido(): unknown {
  return {
    caso_id: "sintetico-001",
    procedencia: {
      r2_path: "news/biobiochile/2026-08-05/abc123.xml",
      url_hash: "abc123",
      url_canonica: "https://www.biobiochile.cl/noticias/ejemplo-sintetico.shtml",
      outlet: "biobiochile",
      fecha_captura: "2026-08-05T00:00:00-04:00",
      fecha_pub: "2026-08-04T23:00:00-04:00",
    },
    entrada: {
      titulo: "Titular sintético de ejemplo",
      descripcion: "Descripción sintética de ejemplo para el fixture del esquema.",
    },
    entrada_llm: {
      titulo: "Titular sintético de ejemplo",
      descripcion: "Descripción sintética de ejemplo para el fixture del esquema.",
    },
    estrato: "P",
    prefiltro: {
      paso: true,
      terminos: ["senado"],
    },
    etiqueta: "tramitacion_legislativa",
    revision: {
      etiqueta_a: "tramitacion_legislativa",
      etiqueta_b: "tramitacion_legislativa",
      justificacion_a: "Cita el fragmento literal que motivó la etiqueta A.",
      justificacion_b: "Cita el fragmento literal que motivó la etiqueta B.",
      acuerdo: true,
      resuelto_por: "acuerdo",
      modelo_a: "deepseek-v4-flash",
      modelo_b: "minimax-m3",
      en_calibracion_humana: false,
      etiqueta_humana: null,
      revisado_en: "2026-08-06T00:00:00-04:00",
    },
  };
}

describe("CasoGoldenSchema — D-133-F2 / D-133-C2.5, sin ningún caso etiquetado", () => {
  it("un caso bien formado (fixture sintético) valida", () => {
    const r = CasoGoldenSchema.safeParse(casoValido());
    expect(r.success).toBe(true);
  });

  it("falta un campo obligatorio ⇒ falla", () => {
    const caso = casoValido() as Record<string, unknown>;
    delete caso.caso_id;
    const r = CasoGoldenSchema.safeParse(caso);
    expect(r.success).toBe(false);
  });

  it('"estrato" fuera de ["P","N-alea","N-sonda","P-dirigido"] ⇒ falla', () => {
    const caso = casoValido() as Record<string, unknown>;
    caso.estrato = "X-inventado";
    const r = CasoGoldenSchema.safeParse(caso);
    expect(r.success).toBe(false);
  });

  it("etiqueta (y etiqueta_a/etiqueta_b/etiqueta_humana) fuera de ETIQUETAS ⇒ falla", () => {
    const c1 = casoValido() as Record<string, unknown>;
    c1.etiqueta = "categoria_inexistente";
    expect(CasoGoldenSchema.safeParse(c1).success).toBe(false);

    const c2 = casoValido() as any;
    c2.revision.etiqueta_a = "categoria_inexistente";
    expect(CasoGoldenSchema.safeParse(c2).success).toBe(false);

    const c3 = casoValido() as any;
    c3.revision.etiqueta_humana = "categoria_inexistente";
    expect(CasoGoldenSchema.safeParse(c3).success).toBe(false);
  });

  it("un campo extra no declarado ⇒ falla (.strict())", () => {
    const caso = casoValido() as Record<string, unknown>;
    caso.texto_completo = "El full-text completo de la noticia, prohibido por D-133-F2.";
    const r = CasoGoldenSchema.safeParse(caso);
    expect(r.success).toBe(false);
  });

  it('"resuelto_por" fuera de ["acuerdo","operador","no_arbitrado"] ⇒ falla (D-133-C2.5)', () => {
    const caso = casoValido() as any;
    caso.revision.resuelto_por = "arbitro-inventado";
    const r = CasoGoldenSchema.safeParse(caso);
    expect(r.success).toBe(false);
  });

  it('"justificacion_a"/"justificacion_b" de más de 200 chars ⇒ falla (D-133-C2.2)', () => {
    const c1 = casoValido() as any;
    c1.revision.justificacion_a = "x".repeat(201);
    expect(CasoGoldenSchema.safeParse(c1).success).toBe(false);

    const c2 = casoValido() as any;
    c2.revision.justificacion_b = "x".repeat(201);
    expect(CasoGoldenSchema.safeParse(c2).success).toBe(false);
  });

  // ── WR-01 (133-REVIEW.md): refinements de coherencia interna ──────────────────
  // Un `it` por regla + su mutación (quitar el refine ⇒ el caso contradictorio vuelve
  // a validar; verificado manualmente comentando cada bloque del superRefine, ver SUMMARY).

  it("acuerdo:true con etiqueta_a !== etiqueta_b ⇒ falla (desacuerdo declarado como acuerdo)", () => {
    const caso = casoValido() as any;
    caso.revision.etiqueta_a = "tramitacion_legislativa";
    caso.revision.etiqueta_b = "no_legislativa";
    caso.revision.acuerdo = true;
    caso.revision.resuelto_por = "acuerdo";
    expect(CasoGoldenSchema.safeParse(caso).success).toBe(false);
  });

  it("acuerdo:false con etiqueta_a === etiqueta_b ⇒ falla (acuerdo real declarado como desacuerdo)", () => {
    const caso = casoValido() as any;
    caso.revision.etiqueta_a = "tramitacion_legislativa";
    caso.revision.etiqueta_b = "tramitacion_legislativa";
    caso.revision.acuerdo = false;
    caso.revision.resuelto_por = "operador";
    expect(CasoGoldenSchema.safeParse(caso).success).toBe(false);
  });

  it("acuerdo:true con resuelto_por !== 'acuerdo' ⇒ falla (D-133-C2.5)", () => {
    const caso = casoValido() as any;
    caso.revision.acuerdo = true;
    caso.revision.resuelto_por = "no_arbitrado";
    expect(CasoGoldenSchema.safeParse(caso).success).toBe(false);
  });

  it("acuerdo:false con resuelto_por === 'acuerdo' ⇒ falla (desacuerdo no puede resolverse por acuerdo)", () => {
    const caso = casoValido() as any;
    caso.revision.etiqueta_a = "tramitacion_legislativa";
    caso.revision.etiqueta_b = "no_legislativa";
    caso.revision.acuerdo = false;
    caso.revision.resuelto_por = "acuerdo";
    expect(CasoGoldenSchema.safeParse(caso).success).toBe(false);
  });

  it("en_calibracion_humana:true con etiqueta_humana:null ⇒ falla (calibración sin etiqueta)", () => {
    const caso = casoValido() as any;
    caso.revision.en_calibracion_humana = true;
    caso.revision.etiqueta_humana = null;
    expect(CasoGoldenSchema.safeParse(caso).success).toBe(false);
  });

  it("en_calibracion_humana:true con etiqueta_humana no nula ⇒ pasa (control positivo apareado)", () => {
    const caso = casoValido() as any;
    caso.revision.en_calibracion_humana = true;
    caso.revision.etiqueta_humana = "tramitacion_legislativa";
    expect(CasoGoldenSchema.safeParse(caso).success).toBe(true);
  });

  it("etiqueta final que no proviene de etiqueta_a, etiqueta_b ni etiqueta_humana ⇒ falla", () => {
    const caso = casoValido() as any;
    caso.revision.etiqueta_a = "tramitacion_legislativa";
    caso.revision.etiqueta_b = "tramitacion_legislativa";
    caso.etiqueta = "no_legislativa";
    expect(CasoGoldenSchema.safeParse(caso).success).toBe(false);
  });

  it("etiqueta proveniente de etiqueta_humana (aunque distinta de _a/_b) ⇒ pasa", () => {
    const caso = casoValido() as any;
    caso.revision.etiqueta_a = "tramitacion_legislativa";
    caso.revision.etiqueta_b = "no_legislativa";
    caso.revision.acuerdo = false;
    caso.revision.resuelto_por = "operador";
    caso.revision.en_calibracion_humana = true;
    caso.revision.etiqueta_humana = "ambiguo";
    caso.etiqueta = "ambiguo";
    expect(CasoGoldenSchema.safeParse(caso).success).toBe(true);
  });
});
