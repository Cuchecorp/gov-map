---
phase: 126-panel-guards-wave-0-de-guards
reviewed: 2026-07-30T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - app/lib/create-view-guard.test.ts
  - app/lib/anti-insinuacion-guard.test.ts
  - app/package.json
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
fixed:
  critical: 2
  warning: 6
  info: 4
  total: 12
  skipped: 0
fixed_at: 2026-07-30
status: fixed
---

# Phase 126: Code Review Report

**Reviewed:** 2026-07-30
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Revisión adversarial del Wave-0 de guards (126-01 anti-insinuación extendido, 126-02 guard
B-03 `create view` + runner explícito). El método declarado en los SUMMARY es sólido
(controles positivos apareados verbatim, asserts anti-vacuo, cero `test.skip`/`only`,
cero assert relajado — verificado por grep). El problema no está en el método sino en el
**detector B-03**: es bypassable de dos maneras demostradas empíricamente, y el bypass es
silencioso (verde). Como el guard existe precisamente para blindar la 0080 de Phase 127
—la primera view del milestone— un falso verde aquí es exactamente el modo de fallo que la
fase pretendía cerrar.

También hay huecos de segundo orden: `MATVIEW_ALLOWLIST` es código muerto pese a que el
mensaje de error instruye al desarrollador a usarla; el anti-drift `(1f)` no es recursivo;
y el script `guards` no tiene guard-of-the-guards, por lo que la deriva de nombres es
silenciosa bajo `passWithNoTests: true` — la misma clase de trampa que D-13 dice matar.

El carril anti-insinuación (126-01) está sustancialmente bien: el fix de circularidad
D-10(i) (usar `buildTermRegex` directo en vez de `detectarTerminos`) es **correcto** —
`detectarTerminos` resta `NEGACIONES_LOCKED`, que ahora incluye `IDIOMS_APROBADOS` por
spread, así que el stem se restaba a sí mismo; `buildTermRegex` evita la resta. Verificado
además por código que ninguno de los 104 términos prohibidos contiene un idiom ni solapa
con él (última palabra del idiom == primera palabra de un término multi-palabra): la resta
no enmascara nada HOY. El hueco es que esa dirección de la comprobación no está asertada.

## Critical Issues

### CR-01: `stripSqlComments` traga el `;` terminador y la view escapa del detector

**File:** `app/lib/create-view-guard.test.ts:46-58, 69-70, 88-92`
**Issue:** `stripSqlComments` corta la línea en el primer `--` **sin conciencia de literales
de cadena ni de dollar-quoting**. Si una línea contiene `--` dentro de un string SQL, el
`;` final de esa sentencia se elimina, la sentencia siguiente se fusiona en el mismo chunk
del `split(";")`, y como `CREATE_VIEW_RE` está anclado con `^\s*` **sin flag `m`**, el
`create view` deja de matchear. Reproducido:

```
input:  insert into t(x) values ('a--b');
        create view public.v_leak as select 1;
detectarViewsSinInvoker() => []      // esperado: ["public.v_leak"]
```

Mismo efecto con `--` dentro de un cuerpo `$$ … $$`. Una view sin `security_invoker`
pasa el guard en verde: elevación de privilegio silenciosa, que es exactamente la amenaza
documentada en el encabezado del archivo (L2-10).
**Fix:** (a) añadir el flag `m` a `CREATE_VIEW_RE` (o buscar el `create view` en cualquier
posición del chunk en vez de anclar a inicio de chunk), y (b) hacer el strip
string-literal-aware, o como mínimo no cortar en `--` cuando el número de `'` previos en
la línea es impar:

```ts
const CREATE_VIEW_RE =
  /(^|\n)\s*create\s+(or\s+replace\s+)?(materialized\s+)?view\s+(if\s+not\s+exists\s+)?(public\.)?["\w]+/i;
// y en stripSqlComments:
const idx = indiceDeComentarioFueraDeLiteral(line); // ignora -- dentro de '...' y $$...$$
```
Añadir el fixture del bypass a §2 como control positivo apareado (hoy no existe).

### CR-02: `SECURITY_INVOKER_RE` matchea en cualquier parte de la sentencia — invoker "prestado"

**File:** `app/lib/create-view-guard.test.ts:71, 116-118`
**Issue:** `SECURITY_INVOKER_RE` se aplica al chunk completo, no a la lista de opciones que
va entre el nombre de la view y el `as`. Cualquier aparición del texto
`with (… security_invoker = true)` en la sentencia —dentro de un literal, un `comment on`,
o una **segunda view fusionada al mismo chunk por CR-01**— desactiva la violación.
Reproducido, dos casos:

