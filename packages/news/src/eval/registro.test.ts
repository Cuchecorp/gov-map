import { describe, it, expect } from "vitest";
import { validarSalidaAnotador, construirRegistro, MODELO_A, MODELO_B } from "./registro";
import type { EntradaAnotacion } from "./anotacion";

const ENTRADAS: EntradaAnotacion[] = [
  { id: "o:1", titulo: "Senado aprueba reforma", descripcion: "La sala del Senado votó la iniciativa." },
  { id: "o:2", titulo: "Gol en el clásico", descripcion: "El delantero anotó al minuto 90." },
  { id: "o:3", titulo: "Ministro anuncia plan", descripcion: "" },
];

function salidaValida(): { id: string; etiqueta: string; justificacion: string; cita: string }[] {
  return [
    { id: "o:1", etiqueta: "tramitacion_legislativa", justificacion: "votación en sala", cita: "votó la iniciativa" },
    { id: "o:2", etiqueta: "no_legislativa", justificacion: "deportes", cita: "Gol en el clásico" },
    { id: "o:3", etiqueta: "politica_no_legislativa", justificacion: "anuncio del Ejecutivo sin tramitación", cita: "Ministro anuncia plan" },
  ];
}

describe("registro — validación C2.2/C2.5 (133-b-05)", () => {
  it("(a) salida válida: cero problemas", () => {
    expect(validarSalidaAnotador(salidaValida(), ENTRADAS)).toEqual([]);
  });

  it("(b) cobertura incompleta, id extra, duplicado, etiqueta ilegal, cita no literal y justificación >200 se detectan", () => {
    const salida = [
      { id: "o:1", etiqueta: "tramitacion_legislativa", justificacion: "x".repeat(201), cita: "votó la iniciativa" },
      { id: "o:1", etiqueta: "tramitacion_legislativa", justificacion: "dup", cita: "votó la iniciativa" },
      { id: "o:9", etiqueta: "no_legislativa", justificacion: "fantasma", cita: "nada" },
      { id: "o:2", etiqueta: "deporte", justificacion: "etiqueta inventada", cita: "Gol en el clásico" },
      { id: "o:3", etiqueta: "politica_no_legislativa", justificacion: "cita parafraseada", cita: "El ministro anunció un plan" },
    ];
    const problemas = validarSalidaAnotador(salida, ENTRADAS);
    const textos = problemas.map((p) => p.problema).join(" | ");
    expect(textos).toContain("> 200");
    expect(textos).toContain("duplicado");
    expect(textos).toContain("no existe en las entradas");
    expect(textos).toContain("etiqueta ilegal");
    expect(textos).toContain("NO es subcadena literal");
    // ningún caso quedó sin etiquetar en este fixture (o:1/2/3 aparecen) — control de que
    // la lista de problemas no infla con falsos "sin etiquetar"
    expect(textos).not.toContain("cobertura incompleta");
  });

  it("(c) caso sin etiquetar aparece como cobertura incompleta", () => {
    const salida = salidaValida().slice(0, 2);
    const problemas = validarSalidaAnotador(salida, ENTRADAS);
    expect(problemas.some((p) => p.id === "o:3" && /cobertura incompleta/.test(p.problema))).toBe(true);
  });

  it("(d) construirRegistro: acuerdos con etiqueta final, desacuerdos pendientes con etiqueta null", () => {
    const salidaB = salidaValida();
    salidaB[2] = { ...salidaB[2]!, etiqueta: "ambiguo", justificacion: "titular vs descripción vacía", cita: "Ministro anuncia plan" };
    const filas = construirRegistro({
      salidaA: salidaValida(),
      salidaB,
      entradas: ENTRADAS,
      idsCalibracion: new Set(["o:2"]),
      revisadoEn: "2026-08-10",
    });
    expect(filas.length).toBe(3);
    const f1 = filas.find((f) => f.caso_id === "o:1")!;
    expect(f1.acuerdo).toBe(true);
    expect(f1.etiqueta).toBe("tramitacion_legislativa");
    expect(f1.resuelto_por).toBe("acuerdo");
    expect(f1.modelo_a).toBe(MODELO_A);
    expect(f1.modelo_b).toBe(MODELO_B);
    const f3 = filas.find((f) => f.caso_id === "o:3")!;
    expect(f3.acuerdo).toBe(false);
    expect(f3.etiqueta).toBeNull();
    expect(f3.resuelto_por).toBe("pendiente");
    expect(filas.find((f) => f.caso_id === "o:2")!.en_calibracion).toBe(true);
    expect(f1.en_calibracion).toBe(false);
  });

  it("(e) construirRegistro LANZA sobre salidas inválidas — el registro no existe sin validación", () => {
    const salidaMala = salidaValida();
    salidaMala[0] = { ...salidaMala[0]!, cita: "esto no está en el texto" };
    expect(() =>
      construirRegistro({
        salidaA: salidaMala,
        salidaB: salidaValida(),
        entradas: ENTRADAS,
        idsCalibracion: new Set(),
        revisadoEn: "2026-08-10",
      }),
    ).toThrow(/salidas inválidas/);
  });
});
