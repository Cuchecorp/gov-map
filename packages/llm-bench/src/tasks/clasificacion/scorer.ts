/**
 * SCORER DE CLASIFICACIÓN DE SECTOR (106-02) — ¿a qué SECTOR pertenece este input?
 *
 * Reusa VERBATIM el scoring single-label top-1 + abstención de
 * `packages/cruces/src/golden/golden-set.ts`, aplicado al espacio de etiquetas SECTOR:
 *   - `actual === expected`               → CORRECTO.
 *   - `actual === null` (abstención)      → NO-CUBIERTO (baja cobertura; NUNCA error, D-08).
 *   - `actual !== null && ≠ expected`     → MISCLASIFICACIÓN (error real).
 *
 * DECISIÓN (plan Task 3): el enum `SECTOR_CODIGOS` se INLINEA aquí en vez de importar
 * `@obs/cruces` en runtime. Motivo: evitar una dependencia runtime de @obs/llm-bench sobre
 * un paquete de DOMINIO (cruces) solo por 13 literales; el harness debe medir modelos sin
 * arrastrar la lógica de clasificación de dominio. Es una COPIA DELIBERADA de la taxonomía
 * LOCKED de `packages/cruces/src/sector.ts` (seed byte-a-byte de 0038_sector.sql). Si la
 * taxonomía cambiara, ambas listas deben re-sincronizarse (el zod gate rechaza códigos
 * fuera de la lista, así un drift silencioso en el golden rompe el parse).
 *
 * El barrel `src/index.ts` (owner 106-01) ya re-exporta este módulo; 106-02 solo llena el
 * cuerpo, nunca el barrel.
 */
import { z } from "zod";
import casosRaw from "./casos.json" with { type: "json" };

/** Umbral de cobertura del gate de clasificación (espeja cruces COBERTURA_MIN). */
export const COBERTURA_MIN_CLASIF = 0.7;

/**
 * Taxonomía de sectores (COPIA DELIBERADA de @obs/cruces sector.ts — LOCKED, D-04/D-05).
 * 13 macro-sectores anclados en las comisiones permanentes del Congreso. SIN catch-all
 * 'otros' (D-05): la ausencia de sector se modela con `null` (abstención).
 */
export const SECTOR_CODIGOS = [
  "salud",
  "educacion",
  "mineria_energia",
  "medio_ambiente",
  "trabajo_prevision",
  "vivienda_urbanismo",
  "transporte",
  "agricultura_pesca",
  "banca_finanzas",
  "comercio_industria",
  "tecnologia",
  "seguridad_justicia",
  "gremios_trabajadores",
] as const;

/** Un código de sector válido. */
export type SectorCodigo = (typeof SECTOR_CODIGOS)[number];

/** La etiqueta esperada u observada: un sector, o `null` (abstención). */
export type SectorEtiqueta = SectorCodigo | null;

const SectorSchema = z.enum(SECTOR_CODIGOS).nullable();

/** Esquema de un caso del golden de clasificación (compuerta zod: JSON untrusted en disco). */
const CasoClasificacionSchema = z.object({
  id: z.string().min(1),
  /** Idea matriz / nombre de contraparte a clasificar (dato público, sin PII). */
  input: z.string().min(1),
  /** Sector de oro, o `null` cuando la abstención es la respuesta correcta. */
  sector_codigo: SectorSchema,
  /** Estrato (ejes: doc-format|register|length|chamber|negacion|abstencion). */
  estrato: z.string().min(1),
  /** Marca los casos de la MUESTRA curada del gate (todos con sector no-null). */
  muestra: z.boolean().optional(),
});

/** Un caso etiquetado del golden de clasificación. */
export type CasoClasificacion = z.infer<typeof CasoClasificacionSchema>;

/**
 * El golden completo, validado al cargar desde `casos.json` (~40 casos). Un `sector_codigo`
 * fuera de la taxonomía rompe el parse → no se cuela en silencio (drift-guard implícito).
 */
export const GOLDEN_SET_CLASIF: CasoClasificacion[] = z
  .array(CasoClasificacionSchema)
  .parse(casosRaw);

/** La MUESTRA del gate: casos `muestra:true` (todos con sector no-null). */
export const GOLDEN_SET_GATE_CLASIF: CasoClasificacion[] = GOLDEN_SET_CLASIF.filter(
  (c) => c.muestra === true,
);

/**
 * IDs de los casos ADVERSARIOS aislados (meta-test "el gate PUEDE fallar"). Espeja el
 * patrón fichas `IDS_CASOS_ADVERSARIOS`: casos donde el mock asigna el sector equivocado
 * a propósito → la rama de misclasificación es alcanzable, la métrica está VIVA.
 */
export const IDS_CASOS_ADVERSARIOS_CLASIF = ["c01-salud-ficha"] as const;

/** El sub-set adversario: los casos de la muestra marcados como adversarios aislados. */
export const GOLDEN_SET_ADVERSARIO_CLASIF: CasoClasificacion[] = GOLDEN_SET_GATE_CLASIF.filter((c) =>
  (IDS_CASOS_ADVERSARIOS_CLASIF as readonly string[]).includes(c.id),
);

/** Resultado del scoring por caso (para reporting). */
export type ResultadoCasoClasif = "correcto" | "no-cubierto" | "misclasificacion";

/** Métricas de la corrida del golden de clasificación (single-label top-1 + abstención). */
export interface MetricasClasificacion {
  total: number;
  correctos: number;
  /** Abstenciones: bajan cobertura, NUNCA son error. */
  noCubiertos: number;
  /** El modo de fallo real: sector distinto al de oro. */
  misclasificaciones: number;
  cobertura: number;
  /** = misclasificaciones (alias para el gate). */
  errores: number;
  detalle: { id: string; resultado: ResultadoCasoClasif; nota: string }[];
}

/**
 * Evalúa el golden con `ejecutar` por caso (mock en CI, modelo real en 107). Scoring
 * single-label top-1 + abstención IDÉNTICO a cruces sector.
 */
export async function evaluarClasificacion(
  set: CasoClasificacion[],
  ejecutar: (caso: CasoClasificacion) => Promise<SectorEtiqueta>,
): Promise<MetricasClasificacion> {
  let correctos = 0;
  let noCubiertos = 0;
  let misclasificaciones = 0;
  const detalle: { id: string; resultado: ResultadoCasoClasif; nota: string }[] = [];

  for (const caso of set) {
    const actual = await ejecutar(caso);
    const expected = caso.sector_codigo;

    let resultado: ResultadoCasoClasif;
    let nota: string;
    if (actual === null) {
      resultado = "no-cubierto";
      noCubiertos++;
      nota = "abstención (null) → no-cubierto (no es error)";
    } else if (actual === expected) {
      resultado = "correcto";
      correctos++;
      nota = `match exacto (${actual})`;
    } else {
      resultado = "misclasificacion";
      misclasificaciones++;
      nota = `MISCLASIFICACIÓN — esperaba ${expected ?? "null"}, obtuvo ${actual}`;
    }
    detalle.push({ id: caso.id, resultado, nota });
  }

  const total = set.length;
  return {
    total,
    correctos,
    noCubiertos,
    misclasificaciones,
    cobertura: total === 0 ? 1 : correctos / total,
    errores: misclasificaciones,
    detalle,
  };
}

/** Gate: cobertura ≥ COBERTURA_MIN_CLASIF Y cero misclasificaciones. Pura, testeable sin red. */
export function gatePasaClasif(m: MetricasClasificacion): boolean {
  return m.cobertura >= COBERTURA_MIN_CLASIF && m.errores === 0;
}
