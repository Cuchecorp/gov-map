---
fase: 122
fragmento: 04-fixes
estado: borrador
fecha: 2026-07-29
ancla_temporal: "2026-07-29 (ancla de la fase, fijada por 122-CRUCES-SQL-00-METODO.md §0.0.1)"
consume: [122-CRUCES-SQL-01-RELACIONES-COMPARAR.md, 122-CRUCES-SQL-02-CRUCES-ACTUALIDAD.md, 122-CRUCES-SQL-03-LOBBY.md]
consumido_por: [122-06, 124, 125]
metodo_ref: "122-CRUCES-SQL-00-METODO.md"
---

# 122 — CRUCES × SQL · Fragmento 04: bitácora de fixes

> Único fragmento de la fase que **toca código**. Cierra en el sitio cada fila que los planes
> 122-02/03/04 marcaron `discrepancia-corregida`, y deja declarada la cobertura parcial.
>
> **Régimen cumplido:** cero deploy (viaja con la **Phase 125**), cero flags `*_PUBLIC_ENABLED`
> tocados, cero `supabase db push`, **ninguna migración aplicada a PROD**.
>
> **LÍMITE A de 00 §0.5 sigue vigente:** estos fixes **no están en producción**. `/parlamentario/S1338`
> seguirá mostrando `0 reuniones` y `/proyecto/[boletin]` seguirá sin declarar su cobertura **hasta
> que la Phase 125 despliegue**. La re-verificación post-deploy es de 125, no de esta fase.

---

## 0. Aritmética de cobertura de la bitácora (identidad obligatoria)

Recuento de filas `discrepancia-corregida` en los **tres** fragmentos de auditoría, contadas sobre
las **tablas de veredicto** (no sobre menciones en prosa):

| fragmento | filas de veredicto | `discrepancia-corregida` | cuáles |
|-----------|-------------------:|-------------------------:|--------|
| `122-CRUCES-SQL-01-RELACIONES-COMPARAR.md` | 32 | **0** | — (§Recuento: 0 corregidas; 3 declaradas: 2.1/2.5/2.6 por el cap `p_limit`, 3.3 fail-closed CR-01) |
| `122-CRUCES-SQL-02-CRUCES-ACTUALIDAD.md` | 31 | **0** | — (§5 Recuento: `total 31 / cuadra 28 / corregida 0 / declarada 3`) |
| `122-CRUCES-SQL-03-LOBBY.md` | 13 | **2** | **5.11**, **5.12** |
| **total** | **76** | **2** | |

**Identidad exigida por el acceptance del plan:**

```
filas en la tabla de fixes (§1)          =  2
filas en "Fixes NO aplicados" (§2)       =  0
                                          ---
suma                                      =  2
total de filas `discrepancia-corregida`   =  2      ✔ IDENTIDAD CUMPLIDA
```

**Cero filas huérfanas.** Las 2 filas se corrigieron; ninguna se degradó.

### 0.1 Techo de alcance — NO se activó

La válvula de presupuesto del plan degrada filas a `discrepancia-declarada` si el trabajo supera
**8 filas o 6 archivos de `app/`**. Medido antes de tocar nada:

| magnitud | medido | techo | ¿se activa? |
|----------|-------:|------:|:-----------:|
| filas `discrepancia-corregida` | **2** | 8 | **no** |
| archivos de `app/` tocados (sin contar tests) | **3** | 6 | **no** |

Archivos de `app/` modificados: `app/parlamentario/[id]/page.tsx`,
`components/capa1/lobby-capa1.tsx`, `components/lobby-menciones-de-boletin.tsx`
(+ `lib/anti-insinuacion-guard.test.ts` y los 2 tests colindantes). **Ambas filas caben dentro del
techo**, así que las dos se corrigieron y no hubo que priorizar por daño al lector.

---

## 1. Tabla de fixes aplicados

Molde de columnas (el exigido por el plan 122-05, Task 2). La columna
`| discrepancia |` lleva **ambos números** —`nº deploy → nº SQL`— porque un fix **nunca borra la
evidencia del número anterior** (corolario de 00 §0.1):

