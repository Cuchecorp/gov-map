import { describe, it, expect } from "vitest";
import {
  ProyectoSchema,
  VotacionSchema,
  VotoSchema,
  TramitacionEventoSchema,
} from "./model";

// Provenance inline mínima (TRAM-09): origen + fecha_captura + enlace por fila.
const prov = {
  origen: "senado-wspublico",
  fecha_captura: "2026-06-18T00:00:00.000Z",
  enlace: "https://tramitacion.senado.cl/wspublico/tramitacion.php?boletin=18296",
};

describe("ProyectoSchema", () => {
  it("acepta un proyecto válido con boletín completo + base + provenance", () => {
    const p = {
      boletin: "18296-05",
      boletin_num: "18296",
      titulo: "Autoriza mayor endeudamiento del gobierno central durante 2026",
      iniciativa: "Mensaje",
      camara_origen: "C.Diputados",
      autores: [],
      materia: null,
      estado: "En tramitación",
      etapa: "Segundo trámite constitucional (Senado)",
      subetapa: "Primer informe de comisión de Hacienda",
      ...prov,
    };
    expect(ProyectoSchema.parse(p)).toMatchObject({ boletin: "18296-05" });
  });

  it("acepta iniciativa null (no toda fuente la declara)", () => {
    const p = {
      boletin: "14309-04",
      boletin_num: "14309",
      titulo: "x",
      iniciativa: null,
      camara_origen: null,
      autores: ["A", "B"],
      materia: null,
      estado: null,
      etapa: null,
      subetapa: null,
      ...prov,
    };
    expect(ProyectoSchema.parse(p).iniciativa).toBeNull();
  });
});

describe("VotacionSchema", () => {
  it("acepta una votación válida con totales y cámara", () => {
    const v = {
      id: "camara:89178",
      boletin: "18296-05",
      fecha: "2026-06-17T13:16:04.000Z",
      etapa: null,
      tipo: "Proyecto de Ley",
      quorum: "Quórum Calificado",
      resultado: "Aprobado",
      total_si: 94,
      total_no: 52,
      total_abstencion: 1,
      total_pareo: 0,
      camara: "diputados",
      ...prov,
    };
    expect(VotacionSchema.parse(v)).toMatchObject({ camara: "diputados", total_si: 94 });
  });

  it("rechaza una cámara fuera de {diputados,senado}", () => {
    const v = {
      id: "x:1",
      boletin: "1-1",
      fecha: "2026-01-01T00:00:00.000Z",
      etapa: null,
      tipo: null,
      quorum: null,
      resultado: null,
      total_si: 0,
      total_no: 0,
      total_abstencion: 0,
      total_pareo: 0,
      camara: "congreso",
      ...prov,
    };
    expect(() => VotacionSchema.parse(v)).toThrow();
  });
});

describe("VotoSchema", () => {
  it("acepta un voto con parlamentario_id null (Senado no confirmado)", () => {
    const voto = {
      votacion_id: "senado:47/372:2024-08-27",
      fuente_voter_id: "seq:0",
      mencion_nombre: "Coloma C., Juan Antonio",
      parlamentario_id: null,
      seleccion: "si",
      metodo: null,
      estado_vinculo: "no_confirmado",
    };
    expect(VotoSchema.parse(voto).parlamentario_id).toBeNull();
  });

  it("acepta un voto vinculado determinísticamente (Cámara por Id)", () => {
    const voto = {
      votacion_id: "camara:89178",
      fuente_voter_id: "1234",
      mencion_nombre: "René Alinco Bustos",
      parlamentario_id: "P00012",
      seleccion: "no",
      metodo: "determinista",
      estado_vinculo: "confirmado",
    };
    expect(VotoSchema.parse(voto).parlamentario_id).toBe("P00012");
  });

  it("CR-02: rechaza un voto sin fuente_voter_id (discriminador obligatorio del votante)", () => {
    const voto = {
      votacion_id: "camara:1",
      mencion_nombre: "x",
      parlamentario_id: null,
      seleccion: "si",
      metodo: null,
      estado_vinculo: null,
    };
    expect(() => VotoSchema.parse(voto)).toThrow();
  });

  it("rechaza una selección fuera de {si,no,abstencion,pareo}", () => {
    const voto = {
      votacion_id: "camara:1",
      fuente_voter_id: "1",
      mencion_nombre: "x",
      parlamentario_id: null,
      seleccion: "blanco",
      metodo: null,
      estado_vinculo: null,
    };
    expect(() => VotoSchema.parse(voto)).toThrow();
  });
});

describe("TramitacionEventoSchema", () => {
  it("acepta un evento de timeline válido", () => {
    const e = {
      boletin: "18296-05",
      fecha: "2026-06-03T00:00:00.000Z",
      camara: "C.Diputados",
      tipo: "tramite",
      descripcion: "Ingreso de proyecto. Incluye IF N° 119/03.06.2026.",
      enlace: null,
      ...prov,
    };
    expect(TramitacionEventoSchema.parse(e)).toMatchObject({ tipo: "tramite" });
  });

  it("rechaza un tipo de evento desconocido", () => {
    const e = {
      boletin: "1-1",
      fecha: "2026-01-01T00:00:00.000Z",
      camara: "Senado",
      tipo: "comida",
      descripcion: "x",
      enlace: null,
      ...prov,
    };
    expect(() => TramitacionEventoSchema.parse(e)).toThrow();
  });
});
