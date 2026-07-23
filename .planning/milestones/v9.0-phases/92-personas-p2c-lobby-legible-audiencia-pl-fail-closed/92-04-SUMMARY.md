---
phase: 92-personas-p2c-lobby-legible-audiencia-pl-fail-closed
plan: 04
subsystem: apply DDL + deploy + gate empírico (cierre de fase)
tags: [LOB-01, LOB-02, LOB-03, apply-prod, pgtap, cobertura-menciones, deploy-cloudflare, browseros-gate]
requires:
  - supabase/migrations/0062_lobby_menciones_de_boletin.sql (RPC — Plan 92-01)
  - supabase/tests/0062_lobby_menciones_de_boletin.test.sql (pgTAP — Plan 92-01)
  - app/components/lobby-de-parlamentario.tsx (materia legible + chips — Plan 92-02)
  - app/components/lobby-menciones-de-boletin.tsx (sección ficha proyecto — Plan 92-03)
  - docker-cf-build.sh + app/wrangler.jsonc (runbook deploy — 85-01/91-03)
provides:
  - "RPC lobby_menciones_de_boletin APLICADA a PROD (0062) + pgTAP 13/13 verde contra schema aplicado"
  - "Cobertura de menciones MEDIDA y DECLARADA: 195/5106 audiencias confirmadas (~3.8%), 82 boletines distintos"
  - "Deploy Cloudflare LIVE (fa4d4369) — arrastra fixes UI 91 fuera del bundle e0c969af"
  - "Gate BrowserOS aprobado sobre el deploy real (materia completa + chips + sección con leyenda + sin regresión 91)"
affects:
  - Fase 92 CERRADA (canal audiencia→PL fail-closed live en producción)
tech-stack:
  added: []
  patterns:
    - "apply DDL aditivo deny-by-default por el AGENTE vía psql --single-transaction (NUNCA db push) — precedente 0059-0061"
    - "pgTAP contra schema APLICADO revela drift de fixture: NOT NULL reales + total_n no isolation-safe vs dato PROD"
    - "cobertura honesta = query espejo del fail-closed doble (patrón context-gated + existencia en proyecto) sobre PROD"
    - "deploy OpenNext Docker node:22-slim + wrangler OAuth; DOM del deploy real = evidencia primaria (save_screenshot CDP timeout)"
key-files:
  created:
    - .planning/phases/92-personas-p2c-lobby-legible-audiencia-pl-fail-closed/92-04-APPLY-RUNBOOK.md
    - .planning/phases/92-personas-p2c-lobby-legible-audiencia-pl-fail-closed/92-BROWSEROS-GATE.md
  modified:
    - supabase/tests/0062_lobby_menciones_de_boletin.test.sql
decisions:
  - "0062 aplicada a PROD por el AGENTE (aditiva deny-by-default, dentro de autoridad — precedente 0059-0061), UNA vez, psql --single-transaction; pgTAP contra schema aplicado como única prueba válida del DDL"
  - "el pgTAP falló primero contra el schema REAL (2 drifts de fixture): (1) parlamentario NOT NULL periodo/origen/enlace no suplidos; (2) 14309-04 es boletín REAL con audiencias reales → total_n absoluto no isolation-safe. Fix Rule 1: suplir NOT NULL + asertar fixtures propios + total_n constante y ≥2"
  - "cobertura DECLARADA honesta 195/5106 (~3.8%): baja POR DISEÑO (fail-closed) — la mayoría de materias no citan el número; el canal solo enlaza mención explícita + proyecto existente"
  - "deploy ejecutado por el agente (Docker + wrangler OAuth disponibles; precedente 91-03) en vez de diferir a gate 94 — los fixes 91 fuera del bundle e0c969af quedan LIVE"
metrics:
  duration: ~55min
  completed: 2026-07-22
---

# Phase 92 Plan 04: Apply 0062 a PROD + cobertura + deploy + gate BrowserOS Summary

