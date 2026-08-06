/**
 * TERMINOS_PROHIBIDOS + sub-listas — extraído de `anti-insinuacion-guard.test.ts`
 * (D-133-J2, vía B acotada) para que `packages/news/src/eval/taxonomia-guard.test.ts`
 * (G1) pueda leer los términos por DISCO — lectura de bytes, no import: la dirección
 * `app`→`packages` del grafo de módulos no se invierte.
 *
 * Movimiento PURO: mismo contenido byte por byte que la copia previa dentro del
 * guard. La lista de negaciones LOCKED NO se movió (D-133-J2.2): importa constantes
 * de componentes de UI y arrastraría jsdom al carril de news.
 *
 * Este módulo NO contiene JSX, NO importa componentes de UI ni el alias de
 * componentes de app, NO importa ningún paquete del monorepo interno.
 */

/**
 * Se extrae a su propia constante por WR-03 de la review: estos términos se agregaron a
 * la lista GLOBAL (que se aplica a ~50 archivos de TODOS los carriles) pero la
 * verificación declarada se había hecho por grep sobre 4 superficies. Términos genéricos
 * del español ("oculta", "esconde", "censura") son minas de falso positivo para copy
 * factual futuro de superficies ajenas ("la tabla oculta las columnas sin dato") y
 * bloquearían fases no relacionadas. Con la constante nombrada, el test
 * "(1b) WR-03" del guard verifica —POR CÓDIGO y sobre el conjunto COMPLETO de
 * superficies de todos los carriles, no por grep manual sobre 4— que ninguno tiene
 * hit hoy, y nombra el archivo exacto si mañana lo tuviera.
 *
 * TILDES EXACTAS (buildTermRegex NO es accent-insensitive) y CERO tokens genéricos que
 * colisionen con identificadores (lección del `top` pelado rechazado en 100-01).
 * DEDUPE: "influencia"/"captura" ya están en el carril MONEY → NO se re-agregan.
 */
export const TERMINOS_LINK_EXT: string[] = [
  "oculta",
  "ocultan",
  "esconde",
  "esconden",
  "no quiere",
  "se niega a",
  "bloquea a propósito",
  "censura",
];

/**
 * Términos COBERTURA (122-05, fila 5.12 de `122-CRUCES-SQL-03-LOBBY.md`) — Wave-0.
 *
 * POR QUÉ EXISTE: la fila 5.12 obliga a DECLARAR en la superficie que el canal
 * lobby↔proyecto-de-ley es parcial (195 de 5.106 audiencias confirmadas citan un
 * número de boletín ⇒ 3,8 %, observado 2026-07-29). Escribir una cifra de cobertura
 * parcial abre un vector de insinuación NUEVO que ningún carril previo cubría: el de
 * editorializar el HUECO. Decir "3,8 %" es un HECHO; decir que ese 3,8 % es "la punta
 * del iceberg", una "cifra negra", un "subregistro" o que las audiencias reales "en
 * realidad son" más, afirma un número que NO se observó y atribuye ocultamiento a la
 * fuente. Es exactamente el riesgo #1 del proyecto (una ausencia falsa con atribución
 * de fuente), aplicado a la declaración de cobertura.
 *
 * Estos términos se declaran ANTES de que el copy de 5.12 exista (patrón Wave-0
 * LOCKED, lección BLOCKER 91) y se escanean sobre TODAS las superficies vía el spread
 * en `TERMINOS_PROHIBIDOS`.
 *
 * DEDUPE (Pitfall 4): "oculta"/"esconde"/"censura" ya viven en `TERMINOS_LINK_EXT` y
 * "captura" en el carril MONEY → NO se re-agregan. Verificado por grep sobre
 * `app/{components,app,lib}` (sin tests): CERO ocurrencias de los 6 términos en el
 * árbol actual ⇒ no introducen falso positivo. TILDES EXACTAS (buildTermRegex NO es
 * accent-insensitive) y CERO tokens genéricos que colisionen con identificadores
 * (lección del `top` pelado rechazado en 100-01): los 6 son multi-palabra o
 * sustantivos que ningún identificador del repo usa.
 */
