---
phase: 122
plan: 05
subsystem: correccion-cruces
tags: [lobby, cobertura, vacios-honestos, anti-insinuacion, wave-0, tdd]
requires:
  - "122-CRUCES-SQL-00-METODO.md"
  - "122-CRUCES-SQL-01-RELACIONES-COMPARAR.md"
  - "122-CRUCES-SQL-02-CRUCES-ACTUALIDAD.md"
  - "122-CRUCES-SQL-03-LOBBY.md"
provides: ["122-CRUCES-SQL-04-FIXES.md"]
affects: ["122-06", "124", "125"]
tech-stack:
  added: []
  patterns:
    - "Wave-0 del linter anti-insinuación ANTES del copy (TERMINOS_COBERTURA + (1e) + mutation self-check)"
    - "Omisión honesta por CarrilEstado (espejo de cruces-capa1.tsx:28) en vez de colapsar a 0"
    - "Cifra de cobertura HORNEADA con su fecha en vez de derivada por RPC nueva"
key-files:
  created:
    - .planning/phases/122-cruce-sql-cruces-visibles-sql-de-prod/122-CRUCES-SQL-04-FIXES.md
  modified:
    - app/lib/anti-insinuacion-guard.test.ts
    - app/app/parlamentario/[id]/page.tsx
    - app/components/capa1/lobby-capa1.tsx
    - app/components/capa1/lobby-capa1.test.tsx
    - app/components/lobby-menciones-de-boletin.tsx
    - app/components/lobby-menciones-de-boletin.test.tsx
    - .planning/phases/122-cruce-sql-cruces-visibles-sql-de-prod/122-CRUCES-SQL-03-LOBBY.md
decisions:
  - "Las 2 filas discrepancia-corregida de la fase (5.11, 5.12) se CORRIGIERON; cero degradadas. Identidad aritmética 2 + 0 == 2"
  - "Wave-0 SÍ fue requerida: TERMINOS_COBERTURA (6 términos) cierra la editorialización del HUECO de una cobertura parcial declarada — vector nuevo que ningún carril cubría"
  - "La cifra de cobertura lobby↔PL se HORNEA con su fecha (3,8 %, 29 jul 2026); derivarla exigía una RPC pública nueva = aguja completa, desproporcionado para una línea de copy"
  - "5.11 es fix de TIPO: LobbyCapa1 recibe CarrilEstado y omite el conteo salvo tipo==='dato'; el cero honesto (dato n=0) se preserva"
  - "Sin migración: NO existe 0073. Las filas que exigen SQL (cap p_limit, 4-14, 4-15, 3.3) nacieron declaradas y su diseño es de la Phase 124"
  - "COBERTURA_MENCIONES_LOBBY NO entra a NEGACIONES_LOCKED: no contiene término prohibido ni para negarlo — restarlo debilitaría el detector"
metrics:
  tasks: 3
  commits: 4
  files_created: 1
  files_modified: 7
  tests_total: 1572
  guards_verdes: 11
  completed: 2026-07-29
---

# Phase 122 Plan 05: fixes de cruces — Summary

Las **2** filas `discrepancia-corregida` de la fase quedaron cerradas en código con test de respaldo:
un `no_ingerido` que se imprimía como el hecho `0 reuniones`, y una cobertura parcial del 3,8 % que
el sitio nunca cuantificaba. Cero deploy, cero migración, cero flags.

## Qué se hizo

**Task 1 — Wave-0 del linter (commit `45cdac4`).** Inventariados los fixes de copy: 5.11 no lleva
copy (es fix de tipo) y 5.12 no toca superficie nueva (`lobby-menciones-de-boletin.tsx` ya vive en
`SUPERFICIES_LOBBY`). Pero **sí** introduce un vector de vocabulario nuevo, así que la Wave-0 fue
requerida y se ejecutó **antes** de escribir una sola línea de copy.

**Task 2 — los 2 fixes, en TDD (commits `df6364d` RED → `5c8f1a4` GREEN).** 12 tests fallando antes
de implementar; 69 verdes después sobre los 3 archivos tocados.

**Task 3 — sin migración + guards.** Ninguna fila exigió SQL ⇒ no se creó `0073`. 11/11 guards de
régimen verdes.

## Los 2 fixes