**One-liner:** Cierre de la Fase 92: la RPC `lobby_menciones_de_boletin` (0062) queda APLICADA
a PROD por `psql --single-transaction` (precedente 0059-0061) con pgTAP **13/13 verde contra
el schema APLICADO**; la cobertura de menciones válidas se MIDE y DECLARA honestamente —
**195 de 5.106** audiencias de lobby confirmadas (~3,8 %) mencionan explícitamente un boletín
existente, sobre **82** boletines distintos; y el sitio se despliega a Cloudflare
(**fa4d4369**, arrastrando los fixes UI de 91 que quedaron fuera del bundle e0c969af) con el
gate BrowserOS APROBADO sobre el deploy real: materia de lobby completa/legible + chips de
mención operando, sección `#lobby-menciones` separada con leyenda anti-causal y parlamentario
enlazado, y el header 91 (partido) sin regresión.

## What Was Built

### Task 1 — Apply 0062 a PROD + pgTAP + cobertura (`92-04-APPLY-RUNBOOK.md`)
- **Precondición verificada:** `select count(*) from pg_proc where proname='lobby_menciones_de_boletin'` → **0** antes del apply (apply legítimo, no re-corrida).
- **Apply UNA vez** (VERBATIM): `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0062_lobby_menciones_de_boletin.sql` → `DROP FUNCTION` (no-op) / `CREATE FUNCTION` / 2× `REVOKE` (Camino A, CERO grant). NUNCA `db push`.
- **pgTAP contra schema APLICADO:** `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0062_...test.sql` → **13/13 `ok`, 0 `not ok`** (todo dentro de `begin…rollback` → cero efecto en PROD). Verifica: firma text, security definer, anon sin execute, emite total_n, NO filtra rut/email/contraparte_id, + comportamiento fail-closed doble (sufijo / gatillo / ley / pelado-suelto / inexistente / no_confirmado / sin-FK).
- **Cobertura MEDIDA y DECLARADA** (query verbatim en el runbook, espejo del fail-closed doble):
  - **5.106** audiencias confirmadas con parlamentario_id y materia (coincide con el dato PROD del CONTEXT).
  - **195** (~**3,8 %**) tienen ≥1 mención VÁLIDA (patrón context-gated + existencia en `proyecto`).
  - **82** boletines distintos mencionados. Top: `16849-12` (13), `16374-07` (12), `17064-08`/`15975-25` (9).
  - Baja POR DISEÑO (fail-closed): el canal solo enlaza mención explícita del número, jamás por tema/keyword.

### Task 2 — Deploy Cloudflare + gate BrowserOS (`92-BROWSEROS-GATE.md`)
- **Build:** OpenNext en Docker `node:22-slim` (Linux); fuente staged a `C:/Temp/obs-build`; `docker-cf-build.sh` + copy-back de `.open-next` al host mount; `MSYS_NO_PATHCONV=1` para el mount. `BUILD_OK`, worker.js generado.
- **Deploy:** `wrangler deploy --config wrangler.jsonc` OAuth local → **versión `fa4d4369-63c4-480e-ac41-4dc83094aa8b`** en `https://observatorio-congreso.thevalis.workers.dev`. Arrastra los fixes UI de 91. Smoke HTTP: `/`, `/parlamentario/D1132`, `/proyecto/16849-12` → 200.
- **Gate BrowserOS (DOM del deploy real como evidencia primaria — `save_screenshot`=CDP timeout, gotcha 91-03):**
  - **(a)** `/parlamentario/D1132` (Jorge Guzmán): materia COMPLETA/legible en la vista agrupada (`whitespace-pre-line leading-relaxed`, materia ~430 chars sin recorte); chips "Menciona boletín N" (`font-mono`) navegando a `/proyecto/N` (`16849-12`, `15322-05`, `14985-34`, …); fail-closed doble confirmado ("boletín 15.322" pelado tras gatillo → chip; "Ley 20422"/"Ley 20.730" → SIN chip).
  - **(b)** `/proyecto/16849-12`: sección "Audiencias de lobby que mencionan este boletín" SEPARADA de 0048 ("coincidencia de fechas"), leyenda anti-causal LOCKED verbatim ("…no implica influencia en la tramitación ni relación causal con el proyecto."), parlamentarios ENLAZADOS (`/parlamentario/D1059,D1074,D1119,D1132,D1141,D1146` — subconjunto de las 13 filas de la RPC), materia legible, empty-state ausente (boletín con 13 menciones reales).
  - **(c)** Sin regresión 91: PartidoChip LIVE (`aria-label="Partido: Evolución Política, según Cámara al 22 jul 2026"` — fuente+fecha) + leyenda cross-link ("afinidad" negada) presentes.
