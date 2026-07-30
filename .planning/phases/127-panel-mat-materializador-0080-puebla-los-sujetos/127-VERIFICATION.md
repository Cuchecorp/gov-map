---
phase: 127-panel-mat-materializador-0080-puebla-los-sujetos
verified: 2026-07-30T13:40:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: "Verificación inicial. El REVIEW previo (13 findings, 12 FIXED vía 0081 APLICADA) fue re-corrido de forma independiente por el verificador contra PROD, no aceptado por narrativa."
---

# Phase 127: PANEL-MAT — Materializador 0080 puebla los sujetos — Verification Report

**Phase Goal:** La DB tiene los sujetos del hecho — cada señal positiva de `actualidad_senal` lleva en `evidencia` los boletines, títulos, fechas y enlaces que la UI va a nombrar (Opción A adjudicada).
**Verified:** 2026-07-30
**Status:** passed
**Re-verification:** No — verificación inicial (con re-corrida independiente de lo que el REVIEW declaró arreglado)

Toda la evidencia de PROD se obtuvo por `psql -tA | tr -d '\r'` con `PGCLIENTENCODING=UTF8`, read-only (cero `materializar_senales()` disparado por el verificador; los pgTAP corren en `begin; … rollback;`). Jamás REST, jamás se ecoó la URL.

## Goal Achievement

### Observable Truths (= 5 Success Criteria del ROADMAP §Phase 127)

| # | Truth | Status | Evidence (PROD, verbatim) |
|---|---|---|---|
| 1 | Cada señal positiva tiene `evidencia={"total":N,"items":[…]}` con boletín/título/fecha/enlace/`en_corpus` por ítem; supresión conserva `'{}'` | ✓ VERIFIED | V2 positivas sin `items` = **0**; V3 supresiones con `evidencia<>'{}'` = **0**; V9 positivas sin `total`/`consultado_al`/`fuente` = **0**. Ítem real de `urgencias`: `{"fecha":"2026-07-22","enlace":"https://tramitacion.senado.cl/…","titulo":"Para la reconstrucción nacional…","boletin":"18216-05","en_corpus":true,"descripcion":"Discusión inmediata"}`. La única fila con `evidencia={}` es `nuevos_ingresos` (conteo=0, `supresion_causa='sin nuevos ingresos fechados en la ventana'`) |
| 2 | Cero cap por recencia: `total` == nº ítems; `urgencias` emite sus ~95 eventos con grado; regla escrita en la migración | ✓ VERIFIED | V4 paridad `conteo==total==jsonb_array_length(items)` divergentes = **0**. V10 `urgencias` → `95\|95\|95`. V11 = **3** grados distintos (no un solo grado recortado). `grep -iE '\blimit\b' 0081` → única aparición es el comentario `:307 "-- \`limit\`, cero cap (Anti-B-01)"` — cero `LIMIT` ejecutable en el proc. Regla de cap escrita en `0081:45-46` |
| 3 | Guard 404 vivo en el left join: ítems de agenda sin boletín en `proyecto` salen `en_corpus:false` + título/enlace null; nunca inner join; paridad demuestra que el conteo no diverge | ✓ VERIFIED | Cuerpo vivo del proc: 6 `left join public.proyecto`, cero `where cp/sti.boletin is not null` (las 2 coincidencias en `prosrc` son comentarios `-- CR-02: … ya NO filtra`). V6 `puntos_sin_corpus=14`, `tabla_sin_corpus=11` sobre totales > 0 (**cero fuerte apareado con positivo**). V7 paridad anidada `puntos_total==length(puntos)` y `tabla_total==length(tabla)` divergentes = **0\|0**. Violaciones "fuera de corpus con titulo/enlace no-null" = **0**; ejemplo real emitido con `boletin/titulo/enlace: null, en_corpus:false` + `materia` preservada |
| 4 | Grafía de cámara ÚNICA en `actualidad_senal` (fix en el materializador, no en el cliente) + frescura de fuente separada del hecho | ✓ VERIFIED | V5 `distinct cobertura_camara` (excl. `agrupacion_materia`) = `<null>`, `2022-2026 (piso de corpus)`, `Cámara de Diputados`, `Senado` — un solo bucket por cámara, tildes intactas (UTF8 sano). `actualidad.grafia_camara` en PROD usa match por raíz (`~ 'diputad'`), no whitelist frágil. Frescura separada: cada `evidencia` positiva lleva `consultado_al` + `fuente` a nivel de objeto, fuera de `items` (V9 = 0 faltantes) |
| 5 | `0080` aditiva aplicada por `psql --single-transaction` (jamás `db push`; `0073`/`0075` intactas) + pgTAP contra el schema aplicado | ✓ VERIFIED | Estado del proc en PROD: `proconfig = search_path="" ; TimeZone=UTC` ⇒ 0080+0081 efectivamente aplicadas. `git log -- 0073*.sql 0075*.sql` → último toque `af970a1`/`0da25bf` (Phase 124): **intactas**. pgTAP re-corridos POR EL VERIFICADOR contra PROD: `0080` → `1..31`, **31 ok, 0 not ok**; `0065` → `1..17`, **17 ok, 0 not ok**, `DELETE 3` + `DELETE 6` (confirma WR-07: ya no borra 48.409 filas) |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `supabase/migrations/0080_actualidad_evidencia.sql` | proc con evidencia + `grafia_camara` | ✓ VERIFIED | 440 líneas (min 260); aplicada; intocada tras el review |
| `supabase/migrations/0081_actualidad_evidencia_fix.sql` | fixes CR-01/CR-02/WR-03/WR-04/WR-05/IN-02/IN-03 | ✓ VERIFIED | 533 líneas; aditiva (2 `create or replace`, cero DDL de tabla, cero grant/revoke); aplicada a PROD (confirmado por `prosrc`/`proconfig`, no por SUMMARY) |
| `supabase/tests/0080_actualidad_evidencia.test.sql` | pgTAP evidencia/paridad/supresión/fantasma | ✓ VERIFIED | 370 líneas; `plan(31)`; 31/31 verde en corrida independiente |
| `supabase/tests/0065_actualidad_senal.test.sql` | regresión con grafía ciudadana | ✓ VERIFIED | 228 líneas; `plan(17)`; 17/17 verde y determinista |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `0081` (proc vivo) | `public.proyecto` | 6 `left join public.proyecto` incl. sub-selects `p2`/`p3` | ✓ WIRED |
| `0081` (proc vivo) | `actualidad.grafia_camara` | select + group by idénticos | ✓ WIRED (V5: un bucket por cámara) |
| `0080/0081` | PROD `public.actualidad_senal.evidencia` | `psql --single-transaction` | ✓ WIRED (8 filas vivas, 7 positivas con evidencia poblada) |
| proc | aislamiento | `pg_advisory_xact_lock` presente en `prosrc` de PROD | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `actualidad_senal.evidencia` | `items[]` | `tramitacion_evento`/`citacion`/`sesion_sala` + left join `proyecto` | Sí — boletines, títulos y enlaces reales (ej. `18216-05`) | ✓ FLOWING |
| `evidencia.items[].puntos/tabla` | anidados | `citacion_punto`/`sesion_tabla_item` | Sí — 14+11 ítems fuera de corpus emitidos, no recortados | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| pgTAP 0080 verde contra schema aplicado | `psql -f supabase/tests/0080_…test.sql` | `1..31`, 31 ok, 0 not ok | ✓ PASS |
| pgTAP 0065 verde y determinista | `psql -f supabase/tests/0065_…test.sql` | `1..17`, 17 ok, `DELETE 6` | ✓ PASS |
| Guards de régimen (control: `app/` no se tocó) | `cd app && pnpm guards` | `11 passed (11)` / `334 passed (334)` | ✓ PASS |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|---|---|---|---|
| PANEL-01 | Opción A: los 6 bloques pueblan `evidencia` jsonb, supresión `'{}'`, cap prohibido sin total | ✓ SATISFIED | Truths 1, 2, 3. Parte UI ("el ciudadano ve") es Phase 128 por diseño |
| PANEL-06 | Grafía de cámara única, fix en el materializador (`0065:233,261`) no en el cliente | ✓ SATISFIED | Truth 4 + `grafia_camara` vive en el schema `actualidad`, cero código de cliente tocado |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | Cero `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` en los 4 archivos de la fase | — | Ninguno (los hits de `grep` fueron la palabra "TODOS" y el comentario "cero cap") |