**5.11 — `no_ingerido` impreso como el hecho `0 reuniones`.** `page.tsx:617` pasaba
`total={conteos.lobby.tipo === "dato" ? conteos.lobby.n : 0}`, colapsando `vacio` **y**
`no_ingerido` al literal `0`. En `/parlamentario/S1338` la **misma sección** declaraba `—` en su
encabezado (honesto) y `0 reuniones` tres líneas más abajo (afirmación de hecho), violando la regla
LOCKED de `lobby-de-parlamentario.tsx:47` (*"'no ingestado' ≠ 'ingestado, cero'"*).

`LobbyCapa1` ahora recibe el **`CarrilEstado` completo** y omite la línea de conteo salvo
`tipo === "dato"` — espejo exacto de `cruces-capa1.tsx:28`. **El cero honesto se preserva**: un
`dato` con `n=0` sigue imprimiendo `0 reuniones` (anclado por test). El fix no rellena ni oculta
ningún cero real; sólo deja de fabricar uno donde no hay denominador.

**5.12 — cobertura parcial no declarada.** La superficie declaraba el **criterio** (leyenda `:87`,
empty `:95`, ambos honestos) pero nunca **cuantificaba**: un lector de `14309-04` veía *"1 audiencia
registrada menciona este boletín"* sin saber que sólo el 3,8 % de las audiencias confirmadas entra al
canal. Se añadió `COBERTURA_MENCIONES_LOBBY`, renderizada tras la leyenda y **antes** del conteo, en
los **tres** caminos de la vista (con filas, empty, truncado) — en el empty es donde más se puede
leer un `0` como *"no hubo lobby"*.

> 195 de las 5.106 audiencias registradas con parlamentario identificado citan el número de un
> boletín en su materia (3,8 %), según fuente al 29 jul 2026. Este recuento cubre solo esa parte del
> registro.

Idiom aprobado **"según fuente al …"**; `captura` pelado ausente; cero causalidad ni intención (la
línea describe **el canal**, no a nadie); ambos números presentes ⇒ el parcial nunca se presenta
como total.

## Aritmética de cobertura (identidad del acceptance)

| fragmento | filas de veredicto | `discrepancia-corregida` |
|-----------|-------------------:|-------------------------:|
| 01 — relaciones / comparar | 32 | **0** (su §7: *"Para 122-05 — NADA"*) |
| 02 — cruces / actualidad | 31 | **0** (su §5: `corregida 0`) |
| 03 — lobby | 13 | **2** (5.11, 5.12) |
| **total** | **76** | **2** |

```
tabla de fixes (§1)              = 2
"Fixes NO aplicados" (§2)        = 0
                                  ---
suma                              = 2   ==   total discrepancia-corregida = 2   ✔
```

**Cero filas huérfanas. Cero degradadas.** El techo de alcance (8 filas / 6 archivos de `app/`) **no
se activó**: 2 filas y 3 archivos de `app/`.

## Wave-0 — el detector MUERDE (demostrado)

Declarar una cifra de cobertura parcial abre un vector que ningún carril cubría: **editorializar el
HUECO**. Decir "3,8 %" es un HECHO; decir que es *"la punta del iceberg"*, una *"cifra negra"* o que
las audiencias *"en realidad son"* más, afirma un número no observado y atribuye ocultamiento a la
fuente — el riesgo #1 del proyecto aplicado a la cobertura.

Añadido **antes** del copy: `TERMINOS_COBERTURA` (constante **nueva**, cero renames) con
`punta del iceberg`, `subregistro`, `cifra negra`, `zona oscura`, `en realidad son`,
`muy por debajo`, spread en `TERMINOS_PROHIBIDOS` ⇒ escaneados sobre **todas** las superficies. Más
el test `(1e) COBERTURA-122` (pasa el literal por el detector real antes de que existiera) y un
mutation self-check.

**Output del run MUTADO** (quitando el spread de `TERMINOS_PROHIBIDOS`):

```
× (2) Mutation self-check — el guard SÍ muerde > COBERTURA (122-05): caza editorialización del HUECO …
  → El detector NO cazó editorialización de cobertura inyectada → el guard COBERTURA sería un no-op:
    expected [] to deeply equal ArrayContaining{…}
  Tests  1 failed | 41 passed (42)
```

Restaurado → **42 passed**, cero falsos positivos sobre el árbol actual (grep previo: 0 ocurrencias
de los 6 términos en `app/`).

