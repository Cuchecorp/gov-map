# Phase 133-a: NEWS-TAXO — Research

**Researched:** 2026-08-06
**Domain:** Monorepo TS/pnpm — congelación de artefactos por hash, guards-como-test, régimen CI
**Confidence global:** HIGH (todo verificado ejecutando comandos contra el repo; cero red)
**Alcance:** SOLO 133-a. Nada de golden set, etiquetado, kappas ni arbitraje.

---

<user_constraints>
## User Constraints (de 133-CONTEXT.md — LOCKED por firma del operador 2026-08-06)

### Locked Decisions

Copiadas del `<decisions>` de `133-CONTEXT.md`. **No se re-abren, no se "mejoran" en el plan.**

- **Taxonomía (D-133-A2):** regla de decidibilidad textual; 5 clases sustantivas + `ambiguo`,
  precedencia `1 > 2 > 3 > 4 > 5` (`tramitacion_legislativa` > `actividad_parlamentaria` >
  `ley_vigente` > `politica_no_legislativa` > `no_legislativa`); `ambiguo` es escape, no nivel.
  `agenda_ejecutivo` NO existe (fusionada en `politica_no_legislativa`). `ley_vigente` por marca
  textual, **sin** la cláusula "si hay una modificación en trámite". Mono-etiqueta. La taxonomía
  **no nombra sujetos**. Enrutamiento: 1 y 3 → ficha de proyecto; 2 → ficha de persona;
  4, 5, `ambiguo` → ninguna ficha. Single source of truth:
  `packages/news/src/eval/taxonomia.ts`; prohibido re-escribir las etiquetas a mano en otro lugar.
- **Guards (D-133-A2.4):** **G1** `TERMINOS_PROHIBIDOS`/`NEGACIONES_LOCKED` sobre cada string de
  `taxonomia.ts`; **G2** falla si un literal de etiqueta aparece en superficie renderizada de `app/`;
  **G3** el `try/catch continue` de `app/lib/anti-insinuacion-guard.test.ts:943-948` pasa a fallo
  duro. Los tres con **control positivo apareado que difiere en UNA sola variable** y **prueba de
  mutación**.
- **Umbrales (D-133-D2) → `thresholds.json` en 133-a:** T1 `tasa_etiqueta_fuera_de_lista` = 0,00
  (VETO) · T2 `tasa_parse_fallido` ≤ 0,02 (VETO) · T3 `exactitud_macro` ≥ 0,80, n≥8 por clase,
  ≥3 clases (VETO) · T4 `recall_tramitacion_legislativa` ≥ 0,85, n ≥ 25 (VETO; si n<25 `no-medido`
  y la clase no enruta) · T5 `precision_no_legislativa` ≥ 0,90, n ≥ 25 (ídem) · **T9**
  `precision_actividad_parlamentaria` ≥ 0,90, n ≥ 25 (ídem) · T6 `costo_usd_por_100_items` ≤ 0,05
  (informativo, desempata) · T7 `latencia_p50_ms` ≤ 5.000 (informativo, desempata) · T8
  `tasa_ambiguo_modelo` vs `tasa_ambiguo_humano` (informativo). Regla de intervalos uniforme:
  toda cifra con `n` e IC95; vetos sobre la estimación puntual; IC95 que cruza el umbral ⇒
  `dentro-del-ruido` con ambos números; desempate por solapamiento de IC95, no por 6 pp.
  Refutación pre-registrada + refutación parcial (T9 falla o `no-medido` ⇒ el enrutamiento a
  fichas de persona no entra a producción). Granite candidato, sin transferencia de dominio.
- **Congelación (D-133-E2):** se hashean **3 JSON canonicalizados**, **jamás el `.ts`**.
  Canonicalización: claves ordenadas ascendentemente por code unit UTF-16, **recursiva**; **arrays
  NO se reordenan**; indentación 2 espacios; **LF**; UTF-8 **sin BOM**; newline final; hash =
  sha256 sobre esos bytes. `.gitattributes` es la **primera tarea**: patrón
  `packages/news/src/eval/**/*.json text eol=lf`, `git add --renormalize`, y control positivo
  (clon limpio → los tres sha256 coinciden). `congelado.test.ts` re-calcula los hashes **y**
  asserta que la última entrada de `CONGELADO.md` contiene exactamente los tres hashes vigentes.
  Cambio legítimo = **un commit con las tres cosas**. Limitación declarada: la firma sigue siendo
  un string en un markdown; el control real es el commit en git.
- **Re-runnabilidad (D-133-F2) — en 133-a solo esquema y límite:** cada caso golden guarda puntero
  Y payload con el esquema `caso_id`, `procedencia` (`r2_path`, `url_hash`, `url_canonica`,
  `outlet`, `fecha_captura`, `fecha_pub`), `entrada` (`titulo`, `descripcion`), `entrada_llm`,
  `estrato` (`P` | `N-alea` | `N-sonda` | `P-dirigido`), `prefiltro` (`paso`, `terminos`),
  `etiqueta`, `revision` (`etiqueta_a`, `etiqueta_b`, `justificacion_a`, `justificacion_b`,
  `acuerdo`, `resuelto_por` ∈ {`acuerdo`,`operador`,`no_arbitrado`}, `modelo_a`, `modelo_b`,
  `en_calibracion_humana`, `etiqueta_humana`, `revisado_en`). **`entrada_llm` importa la MISMA
  función de truncado de `prefiltro-lexico.ts`** — no una constante replicada. Chequeo de cobertura
  antes de etiquetar: fracción de casos P cuyos `prefiltro.terminos` están todos dentro de
  `entrada_llm`; **< 95 % ⇒ el límite sube antes de etiquetar un solo caso**. Copyright/PII: solo
  titular + descripción del RSS, cero full-text, cero PII añadida, cero cruce con `parlamentario`,
  cero causalidad ni intención.

### Claude's Discretion

- Nombres de archivo internos de `packages/news/src/eval/` más allá de los cinco congelados.
- Forma exacta del script de canonicalización (CLI, función exportada, o ambos) y cómo se invoca.
- Cómo se tipa el caso golden (zod, type + validador, o ambos) — mientras el esquema sea el de arriba.
- Estructura interna de `taxonomia.ts` (array congelado con `Object.freeze`, tipos derivados) —
  mientras la precedencia viva en el **orden del array** y la proyección sea determinista.
- Cómo G2 enumera las superficies renderizadas de `app/` — mientras no herede el skip silencioso.

### Deferred Ideas (OUT OF SCOPE)

- **Todo 133-b** (golden set, etiquetado, kappas, arbitraje, congelación de `golden-set.json`).
- **Página pública "Cómo clasificamos las noticias"** — entregable de la Phase 137. En 133-a solo
  se congela **que existe y qué debe contener**.
- **Deuda arquitectónica para la Phase 134:** `extraerBoletines` vive en
  `app/lib/boletin-en-materia.ts:58`, no en `packages/`. Problema de 134.
- **Enmienda al SC1 de la Phase 134** — se tramita aparte, con su texto y su firma.
- **Ampliar `VOCABULARIO_LEGISLATIVO`** — 133-b/plan, con test. Solo se AMPLÍA, nunca se poda.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Descripción (`.planning/REQUIREMENTS.md:28`) | Qué de este research lo habilita |
|----|---|---|
| **NEWS-03** | "Taxonomía legislativa definida y CONGELADA antes de medir; golden set propio con etiquetas revisadas ANTES de cualquier benchmark; thresholds pre-registrados y congelados; el input crudo que el LLM vio se guarda re-runnable." | **133-a cubre las partes 1, 3 y el esquema de la 4.** La parte 2 (golden set etiquetado) es 133-b. Habilitadores concretos: §A (paquete `@obs/news` y su suite) · §C (precedente completo de freeze por sha256 en `packages/llm-bench/src/guards/freeze.ts`) · §F (`.gitattributes` + `--renormalize` verificado empíricamente) · §B (la función de truncado a importar para `entrada_llm`) · §D/E (G1/G2/G3). |

**SC de la Phase 133 (`.planning/ROADMAP.md:216-222`) alcanzables en 133-a:** SC1 (taxonomía
congelada por hash) y SC3 (thresholds pre-registrados y congelados). SC2 y SC4 requieren muestra ⇒ 133-b.
</phase_requirements>

---

## Summary

El repo tiene **todos los patrones que 133-a necesita ya construidos y vivos** — no hay que inventar
nada. Existe un precedente literal de congelación por sha256 con marcador y meta-test de mutación
(`packages/llm-bench/src/guards/freeze.ts` + `packages/llm-bench/src/tasks/*/disjuncion.test.ts`),
existe un patrón no-frágil de enumeración de archivos (`walkSourceFiles` en
`app/lib/lockdown-guard.test.ts:113`), existe un guard-of-the-guards contra el filesystem
(`app/lib/create-view-guard.test.ts:404-452`), y existen los fixtures-en-memoria-por-el-detector-real
que G1 debe copiar (`app/lib/anti-insinuacion-guard.test.ts:1034-1086`).

Tres hallazgos cambian materialmente el plan respecto de lo que la re-adjudicación asume:

1. **G3 se puede activar HOY sin poner la suite roja: los 63 archivos del allowlist existen, cero
   faltantes** (verificado por script). El premortem tenía razón sobre el agujero, pero el agujero
   está *vacío* en este momento. G3 es una tarea barata y sin riesgo — y por eso mismo debe hacerse
   ahora, antes de que alguien mueva un archivo.
2. **CI NO corre `@obs/news`.** `.github/workflows/ci.yml:40-64` corre `./app`, `@obs/llm` y
   `@obs/cruces` y nada más. Un G1/G2 que viva en `packages/news/src/eval/` nace **CI-dark** — el
   Pitfall 8 que el propio `packages/news/vitest.config.ts:1-2` documenta. El plan DEBE añadir un
   step de CI, o los guards son decorativos.
3. **`app/` no depende de ningún `@obs/*`, por régimen deliberado y documentado**
   (`app/lib/week-utils.ts:3`, `app/lib/types.ts:4`, `app/lib/name-match-rut-guard.test.ts:79`).
   Esto tensiona la orden LOCKED "prohibido re-escribir las etiquetas a mano en ningún otro lugar"
   contra dónde puede vivir G2. Hay una salida limpia (§E), pero el plan debe elegirla a conciencia.

**Recomendación primaria:** copiar el molde `llm-bench/guards/freeze.ts` + `disjuncion.test.ts` para
`congelado.test.ts`; poner G1 y G2 en `packages/news/src/eval/` (G2 lee `app/` por **disco**, vía
`findWorkspaceRoot`, nunca por `import`); añadir un step de CI para `@obs/news` en el mismo commit;
y extraer `truncarDescripcion()` de `prefiltro-lexico.ts` como export nuevo con diff-cero de
comportamiento.

---

## A. `packages/news` como paquete — cómo se corre y qué imprime

**Confianza: HIGH.** Verificado leyendo los archivos y **ejecutando la suite**.

