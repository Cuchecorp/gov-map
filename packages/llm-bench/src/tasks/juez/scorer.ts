/**
 * SCORER DE JUEZ/VALIDACIÓN (106-03) — accuracy CONDICIONAL vs etiqueta HUMANA.
 *
 * El golden del juez son pares `(answer, human_label)` (§ Judge-Set Methodology): cada caso es
 * una RESPUESTA a una tarea (un sector propuesto, una idea_matriz propuesta) + un veredicto
 * HUMANO `human_label` = "¿esta respuesta es realmente correcta?". El juez bajo prueba emite su
 * propio veredicto OK/rechazo; se compara contra la etiqueta HUMANA, NUNCA contra el responder
 * (T-106-09: medir vs humano evita la falsa paridad).
 *
 * MÉTRICA CONDICIONAL (Pitfall 1/2 — la que importa):
 *   - precisión-del-OK = P(answer correcta | el juez dice OK) = correctas-entre-OK / #OK.
 *   - recall-de-rechazo = P(el juez rechaza | answer incorrecta) = rechazadas-entre-malas / #malas.
 * Un juez sello-de-goma (siempre OK) obtiene recall-de-rechazo ≈ 0 → queda EXPUESTO.
 *
 * HOOKS de sesgo (definidos+congelados en 106; MEDIDOS en 107, no interpretados aquí):
 *   - self-preference: `producer` (familia de modelo que produjo el answer) → verdict-rate-by-producer.
 *   - verbosity: `answerLen` (longitud) → correlación veredicto/longitud.
 *   - position: `orderings` (ambos órdenes A/B) para casos pareados → sensibilidad al orden.
 *
 * SPLIT DE CALIBRACIÓN: `split: "scoring" | "calibracion"`. El scoring usa SOLO el split de
 * scoring; el split de calibración queda RESERVADO y DISJUNTO (el fit isotónica/Platt es 107).
 * El `Reporte` deja un slot para la curva de confiabilidad, VACÍO en 106.
 *
 * NOTA barrel: `src/index.ts` (owner 106-01) hace `export *` en un namespace PLANO → los
 * símbolos compartidos llevan SUFIJO `_JUEZ` (convención 106-02: `_ROUTING`/`_CLASIF`/`_EXTRACCION`).
 * El juez es ESCALATE-ONLY por diseño (nunca aprueba) — pero esa composición es 108/TIER; 106
 * solo mide acuerdo veredicto-vs-humano. 106-03 solo llena este cuerpo, NUNCA el barrel.
 */
import { z } from "zod";
import casosRaw from "./casos.json" with { type: "json" };

/** Los dos splits del golden del juez: el que puntúa vs el reservado a calibración (disjuntos). */
export const SPLITS_JUEZ = ["scoring", "calibracion"] as const;
export type SplitJuez = (typeof SPLITS_JUEZ)[number];

/** Un par ordenado (para el hook de sesgo de posición en juicio pareado). */
const OrderingSchema = z.tuple([z.string().min(1), z.string().min(1)]);

/** Esquema de un caso del golden de juez (compuerta zod: JSON untrusted en disco). */
const CasoJuezSchema = z.object({
  id: z.string().min(1),
  /** La RESPUESTA bajo juicio (salida de una tarea, sin PII). */
  answer: z.string().min(1),
  /** Veredicto HUMANO: ¿la respuesta es realmente correcta? (ground truth contra la que se mide). */
  human_label: z.boolean(),
  /** HOOK self-preference: familia de modelo que produjo el answer (medido en 107). */
  producer: z.string().min(1),
  /** HOOK verbosity: longitud del answer (medido en 107). */
  answerLen: z.number().int().nonnegative(),
  /** HOOK position (opcional): ambos órdenes para juicio pareado (medido en 107). */
  orderings: OrderingSchema.optional(),
  /** Split held-out: "scoring" puntúa; "calibracion" reservado a 107 (disjunto de scoring). */
  split: z.enum(SPLITS_JUEZ),
  /** Estrato (ejes: doc-format|register|length|chamber|negacion|tarea). */
  estrato: z.string().min(1),
  /** Marca los casos de la MUESTRA curada (informativa). */
  muestra: z.boolean().optional(),
});

/** Un caso del golden de juez: un par (answer, human_label) con hooks de sesgo + split. */
export type CasoJuez = z.infer<typeof CasoJuezSchema>;

/**
 * El golden completo, validado al cargar desde `casos.json` (~40 casos). Un caso mal formado o
 * un split fuera del enum rompe el parse → no se cuela en silencio.
 */
export const GOLDEN_SET_JUEZ: CasoJuez[] = z.array(CasoJuezSchema).parse(casosRaw);

/** El split de SCORING: los únicos casos sobre los que se computa la métrica condicional. */
export const GOLDEN_SET_SCORING_JUEZ: CasoJuez[] = GOLDEN_SET_JUEZ.filter(
  (c) => c.split === "scoring",
);

/** El split de CALIBRACIÓN: reservado a 107 (fit isotónica/Platt). Disjunto del de scoring. */
export const GOLDEN_SET_CALIBRACION_JUEZ: CasoJuez[] = GOLDEN_SET_JUEZ.filter(
  (c) => c.split === "calibracion",
);

/**
 * IDs de los casos ADVERSARIOS aislados (meta-test "el gate PUEDE fallar"): respuestas MALAS
 * (human_label:false) que un juez sello-de-goma aprobaría → la rama de recall-de-rechazo es
 * alcanzable, la métrica está VIVA.
 */
