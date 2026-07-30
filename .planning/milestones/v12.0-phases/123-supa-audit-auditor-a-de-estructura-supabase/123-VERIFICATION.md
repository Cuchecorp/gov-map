---
phase: 123-supa-audit-auditor-a-de-estructura-supabase
verified: 2026-07-29T16:20:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
human_verification:
  - test: "Probe REST con la anon key (read-only) contra /rest/v1/rpc/pg_version, /rest/v1/rpc/runtests y /rest/v1/rpc/col_is_null"
    expected: "401/404 ⇒ OFF-6-01 queda en 'divulgación de estructura'. 200 ⇒ OFF-6-01 escala a BLOQUEANTE de Gate 2"
    why_human: "SUPABASE_ANON_KEY no está en .env (higiene deliberada); sale del dashboard. Exigencia nº2 del gate. Verificado por mí: no es acto de agente"
  - test: "Correr los Database Advisors (Splinter) contra el remoto y reconciliar con el mapeo de la fase"
    expected: "DEBT.md abierto con la deuda no-bloqueante: 0001, 0003, 0005, 0009, 0020 + B-01"
    why_human: "Los Advisors no son invocables por SQL desde sesión psql (§0.6 B). Exigencia nº5 del gate"
  - test: "Decisión sobre pgtap en PROD (alter extension … set schema extensions | drop extension) y destino de las suites pgTAP"
    expected: "Decisión de operador registrada antes de que 124 toque pgtap"
    why_human: "Operación destructiva; ruteada a supabase-architect + checkpoint por diseño de la fase"
  - test: "Creación de bucket de Storage, si alguna vez se decide usarlo"
    expected: "Solo después de cerrar OFF-6-04 (default ACL postgres en storage)"
    why_human: "DDL/DML sobre storage = deuda-operador por vocabulario, jamás acto de agente"
---

# Phase 123: SUPA-AUDIT — Verification Report

**Phase Goal:** La superficie de datos queda auditada como boundary de seguridad real — cada tabla, política, grant y RPC pública revisada contra la DB viva.
**Verified:** 2026-07-29
**Status:** human_needed
**Re-verification:** No — initial verification

## Método de esta verificación

No acepté ninguna afirmación de los SUMMARY. Re-corrí contra PROD (read-only) las
aserciones muestreadas, corrí la suite y `tsc` yo mismo, e hice **mi propia mutación en
disco** para comprobar que los bloques nuevos muerden.

## Goal Achievement

### Observable Truths

| # | Truth (criterio de éxito) | Status | Evidence (mía, no del SUMMARY) |
|---|---|---|---|
| 1 | El veredicto del `supabase-reviewer` es el gate, persistido verbatim y atribuido | ✓ VERIFIED | `123-SUPA-REVIEWER-VEREDICTO.md` con frontmatter `subagente: supabase-reviewer`, `procedencia: transcrita VERBATIM`, delimitadores `INICIO/FIN DEL VEREDICTO VERBATIM`. Cubre los 6 ejes exigidos (schema, RLS, grants, RPCs bounded, allowlist, secdef/`search_path`). **No decorado**: el gate produjo 5 exigencias, una de ellas (`PII_TABLES`) obligó a trabajo real en la fase (commit `d33d424`) |
| 2 | La auditoría corre contra la DB viva, no contra las migraciones | ✓ VERIFIED | Re-corrí 4 aserciones contra PROD y **todas reproducen exacto** (tabla abajo) |
| 3 | Cada offender con riesgo y fix; "0 offenders" demostrado con la consulta | ✓ VERIFIED | 13 offenders, identidad aritmética cuadra. Sección `## 0 offenders demostrado` (:880). `aclexplode` 7 menciones vs `role_table_grants` 4 (declarada contraste, no prueba). Distinción cero-fuerte/cero-vacuo presente |
| 4 | Guards verdes y EXTENDIDOS donde hubo punto ciego | ✓ VERIFIED | 35/35 verde; **mi propia mutación produjo 5 rojos**, restauración → 35/35 y `git diff --quiet -- supabase app` = 0 |

