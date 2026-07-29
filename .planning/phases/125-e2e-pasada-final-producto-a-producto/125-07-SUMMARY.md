---
phase: 125
plan: "07"
subsystem: verificacion-e2e
tags: [e2e, consolidacion, cobertura-declarada, handoff, gate-de-cierre]
requires:
  - "125-01 (deploy 0ea5d97f + gate pre-deploy)"
  - "125-02 (fichas densas)"
  - "125-03 (rutas y chrome)"
  - "125-04 (los 5 gates)"
  - "125-05 (links y fechas post-deploy)"
  - "125-06 (DOM hidratado + gate humano)"
provides:
  - "125-E2E.md — artefacto unico y auditable de la pasada E2E (cobertura por lista, veredictos, hallazgos, gate de cierre, trazabilidad a los 5 SC)"
  - "125-HANDOFF-HUMANO.md — lo no cerrado, con destino nombrado y cero aprobados por silencio"
affects:
  - ".planning/STATE.md"
  - ".planning/ROADMAP.md"
  - ".planning/REQUIREMENTS.md"
tech-stack:
  added: []
  patterns:
    - "cobertura declarada por lista con DOS denominadores explicitos (19 filas de Tabla D / 60 emisores), jamas por adjetivo"
    - "vocabulario de veredicto extendido con motivo escrito antes que inflar la cobertura (RULE-1)"
    - "gate de flips con diff ACOTADO a codigo y config: el diff completo se auto-falsa con los propios artefactos"
    - "guards corridos por nombre explicito: el glob desde la raiz da 'No test files found' con exit 0 (falso verde)"
key-files:
  created:
    - ".planning/phases/125-e2e-pasada-final-producto-a-producto/125-E2E.md"
    - ".planning/phases/125-e2e-pasada-final-producto-a-producto/125-HANDOFF-HUMANO.md"
  modified: []
decisions:
  - "Quinto valor de veredicto de emisor ('no aislado — contenedor verificado en DOM') declarado por RULE-1 en vez de marcar 4 emisores anidados como verificados: la cobertura se declara 45/60, no 49/60"
  - "Los hits de los greps de credenciales y de marcadores TBD/FIXME se listan con su origen (son el texto del propio criterio en 125-07-PLAN.md) en vez de borrar el criterio"
  - "La corrida de suite con 3 fallos se registra como hallazgo H-09 sin nombrar que 3 tests fueron: el log no se preservo y adivinarlo seria inventar evidencia"
metrics:
  duration: "~50 min"
  completed: "2026-07-29"
  tasks: 3
  files_created: 2
  commits: 3
---

# Phase 125 Plan 07: Consolidación E2E y cierre Summary

Consolidación de los seis artefactos de la pasada en un solo documento auditable con cobertura
declarada por lista (19 filas de la Tabla D · 60 emisores), las 8 discrepancias de 122 confirmadas
como declaradas, 9 hallazgos con disposición, y el gate de cierre verde con números
(**1590/1590**, `tsc` exit 0, **14/14** guards = 172 tests, régimen probado por comando).

## Qué se hizo

**Task 1 — `125-E2E.md`.** §0 método (los dos instrumentos y 10 gotchas que gobiernan cada cifra);
§1 cobertura declarada con **dos** denominadores; §2 ~80 filas de veredicto por superficie con el
vocabulario de 3 valores de 122 + `hallazgo`; §3 las 8 `discrepancia-declarada` heredadas; §4 los 9
hallazgos con disposición y los 4 criterios insatisfacibles resueltos por RULE-1; §5 procedencia por
plan con conteo de filas; §7 cierre.

**Task 2 — `125-HANDOFF-HUMANO.md`.** Los 2 ítems post-deploy de 122 registrados **CERRADOS** con su
fragmento DOM; el gate de copy **CERRADO/APROBADO** con la respuesta verbatim del operador y su
alcance acotado explícitamente a COPY; la lectura fría de las 82 filas de 122 como **PENDIENTE — no
ejercido** (jamás "aprobado"); 3 hallazgos escalados; 9 deudas de operador re-nombradas con su origen.