```
create view public.v8 as select 'with (security_invoker = true)'::text;
=> []                                    // esperado: ["public.v8"]

create view public.v_bad as select 'a--b';
create view public.v_good with (security_invoker=true) as select 1;
=> []                                    // v_bad queda blindada por el invoker del vecino
```

El segundo caso es la composición con CR-01 y es el escenario realista: una migración que
crea dos views, una correcta y una no, pasa entera en verde.
**Fix:** acotar la búsqueda del invoker a la porción de la sentencia **anterior al `as`**
del `create view`, y exigir que la opción viva en el bloque `with(...)` inmediatamente
posterior al nombre:

```ts
const OPTS_RE = /create\s+(or\s+replace\s+)?view\s+(if\s+not\s+exists\s+)?(public\.)?["\w]+\s*(?:\([^)]*\)\s*)?with\s*\(([^)]*)\)/i;
const opts = OPTS_RE.exec(stmt)?.[4] ?? "";
if (!/security_invoker\s*=\s*(true|on)\b/i.test(opts)) offenders.push(...);
```

## Warnings

### WR-01: `MATVIEW_ALLOWLIST` es código muerto — el mensaje de error miente al desarrollador

**File:** `app/lib/create-view-guard.test.ts:66-67, 111-114, 148`
**Issue:** `MATVIEW_ALLOWLIST` se declara y se descarta con `void`; `detectarViewsSinInvoker`
nunca la consulta (L111-114 empuja SIEMPRE la matview). Sin embargo el mensaje del assert
del escaneo real dice literalmente "*o —si es matview— justifícala explícitamente en
MATVIEW_ALLOWLIST*". Un desarrollador futuro añadirá una entrada, el guard seguirá rojo, y
el resultado probable será que relaje el detector a mano bajo presión. Un escape hatch que
no funciona es peor que ninguno.
**Fix:** consultarla de verdad, o borrarla y corregir el mensaje:
```ts
if (esMaterialized) {
  const nombre = extraerNombreView(stmt);
  if (!MATVIEW_ALLOWLIST.includes(nombre.replace(/^public\./i, ""))) offenders.push(nombre);
  continue;
}
```

### WR-02: el `split(";")` no conoce dollar-quoting — falsos negativos y fragmentación

**File:** `app/lib/create-view-guard.test.ts:88`
**Issue:** los cuerpos `$$ … ; … $$` (frecuentes en este repo: funciones plpgsql, DO blocks)
se fragmentan en chunks arbitrarios. Consecuencia verificada: un `create view` emitido por
SQL dinámico dentro de una función **no se detecta**:
```
create function f() returns void as $$ begin execute 'create view public.v_dyn as select 1'; end $$ language plpgsql;
=> []
```
y a la inversa, un fragmento de cuerpo puede empezar por `create view` y producir un
offender espurio con nombre mal resuelto.
**Fix:** hacer el split dollar-quote-aware (tokenizar `$tag$ … $tag$` y `'…'` antes de
partir por `;`), o al menos documentar el límite explícitamente en el encabezado y añadir
un caso de §2 que fije el comportamiento esperado para SQL dinámico.

### WR-03: D-10(i) comprueba una sola dirección — la resta que ROMPE una frase prohibida no está asertada

**File:** `app/lib/anti-insinuacion-guard.test.ts:1548-1571` (bloque `D-10(i)`)
**Issue:** el self-check asserta "ningún idiom contiene término prohibido". Pero el riesgo
que D-10 declara mitigar es el inverso: *"resta amplia que rompa una frase prohibida
multi-palabra"*. La resta (`texto.split(negNorm).join(" ")`, L900-906) es por **substring**,
no por palabra, así que un idiom cuya última palabra sea la primera de un término prohibido
multi-palabra lo partiría en dos y lo enmascararía. Verificado por código sobre los 104
términos actuales: hoy **no hay solape** (ningún término contiene un idiom; ninguna última
palabra de idiom coincide con la primera palabra de un término multi-palabra), así que no
hay bug vivo — pero el guard-of-the-guard que impediría introducirlo mañana no existe.
D-10(ii) solo cubre un par concreto (`señal` + un idiom), no la propiedad general.
**Fix:** añadir un `it` por código que cruce ambos arrays:
```ts
for (const stem of IDIOMS_APROBADOS) {
  const ultima = stem.split(/\s+/).pop()!.toLowerCase();
  const rotos = TERMINOS_PROHIBIDOS.filter(
    (t) => t.split(/\s+/).length > 1 && t.split(/\s+/)[0].toLowerCase() === ultima,
  );
  expect(rotos, `restar "${stem}" partiría el término prohibido ${rotos.join("; ")}`).toHaveLength(0);
}
```

