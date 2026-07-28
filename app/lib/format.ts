/**
 * Formato de fechas y tiempo relativo en español (es-CL).
 * UI-SPEC §1.2 / §4 / §9.4. Tono sobrio, sin abreviaturas en inglés.
 */

// Umbral de frescura por CADENCE de ingesta (~14 días), no por 48 h fijas.
// La ingesta de la mayoría de las fuentes es semanal ⇒ 2× cadence da un margen
// honesto: un dato de 10-13 días es normal, no una alarma. 48 h dejaba el badge
// en ámbar permanente para datos con ingesta semanal (falso positivo de frescura).
const STALE_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000; // 14 días (cadence de ingesta)

/**
 * F-10 (116-FECHAS-AUDIT §3, fix sugerido): `timeZone` EXPLÍCITA.
 *
 * Sin esta opción, `Intl` usa la zona del RUNTIME — el día renderizado dependía de
 * dónde corriera el proceso, no del dato. Era correcto por accidente (el Worker corre
 * en UTC) y se rompía en cualquier entorno con otra zona (el runtime de desarrollo en
 * Chile ya rendía el día ANTERIOR). Fijarla convierte ese acierto en CONTRATO DEL CÓDIGO.
 *
 * UTC —y NO la zona de Chile— porque preserva el comportamiento actual correcto:
 * convertir a Chile fabricaría el día anterior en las ~45.618 filas `timestamptz` que
 * son date-only DISFRAZADAS (medianoche UTC), exactamente el corrimiento que
 * `lib/dia-calendario.ts` existe para evitar. Las fechas del hecho CON hora real se
 * atienden aparte, en `fechaHechoCorta`.
 */
const fechaCortaFormatter = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Formatter de la rama HORA-REAL de `fechaHechoCorta` (F-05). ÚNICO lugar del archivo
 * donde se usa la zona horaria de Chile: aquí sí hay una hora de reloj real que convertir al
 * calendario del ciudadano. Constante de módulo (no se construye por llamada: `Intl`
 * es caro).
 */
const fechaHechoRealFormatter = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Santiago",
});

/**
 * Fecha absoluta corta en español: "14 may 2026".
 */
export function fechaCorta(d: Date): string {
  return fechaCortaFormatter.format(d);
}

/**
 * Fecha del HECHO (cuándo ocurrió lo que se cuenta: la votación, la citación, el
 * trámite) — F-05 de `116-FECHAS-AUDIT.md`.
 *
 * PROBLEMA QUE MITIGA: la columna `timestamptz` guarda DOS semánticas mezcladas.
 * Unas filas traen la hora REAL del hecho (una votación a las 00:14 UTC = 21:14 del
 * día ANTERIOR en Chile) y otras son fechas date-only DISFRAZADAS de medianoche UTC
 * (donde la parte fecha UTC YA ES el día publicado, contrato de `dia-calendario.ts`).
 * Una sola regla de zona horaria se equivoca en la mitad de los casos:
 *  - formatear todo en UTC ⇒ la votación nocturna se rinde un día DESPUÉS;
 *  - formatear todo en Chile ⇒ la date-only disfrazada se corre un día ANTES.
 *
 * REGLA: si el instante cae exactamente en 00:00:00.000 UTC ⇒ es date-only disfrazada
 * ⇒ se formatea con el formatter UTC (sin convertir de zona). Si hay hora real ⇒ se
 * convierte a la zona de Chile, que es el calendario del ciudadano.
 *
 * LÍMITE HONESTO (audit §6, límite 6): esto MITIGA EN EL RENDER, no corrige el fondo.
 * La corrección real —separar las dos semánticas en la ingesta, con una columna que
 * declare si la fila tiene hora— es de datos y queda DECLARADA, no resuelta aquí. La
 * heurística tiene un falso positivo estructural: un hecho que ocurrió realmente a las
 * 00:00:00.000 UTC (21:00 del día anterior en Chile) se tratará como date-only. Es un
 * caso raro y el error resultante es el statu quo actual, no una regresión.
 *
 * CR-02 (117-REVIEW): guard `NaN` en el CHOKEPOINT. Con `new Date(NaN)` los
 * `getUTC*()` devuelven `NaN` ⇒ `sinHora === false` ⇒ se ejecutaba
 * `Intl.DateTimeFormat.prototype.format`, que LANZA `RangeError: Invalid time value`
 * y revienta el Server Component completo de la ficha (500). Era la única de las
 * tres helpers nuevas sin guard; que `timeline-event` no cayera era accidente de un
 * call-site que filtraba con `fechaPlausible` antes. Ahora degrada al mismo copy
 * honesto de `fechaHechoCortaSegura` / `fechaCortaSegura`, NUNCA "Invalid Date".
 */