### Notas informativas (no gaps)

- **IN-04 (skipped deliberado):** `actualidad.grafia_camara` nace con `EXECUTE` a `PUBLIC`. Confirmado en PROD (`proacl` no restringe). Riesgo ≈ 0: el schema `actualidad` no concede `USAGE` a `anon`/`authenticated` y la función es pura e inmutable. Queda como deuda de higiene para la primera migración que sí toque ACLs — consistente con D-09 (esta fase tenía prohibido tocar ACLs).
- `nuevos_ingresos` usa `cobertura_camara` para una etiqueta de ventana (`2022-2026 (piso de corpus)`) en vez de una cámara. Semántica heredada de `0065`, no introducida por esta fase; sale en una fila de supresión, así que no contamina la grafía de ninguna señal positiva. Vale tenerlo presente al escribir el consumo de 128.

### Gaps Summary

Ninguno. Los 5 criterios del ROADMAP se verificaron uno a uno contra el estado APLICADO de PROD, con cada cero apareado con un control positivo (guard 404: 14+11 fuera de corpus sobre listas no vacías; paridad: 0 divergencias sobre 7 señales positivas con conteos > 0; supresión: la fila de `nuevos_ingresos` existe y conserva `{}`). Los dos pgTAP y los guards se re-corrieron en este proceso — no se aceptó ningún PASS por narrativa de SUMMARY ni de REVIEW.

Criterios visuales no aplican: fase de DB; la UI que nombrará los sujetos es la Phase 128.

---

_Verified: 2026-07-30_
_Verifier: Claude (gsd-verifier)_