### WR-04: el anti-drift `(1f)` no es recursivo — un subdirectorio evade el prefijo congelado D-05

**File:** `app/lib/anti-insinuacion-guard.test.ts:1157-1160`
**Issue:** `readdirSync(path.join(APP_ROOT, "components"))` sin `recursive: true` y con
filtro `/^panel-.+\.tsx$/`. Cualquier componente del rediseño ubicado en
`components/panel/tile-sala.tsx` o `components/panel-tiles/sala.tsx` no aparece en el
listado y **no dispara el anti-drift**, que es precisamente el hueco "archivo nuevo con
nombre imprevisto se salta el scan" que D-07 dice cerrar. Phase 128 es libre de crear una
carpeta.
Segundo defecto del mismo assert: compara solo contra `SUPERFICIES_PANEL`, no contra
`TODAS_LAS_SUPERFICIES` — un `panel-*.tsx` declarado legítimamente en otro carril se
reportaría como huérfano (falso positivo, contradice el criterio DEDUPE del resto del
archivo).
**Fix:**
```ts
const archivosReales = readdirSync(path.join(APP_ROOT, "components"), { recursive: true })
  .map(String)
  .map((f) => f.split(path.sep).join("/"))
  .filter((f) => /(^|\/)panel-.+\.tsx$/.test(f) && !/\.test\.tsx?$/.test(f));
const declarados = new Set(TODAS_LAS_SUPERFICIES);
```

### WR-05: el script `guards` no tiene guard-of-the-guards — la deriva de nombres es silenciosa

**File:** `app/package.json:11`
**Issue:** los 11 nombres son correctos hoy (verificado: `ls lib/*guard*.test.ts
components/*guard*.test.ts` == 11 y todos están listados). Pero `vitest.config.ts` tiene
`passWithNoTests: true`: si un guard se renombra o se borra, el nombre listado deja de
resolver, `pnpm guards` corre 10 archivos y **sale 0**. Y un guard NUEVO no entra al script
salvo que alguien lo recuerde. Es la misma clase de trampa que D-13 declara matar (glob →
0 tests en silencio), solo que desplazada de "glob roto" a "lista derivada".
**Fix:** añadir un `it` en un guard existente que compare la lista del script contra el
filesystem:
```ts
const pkg = JSON.parse(readFileSync(path.join(APP_ROOT, "package.json"), "utf-8"));
const enScript = new Set(pkg.scripts.guards.split(/\s+/).filter((s: string) => s.endsWith(".test.ts")));
const enDisco = [...globGuards("lib"), ...globGuards("components")];
expect(enDisco.filter((f) => !enScript.has(f)), "guard en disco no listado en `pnpm guards`").toHaveLength(0);
expect([...enScript].filter((f) => !enDisco.includes(f)), "nombre fantasma en el script").toHaveLength(0);
```

### WR-06: `pnpm guards` corre 11 de los 17 guards que el criterio 4 declara cerrado

**File:** `app/package.json:11`
**Issue:** el SUMMARY 126-02 cierra el criterio "14+ guards" con 17 = 11 (`app/`) + 3
(`@obs/dinero`) + 3 (`@obs/llm`), pero el script `guards` solo cubre los 11 de `app/`. Los
6 de `packages/` se corrieron a mano con `pnpm --filter … exec vitest run <nombres>`; no
hay entrypoint reproducible. El "17" es un conteo de auditoría, no un comando.
**Fix:** añadir `guards` en la raíz del monorepo que encadene los tres (`pnpm -C app guards
&& pnpm --filter @obs/dinero exec vitest run <3> && pnpm --filter @obs/llm exec vitest run <3>`),
o documentar explícitamente en el script que su ámbito es `app/`.

## Info

### IN-01: código muerto y regex duplicada en el detector B-03

**File:** `app/lib/create-view-guard.test.ts:95-109, 69-79`
**Issue:** `const qualifier = m[4]` se asigna y se descarta con `void qualifier` (L109); el
grupo 4 de `CREATE_VIEW_RE` existe solo para eso. Además el patrón `create … view …
(public.)?nombre` está escrito DOS veces (L70 y L75) con capturas distintas: si una se
ajusta y la otra no, el nombre reportado dejará de corresponder al match.
**Fix:** eliminar `qualifier`/`void qualifier`, y derivar el nombre del match ya calculado
(`m`) en vez de re-ejecutar una segunda regex.