**Task 3 — gate de cierre**, escrito en §6 de `125-E2E.md`.

## Estado final de los 5 criterios de éxito

| SC | estado | evidencia |
|----|:------:|-----------|
| **SC1** deploy agrupado probado por contenido | ✓ | `0ea5d97f…`; `Actualizado` **318→0**, `según fuente al ` **0→32**, `3,8` **0→2** |
| **SC2** cada superficie recorrida con fragmento y veredicto | ✓ con límites declarados | 19 filas / denominador recorrido **18** · 60 emisores · 23 capturas del DOM hidratado |
| **SC3** links re-verificados con mesura | ✓ | 0 links con 404 · 24/24 anclas · 7/7 ausencias · **2,89 s/request** · robots-primero por mtime |
| **SC4** régimen de fechas de 117 sostenido | ✓ | `Actualizado hace`/`corte al`/`captura` pelado = 0 en 20/20; L-1/L-2 cerrados hidratados; **F-08 no observable** con MONEY OFF, declarado |
| **SC5** los 5 gates, cero flips, lo no cerrado con destino | ✓ | MONEY/NOTIF OFF con 14+4 discriminantes y control positivo; 0 `secret put`; diff acotado vacío; handoff escrito |

## Verificación

| criterio | resultado |
|---|---|
| `grep -c "Cobertura declarada"` | **1** |
| filas de ruta en §1.1 | **19**; fila 15 con **4** celdas `n/a — EXCLUIDA` y cero evidencia de navegación a `/admin` |
| denominador recorrido declarado | **18** |
| `grep -c "^\| E-0"` | **60** |
| `grep -c "se recorrió todo"` | **0** (control positivo apareado: `recorrid` → 5) |
| filas de §3 | **8**, las 8 `SIGUEN DECLARADAS` |
| hallazgos con disposición | **9 / 9** |
| planes nombrados en §5 | **6** |
| handoff: 5 campos por ítem | ✓ (7 ítems narrativos con los 5 campos literales; los tabulares los llevan como columnas) |
| suite `app/` | **1590 / 1590**, exit 0, 107 archivos (idéntico al gate pre-deploy) |
| `tsc --noEmit` | exit **0** |
| guards | **14 / 14**, 172 tests (166 en `app/lib` + 6 en `packages/llm`) |
| régimen | 0 archivos de código · 0 migraciones nuevas · 0 flips (diff acotado vacío) · 0 credenciales |

## Deviations from Plan

### Auto-fixed / declared (RULE-1)

**1. [Rule 1 — criterio insatisfacible] Vocabulario de veredicto de emisor ampliado con un quinto valor**
- **Found during:** Task 1, al clasificar los 60 emisores.
- **Issue:** los 4 valores del plan no cubren al emisor **anidado** cuyo contenedor sí se verificó pero
  cuyo fragmento propio no se aisló (`E-026`, `E-030`, `E-034`, `E-057`). `verificado en DOM` habría
  inflado la cobertura de **45** a **49**; `no emite superficie visible` habría sido falso.
- **Fix:** quinto valor `no aislado — contenedor verificado en DOM`, declarado en §1.3 con motivo por
  fila y con la extensión registrada como desviación.
- **Commit:** `92144a2`

**2. [Rule 1 — falso verde de instrumento] Los 14 guards se corrieron por nombre explícito**
- **Found during:** Task 3.
- **Issue:** el comando del plan (`… vitest run lib/*guard*.test.ts lib/*gate*.test.ts` desde la raíz)
  imprime **`No test files found, exiting with code 0`**: bash no expande el glob y vitest sale **0 sin
  correr nada**. Un gate que confiara en ese exit habría declarado 14 guards verdes con **cero** tests.
- **Fix:** los 12 archivos se corrieron por nombre explícito desde `app/` (**166** tests) más los 2 de
  `packages/llm` (**6**). Documentado como gotcha **G-9** en §0.4 y en §6.2.
- **Commit:** `92144a2`

