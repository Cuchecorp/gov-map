// calibracion.ts — selección determinista de los 20 casos de calibración a ciegas
// (D-133-C2.1.2, D-133b-5) + esquema estricto del artefacto ciego + guard de ceguera.
//
// El operador etiqueta 20 casos A CIEGAS, ANTES de ver ninguna etiqueta de máquina. Es el
// control positivo apareado que hace interpretable el κ de toda la fase: sin él,
// κ(humano↔máquina) sería κ(máquina↔máquina) — el falso verde estructural exacto que D-133-C2
// existe para evitar.
//
// La estratificación es por ESTRATO DE MUESTREO Y OUTLET, NO por clase: estratificar por
// clase exigiría conocer la clase, que es justo lo que se quiere medir. Cubrir las 6
// etiquetas es expectativa declarada, no garantía; si alguna clase queda sin representación
// humana, se reporta y κ se interpreta sobre las clases presentes (D-133b-5). Estos 20 se
// congelan ANTES de correr los anotadores para que nadie pueda elegirlos mirando dónde las
// máquinas coincidieron.
//
// D-133b-6: cooperativa (n=1 en el censo) se DECLARA, no se corrige — no se sobre-muestrea
// para "equilibrar" (rompería el censo, el único estrato con prevalencia honesta) ni se
// ablanda el pre-filtro (prefiltro-lexico.ts:6-9).

import { z } from "zod";
import { SEMILLA, prngDeSemilla, ordenarPorHash } from "./muestreo.js";
import { TAXONOMIA } from "./taxonomia.js";

export { SEMILLA };

/** Reflejo de una entrada de `muestra-133b.json` — lo mínimo que necesita la selección. */
export interface CasoMuestraCalib {
  caso_id: string;
  url_hash: string;
  outlet: string;
  estrato: "P" | "N-sonda" | "N-alea";
  /** Opcional: `muestra-133b.json` no la trae (solo el ledger), pero el test de no-filtrado
   * (D-133b-5/P-04) la pasa sintéticamente para probar que `seleccionarCalibracion` nunca la
   * usa como criterio — la selección es SOLO por estrato/outlet, jamás por contenido. */
  descripcion?: string | null;
}

/**
 * Fisher-Yates COMPLETO consumiendo el PRNG — RÉPLICA deliberada del barajado de
 * `muestreo.ts` (no exportado allí, así que no se puede importar). Nunca un comparador con
 * signo aleatorio: eso no es un barajado uniforme y depende del algoritmo del runtime.
 */
function barajar<T>(lista: readonly T[], prng: () => number): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    const tmp = copia[i]!;
    copia[i] = copia[j]!;
    copia[j] = tmp;
  }
  return copia;
}

/**
 * Calcula la cuota de los 12 casos de `P` por outlet, en dos pasos deterministas
 * (D-133b-5): (1) piso de 1 por cada outlet que aporta al censo; (2) el resto del cupo se
 * asigna, una unidad a la vez, al outlet con mayor DÉFICIT respecto de su cuota proporcional
 * (`totalP * n_outlet / totalCenso`) — desempate por nombre de outlet ASCENDENTE, comparador
 * explícito (PROHIBIDO un método de comparación sensible a locale). No se hardcodea el
 * objeto resultado: se calcula
 * siempre desde el censo real que se le pase. LANZA si `totalP` no alcanza para dar piso 1 a
 * cada outlet que aporta.
 */
export function CUOTA_P(
  censoPorOutlet: Readonly<Record<string, number>>,
  totalP: number,
): Record<string, number> {
  const outlets = Object.keys(censoPorOutlet).filter((o) => (censoPorOutlet[o] ?? 0) > 0);
  if (outlets.length === 0) {
    throw new Error("CUOTA_P: censo vacío — no hay outlets que aporten");
  }
  if (totalP < outlets.length) {
    throw new Error(
      `CUOTA_P: totalP (${totalP}) no alcanza para dar piso 1 a los ${outlets.length} outlets`,
    );
  }
  const totalCenso = outlets.reduce((s, o) => s + (censoPorOutlet[o] ?? 0), 0);
  const prop: Record<string, number> = {};
  for (const o of outlets) prop[o] = (totalP * (censoPorOutlet[o] ?? 0)) / totalCenso;

  const cuota: Record<string, number> = {};
  for (const o of outlets) cuota[o] = 1;

  let restante = totalP - outlets.length;
  while (restante > 0) {
    let mejorOutlet: string | null = null;
    let mejorDeficit = -Infinity;
    for (const o of outlets) {
      const deficit = prop[o]! - cuota[o]!;
      if (
        mejorOutlet === null ||
        deficit > mejorDeficit ||
        (deficit === mejorDeficit && o < mejorOutlet)
      ) {
        mejorOutlet = o;
        mejorDeficit = deficit;
      }
    }
    cuota[mejorOutlet!] = (cuota[mejorOutlet!] ?? 0) + 1;
    restante -= 1;
  }
  return cuota;
}

