// parse-camara-tabla.test — extracción estructurada de la tabla de sala de Cámara
// (DeepSeek-desde-PDF) con un provider MOCK (sin red, sin quemar cuota). Verifica:
//  (a) normalización del boletín "10986- 24" → "10986-24";
//  (b) boletín que no casa el formato → null (no se fabrica);
//  (c) modelo POR SEMANA: 1 SesionSala, id camara:sesion:<YYYY-Www>, camara="camara";
//  (d) fecha = la de la cabecera si el modelo la trae, si no el lunes ISO;
//  (e) degradación honesta: provider que lanza → []; items=[] → [];
//  (f) extraerTextoTablaPdf: cuerpo no-PDF → null (magic bytes).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import type { ZodType } from "zod";
import type { CompletionRequest, LLMProvider } from "@obs/llm";
import {
  parseCamaraTabla,
  extraerTextoTablaPdf,
  normalizarBoletin,
  ORIGEN_CAMARA_TABLA,
} from "./parse-camara-tabla";
import { CAMARA_TABLA_PDF_URL } from "./connector-camara";
import { semanaIsoKey, primerDiaSemanaIso } from "./semana-iso";

const SEMANA = { year: 2026, week: 26 };

const TEXTO = readFileSync(
  join(__dirname, "__fixtures__", "camara-tabla-recorte.txt"),
  "utf8",
);

/** Provider mock: devuelve un objeto fijo (no toca red ni valida cuota). */
function mockProvider(
  impl: (req: CompletionRequest) => unknown,
): LLMProvider {
  return {
    id: "mock",
    trainsOnInputs: false,
    async complete<T>(req: CompletionRequest, _schema: ZodType<T>): Promise<T> {
      return impl(req) as T;
    },
  };
}

describe("normalizarBoletin", () => {
  it("normaliza el espacio del sufijo ('10986- 24' → '10986-24')", () => {
    expect(normalizarBoletin("Boletín N° 10986- 24")).toBe("10986-24");
    expect(normalizarBoletin("18257-10")).toBe("18257-10");
  });
  it("devuelve null si no hay un boletín reconocible (no fabrica)", () => {
    expect(normalizarBoletin("no aplica")).toBeNull();
    expect(normalizarBoletin(null)).toBeNull();
    expect(normalizarBoletin("")).toBeNull();
  });
  it("rechaza un sufijo de 3 dígitos (basura OCR) → null, no lo guarda como no-cruzable", () => {
    expect(normalizarBoletin("Boletín N° 10986-124")).toBeNull();
    // pero NO debe romper un boletín válido pegado a otro texto
    expect(normalizarBoletin("10986-24 SUMA")).toBe("10986-24");
  });
});

describe("parseCamaraTabla — DeepSeek-desde-PDF (mock)", () => {
  const respuestaOk = {
    fecha_primera_sesion: "2026-06-22",
    items: [
      {
        materia: "Modifica la ley General de Pesca y Acuicultura en materia de fiscalización.",
        boletin: "Boletín N° 10986- 24",
        seccion: "TABLA",
        urgencia: "SUMA (25.06.2026)",
      },
      {
        materia: "Establece normas sobre protección de datos personales.",
        boletin: "18257-10",
        seccion: "FACIL DESPACHO",
        urgencia: null,
      },
      {
        materia: "Acusación constitucional en contra de un ministro de Estado.",
        boletin: "no aplica",
        seccion: "ORDEN DEL DÍA",
        urgencia: null,
      },
    ],
  };

  it("produce 1 SesionSala POR SEMANA con camara='camara' y procedencia al PDF", async () => {
    const sesiones = await parseCamaraTabla(TEXTO, SEMANA, {
      provider: mockProvider(() => respuestaOk),
      fechaCaptura: "2026-06-22T00:00:00.000Z",
    });
    expect(sesiones).toHaveLength(1);
    const s = sesiones[0]!;
    expect(s.id).toBe(`camara:sesion:${semanaIsoKey(SEMANA.year, SEMANA.week)}`);
    expect(s.camara).toBe("camara");
    expect(s.origen).toBe(ORIGEN_CAMARA_TABLA);
    expect(s.enlace).toBe(CAMARA_TABLA_PDF_URL);
    // fecha = la de la cabecera (el modelo la trajo en ISO).
    expect(s.fecha).toBe("2026-06-22");
    expect(s.items).toHaveLength(3);
  });

  it("normaliza el boletín y NO fabrica el que no casa (null), preservando el orden (posicion)", async () => {
    const [s] = await parseCamaraTabla(TEXTO, SEMANA, {
      provider: mockProvider(() => respuestaOk),
    });
    const items = s!.items;
    expect(items[0]!.boletin).toBe("10986-24"); // normalizado
    expect(items[0]!.posicion).toBe(0);
    expect(items[0]!.quorum).toBe("SUMA (25.06.2026)");
    expect(items[1]!.boletin).toBe("18257-10");
    expect(items[1]!.parte_sesion).toBe("FACIL DESPACHO");
    expect(items[2]!.boletin).toBeNull(); // "no aplica" → null (honesto)
    expect(items[2]!.posicion).toBe(2);
  });

  it("fecha cae al lunes ISO si el modelo no trae una fecha de cabecera válida", async () => {
    const [s] = await parseCamaraTabla(TEXTO, SEMANA, {
      provider: mockProvider(() => ({ fecha_primera_sesion: null, items: respuestaOk.items })),
    });
    expect(s!.fecha).toBe(primerDiaSemanaIso(SEMANA.year, SEMANA.week));
  });

  it("degrada a [] si el provider lanza (RUT fail-closed / JSON irreparable / red)", async () => {
    const sesiones = await parseCamaraTabla(TEXTO, SEMANA, {
      provider: mockProvider(() => {
        throw new Error("RUT detectado en el prompt");
      }),
    });
    expect(sesiones).toEqual([]);
  });

  it("degrada a [] si el modelo no devuelve ítems (no fabrica una sesión vacía)", async () => {
    const sesiones = await parseCamaraTabla(TEXTO, SEMANA, {
      provider: mockProvider(() => ({ fecha_primera_sesion: null, items: [] })),
    });
    expect(sesiones).toEqual([]);
  });
});

describe("extraerTextoTablaPdf — degradación honesta", () => {
  it("devuelve null si el cuerpo no es un PDF (magic bytes)", async () => {
    const noPdf = new TextEncoder().encode("<html>not a pdf</html>");
    expect(await extraerTextoTablaPdf(noPdf)).toBeNull();
  });
});
