// thresholds.ts — SSoT ejecutable de los umbrales D-133-D2 (incluido T9), firmados por el
// operador el 2026-08-06.
//
// `umbrales` es un ARRAY, no un objeto. Dos razones acopladas: (a) la canonicalización de
// `canonicalizar-json.ts` ordena las claves de los objetos planos ascendentemente por code
// unit UTF-16 — con un objeto el orden LOCKED T1,T2,T3,T4,T5,T9,T6,T7,T8 se perdería (T5 < T6
// < T9 alfabéticamente movería T9 antes de T6); (b) los arrays NO se reordenan por el
// canonicalizador, así que el array preserva la secuencia firmada tal cual.
//
// `n_minimo_condicion` existe por T3: su n mínimo en D-133-D2 es "≥3 clases con n≥8", una
// condición compuesta que un `number | null` solo no puede representar. Omitir este campo
// perdería la condición de una decisión firmada dentro del JSON congelado — el modo de fallo
// que esta fase existe para evitar.

/** Efecto de un umbral: veta el paso a producción, o solo informa/desempata. */
export type EfectoUmbral = "veto" | "informativo";

/** Una entrada de la tabla de umbrales D-133-D2. */
export interface Umbral {
  readonly id: string;
  readonly metrica: string;
  readonly umbral: number | null;
  readonly n_minimo: number | null;
  readonly n_minimo_condicion: string | null;
  readonly efecto: EfectoUmbral;
  readonly nota: string;
}

/** Los 4 puntos LOCKED de la regla de intervalos (D-133-D2), uniforme sobre toda cifra. */
export interface ReglaDeIntervalos {
  readonly cifras_con_n_e_ic95: string;
  readonly vetos_sobre_estimacion_puntual: string;
  readonly ic95_cruza_umbral: string;
  readonly desempate_por_solapamiento_ic95: string;
}

/** La refutación pre-registrada, con su refutación parcial sobre T9 (D-133-D2). */
export interface Refutacion {
  readonly texto: string;
  readonly refutacion_parcial: string;
}

/** El objeto congelado completo, con exactamente cuatro claves de primer nivel. */
export interface Thresholds {
  readonly umbrales: readonly Umbral[];
  readonly regla_de_intervalos: ReglaDeIntervalos;
  readonly hipotesis_preregistrada: string;
  readonly refutacion: Refutacion;
}

function congelarProfundo<T extends object>(obj: T): T {
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item !== null && typeof item === "object") Object.freeze(item);
    }
  }
  return Object.freeze(obj);
}