| Propiedad | Valor | Evidencia |
|---|---|---|
| Nombre | `@obs/news` | `packages/news/package.json:2` |
| Entrypoint / types / exports | `src/index.ts` (los tres) | `packages/news/package.json:6-10` |
| Script de test | `"test": "vitest run"` | `packages/news/package.json:12` |
| Script de typecheck | `"typecheck": "tsc -b"` | `packages/news/package.json:13` |
| Deps relevantes | `zod@^4.4.3`, `fast-xml-parser@^5.9.2`, `@obs/core`, `@obs/ingest` | `packages/news/package.json:16-22` |
| vitest config | propio, `include: ["src/**/*.test.ts"]`, `passWithNoTests: true` | `packages/news/vitest.config.ts:8-9` |
| tsconfig | `composite: true`, `rootDir: "src"`, `include: ["src/**/*.ts"]`, `exclude: ["src/**/*.test.ts", …]` | `packages/news/tsconfig.json` |
| Referenciado desde la raíz | sí | `tsconfig.json:9` (`{ "path": "./packages/news" }`) |

### Cómo se invoca la suite y qué imprime EXACTAMENTE

```bash
pnpm --filter @obs/news exec vitest run
```

Salida real (ejecutada 2026-08-06, cola literal):

```
 Test Files  12 passed (12)
      Tests  206 passed (206)
```

**Los 206 tests confirmados**, repartidos en 12 archivos. Desglose impreso:
`prefiltro-lexico.test.ts (32)`, `parse-rss.test.ts (32)`, `run-news-cli.test.ts (32)`,
`connector-news.test.ts (26)`, `carga-run.test.ts (17)`, `canonicalizar-url.test.ts (11)`,
`allowlist-news.test.ts (9)`, `replay.test.ts (4)` + 4 más.

**Para assertar el conteo en un `<acceptance_criteria>`** (el criterio de D-133-E2.3: nunca el exit
code solo): la línea a grepear es `Tests  N passed (N)` — dos espacios tras `Tests`, y viene con
códigos ANSI intercalados (`[1m[32m206 passed[39m[22m`). Patrón robusto:

```bash
pnpm --filter @obs/news exec vitest run 2>&1 | tee /tmp/news.log
grep -Eq 'Tests[^0-9]+([0-9]+) passed' /tmp/news.log   # existe la línea
grep -oE 'Tests[^0-9]+[0-9]+ passed' /tmp/news.log      # extraer el número
```

Nota: `pnpm --filter @obs/news test` también sirve, pero **`pnpm --filter @obs/news exec vitest run
<archivo>` es el idiom del repo** para correr un subconjunto (así lo hace el script `guards` de la
raíz, `package.json:14`) — y recordar el gotcha LOCKED: **los args de `vitest run` son filtros de
nombre, no rutas**, y con `passWithNoTests: true` un nombre fantasma sale 0 en silencio.

### TS18003 — el gotcha **no aplica** a `src/eval/`

`packages/news` **ya es** un proyecto `composite` con `.ts` dentro (`tsconfig.json:5`, y
`include: ["src/**/*.ts"]` cubre `src/eval/` recursivamente). TS18003 ("no inputs found") solo
dispara en un proyecto composite **sin ningún archivo de entrada** — es decir, al crear un
**paquete** nuevo, no un **directorio** nuevo. Un `src/eval/taxonomia.ts` desde la primera tarea
basta y `tsc -b` sigue verde. **Verificado:** `pnpm --filter @obs/news exec tsc -b --force` → rc=0
hoy, sin `src/eval/`.

### ⚠️ El gotcha REAL de `tsc -b` que sí aplica: `include` no cubre `.json`

`packages/news/tsconfig.json` incluye **solo** `"src/**/*.ts"`. En un proyecto `composite`,
importar `./taxonomia.json` desde un `.ts` de producción hace que TS lo trate como input del
proyecto y falle con **TS6307** ("File is not listed within the file list of the project").

El precedente lo resolvió: `packages/llm-bench/tsconfig.json:12` declara
`"include": ["src/**/*.ts", "src/**/*.json"]` — exactamente por esto, porque
`disjuncion.test.ts:18-20` importa tres `.json` con `with { type: "json" }`.

**Tarea derivada, temprana:** añadir `"src/**/*.json"` al `include` de
`packages/news/tsconfig.json`, o mantener toda lectura de JSON por `readFileSync` (que no crea
input de TS). La segunda opción es de hecho la que `congelado.test.ts` necesita igual, porque para
hashear hacen falta los **bytes**, no el objeto parseado.

**Segundo gotcha de tsconfig:** `exclude: ["src/**/*.test.ts"]` ⇒ **los guards NO se typechequean
por `tsc -b`**. Un error de tipos en `taxonomia-guard.test.ts` solo aparece al correr vitest.

### El barrel es aditivo-seguro

`packages/news/src/run-news-cli.test.ts:581-604` verifica el barrel con una lista blanca de 15
símbolos y `toBeGreaterThanOrEqual(8)` — **no** es exhaustivo. Exportar símbolos nuevos desde
`index.ts` (p. ej. `TAXONOMIA`, `truncarDescripcion`) **no rompe nada**. Confianza HIGH.

---

## B. `prefiltro-lexico.ts` — la función de truncado y qué está exportado

**Confianza: HIGH.** Verificado leyendo el archivo completo (146 líneas) y su barrel.

### Superficie de export actual

| Símbolo | Línea | ¿Exportado? | ¿En el barrel? |
|---|---|---|---|
| `VOCABULARIO_LEGISLATIVO` | `:16` | ✅ `export const` | ✅ `index.ts:29` |
| `LIMITE_DESCRIPCION = 600` | `:50` | ❌ **privado del módulo** | ❌ |
| `FRONTERA` | `:53` | ❌ privado | ❌ |
| `escaparRegExp` | `:55` | ❌ privado | ❌ |
| `PATRONES` | `:65` | ❌ privado | ❌ |
| `despojarHtml` | `:77` | ✅ | ✅ `index.ts:28` |
| `fold` | `:93` | ✅ | ✅ `index.ts:28` |
| `MARGEN_TRUNCADO` | `:107` | ❌ **privado** | ❌ |
| **`construirTexto`** | **`:109`** | ❌ **privado — ESTA es la función de truncado** | ❌ |
| `esLegislativo` | `:132` | ✅ | ✅ `index.ts:25` |
| `terminosQueMatchean` | `:142` | ✅ | ✅ `index.ts:26` |

### La secuencia exacta y sobre qué texto corre el matching

`construirTexto(titulo, descripcion)` (`:109-123`):

1. **Título:** `fold(despojarHtml(titulo))` — `:110`. **Sin truncar. El título nunca se trunca.**
2. **Descripción:** `dFold = fold(despojarHtml(descripcion ?? ""))` — `:118`. Es decir el orden es
   **despojo HTML → fold → truncado**, y el truncado opera sobre texto **ya foldeado** (sin tildes,
   minúsculas, espacios colapsados).
3. **Truncado (`:119-121`):**
   ```ts
   const d = dFold
     .slice(0, LIMITE_DESCRIPCION + MARGEN_TRUNCADO)   // 600 + 15 = 615
     .replace(/\S*$/, "");                             // limpia la cola parcial
   ```
   `MARGEN_TRUNCADO = Math.max(...VOCABULARIO_LEGISLATIVO.map(t => t.length))` (`:107`) —
   **derivado, no mágico** (WR-13): hoy vale **15** (`"tribunal constitucional"` tiene 22… en
   realidad el máximo es `"tribunal constitucional"` = 23 chars; el valor exacto se calcula en
   runtime — el plan no debe hardcodearlo). El margen existe para que cortar en seco a 600 no parta
   un término del vocabulario y fabrique un falso negativo permanente (`:111-117`).
4. **Retorno:** `` `${t} ${d}` `` — `:122`. **Un solo string, título y descripción concatenados.**
5. El matching (`esLegislativo :133`, `terminosQueMatchean :143`) corre sobre **ese** string
   concatenado y foldeado, con `PATRONES` de frontera de palabra. `String.includes` está PROHIBIDO
   (`:127-128`).

### Qué hay que exportar para D-133-F2, y si rompe algo

**Nada rompe.** Exportar es aditivo; el único test que mira la superficie del módulo es el barrel
(§A), que es aditivo-seguro. Verificado: `packages/news/src/carga-run.test.ts:4` importa el módulo
con `import * as prefiltro` pero solo para espiar funciones, no para assertar la lista de exports.

Lo mínimo a exportar depende de la forma elegida. **Recomendación: extraer una función pura nueva**
en vez de exportar `construirTexto` tal cual:

```ts
/** Trunca una descripción ya foldeada al límite del pre-filtro, en frontera de palabra. */
export function truncarDescripcion(dFold: string): string {
  return dFold.slice(0, LIMITE_DESCRIPCION + MARGEN_TRUNCADO).replace(/\S*$/, "");
}
```

…y reescribir `construirTexto:118-121` para llamarla. **Diff-cero de comportamiento demostrable**
por la suite existente (`prefiltro-lexico.test.ts`, 32 tests, incluido el de frontera de palabra en
`:188-192` que ejercita justamente el corte a 600).

### ⚠️ CONFLICTO parcial con lo firmado — leer antes de planificar

Ver §J-1. En resumen: `construirTexto` trunca texto **foldeado** (sin tildes, lowercase). Si
`entrada_llm` llama literalmente a la misma función, el golden guardaría un texto **sin tildes y en
minúsculas** — inservible como input de un LLM que debe leer prensa chilena, y contrario a
"solo titular + descripción del RSS" (D-133-F2). La decisión LOCKED es *importar la misma función de
truncado*, no *importar la misma función de normalización*. La implementación fiel a la intención es
la extracción de `truncarDescripcion` de arriba, aplicada a la descripción **despojada pero sin
foldear**. El plan debe declarar esto explícitamente, porque el resultado deja de ser byte-idéntico
al del pre-filtro (los caracteres acentuados sobreviven al `slice` con la misma longitud, así que el
corte cae en el mismo índice de caracteres — pero el plan debe escribir un test que lo pruebe, no
asumirlo).

### El chequeo de cobertura de `prefiltro.terminos` (D-133-F2.2)

Detalle que el plan debe internalizar: `prefiltro.terminos` son los **términos del vocabulario ya
foldeados** (`prefiltro-lexico.ts:12-13`, `:144` devuelve `termino` del array). Comprobar si están
"dentro de `entrada_llm`" exige **foldear `entrada_llm` primero** y usar los mismos `PATRONES` de
frontera de palabra — no `String.includes`, que está prohibido por régimen (`:127-128`). En 133-a
solo se construye el chequeo; correrlo es 133-b (no hay casos P).

---

## C. Canonicalización JSON, sha256, LF y BOM — el precedente ya existe

**Confianza: HIGH.** Verificado leyendo los tres módulos y ejecutando `git config`.

### Ya existe un módulo de freeze por sha256, con su consumidor

`packages/llm-bench/src/guards/freeze.ts` (53 líneas) — **es el molde exacto de `congelado.test.ts`**:

- `FreezeMarker` (`:17-26`): `{ hash, fecha, n_casos, estratos }`.
- `hashCasos(raw: string): string` (`:34-36`): `createHash("sha256").update(raw).digest("hex")`.
  JSDoc `:29-32`: *"NUNCA hash artesanal… se pasa el string leído con `readFileSync(path, "utf8")`
  para que el hash sea reproducible byte-a-byte"*.
