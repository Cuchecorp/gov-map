---
phase: 122-cruce-sql-cruces-visibles-sql-de-prod
verified: 2026-07-29T11:30:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
gaps: []
deferred:
  - truth: "SC2 — el denominador de VOTOS mostrado no es el honesto: el cap `p_limit: 1000` hace que `D1165` (3.752 votos reales, re-medidos por el verificador) se muestre como 1.000 en chip, `<h2>` y `Ver detalle`, y distorsiona además la composición (orden `fecha desc`)"
    addressed_in: "Phase 124 (SUPA-FIX)"
    evidence: "Phase 124 goal: 'Los defectos de estructura encontrados quedan corregidos en PROD sin nada destructivo' + SC1 'Cada fix viaja como migración aditiva numerada'. El fix requiere una RPC de conteo dedicada (SQL nuevo), fuera del régimen cero-apply de 122. Handoff nombrado explícitamente en 122-CRUCES-SQL.md §'Fixes NO aplicados' (filas 2.1/2.5/2.6). ADVERTENCIA: los Success Criteria de 124 en ROADMAP.md NO nombran esta RPC — conviene añadirla al planificar 124 para que no se pierda."
  - truth: "SC2 — el tile *Por materia* del panel agrupa 3.100 / 3.675 (84,4 %) sin declarar su cobertura parcial"
    addressed_in: "Phase 124 (denominador en la RPC) → copy en Phase 125"
    evidence: "Fila 4-14, `discrepancia-declarada`: los números cuadran; falta un denominador que el contrato actual de la RPC no emite ⇒ SQL, no copy."
human_verification:
  - test: "Lectura fría del artefacto `122-CRUCES-SQL.md` (2.700 líneas) por un humano sin abrir el código: ¿puede auditar las 82 filas sin ayuda?"
    expected: "Cada fila se entiende con su query, sus dos números y su veredicto; el vocabulario de 3 valores no confunde"
    why_human: "Auditabilidad por un lector es juicio humano, no verificable por grep"
  - test: "Juicio de copy sobre la línea de cobertura horneada `COBERTURA_MENCIONES_LOBBY` (app/components/lobby-menciones-de-boletin.tsx:135)"
    expected: "Describe el canal sin insinuar ocultamiento ni causalidad; el parcial nunca se lee como total; idiom 'según fuente al …' correcto"
    why_human: "El linter cubre términos; la lectura de conjunto es juicio editorial"
  - test: "Verificar sobre el DEPLOY REAL (Phase 125) que los 2 fixes llegan: `/parlamentario/S1338` sin dígito en capa-1 de lobby, `/parlamentario/D1165` sigue con `112 reuniones`, `/proyecto/14309-04` con la línea de cobertura antes del conteo"
    expected: "Los tres controles pasan sobre el deploy post-125"
    why_human: "LÍMITE A declarado: los fixes NO están en producción; el DOM actual es PRE-fix por diseño"
  - test: "Re-lectura del DOM del deploy para las 82 filas (los 'nº deploy' del artefacto)"
    expected: "Los números del DOM siguen siendo los registrados (72 cuadra = controles de no-regresión)"
    why_human: "El verificador re-corrió SQL contra PROD pero no re-leyó el DOM completo del Worker; el propio artefacto lo agenda para 125"
---

# Phase 122: CRUCE-SQL — Cruces visibles × SQL de PROD · Verification Report

**Phase Goal:** Ningún número de cruce mostrado en el sitio difiere de lo que dice la base: conteos, denominadores y cobertura declarada cuadran.
**Verified:** 2026-07-29
**Status:** human_needed
**Re-verification:** No — verificación inicial

## Goal Achievement