export function fechaHechoCorta(d: Date, fallback = "fecha no informada"): string {
  if (Number.isNaN(d.getTime())) return fallback;
  const sinHora =
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0;
  return sinHora ? fechaCorta(d) : fechaHechoRealFormatter.format(d);
}

/**
 * Versión segura de `fechaHechoCorta` para valores CRUDOS de la RPC — degrada a copy
 * honesto cuando el dato es null/vacío/no-ISO, NUNCA renderiza "Invalid Date".
 *
 * Espeja el guard anti-500 de `fechaCortaSegura` pero SIN su `slice(0, 10)`: ese corte
 * es DESTRUCTIVO para una fecha del hecho, porque tira justamente la hora que decide
 * en qué día chileno ocurrió ("2023-11-17T00:14:41+00:00" truncado a "2023-11-17"
 * rendiría el 17 en vez del 16). Aquí el raw se valida y se parsea COMPLETO.
 *
 * Un raw date-only puro ("2026-03-31") sigue dando el día correcto: `new Date("YYYY-MM-DD")`
 * es medianoche UTC ⇒ cae en la rama date-only de `fechaHechoCorta`.
 */
export function fechaHechoCortaSegura(
  raw: string | null | undefined,
  fallback = "fecha no informada",
): string {
  const s = (raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(s)) return fallback;
  const d = new Date(s);
  // El `fallback` se propaga al helper: un único copy de degradación por call-site.
  return Number.isNaN(d.getTime()) ? fallback : fechaHechoCorta(d, fallback);
}

/**
 * ¿La fecha es PLAUSIBLE para un hecho del Congreso? — F-04 de `116-FECHAS-AUDIT.md`.
 *
 * La fuente publica fechas imposibles (typos reales en PROD: `2626-05-25`). Renderizar
 * "año 2626" en la ficha no es un dato, es basura con apariencia de dato.
 *
 * Rango del fix sugerido: `[1990-01-01T00:00:00Z, now + 5 años]`. El techo NO es "hoy":
 * `/agenda` muestra futuro LEGÍTIMO (citaciones futuras verificadas en PROD) y las
 * urgencias vencen en el futuro; 5 años deja pasar todo lo legítimo y ataja el typo de
 * siglo. Una fecha inválida (`NaN`) no es plausible y no lanza.
 *
 * ES UN PREDICADO, NO UN FILTRO: el llamante decide qué hacer (omitir la fecha
 * honestamente, declarar el dato ilegible). PROHIBIDO convertirlo en un
 * `where fecha <= current_date` global — ese fue exactamente el defecto que mató filas
 * legítimas y quedó LOCKED como corrección en 99-01.
 */
export function fechaPlausible(d: Date, now: Date = new Date()): boolean {
  const t = d.getTime();
  if (Number.isNaN(t)) return false;
  const piso = Date.UTC(1990, 0, 1);
  const techo = new Date(now.getTime());
  techo.setUTCFullYear(techo.getUTCFullYear() + 5);
  return t >= piso && t <= techo.getTime();
}

/**
 * Tiempo relativo legible en español respecto a `now` (por defecto, ahora).
 * Rangos (UI-SPEC §4):
 *   < 1h  → "hace X min"
 *   < 24h → "hace X h"
 *   < 7d  → "hace X días"
 *   ≥ 7d  → fecha absoluta (DD MMM YYYY)
 */
export function relativeTimeEs(capturedAt: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - capturedAt.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMs < 0) {
    // Captura en el futuro (reloj desfasado): tratar como "recién".
    return "hace 0 min";
  }
  if (diffHours < 1) {
    return `hace ${diffMin} min`;
  }
  if (diffDays < 1) {
    return `hace ${diffHours} h`;
  }
  if (diffDays < 7) {
    // Pluralización en español: "1 día" / "3 días".
    return `hace ${diffDays} ${diffDays === 1 ? "día" : "días"}`;
  }
  return fechaCorta(capturedAt);
}

/**
 * `true` si el dato supera el umbral de frescura por cadence de ingesta
 * (por defecto ~14 días, ingesta semanal ⇒ 2× cadence, margen honesto).
 * UI-SPEC §4: no se oculta el dato, se marca en amber.
 *
 * Firma retro-compatible: `staleAfterMs` es opcional (tercer parámetro) para
 * que el único call-site `esStale(capturedAt)` compile sin cambios y el nuevo
 * default propague a todos los consumidores de ProvenanceBadge.
 */