- `assertFrozen(rawBytes, marker)` (`:43-52`): lanza `FREEZE ROTO: …` si difiere.

Su consumidor `packages/llm-bench/src/tasks/clasificacion/disjuncion.test.ts:52-70` es literalmente
la estructura que 133-a necesita:

```ts
const RAW = readFileSync(CASOS_PATH, "utf8");                    // :24
it("el sha256 vivo de casos.json coincide con el marcador", …)   // :53
it("assertFrozen no lanza con el marcador correcto", …)          // :57
it("meta: assertFrozen LANZA si el hash derivó (guard vivo)", …) // :61  ← prueba de mutación
it("el marcador declara n_casos coherente con el set", …)        // :66
```

**Decisión de plan:** `packages/news` **no** debe depender de `@obs/llm-bench` (llm-bench depende de
`@obs/llm`, arrastraría medio grafo). Copiar el patrón, no el paquete — y decirlo en el JSDoc,
citando la ruta origen. Es la práctica del repo (`packages/news/vitest.config.ts:3` ya dice
*"Analog literal de packages/tramitacion/vitest.config.ts"*).

### Canonicalización de claves — el precedente parcial

`packages/identity/src/backup.ts:64-80` tiene `withSortedKeys` + `serializeMaestra`:

```ts
for (const k of Object.keys(src).sort()) { out[k] = src[k]; }
...
return JSON.stringify(ordenadas, null, 2) + "\n";
```

Cubre 3 de los 5 requisitos de D-133-E2: claves ordenadas, 2 espacios, newline final.
**NO cubre:** recursividad (es shallow, un solo nivel) ni la garantía de "arrays no se reordenan"
(aquí sí ordena filas, `:59-61` — lo cual es correcto para su caso pero **prohibido** para el
nuestro). El plan escribe su propia canonicalización recursiva; `backup.ts:64-80` es el ejemplo
de estilo, no la implementación a reusar.

Punto fino sobre el orden de claves: `Object.keys(x).sort()` en JS ordena por **code unit UTF-16**
por defecto (`Array.prototype.sort` sin comparador convierte a string y compara por code unit) —
que es **exactamente** lo que D-133-E2 pide. No usar `localeCompare` (dependería del locale y
rompería la reproducibilidad entre máquinas). Confianza HIGH.

### LF, BOM y `writeFile` en Windows

- **Node NUNCA traduce newlines.** `writeFileSync(path, content, "utf8")` escribe exactamente los
  bytes del string. Si el string usa `"\n"`, el archivo queda con LF **en Windows también**. No hay
  API que meta CRLF salvo que el propio string lo lleve. Precedentes en el repo:
  `packages/fichas/src/spike/embed-cache.ts:61`, `packages/identity/src/writer-fs.ts:29`.
- **Node nunca escribe BOM.** El BOM solo aparece si el string empieza por `U+FEFF`. El repo tiene
  el patrón inverso (leer BOM-safe): `packages/news/src/run-news-cli.ts:208`
  `.replace(/^<BOM>/, "")` (el literal BOM, U+FEFF). Para *escribir*, no hay nada que hacer.
- **El riesgo de CRLF es de git, no de Node** — checkout con normalización. Ver §F.
- **Assert defensivo recomendado en `congelado.test.ts`** (barato y cierra el modo de fallo):
  ```ts
  expect(RAW.includes("\r")).toBe(false);       // cero CRLF
  expect(RAW.charCodeAt(0)).not.toBe(0xfeff);   // cero BOM
  expect(RAW.endsWith("\n")).toBe(true);        // newline final
  ```
  Con su control positivo apareado: el mismo assert sobre un fixture en memoria **con** `\r` debe
  fallar.

---

## D. G3 — el skip silencioso: **cero archivos faltantes hoy**

**Confianza: HIGH.** Verificado por script sobre los 14 arrays de superficies.

### Anatomía del guard

| Pieza | Ubicación | Nota |
|---|---|---|
| `APP_ROOT` | `app/lib/anti-insinuacion-guard.test.ts:68` | `path.resolve(import.meta.dirname, "..")` → escanea SOLO `app/`. Anclado a `import.meta.dirname` a propósito (WR-06, bug `process.cwd` de v8.1). |
| Los 14 arrays `SUPERFICIES_*` | `:104, 128, 149, 164, 188, 221, 265, 283, 324, 364, 392, 425, 472, 514` | Allowlists explícitos de rutas relativas a `app/`. |
| `TERMINOS_LINK_EXT` | `:569` | Sub-lista, entra por spread. |
| `TERMINOS_COBERTURA` | `:605` | Ídem. |
| **`TERMINOS_PROHIBIDOS`** | **`:623-757`** | `const TERMINOS_PROHIBIDOS: string[] = [...]`, **no exportado**. ~110 entradas + 2 spreads. |
| **`NEGACIONES_LOCKED`** | **`:764-826`** | `const NEGACIONES_LOCKED: string[] = [...]`, **no exportado**. Mezcla literales inline y constantes importadas de producción (`LEYENDA_ANTI_INSINUACION_MONEY`, `LEYENDA_CROSS_LINK`, `LEYENDA_MENCIONES_LOBBY`, `LEYENDA_SIMILITUD_VOTO`, `...IDIOMS_APROBADOS`). |
| `buildTermRegex` / `WORD` | `:834-841` | Límite de palabra tolerante a acentos vía lookarounds. **No** accent-insensitive: las tildes se buscan literales. |
| `detectarInsinuaciones` | `:857-874` | strip comentarios → normalizar whitespace → restar negaciones → matchear. **No exportado.** |
| `detectarTerminos(raw, terminos)` | `:848-855` | Variante con subconjunto de términos. **No exportado.** |
| **`TODAS_LAS_SUPERFICIES`** | **`:864-881`** | `[...new Set([...los 14 arrays])]`. **No exportado.** |
| **Skip silencioso #1** | **`:943-948`** | `try { raw = readFileSync(full,"utf-8") } catch { continue }` en el test (1). |
| **Skip silencioso #2** | **`:974-978`** | El MISMO patrón en el test (1b) WR-03. **La re-adjudicación solo nombra el primero.** |
| Comentario que documenta el agujero | `:610` + `:620-623` | *"las rutas aún ausentes se saltan hoy y MUERDEN recién cuando el archivo exista"* y *"El template del email digest (`packages/notificaciones/src/digest.ts`) vive fuera de `app/` (APP_ROOT) → NO se escanea aquí"*. |
| Guard-of-the-guards del script | `app/lib/create-view-guard.test.ts:404-452` | Ver §H. |

### 🟢 LA RESPUESTA A LA PREGUNTA CLAVE: 0 faltantes

Script ejecutado (extrae los literales de los 14 arrays, dedupea, y comprueba `existsSync("app/"+p)`):

```
SUPERFICIES_VOTO 7 | missing: -        SUPERFICIES_PANEL 8 | missing: -
SUPERFICIES_MONEY 6 | missing: -       SUPERFICIES_RELACIONES 4 | missing: -
SUPERFICIES_HOME 2 | missing: -        SUPERFICIES_VSIM 1 | missing: -
SUPERFICIES_BUSQUEDA 2 | missing: -    SUPERFICIES_NOTIF 5 | missing: -
SUPERFICIES_PERSONAS 7 | missing: -    SUPERFICIES_LINK_EXT 5 | missing: -
SUPERFICIES_LOBBY 3 | missing: -       SUPERFICIES_FECHA 20 | missing: -
SUPERFICIES_AGENDA 5 | missing: -
total rutas declaradas (dedupe): 63    FALTANTES: 0
```

**Implicación de planificación (grande):** convertir el `catch { continue }` en fallo duro **NO pone
la suite roja**. G3 es una tarea de bajo riesgo, sin ajuste de allowlist (D-133-A2.4 preveía
"se ajusta el allowlist en el mismo commit si algún archivo se movió legítimamente" — hoy no hace
falta). El plan **no** debe reservar presupuesto para reparar el allowlist; sí debe reservarlo para
el control positivo apareado y la prueba de mutación.

**Diseño recomendado de G3** (cierra los DOS skips, no solo el que nombra la re-adjudicación):

1. Extraer un helper `leerSuperficie(rel: string): string` que **lanza** con mensaje accionable
   (`"Superficie declarada inexistente: <rel>. Un allowlist con una ruta muerta es un guard ciego
   que sale verde. Si el archivo se movió, corrige la ruta; si se borró, quita la entrada."`).
2. Usarlo en `:943` y en `:974`.
3. **Test nuevo de no-hueco**, con piso duro contra cero-vacuo:
   `expect(TODAS_LAS_SUPERFICIES.length).toBe(63)` — y que cada ruta existe.
   (El repo ya usa este idiom de piso: `create-view-guard.test.ts:425-433`,
   `lockdown-guard.test.ts:736`.)
4. **Prueba de mutación:** el helper con una ruta inventada debe lanzar. Cero contacto con disco
   ajeno al fixture.
5. **Control positivo apareado que difiere en UNA variable:** dos llamadas a `leerSuperficie`, una
   con una ruta real del allowlist (pasa) y otra con la MISMA ruta + `".noexiste"` (falla). Una sola
   variable: la existencia del archivo.

### `TERMINOS_PROHIBIDOS` / `NEGACIONES_LOCKED` — cómo los usa G1 desde `packages/news`

**Están declarados dentro del `.test.ts`, sin `export`, y en un módulo que además importa de
`@/lib/*` y `@/components/*` (alias de `app/`).** Importarlos desde `packages/news` es
**imposible en la práctica**: (a) no están exportados; (b) invertiría la dirección de dependencia
del monorepo; (c) el alias `@` solo existe en `app/vitest.config.ts:7`; (d) `NEGACIONES_LOCKED`
importa componentes `.tsx` que exigen jsdom + el setup de app.

**Tres vías, ordenadas por limpieza:**

| Vía | Cómo | Coste | Veredicto |
|---|---|---|---|
| **A — leer el `.test.ts` como TEXTO y extraer los literales** | `readFileSync` del guard + parseo de los arrays `TERMINOS_PROHIBIDOS` / `NEGACIONES_LOCKED` por regex, con un **piso duro** (`expect(terminos.length).toBeGreaterThanOrEqual(100)`) que hace ruidoso cualquier fallo de extracción | ~40 líneas; frágil al formato | ⚠️ Funciona (es lo que hice para contar los 63), pero un refactor del guard lo rompe en silencio si falta el piso. Con el piso, es aceptable. |
| **B — extraer los dos arrays a un módulo propio** en `app/lib/terminos-insinuacion.ts` (sin JSX, sin imports de componentes) y que el guard existente lo importe | El guard pasa a `import { TERMINOS_PROHIBIDOS_BASE } from "./terminos-insinuacion"`; G1 lo lee **por disco desde `packages/news`** o replica solo la ruta | Toca el guard más sensible del repo | ✅ **Recomendada.** Es el patrón que el propio guard ya usa para `IDIOMS_APROBADOS` (`@/lib/idioms-panel`, ver JSDoc `:759-768`: *"FIX B-4: dirección prod→test… este archivo IMPORTA el array, no lo re-tipea, así un stem mal escrito rompe el import en vez de divergir en silencio entre dos copias"*). Nota: `NEGACIONES_LOCKED` **no** se puede mover entero (importa componentes); solo `TERMINOS_PROHIBIDOS` y sus sub-listas. G1 necesita principalmente los prohibidos — la taxonomía no debería contener ninguna negación LOCKED. |
| **C — replicar la lista en `packages/news`** | copy-paste | — | ❌ **PROHIBIDA.** Es literalmente "la deuda de ICS en miniatura" que D-133-F2 nombra. |

