---
phase: 122
plan: 04
subsystem: auditoria-cruces
tags: [lobby, cruces, sql, prod, cobertura, vacios-honestos]
requires: ["122-CRUCES-SQL-00-METODO.md", "122-CONTEXT.md", "113-INVENTARIO.md"]
provides: ["122-CRUCES-SQL-03-LOBBY.md"]
affects: ["122-05", "122-06", "125"]
key-files:
  created:
    - .planning/phases/122-cruce-sql-cruces-visibles-sql-de-prod/122-CRUCES-SQL-03-LOBBY.md
  modified: []
decisions:
  - "La cobertura declarada ~3,8 % SIGUE VIGENTE: 195/5.106 = 3,82 % sobre 82 boletines, observado 2026-07-29 — idéntica a 92-04"
  - "El literal de cobertura lobby<->PL NO existe en app/: cobertura parcial no declarada (5.12, discrepancia-corregida)"
  - "page.tsx:617 colapsa no_ingerido/vacio al literal 0 => S1338 muestra '0 reuniones' bajo un encabezado que dice '—' (5.11, discrepancia-corregida)"
  - "El denominador honesto de lobby es estructural, no por filtro: las 12.656 audiencias no_confirmado tienen parlamentario_id NULL en el 100 %"
  - "lobby_sector_aporte = 0 filas queda blindado por escrito como resultado CORRECTO por construcción, NO bug"
metrics:
  tasks: 2
  commits: 1
  files_created: 1
  queries_prod: 12
  completed: 2026-07-29
---

# Phase 122 Plan 04: lobby ↔ PL + vacíos honestos — Summary

Grupos 5 y 6 recalculados por SQL verbatim contra PROD y contrastados con el DOM del deploy:
la cobertura parcial de lobby↔PL resultó **inalterada** (3,82 %) pero **no declarada en ninguna
superficie**, y el cero de `lobby_sector_aporte` quedó blindado por escrito como stub estructural.

## Qué se hizo

**Task 1 — lobby↔PL por superficie.** Se creó `122-CRUCES-SQL-03-LOBBY.md` con §0 (universo del
denominador), §1 (menciones por boletín, doble lectura RPC + primeros principios sobre 2 sujetos),
§2 (ficha del parlamentario con denominador honesto CON y SIN filtro) y §3 (cobertura recalculada
con la query verbatim de 92-04 + búsqueda del literal en el código).

**Task 2 — vacíos honestos.** §4 con la regla LOCKED cero-como-cero transcrita al inicio y **6
filas**, cada una con su query verbatim y su columna "¿es bug?" resuelta. §5 cierra con 7 límites.

## Evidencia clave

**12 queries a PROD** (todas `select`, `psql -tA`, ancla `2026-07-29|UTC`).

**§1 — menciones por boletín (doble lectura, sin divergencia):**

| boletín | RPC `lobby_menciones_de_boletin` | primeros principios | DOM | veredicto |
|---------|---------------------------------:|--------------------:|----:|-----------|
| `14309-04` (sujeto de 113 §1.3) | 1 | 1 | 1 | `cuadra` |
| `16849-12` (mayor `total_n` de PROD) | 13 | 13 | 13 | `cuadra` |

El ranking de selección reproduce **exactamente** el top de 92-04 (`16849-12` 13, `16374-07` 12,
`17064-08` 9, `15975-25` 9, `17337-07` 8, `14985-34` 8). Sin deriva.

**§2 — denominador honesto (el foco del plan):**

| sujeto | CON `estado_vinculo='confirmado'` | SIN el filtro | DOM | marcador |
|--------|----------------------------------:|--------------:|----:|:--------:|
| `D1165` | **112** | **112** | **112** | presente |
| `S1338` | **0** | **0** | `—` / `0 reuniones` | **ausente** |

Ambos conteos coinciden porque las **12.656** audiencias `no_confirmado` tienen `parlamentario_id`
**NULL** en el 100 % (`5.106` confirmadas, todas con `parlamentario_id`). El denominador es honesto
*por imposibilidad de lo contrario*, no por un filtro que alguien recordó escribir. Se registró como
**invariante de datos observada, no constraint declarada** — con advertencia explícita para 125.

**§3 — cobertura declarada, recalculada con la query verbatim de 92-04:**

| magnitud | 92-04 (v9.0) | **observado 2026-07-29** | ¿cambió? |
|----------|-------------:|-------------------------:|:--------:|
| denominador (confirmadas con `parlamentario_id` y `materia`) | 5.106 | **5.106** | no |
| numerador (≥1 mención válida) | 195 | **195** | no |
| cobertura | ~3,8 % | **3,82 %** | **no** |
| boletines distintos | 82 | **82** | no |

**§4 — vacíos honestos, 6 filas con query:** `lobby_sector_aporte` (0), `nVotos` de sectores (0,
`tipo_senal` toma **un solo** valor en PROD: `lobby_sector`, 781 filas), `S1338` sin lobby (0),
`S1338` sin cruces (0), empty-states de E-002 inalcanzables, rama truncada sin caso real.

## Hallazgos — filas `discrepancia-corregida` para 122-05