export function esStale(
  capturedAt: Date,
  now: Date = new Date(),
  staleAfterMs: number = STALE_THRESHOLD_MS,
): boolean {
  return now.getTime() - capturedAt.getTime() > staleAfterMs;
}

/**
 * Extracto LITERAL de la idea matriz para la ficha (Phase 22, §9). NUNCA
 * reescribe, resume ni reinterpreta — sólo normaliza espacios y TRUNCA en límite
 * de palabra, agregando "…" cuando corta. La salida es siempre un PREFIJO de la
 * fuente (más la elipsis), de modo que el ciudadano lee texto de la fuente, no
 * texto fabricado. Si la idea es null/vacía, el llamador muestra el honest-state
 * "no disponible aún" — esta función no inventa contenido.
 */
export function extractoIdea(idea: string, max = 160): string {
  const limpio = idea.replace(/\s+/g, " ").trim();
  if (limpio.length <= max) return limpio;
  // Corta en el último espacio dentro del presupuesto → no parte una palabra.
  const ventana = limpio.slice(0, max);
  const corte = ventana.lastIndexOf(" ");
  const prefijo = (corte > 0 ? ventana.slice(0, corte) : ventana).trimEnd();
  return `${prefijo}…`;
}

/**
 * Conteo de una votación "58–81" con guion largo (en dash U+2013), listo para
 * render en Mono (UI-SPEC §2). Hecho factual de la votación, sin formateo que
 * altere los valores de la fuente. No fabrica abstención/quórum si no se piden.
 */
export function conteoVotacion(si: number, no: number): string {
  return `${si}–${no}`;
}

/**
 * Capitaliza SOLO la primera letra de la cadena, conservando el resto tal cual
 * (incluida la coma del locale es-CL: "jueves, 2 de julio" → "Jueves, 2 de julio").
 *
 * NO usar la utilidad CSS `capitalize` de Tailwind (`text-transform: capitalize`):
 * capitaliza CADA palabra → "Jueves, 2 De Julio". Este helper es puro y quirúrgico.
 * Cadena vacía → cadena vacía (sin crash).
 */
