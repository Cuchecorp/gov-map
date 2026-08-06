// entrada-llm.ts — entrada_llm del caso golden (D-133-F2) + chequeo de cobertura de
// prefiltro.terminos (133-04, D-133-J1.3/J1.4).
//
// D-133-J1: la decisión firmada ataca la CONSTANTE REPLICADA (el límite de truncado copiado
// en dos sitios), no la normalización del pre-filtro. Por eso `construirEntradaLlm` importa
// `truncarDescripcion` de `../prefiltro-lexico` (misma función que decide dónde cortar), pero
// aplica ese corte a texto despojado de HTML y SIN foldear: un fragmento foldeado (sin
// tildes, en minúsculas) no es "literal" y D-133-C2.2 exige que `justificacion` cite el
// fragmento literal. `titulo` y `descripcion` viajan SEPARADOS (D-133-F2), y el título NUNCA
// se trunca — solo la descripción compite por espacio con el pre-filtro.
//
// Encapsulado anti-prompt-injection (D-133-F2.3): `titulo` y `descripcion` son DATO para el
// clasificador de la fase 135, nunca instrucción. Este módulo no los interpreta ni ejecuta
// nada contenido en ellos — solo los transporta, despojados y truncados.
import { despojarHtml, fold, truncarDescripcion } from "../prefiltro-lexico.js";

export interface EntradaLlm {
  readonly titulo: string;
  readonly descripcion: string;
}

/**
 * Construye `entrada_llm` a partir de titular + descripción crudos (HTML incluido, tal
 * como llegan del RSS). El título se despoja de HTML pero NUNCA se trunca. La descripción
 * se despoja de HTML y se trunca con `truncarDescripcion` (LA MISMA función del pre-filtro),
 * pero se conserva SIN foldear: tildes y mayúsculas intactas, porque el golden set cita
 * fragmentos literales (D-133-C2.2).
 */
export function construirEntradaLlm(input: {
  titulo: string;
  descripcion?: string | null;
}): EntradaLlm {
  const titulo = despojarHtml(input.titulo);
  const descripcionDespojada = despojarHtml(input.descripcion ?? "");
  const descripcion = truncarDescripcion(descripcionDespojada);
  return { titulo, descripcion };
}

/**
 * Frontera de palabra sobre texto foldeado — mismo patrón que `prefiltro-lexico.ts`
 * (`String.includes` PROHIBIDO por régimen, `prefiltro-lexico.ts:127-128`: un término corto
 * como "ley" o "sala" no puede darse por presente por ser subcadena de "leyenda"/"antesala").
 */
function escaparRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const FRONTERA = "[^a-z0-9]";

function contieneTerminoConFrontera(textoFoldeado: string, terminoFoldeado: string): boolean {
  const re = new RegExp(
    `(^|${FRONTERA})${escaparRegExp(terminoFoldeado)}(${FRONTERA}|$)`,
  );
  return re.test(textoFoldeado);
}

/** Un caso mínimo sobre el que se puede calcular cobertura — subconjunto de CasoGolden. */
export interface CasoParaCobertura {
  readonly entrada_llm: EntradaLlm;
  readonly prefiltro: { readonly terminos: readonly string[] };
}

/**
 * Fracción de `casos` cuyos `prefiltro.terminos` están TODOS presentes (frontera de
 * palabra, sobre texto foldeado) dentro de `entrada_llm` (título + descripción). Chequeo de
 * cobertura de D-133-F2.2: debe correrse ANTES de etiquetar; < 95% ⇒ el límite sube antes de
 * etiquetar un solo caso.
 *
 * `prefiltro.terminos` viene YA FOLDEADO (`VOCABULARIO_LEGISLATIVO` está foldeado en
 * `prefiltro-lexico.ts`) ⇒ foldear `entrada_llm` antes de comparar es obligatorio, o la
 * comparación fallaría trivialmente para cualquier término con tilde/mayúscula en el texto.
 *
 * Lanza sobre lista vacía — jamás devuelve 1.0 (cobertura del 100% sobre cero casos es un
 * cero vacuo, T-133-14).
 */
export function coberturaTerminos(casos: readonly CasoParaCobertura[]): number {
  if (casos.length === 0) {
    throw new Error("coberturaTerminos: lista de casos vacía — cobertura no definida (cero vacuo)");
  }
  let cubiertos = 0;
  for (const caso of casos) {
    const textoFoldeado = fold(`${caso.entrada_llm.titulo} ${caso.entrada_llm.descripcion}`);
    const todosPresentes = caso.prefiltro.terminos.every((t) =>
      contieneTerminoConFrontera(textoFoldeado, t),
    );
    if (todosPresentes) cubiertos++;
  }
  return cubiertos / casos.length;
}

/** Expuesto solo para el test comparativo de divergencia de cortes (D-133-J1.4). */
export const _interno = { contieneTerminoConFrontera };
