// cobertura.ts — chequeo de cobertura de `prefiltro.terminos` sobre el censo P, con
// truncador inyectable para el control negativo (D-133-F2.2, D-133b-3 paso 1).
//
// D-133-F2.2: si <95 % de los `prefiltro.terminos` de un caso está presente dentro de
// `entrada_llm` (título+descripción tal como las ve el clasificador), el límite de truncado
// debe subir ANTES de etiquetar un solo caso — subirlo después mueve el hash del
// `golden-set.json` y obliga a re-etiquetar todo (D-133b-7).
//
// El parámetro `truncador` existe para el CONTROL NEGATIVO de D-133-F2.2 — que el 100 %
// pueda caer. Su default es la función real del pre-filtro (`truncarDescripcion`) y se
// aplica en el MISMO punto del pipeline que producción (después de `despojarHtml`, antes de
// comparar): truncar antes de despojar movería el gradiente congelado. Bajo ninguna
// circunstancia se usa para ablandar el pre-filtro: el módulo `prefiltro-lexico.ts` no se
// toca (`prefiltro-lexico.ts:6-9`).

import { _interno } from "./entrada-llm.js";
import { terminosQueMatchean, truncarDescripcion, despojarHtml, fold } from "../prefiltro-lexico.js";

export interface CasoCobertura {
  caso_id: string;
  titulo: string;
  descripcion: string | null;
}

export interface CoberturaResultado {
  total: number;
  cubiertos: number;
  cobertura: number;
  sinTerminos: number;
  noCubren: string[];
}

export interface MedirCoberturaOpts {
  /** Truncador de la descripción — SOLO para el control negativo del test. Default: la
   * función REAL del pre-filtro. Nunca se pasa en producción. */
  truncador?: (s: string) => string;
}

/**
 * Construye la `entrada_llm` de un caso con un truncador dado, reproduciendo el ORDEN exacto
 * de `construirEntradaLlm` (`entrada-llm.ts:29-37`): `despojarHtml` primero, truncado
 * después, título NUNCA truncado. Con el truncador por defecto el resultado es byte-idéntico
 * al de `construirEntradaLlm` — verificado por test.
 */
export function construirEntradaMedida(
  input: { titulo: string; descripcion?: string | null },
  truncador: (s: string) => string,
): { titulo: string; descripcion: string } {
  const titulo = despojarHtml(input.titulo);
  const descripcion = truncador(despojarHtml(input.descripcion ?? ""));
  return { titulo, descripcion };
}

/**
 * Mide la cobertura de `prefiltro.terminos` (derivados con `terminosQueMatchean` sobre el
 * texto CRUDO — lo que el cargador evaluó) dentro de `entrada_llm` (construida con el
 * `truncador`, default = real). `casos` vacío ⇒ LANZA (cero vacuo, T-133-14/D-133b-1). Un
 * caso sin ningún término (`sinTerminos`) es una patología: se cuenta aparte, NUNCA como
 * cubierto por vacuidad. `noCubren` lista los `caso_id` que fallan — nunca se silencian.
 */
export function medirCobertura(
  casos: readonly CasoCobertura[],
  opts: MedirCoberturaOpts = {},
): CoberturaResultado {
  if (casos.length === 0) {
    throw new Error("medirCobertura: lista de casos vacía — cobertura no definida (cero vacuo)");
  }
  const truncador = opts.truncador ?? truncarDescripcion;

  let cubiertos = 0;
  let sinTerminos = 0;
  const noCubren: string[] = [];

  for (const caso of casos) {
    const terminos = terminosQueMatchean(caso.titulo, caso.descripcion);
    if (terminos.length === 0) {
      sinTerminos += 1;
      continue;
    }
    const entrada = construirEntradaMedida(caso, truncador);
    const textoFoldeado = fold(`${entrada.titulo} ${entrada.descripcion}`);
    const todosPresentes = terminos.every((t) => _interno.contieneTerminoConFrontera(textoFoldeado, t));
    if (todosPresentes) {
      cubiertos += 1;
    } else {
      noCubren.push(caso.caso_id);
    }
  }

  return { total: casos.length, cubiertos, cobertura: cubiertos / casos.length, sinTerminos, noCubren };
}

/**
 * Umbral PRE-REGISTRADO (D-133-F2.2): 95 %. Bajarlo después de ver una cifra no es salida
 * válida — misma prohibición que D-133-D2 aplica a los umbrales.
 */
export const UMBRAL_COBERTURA = 0.95;

/**
 * Gate fail-closed: cobertura ≥ `UMBRAL_COBERTURA` ⇒ devuelve el resultado. Cobertura <
 * `UMBRAL_COBERTURA` ⇒ LANZA con la cifra y `noCubren` — jamás `console.warn` + continuar,
 * porque bajo el umbral el límite de truncado DEBE subir antes de etiquetar, y esa decisión
 * no puede tomarse en silencio.
 */
export function verificarCobertura(
  casos: readonly CasoCobertura[],
  opts: MedirCoberturaOpts = {},
): CoberturaResultado {
  const resultado = medirCobertura(casos, opts);
  if (resultado.cobertura < UMBRAL_COBERTURA) {
    throw new Error(
      `verificarCobertura: cobertura ${resultado.cobertura} < umbral ${UMBRAL_COBERTURA} — ` +
        `noCubren=[${resultado.noCubren.join(", ")}]`,
    );
  }
  return resultado;
}