**5.12 — Cobertura parcial NO declarada en la superficie.**
`grep -rn "cobertura" app --include=*.tsx | grep -v "\.test\."` + 3 variantes de refuerzo → **cero**
coincidencias relativas a lobby↔PL. Las que existen pertenecen a `/agenda`, `/buscar`, `/comparar`,
`/metodologia` y `/sobre`. Las cifras (`3,8 %`, `5.106`, `195`) no aparecen en `app/` fuera de tests.
La superficie declara el **criterio** (leyenda `:87` y empty `:95` de `lobby-menciones-de-boletin.tsx`,
ambos honestos y verificados en el DOM) pero **nunca cuantifica** la parcialidad.
**Fix propuesto:** línea de cobertura declarada en `LobbyMencionesView`, tras la leyenda `:182-186`
y **antes** del conteo `:216-228`, presente en los tres caminos de la vista; cifra `3,82 %` **con su
fecha** `2026-07-29`, idiom "según fuente al …" ("captura" pelado prohibido), y export a
`NEGACIONES_LOCKED` si introduce vocabulario negado (lección BLOCKER 91, anotada en `:83-86`).
**Decisión pendiente para 122-05:** hornear el literal fechado vs derivarlo en runtime (esto último
exigiría una RPC pública nueva = aguja completa). El fragmento **recomienda hornear**.

**5.11 — `no_ingerido` presentado como el hecho `0 reuniones`.**
`page.tsx:617` pasa `total={conteos.lobby.tipo === "dato" ? conteos.lobby.n : 0}`, colapsando
`vacio` y `no_ingerido` al literal `0`, que `capa1/lobby-capa1.tsx:32-33` imprime como
`0 reuniones`. En `/parlamentario/S1338` la **misma sección** declara `—` en su encabezado
(honesto) y `0 reuniones` tres líneas más abajo (afirmación de hecho). Contradice la regla LOCKED
del propio E-002 (`lobby-de-parlamentario.tsx:47`): *"'no ingestado' ≠ 'ingestado, cero'"*.
**Fix propuesto:** pasar el `CarrilEstado` completo a `LobbyCapa1` y omitir la línea de conteo
cuando el estado no es `dato` — espejo de `cruces-capa1.tsx:28` (`{sector.nVotos > 0 && …}`), que ya
resuelve el mismo problema por omisión honesta. Es un **fix de tipo, no de copy**. Alcance:
`page.tsx:617` + `capa1/lobby-capa1.tsx:31-34`. Cero SQL, cero migración.

## Hallazgo `discrepancia-declarada`

**5.5 — La rama `mostradas < total_n` (`LIMIT 50`) no es observable.** `max(total_n) = 13` sobre los
82 boletines con menciones: el techo real está a 37 audiencias del `LIMIT`. Se declara en vez de
afirmar `cuadra` sobre una rama que el deploy nunca ejecuta (regla dura anti-"todo bien" de 00 §0.1).
Por inspección estática `:214` **sí** lee `total_n` y no `mostradas` — pero eso es lectura de código,
no observación del DOM, y el fragmento no las confunde.

## Desviaciones del plan (RULE-1 — mandó la realidad)

**1. [RULE-1] El denominador honesto no se puede violar en la ficha, y la razón no es la que el plan
supuso.** El plan pedía correr el conteo SIN `estado_vinculo='confirmado'` porque *"si el número
mostrado corresponde al conteo sin filtrar, es `discrepancia-corregida`"*. Se corrió (`Q-L05`) y
ambos conteos dan **112** para `D1165`. La razón, descubierta con `Q-L00`, es estructural: las 12.656
filas `no_confirmado` tienen `parlamentario_id` NULL, así que el `where parlamentario_id = p.id` ya
las excluye. **Se registraron ambos números igual** (el plan lo exige) y se añadió `Q-L00` como §0
para que la coincidencia sea explicable y no parezca que el filtro sobra. Se añadió además una
advertencia: es una **invariante de datos observada, no una constraint declarada**.

**2. [RULE-1] El `boletín con mayor total_n` no se puede obtener con una query de selección directa.**
El plan pedía *"el boletín con MAYOR `total_n` de menciones en PROD hoy (query de selección con
desempate estable por `boletin asc`)"* como si fuera una agregación simple. `total_n` sólo existe
**dentro** de la RPC, y evaluarla sobre los ~40k boletines de `proyecto` era inviable. **Después:**
prefiltro de candidatos por extracción de regex (superset), join a `proyecto` → **82** boletines, y
`total_n` **exacto de la propia RPC** por candidato vía `left join lateral`, con el `order by
coalesce(t.n,0) desc, b.boletin asc` que el plan pide. El ranking no se estima: se mide. Validación
cruzada: reproduce **exactamente** el top de 92-04.

