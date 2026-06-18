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
  /** Clave de comparación: tokens de blocking ordenados canónicamente. */
  nombre_normalizado: string;
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
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokeniza una cadena ya folded en palabras no vacías. */
function tokenize(folded: string): string[] {
  return folded.length === 0 ? [] : folded.split(" ").filter((t) => t.length > 0);
}

/** Construye el resultado a partir de tokens de blocking + alias ya separados. */
function build(blockingRaw: string[], alias: string[]): NombreNormalizado {
  const tokens = blockingRaw.filter((t) => t.length > 0 && !PARTICULAS.has(t));
  const nombre_normalizado = [...tokens].sort().join(" ");
  return { nombre_normalizado, tokens, alias_capturados: alias };
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