export const IDS_CASOS_ADVERSARIOS_JUEZ = [
  "j-adv01-sector-fabricado",
  "j-adv02-idea-alucinada",
] as const;

/** El sub-set adversario: los casos marcados como adversarios aislados. */
export const GOLDEN_SET_ADVERSARIO_JUEZ: CasoJuez[] = GOLDEN_SET_JUEZ.filter((c) =>
  (IDS_CASOS_ADVERSARIOS_JUEZ as readonly string[]).includes(c.id),
);

/** Agregados de los hooks de sesgo (poblados en 106, INTERPRETADOS en 107). */
export interface HooksSesgoJuez {
  /** Veredicto-OK-rate por familia de modelo productora (self-preference). */
  porProductor: Record<string, { ok: number; total: number }>;
  /** Veredictos y longitud media, en tramos de longitud (verbosity). */
  porLongitud: { corta: { ok: number; total: number }; larga: { ok: number; total: number } };
}

/**
 * Métricas condicionales del juez. `precision_ok` y `recall_rechazo` son campos SEPARADOS: un
 * juez sello-de-goma tiene precisión-del-OK ≈ tasa-base pero recall-de-rechazo ≈ 0.
 */
export interface MetricasJuez {
  /** #casos del split de scoring evaluados. */
  n: number;
  /** P(answer correcta | juez dice OK). null si el juez nunca dijo OK. */
  precision_ok: number | null;
  /** P(juez rechaza | answer incorrecta). null si no había answers incorrectas. */
  recall_rechazo: number | null;
  /** Conteos crudos para trazabilidad. */
  conteos: { okYCorrecta: number; ok: number; rechazoYMala: number; malas: number };
  /** Hooks de sesgo agregados (no interpretados en 106). */
  hooks: HooksSesgoJuez;
  detalle: { id: string; veredictoJuez: boolean; human_label: boolean; nota: string }[];
}

/** El juez bajo prueba: dado el answer del caso, devuelve OK (`true`) o rechazo (`false`). */
export type JuzgarFn = (caso: CasoJuez) => Promise<boolean>;

/** Umbral de tramo de longitud para el hook de verbosity (informativo; 107 puede recalibrar). */
const UMBRAL_LONGITUD = 160;

/**
 * Evalúa el juez sobre el split de SCORING (o el set que se pase) computando accuracy CONDICIONAL
 * vs la etiqueta HUMANA, más los hooks de sesgo agregados (sin interpretar). NUNCA compara contra
 * el responder — solo contra `human_label`.
 */
export async function evaluarJuez(set: CasoJuez[], juzgar: JuzgarFn): Promise<MetricasJuez> {
  let okYCorrecta = 0;
  let ok = 0;
  let rechazoYMala = 0;
  let malas = 0;
  const porProductor: Record<string, { ok: number; total: number }> = {};
  const porLongitud = {
    corta: { ok: 0, total: 0 },
    larga: { ok: 0, total: 0 },
  };
  const detalle: MetricasJuez["detalle"] = [];

  for (const caso of set) {
    const veredicto = await juzgar(caso); // true = OK, false = rechazo
    const correcta = caso.human_label;

    if (veredicto) {
      ok++;
      if (correcta) okYCorrecta++;
    }
    if (!correcta) {
      malas++;
      if (!veredicto) rechazoYMala++;
    }

    // ── HOOK self-preference (por productor) ──
    porProductor[caso.producer] ??= { ok: 0, total: 0 };
    porProductor[caso.producer]!.total++;
    if (veredicto) porProductor[caso.producer]!.ok++;

    // ── HOOK verbosity (por tramo de longitud) ──
    const tramo = caso.answerLen >= UMBRAL_LONGITUD ? porLongitud.larga : porLongitud.corta;
    tramo.total++;
    if (veredicto) tramo.ok++;

    detalle.push({
      id: caso.id,
      veredictoJuez: veredicto,
      human_label: correcta,
      nota:
        veredicto === correcta
          ? `acuerdo con humano (${veredicto ? "OK" : "rechazo"})`
          : `DESACUERDO — juez ${veredicto ? "OK" : "rechazó"}, humano ${correcta ? "correcta" : "incorrecta"}`,
    });
  }

  return {
    n: set.length,
    precision_ok: ok === 0 ? null : okYCorrecta / ok,
    recall_rechazo: malas === 0 ? null : rechazoYMala / malas,
    conteos: { okYCorrecta, ok, rechazoYMala, malas },
    hooks: { porProductor, porLongitud },
    detalle,
  };
}

/**
 * Un bin de la curva de confiabilidad (calibración): confianza predicha vs accuracy observada.
 * En 106 el arreglo de bins queda VACÍO (slot reservado); el fit isotónica/Platt + el diagrama
 * de confiabilidad es una MEDICIÓN de 107 sobre el split de calibración.
 */
export interface BinConfiabilidadJuez {
  /** Límite inferior del bin de confianza predicha [0,1). */
  confianzaMin: number;
  /** Límite superior del bin de confianza predicha (,1]. */
  confianzaMax: number;
  /** Accuracy observada dentro del bin (poblada en 107). */
  accuracyObservada: number;
  /** #muestras en el bin (poblado en 107). */
  n: number;
}

/**
 * Slot de la curva de confiabilidad para el Reporte. En 106 se devuelve VACÍO a propósito:
 * define el contrato del dato sin fittear nada (T-106-10: 106 deja el split + el slot; 107 fitea).
 */
export function slotCurvaConfiabilidadJuez(): BinConfiabilidadJuez[] {
  return [];
}