### IN-02: `>= 70` es un número mágico sin relación con el árbol real

**File:** `app/lib/create-view-guard.test.ts:135`
**Issue:** el assert anti-vacuo usa un piso hardcodeado (77 migraciones reales). Es correcto
como control de ruta rota, pero no distingue "MIGRATIONS_DIR resuelve al árbol real" de
"resuelve a cualquier directorio con ≥70 `.sql`".
**Fix:** extraer a `const MIN_MIGRACIONES_ESPERADAS = 70;` con comentario de fecha/baseline,
y opcionalmente asertar que una migración conocida (p.ej. la `0001`) está en el listado.

### IN-03: `it.each(IDIOMS_APROBADOS)` es cero-vacuo si el array se vacía

**File:** `app/lib/anti-insinuacion-guard.test.ts:1560`
**Issue:** si alguien vacía `IDIOMS_APROBADOS`, el `it.each` genera cero tests y la suite
sigue verde — el self-check D-10(i) desaparece sin ruido (patrón "cero vacuo" ya pagado en
v12 §9).
**Fix:** añadir `expect(IDIOMS_APROBADOS.length).toBeGreaterThanOrEqual(4);` en un `it`
propio junto al `each`.

### IN-04: nombres de view citados con comillas o guiones se reportan truncados

**File:** `app/lib/create-view-guard.test.ts:75`
**Issue:** `["\w]+` no cubre identificadores citados con caracteres no-word
(`create view public."v-x"` → reporta `public."v` ). No afecta la detección (el offender se
reporta igual) pero degrada el mensaje accionable.
**Fix:** alternativa explícita para identificador citado: `(?:"[^"]+"|\w+)`.

---

### No encontrado (verificado explícitamente)

- Cero `test.skip` / `test.only` / `test.todo` / `test.fails` en los dos archivos.
- Cero assert relajado (`toBeTruthy()`, `expect.any`) introducido por la fase.
- `import.meta.dirname` usado en ambos guards; ninguna llamada real a `process.cwd()`.
- `app/package.json`: la única línea nueva es el script `guards`; `dependencies` y
  `devDependencies` intactas.
- Tildes correctas en fixtures (`exprés`, `señal`, `Cámara`); `buildTermRegex` incluye
  acentos en su clase `WORD`, así que el trío del criterio 1 muerde como se declara.

---

_Reviewed: 2026-07-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

## Fixes Applied

**Fixed:** 2026-07-30 · 12/12 findings (2 CR, 6 WR, 4 IN) · 0 skipped
**Commits:** `9630a6e`, `c489c6e`, `1def4c2`

### `9630a6e` — detector B-03 reescrito (`app/lib/create-view-guard.test.ts`)

Cubre **CR-01, CR-02, WR-01, WR-02, WR-05, IN-01, IN-02, IN-04**.

- **CR-01 + WR-02** — `stripSqlComments` + `split(";")` reemplazados por
  `tokenizarSentenciasSql()`: escáner carácter a carácter que reconoce comentarios
  `--` y de bloque, literales `'…'` (con `''` como escape) y dollar-quoting
  (`$$…$$`, `$tag$…$tag$`), y parte solo por `;` de NIVEL SUPERIOR. El contenido de
  literales y bloques `$` se **enmascara** (se vacía) — con eso, ni un `--` ni un `;`
  dentro de un literal fusionan sentencias, y un cuerpo `$$` que menciona
  `create view` no genera offender espurio. El límite simétrico (SQL **dinámico**
  dentro de `$$` no se detecta) queda **documentado en el encabezado y fijado por
  test**, no implícito. `CREATE_VIEW_RE` ya no está anclada a inicio de chunk.
- **CR-02** — la opción `security_invoker` se busca SOLO en el tramo entre el nombre
  de la view y su `as` (`resto.slice(0, idxAs)`), no en el chunk completo. Un invoker
  dentro de un literal o perteneciente a la view vecina ya no blinda a nadie.
- **WR-01** — `MATVIEW_ALLOWLIST` deja de ser código muerto (`void` eliminado): el
  detector la consulta de verdad, comparando sin prefijo `public.` ni comillas. Sigue
  **vacía**, así que el comportamiento observable no cambia — pero el escape hatch
  que el mensaje de error promete ahora existe.