Sea A o B, G1 debe además **implementar su propio `buildTermRegex`**, porque el de `:834-841`
tampoco está exportado y su semántica (lookarounds sobre `WORD` con acentos) es parte del contrato.
Copiarlo verbatim con cita de origen es el precedente del repo
(`anti-insinuacion-guard.test.ts:1-2` se declara *"Espejo EXACTO de lockdown-guard.test.ts"*).

---

## E. G2 — enumerar superficies renderizadas de `app/` sin heredar el skip

**Confianza: HIGH** para los patrones; **MEDIUM** para la elección de ubicación (depende de una
decisión de plan).

### Patrón no-frágil que YA existe: `walkSourceFiles`

`app/lib/lockdown-guard.test.ts:113-135`:

```ts
const SKIP_DIRS = new Set(["node_modules",".next",".open-next",".turbo","dist",
                           "coverage",".vercel",".wrangler"]);   // :102-111
function walkSourceFiles(dir: string): string[] {
  ...
  } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
    out.push(full);
  }
}
```

Usado en `:733` con su **anti-cero-vacuo** en `:736`:
`expect(sourceFiles.length).toBeGreaterThan(10);`

**Modos de fallo del patrón, que el plan debe cerrar:**

1. **Cero-vacuo silencioso.** `walkSourceFiles` tiene `try { readdirSync } catch { return out }`
   (`:116-120`) — si la raíz está mal resuelta devuelve `[]` y el guard pasa verde habiendo
   escaneado nada. El piso de `:736` es la mitigación, pero es un `>10`, demasiado laxo. Para G2
   usar un piso realista y verificable: hoy `app/` tiene cientos de `.ts`/`.tsx`; un
   `toBeGreaterThan(100)` es honesto. **Añadir además el sanity de archivo concreto**, que es el
   idiom del guard existente (`anti-insinuacion-guard.test.ts:920-932`: lee
   `components/votos-por-parlamentario.tsx` y asserta `length > 100`).
2. **Sobre-cobertura.** Un walk de `app/` incluye `lib/`, `app/api/`, y todo lo no-renderizado. Para
   G2 eso es **una virtud, no un defecto**: la orden LOCKED es "ningún literal de etiqueta aparece
   en una superficie renderizada de `app/`", y un walk que cubre de más nunca produce un falso
   verde — solo falsos rojos, que son ruidosos y se resuelven registrando la excepción. Es
   estrictamente más seguro que un allowlist. **Recomendación: walk completo de `app/`, sin
   allowlist.** Eso también es lo que mata el modo de fallo P-01 del premortem de raíz.
3. **`.test.ts` excluidos** por el filtro de `:132`. Correcto: si G2 escaneara los tests, se cazaría
   a sí mismo (contiene los literales por construcción). Ojo: G1 y G2 mismos deben estar en el
   filtro de exclusión — el filtro `!/\.test\.(ts|tsx)$/` ya lo hace si viven como `*.test.ts`.
4. **`stripTsComments`.** Un literal de etiqueta mencionado en un comentario JSDoc de `app/` no es
   copy renderizado. Reusar el patrón de `anti-insinuacion-guard.test.ts:81-95` (con su cuidado del
   `://` en URLs, WR-05) o declarar explícitamente que G2 **no** strippea comentarios y por tanto
   es más estricto. Lo segundo es más simple y más seguro; el plan debe elegir y escribirlo.

### ⚠️ Dónde vive G2 — la tensión con el régimen de desacoplamiento de `app/`

**Hallazgo verificado:** `app/package.json` **no declara ninguna dependencia `@obs/*`**
(`dependencies` `:17-34` y `devDependencies` — cero). Las menciones de `@obs/` en `app/` son todas
comentarios que documentan la duplicación deliberada:

- `app/lib/week-utils.ts:3` — *"de `@obs/agenda` (`semana-iso.ts`) pero viven en el frontend para no
  acoplar…"*
- `app/lib/types.ts:4` — *"de `@obs/tramitacion` sin acoplar el frontend al paquete del backend"*
- `app/lib/name-match-rut-guard.test.ts:79` — *"el frontend `app/` NO depende de
  `@obs/dinero`/`@obs/adjudication`/`@obs/core`"*

Y `app/tsconfig.json` solo tiene `paths: { "@/*": ["./*"] }` — no resuelve `@obs/*`.

Esto crea un dilema real:

| Opción | Dónde vive G2 | Cómo obtiene los literales | Pros | Contras |
|---|---|---|---|---|
| **G2-app** | `app/lib/taxonomia-superficie-guard.test.ts` | `import { TAXONOMIA } from "@obs/news"` | Corre en CI hoy (`ci.yml:47`); entra a `pnpm guards` **por obligación** (§H) | Rompe un régimen documentado en 3 lugares: añade la primera dep `@obs/*` de `app/` + entrada en tsconfig paths + riesgo de arrastrar `zod`/`fast-xml-parser`/`@supabase` al bundle del frontend vía typecheck |
| **G2-app-replicado** | ídem, con los 6 literales re-tipeados | copy-paste | Cero acoplamiento | ❌ **Viola D-133-A2** ("prohibido re-escribir las etiquetas a mano en ningún otro lugar") |
| **✅ G2-news** | `packages/news/src/eval/taxonomia-superficie-guard.test.ts` | `import { TAXONOMIA } from "./taxonomia"` (misma carpeta) + lee `app/` **por disco** | Cero import cross-boundary (leer bytes no crea arista en el grafo de módulos); single-source respetado; no toca `app/` | **CI-dark** hasta que el plan añada el step (§H). Y hay que localizar `app/` de forma robusta |

**Recomendación: G2-news.** Para localizar `app/` de forma no-frágil, el repo ya exporta la
herramienta exacta: `findWorkspaceRoot(start)` en `packages/news/src/run-news-cli.ts:190-202`
(sube hasta encontrar `pnpm-workspace.yaml`, **lanza** si no lo encuentra — fail-loud, no skip), ya
exportada por el barrel (`packages/news/src/index.ts:46`).

```ts
const APP_ROOT = join(findWorkspaceRoot(import.meta.dirname), "app");
```

Esto es estrictamente mejor que `resolve(import.meta.dirname, "../../../../app")`, que es el tipo de
ruta relativa que se rompe en silencio al mover un archivo. **Nota:** no hay hoy ningún test en
`packages/*/src` que lea fuera de su paquete (verificado por grep) — G2 sería el primero. El plan
debe justificarlo en el JSDoc: *lectura de bytes, no import; la dirección del grafo de módulos no se
invierte.*

---

## F. `.gitattributes`, `--renormalize` y el control positivo del hash

**Confianza: HIGH.** Verificado con `git config` y con un experimento en un **clon temporal**
(desechado tras la prueba; el repo real no fue tocado).

### Estado de partida

| Hecho | Verificación |
|---|---|
| **`.gitattributes` no existe** en ningún punto del árbol | `git ls-files \| grep -i gitattributes` → vacío |
| `core.autocrlf = false` (local **y** global) | `git config --get core.autocrlf` → `false`; `--global` → `false` |
| `core.eol` sin valor | `git config --get core.eol` → vacío |
| **Ningún `.json` trackeado tiene CRLF hoy** | barrido de 200 `.json` trackeados con `grep -U $'\r'` → 0 hits |

**Lectura honesta:** en ESTA máquina el hash sería estable incluso sin `.gitattributes`. El riesgo
real es (a) otra máquina/CI con `autocrlf=true`, (b) un editor que guarde CRLF, (c) un
`git config` que cambie. `.gitattributes` convierte una propiedad accidental en una garantía — y
sigue siendo la primera tarea LOCKED. Lo que este hallazgo **sí** cambia: el plan no debe esperar
que `--renormalize` produzca un diff. Si no produce ninguno, **eso es el resultado correcto**, no
una señal de que el comando falló.

### `--renormalize` NO toca archivos ajenos — verificado empíricamente

Experimento en clon limpio (`git clone --depth 1 --no-hardlinks` a un directorio temporal):

```
$ printf 'packages/news/src/eval/**/*.json text eol=lf\n' > .gitattributes
$ git add --renormalize -- packages/news/src/eval
$ git status --short
?? .gitattributes
?? packages/news/src/eval/

$ git add --renormalize .           # el caso "peligroso", SIN pathspec
$ git status --short | wc -l
2                                    # los mismos dos untracked. CERO archivos ajenos tocados.
```

**Conclusión (HIGH):** con `core.autocrlf=false` y un `.gitattributes` que solo asigna `text` a
`packages/news/src/eval/**/*.json`, ningún otro archivo tiene el atributo `text` ⇒ git no lo
normaliza ⇒ `--renormalize` es un no-op sobre el resto del repo, con o sin pathspec.
**Recomendación igual: usar el pathspec** (`git add --renormalize -- packages/news/src/eval`) — es
gratis y hace la intención auditable en el commit.

### ⚠️ Gotcha descubierto: `--renormalize` NO añade archivos untracked

En el experimento, tras `git add --renormalize .` los archivos nuevos siguieron en `??`.
`--renormalize` re-aplica los filtros a los archivos **ya trackeados**; no es un `git add` normal.
**Secuencia correcta** (y el orden importa, D-133-E2.1):

```bash
# 1. PRIMERO el .gitattributes, ANTES de commitear ningún JSON
printf 'packages/news/src/eval/**/*.json text eol=lf\n' > .gitattributes
git add .gitattributes

# 2. Recién ahora, generar y añadir los JSON (add normal — son untracked)
node <script de canonicalización>
git add packages/news/src/eval/taxonomia.json packages/news/src/eval/thresholds.json

# 3. Red de seguridad idempotente (no-op si el orden fue correcto; salva si no lo fue)
git add --renormalize -- packages/news/src/eval

# 4. Verificar que el índice tiene LF
git ls-files --eol -- packages/news/src/eval   # debe decir  i/lf  w/lf  attr/text eol=lf
```

`git ls-files --eol` es el chequeo directo del índice y debería ser un criterio de aceptación
(imprime `i/` = índice, `w/` = working tree, `attr/` = atributo aplicado).

### El control positivo del hash — cómo hacerlo en Windows/git-bash

D-133-E2 exige *"clonar limpio en un segundo directorio y verificar que los tres sha256 coinciden"*.
Receta verificada como sintaxis viable (el clon `file://` funcionó en el experimento; ojo con el
espacio en `OneDrive - pjud.cl`, que exige comillas):

