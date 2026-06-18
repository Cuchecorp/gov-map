import { describe, it, expect } from "vitest";
import { fusionarTimeline, eventoDesdeVotacion } from "./timeline";
import type { TramitacionEvento, Votacion } from "./model";

function evento(p: Partial<TramitacionEvento>): TramitacionEvento {
  return {
    boletin: "14309-04",
    fecha: "2024-01-01T00:00:00.000Z",
    camara: "Senado",
    tipo: "tramite",
    descripcion: "x",
    enlace: null,
    origen: "senado-wspublico",
    fecha_captura: "2026-06-18T00:00:00.000Z",
    ...p,
  };
}

describe("fusionarTimeline (TRAM-05)", () => {
  it("ordena por fecha ascendente", () => {
    const out = fusionarTimeline([
      evento({ fecha: "2024-03-01T00:00:00.000Z", descripcion: "c" }),
      evento({ fecha: "2024-01-01T00:00:00.000Z", descripcion: "a" }),
      evento({ fecha: "2024-02-01T00:00:00.000Z", descripcion: "b" }),
    ]);
    expect(out.map((e) => e.descripcion)).toEqual(["a", "b", "c"]);
  });

  it("acepta arreglo de arreglos (lo aplana) — contrato del slice E2E", () => {
    const a = [evento({ fecha: "2024-01-01T00:00:00.000Z", descripcion: "a" })];
    const b = [evento({ fecha: "2024-02-01T00:00:00.000Z", descripcion: "b" })];
    const out = fusionarTimeline([a, b]);
    expect(out.map((e) => e.descripcion)).toEqual(["a", "b"]);
  });

  it("empate de fecha: Cámara antes que Senado (estable)", () => {
    const out = fusionarTimeline([
      evento({ fecha: "2024-05-01T00:00:00.000Z", camara: "Senado", descripcion: "sen" }),
      evento({ fecha: "2024-05-01T00:00:00.000Z", camara: "C.Diputados", descripcion: "dip" }),
    ]);
    expect(out.map((e) => e.descripcion)).toEqual(["dip", "sen"]);
  });

  it("fechas null/inválidas van al final en orden de inserción", () => {
    const out = fusionarTimeline([
      evento({ fecha: "", descripcion: "null1" }),
      evento({ fecha: "2024-01-01T00:00:00.000Z", descripcion: "fechada" }),
      evento({ fecha: "no-es-fecha", descripcion: "null2" }),
    ]);
    expect(out.map((e) => e.descripcion)).toEqual(["fechada", "null1", "null2"]);
  });

  it("tolera dd/mm/yyyy crudo en la fecha", () => {
    const out = fusionarTimeline([
      evento({ fecha: "15/06/2026", descripcion: "jun15" }),
      evento({ fecha: "03/06/2026", descripcion: "jun03" }),
    ]);
    expect(out.map((e) => e.descripcion)).toEqual(["jun03", "jun15"]);
  });
});

describe("eventoDesdeVotacion", () => {
  it("materializa una Votacion como evento tipo:'votacion' con totales en la descripción", () => {
    const v: Votacion = {
      id: "senado:14309-04:27/08/2024",
      boletin: "14309-04",
      fecha: "2024-08-27T00:00:00.000Z",
      etapa: "Segundo trámite",
      tipo: "Discusión general",
      quorum: "Mayoría simple",
      resultado: "Aprobado",
      total_si: 30,
      total_no: 1,
      total_abstencion: 4,
      total_pareo: 0,
      camara: "senado",
      origen: "senado-wspublico",
      fecha_captura: "2026-06-18T00:00:00.000Z",
      enlace: "https://tramitacion.senado.cl/wspublico/votaciones.php",
    };
    const e = eventoDesdeVotacion(v);
    expect(e.tipo).toBe("votacion");
    expect(e.camara).toBe("Senado");
    expect(e.descripcion).toContain("Aprobado");
    expect(e.descripcion).toContain("Sí 30");
    expect(e.descripcion).toContain("No 1");
  });
});