**Score:** 4/4 truths verified

### Criterio 2 — Re-corrida independiente contra PROD (read-only)

| Aserción de la fase | Mi resultado | ¿Reproduce? |
|---|---|---|
| 3 filas de `pg_default_acl` de `supabase_admin` sobre `public` con `anon=` (OFF-01) | Exactamente 3 (`S`, `r`, `f`) — y además 3 de `postgres` sobre `storage` (OFF-6-04) | ✓ EXACTO |
| 1.079 funciones `pgtap` exec-`anon` en `public` (OFF-6-01) | `1079` | ✓ EXACTO |
| ~33 realmente alcanzables por REST (corrección del reviewer) | `33` | ✓ EXACTO |
| Exposición **por ejecución**, no por ACL: `set role anon; select public.pg_version()` | `17.6` | ✓ EXACTO |
| RLS 57/57 | `tablas_public\|57\|57` | ✓ EXACTO |
| Cero policies `to anon` | `0` | ✓ EXACTO |
| Cero grants de tabla a `anon` (vía `aclexplode`) | `0` | ✓ EXACTO |
| 0/28 secdef sin `search_path` (cero **fuerte**, denominador explícito) | `secdef_public\|28\|0` | ✓ EXACTO |
| `net.http_get`/`net.http_post` exec-`anon` (OFF-6-03) | Confirmado, y **12** funciones de `net` en total exec-`anon` | ✓ EXACTO (y peor de lo enunciado) |
| Corpus PII congelado (A7) = catálogo vivo | Las **8 filas** exactas, mismo orden | ✓ EXACTO |

Cero discrepancias en 10 aserciones muestreadas. La auditoría es reproducible.

### Criterio 3 — Identidad de los 13 offenders

Verificado contra el deliverable: `OFF-01, 02, 4-01..4-05, 5-01, 6-01..6-05` = **13**.
Clasificación cuadra: **8** `124-aditivo` (01, 4-01, 4-02, 4-03, 4-04, 5-01, 6-03, 6-04) +
**2** `architect+checkpoint` (6-01, 6-02) + **3** `guard` (02, 4-05, 6-05, los tres cerrados
por A4/A5/A6). 8+2+3 = 13. ✓

### Criterio 4 — Mi propia prueba de mordida (no la reportada)

Inyecté `supabase/migrations/0099_zz_verifier_probe.sql` con tres vectores
(`alter default privileges … grant … to anon`, `create extension pgtap … schema public`,
`create function public.zz_probe()` sin su revoke):

| Bloque | Resultado bajo mutación |
|---|---|
| (A) grant a anon | ✗ ROJO ×2 |
| (A4) alter default privileges | ✗ ROJO — el punto ciego OFF-02 **muerde** |
| (A5) revoke from public / baseline | ✗ ROJO — OFF-4-05 **muerde** |
| (A6) extensión en public | ✗ ROJO — OFF-6-05c **muerde** |
| **Total** | **5 failed / 30 passed** |

Tras `rm` del probe: **35 passed**, `git diff --quiet -- supabase app` exit **0**.
La mordida es real, no reportada.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Guard lockdown | `pnpm vitest run lib/lockdown-guard.test.ts` | 35 passed (era 22) | ✓ PASS |
| Suite `app/` completa | `pnpm vitest run` | 107 files, **1590** passed | ✓ PASS |
| Typecheck | `pnpm exec tsc --noEmit` | exit **0** | ✓ PASS |
| Cero migración escrita | `ls supabase/migrations/0073*` | No such file | ✓ PASS |
| Cero DDL/DML/deploy/flags | `git diff --name-only 9fca783^..a867e19 -- supabase/` | vacío; único archivo de código tocado = `app/lib/lockdown-guard.test.ts` | ✓ PASS |

### Higiene