```
| # | fragmento y fila origen | discrepancia (nº deploy → nº SQL) | archivo:línea | qué cambió | test de respaldo | estado |
```


| # | fragmento y fila origen | discrepancia (nº deploy → nº SQL) | archivo:línea | qué cambió | test de respaldo | estado |
|---|-------------------------|-----------------------------------|---------------|------------|------------------|--------|
| 1 | `122-CRUCES-SQL-03-LOBBY.md` §2.4 **fila 5.11** | deploy: **`0 reuniones`** (un HECHO cuantificado) → SQL: **no hay número** — el estado real de `S1338` es `no_ingerido` (`Q-L05`: 0 audiencias **y** 0 filas de marcador `lobby_ingesta_estado`), que por definición **no tiene denominador conocido** | `app/app/parlamentario/[id]/page.tsx:617` (call-site) + `app/components/capa1/lobby-capa1.tsx:18-45` (prop y render) | **Fix de TIPO, no de copy.** `page.tsx` pasaba `total={conteos.lobby.tipo === "dato" ? conteos.lobby.n : 0}`, colapsando `vacio` **y** `no_ingerido` al literal `0`. Ahora `LobbyCapa1` recibe el **`CarrilEstado` completo** y la línea de conteo se emite **sólo** con `tipo === "dato"`; con `vacio`/`no_ingerido`/`pendiente` se **omite** — espejo exacto de `cruces-capa1.tsx:28` (`{sector.nVotos > 0 && …}`). Quien declara el 3-estado sigue siendo `conteoLabel` (`page.tsx:89-100`), su único emisor legítimo | `components/capa1/lobby-capa1.test.tsx` → `describe("5.11 — un estado no-\`dato\` JAMÁS se imprime como el hecho \`0 reuniones\`")`, **5 casos**: `no_ingerido`, `vacio` y `pendiente` omiten el conteo (y **no emiten ningún dígito**); `dato` n=0 **sí** declara su cero; `dato` n=1 usa el singular | **aplicado** |
| 2 | `122-CRUCES-SQL-03-LOBBY.md` §3.4 **fila 5.12** | deploy: **no emitido** — no existía literal de cobertura en ninguna superficie (`grep` de `cobertura` / `3,8 %` / `5.106` / `5106` en `app/` sin tests → cero) → SQL (`Q-L07`, 2026-07-29): **195 / 5.106 = 3,82 %** sobre **82** boletines distintos | `app/components/lobby-menciones-de-boletin.tsx` — constante `COBERTURA_MENCIONES_LOBBY` (tras `EMPTY_MENCIONES_LOBBY`) + render en `LobbyMencionesView` (tras la leyenda anti-causal, **antes** del conteo) | Línea de **cobertura parcial declarada**, presente en los **tres** caminos de la vista (con filas, empty y truncado). Literal: *«195 de las 5.106 audiencias registradas con parlamentario identificado citan el número de un boletín en su materia (3,8 %), según fuente al 29 jul 2026. Este recuento cubre solo esa parte del registro.»* Cifra **horneada con su fecha** (ver §1.2 la adjudicación). Idiom aprobado **"según fuente al …"**; **"captura" pelado ausente**; cero causalidad, cero intención — describe **el canal**, no a nadie; el parcial **nunca** se presenta como total | `components/lobby-menciones-de-boletin.test.tsx` → `describe("LobbyMencionesView — 5.12: cobertura parcial declarada")`, **5 casos**: presencia en los 3 caminos + orden (leyenda → cobertura → conteo) + la cifra viaja con su fecha y sin "captura" + negative-match anti-causal. Y `lib/anti-insinuacion-guard.test.ts` → `(1e) COBERTURA-122` (Wave-0) | **aplicado** |

### 1.1 Antes / después observable

**Fila 5.11 — `/parlamentario/S1338`, `<section id="lobby">`:**

| | encabezado del carril (`CarrilHeader`) | capa-1 (`LobbyCapa1`) |
|---|---|---|
| **antes** (deploy actual) | `—` (honesto: no ingerido) | **`0 reuniones`** ← afirmación de hecho, contradice al encabezado |
| **después** (este fix, pendiente de deploy 125) | `—` (sin cambio) | **línea omitida** — ningún dígito fabricado |