### Observable Truths (Success Criteria del ROADMAP)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Cada cruce visible (relaciones, `/comparar` + VSIM, cruces de ficha/proyecto, panel, lobby↔PL) recalculado con SQL verbatim contra PROD y comparado con el deploy | ✓ VERIFIED | `122-CRUCES-SQL.md` (2.700 líneas): 82 filas de veredicto con desglose por sección que **cierra aritméticamente** (§2=23, §3=11, §4=15, §5=16, §6=15, §7=2 → 82 = 72+2+8). Los 6 grupos del universo §0.3 tienen filas. **Cero referencias `Q-NN` colgantes**: 89 refs / 84 defs, y las 5 aparentes faltantes son cabeceras combinadas (`**\`Q-21\` / \`Q-22\`**`) o el mapa de renumeración `Q-L*` — comprobado una por una. Toda fila cita su bloque ```sql. |
| 2 | Todo denominador mostrado es el honesto y su cobertura queda declarada donde es parcial | ✓ VERIFIED (con 2 ítems deferidos a 124) | Denominador de lobby **re-verificado por el verificador contra PROD**, no aceptado del SUMMARY: `Q-66` → `no_confirmado\|12656\|0` y `confirmado\|5106\|5106` — idéntico a lo registrado; el acoplamiento `no confirmado ⇒ parlamentario_id null` se sostiene. Cobertura parcial declarada implementada en código (`COBERTURA_MENCIONES_LOBBY`, render en los 3 caminos de `LobbyMencionesView`). El denominador de votos (cap 1000) sigue deshonesto → **deferido a 124 con ambos números** (ver `deferred`). |
| 3 | Toda discrepancia queda corregida o declarada, con la query y ambos números registrados | ✓ VERIFIED | 2 `discrepancia-corregida` con **código real en HEAD y test que muerde** (ver abajo). 8 `discrepancia-declarada` con handoff nombrado en la tabla "Fixes NO aplicados": 2.1/2.5/2.6 → 124 · 3.3 → 124 · 3.b-9 → catálogo 113 · 4-14 → 124/125 · 4-15 → 124 · 5.5 → 125. Identidad de cobertura verificada: 2 filas de fixes + 0 no aplicados = 2 `corregida`. |
| 4 | Los vacíos siguen siendo vacíos honestos: cero se presenta como cero, jamás se rellena; el copy sin causalidad | ✓ VERIFIED | `lobby-capa1.tsx:51` gatea por el **discriminante** (`estado.tipo === "dato"`), NO por `n` ⇒ `{tipo:"dato", n:0}` **sigue imprimiendo `0 reuniones`**; test `lobby-capa1.test.tsx:89-94` lo ancla con `toMatch(/0\s*reuniones/)`. El fallback "Aún no hay materias publicadas en las fuentes consultadas" quedó gateado por `tipo === "dato"` (CR-01) ⇒ ningún estado no-`dato` afirma una ausencia en la fuente. `lobby_sector_aporte` = 0 filas confirmado honesto por construcción (`0052`: CTE `empresa_sector … where false`, leída en el repo). |

**Score:** 4/4 truths verificadas.

### Verificación independiente contra PROD (no se aceptó ningún número del SUMMARY)

| query | registrado en el artefacto | re-ejecutado por el verificador | ¿coincide? |
|-------|---------------------------|---------------------------------|:---------:|
| `Q-66` (estado_vinculo × parlamentario_id) | `no_confirmado\|12656\|0` · `confirmado\|5106\|5106` | idéntico | ✓ |
| `Q-74` (cobertura lobby↔PL, query completa re-tipeada) | `5106\|195\|82\|3.82` | `5106\|195\|82\|3.82` | ✓ |
| votos de `D1165` sin cap (fila 2.1 declarada) | `3.752` reales vs `1.000` mostrados | `3752` | ✓ (la discrepancia declarada es REAL) |
| lobby confirmado de `S1338` (fila 5.11) | `0` | `0` | ✓ |

**Todo `SELECT`, cero DDL/DML.** La cifra horneada `3,8 %` del copy es **reproducible hoy**.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `122-CRUCES-SQL.md` | Artefacto único auditable, 82 filas | ✓ VERIFIED | 2.700 líneas, `estado: validado`, front-matter coherente con el cuerpo (82 / 72-2-8), índice, método, límites L-1…L-11, procedencia |
| 5 fragmentos + `122-REVIEW.md` | Evidencia de la corrida | ✓ VERIFIED | Los 5 fragmentos presentes; REVIEW con 1 Critical + 3 Warning, **cerrados por commits reales** `8087d67` (CR-01), `905092e`/`de8f3c3`/`ccfdcab` (W-01/02/03) |
| `app/components/capa1/lobby-capa1.tsx` | Fix 5.11 | ✓ VERIFIED | Recibe `CarrilEstado` completo; call-site `page.tsx:622-625` pasa `estado={conteos.lobby}` (rename `total`→`estado` ⇒ un colapso futuro no compila) |
| `app/components/lobby-menciones-de-boletin.tsx` | Fix 5.12 | ✓ VERIFIED | `COBERTURA_MENCIONES_LOBBY` (:135) renderizada (:234) dentro del nodo `cobertura` presente en **ambos** returns (empty y con filas); el caso truncado es rama interna posterior ⇒ los 3 caminos cubiertos |
| `app/lib/anti-insinuacion-guard.test.ts` | Wave-0 del linter ANTES del copy | ✓ VERIFIED | `TERMINOS_COBERTURA` (:583) entra a la denylist por spread (:734); commit `45cdac4` **anterior** a `5c8f1a4` (orden Wave-0 respetado) |

