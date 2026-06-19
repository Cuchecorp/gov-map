/**
 * normalizarNombre — normalización de nombres chilenos (FUNCIÓN PURA, ID-02).
 *
 * Produce una CLAVE de comparación (`nombre_normalizado`) estable entre fuentes,
 * sus `tokens` para blocking (Fase 4) y los `alias_capturados` (variantes de grafía).
 * Sin red ni DB.
 *
 * Decisión A1 (Pitfall 2): el folding `ñ→n` es ACEPTABLE para la CLAVE de comparación
 * porque ambos lados se normalizan igual (comparable). El DISPLAY usa SIEMPRE los campos
 * originales (`apellido_paterno`, etc.), NUNCA este normalizado.
 *
 * Convergencia catálogo ↔ votación (Pitfall 3): el catálogo trae el materno COMPLETO;
 * el formato de votación del Senado ("Apellido P., Nombre") solo trae su INICIAL. Para que
 * ambos produzcan el mismo `nombre_normalizado`, el apellido materno NO entra en la clave de
 * blocking: se captura como alias. La clave canónica = paterno + nombres (tokens ordenados).
 */

/** Partículas que no entran en los tokens de blocking. */
const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y", "da", "do"]);

export interface NombreNormalizado {
  /** Clave de comparación: tokens de blocking ordenados canónicamente (SIN materno). */
  nombre_normalizado: string;
  /**
   * Clave ESTRICTA = paterno + materno + nombres (WR-01). A diferencia de
   * `nombre_normalizado` (que omite el materno para converger catálogo↔votación), esta clave
   * INCLUYE el apellido materno cuando está disponible. Úsala para el match interno del
   * catálogo (self-match de la maestra), donde el materno SÍ está presente en ambos lados:
   * distingue homónimos que comparten paterno + nombres pero difieren en materno (p.ej.
   * "Juan Pérez González" vs "Juan Pérez Soto"), evitando un falso match único. La clave
   * materno-less se reserva para la reconciliación cross-source (votación) de Fase 4.
   *
   * Si no hay materno, coincide con `nombre_normalizado` (no agrega información espuria).
   */
  clave_estricta: string;
  /** Tokens de blocking (sin partículas, sin materno, sin iniciales). */
  tokens: string[];
  /** Variantes capturadas (apellido materno completo o su inicial). */
  alias_capturados: string[];
}

export interface NombreInput {
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  /** Cadena libre, p.ej. el formato de votación "Apellido P., Nombre". */
  libre?: string;
}

/** Fold: NFD strip de diacríticos (ñ→n), casefold, puntuación → separador. */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    // #11: apóstrofes y guiones se ELIMINAN (no se reemplazan por espacio) para que
    // O'Higgins / O-Higgins / Ohiggins colapsen al MISMO token de blocking. Cubre el
    // apóstrofe recto (U+0027), los tipográficos (U+2018/U+2019) y guiones/dashes.
    .replace(/['‘’‐‑‒–—―-]/g, "")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokeniza una cadena ya folded en palabras no vacías. */
function tokenize(folded: string): string[] {
  return folded.length === 0 ? [] : folded.split(" ").filter((t) => t.length > 0);
}

/**
 * Construye el resultado a partir de tokens de blocking + alias (materno) ya separados.
 * `nombre_normalizado` omite el materno (convergencia cross-source); `clave_estricta`
 * lo INCLUYE para el self-match del catálogo (WR-01). Ambas claves ordenan sus tokens
 * canónicamente para ser estables ante reordenamientos de la fuente.
 */
function build(blockingRaw: string[], alias: string[]): NombreNormalizado {
  const tokens = blockingRaw.filter((t) => t.length > 0 && !PARTICULAS.has(t));
  const nombre_normalizado = [...tokens].sort().join(" ");
  const maternoTokens = alias.filter((t) => t.length > 0 && !PARTICULAS.has(t));
  const clave_estricta = [...tokens, ...maternoTokens].sort().join(" ");
  return { nombre_normalizado, clave_estricta, tokens, alias_capturados: alias };
}

/**
 * Normaliza desde campos estructurados (catálogo) o desde una cadena libre
 * (formato de votación). En ambos casos el apellido materno / su inicial se
 * captura como alias y queda FUERA de la clave de blocking, de modo que catálogo
 * y votación convergen al mismo `nombre_normalizado`.
 */
export function normalizarNombre(input: NombreInput): NombreNormalizado {
  const alias: string[] = [];

  if (input.libre != null && input.libre.trim() !== "") {
    // Formato "Apellido(s) [Materno|Inicial], Nombres".
    const idxComa = input.libre.indexOf(",");
    if (idxComa >= 0) {
      const apellidosTokens = tokenize(fold(input.libre.slice(0, idxComa)));
      const nombresTokens = tokenize(fold(input.libre.slice(idxComa + 1)));
      // El último token de la parte de apellidos es el materno (completo o inicial).
      const blocking: string[] = [...apellidosTokens];
      const materno = blocking.pop();
      if (materno != null) alias.push(materno);
      return build([...blocking, ...nombresTokens], alias);
    }
    // Sin coma: no podemos distinguir materno con fiabilidad → todo a blocking.
    return build(tokenize(fold(input.libre)), alias);
  }

  // Campos estructurados (catálogo): paterno + nombres a blocking; materno → alias.
  const paternoTokens = tokenize(fold(input.apellidoPaterno ?? ""));
  const maternoTokens = tokenize(fold(input.apellidoMaterno ?? ""));
  const nombresTokens = tokenize(fold(input.nombres ?? ""));
  for (const t of maternoTokens) {
    if (!PARTICULAS.has(t)) alias.push(t);
  }
  return build([...paternoTokens, ...nombresTokens], alias);
}