Las dos frases ya no se contradicen dentro de la misma sección. La regla LOCKED de
`lobby-de-parlamentario.tsx:47` (*"Un vacío es un HECHO, no una virtud: 'no ingestado' ≠ 'ingestado,
cero'"*) queda respetada por la capa-1, que era quien la violaba.

**Cero honesto preservado:** un carril con `tipo: "dato", n: 0` **sigue** imprimiendo `0 reuniones`.
El fix **no rellena ni oculta ningún cero real** — sólo deja de fabricar uno donde no hay
denominador. Anclado por el test `dato con n=0 SÍ declara el cero`.

**Fila 5.12 — `/proyecto/14309-04`, sección de menciones:**

| | orden de lectura |
|---|---|
| **antes** | heading → leyenda anti-causal (criterio) → **`1 audiencia registrada menciona este boletín.`** |
| **después** | heading → leyenda anti-causal (criterio) → **cobertura declarada (parcialidad + cifra + fecha)** → `1 audiencia registrada menciona este boletín.` |

La parcialidad se lee **antes** que el número (anclado por un assert de orden sobre `indexOf`). En el
camino **empty** —donde más se puede leer un `0` como *"no hubo lobby"*— la línea también está.

### 1.2 Decisión adjudicada: la cifra se HORNEA (con su fecha)

El fragmento 03 §3.4 dejó pendiente para 122-05 *"si la cifra se hornea como literal fechado o se
deriva en runtime"*. **Adjudicado: se hornea**, siguiendo la recomendación del propio fragmento.

| opción | coste | veredicto |
|--------|-------|-----------|
| **hornear** literal fechado | un literal que envejece en silencio, mitigado por: fecha explícita en el propio copy + `Q-L07` re-ejecutable tal cual + comentario en el código que ordena re-verificar cada milestone y actualizar **cifra y fecha juntas** | **elegida** |
| derivar en runtime | exige una **RPC pública nueva** = aguja completa (secdef PII-safe, `search_path=''`, bounded, `statement_timeout`, doble-revoke, entrada en `PUBLIC_RPC_ALLOWLIST`) + su pgTAP + apply en 124 — desproporcionado para **una línea de copy**, y añadiría una superficie SQL nueva a una fase cuyo régimen es *cero apply* | descartada |

La cifra **no cambió** entre 92-04 (v9.0) y hoy (5.106 / 195 / 82 idénticos), lo que respalda que el
horneado no es frágil en la práctica: es una cobertura estructuralmente estable por el fail-closed
doble de 0062/0063.

### 1.3 Wave-0 del linter — ejecutada ANTES del copy

**Sí fue requerida.** El fix 5.12 no toca superficie nueva (`components/lobby-menciones-de-boletin.tsx`
ya vive en `SUPERFICIES_LOBBY`), pero **sí introduce un vector de vocabulario nuevo**: declarar una
cifra de cobertura parcial abre la tentación de **editorializar el HUECO**. Decir "3,8 %" es un
HECHO; decir que ese 3,8 % es *"la punta del iceberg"*, una *"cifra negra"*, un *"subregistro"*, o
que las audiencias *"en realidad son"* más, **afirma un número no observado y atribuye ocultamiento a
la fuente** — el riesgo #1 del proyecto aplicado a la declaración de cobertura.

Añadido **antes** de escribir el copy (commit `45cdac4`, anterior a `5c8f1a4`):

- **`TERMINOS_COBERTURA`** (constante **nueva**, cero renames — Pitfall 1): `punta del iceberg`,
  `subregistro`, `cifra negra`, `zona oscura`, `en realidad son`, `muy por debajo`. Spread en
  `TERMINOS_PROHIBIDOS` ⇒ escaneados sobre **todas** las superficies de **todos** los carriles.
  DEDUPE verificado: `oculta`/`esconde`/`censura` ya viven en `TERMINOS_LINK_EXT`, `captura` en el
  carril MONEY → no se re-agregan. Falso positivo descartado por grep: **cero** ocurrencias de los 6
  términos en `app/{components,app,lib}` fuera de tests.
- **`(1e) COBERTURA-122`**: pasa el literal VERBATIM de 5.12 por el detector real **antes** de que
  existiera en el componente (precedente `(1d)` FECHA-02, fixture en memoria), y ancla que la cifra
  trae `"según fuente al"` y **no** trae `captura`.
- **Mutation self-check** `COBERTURA (122-05)`: fixture en memoria con el copy escrito MAL; exige que
  los 6 términos sean cazados.

**El detector MUERDE (demostrado, no afirmado).** Quitando el spread `...TERMINOS_COBERTURA,` de
`TERMINOS_PROHIBIDOS` y re-corriendo:

```
× (2) Mutation self-check — el guard SÍ muerde > COBERTURA (122-05): caza editorialización del HUECO …
  → El detector NO cazó editorialización de cobertura inyectada → el guard COBERTURA sería un no-op:
    expected [] to deeply equal ArrayContaining{…}
  Tests  1 failed | 41 passed (42)
```

Restaurado el spread → **42 passed**. El árbol actual no produce ningún falso positivo.

**`NEGACIONES_LOCKED` NO se tocó**: el literal de cobertura **no contiene ningún término prohibido,
ni siquiera para negarlo** (a diferencia de la leyenda `:87` y el empty `:95`, que sí están restados).
Añadirlo habría sido una resta gratuita que debilita el detector.

---

## 2. Fixes NO aplicados

**Ninguno.** Las **2** filas `discrepancia-corregida` de los fragmentos se cerraron en código.

| # | fila | motivo de no aplicación |
|---|------|-------------------------|
| — | — | *(sección vacía: cero filas degradadas a `discrepancia-declarada` por este plan)* |

La sección se conserva **explícitamente vacía**, y no borrada, para que la identidad aritmética de §0
sea verificable por el plan 122-06 sin tener que inferir la ausencia.

### 2.1 Filas `discrepancia-declarada` que este plan NO tenía que corregir

Registradas aquí **solo como mapa de handoff** — ya venían declaradas por sus fragmentos de origen
con ambos números, y el criterio 3 de la fase admite *"corregida **o** declarada"*. **Este plan no
las degradó: nacieron declaradas.** Se listan para que 122-06 y 125 no las busquen en la tabla §1.

| fila origen | qué | por qué NO se corrige en 122-05 | handoff nombrado |
|-------------|-----|---------------------------------|------------------|
| 01 §2 **2.1 / 2.5 / 2.6** | cap `p_limit: 1000` en votos: `D1165` tiene **3.752**, el deploy muestra **1.000** en chip, `<h2>` y `Ver detalle`. Agravante: la RPC ordena `by fecha desc`, así que **también distorsiona la composición** (mostrado 469/466/22/16/27 vs real 1764/1772/171/16/29; asistencia 99,2 % → 97,3 %) | El fix honesto exige un **RPC de conteo dedicado** (o un `total_n` de window en la RPC existente): el número correcto **no existe** en la respuesta actual. El plan prohíbe improvisarlo, y la **sincronía obligatoria** manda: `parlamentario-resumen-conteos.ts:271-278` es espejo byte-a-byte del cap de `VotosSection` — cambiar un solo lado **desincroniza** chip y sección. Tocar ambos sin el dato honesto sólo movería la mentira de sitio | **Phase 124 (SUPA-FIX)** — requiere SQL nuevo. Ver §3: **no se escribió `0073`** en esta fase; el diseño de la RPC de conteo es de 124 |
| 02 §4 **4-14** | tile *Por materia* agrupa **3.100 / 3.675 (84,4 %)** sin declarar la cobertura | El fix exige un **denominador que la RPC no emite**: es **SQL, no sólo copy**. Declararlo con una cifra horneada sería posible, pero el fragmento 02 lo dejó como `discrepancia-declarada` **porque los números cuadran** — es cobertura no declarada, no un número falso | **Phase 124** (denominador en la RPC) → copy en **125** |
| 02 §4 **4-15** | dos grafías de cámara en la landing (`Senado`/`C.Diputados` normalizadas vs `senado`/`camara` crudas de agenda) | El fix correcto es el **materializador 0065** (defecto D2, `0065:233,261` emiten la columna cruda), **no** maquillar en el cliente. Normalizar en el componente escondería el defecto de origen | **Phase 124** (corrección en 0065) |
| 02 §3.b **3.b-9** | empty-state muerto de **E-053** (`cruces-de-parlamentario.tsx:128-139`): no se monta porque `page.tsx` exige `tipo === "dato"` | Hallazgo de **catálogo/atribución de emisor**, prioridad baja. No altera ningún conteo mostrado. Mismo caso que los empty-states inalcanzables de E-002 (03 §4): **código defensivo, no bug de datos** | **catálogo 113** (atribución de emisor); sin acción de código |
| 01 §3 **3.3** | co-autoría en `/comparar` truncada a 20: no permite determinar si comparten proyectos co-firmados | Es la **disciplina fail-closed CR-01 deliberada** — una ausencia falsa con atribución de fuente es el riesgo #1 del proyecto. El fix exigiría **rediseñar la RPC** para emitir membresía de par | **Phase 124** (rediseño de RPC) |
| 03 §1.5 **5.5** | rama `LIMIT 50` de lobby no observable: `max(total_n) = 13` sobre los 82 boletines | **No hay discrepancia que corregir** — es una rama de código sin ningún caso real que la ejerza. Por inspección estática `:214` (`const truncado = total > mostradas`) lee `total_n`, no `mostradas`, y es correcta | **Phase 125** (verificación post-deploy si algún boletín superara 50); sin acción de código. El test `declara la cobertura en el camino TRUNCADO` de 5.12 **sí** ejercita esa rama con un fixture (`total_n: 80`) |

**Emisores huérfanos** (`E-029 ResumenView`, `E-003 voto-ficha-row`, `E-008 actualidad-module`, empty
de `E-053`): sus números **no llegan a ningún DOM** (00 §0.4). Son hallazgos de **catálogo**, no
defectos. **No se tocaron** — "arreglarlos" sería trabajo sobre código que nadie renderiza.

---

## 3. Migración

**Sin migración: todos los fixes fueron de código.**

**No existe** `supabase/migrations/0073_*.sql` en esta fase. Filas revisadas para decidirlo:

| fila | ¿exige SQL? | resolución |
|------|:-----------:|------------|
| **5.11** (`0 reuniones` sobre `no_ingerido`) | **no** | Fix de **tipo** en TSX (`page.tsx:617` + `capa1/lobby-capa1.tsx`). El fragmento 03 ya lo declaró: *"cero SQL, cero migración"* |
| **5.12** (cobertura no declarada) | **no** | Cifra **horneada** con su fecha (§1.2). Derivarla habría exigido una RPC pública nueva — descartado por desproporcionado |

Las filas que **sí** exigen SQL (2.1/2.5/2.6, 4-14, 4-15, 3.3) están **declaradas**, no corregidas, y
su diseño pertenece a la **Phase 124** (§2.1). Escribir una `0073` especulativa aquí, sin el diseño de
124, habría dejado una migración huérfana sin pgTAP contra un contrato aún no adjudicado.

**Consecuencia de régimen:** cero `supabase db push`, cero `psql -f`, cero DDL, cero DML. La última
migración numerada del repo sigue siendo **0072**. No hay `## Handoff a la Phase 124 (SUPA-FIX)` con
archivo de migración porque **no hay archivo que entregar** — lo que 124 recibe es el **listado de
trabajo SQL** de §2.1, no un `.sql` escrito.

---

## 4. Estado de la suite y de los guards

Corridos al cierre del plan, sobre el árbol con los 3 commits aplicados.

| verificación | comando | resultado |
|--------------|---------|-----------|
| suite `app/` | `pnpm vitest run` | **1572 passed / 107 files** (mínimo exigido: ≥1428) ✔ |
| typecheck | `pnpm exec tsc --noEmit` | **exit 0** ✔ |
| anti-insinuación | `pnpm vitest run lib/anti-insinuacion-guard.test.ts` | 42 ✔ (40 antes + 2 de Wave-0) |
| lockdown | `lib/lockdown-guard.test.ts` | **22** ✔ |
| anti-flip VSIM | `lib/vsim-antiflip-guard.test.ts` | 20 ✔ |
| anti-flip NOTIF | `lib/notif-antiflip-guard.test.ts` | 20 ✔ |
| anti-flip MONEY | `lib/money-antiflip-guard.test.ts` | 20 ✔ |
| bento | `lib/bento-guards.test.ts` (114) + `lib/bento-coherencia-guard.test.ts` (8) | 122 ✔ |
| name-match-RUT | `lib/name-match-rut-guard.test.ts` | 15 ✔ |
| env-example | `lib/env-example-guard.test.ts` | 16 ✔ |
| integ-scope | `packages/llm/src/integ-scope-guard.test.ts` | 3 ✔ |
| provider-guard | `packages/llm/src/provider-guard.test.ts` | 3 ✔ |

**Guards de régimen: 11/11 verdes.**

### 4.1 Verificación de las prohibiciones del plan

| prohibición | verificación | resultado |
|-------------|--------------|-----------|
| ningún `.env*` ni `.github/workflows/` tocado | `git diff --name-only \| grep -E '\.env\|\.github/workflows' \| wc -l` | **0** ✔ |
| ningún `*_PUBLIC_ENABLED` tocado | `git diff \| grep -c "PUBLIC_ENABLED"` | **0** ✔ |
| cero literales `captura` pelados nuevos | `git diff -U0 -- app/ \| grep '^+' \| grep -i captura` | **7 líneas, cero en copy renderizado**: 2 nombres de `it(...)`, 2 asserts `not.toMatch(/captura/i)`, 3 líneas de comentario que enuncian la prohibición. Toda ocurrencia es una **negación o una regla**, ninguna es texto mostrado ✔ |
| ninguna migración aplicada a PROD | `git log`/`git diff` — cero `supabase db push`, cero `psql -f`, cero archivo bajo `supabase/migrations/` | ✔ |
| cero PII / cero cadenas de conexión Postgres en artefactos | este fragmento sólo cita agregados (195, 5.106, 82, 3,82 %) y nombres de columna; `SUPABASE_DB_URL` no aparece ni como nombre (esta fase no corrió `psql`) | ✔ |

---

## 5. Commits

| commit | tarea | qué |
|--------|-------|-----|
| `45cdac4` | Task 1 (Wave-0) | `TERMINOS_COBERTURA` + `(1e) COBERTURA-122` + mutation self-check. **122 insertions, 0 deletions** ⇒ cero renames de constantes preexistentes. Cero archivos de copy tocados |
| `df6364d` | Task 2 (RED) | Tests de 5.11 y 5.12 — **12 fallando** antes de implementar |
| `5c8f1a4` | Task 2 (GREEN) | `page.tsx:617` + `capa1/lobby-capa1.tsx` (5.11) y `lobby-menciones-de-boletin.tsx` (5.12) |

---

## 6. Qué queda para 125

1. **Desplegar** — es el único modo de que estos 2 fixes lleguen a producción (LÍMITE A).
2. **Re-verificar contra el DOM desplegado**, con el patrón tolerante a los separadores `<!-- -->` de
   React (HALLAZGO B de 00 §2.3):
   - `/parlamentario/S1338` → la capa-1 de `<section id="lobby">` **no** debe emitir ningún dígito, y
     el encabezado debe seguir en `—`.
   - `/parlamentario/D1165` → **sigue** mostrando `112 reuniones` (control de no-regresión: es un
     `dato`, el fix no debe tocarlo).
   - `/proyecto/14309-04` y `/proyecto/16849-12` → la línea de cobertura debe aparecer **antes** del
     conteo, con `3,8 %` y `29 jul 2026`.
3. **Re-ejecutar `Q-L07`** para confirmar que la cifra horneada sigue vigente; si cambió, actualizar
   **cifra y fecha juntas** en `COBERTURA_MENCIONES_LOBBY`.