export interface SeleccionarCalibracionOpts {
  muestra: readonly CasoMuestraCalib[];
  semilla: string;
}

/** `nSonda`/`nAlea`/`nPTotal` de D-133b-5, congelados como constantes del módulo (no magia
 * repetida en el cuerpo de la función). */
const N_P_TOTAL = 12;
const N_ALEA = 5;
const N_SONDA = 3;

/**
 * Selecciona los 20 `caso_id` de calibración: 12 de `P` (cuota por outlet vía `CUOTA_P`), 5 de
 * `N-alea`, 3 de `N-sonda`. Determinista (misma semilla ⇒ misma lista de 20; semilla distinta
 * ⇒ lista distinta). Los 20 son disjuntos por construcción: cada sub-estrato se sortea sobre
 * su propio conjunto, y los conjuntos de `muestra-133b.json` ya son disjuntos entre sí. El
 * estrato de origen NO viaja al resultado — solo se usa internamente. No filtra por
 * descripción. LANZA si un sub-estrato no tiene elegibles suficientes.
 */
export function seleccionarCalibracion(opts: SeleccionarCalibracionOpts): string[] {
  const { muestra, semilla } = opts;

  const casosP = muestra.filter((c) => c.estrato === "P");
  const casosAlea = muestra.filter((c) => c.estrato === "N-alea");
  const casosSonda = muestra.filter((c) => c.estrato === "N-sonda");

  const censoPorOutlet: Record<string, number> = {};
  for (const c of casosP) censoPorOutlet[c.outlet] = (censoPorOutlet[c.outlet] ?? 0) + 1;
  const cuota = CUOTA_P(censoPorOutlet, N_P_TOTAL);

  const seleccionP: string[] = [];
  for (const outlet of Object.keys(cuota)) {
    const candidatos = casosP.filter((c) => c.outlet === outlet);
    const n = cuota[outlet]!;
    if (candidatos.length < n) {
      throw new Error(
        `seleccionarCalibracion: outlet "${outlet}" tiene ${candidatos.length} candidatos < cuota ${n}`,
      );
    }
    const barajados = barajar(ordenarPorHash(candidatos), prngDeSemilla(`${semilla}:calib:P:${outlet}`));
    seleccionP.push(...barajados.slice(0, n).map((c) => c.caso_id));
  }

  if (casosAlea.length < N_ALEA) {
    throw new Error(`seleccionarCalibracion: N-alea tiene ${casosAlea.length} < ${N_ALEA} pedidos`);
  }
  const aleaBarajada = barajar(ordenarPorHash(casosAlea), prngDeSemilla(`${semilla}:calib:alea`));
  const seleccionAlea = aleaBarajada.slice(0, N_ALEA).map((c) => c.caso_id);

  if (casosSonda.length < N_SONDA) {
    throw new Error(`seleccionarCalibracion: N-sonda tiene ${casosSonda.length} < ${N_SONDA} pedidos`);
  }
  const sondaBarajada = barajar(ordenarPorHash(casosSonda), prngDeSemilla(`${semilla}:calib:sonda`));
  const seleccionSonda = sondaBarajada.slice(0, N_SONDA).map((c) => c.caso_id);

  return [...seleccionP, ...seleccionAlea, ...seleccionSonda];
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Artefacto a ciegas: esquema + guard de ceguera (D-133-C2.1.2, D-133-G)
// ─────────────────────────────────────────────────────────────────────────────────────────

/** Allowlist ESTRUCTURAL: exactamente 5 claves por caso. `.strict()` — cualquier clave extra
 * hace fallar la validación (control 1 del doble candado). */
export const ItemCiegoSchema = z
  .object({
    id: z.string().min(1),
    titulo: z.string(),
    descripcion: z.string(),
    outlet: z.string().min(1),
    fecha: z.string().nullable(),
  })
  .strict();

export type ItemCiego = z.infer<typeof ItemCiegoSchema>;

const GlosaClaseSchema = z
  .object({
    etiqueta: z.string(),
    definicion: z.string(),
    marca_decisoria: z.string(),
    frontera: z.string(),
  })
  .strict();

export const ArtefactoCiegoSchema = z
  .object({
    semilla: z.string(),
    ventana: z.string(),
    glosa: z.array(GlosaClaseSchema),
    casos: z.array(ItemCiegoSchema).length(20),
  })
  .strict();

export type ArtefactoCiego = z.infer<typeof ArtefactoCiegoSchema>;

/**
 * Deriva la glosa del artefacto ciego DIRECTAMENTE de `TAXONOMIA` — jamás se re-escribe a
 * mano. Solo expone `etiqueta`/`definicion`/`marca_decisoria`/`frontera`: `enruta_a` no viaja
 * (es un detalle de enrutamiento a fichas, irrelevante para decidir la etiqueta).
 */
export function derivarGlosa(): Array<z.infer<typeof GlosaClaseSchema>> {
  return TAXONOMIA.map((c) => ({
    etiqueta: c.etiqueta,
    definicion: c.definicion,
    marca_decisoria: c.marca_decisoria,
    frontera: c.frontera,
  }));
}

/**
 * Denylist de claves de MÁQUINA (D-133-C2.1.2/D-133-G): cualquier campo de veredicto,
 * procedencia técnica o identificador interno que revelaría el estrato o el juicio de un
 * modelo. **NO contiene `etiqueta` a secas** — es la clave con la que la glosa nombra las 6
 * clases (`taxonomia.ts:35`), y sin ella el operador no podría etiquetar. La no-sobre-amplitud
 * es una propiedad de ESTA LISTA, no del alcance del escaneo (ver `verificarCeguera`).
 */
export const CLAVES_DE_MAQUINA: readonly string[] = Object.freeze([
  "etiqueta_a",
  "etiqueta_b",
  "etiqueta_humana",
  "justificacion_a",
  "justificacion_b",
  "acuerdo",
  "resuelto_por",
  "modelo_a",
  "modelo_b",
  "en_calibracion_humana",
  "prefiltro",
  "terminos",
  "estrato",
  "paso",
  "causa",
  "estado",
  "url_hash",
  "url_canonica",
  "r2_path",
  "caso_id",
]);

export interface VerificarCegueraResultado {
  objetosEscaneados: number;
  clavesEscaneadas: number;
}

/**
 * Escanea el ARTEFACTO COMPLETO (`casos[]` + `glosa` + metadatos como `semilla`/`ventana`)
 * RECURSIVAMENTE, a cualquier profundidad, y LANZA si aparece cualquier clave de
 * `CLAVES_DE_MAQUINA`. Restringir el escaneo a `casos[]` dejaría la glosa fuera del alcance y
 * volvería INEJECUTABLE el control de no-sobre-amplitud (añadir `etiqueta` a la denylist no
 * rompería ningún test, y nadie sabría que el guard dejó de distinguir un veredicto de un
 * nombre de clase) — y además dejaría pasar libre un campo de máquina colado en los
 * metadatos, fuera de `casos[]`.
 *
 * El guard NO se dispara por la glosa porque `etiqueta` no está en la denylist — no porque la
 * glosa quede fuera del escaneo. La allowlist (`ItemCiegoSchema.strict()`) y esta denylist son
 * un DOBLE CANDADO: la allowlist sola no cubre los metadatos, y no sobrevive a un esquema laxo
 * que alguien sustituya; la denylist sola no cubre una clave de máquina con nombre nuevo.
 *
 * `casos: []` (o el artefacto vacío) LANZA — un guard que "pasa" sobre cero casos no probó
 * nada (cero vacuo). Además exige un piso: ≥ 20 objetos escaneados y ≥ 100 claves inspeccionadas.
 */
export function verificarCeguera(artefacto: unknown): VerificarCegueraResultado {
  const raiz = artefacto as { casos?: unknown[] } | null | undefined;
  if (raiz == null || !Array.isArray(raiz.casos) || raiz.casos.length === 0) {
    throw new Error("verificarCeguera: artefacto sin casos — el guard no puede pasar sobre cero casos");
  }

  const denylist = new Set(CLAVES_DE_MAQUINA);
  let objetosEscaneados = 0;
  let clavesEscaneadas = 0;

  function recorrer(valor: unknown): void {
    if (Array.isArray(valor)) {
      for (const el of valor) recorrer(el);
      return;
    }
    if (valor !== null && typeof valor === "object") {
      objetosEscaneados += 1;
      for (const clave of Object.keys(valor as Record<string, unknown>)) {
        clavesEscaneadas += 1;
        if (denylist.has(clave)) {
          throw new Error(`verificarCeguera: clave de máquina detectada: "${clave}"`);
        }
        recorrer((valor as Record<string, unknown>)[clave]);
      }
    }
  }

  recorrer(artefacto);

  if (objetosEscaneados < 20 || clavesEscaneadas < 100) {
    throw new Error(
      `verificarCeguera: piso de escaneo no alcanzado (objetos=${objetosEscaneados}, claves=${clavesEscaneadas}) — el guard no probó nada`,
    );
  }

  return { objetosEscaneados, clavesEscaneadas };
}