export function capitalizarPrimera(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Formatea una fecha ISO cruda a fecha corta es-CL, DEGRADANDO a copy honesto
 * cuando el dato es null/vacío/no-ISO — NUNCA renderiza "Invalid Date".
 *
 * Espeja el guard anti-500 WR-03 de patrimonio (slice ISO + regex antes de
 * `new Date`), pero en vez de EXCLUIR la fila (como el chart) DEGRADA a un
 * fallback honesto ("fecha no informada") para superficies que sí muestran la fila.
 * Reutiliza `fechaCorta` para el caso válido (no duplica el formateo).
 */
export function fechaCortaSegura(
  raw: string | null,
  fallback = "fecha no informada",
): string {
  const iso = (raw ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return fallback;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? fallback : fechaCorta(d);
}

/**
 * Saneamiento DISPLAY-ONLY del valor `partido` cuando la fuente (BCN) dejó el
 * recurso RDF crudo como valor — p.ej. la militancia de senadores de BCN emite
 * `http://datos.bcn.cl/recurso/cl/organismo/partido-politico/partido-democratas-chile`
 * en vez de la etiqueta legible. Renderizar ese URI como "partido" en la ficha es
 * un DEFECTO (URI-como-partido): el ciudadano ve una URL donde debería ir el nombre.
 *
 * Regla LOCKED (no fabricar identidad):
 *  1. null/vacío → null (los callers conservan su omisión honesta).
 *  2. Si NO es un URI de partido de datos.bcn.cl → passthrough verbatim (el valor
 *     ya es un nombre legible de la fuente; JAMÁS re-casear un nombre real).
 *  3. Si es el URI de BCN: derivar el nombre del PROPIO slug del URI — reemplazar
 *     "-" por espacio y Title-Case. NO se agregan tildes (el slug no las trae;
 *     inventarlas sería fabricar), NO se traduce ni se expande: "partido-democratas
 *     -chile" → "Partido Democratas Chile". El nombre sale del dato, no se inventa.
 *  4. Si es un URI de BCN de partido pero SIN slug utilizable (vacío/solo "/") →
 *     null (omisión honesta), JAMÁS el raw URI. La invariante "CERO URI en el DOM"
 *     pesa más que mostrar algo: sin slug no hay nombre derivable del dato, y filtrar
 *     el URI contradiría el propósito de la función.
 *
 * Es display-only: la clave de matching y la proyección PII-safe no se tocan.
 */
export function partidoLegible(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (s === "") return null;
  // Solo el URI de partido de BCN dispara la derivación; cualquier otro valor
  // (nombre legible de la fuente) pasa verbatim.
  // Scheme+host case-INSENSITIVE (RFC 3986): scheme y host son case-insensitive,
  // así que `HTTP://DATOS.BCN.CL/.../partido-politico/x` DEBE disparar la derivación
  // igual que el lowercase. Sin la flag `i`, un URI con host en mayúscula caería en
  // el passthrough (regla 2) y el raw URI se filtraría al DOM (defecto URI-como-partido).
  // El test PRIMERO reconoce que es un URI BCN de partido; LUEGO extrae el slug. Un URI
  // BCN reconocible pero con slug vacío → null (regla 4), NUNCA passthrough del raw URI.
  if (/^https?:\/\/datos\.bcn\.cl\/.*\/partido-politico\//i.test(s)) {
    const m = /\/partido-politico\/(.+?)\/?$/i.exec(s);
    const slug = m?.[1] ?? "";
    const words = slug.split("-").filter((p) => p.length > 0);
    return words.length
      ? words.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ")
      : null;
  }
  // No es un URI BCN de partido → nombre legible de la fuente, pasa verbatim.
  return s;
}

/**
 * Partículas que quedan en minúscula en Title Case (es-CL), EXCEPTO cuando son
 * el primer token del nombre (el primer token siempre se capitaliza).
 * Lista LOCKED (54-CONTEXT / UI-SPEC Contract 1).
 */
const PARTICULAS_NOMBRE = new Set([
  "de",
  "del",
  "la",
  "las",
  "los",
  "van",
  "von",
  "y",
]);

/**
 * Formateo DISPLAY-ONLY de un nombre para superficie ciudadana (UI-SPEC Contract 1,
 * Phase 54). NUNCA toca datos: `nombre_normalizado` sigue siendo la clave de
 * matching y la proyección PII-safe; React keys, params de RPC, hrefs y
 * comparaciones SIEMPRE usan el string RAW. Este helper sólo re-casea el string
 * que se RENDERIZA.
 *
 * Reglas LOCKED (no fabricar identidad — invariante HARD §2 del SPEC):
 * 1. null/undefined/whitespace-only → "" (los callers conservan su null-fallback).
 * 2. Passthrough guard (load-bearing): si el string contiene CUALQUIER mayúscula
 *    Unicode (`/\p{Lu}/u`, NO `/[A-Z]/`) → verbatim. El dato ya viene caseado por
 *    la fuente ("Boris Barrera Moreno", "AFP HABITAT"); re-casearlo fabricaría
 *    display. El guard Unicode cubre la fila real "fundación mas familia Ñuble"
 *    (Ñ mayúscula, CERO A-Z) que un guard ASCII re-casearía mal.
 * 3. Solo transforma strings 100% minúsculas: colapsa runs de whitespace a 1
 *    espacio y hace split por espacio.
 * 4. Partícula (de/del/la/las/los/van/von/y) queda minúscula EXCEPTO como primer
 *    token ("de la maza carlos" → "De la Maza Carlos").
 * 5. Tokens no-partícula: capitaliza la 1ª letra de cada SUB-token separado por
 *    `-` o `'` (delimitadores preservados): "o'higgins" → "O'Higgins".
 * 6. NUNCA agrega tildes ("gonzalez" → "Gonzalez"), NUNCA reordena tokens, NUNCA
 *    normaliza puntuación interior.
 *
 * Idempotencia por construcción: la salida transformada contiene mayúsculas → una
 * segunda pasada cae en el passthrough guard.
 */
export function formatNombre(raw: string | null | undefined): string {
  const s = (raw ?? "").replace(/\s+/g, " ").trim();
  if (s === "") return "";
  // Guard de passthrough — DEBE ser Unicode-aware (\p{Lu}), NO /[A-Z]/.
  if (/\p{Lu}/u.test(s)) return s; // ya viene caseado por la fuente → verbatim
  return s
    .split(" ")
    .map((token, i) => {
      // Partícula no-inicial → minúscula (el primer token siempre capitaliza).
      if (i > 0 && PARTICULAS_NOMBRE.has(token)) return token;
      // Capitaliza cada sub-token separado por - o ' (delimitadores preservados).
      return token
        .split(/([-'])/)
        .map((part) =>
          part === "-" || part === "'"
            ? part
            : part.charAt(0).toUpperCase() + part.slice(1),
        )
        .join("");
    })
    .join(" ");
}