```bash
# calcular los hashes en el working tree
cd "<repo>"
for f in taxonomia thresholds golden-set; do
  sha256sum "packages/news/src/eval/$f.json" 2>/dev/null
done | tee /tmp/hashes-wt.txt

# clonar limpio a un segundo directorio y recalcular
T=$(mktemp -d)
git clone -q --no-hardlinks "file://<ruta-absoluta-del-repo>" "$T/clon"
cd "$T/clon"
for f in taxonomia thresholds golden-set; do
  sha256sum "packages/news/src/eval/$f.json" 2>/dev/null
done | sed "s#$T/clon/##" | tee /tmp/hashes-clon.txt

diff <(awk '{print $1}' /tmp/hashes-wt.txt) <(awk '{print $1}' /tmp/hashes-clon.txt)
rm -rf "$T"
```

Cuatro precauciones para que este control positivo no sea él mismo un falso verde:

1. **En 133-a solo existen DOS de los tres JSON** (`golden-set.json` es 133-b). El criterio debe
   decir "dos", no "tres", o el `sha256sum` de un archivo inexistente saldría vacío y el `diff` de
   dos listas vacías **pasaría**. Es el cero-vacuo clásico. Añadir
   `test $(wc -l < /tmp/hashes-clon.txt) -eq 2`.
2. **`set -e` + un comando que debe fallar** = verify inalcanzable (gotcha LOCKED del CONTEXT). Si
   el criterio incluye un caso negativo, usar `if CMD > log 2>&1; then rc=0; else rc=$?; fi`.
3. **El clon debe ser del commit, no del working tree.** `git clone file://<ruta>` clona lo
   commiteado; los JSON tienen que estar commiteados antes de correr el control. Ese es el punto.
4. **Control positivo apareado que difiere en UNA variable:** para probar que el control *muerde*,
   mutar un byte del JSON en el working tree (no commitear) y verificar que el `diff` ahora falla.
   Una sola variable: el contenido del archivo.

---

## G. Patrones de guard con control positivo y prueba de mutación — los mejores ejemplos vivos

**Confianza: HIGH.** Todos leídos directamente.

| # | Patrón | Ruta:línea | Qué copiar |
|---|---|---|---|
| **G-1** | **Freeze por sha256 + meta-test que prueba que muerde** | `packages/llm-bench/src/tasks/clasificacion/disjuncion.test.ts:52-70` (usa `packages/llm-bench/src/guards/freeze.ts:34-52`) | **El molde de `congelado.test.ts`.** 4 tests: hash vivo == marcador · `assertFrozen` no lanza · `meta: assertFrozen LANZA si el hash derivó` (mutación con `{...marker, hash:"f".repeat(64)}`) · coherencia de metadato (`n_casos`). |
| **G-2** | **Fixture EN MEMORIA que pasa por el DETECTOR REAL** | `app/lib/anti-insinuacion-guard.test.ts:1034-1086` (test `(1d)`) | **El molde de G1.** Monta cada string como `` `export const F = <span>${idiom}</span>;` `` y lo pasa por `detectarInsinuaciones` — el mismo detector que corre sobre archivos. Cero contacto con disco. Además su JSDoc `:1017-1032` es un modelo de **alcance honesto**: declara explícitamente que *"NO tiene propiedad de detección sobre el repo… es un ancla de MANTENCIÓN, no un guard automático"*. |
| **G-3** | **Anti-cero-vacuo con `verificados` explícito** | `app/lib/anti-insinuacion-guard.test.ts:1076-1080` | `expect(verificados).toEqual(IDIOMS_FECHA_117)` con el mensaje *"Algún idiom no llegó al detector (¿un `continue`/filtro colado en el bucle?)"*. **Copiar tal cual en G1**: prueba que el bucle recorrió TODOS los strings de la taxonomía, no un subconjunto. Sin esto, un `continue` mal puesto produce un verde vacuo. |
| **G-4** | **Guard-of-the-guards contra el filesystem (bidireccional)** | `app/lib/create-view-guard.test.ts:404-452` | Tres tests: piso anti-cero-vacuo (`:422-433`) · todo guard EN DISCO está en el script (`:435-442`) · el script no tiene nombres fantasma (`:444-451`). **Relevante para G2/G3: al crear un `*guard*.test.ts` en `app/lib/`, este test OBLIGA a añadirlo a `pnpm guards` o se pone rojo.** Ver §H. |
| **G-5** | **Mutation self-check declarado como sección** | `app/lib/anti-insinuacion-guard.test.ts:1197-1200` (`describe("(2) Mutation self-check — el guard SÍ muerde")`), con su JSDoc rector en `:41-45` | La convención de nombres del repo: `it("meta: …")` o `describe("… self-check")`. Ver también `:1561-1595` (self-check de no-hueco D-10(i), con el mensaje *"it.each del self-check generaría cero tests (cero vacuo)"*) y `:1634` (self-check de mutación D-10(ii)). |
| **G-6** | **Walk del filesystem con SKIP_DIRS + piso** | `app/lib/lockdown-guard.test.ts:102-135` + `:733-736` | El molde de la enumeración de G2 (§E). |
| **G-7** | **Anclaje a `import.meta.dirname`, jamás `process.cwd()`** | `app/lib/anti-insinuacion-guard.test.ts:64-68` | Con su razón escrita: *"evitar el bug conocido donde `pnpm --filter exec` cambia cwd y el guard escanea cero archivos silenciosamente"*. Para `packages/news`, la variante superior es `findWorkspaceRoot` (§E). |
| **G-8** | **Sanity de archivo concreto antes del barrido** | `app/lib/anti-insinuacion-guard.test.ts:920-932` | Dos `it("sanity: …")` que leen un archivo conocido y assertan `length > 100`. Si la raíz está mal, `readFileSync` **lanza** en vez de que el guard pase verde con cero archivos. Barato y efectivo — G1/G2 deben tener el suyo. |
| **G-9** | **Single-source prod→test con import, no re-tipeo** | `app/lib/anti-insinuacion-guard.test.ts:759-768` (JSDoc de `IDIOMS_APROBADOS`) | *"este archivo IMPORTA el array, no lo re-tipea, así un stem mal escrito rompe el import en vez de divergir en silencio entre dos copias"*. Es el argumento canónico del repo para la vía B de §D. |

---

## H. Cómo se corren los guards hoy, y dónde deben engancharse G1/G2/G3

**Confianza: HIGH.** Verificado leyendo los tres `package.json` y `ci.yml`.

### Los tres runners

| Runner | Qué corre | Evidencia |
|---|---|---|
| **`pnpm guards` (raíz)** | `pnpm --filter ./app guards` + `@obs/dinero` (3 guards por nombre) + `@obs/llm` (3 guards por nombre). **17 guards de régimen = 11 (app) + 3 + 3.** | `package.json:12-14`, con su JSDoc `:12`: *"D-13: jamás glob — `vitest run src/*guard*.test.ts` sale 0 sin correr nada"* |
| **`pnpm --filter ./app guards`** | 11 archivos listados **por nombre**: `anti-insinuacion-guard`, `lockdown-guard`, `bento-guards`, `vsim-antiflip-guard`, `money-antiflip-guard`, `notif-antiflip-guard`, `env-example-guard`, `name-match-rut-guard`, `bento-coherencia-guard`, `components/co-votacion-red-guard`, `create-view-guard` | `app/package.json:9` |
| **`pnpm test` (raíz)** | `pnpm -r --filter "./packages/*" test && pnpm --filter ./app test` — **sí incluye `@obs/news`** | `package.json:11` |

### 🔴 Hallazgo BLOQUEANTE para el plan: CI no corre `@obs/news`

`.github/workflows/ci.yml` (leído completo, 64 líneas) tiene exactamente **tres** steps de test:

| Step | Comando | Línea |
|---|---|---|
| "Test (guard PII + bento-guards + anti-insinuación)" | `pnpm --filter ./app test -- --run` | `:47` |
| "Test @obs/llm (…)" | `pnpm --filter @obs/llm exec vitest run` | `:59` |
| "Test @obs/cruces (…)" | `pnpm --filter @obs/cruces exec vitest run` | `:64` |

**No hay step para `@obs/news`.** Los 206 tests de la Phase 132 **nunca han corrido en CI**.

Consecuencias directas para 133-a:

- **G3 → cubierto por CI hoy** (vive en `app/lib/`, entra por `ci.yml:47`). ✅
- **G1, G2, `congelado.test.ts`, el test de sincronía `taxonomia.json`↔`taxonomia.ts` → CI-dark**
  si viven en `packages/news/src/eval/` y el plan no hace nada. Un guard que nadie corre es
  exactamente el falso verde que esta fase existe para evitar. ❌
- **Tarea obligatoria del plan:** añadir a `ci.yml` un step
  `pnpm --filter @obs/news exec vitest run` (mismo molde que `:59`/`:64`), **con su criterio de
  aceptación assertando `Tests N passed`**, no el exit code. Y considerar la variante honesta:
  arreglar la deuda de raíz reemplazando los tres steps por `pnpm test`. Eso último es cambio de
  alcance — el plan debe al menos añadir el step de news y **declarar la deuda**.

### El efecto forzoso de `create-view-guard.test.ts:435-442`

Si el plan crea un archivo `app/lib/*guard*.test.ts` (p. ej. para G3 separado, o para G2-app), el
test *"todo guard EN DISCO está listado en el script `guards`"* **se pone rojo** hasta que se añada
al script `app/package.json:9`. Es una restricción útil, no un obstáculo — pero el plan debe
incluir la edición del script **en el mismo commit** (lo dice el propio mensaje de error:
*"Añádelo(s) al script en el mismo commit que crea el guard (D-13/D-14)"*).

**Corolario:** si G3 se implementa **modificando** `anti-insinuacion-guard.test.ts` (no creando un
archivo nuevo), no hay nada que añadir al script. Es la vía más simple.

### Dónde debe engancharse cada pieza — recomendación

| Pieza | Ubicación | Runner | Acción de plan requerida |
|---|---|---|---|
| G3 | edita `app/lib/anti-insinuacion-guard.test.ts:943-948` **y `:974-978`** | `app guards` + CI ya | ninguna extra |
| G1 | `packages/news/src/eval/taxonomia-guard.test.ts` | `pnpm test` raíz | **añadir step a `ci.yml`** |
| G2 | `packages/news/src/eval/taxonomia-superficie-guard.test.ts` | ídem | ídem (mismo step) |
| `congelado.test.ts` | `packages/news/src/eval/congelado.test.ts` | ídem | ídem |
| sincronía `.ts`→`.json` | `packages/news/src/eval/congelado.test.ts` o archivo propio | ídem | ídem |

Y **considerar añadir los tres nuevos guards de `@obs/news` al script `guards` de la raíz por
nombre** (`package.json:14`), siguiendo el molde de `@obs/dinero`/`@obs/llm`. El JSDoc de `:12` dice
que ese script es *"el entrypoint reproducible de los 17 guards de régimen"* — dejar tres guards de
régimen fuera de él es incoherente con su propia declaración. Pasarían a ser 20.

---

## I. Runtime State Inventory

133-a es puramente código+config en el repo. No hay renombre, migración ni cambio de datos.