- **Veredicto: COMPRENSIBLE — GATE APROBADO.**

## Verification

- **0062 APLICADA a PROD** por `psql --single-transaction` (una vez); pgTAP **13/13** contra el schema APLICADO.
- **Cobertura declarada:** 195/5106 (~3,8 %), 82 boletines — query verbatim y reproducible en el runbook.
- **Suite app:** 90 archivos / **1155 tests VERDE**; `tsc -b` exit 0 (pre-deploy).
- **Deploy LIVE:** `fa4d4369` — 3 rutas 200; DOM confirma los 3 hechos + fixes 91 arrastrados.
- **LOB-01/LOB-02/LOB-03 verificados empíricamente en producción.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] El pgTAP fallaba contra el schema REAL por 2 drifts de fixture**
- **Found during:** Task 1 (primera corrida del pgTAP contra PROD aplicado).
- **Issue:** (a) el `insert into public.parlamentario` del test omitía las columnas NOT NULL sin default del schema REAL (`periodo`, `origen`, `enlace`) → `null value in column "periodo" violates not-null constraint` abortaba la transacción. (b) `14309-04` es un boletín REAL de PROD con audiencias reales que también lo mencionan → el `total_n` absoluto (`count(*) over ()`) NO es isolation-safe aun dentro de `begin/rollback` (la RPC ve las filas reales); el test asertaba `total_n = 2` y obtenía `3`.
- **Fix:** (a) el fixture de `parlamentario` suple `periodo='2022-2026', origen='test', enlace='http://x'`. (b) la aserción de conteo se reescribió a criterio honesto y isolation-safe: los 2 fixtures del test (T92AW1+T92AW2) SÍ se emiten (`count where identificador in (...) = 2`) + `total_n` constante (`count(distinct total_n)=1`) y ≥ 2. Plan actualizado a `plan(13)` (13 asertos reales; el original `plan(14)` ya estaba off-by-one). El `not ok` transitorio con `total_n=3` fue, de hecho, prueba empírica de que 0062 opera sobre dato LIVE.
- **Files modified:** supabase/tests/0062_lobby_menciones_de_boletin.test.sql
- **Commit:** 773b28a

**Total deviations:** 1 auto-fixed (test-side, drift de fixture vs schema PROD real — exactamente el tipo de fallo que el pgТАP-contra-schema-aplicado existe para cazar). Cero cambios de arquitectura; la RPC 0062 misma NO se tocó.

## Known Stubs

Ninguno. El canal audiencia→PL está LIVE end-to-end en producción: RPC aplicada, chips
operando, sección poblada. La cobertura baja (195/5106) NO es un stub — es el dato honesto del
fail-closed doble (mención explícita + existencia), medido y declarado.

## Threat Flags

Ninguno nuevo. El apply de 0062 (RPC PII-safe security-definer, doble-revoke Camino A, ya
probada por pgTAP en Plan 01) y el deploy no introducen endpoint, auth path ni schema en
frontera de confianza fuera del threat model de la fase.

## Self-Check: PASSED

- FOUND: .planning/phases/92-.../92-04-APPLY-RUNBOOK.md
- FOUND: .planning/phases/92-.../92-BROWSEROS-GATE.md
- FOUND: supabase/tests/0062_lobby_menciones_de_boletin.test.sql (modificado — fixture fix)
- FOUND commit: 773b28a (Task 1 — apply + pgTAP + cobertura)
- FOUND commit: efe4c35 (Task 2 — deploy fa4d4369 + gate BrowserOS)
- LIVE: RPC lobby_menciones_de_boletin en PROD (pg_proc); deploy fa4d4369 respondiendo 200.