`NEGACIONES_LOCKED` **no se tocó**: el literal de cobertura no contiene término prohibido ni siquiera
para negarlo. Restarlo habría sido una resta gratuita que debilita el detector.

## Sin migración

**No existe `supabase/migrations/0073_*.sql`.** Ninguna de las 2 filas exigió SQL: 5.11 es fix de
tipo en TSX; 5.12 se resolvió horneando la cifra (derivarla exigía una RPC pública nueva = aguja
completa: secdef PII-safe, `search_path=''`, bounded, doble-revoke, `PUBLIC_RPC_ALLOWLIST` — coste
desproporcionado para una línea de copy). La última migración numerada del repo sigue siendo
**0072**. Las filas que sí exigen SQL (cap `p_limit`, 4-14, 4-15, 3.3) **nacieron declaradas** por
sus fragmentos y su diseño pertenece a la **Phase 124**; escribir una `0073` especulativa habría
dejado una migración huérfana contra un contrato no adjudicado.

## Desviaciones del plan (RULE-1 — mandó la realidad)

**1. [RULE-1] Un test preexistente asertaba la ausencia del idiom que 5.12 introduce.**
`lobby-menciones-de-boletin.test.tsx:150` decía
`expect(container.textContent).not.toContain("según fuente al")` sobre **todo** el contenedor. El
fragmento 03 §3.4 ordena usar ese idiom exacto para la línea de cobertura ⇒ colisión directa. El
hecho que el test protege es que **la FILA no lleva fecha de badge** (esta superficie no monta
`ProvenanceBadge`), no que la sección entera no pueda fechar nada. **Después:** el assert se acotó al
`<li>` de la fila y se le **añadió** un assert de `captura` pelada sobre toda la superficie. Se
conservó la regla y se corrigió el alcance; documentado verbatim en el comentario del test para que
no se lea como una relajación.

**2. [RULE-1] El plan anticipaba hasta 8 filas y 6 archivos; la realidad fueron 2 y 3.** El
`<execution_context>` describía el cap `p_limit`, el tile *Por materia* y las dos grafías de cámara
como material de esta ola, pero los fragmentos 01 y 02 los emitieron con veredicto
`discrepancia-declarada`, **no** `-corregida`, y la lista de trabajo de la Task 2 es explícitamente
*"las filas con veredicto `discrepancia-corregida` … son la lista de trabajo COMPLETA de esta tarea;
ninguna otra"*. **Después:** no se estiró el alcance a filas que sus dueños ya habían adjudicado a
124/125. Se registraron las 6 en `§2.1` de la bitácora con su handoff nombrado, para que la ausencia
sea explícita y no parezca omisión. **Nada quedó sin registrar.**

**3. [RULE-1] `(1e)` usa un literal verbatim en memoria, no el import de la constante.** La
tentación era importar `COBERTURA_MENCIONES_LOBBY` en el guard, pero el acceptance de la Task 1 exige
**cero cambios en archivos de copy** en esa tarea, y la constante aún no existía. **Después:** se
siguió el precedente `(1d) FECHA-02` (fixture EN MEMORIA con el string verbatim), que es el patrón
Wave-0 canónico del repo: el idiom pasa por el detector **antes** de que el copy exista. El test `5.12`
del componente sí importa la constante real, así que la equivalencia literal-copy queda anclada por
el otro lado.

**4. [Desviación de proceso] La `0073` no se escribió, y eso es cumplimiento, no omisión.** La Task 3
está condicionada (*"Si —y solo si— la Task 2 degradó alguna fila por requerir SQL"*). Cero
degradadas ⇒ rama negativa: se escribió la frase exigida *"Sin migración: todos los fixes fueron de
código"* con la lista de filas revisadas.

## Estado de la suite y guards

| verificación | resultado |
|--------------|-----------|
| `pnpm vitest run` en `app/` | **1572 passed / 107 files** (exigido ≥1428) ✔ |
| `pnpm exec tsc --noEmit` | **exit 0** ✔ |
| anti-insinuación | 42 ✔ (40 → 42) · lockdown **22** ✔ |
| anti-flip VSIM / NOTIF / MONEY | 20 / 20 / 20 ✔ |
| bento (114 + 8) · name-match-RUT 15 · env-example 16 | ✔ |
| integ-scope 3 · provider-guard 3 (`packages/llm`) | ✔ |

