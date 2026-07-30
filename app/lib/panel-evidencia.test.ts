import { describe, expect, it } from "vitest";
import {
  parseEvidenciaProyectos,
  parseEvidenciaCitaciones,
  parseEvidenciaSala,
  etiquetaFuente,
  gradoUrgencia,
  urgenciaVigentePorBoletin,
  type ItemProyecto,
} from "./panel-evidencia";

// Fixtures VERBATIM del contrato REAL PROD (128-RESEARCH.md §"Contrato REAL del jsonb en PROD").

const VELOCITY_ITEM = {
  fecha: "2026-07-28",
  enlace: "https://tramitacion.senado.cl/wspublico/tramitacion.php",
  titulo: "Amplía la penalización dispuesta en el artículo 304 bis del Código Penal…",
  boletin: "16569-25",
  en_corpus: true,
  enlace_evento: null,
};

const URGENCIA_ITEM = {
  fecha: "2026-07-06",
  enlace: "…",
  titulo: "Modifica cuerpos legales…",
  boletin: "16725-06",
  en_corpus: true,
  descripcion: "Cuenta, Comunicación de la diputada Romero…",
  enlace_evento: null,
};

const AGENDA_CITACION_ITEM = {
  fecha: "2026-08-03",
  enlace: "https://web-back.senado.cl/api/commissions_citations?limit=100",
  comision: "de Medio Ambiente, Cambio Climático y Bienes Nacionales",
  horario: "12:30 a 14:00",
  semana_iso: "2026-W32",
  puntos_total: 1,
  puntos: [
    {
      boletin: null,
      titulo: null,
      enlace: null,
      materia: "Recibir al Alcalde de la comuna de Concepción…",
      posicion: 0,
      en_corpus: false,
    },
  ],
};

const AGENDA_SALA_ITEM = {
  fecha: "2026-08-04",
  tipo: "Ordinaria",
  numero: "47",
  hora_inicio: "16:00",
  enlace: "https://web-back.senado.cl/api/weekly_table?limit=100",
  tabla_total: 5,
  tabla: [
    {
      boletin: "14782-13",
      titulo: "Equipara el derecho de sala cuna…",
      enlace: "https://tramitacion.senado.cl/wspublico/tramitacion.php",
      materia: "Proyecto de ley, iniciado en Mensaje… (Boletín Nº 14.782-13)…",
      posicion: 1,
      quorum: "5",
      en_corpus: true,
      parte_sesion: "ORDEN DEL DÍA",
    },
  ],
};

const CAMARA_SALA_SINTETICA = {
  tipo: null,
  numero: null,
  hora_inicio: null,
  fecha: "2026-08-03",
  enlace: "https://www.camara.cl/verDoc.aspx?prmId=0&prmTipo=TABLASEMANAL",
  tabla_total: 25,
};

const FUENTE_TRAMITACION = { origen: "plataforma-tramitacion", dataset: "tramitacion" };

function evidencia(items: unknown[]) {
  return {
    items,
    total: items.length,
    consultado_al: "2026-07-30",
    fuente: FUENTE_TRAMITACION,
  };
}

describe("parseEvidenciaProyectos", () => {
  it("señal suprimida ({}) parsea sin throw y sin fabricar items", () => {
    expect(parseEvidenciaProyectos({})).toEqual({
      items: [],
      total: null,
      consultado_al: null,
      fuente: { origen: null, dataset: null },
    });
  });

  it("null → mismo objeto vacío, sin throw", () => {
    expect(parseEvidenciaProyectos(null)).toEqual({
      items: [],
      total: null,
      consultado_al: null,
      fuente: { origen: null, dataset: null },
    });
  });

  it("undefined → mismo objeto vacío, sin throw", () => {
    expect(parseEvidenciaProyectos(undefined)).toEqual({
      items: [],
      total: null,
      consultado_al: null,
      fuente: { origen: null, dataset: null },
    });
  });

  it("item de velocity (sin descripcion) → descripcion === null, nunca undefined", () => {
    const r = parseEvidenciaProyectos(evidencia([VELOCITY_ITEM]));
    expect(r.items[0].descripcion).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(r.items[0], "descripcion")).toBe(true);
  });

  it("item con en_corpus ausente → en_corpus === false (fail-closed)", () => {
    const { en_corpus, ...sinEnCorpus } = VELOCITY_ITEM;
    const r = parseEvidenciaProyectos(evidencia([sinEnCorpus]));
    expect(r.items[0].en_corpus).toBe(false);
  });

  it("total no numérico o ausente → null", () => {
    const r1 = parseEvidenciaProyectos({ ...evidencia([]), total: "no-numero" });
    expect(r1.total).toBeNull();
    const { total, ...sinTotal } = evidencia([]);
    const r2 = parseEvidenciaProyectos(sinTotal);
    expect(r2.total).toBeNull();
  });

  it("item de urgencias/archivados con descripcion presente se conserva", () => {
    const r = parseEvidenciaProyectos(evidencia([URGENCIA_ITEM]));
    expect(r.items[0].descripcion).toBe("Cuenta, Comunicación de la diputada Romero…");
  });

  it("item no-objeto dentro del array se descarta, no rompe el parse", () => {
    const r = parseEvidenciaProyectos(evidencia(["texto", 42, null, VELOCITY_ITEM]));
    expect(r.items).toHaveLength(1);
    expect(r.items[0].boletin).toBe("16569-25");
  });
});