**3. [Rule 1 — hits de criterio auto-referentes] Greps de credenciales y de marcadores de deuda**
- **Issue:** `grep -rnE "postgres://|postgresql://"` da **2** hits y `grep -rnE "\b(TBD|FIXME|XXX)\b"`
  da **1**, y **los tres son el texto del propio criterio** escrito en `125-07-PLAN.md`.
- **Fix:** se **listan con su origen y se declaran como cita**; cero cadenas de conexión reales y cero
  marcadores de deuda propios. El criterio **no se borró ni se relajó** (§6.3).
- **Commit:** `92144a2`

**4. [Rule 1 — realidad manda] Suite: una corrida con 3 fallos, registrada sin adivinar cuáles**
- **Issue:** la primera de cuatro corridas dio **1587/1590** (3 archivos rojos) con 98,66 s de duración
  contra 62-67 s de las limpias. El log **no se preservó**.
- **Fix:** dos corridas posteriores con log preservado dan **1590/1590 exit 0**; se declara como
  hallazgo **H-09** atribuido a contención de entorno (`git diff` sobre `app/` es vacío) y **no se
  nombra qué 3 tests fueron**, porque adivinarlo sería inventar evidencia.
- **Commit:** `92144a2`

## Hallazgos que la fase deja ABIERTOS

| id | qué es | disposición |
|----|--------|-------------|
| **H-01** | error boundary transitorio en `/comparar`, visible **sólo hidratado**; HTML servido limpio en 5 variantes; re-test 3/3 limpio | escalado — un fix exige re-deploy |
| **H-03** (`4.9-A1`) | href `/red?seed=<vecinoId>` **NOT OBSERVED**: el click no expandió la tarjeta del vecino. **Ni PASS ni defecto**; fabricar el reveal vía `$RC` sigue prohibido | escalado a verificación manual / fase de DOM |
| **H-06** | `85` `Hito del` vs `99` eventos en `14309-04` — menos, nunca más; 117 gobierna rótulo y helper, no cardinalidad | escalado a fase que audite la selección del timeline |
| **H-02, H-04, H-05, H-07, H-08** | correcciones de catálogo 113 (`#cruces` de `S1338`; E-049/E-023 cliente-hidratados), fuente caída `www.senado.cl` **520**, `og:image` a `localhost`, copy genérico de C3/C4 | declarados con destino escrito |
| **F-08 de 117** | **no observable** con MONEY OFF: el bloque que lo renderizaría no se emite | **no se afirma verificado** |
| **P-1** | lectura fría de las 82 filas de 122 (opcional del gate) | **PENDIENTE — no ejercido**, jamás aprobado por silencio |

## Known Stubs

Ninguno. Esta fase no escribió código: sus dos artefactos son documentación de verificación.

## Notas para la fase siguiente

- **El cierre del milestone** (`audit-milestone` → `complete-milestone` → cleanup → tag → push) es
  **del orquestador**, después de esta fase. Este plan no lo tocó.
- **En waves paralelas sobre un mismo checkout, `git commit --amend` es inseguro** *(ver Self-Check abajo)* (el 125-05 reescribió
  sin querer el commit del 125-03) y los commits atómicos por plan **no** están garantizados: harían
  falta worktrees separados.

## Self-Check: PASSED

| claim | comando | resultado |
|---|---|---|
| `125-E2E.md` existe | `[ -f … ]` | **FOUND** |
| `125-HANDOFF-HUMANO.md` existe | `[ -f … ]` | **FOUND** |
| `125-07-SUMMARY.md` existe | `[ -f … ]` | **FOUND** |
| commit `92144a2` existe | `git cat-file -t 92144a2` | **FOUND** |
| commit `0ae52c6` existe | `git cat-file -t 0ae52c6` | **FOUND** |

Existencia de commits comprobada con `git cat-file -t`, **no** con `git log | grep -q`: bajo
`set -o pipefail` esa tubería sale **141** por SIGPIPE y fabrica un falso `MISSING` (gotcha G-5,
pagado por el 125-04 en su propio self-check).