| Categoría | Encontrado | Acción |
|---|---|---|
| Stored data (Supabase / R2 / Chroma) | **Ninguno.** 133-a no toca `noticia`, `noticia_url_vista`, ni ningún bucket. Verificado: no hay migración nueva ni RPC en alcance (`133-CONTEXT.md:48`: *"Cualquier RPC pública nueva. En 133 no debería haber ninguna."*) | — |
| Live service config (n8n, Datadog, Cloudflare) | **Ninguno.** | — |
| OS-registered state (Task Scheduler, pm2) | **Ninguno.** | — |
| Secrets / env vars | **Ninguno.** Todos los artefactos de 133-a son puros y offline; los guards no tocan red ni credenciales. | — |
| Build artifacts / paquetes instalados | `packages/news/dist/` (salida de `tsc -b`, `tsconfig.json:4`) y `packages/llm-bench/dist/` existen y contienen `.d.ts` **stale** respecto de `src/`. No bloquea 133-a; `tsc -b` los regenera. Vigilar solo si `src/eval/` se añade al `include` de JSON. | ninguna |
| **CI** | ⚠️ `.github/workflows/ci.yml` **debe editarse** (§H). Es config viva del repo, no runtime externo. | editar en el plan |

---

## J. CONFLICTOS CON LO FIRMADO

Tres puntos donde una decisión LOCKED, **tal como está literalmente escrita**, no es implementable
sin una interpretación. Los reporto con evidencia; **no propongo re-decidir**.

### J-1 — "`entrada_llm` importa la MISMA función de truncado" (D-133-F2.1)

**El texto firmado:** *"`entrada_llm` usa la MISMA función de truncado que el pre-filtro, importada
de `prefiltro-lexico.ts` — no una constante replicada."*

**El problema, con evidencia:** la única función de truncado que existe es `construirTexto`
(`packages/news/src/prefiltro-lexico.ts:109-123`), y hace **cuatro cosas** además de truncar:
(a) despoja HTML (`:110`, `:118`), (b) **foldea** — quita tildes y baja a minúsculas (`fold`,
`:93-100`), (c) trunca (`:119-121`), (d) **concatena título y descripción en un solo string**
(`:122`). Es privada (`:109`, sin `export`).