### Behavioral Spot-Checks (ejecutados por el verificador)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Type-check limpio | `pnpm exec tsc --noEmit` (app) | exit 0 | ✓ PASS |
| Suite completa | `pnpm vitest run` (app) | **1577 passed / 107 files** (coincide con lo reportado) | ✓ PASS |
| **Mutación fix 5.11** — ¿el test muerde? | gate `estado.tipo === "dato"` → `true`, correr `lobby-capa1.test.tsx` | **3 failed / 10 passed**; restaurado → verde | ✓ PASS |
| **Mutación fix 5.12** — ¿el test muerde? | borrar la línea 234 (`{COBERTURA_MENCIONES_LOBBY}`), correr su test | **3 failed / 16 passed**; restaurado → verde | ✓ PASS |
| Higiene: última migración | `ls supabase/migrations \| tail` | `0072_notificacion_envio_idempotencia.sql` — **cero migraciones nuevas** | ✓ PASS |
| Higiene: flags / env | `git diff 45cdac4~1..HEAD --name-only \| grep -iE "\.env\|wrangler\|gate\|flag"` | **vacío** — cero flags tocados | ✓ PASS |
| Higiene: alcance de código | `git diff --stat` de los commits de la fase sobre `app/` y `supabase/` | 6 archivos (3 fuente + 3 test), 0 en `supabase/` | ✓ PASS |
| Higiene: credenciales | grep `postgres://` / `postgresql://` / ref de proyecto en el directorio de la fase | solo como **texto de acceptance criteria** en los PLAN; **cero cadenas de conexión reales**, `SUPABASE_DB_URL` nunca expandida | ✓ PASS |
| Anti-patrones: marcadores de deuda | `grep -nE "TBD\|FIXME\|XXX"` sobre los 6 archivos tocados | **cero** | ✓ PASS |
| Árbol de trabajo | `git status --porcelain` | solo los 2 archivos pre-existentes de otra fase (119-REVIEW, pnpm-workspace) — las mutaciones fueron revertidas | ✓ PASS |

### Cobertura × inventario 113

Barrido de los **60** emisores `E-001…E-060` presente y completo (62 líneas de tabla = 60 emisores + cabecera/separador). **Ningún `no` sin motivo escrito**: 34 "no emite cruce" con razón concreta, 8 gated OFF (MONEY/NOTIF, LÍMITE B con evidencia de gate en §1.2), 3 huérfanos (con el grep de ausencia de call-site, L-3). 15 emisores emiten cruce y los 15 están auditados; 6 huecos detectados por el propio barrido se cerraron como filas `H-1…H-6`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/components/capa1/lobby-capa1.tsx` | 77-79 | Las barras por materia imprimen `{m.n}` sin mirar `estado` (IN-02 del REVIEW) | ℹ️ Info | Hoy inalcanzable (si hay materias, el estado es `dato`). Puerta trasera teórica a la fila 5.11 si un productor futuro derivara `lobbyTopMaterias` de otra fuente |
| `app/lib/parlamentario-resumen-conteos.ts` | 235-237 | `derivarEstado` nunca emite `dato` con `n=0` (IN-01) | ℹ️ Info | El "cero honesto" que el test protege es defensivo; el cero real lo declara `conteoLabel` como `sin registros`. No contradice SC4 — el código imprime el cero si el estado llega |
| `app/lib/anti-insinuacion-guard.test.ts` | 582-589 | `TERMINOS_COBERTURA` añade 2 frases genéricas del español a la denylist **global** (IN-03) | ⚠️ Warning | Sin hit hoy; puede generar fricción en una fase futura ajena a lobby. No bloquea |

### Gaps Summary

**Cero gaps bloqueantes.** El artefacto no es prosa autocomplaciente: sus números se reprodujeron
contra PROD por el verificador (4 de 4 spot-checks idénticos, incluida la query completa de cobertura
y la discrepancia de votos), sus 2 fixes existen en HEAD con tests que **demostradamente muerden**
bajo mutación, y su higiene (cero migraciones, cero flags, cero credenciales, cero marcadores de
deuda) se comprobó por comando, no por afirmación.

Lo que queda abierto no es un fallo de la fase sino su frontera declarada: (a) el denominador de
votos sigue capado a 1.000 y su fix exige SQL nuevo → **Phase 124** (con la advertencia de que los
Success Criteria de 124 en el ROADMAP **no nombran** esa RPC de conteo; conviene añadirla al
planificarla, o se pierde); (b) los 2 fixes de UI **no están en producción** (LÍMITE A) — el DOM
actual sigue mostrando `0 reuniones` en `/parlamentario/S1338` hasta que **Phase 125** despliegue.

Se declaran 4 ítems de verificación humana (lectura fría, juicio de copy y las dos re-lecturas de
DOM que sólo tienen sentido post-deploy), por lo que el estado es `human_needed` y no `passed`.

---

_Verified: 2026-07-29_
_Verifier: Claude (gsd-verifier)_
