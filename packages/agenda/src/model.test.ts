// TDD del modelo común de Agenda (Task 2).
//
// RED: importa `./model`, que aún no existe → falla por símbolo ausente.
// GREEN: model.ts exporta los tipos + zod schemas; estos tests describen el contrato
// observable que las olas 2-4 consumen (boletín = llave de cruce con la ficha de Fase 5).

import { describe, it, expect } from "vitest";
import {
  CitacionSchema,
  CitacionInvitadoSchema,
  CitacionPuntoSchema,
  SesionSalaSchema,
  SesionTablaItemSchema,
} from "./model";

// ── Citación de Cámara válida (forma de citaciones_semana.aspx) ────────────────
const citacionCamara = {
  id: "camara:2026-W25:Economía:2026-06-15",
  camara: "camara" as const,
  comision: "Economía, Fomento; Micro, Pequeña y Mediana Empresa",
  fecha: "2026-06-15",
  horario: "10:00 a 12:00",
  sala: "Sala Ramón Pérez Opazo tercer nivel (Presencial)",
  materia: "Estudio del proyecto que moderniza... boletín N°18296-05",
  estado: null,
  semana_iso: "2026-W25",
  invitados: [
    { nombre: "Ministro de Hacienda, señor Jorge Quiroz", calidad: null },
  ],
  puntos: [
    {
      boletin: "18296-05",
      id_proyecto: null,
      materia: "Modernización",
      tipo_tramite: null,
    },
  ],
  origen: "camara-citaciones-semana",
  fecha_captura: "2026-06-18T00:00:00.000Z",
  enlace:
    "https://www.camara.cl/legislacion/comisiones/citaciones_semana.aspx?prmSemana=2026-25",
};

describe("CitacionSchema", () => {
  it("valida una citación de Cámara completa (camara/comision/fecha/horario/sala/materia/semana_iso/invitados/puntos)", () => {
    const parsed = CitacionSchema.parse(citacionCamara);
    expect(parsed.camara).toBe("camara");
    expect(parsed.comision).toBeTruthy();
    expect(parsed.estado).toBeNull();
    expect(parsed.semana_iso).toBe("2026-W25");
    expect(parsed.invitados.length).toBe(1);
    expect(parsed.puntos[0]?.boletin).toBe("18296-05");
  });

  it("rechaza una citación sin `comision`", () => {
    const { comision: _omit, ...sinComision } = citacionCamara;
    expect(() => CitacionSchema.parse(sinComision)).toThrow();
  });

  it("admite estado nullable ('Suspendida'/'Sin efecto'/null)", () => {
    expect(CitacionSchema.parse({ ...citacionCamara, estado: "Suspendida" }).estado).toBe(
      "Suspendida",
    );
  });

  it("exige provenance inline (origen/fecha_captura/enlace) — TRAM-09", () => {
    const { origen: _o, ...sinOrigen } = citacionCamara;
    expect(() => CitacionSchema.parse(sinOrigen)).toThrow();
  });
});

describe("CitacionInvitadoSchema", () => {
  it("valida un invitado con nombre y calidad nullable (gestor de interés / tercero, NO parlamentario)", () => {
    const inv = CitacionInvitadoSchema.parse({ nombre: "Sra. Ana Pérez", calidad: "Subsecretaria" });
    expect(inv.nombre).toBe("Sra. Ana Pérez");
    expect(inv.calidad).toBe("Subsecretaria");
  });

  it("rechaza un invitado sin nombre", () => {
    expect(() => CitacionInvitadoSchema.parse({ calidad: null })).toThrow();
  });
});

describe("CitacionPuntoSchema", () => {
  it("valida un punto con boletín nullable (formato NNNNN-NN → cruce con proyecto.boletin)", () => {
    const p = CitacionPuntoSchema.parse({
      boletin: "16569-25",
      id_proyecto: 12345,
      materia: "Reforma",
      tipo_tramite: "Primer trámite",
    });
    expect(p.boletin).toBe("16569-25");
  });

  it("admite boletín null (puntos sin proyecto asociado)", () => {
    const p = CitacionPuntoSchema.parse({
      boletin: null,
      id_proyecto: null,
      materia: null,
      tipo_tramite: null,
    });
    expect(p.boletin).toBeNull();
  });
});

// ── Tabla semanal de sala del Senado (weekly_table) ───────────────────────────
const sesionSala = {
  id: "senado:sesion:4567",
  camara: "senado" as const,
  fecha: "2026-06-16",
  numero: "12",
  hora_inicio: "16:00",
  tipo: "Ordinaria",
  items: [
    {
      posicion: 1,
      parte_sesion: "ORDEN DEL DÍA",
      materia: "Proyecto que regula...",
      boletin: "2734-14",
      id_proyecto: 2734,
      alias: null,
      quorum: "Simple",
    },
  ],
  origen: "senado-weekly-table",
  fecha_captura: "2026-06-18T00:00:00.000Z",
  enlace: "https://web-back.senado.cl/api/weekly_table?limit=100",
};

describe("SesionSalaSchema", () => {
  it("valida una sesión de sala con items[] y provenance inline", () => {
    const s = SesionSalaSchema.parse(sesionSala);
    expect(s.camara).toBe("senado");
    expect(s.items.length).toBe(1);
    expect(s.items[0]?.boletin).toBe("2734-14");
  });

  it("exige provenance inline (origen/fecha_captura/enlace) — TRAM-09", () => {
    const { enlace: _e, ...sinEnlace } = sesionSala;
    expect(() => SesionSalaSchema.parse(sinEnlace)).toThrow();
  });
});

describe("SesionTablaItemSchema", () => {
  it("valida un item de tabla del Senado (posicion int, parte_sesion, materia, boletin/id_proyecto nullable)", () => {
    const item = SesionTablaItemSchema.parse({
      posicion: 2,
      parte_sesion: "TIEMPO DE VOTACIONES",
      materia: "Votación general",
      boletin: null,
      id_proyecto: null,
      alias: "Ley corta",
      quorum: null,
    });
    expect(item.posicion).toBe(2);
    expect(item.parte_sesion).toBe("TIEMPO DE VOTACIONES");
  });

  it("rechaza `posicion` no-entero", () => {
    expect(() =>
      SesionTablaItemSchema.parse({
        posicion: 1.5,
        parte_sesion: "ORDEN DEL DÍA",
        materia: null,
        boletin: null,
        id_proyecto: null,
        alias: null,
        quorum: null,
      }),
    ).toThrow();
  });
});