const UMBRALES: readonly Umbral[] = congelarProfundo([
  {
    id: "T1",
    metrica: "tasa_etiqueta_fuera_de_lista",
    umbral: 0.0,
    n_minimo: null,
    n_minimo_condicion: null,
    efecto: "veto",
    nota: "Cualquier etiqueta fuera de las 6 de TAXONOMIA es un veto duro, sin excepción.",
  },
  {
    id: "T2",
    metrica: "tasa_parse_fallido",
    umbral: 0.02,
    n_minimo: null,
    n_minimo_condicion: null,
    efecto: "veto",
    nota: "Máximo 2% de respuestas que no parsean a una etiqueta válida.",
  },
  {
    id: "T3",
    metrica: "exactitud_macro",
    umbral: 0.8,
    n_minimo: 8,
    n_minimo_condicion: "al menos 3 clases con n >= 8",
    efecto: "veto",
    nota:
      "Media de exactitud por clase, calculada solo sobre las clases con n>=8. El umbral " +
      "exige, además del n por clase, que al menos 3 clases alcancen ese piso: al menos 3 " +
      "clases con n >= 8.",
  },
  {
    id: "T4",
    metrica: "recall_tramitacion_legislativa",
    umbral: 0.85,
    n_minimo: 25,
    n_minimo_condicion: null,
    efecto: "veto",
    nota:
      "Veto si n>=25; si n<25 el resultado se marca no-medido y la clase no enruta a " +
      "producción hasta alcanzar el n mínimo.",
  },
  {
    id: "T5",
    metrica: "precision_no_legislativa",
    umbral: 0.9,
    n_minimo: 25,
    n_minimo_condicion: null,
    efecto: "veto",
    nota:
      "Veto si n>=25; si n<25 el resultado se marca no-medido y la clase no enruta a " +
      "producción hasta alcanzar el n mínimo.",
  },
  {
    id: "T9",
    metrica: "precision_actividad_parlamentaria",
    umbral: 0.9,
    n_minimo: 25,
    n_minimo_condicion: null,
    efecto: "veto",
    nota:
      "Veto nuevo (D-133-D2) que protege el enrutamiento a ficha de persona. Si n>=25 se " +
      "evalúa como veto; si n<25 el resultado se marca no-medido y el enrutamiento a fichas " +
      "de persona no entra a producción.",
  },
  {
    id: "T6",
    metrica: "costo_usd_por_100_items",
    umbral: 0.05,
    n_minimo: null,
    n_minimo_condicion: null,
    efecto: "informativo",
    nota: "Desempata entre candidatos que ya pasaron los vetos; no bloquea por sí solo.",
  },
  {
    id: "T7",
    metrica: "latencia_p50_ms",
    umbral: 5000,
    n_minimo: null,
    n_minimo_condicion: null,
    efecto: "informativo",
    nota: "Desempata entre candidatos que ya pasaron los vetos; no bloquea por sí solo.",
  },
  {
    id: "T8",
    metrica: "tasa_ambiguo_modelo_vs_tasa_ambiguo_humano",
    umbral: null,
    n_minimo: null,
    n_minimo_condicion: null,
    efecto: "informativo",
    nota: "Comparación descriptiva entre la tasa de ambiguo del modelo y la del humano.",
  },
]);

const REGLA_DE_INTERVALOS: ReglaDeIntervalos = congelarProfundo({
  cifras_con_n_e_ic95: "Toda cifra reportada se acompaña de su n y su intervalo de confianza 95%.",
  vetos_sobre_estimacion_puntual: "Los vetos se evalúan sobre la estimación puntual, no sobre el IC95.",
  ic95_cruza_umbral:
    "Si el IC95 cruza el umbral, el veredicto se marca dentro-del-ruido, citando ambos números " +
    "(estimación puntual y el borde del IC95 que cruza).",
  desempate_por_solapamiento_ic95:
    "El desempate entre candidatos usa el solapamiento de sus IC95, no una constante fija de " +
    "6 puntos porcentuales.",
});

const HIPOTESIS_PREREGISTRADA: string =
  "El modelo candidato iguala o supera al incumbente en los umbrales de veto (T1-T5, T9) " +
  "con evidencia estadística suficiente (n>=25 donde aplica), y los umbrales informativos " +
  "(T6-T8) se usan solo para desempatar entre candidatos que ya pasaron los vetos.";

const REFUTACION: Refutacion = congelarProfundo({
  texto:
    "Si cualquier umbral de veto (T1-T5, T9) falla sobre la estimación puntual con n " +
    "suficiente, o queda dentro-del-ruido de forma persistente, el candidato NO reemplaza al " +
    "incumbente.",
  refutacion_parcial:
    "Si T9 falla, o queda no-medido por n<25, el enrutamiento a fichas de persona NO entra a " +
    "producción, aunque el resto de los umbrales apruebe.",
});

/** El objeto congelado de umbrales, con Object.freeze anidado sobre el array y cada entrada. */
export const THRESHOLDS: Thresholds = congelarProfundo({
  umbrales: UMBRALES,
  regla_de_intervalos: REGLA_DE_INTERVALOS,
  hipotesis_preregistrada: HIPOTESIS_PREREGISTRADA,
  refutacion: REFUTACION,
});
