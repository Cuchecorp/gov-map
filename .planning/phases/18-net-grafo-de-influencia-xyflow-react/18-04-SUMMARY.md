---
phase: 18-net-grafo-de-influencia-xyflow-react
plan: 04
subsystem: deploy
tags: [supabase, pg_cron, xyflow, opennext, wrangler, gate, gated-off, e2e]

# Dependency graph
requires:
  - phase: 18-01
    provides: "migración 0030 (entidad/arista + grafo.materializar_aristas + subgrafo_red), aplicada al remoto"
  - phase: 18-02
    provides: "net-gate.ts (NET_PUBLIC_ENABLED default false) + ruta /red gateada"
  - phase: 18-03
    provides: "isla @xyflow/react (NET-02)"
provides:
  - "0030 APLICADA al Supabase remoto (psql --single-transaction); pgTAP 0030 13/13; cron net-materializar-aristas registrado"
  - "Sitio reconstruido (Linux/Docker) y desplegado (wrangler version 8c8d0f0b) con NET gated-OFF"
  - "Verificación: /red 404 en producción (gate cerrado); 6 rutas existentes 200; sin fuga NET"
affects: [produccion, net, gated-off]

# Tech tracking
tech-stack:
  added:
    - "@xyflow/react@12.11.0 (client island, app/)"
  patterns:
    - "Schema propio `grafo` para internals NET (NO reusar `net` = pg_net)."
    - "Migración additiva por psql --single-transaction (atómica; remoto sin begin/commit en el archivo)."
    - "NET nace gated-OFF: deploy NO expone nada (/red 404 con NET_PUBLIC_ENABLED off)."
key-files:
  modified:
    - supabase/migrations/0030_net.sql
    - supabase/tests/0030_net.test.sql
---

# Plan 18-04: verificación + redeploy gated-OFF — SUMMARY

**Estado:** COMPLETO. NET construido end-to-end y desplegado **gated-OFF**; el grafo NO se expone públicamente hasta el sign-off legal F17.

## Pasos de operador ejecutados por el orquestador

### 1. DB remoto (cerró el checkpoint de 18-01 Task 3)
- **0030 aplicada** vía `psql "$SUPABASE_DB_URL" --single-transaction -f` (atómica; el archivo no tiene begin/commit). Fix previo: el proc se movió del schema `net` (pertenece a **pg_net** — http_get/http_request_queue) a un schema propio **`grafo`** para evitar colisión.
- `select grafo.materializar_aristas();` → corre sin error.
- **pgTAP 0030: 13/13 verdes** (deny-by-default entidad/arista; proc + RPC security definer; subgrafo_red sin partido/rut con depth-clamp; happy-path co_lobby; caso negativo de normalización). Fix de un falso positivo: el test no-PII grepeaba el comentario "NUNCA partido/rut" → ahora stripea comentarios + límite de palabra.
- **cron** `net-materializar-aristas` registrado (`17 3 * * *`).

### 2. Build + deploy (SOLO Linux)
- `docker start -a obsbuild` (re-tar del host con el código NET + `@xyflow/react`, `pnpm install`, opennext cf-build) → OK.
- `docker cp` + `wrangler deploy` → version **8c8d0f0b**.

### 3. Verificación e2e en producción
- **`/red` → 404** (gate cerrado, `NET_PUBLIC_ENABLED` off — NET no expuesto). ✅
- 6 rutas existentes (`/`, `/buscar`, `/parlamentarios`, `/parlamentario/D1054`, `/proyecto/18296-05`, `/agenda`) → **200**; "Cómo votó" (P22) intacto. ✅
- xyflow aislado a `app/components/red/` (`'use client'`); `page.tsx`/`globals.css` solo lo mencionan en comentario → sin bloat del server bundle. ✅
- vitest **246/246**, `tsc` limpio.

## Deuda / notas honestas
- **DATA DEBT — grafo vacío:** 0 aristas materializadas. Las 7 audiencias de lobby están todas `no_confirmado` → ningún par de parlamentarios confirmados comparte contraparte. El **mecanismo** (modelo + proc + RPC + gate + UI) está completo y verificado; faltan **datos de lobby confirmados** (concierne al pipeline de identidad/cobertura lobby, deuda separada). La UI lo muestra como honest-state, nunca como error.
- **Sign-off F17 pendiente:** NET nace gated-OFF. Encender `NET_PUBLIC_ENABLED` requiere `17-LEGAL-DOSSIER.md` `signoff: approved` (deuda de operador, abogado externo).
- **co_votacion excluida** del MVP por anti-insinuación (hairball conspirativo); agregar otra arista exige nueva migración.

## Self-Check: PASSED
NET-01 (modelo+materialización+RPC) aplicado y verificado; NET-02 (isla xyflow+filtros+provenance+CC BY) entregado; gate cerrado en producción; tests verdes. NET no expuesto públicamente (correcto: gated-OFF hasta F17).