**11/11 guards de régimen verdes.**

## Cumplimiento del régimen

| restricción | cumplimiento |
|-------------|--------------|
| cero deploy | ningún build/publish; viaja con la Phase 125 |
| cero flags `*_PUBLIC_ENABLED` | `git diff \| grep -c PUBLIC_ENABLED` → **0** |
| cero `supabase db push` / apply a PROD | ninguna migración escrita ni aplicada; última numerada sigue **0072** |
| ningún `.env*` ni `.github/workflows/` | `git diff --name-only \| grep -E '\.env\|\.github/workflows'` → **0** |
| cero `captura` pelado nuevo | 7 líneas nuevas mencionan `captura`: **todas** son nombres de test, asserts `not.toMatch(/captura/i)` o comentarios que enuncian la prohibición. **Cero en copy renderizado** |
| idiom `según fuente al` | usado en la única línea de copy nueva, con su fecha |
| cero PII / cero cadenas de conexión | sólo agregados (195, 5.106, 82, 3,82 %) y nombres de columna |
| ámbito del commit | los 2 archivos pre-existentes modificados (`119-REVIEW.md`, `pnpm-workspace.yaml`) **no** se tocaron |

## Commits

| commit | qué |
|--------|-----|
| `45cdac4` | Task 1 — Wave-0 del linter (122 insertions, **0 deletions** ⇒ cero renames) |
| `df6364d` | Task 2 RED — 12 tests fallando |
| `5c8f1a4` | Task 2 GREEN — los 2 fixes |
| `2aba790` | Task 2/3 — bitácora `122-CRUCES-SQL-04-FIXES.md` + cierre en el fragmento 03 |

## Qué queda para 125

`S1338` seguirá mostrando `0 reuniones` y `/proyecto/[boletin]` seguirá sin declarar cobertura
**hasta que 125 despliegue** (LÍMITE A). Re-verificar en el DOM desplegado con el patrón tolerante a
los separadores `<!-- -->` de React: `/parlamentario/S1338` sin ningún dígito en la capa-1 de lobby,
`/parlamentario/D1165` **todavía** en `112 reuniones` (control de no-regresión), y la línea de
cobertura antes del conteo en `14309-04` / `16849-12`. Re-ejecutar `Q-L07`: si la cifra cambió,
actualizar **cifra y fecha juntas**.

## Self-Check: PASSED

- Los 2 artefactos existen (`122-CRUCES-SQL-04-FIXES.md`, `122-05-SUMMARY.md`) y los 3 archivos de
  `app/` modificados existen y compilan (`tsc --noEmit` exit 0)
- Los 4 commits existen en `git log` (`45cdac4`, `df6364d`, `5c8f1a4`, `2aba790`)
- **NO** existe `supabase/migrations/0073_*.sql` — la última numerada es `0072_notificacion_envio_idempotencia.sql`
- Identidad aritmética verificada contra las tablas de veredicto de los 3 fragmentos:
  `2 (tabla de fixes) + 0 (Fixes NO aplicados) == 2 (total discrepancia-corregida)`
- Recuentos de origen corroborados con la sección de cierre de cada fragmento:
  01 §7 (*"Para 122-05 — NADA"*, 0 de 32) · 02 §5 (`corregida 0` de 31) · 03 §Resumen (2 de 13)
- Suite 1572 verde · 11/11 guards de régimen verdes · mutation self-check de Wave-0 demostrado
  fallando con el spread removido y verde al restaurarlo
- Cero `.env*`, cero `.github/workflows/`, cero `PUBLIC_ENABLED` en el diff; cero apply a PROD

## Nota sobre CRUCE-01 (requirement del plan)

**Se deja `Pending` a propósito.** El plan declara `requirements: [CRUCE-01]`, pero el requisito
—*"cada cruce visible en el sitio cuadra contra SQL de PROD … discrepancias corregidas"*— abarca la
fase completa, y la **Phase 122 aún no termina**: falta `122-06` (consolidación de los 4 fragmentos
en `122-CRUCES-SQL.md`). Este plan aportó la mitad "discrepancias corregidas"; marcarlo completo
antes de la consolidación sería declarar verificado lo que no lo está. **Lo cierra `122-06`.**
