---
phase: 22-votaciones-instructivas-que-voto-cada-uno
plan: 04
subsystem: deploy
tags: [supabase, migration, pgtap, docker, opennext, wrangler, browseros, e2e]

# Dependency graph
requires:
  - phase: 22-01
    provides: "migración 0028 (RPC votos_de_parlamentario extendido) + pgTAP 0029 — apply remoto era el checkpoint operador de esta fase"
  - phase: 22-02
    provides: "VotosView instructiva (ficha parlamentario)"
  - phase: 22-03
    provides: "VotacionCard espejo (ficha proyecto)"
provides:
  - "RPC 0028 APLICADO al Supabase remoto (psql directo, additivo, idempotente) — el RPC vivo devuelve titulo/idea_matriz/resultado/total_si/total_no/quorum/etapa"
  - "Sitio en producción reconstruido (build Linux/Docker obsbuild) y desplegado (wrangler) con las votaciones instructivas"
  - "Verificación e2e en producción (browseros) — los 6 SC confirmados sobre data real"
affects: [produccion, votaciones, ficha-parlamentario, ficha-proyecto]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Apply de migración por psql directo (no `supabase db push`): el remoto tiene drift en schema_migrations (registra hasta 0025; 0026/0028 aplicados a mano). db push arrastraría 0026 (Phase 21, fuera de alcance) → se aplica SOLO 0028, autocontenido e idempotente (drop+create or replace+grant)."
    - "Build SOLO Linux vía container obsbuild + docker cp del bundle .open-next al host + wrangler deploy directo sobre el bundle (NO pnpm deploy; Windows produce bundle roto 500)."

key-files:
  created:
    - .planning/phases/22-votaciones-instructivas-que-voto-cada-uno/shots/parlamentario_D1054_instructivo.jpg
    - .planning/phases/22-votaciones-instructivas-que-voto-cada-uno/shots/proyecto_18296-05_desenlace.jpg
  modified:
    - supabase/tests/0029_votos_instructivos.test.sql
---

# Plan 22-04: redeploy Linux + e2e — SUMMARY

**Estado:** COMPLETO — RPC aplicado al remoto, sitio desplegado, e2e verificado en producción.

## Qué se hizo (incluye el checkpoint operador de 22-01 Task 3)

El orquestador ejecutó los pasos de operador end-to-end (credenciales `~/obs_env.sh`, Docker, wrangler OAuth ya autenticado, browseros local):

### 1. DB remoto (cerró el checkpoint BLOCKING de 22-01 Task 3)
- **0028 aplicado** vía `psql "$SUPABASE_DB_URL" -f supabase/migrations/0028_votos_instructivos.sql` → `DROP FUNCTION / CREATE FUNCTION / GRANT`, exit 0. Se aplicó SOLO 0028 (no `supabase db push`) por drift de `schema_migrations` (remoto hasta 0025; 0026 de Phase 21 fuera de alcance). 0028 es autocontenido e idempotente.
- **Probe en vivo:** `votos_de_parlamentario('D1054',50,0)` devuelve titulo/idea_matriz/resultado/total_si/total_no/quorum/etapa poblados (p.ej. "Autoriza mayor endeudamiento…" / Rechazado 58–81).
- **pgTAP 0029: 7/7 verdes.** Fix menor de fixture: insertaba `proyecto_ficha.estado='ok'` (viola `proyecto_ficha_estado_check`); corregido a `'embebido'` (commit `210f516`).
- **Regresión:** pgTAP 0019 (votos/asistencia/ficha) **13/13 verdes**; INVOKER + piso PII deny-by-default intactos (anon no lee partido).

### 2. Build + deploy (SOLO Linux)
- `docker start -a obsbuild` → OpenNext build OK, bundle en `/build/app/.open-next` (rutas incl. `/parlamentarios`, `/parlamentario/[id]`, `/proyecto/[boletin]`).
- `rm -rf app/.open-next` + `docker cp obsbuild:/build/app/.open-next <host>/app/` (25M, worker.js presente).
- `cd app && npx wrangler deploy` → exit 0. Version `3f26e1ae-93a4-4658-bdd1-8f49e71dda07`. URL: https://observatorio-congreso.thevalis.workers.dev

### 3. E2E en producción (browseros bros.py + verificación HTTP)
Confirmado sobre data real en `/parlamentario/D1054` y `/proyecto/18296-05`:
- **SC1 Sustancia:** título enlazado + "De qué trata: …" (extracto idea matriz). ✅
- **SC2 Desenlace:** "Votó … · el proyecto fue Rechazado 72–74 / Aprobado 94–52 / Rechazado 58–81" (conteo factual). ✅
- **SC3 Asistencia corregida:** heading **"Cómo votó"** (no "Asistencia"); "Emitió 9 votos registrados". ✅
- **SC4 Arco por proyecto:** votos agrupados bajo cada proyecto (endeudamiento / subvenciones) con sus etapas. ✅
- **SC5 Honest-states:** línea "A favor / En contra se refiere a aprobar o rechazar el proyecto en esa etapa"; bloque MONEY "Financiamiento y contratos — Pendiente de revisión legal (Ley 21.719)". ✅
- **SC6 Espejo + invariantes:** `/proyecto/18296-05` muestra "Qué se votó" + "Resultado" + conteos; **noindex** presente; **0 hits de "partido"**; sin foto; MONEY/NET OFF; ProvenanceBadge por fila. ✅

Screenshots "después": `shots/parlamentario_D1054_instructivo.jpg`, `shots/proyecto_18296-05_desenlace.jpg`.

## Deuda / notas
- **schema_migrations drift (pre-existente, no introducido aquí):** el remoto no registra 0026/0028 como filas de historial (se aplican por psql). Un futuro `supabase db push` intentaría 0026 (Phase 21) + 0028 (idempotente). Deuda de operador separada; no bloquea.
- **Cobertura de votaciones:** sigue en 2 boletines/10 votaciones (deuda de DATOS, fuera de alcance de esta fase de presentación) — la vista degrada honesto.

## Self-Check: PASSED
Build Linux OK, deploy OK, RPC vivo verificado, pgTAP 7/7 + 0019 13/13, 6/6 SC confirmados en producción.