**3. [RULE-1] `bolet[ií]n` no sobrevive al shell — sustituido por el superset `bolet.n`, declarado.**
La `í` acentuada produce `ERROR: invalid byte sequence for encoding "UTF8"` al pasar por el shell de
este entorno. Todas las queries escriben `bolet.n` (el `.` casa cualquier carácter ⇒ **superset**
estricto de `[ií]`, sólo puede sobre-contar). Se contrastó §1.2 con la variante ASCII estricta
`bolet[ii]n`: **mismo resultado** en ambos sujetos. Declarado en §1.1 del fragmento y en §5 límite 5.
Se dejó constancia en vez de silenciarlo porque una regex alterada sin declarar invalidaría toda la
sección.

**4. [RULE-1] La rama truncada no se pudo verificar contra el DOM — se declaró en vez de fabricarse.**
El plan pedía *"verificar que cuando `mostradas < total_n` el sitio muestra el `total_n`… si muestra
`mostradas`, es `discrepancia-corregida`"*. Ningún boletín de PROD alcanza el `LIMIT 50` (`Q-L04`:
max 13 sobre 82). Tomado al pie de la letra, el plan habría forzado un veredicto sin evidencia.
**Después:** fila **5.5** con veredicto `discrepancia-declarada` + `Q-L04` como prueba, aplicando el
LÍMITE C de 00 §0.5.

**5. [RULE-1] `LobbySection` (E-002) NO se renderiza para `S1338`, y el plan asumía que sí.** El plan
pedía *"registrar qué estado 3-valores emite el sitio (`vacio` vs `no_ingerido`)"* asumiendo que se
leería del empty-state de E-002. Los tres literales LOCKED de E-002 dan `grep -c` = **0** en el DOM
de `S1338`: `page.tsx:619` monta el componente sólo si `tipo === "dato"`. **Después:** el estado se
leyó del **rótulo del carril** (`conteoLabel`, `page.tsx:89-100`), que emite `—` para `no_ingerido` y
`sin registros` para `vacio`. Observado `—`, correspondiente al marcador ausente ⇒ correcto. Se usó
como contraste de control el carril `cruces` de la **misma página**, que emite `sin registros` — el
3-estado sí discrimina. Los empty-states inalcanzables se registraron en §4 (no son bug: son código
defensivo). Este desvío fue lo que destapó el hallazgo **5.11**.

**6. [Desviación de proceso, no de contenido] Un solo commit para las 2 tareas.** Ambas escriben el
**mismo** archivo y el plan lo declara así en su `files_modified`. Un commit por tarea habría dejado
un commit intermedio con un fragmento sin §4/§5. Commit único `8dac59d`, con Task 1 y Task 2
enumeradas en el mensaje. Mismo criterio que 122-01.

## Cumplimiento del régimen

| restricción | cumplimiento |
|-------------|--------------|
| psql read-only | 12 queries, **todas `select`**. Cero DDL/DML, cero `supabase db push` |
| `SUPABASE_DB_URL` | nunca ecoado/expandido/escrito; aparece sólo como **nombre** de variable. **Cero cadenas de conexión** (ambos esquemas de URI de Postgres verificados por grep → 0) en el artefacto |
| conteos por `-tA`, nunca REST | cumplido (el cap de 1.000 de PostgREST no tocó ningún número) |
| cero PII | verificado por grep: `contraparte_id` aparece **1 vez, en la frase que lo prohíbe**; `rut`/`rut_proveedor` aparecen sólo como **nombres de columna** dentro de la explicación causal de 0052. Cero valores, cero nombres de contrapartes, cero materias verbatim |
| cero fuentes gubernamentales | ningún request a leylobby/camara/senado/BCN. Sólo `curl` al Worker propio (4 páginas) |
| cero deploy, cero flags, cero fixes | ningún archivo de `app/` o `supabase/` tocado |
| ámbito del commit | `git status --short` → sólo el artefacto quedó staged; los 2 archivos pre-existentes modificados (`119-REVIEW.md`, `pnpm-workspace.yaml`) **no** se tocaron |
| no invadir a los otros executors | no se leyó ni escribió `…-01-…` ni `…-02-…` |

## Self-Check: PASSED

- `122-CRUCES-SQL-03-LOBBY.md` existe; §1–§5 presentes por `grep -q`
- Gate Task 1: `grep -q "## 3. Cobertura declarada"` OK; `grep -c "estado_vinculo"` → **19**
- Gate Task 2: `## 4. Vacíos honestos` + `lobby_sector_aporte` + `## 5. Límites de este fragmento` OK
- §1 tiene 2 boletines con nº RPC, nº de primeros principios, nº del DOM y veredicto
- §2 tiene `D1165` y `S1338`; para `D1165` los conteos CON y SIN `estado_vinculo='confirmado'`
- §3 tiene la cifra 92-04, la observada hoy con su fecha, y la constatación de que el literal **no
  existe** en el código (con los greps que lo demuestran)
- §4 tiene 6 filas ≥ 3 exigidas, cada una con query y "¿es bug?" resuelta; abre con la regla LOCKED
  transcrita; la fila de `lobby_sector_aporte` dice **explícitamente** que NO es bug y explica la
  causa (CTE `empresa_sector where false` ⇒ arista `<rut de la empresa → sector>` ausente)
- Cero `postgres://`; cero PII de valor; `git diff --stat` del commit = **1 archivo**
- Commit `8dac59d` existe