describe("parseEvidenciaCitaciones", () => {
  it("puntos ausente → puntos: [] y puntos_total: null", () => {
    const { puntos, puntos_total, ...sinPuntos } = AGENDA_CITACION_ITEM;
    const r = parseEvidenciaCitaciones(evidencia([sinPuntos]));
    expect(r.items[0].puntos).toEqual([]);
    expect(r.items[0].puntos_total).toBeNull();
  });

  it("punto con boletin:null y materia larga se conserva íntegro", () => {
    const r = parseEvidenciaCitaciones(evidencia([AGENDA_CITACION_ITEM]));
    expect(r.items[0].puntos[0].boletin).toBeNull();
    expect(r.items[0].puntos[0].materia).toBe(
      "Recibir al Alcalde de la comuna de Concepción…",
    );
  });

  it("item no-objeto dentro del array se descarta", () => {
    const r = parseEvidenciaCitaciones(evidencia([null, AGENDA_CITACION_ITEM, "x"]));
    expect(r.items).toHaveLength(1);
  });

  it("{} sin throw", () => {
    expect(() => parseEvidenciaCitaciones({})).not.toThrow();
  });
});

describe("parseEvidenciaSala", () => {
  it("fila sintética de Cámara → scalars null, tabla: [], tabla_total: 25", () => {
    const r = parseEvidenciaSala(evidencia([CAMARA_SALA_SINTETICA]));
    const item = r.items[0];
    expect(item.tipo).toBeNull();
    expect(item.numero).toBeNull();
    expect(item.hora_inicio).toBeNull();
    expect(item.tabla).toEqual([]);
    expect(item.tabla_total).toBe(25);
  });

  it("item de tabla con quorum verbatim (el parse no interpreta)", () => {
    const itemConUrgencia = {
      ...AGENDA_SALA_ITEM,
      tabla: [{ ...AGENDA_SALA_ITEM.tabla[0], quorum: "SUMA (04.08.2026)" }],
    };
    const r = parseEvidenciaSala(evidencia([itemConUrgencia]));
    expect(r.items[0].tabla[0].quorum).toBe("SUMA (04.08.2026)");
  });

  it("{} sin throw", () => {
    expect(() => parseEvidenciaSala({})).not.toThrow();
  });
});

describe("etiquetaFuente", () => {
  it('dataset "tramitacion" → "Tramitación"', () => {
    expect(etiquetaFuente({ dataset: "tramitacion", origen: "plataforma-tramitacion" })).toBe(
      "Tramitación",
    );
  });

  it('dataset "agenda" → "Agenda del Congreso"', () => {
    expect(etiquetaFuente({ dataset: "agenda", origen: "plataforma-agenda" })).toBe(
      "Agenda del Congreso",
    );
  });

  it("dataset y origen null → null (el caller omite el footer, jamás inventa)", () => {
    expect(etiquetaFuente({ dataset: null, origen: null })).toBeNull();
  });

  it("dataset desconocido devuelve el dataset verbatim, no un genérico", () => {
    expect(etiquetaFuente({ dataset: "noticias", origen: "x" })).toBe("noticias");
  });
});

describe("gradoUrgencia", () => {
  it('"Discusión inmediata" → "Discusión inmediata"', () => {
    expect(gradoUrgencia("Discusión inmediata")).toBe("Discusión inmediata");
  });

  it('"SUMA (04.08.2026)" → "Suma" (paréntesis nunca afirmado — R7)', () => {
    expect(gradoUrgencia("SUMA (04.08.2026)")).toBe("Suma");
  });

  it("literal desconocido → fallback honesto al literal, no null", () => {
    expect(gradoUrgencia("literal desconocido")).toBe("literal desconocido");
  });

  it("null → null", () => {
    expect(gradoUrgencia(null)).toBeNull();
  });
});

describe("urgenciaVigentePorBoletin", () => {
  function item(boletin: string | null, fecha: string | null, descripcion: string): ItemProyecto {
    return {
      fecha,
      enlace: null,
      titulo: null,
      boletin,
      en_corpus: false,
      descripcion,
      enlace_evento: null,
    };
  }

  it("boletín con 4 urgencias en fechas distintas → devuelve la de fecha máxima", () => {
    const items = [
      item("14782-13", "2026-01-01", "Simple"),
      item("14782-13", "2026-03-01", "Suma"),
      item("14782-13", "2026-02-01", "Discusión inmediata"),
      item("14782-13", "2026-04-01", "Simple"),
    ];
    const m = urgenciaVigentePorBoletin(items);
    expect(m.get("14782-13")).toEqual({ grado: "Simple", fecha: "2026-04-01" });
  });

  it("18389-04: Simple 2026-07-06 y Suma 2026-07-08 → devuelve Suma/2026-07-08 (por fecha, no por grado)", () => {
    const items = [
      item("18389-04", "2026-07-06", "Simple"),
      item("18389-04", "2026-07-08", "Suma"),
    ];
    const m = urgenciaVigentePorBoletin(items);
    expect(m.get("18389-04")).toEqual({ grado: "Suma", fecha: "2026-07-08" });
  });

  it("misma fecha → desempate determinista por orden de aparición (no aleatorio)", () => {
    const items = [
      item("11111-11", "2026-05-01", "Simple"),
      item("11111-11", "2026-05-01", "Suma"),
    ];
    const m1 = urgenciaVigentePorBoletin(items);
    const m2 = urgenciaVigentePorBoletin(items);
    expect(m1.get("11111-11")).toEqual(m2.get("11111-11"));
    expect(m1.get("11111-11")?.grado).toBe("Suma");
  });

  it("items sin boletín o sin fecha se ignoran", () => {
    const items = [
      item(null, "2026-05-01", "Suma"),
      item("22222-22", null, "Suma"),
    ];
    const m = urgenciaVigentePorBoletin(items);
    expect(m.size).toBe(0);
  });
});