| Control | Resultado |
|---|---|
| Credenciales en artefactos | ✓ Cero. Las únicas apariciones de `postgres://` son los **patrones de prohibición** dentro de los `<verify>` de los PLAN |
| JWT / `sb_secret` / `sb_publishable_` / `AKIA` | ✓ Cero en los 12 artefactos |
| PII (valores) | ✓ Cero — solo nombres de relación y columna |
| `.supabase-ops.yaml` | ✓ Cabecera "ESTE ARCHIVO ESTÁ VERSIONADO EN GIT: PROHIBIDO todo valor de credencial"; solo nombres de variable |
| Sustitución editorial del verbatim | ✓ **Única y declarada**: prefijo JWT literal → `<prefijo-JWT>`, marcada `[›]` en el punto exacto, con la razón escrita (mordía el propio grep anti-secreto). No detecté ninguna otra alteración |

### Honestidad del alcance

- Los **7 huecos** están escritos **sin suavizar**, incluido el nº1 calificado por el propio
  reviewer como *"hallazgo bloqueante para 124"* y *"el modo de fallo que la fase declara como
  el más crítico, en el único eje donde no miró"*.
- **Fidelidad de transcripción probada por una incoherencia preservada:** el cuerpo verbatim
  dice *"3 precondiciones y 4 huecos"* y acto seguido enumera **7**. Un transcriptor que
  hubiera "arreglado" el texto habría corregido eso. No lo hizo. Esto es evidencia positiva de
  transcripción no editada.
- Los actos de operador (**OP-1** probe REST, **OP-2** Advisors, **OP-3** bucket, **OP-4**
  destino de `pgtap`) están marcados como **checkpoint**, con la tabla titulada literalmente
  *"Checkpoints de operador (NO son tarea de agente)"*. **No** se presentan como hechos.
- Las 5 exigencias del gate están rastreadas con estado honesto: 1 ✅ CUMPLIDA (la única que
  era acto de agente), 2 ⏸️ PENDIENTE de operador, 2 📌 ANCLADAS como entrada a 124.
- La quinta candidata de PII (`declaracion_bien_inmueble.es_su_domicilio`) fue **excluida con
  razón escrita en el propio guard**, no omitida en silencio. Verifiqué contra el catálogo
  vivo: efectivamente **no** matchea la clase, no aparece en las 8 filas.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | Cero `TODO`/`FIXME`/`XXX`/`TBD` sin referencia en los archivos tocados | — | ninguno |

Los `LIM-05-01..04` y `LIM-6-01/02` **no** son marcadores de deuda encubierta: son
`limite-declarado` con su razón, y el reviewer los auditó explícitamente como *"honestos, no
huecos disfrazados"*.

## Observación (no gap)

`(A7)` protege contra un `.from()` de tabla PII, pero su corpus es un **snapshot congelado**
del catálogo. Hoy coincide byte a byte con la DB viva (verificado por mí), pero **no se
re-consulta en CI**: una columna PII nueva en PROD no pondría el guard rojo por sí sola. La
limitación está escrita en el propio archivo (*"Si alguna vez se añade una columna con la
dirección literal, entrará por el corpus congelado"*) — es decir, **declarada, no oculta**, y
el mismo patrón de baseline congelada que (A5). Lo dejo como nota para 124, no como gap: el
criterio 4 pedía extender el guard donde hubo punto ciego, y eso se cumplió.

## Gaps Summary

**Ninguno.** Los cuatro criterios de éxito están verificados con evidencia que yo mismo
reproduje contra PROD y contra el árbol de trabajo. La fase respetó su frontera (cero
corrección, cero migración, cero flag), y la única excepción autorizada —extender un guard
ante un punto ciego— es exactamente lo que hizo, con mordida demostrada.

El `status: human_needed` **no** refleja una deficiencia: refleja que 4 actos que cierran las
reservas del gate son estructuralmente de operador (la anon key no está en `.env` por
higiene deliberada; los Advisors no son invocables por SQL; `drop extension` es destructivo).

---

_Verified: 2026-07-29_
_Verifier: Claude (gsd-verifier)_
