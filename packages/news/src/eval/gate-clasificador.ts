// gate-clasificador.ts — el gate que decide si un clasificador PASA la vara congelada
// (Phase 135, SC1; thresholds D-133-D2 firmados). Matemática pura, sin red.
//
// Reglas LOCKED que este módulo implementa tal cual:
// - Vetos sobre la ESTIMACIÓN PUNTUAL; si el IC95 cruza el umbral, el veredicto se marca
//   `dentro_del_ruido` (aprueba o veta igual, pero jamás se presenta como resultado limpio).
// - T3 = exactitud MACRO (media de exactitud por clase sobre clases con n≥8; exige ≥3).
// - T4/T9: bajo su n mínimo NO vetan — quedan `no-medido` y la clase NO ENRUTA (fail-closed;
//   en este golden tramitacion n=22 y actividad n=6 ⇒ ambos no-medidos por construcción).
// - `ambiguo` del golden se excluye del denominador de exactitud (C2.5) — este golden trae 0.
// - Cero vacuo prohibido: resultados vacíos o cobertura ≠ golden ⇒ THROW, jamás un veredicto.

import { ETIQUETAS } from "./taxonomia.js";
import { ic95Proporcion } from "./kappa.js";
import { THRESHOLDS } from "./thresholds.js";

export interface ResultadoCaso {
  caso_id: string;
  /** Etiqueta emitida por el clasificador; null = parse fallido (insumo de T2). */
  etiqueta: string | null;
}

export interface CasoDorado {
  caso_id: string;
  etiqueta: string;
}

export interface MetricaEvaluada {
  id: string;
  metrica: string;
  valor: number | null;
  n: number;
  umbral: number | null;
  ic95: { inf: number; sup: number } | null;
  estado: "pasa" | "veta" | "no-medido" | "informativo";
  dentro_del_ruido: boolean;
}

export interface VeredictoClasificador {
  n: number;
  metricas: MetricaEvaluada[];
  exactitud_por_clase: Record<string, { exactitud: number; n: number }>;
  aprueba: boolean;
  clases_no_medidas: string[];
}

const LEGALES = new Set<string>(ETIQUETAS);

/** Umbral numérico DESDE los thresholds congelados — jamás un literal duplicado (hallazgo
 * H5 de la verificación 135: el freeze del JSON protegía el JSON, no su uso). */
function umbralDe(id: string): number {
  const u = THRESHOLDS.umbrales.find((x) => x.id === id);
  if (!u || u.umbral === null || u.efecto !== "veto") {
    throw new Error(`gate-clasificador: umbral ${id} ausente o no-veto en THRESHOLDS — gate desincronizado`);
  }
  return u.umbral;
}

function metrica(
  id: string,
  nombre: string,
  exitos: number,
  n: number,
  umbral: number,
  direccion: "max" | "min",
): MetricaEvaluada {
  const valor = exitos / n;
  const ic = ic95Proporcion(exitos, n);
  const pasa = direccion === "max" ? valor <= umbral : valor >= umbral;
  const dentroDelRuido = ic.inf <= umbral && umbral <= ic.sup && valor !== umbral;
  return {
    id,
    metrica: nombre,
    valor,
    n,
    umbral,
    ic95: ic,
    estado: pasa ? "pasa" : "veta",
    dentro_del_ruido: dentroDelRuido,
  };
}