- **WR-05** — nuevo `describe` **(4) Guard-of-the-guards**: lee `app/package.json`,
  parsea el script `guards` y lo cruza en AMBAS direcciones contra el filesystem
  (`lib/*guard*.test.ts` + `components/*guard*.test.ts`). Un guard nuevo sin listar
  falla; un nombre fantasma (guard renombrado/borrado) falla — en vez de que
  `passWithNoTests: true` haga salir 0 corriendo de menos, en silencio.
- **IN-01** — `qualifier` / `void qualifier` eliminados; el nombre se deriva del match
  ya calculado (`extraerNombreView` y su regex duplicada desaparecen).
- **IN-02** — `>= 70` extraído a `MIN_MIGRACIONES_ESPERADAS` con baseline fechada, más
  assert apareado de que la migración `0001` está en el listado (distingue "el árbol
  real" de "cualquier carpeta con ≥70 .sql").
- **IN-04** — identificadores citados (`public."v-x"`) se capturan y reportan enteros.

Tests nuevos en §2 (controles positivos apareados, fixtures STRING inline — D-03
respetado, cero `.sql` en `supabase/migrations/`): los **dos bypasses reproducidos por
el review** (`public.v_leak`, `public.v_bad`) más la variante `--`-dentro-de-`$$`, el
invoker dentro de un literal, el invoker POSTERIOR al `as`, el límite de SQL dinámico,
el identificador citado y la allowlist viva. El archivo pasa de 8 a **21 tests**.

### `c489c6e` — self-checks del carril anti-insinuación (`app/lib/anti-insinuacion-guard.test.ts`)

Cubre **WR-04, WR-03, IN-03**.

- **WR-04** — el anti-drift `(1f)` es ahora **recursivo** (`readdirSync(..., { recursive:
  true })`, separadores normalizados a `/`): caza `panel-*.tsx` en cualquier
  subdirectorio y además todo `.tsx` bajo un directorio cuyo path relativo empiece por
  `panel` (`components/panel/tile-sala.tsx`, `components/panel-tiles/sala.tsx`). Se
  conserva la exclusión `*.test.tsx?` y el assert anti-cero-vacuo. Segundo defecto
  corregido: la comparación es contra `TODAS_LAS_SUPERFICIES`, no solo
  `SUPERFICIES_PANEL` (elimina el falso positivo por criterio DEDUPE).
- **WR-03** — nuevo `it` que cruza `IDIOMS_APROBADOS` × `TERMINOS_PROHIBIDOS` en la
  dirección **inversa** a D-10(i): falla si la última palabra de un idiom es la primera
  de un término prohibido multi-palabra (la resta por substring lo partiría), y también
  si un término prohibido CONTIENE un idiom entero. Hoy pasa en verde sobre los 104
  términos — el punto es que mañana no se pueda introducir el hueco en silencio.
- **IN-03** — `expect(IDIOMS_APROBADOS.length).toBeGreaterThanOrEqual(4)` en un `it`
  propio: vaciar el array ya no hace desaparecer el `it.each` de D-10(i) sin ruido.

Archivo: 48 → **51 tests**.

### `1def4c2` — entrypoint reproducible de los 17 guards (`package.json` raíz)

Cubre **WR-06**. Nuevo script `guards` en la raíz del monorepo que encadena
`pnpm --filter ./app guards` + los 3 guards de `@obs/dinero` + los 3 de `@obs/llm`,
todos **por nombre explícito** (D-13: jamás glob). Clave `"//guards"` adyacente que
documenta el ámbito y el conteo 17 = 11 + 3 + 3. El "17" deja de ser un número de
auditoría y pasa a ser un comando.

### Verificación

| Comando | Resultado |
|---|---|
| `cd app && npx vitest run lib/create-view-guard.test.ts lib/anti-insinuacion-guard.test.ts` | ✅ 2 files, 72 tests |
| `cd app && pnpm guards` | ✅ **11 passed (11)** — 334 tests |
| `pnpm guards` (raíz, WR-06) | ✅ 11 + 3 + 3 files · 334 + 34 + 7 tests |
| `cd app && pnpm test` | ✅ **108 files, 1620 tests** (baseline ≥ 1607) |
| `git status --porcelain supabase/migrations` | ✅ vacío |

Ningún assert existente fue relajado, ningún `test.skip/only` introducido, cero
`process.cwd()`, cero globs en scripts, `supabase/migrations/` intacto.

_Fixed: 2026-07-30_
_Fixer: Claude (gsd-code-fixer)_