Si `entrada_llm` la importa y usa literalmente, el golden guardaría
`"reforma previsional avanza en el senado la camara despacho..."` — sin tildes, en minúsculas, con
título y descripción fusionados. Eso contradice tres cosas ya firmadas: el esquema de D-133-F2
(`entrada` tiene `titulo` y `descripcion` **separados**), C2.2 (*"cita el fragmento literal del
titular o la bajada"* — un fragmento foldeado no es literal), y el encapsulado
anti-prompt-injection de D-133-F2.3 (que distingue titular de descripción).

**Lectura fiel a la intención, sin re-decidir nada:** la decisión ataca la **constante replicada**
(*"una constante copiada es la deuda de ICS en miniatura; el import la hace estructuralmente
imposible"*). Se cumple extrayendo `truncarDescripcion()` (§B) como export de
`prefiltro-lexico.ts` y llamándola desde ambos lados. `LIMITE_DESCRIPCION` y `MARGEN_TRUNCADO`
siguen privados y sin duplicar. **Riesgo residual a testear, no a asumir:** aplicar el truncado a
texto sin foldear puede cortar en un índice distinto que aplicarlo al foldeado, si `fold` cambia la
longitud (NFD + strip de diacríticos: `"á"` → 1 char antes y después, pero `"ﬁ"` u otras
composiciones podrían no serlo). El plan debe incluir un test que compare ambos cortes sobre los
fixtures reales (`packages/news/src/__fixtures__/*.xml`, 5 archivos) y **declare** el resultado.

### J-2 — "G1 corre `TERMINOS_PROHIBIDOS` / `NEGACIONES_LOCKED` del guard anti-insinuación" (D-133-A2.4)

**El problema:** ninguno de los dos está exportado
(`app/lib/anti-insinuacion-guard.test.ts:623`, `:764` — ambos `const … : string[] = [` sin
`export`), viven dentro de un `.test.ts`, y `NEGACIONES_LOCKED` importa cinco constantes de
componentes `.tsx` (`:33-40`) que requieren jsdom y el alias `@` de `app/vitest.config.ts:7`.
Además `app/` no depende de ningún `@obs/*` por régimen documentado (§E).

**No es inimplementable, pero no es un `import`.** Las vías viables están en §D (tabla A/B/C). La
recomendada (B) exige **tocar `anti-insinuacion-guard.test.ts`**, el guard más sensible del repo, en
la misma fase que ya lo toca por G3. El plan debe presupuestarlo y verificar diff-cero de
comportamiento (la suite de `app/` debe salir con el mismo conteo antes y después).

**Segunda observación:** la re-adjudicación pide correr también `NEGACIONES_LOCKED` sobre la
taxonomía. Semánticamente las negaciones son un conjunto que se **resta** antes de matchear
(`:865-871`), no un conjunto que se busca. La taxonomía no debería contener ninguna negación LOCKED
(son leyendas ciudadanas del carril votos/money/lobby). Lo implementable es: aplicar la misma
sustracción antes del match (fidelidad al detector real) y **assertar que la sustracción no removió
nada** — si una glosa de la taxonomía contuviera una negación LOCKED verbatim, eso es un hallazgo
que merece fallar. El plan debe escribir esa interpretación explícitamente.

### J-3 — "el skip silencioso de `:943-948`" es **uno de dos**

**El texto firmado** nombra un solo sitio. **Verificado:** el mismo `try/catch continue` está en
`:943-948` (test `(1)`) **y en `:974-978`** (test `(1b)` WR-03, con el comentario
*"ausencia legítima (mismo criterio que el Test (1))"*). Cerrar solo el primero deja el segundo
guard ciego con el mismo modo de fallo.

Esto **no contradice** lo firmado — lo amplía en la dirección obvia de su intención
(*"un guard ciego que sale verde es el falso verde de manual"*). Lo registro para que el plan no
cierre la mitad y lo reporte como cerrado. **Cerrar ambos.**

---

## K. Common Pitfalls (específicos de esta fase, con evidencia)

| # | Pitfall | Por qué pasa aquí | Cómo evitarlo |
|---|---|---|---|
| **P-1** | **`Tests N passed` vs exit code** | `passWithNoTests: true` en `packages/news/vitest.config.ts:9`, `app/vitest.config.ts:29` y `vitest.config.ts:10` (raíz). Los args de `vitest run` son filtros de **nombre**, no rutas. | Todo `<acceptance_criteria>` greppea `Tests[^0-9]+[0-9]+ passed` **y compara el número** contra el esperado. §A da el patrón. |
| **P-2** | **Guard nuevo en `packages/` = CI-dark** | `ci.yml` no corre `@obs/news` (§H). El propio `packages/news/vitest.config.ts:1-2` documenta el pitfall gemelo (paquete sin config propio → no recorrido). | Añadir el step a `ci.yml` **en el mismo commit** que crea el primer guard. Criterio: el step aparece en el YAML **y** el conteo impreso es > 206. |
| **P-3** | **TS6307 al importar `.json` en proyecto `composite`** | `packages/news/tsconfig.json:14` incluye solo `"src/**/*.ts"`; `llm-bench` tuvo que añadir `"src/**/*.json"` (`packages/llm-bench/tsconfig.json:12`). | Leer los JSON con `readFileSync` (que además es lo que el hash necesita), o añadir el glob al `include`. Verificar con `pnpm --filter @obs/news exec tsc -b --force` (baseline hoy: rc=0). |
| **P-4** | **Cero-vacuo en el control positivo del hash** | En 133-a solo hay **2** de los 3 JSON. Un `for` sobre 3 nombres con `sha256sum` de un archivo inexistente produce listas vacías que "coinciden". | Assertar el **conteo de líneas** además del diff. §F. |
| **P-5** | **`--renormalize` no añade untracked** | Verificado empíricamente (§F): tras `git add --renormalize .` los archivos nuevos siguen en `??`. | `git add` normal para los nuevos; `--renormalize` como red idempotente. Verificar con `git ls-files --eol`. |
| **P-6** | **`set -e` + comando que DEBE fallar** | Gotcha LOCKED del CONTEXT. Las pruebas de mutación de G1/G2/G3 son comandos que deben fallar. | `if CMD > log 2>&1; then rc=0; else rc=$?; fi`. Nunca `set -e` alrededor. |
| **P-7** | **Control positivo que varía DOS variables** | Gotcha LOCKED. Es fácil que "fixture con el literal" y "fixture sin el literal" difieran también en longitud, formato o ruta. | El par debe ser el MISMO string con una única edición. Ejemplo del repo: `create-view-guard.test.ts:444-451` (fantasma vs real, una variable: existencia). |
| **P-8** | **`git diff --name-only` sin base fija** | Gotcha LOCKED: con commits atómicos siempre pasa. | SHA literal en el criterio. |
| **P-9** | **`buildTermRegex` NO es accent-insensitive** | `anti-insinuacion-guard.test.ts:828-841` + el comentario `:646-648`. Las etiquetas de la taxonomía son ASCII (`tramitacion_legislativa`), pero las **glosas** llevan tildes. | G1 debe buscar los términos prohibidos **con sus tildes exactas**, copiando `buildTermRegex` verbatim. Y ojo: `_` está en `WORD` (`:833`), así que `no_legislativa` NO dispararía un término `legislativa`; irrelevante aquí, pero G2 debe saberlo al buscar literales de etiqueta. |
| **P-10** | **Cinco rondas de checker en la 132** | Documentado en `133-CONTEXT.md:191-193`. Cada fix fue un falso verde o rojo nuevo. | Para cada test nuevo: **mutar el código y comprobar que cae**. Y la pregunta gemela a cada criterio: *¿puede salir 0 sin haber probado nada?* / *¿puede NO salir 0 nunca?* |
| **P-11** | **`readdirSync` en `try/catch` devuelve `[]`** | `lockdown-guard.test.ts:116-120`. El mismo patrón que G3 cierra en el guard de superficies vive dentro del walker que G2 quiere reusar. | Piso duro sobre el conteo (`:736` usa `>10`; para G2 usar un piso realista) **más** un sanity de archivo concreto (`anti-insinuacion-guard.test.ts:920-932`). |
| **P-12** | **OneDrive + rutas con espacios** | El repo vive en `.../OneDrive - pjud.cl/...`. `grep -r` recursivo agota timeout (documentado en `STATE.md:118`). | Comillas en toda ruta; `git grep` / `git ls-files` en vez de `grep -r`. |

---

## L. Architecture Patterns — estructura recomendada de `packages/news/src/eval/`

```
packages/news/src/eval/
├── taxonomia.ts                        # SSoT: 5 clases + ambiguo, Object.freeze,
│                                       #   precedencia = ORDEN DEL ARRAY (D-133-A2)
├── canonicalizar-json.ts               # canonicalización recursiva + sha256 (función pura)
├── canonicalizar-cli.ts                # (opcional, discreción) invocación por CLI
├── caso-golden.ts                      # esquema zod del caso golden (D-133-F2) — SIN casos
├── entrada-llm.ts                      # construcción de entrada_llm + chequeo de cobertura
│                                       #   (importa truncarDescripcion de ../prefiltro-lexico)
├── taxonomia.json                      # PROYECCIÓN canónica — hasheada
├── thresholds.json                     # D-133-D2 (T1..T9) — hasheada
├── CONGELADO.md                        # log de cambios + firma (declarada como limitación)
├── congelado.test.ts                   # G-1: hashes + última entrada de CONGELADO.md
│                                       #      + sincronía .ts→.json byte a byte
├── taxonomia-guard.test.ts             # G1
└── taxonomia-superficie-guard.test.ts  # G2
```

**Notas de diseño derivadas de las restricciones LOCKED:**

- **`taxonomia.ts` con la precedencia en el orden del array** ⇒ la canonicalización **no puede
  ordenar arrays** (D-133-E2). El script debe ordenar **claves** recursivamente y dejar los arrays
  intactos. Test de control positivo: un array con orden invertido debe producir **hash distinto**.
  Ese test es la prueba de que "arrays no se reordenan" está implementado y no solo escrito.
- **`Object.freeze` es shallow.** Para congelar un array de objetos hace falta
  `Object.freeze(arr.map(Object.freeze))` o `as const`. Precedente en el repo:
  `prefiltro-lexico.ts:16` y `:65` usan `Object.freeze` sobre arrays de primitivas/objetos — el
  segundo es shallow y lo asume. Con `as const` + `readonly` el compilador lo cubre; la discreción
  del CONTEXT lo permite.
- **El test de sincronía** (`taxonomia.json` regenerado desde `taxonomia.ts`, comparado **byte a
  byte**) es lo que hace estructuralmente imposible la deuda de ICS. Implementación: llamar al
  canonicalizador sobre `TAXONOMIA` en memoria y comparar el string resultante contra
  `readFileSync(taxonomia.json, "utf8")` — con `toBe`, no `toEqual` sobre objetos parseados (eso
  compararía semántica, no bytes, y dejaría pasar el drift de formato que la fase existe para
  cazar). **Este es el falso verde más probable de toda la fase.**
- **`entrada_llm` en 133-a es solo el esquema y la función.** Cero casos. El chequeo de cobertura se
  escribe y se testea contra fixtures sintéticos; correrlo sobre casos P es 133-b.

### Anti-patrones a evitar en esta fase

- **Comparar JSON parseado en vez de bytes** en el test de sincronía (arriba). El objetivo es el
  drift de **formato**.
- **Hashear el `.ts`** — prohibido explícitamente (D-133-E2). El `.ts` cambia por Prettier.
- **`String.includes` para el chequeo de cobertura de términos** — prohibido por régimen
  (`prefiltro-lexico.ts:127-128`). Usar frontera de palabra.
- **Un allowlist de superficies para G2** — reproduce exactamente el modo de fallo que G3 cierra.
  Walk completo (§E).
- **Replicar `LIMITE_DESCRIPCION` en `eval/`** — la deuda de ICS en miniatura (D-133-F2.1).
- **Replicar los literales de etiqueta en `app/`** — viola D-133-A2 ("prohibido re-escribir las
  etiquetas a mano en ningún otro lugar").

---

## Don't Hand-Roll

| Problema | No construir | Usar en su lugar | Por qué |
|---|---|---|---|
| Hash sha256 de un artefacto congelado | hash artesanal / `hashCode` | `createHash("sha256").update(raw).digest("hex")` — molde en `packages/llm-bench/src/guards/freeze.ts:34-36` | Su JSDoc `:29-32` ya lo dice: *"NUNCA hash artesanal"*. Y trae `assertFrozen` con mensaje accionable. |
| Marcador de freeze + su meta-test | inventar un formato | `FreezeMarker` (`freeze.ts:17-26`) + los 4 tests de `disjuncion.test.ts:52-70` | Precedente vivo con prueba de mutación incluida. |
| Localizar la raíz del workspace desde `packages/news` | `resolve(dirname, "../../../..")` | `findWorkspaceRoot` (`packages/news/src/run-news-cli.ts:190-202`, exportado en `index.ts:46`) | Fail-loud (lanza) en vez de devolver una ruta muerta; inmune a mover el archivo. |
| Enumerar archivos fuente de `app/` | glob de vitest / allowlist manual | `walkSourceFiles` (`app/lib/lockdown-guard.test.ts:113-135`) + `SKIP_DIRS` (`:102-111`) | El glob de vitest es un filtro de nombre (sale 0 en silencio); el allowlist es el modo de fallo que G3 cierra. |
| Límite de palabra con acentos en español | `\b` de JS | `buildTermRegex` + `WORD` (`app/lib/anti-insinuacion-guard.test.ts:828-841`) | `\b` trata los acentuados como no-palabra ⇒ falsos positivos y negativos. Documentado en su JSDoc `:828-836`. |
| Strip de comentarios TS antes de matchear | regex propio | `stripTsComments` (`app/lib/anti-insinuacion-guard.test.ts:81-95`) | Incluye el cuidado del `://` en URLs (WR-05) que un regex naïf rompe, creando un falso negativo. |
| Serialización JSON con claves ordenadas | `JSON.stringify` a secas | patrón de `packages/identity/src/backup.ts:64-80`, extendido a recursivo | `JSON.stringify` preserva el orden de inserción, que no es determinista entre construcciones del objeto. |
| Validación del esquema del caso golden | validador a mano | **zod** — ya es dependencia directa (`packages/news/package.json:21`, `^4.4.3`) y ya se usa (`packages/news/src/model.ts` → `RssItemSchema`, `index.ts:21`) | Cero dependencia nueva, patrón ya establecido en el paquete. |

**Key insight:** esta fase no necesita **ni una dependencia nueva**. `zod` y `node:crypto` bastan.
Cualquier propuesta de instalar un paquete (`json-stable-stringify`, `canonicalize`, etc.) debe
rechazarse: el requisito de canonicalización de D-133-E2 es ~25 líneas y una librería externa
introduce un riesgo de supply-chain sobre el artefacto que define la vara de todo el carril news.

---

## Package Legitimacy Audit

**No aplica: esta fase no instala ningún paquete externo.** Verificado contra el alcance de
`133-CONTEXT.md:15-34` y contra §"Don't Hand-Roll" — todo lo necesario (`zod@^4.4.3`,
`node:crypto`, `vitest@^3.0.0`) ya está en `packages/news/package.json:16-26`.

Si el plan propusiera una dependencia nueva, el gate de legitimidad debe correrse entonces
(`slopcheck` + `npm view`), y la recomendación de este research es **rechazarla** por la razón de
supply-chain de arriba.

---

## Environment Availability

| Dependencia | Requerida por | Disponible | Versión | Fallback |
|---|---|---|---|---|
| Node | todo | ✓ | ≥22 exigido (`package.json:30`); CI usa 22 (`ci.yml:36`) | — |
| pnpm | todo | ✓ | `pnpm@11.3.0` (`package.json:9`) | — |
| vitest | los guards | ✓ | `^3.0.0` (raíz + `packages/news`) | — |
| `zod` | esquema del caso golden | ✓ | `^4.4.3` (`packages/news/package.json:21`) | — |
| `node:crypto` | sha256 | ✓ | builtin | — |
| `git` (con `--renormalize`, `ls-files --eol`) | congelación | ✓ | verificado ejecutando ambos | — |
| `sha256sum` (git-bash) | control positivo del hash | ✓ | coreutils de git-bash | `node -e 'require("crypto")…'` si faltara |
| Red / credenciales R2 / Supabase | **NADA de 133-a** | n/a | — | — |

**Sin dependencias faltantes.** 133-a es 100 % offline y ejecutable hoy en la máquina del operador.

---

## Validation Architecture

*(`.planning/config.json` no fue localizado con clave `workflow.nyquist_validation` explícita ⇒ se
trata como habilitado.)*

### Test Framework

| Propiedad | Valor |
|---|---|
| Framework | vitest `^3.0.0` |
| Config | `packages/news/vitest.config.ts` (paquete) · `app/vitest.config.ts` (app) |
| Quick run (paquete news) | `pnpm --filter @obs/news exec vitest run` → hoy `Tests 206 passed (206)` |
| Quick run (un guard de app) | `pnpm --filter ./app exec vitest run lib/anti-insinuacion-guard.test.ts` |
| Guards de régimen | `pnpm guards` (raíz) |
| Full suite | `pnpm test` (raíz: todos los `packages/*` + `app`) |

### Requisito → mapa de tests

| Req | Comportamiento | Tipo | Comando automatizado | ¿Existe? |
|---|---|---|---|---|
| NEWS-03 / SC1 | `taxonomia.json` congelado por sha256; drift rompe | unit | `pnpm --filter @obs/news exec vitest run congelado` | ❌ Wave 0 |
| NEWS-03 / SC1 | `taxonomia.json` == regeneración desde `taxonomia.ts`, **byte a byte** | unit | ídem | ❌ Wave 0 |
| NEWS-03 / SC3 | `thresholds.json` congelado con T1..T9 | unit | ídem | ❌ Wave 0 |
| NEWS-03 / SC1 | `CONGELADO.md` — última entrada contiene los hashes vigentes | unit | ídem | ❌ Wave 0 |
| D-133-A2.4 G1 | cero términos prohibidos en cada string de `taxonomia.ts` + mutación | unit | `pnpm --filter @obs/news exec vitest run taxonomia-guard` | ❌ Wave 0 |
| D-133-A2.4 G2 | cero literales de etiqueta en `app/` + control positivo apareado | unit | `pnpm --filter @obs/news exec vitest run taxonomia-superficie` | ❌ Wave 0 |
| D-133-A2.4 G3 | allowlist con ruta muerta ⇒ **falla**, no skip (ambos sitios) | unit | `pnpm --filter ./app exec vitest run lib/anti-insinuacion-guard.test.ts` | ⚠️ existe el archivo, falta el comportamiento |
| D-133-E2.1 | hash estable entre working tree y clon limpio | manual/script | receta de §F | ❌ Wave 0 |
| D-133-F2.1 | `truncarDescripcion` compartida; diff-cero en el pre-filtro | unit | `pnpm --filter @obs/news exec vitest run prefiltro-lexico` (32 tests, deben seguir en 32) | ✅ suite existe |
| D-133-F2.2 | chequeo de cobertura de `prefiltro.terminos` en `entrada_llm` | unit | `pnpm --filter @obs/news exec vitest run entrada-llm` | ❌ Wave 0 |

### Sampling rate

- **Por commit de tarea:** `pnpm --filter @obs/news exec vitest run` (~8 s hoy) + si la tarea toca
  `app/`, `pnpm --filter ./app guards`.
- **Por merge de wave:** `pnpm test` (raíz) + `pnpm guards` + `pnpm typecheck`.
- **Gate de fase:** los tres verdes **con conteo impreso citado**, antes de `/gsd:verify-work`.

### Wave 0 gaps

- [ ] `.github/workflows/ci.yml` — step `@obs/news` (§H). **Sin esto todo lo demás es CI-dark.**
- [ ] `packages/news/src/eval/taxonomia.ts` — necesario desde la primera tarea que cree el directorio.
- [ ] `packages/news/tsconfig.json` — `"src/**/*.json"` en `include`, si se importan JSON desde `.ts`.
- [ ] `.gitattributes` (raíz) — primera tarea LOCKED.
- [ ] Decisión de plan sobre la vía A/B de §D para `TERMINOS_PROHIBIDOS`.

---

## Security Domain

`security_enforcement` no aparece como `false` ⇒ se incluye.

### Categorías ASVS aplicables

| Categoría | Aplica | Control |
|---|---|---|
| V2 Authentication | no | 133-a no toca auth |
| V3 Session Management | no | — |
| V4 Access Control | no | cero RPC nueva (`133-CONTEXT.md:48`), cero migración, cero flag |
| V5 Input Validation | **sí** | **zod** (`packages/news/package.json:21`) para el esquema del caso golden; patrón ya vivo en `packages/news/src/model.ts` |
| V6 Cryptography | **sí** | `node:crypto` `createHash("sha256")` — **integridad, no secreto**. Jamás hash artesanal (`packages/llm-bench/src/guards/freeze.ts:29-32`) |
| V7 Error Handling / Logging | parcial | los guards fallan LOUD con mensaje accionable (patrón de `assertFrozen:46-51`) |

### Patrones de amenaza para este stack

| Patrón | STRIDE | Mitigación |
|---|---|---|
| **Drift silencioso del artefacto congelado** (la vara se mueve tras medir) | Tampering | sha256 + `congelado.test.ts` + `CONGELADO.md` en el test + commit atómico de las tres cosas (D-133-E2) |
| **Guard ciego que sale verde** (allowlist con ruta muerta) | Tampering / Repudiation | G3 fallo duro + test de no-hueco con piso duro (§D) |
| **Guard CI-dark** (nadie lo corre) | Repudiation | step en `ci.yml` (§H) |
| **Copy insinuante que bypassea el linter** vía `packages/news` | Information Disclosure / reputacional | G1 + G2 (P-01/A3 del premortem) |
| **PII / copyright en el golden** | Information Disclosure | En 133-a: cero casos ⇒ superficie nula. El esquema debe **prohibir por tipo** el full-text y cualquier campo de `parlamentario` (D-133-F2). Precedente de guard NO-PII sobre un golden: `packages/llm-bench/src/guards/no-rut.ts` usado en `disjuncion.test.ts:41-48` — **candidato a copiar para el esquema del caso golden**. |
| **Dependencia externa en el canonicalizador** | Supply chain | cero deps nuevas (§Don't Hand-Roll) |

---

## Assumptions Log

| # | Claim | Sección | Riesgo si es falso |
|---|---|---|---|
| A1 | El truncado sobre texto sin foldear cae en el mismo índice que sobre texto foldeado para los fixtures reales | §B / §J-1 | `entrada_llm` diverge del pre-filtro en algunos casos ⇒ la cobertura de `prefiltro.terminos` bajaría de 95 % en 133-b. **Mitigación: el plan lo TESTEA contra los 5 fixtures, no lo asume.** |
| A2 | Importar `.json` desde un `.ts` de producción en `packages/news` falla con TS6307 hoy | §A / P-3 | Bajo. Deducido del `include` de `packages/news/tsconfig.json:14` **y** corroborado indirectamente por el `include` distinto de `packages/llm-bench/tsconfig.json:12`. No lo reproduje (habría exigido escribir un `.ts` en el repo). Verificación de 30 s en la primera tarea. |
| A3 | `MARGEN_TRUNCADO` vale 23 hoy (`"tribunal constitucional"`) | §B | Ninguno — es runtime-derivado (`prefiltro-lexico.ts:107`) y el plan no debe hardcodearlo. Lo anoto solo para que nadie escriba `615` en un test. |
| A4 | El step de CI de `@obs/news` no rompe nada al añadirse | §H | Bajo: la suite corre verde local sin red ni credenciales (206/206, y `run-news-cli.test.ts:6-10` stubbea `fetch` para que lance). Debe confirmarse en el primer push. |

---

## Open Questions (RESUELTAS — 2026-08-06)

> **Las cuatro quedaron adjudicadas en `133-ADDENDUM-IMPLEMENTACION.md` y no se re-abren:**
> Q1 (dónde vive G2) → **D-133-K1** · Q2 (alcance del step de CI) → **D-133-K2** ·
> Q3 (vía A o B para `TERMINOS_PROHIBIDOS`) → **D-133-J2** (vía B, acotada) ·
> Q4 (alcance del `.gitattributes`) → **D-133-K4** (solo `*.json`, no se amplía a `.md`).
> Se conservan abajo con su evidencia porque los planes citan ese razonamiento; **ninguna es
> una decisión pendiente.**

1. **¿G2 vive en `packages/news` (CI-dark hasta el step) o en `app/` (rompe el desacoplamiento)?**
   - Sé: `app/` no depende de ningún `@obs/*`, por régimen documentado en 3 lugares (§E); CI no
     corre `@obs/news` (§H); D-133-A2 prohíbe replicar las etiquetas.
   - No sé: si el operador considera el desacoplamiento `app`↔`packages` una regla dura o una
     convención.
   - **Recomendación:** G2 en `packages/news/src/eval/`, leyendo `app/` por disco vía
     `findWorkspaceRoot` — no crea arista de módulo, no toca `app/`, respeta el single-source.
     Requiere el step de CI, que hay que añadir de todas formas.

2. **¿El step de CI se limita a `@obs/news` o se arregla la deuda de raíz?**
   - Sé: `ci.yml` corre 3 de ~17 workspaces; el resto (incluidos los 206 tests de la 132) nunca ha
     corrido en CI.
   - **Recomendación:** añadir el step de `@obs/news` (alcance de esta fase) y **declarar la deuda
     por escrito** en el reporte, sin ampliar alcance. Convertir `ci.yml` a `pnpm test` es un cambio
     de riesgo no presupuestado que podría destapar rojos de otros paquetes en medio de 133-a.

3. **¿Vía A o vía B para `TERMINOS_PROHIBIDOS` (§D)?**
   - Sé: B es la que el propio repo argumenta como correcta (`anti-insinuacion-guard.test.ts:759-768`,
     *"IMPORTA el array, no lo re-tipea"*), pero exige tocar el guard más sensible; A funciona con
     un piso duro y no toca nada de `app/`.
   - **Recomendación:** B, pero solo para `TERMINOS_PROHIBIDOS` y sus sub-listas
     (`TERMINOS_LINK_EXT`, `TERMINOS_COBERTURA`); `NEGACIONES_LOCKED` se queda donde está (importa
     `.tsx`). Se hace en el mismo commit que G3, con criterio de diff-cero: el conteo impreso de
     `pnpm --filter ./app test` debe ser idéntico antes y después.

4. **¿El `.gitattributes` cubre solo `packages/news/src/eval/**/*.json` o también `.md`?**
   - `CONGELADO.md` no se hashea directamente, pero su **contenido** sí se asserta
     (D-133-E2.2). Un CRLF en él no rompería el assert (que busca substrings de hash), así que
     ampliar el patrón no es necesario. Lo dejo señalado por si el plan quiere ser exhaustivo — el
     patrón firmado es `*.json` y no debe ampliarse sin razón.

---

## Sources

### Primarias (HIGH — código del repo, leído/ejecutado en esta sesión)

- `packages/news/{package.json,tsconfig.json,vitest.config.ts}` · `packages/news/src/index.ts` ·
  `packages/news/src/prefiltro-lexico.ts` (146 líneas, completo) ·
  `packages/news/src/run-news-cli.ts:190-216` · `packages/news/src/run-news-cli.test.ts:581-604`
- `packages/llm-bench/src/guards/freeze.ts` (completo) ·
  `packages/llm-bench/src/tasks/clasificacion/disjuncion.test.ts:1-70` ·
  `packages/llm-bench/tsconfig.json`
- `app/lib/anti-insinuacion-guard.test.ts` (1787 líneas; leídas :1-95, :410-430, :610-1105, :1197+)
- `app/lib/lockdown-guard.test.ts:100-150, :733-736` · `app/lib/create-view-guard.test.ts:395-452`
- `app/{package.json,tsconfig.json,vitest.config.ts}` · `packages/identity/src/backup.ts:50-100`
- `package.json` (raíz) · `tsconfig.json` · `tsconfig.base.json` · `pnpm-workspace.yaml` ·
  `.github/workflows/ci.yml` (completo)
- `.planning/{ROADMAP.md:205-250, REQUIREMENTS.md:26-32, STATE.md}` · `CLAUDE.md`
- `.planning/phases/133-*/{133-CONTEXT.md, 133-READJUDICACION.md, 133-PREMORTEM.md}`

### Comandos ejecutados (HIGH — evidencia empírica de esta sesión)

- `pnpm --filter @obs/news exec vitest run` → `Test Files 12 passed (12)` / `Tests 206 passed (206)`
- `pnpm --filter @obs/news exec tsc -b --force` → rc=0
- `git config --get core.autocrlf` → `false` (local y `--global`)
- `git ls-files | grep -i gitattributes` → vacío (no existe)
- barrido de CRLF sobre 200 `.json` trackeados → 0 hits
- script de existencia sobre los 14 arrays `SUPERFICIES_*` → **63 rutas, 0 faltantes**
- clon temporal + `.gitattributes` + `git add --renormalize .` → **0 archivos ajenos tocados**
  (temporal eliminado; el repo real no fue modificado)

### Secundarias (MEDIUM)

- Ninguna. Cero WebSearch, cero WebFetch: el objetivo declaró trabajo de repo y no hubo pregunta
  que exigiera fuente externa.

---

## Metadata

**Confianza por área:**

| Área | Nivel | Razón |
|---|---|---|
| Paquete `@obs/news` y su suite (§A) | **HIGH** | Suite ejecutada; conteo impreso citado literal |
| `prefiltro-lexico.ts` (§B) | **HIGH** | Archivo leído íntegro (146 líneas); superficie de export verificada contra el barrel |
| Freeze / canonicalización (§C) | **HIGH** | Precedente vivo leído completo, con su consumidor |
| G3 / 0 faltantes (§D) | **HIGH** | Verificado por script sobre los 14 arrays, con desglose por carril |
| G2 / enumeración (§E) | **HIGH** patrones, **MEDIUM** ubicación | Los patrones están leídos; la ubicación depende de una decisión de plan (Open Question 1) |
| `.gitattributes` / renormalize (§F) | **HIGH** | Experimento en clon limpio, resultado citado |
| CI (§H) | **HIGH** | `ci.yml` leído completo; los 3 steps de test enumerados |
| Conflictos (§J) | **HIGH** J-1 y J-3 (evidencia directa), **HIGH** J-2 (ausencia de `export` verificada) | |

**Research date:** 2026-08-06
**Valid until:** 2026-09-05 (30 días — hallazgos sobre código del repo, estables salvo refactor).
**Invalidadores:** un cambio en `.github/workflows/ci.yml`, en `app/package.json` scripts `guards`,
en `packages/news/tsconfig.json`, o cualquier movimiento de archivos que dispare el
`FALTANTES: 0` de §D.