export const TERMINOS_COBERTURA: string[] = [
  "punta del iceberg",
  "subregistro",
  "cifra negra",
  "zona oscura",
  "en realidad son",
  "muy por debajo",
];

/**
 * Términos prohibidos (lista dura VERBATIM de 68-UI-SPEC §Linter). Se buscan en el
 * texto RENDERIZADO (post-strip de comentarios), con límite de palabra en español
 * para no cazar identificadores snake_case: `rebeldias_de_parlamentario` (nombre de
 * RPC, sin tilde, con `_`) NO dispara; `rebeldía`/`rebeldías` en prosa SÍ.
 *
 * Los acentos importan: los términos con tilde se buscan CON la tilde (`rebeldía`,
 * `índice`, `díscolo`, `traición`, `cercanía`).
 */
export const TERMINOS_PROHIBIDOS: string[] = [
  "rebeldía",
  "rebeldías",
  "rebelde",
  "disciplina",
  "indisciplina",
  "alineamiento",
  "alineado",
  "alineada",
  "afinidad",
  "cercanía política",
  "lealtad",
  "traición",
  "díscolo",
  "score",
  "puntaje",
  "índice",
  "ranking",
  "nivel de acuerdo",
  "vota como",
  "votan como",
  "similar a",
  "mediana de su cámara",
  "financió su voto",
  "a cambio de",
  // --- Carril MONEY (MONEY-04, 73-UI-SPEC §Linter) — causalidad dinero→decisión
  //     e insinuación. TILDES EXACTAS (Pitfall 2: buildTermRegex NO es
  //     accent-insensitive). "empresa ligada a" bloquea la construcción
  //     insinuante (con la preposición `a`); el HECHO "Enlazado por RUT" /
  //     "ligada por RUT" / el identificador `empresa_ligada_por_rut` NO disparan
  //     por el límite de palabra (Pitfall 3). "a cambio de" ya viene por el carril
  //     de voto y cubre "a cambio de un contrato".
  "financió",
  "a cambio del voto",
  "compró",
  "compró su voto",
  "pagó por",
  "soborno",
  "coima",
  "corrupción",
  "favoreció",
  "empresa ligada a",
  "conflicto de interés",
  "influencia",
  "captura",
  "lobby a cambio",
  "contrato a dedo",
  "direccionado",
  // --- WR-01: paráfrasis insinuantes de alta frecuencia que la denylist exacta
  //     dejaba pasar (verificadas como falsos-negativos en la review). Se cierran
  //     los idioms obvios; NO es exhaustivo (ver JSDoc del detector en el guard).
  "influencias", // plural: "tráfico de influencias" (la denylist tenía sólo "influencia")
  "tráfico de influencias",
  "vinculado a irregularidades",
  "vinculado a",
  "ligado a",
  "beneficiado por",
  "beneficiado",
  "favores",
  "puerta giratoria",
  "puertas giratorias",
  "recibió aportes y luego votó",
  "a dedo",
  "direccionamiento",
  "quid pro quo",
  "kickback",
  // --- Carril PERSONAS (91-03, BIO-03/BIO-04) — vocabulario de bancada/afinidad
  //     que el frente parlamentario 360 (partido, militancias, cross-links, filtro)
  //     tienta. TILDES EXACTAS. Dedupe verificado: "alineado"/"alineada" ya viven
  //     arriba (carril VOTO) y "vinculado a" en el carril MONEY → NO se re-agregan.
  //     "cercano a" cubre "cercano a su bloque/partido"; "bloque de" cubre
  //     "bloque de derecha/izquierda"; "coordina con" cubre coordinación inferida.
  "aliado",
  "cercano a",
  "bloque de",
  "afín",
  "coordina con",
  // --- Carril PANEL (100-01, PANEL-01) — timing/editorial insinuante + anti-ranking
  //     que el panel de actualidad (velocidad de tramitación, reingresos, citaciones,
  //     archivados) tienta. TILDES EXACTAS (Pitfall 3: buildTermRegex NO es
  //     accent-insensitive → "exprés"/"resucitó"/"último"/"afín" se buscan CON tilde).
  //     Timing: describir CUÁNDO/A-QUÉ-HORA pasó algo como si insinuara maniobra
  //     ("de madrugada"/"a última hora"/"último momento"). Editorial de reingreso:
  //     "revivido"/"reactivado"/"zombie"/"resucitó"/"colado" editorializan un
  //     reingreso factual. Anti-ranking: "la cámara más activa"/"top"/"los más"
  //     rankean cross-cámara un conteo NEUTRO (T-52-13 LOCKED, regla B de
  //     actualidad-module: NUNCA "top/los más/la cámara más activa").
  //     Verificado por grep (100-01): "los más"/"la cámara más activa"/"reactivado"
  //     NO estaban en la lista → se añaden. "índice"/"ranking"/"score"/"puntaje" ya
  //     cubren el ranking numérico arriba (NO se re-agregan).
  //     OJO (verificado en la corrida 100-01): el token bare "top" NO se añade — el
  //     límite de palabra lo cazaría sobre `const top = vigentes.slice(…)` de
  //     actualidad-module.tsx:407 (identificador de código, NO copy renderido) → falso
  //     positivo. El idiom de ranking se cubre con las frases multi-palabra "los más"
  //     y "la cámara más activa" (que NO colisionan con identificadores). Si el copy
  //     del panel usara literalmente la palabra "top" en un ranking, registrar la FRASE
  //     exacta (p.ej. "top de cámaras") en Plan 02, no el token bare.
  "último momento",
  "a última hora",
  "de madrugada",
  "exprés",
  "revivido",
  "reactivado",
  "zombie",
  "resucitó",
  "colado",
  "la cámara más activa",
  "los más",
  // --- Carril VSIM (102-01, VSIM-02/VSIM-03) — similitud de votación. Vocabulario de
  //     afinidad/coalición por CO-VOTACIÓN + la metáfora de "señal"/"tasa" que la sección
  //     de coincidencia de votos tienta. DEDUPE (Pitfall 4): NO se re-agregan
  //     "afín"/"afinidad"/"aliado"/"nivel de acuerdo"/"bloque de"/"vota como"/"votan como"
  //     — ya cubiertos arriba (carriles VOTO/PERSONAS). GENUINAMENTE NUEVOS: las variantes
  //     "votan juntos/igual/parecido" (paráfrasis de bancada por co-votación), los plurales
  //     "aliados"/"aliada" (el singular "aliado" ya está, pero el límite de palabra no
  //     cubre el plural/femenino), "tasa de coincidencia" (numeraliza la afinidad) y "señal"
  //     (la metáfora que el propio caveat NIEGA — restado vía LEYENDA_SIMILITUD_VOTO en
  //     la lista de negaciones LOCKED del guard). TILDES/plurales exactos (buildTermRegex
  //     NO es accent-insensitive).
  "votan juntos",
  "votan igual",
  "votan parecido",
  "aliados",
  "aliada",
  "tasa de coincidencia",
  "señal",
  // --- Carril LINK-EXT (115-03, LINK-03) — insinuación de INTENCIÓN DE LA FUENTE.
  //     WR-03: la lista vive en `TERMINOS_LINK_EXT` (arriba, con su JSDoc) y su ausencia
  //     se verifica POR CÓDIGO sobre TODAS las superficies de todos los carriles —no por
  //     grep manual sobre 4— en el test "(1b) WR-03" del guard.
  ...TERMINOS_LINK_EXT,
  // --- Carril COBERTURA (122-05, fila 5.12) — editorialización del HUECO de una
  //     cobertura parcial declarada. La lista vive en `TERMINOS_COBERTURA` (arriba,
  //     con su JSDoc) y entra al scan de TODAS las superficies por este spread.
  ...TERMINOS_COBERTURA,
];