export function evaluarClasificador(
  resultados: readonly ResultadoCaso[],
  golden: readonly CasoDorado[],
): VeredictoClasificador {
  if (golden.length === 0) throw new Error("gate-clasificador: golden vacío (cero vacuo)");
  if (resultados.length === 0) throw new Error("gate-clasificador: resultados vacíos (cero vacuo)");

  const dorado = new Map(golden.map((c) => [c.caso_id, c.etiqueta]));
  const vistos = new Set<string>();
  for (const r of resultados) {
    if (!dorado.has(r.caso_id)) {
      throw new Error(`gate-clasificador: resultado para caso desconocido "${r.caso_id}"`);
    }
    if (vistos.has(r.caso_id)) {
      throw new Error(`gate-clasificador: caso duplicado "${r.caso_id}"`);
    }
    vistos.add(r.caso_id);
  }
  if (vistos.size !== dorado.size) {
    throw new Error(
      `gate-clasificador: cobertura incompleta (${vistos.size}/${dorado.size}) — el gate exige el golden completo`,
    );
  }

  const n = resultados.length;
  const metricas: MetricaEvaluada[] = [];
  const clasesNoMedidas: string[] = [];

  // T1: etiqueta fuera de lista (sobre las no-null; una emisión null es T2, no T1).
  const fueraDeLista = resultados.filter((r) => r.etiqueta !== null && !LEGALES.has(r.etiqueta)).length;
  metricas.push(metrica("T1", "tasa_etiqueta_fuera_de_lista", fueraDeLista, n, umbralDe("T1"), "max"));

  // T2: parse fallido.
  const parseFallido = resultados.filter((r) => r.etiqueta === null).length;
  metricas.push(metrica("T2", "tasa_parse_fallido", parseFallido, n, umbralDe("T2"), "max"));

  // Exactitud por clase (excluyendo `ambiguo` dorado del denominador, C2.5).
  const porClase: Record<string, { aciertos: number; n: number }> = {};
  for (const r of resultados) {
    const oro = dorado.get(r.caso_id)!;
    if (oro === "ambiguo") continue;
    porClase[oro] = porClase[oro] ?? { aciertos: 0, n: 0 };
    porClase[oro]!.n += 1;
    if (r.etiqueta === oro) porClase[oro]!.aciertos += 1;
  }
  const exactitudPorClase: Record<string, { exactitud: number; n: number }> = {};
  for (const [clase, c] of Object.entries(porClase)) {
    exactitudPorClase[clase] = { exactitud: c.aciertos / c.n, n: c.n };
  }

  // T3: macro sobre clases con n≥8; exige ≥3 clases elegibles.
  const elegibles = Object.entries(exactitudPorClase).filter(([, v]) => v.n >= 8);
  if (elegibles.length < 3) {
    throw new Error(
      `gate-clasificador: T3 inevaluable — solo ${elegibles.length} clases con n>=8 (exige >=3)`,
    );
  }
  const macro = elegibles.reduce((s, [, v]) => s + v.exactitud, 0) / elegibles.length;
  const umbralT3 = umbralDe("T3");
  const nMacro = elegibles.reduce((s, [, v]) => s + v.n, 0);
  const icMacro = ic95Proporcion(Math.round(macro * nMacro), nMacro); // aproximación declarada
  metricas.push({
    id: "T3",
    metrica: "exactitud_macro",
    valor: macro,
    n: nMacro,
    umbral: umbralT3,
    ic95: icMacro,
    estado: macro >= umbralT3 ? "pasa" : "veta",
    dentro_del_ruido: icMacro.inf <= umbralT3 && umbralT3 <= icMacro.sup,
  });

  // T4 recall tramitacion / T9 precision actividad: n mínimo 25 (no alcanzado en este
  // golden ⇒ no-medido, la clase no enruta). T5 precision no_legislativa: n≥25 sí alcanza.
  const evaluarClaseVeto = (
    id: string,
    nombre: string,
    clase: string,
    tipo: "recall" | "precision",
    umbral: number,
  ) => {
    const nClase = porClase[clase]?.n ?? 0;
    if (nClase < 25) {
      metricas.push({
        id,
        metrica: nombre,
        valor: null,
        n: nClase,
        umbral,
        ic95: null,
        estado: "no-medido",
        dentro_del_ruido: false,
      });
      clasesNoMedidas.push(clase);
      return;
    }
    let exitos: number;
    let denominador: number;
    if (tipo === "recall") {
      exitos = porClase[clase]!.aciertos;
      denominador = nClase;
    } else {
      const predichos = resultados.filter((r) => r.etiqueta === clase);
      denominador = predichos.length;
      exitos = predichos.filter((r) => dorado.get(r.caso_id) === clase).length;
      if (denominador === 0) {
        metricas.push({
          id,
          metrica: nombre,
          valor: null,
          n: 0,
          umbral,
          ic95: null,
          estado: "no-medido",
          dentro_del_ruido: false,
        });
        clasesNoMedidas.push(clase);
        return;
      }
    }
    metricas.push(metrica(id, nombre, exitos, denominador, umbral, "min"));
  };

  evaluarClaseVeto("T4", "recall_tramitacion_legislativa", "tramitacion_legislativa", "recall", umbralDe("T4"));
  evaluarClaseVeto("T5", "precision_no_legislativa", "no_legislativa", "precision", umbralDe("T5"));
  evaluarClaseVeto("T9", "precision_actividad_parlamentaria", "actividad_parlamentaria", "precision", umbralDe("T9"));

  const aprueba = metricas.every((m) => m.estado !== "veta");
  return { n, metricas, exactitud_por_clase: exactitudPorClase, aprueba, clases_no_medidas: [...new Set(clasesNoMedidas)] };
}

/** Sanity de sincronía con los thresholds congelados: los ids de veto que este gate evalúa
 * deben existir en THRESHOLDS con efecto veto. Se corre en tests, no en producción. */
export function idsDeVetoEvaluados(): string[] {
  const evaluados = ["T1", "T2", "T3", "T4", "T5", "T9"];
  const congelados = new Set(
    THRESHOLDS.umbrales.filter((u) => u.efecto === "veto").map((u) => u.id),
  );
  return evaluados.filter((id) => congelados.has(id));
}
