---
phase: 38-surf-superficie-de-cruces-en-ficha-de-proyecto-destrabada-20
plan: 03
subsystem: deploy-checkpoint-operador
tags: [deploy, cloudflare, smoke, degrade-honesto, screenshots, checkpoint-operador, ddl-gated]
requires:
  - "RPC cruces_de_proyecto(text) + pgTAP 0049 — ESCRITAS (Plan 01, no aplicadas)"
  - "CrucesView/CrucesSection + <section id=cruces> cableada gated (Plan 02)"
  - "crucesPublicEnabled ON en PROD (Candado B, 2026-07-02)"
provides:
  - "PROD redeployado (versión e660715f) con el carril de cruces degradando honesto pre-apply"
  - "Temp/reshot2.mjs — helper de screenshot same-origin (evidencia demo)"
  - "Evidencia pre-apply: Temp/cruces-14309-preapply.png + Temp/cruces-14782-preapply.png"
  - "Checkpoint operador: comando exacto de apply 0049 + schema_migrations + pgTAP + veredicto visual"
affects:
  - "Operador: aplicar 0049 a PROD → la sección pasa de degrade→null a montada con datos"
tech-stack:
  added: []
  patterns:
    - "Deploy patrón caliente: docker-cf-build.sh (OpenNext Linux) → docker cp → wrangler deploy (OAuth host)"
    - "Screenshot iframe SAME-ORIGIN (harness = página PROD; iframe in-process rasteriza fullPage completo)"
    - "Degrade honesto verificado por AUSENCIA del heading + Suspense→empty, NO por ausencia del wrapper (frontier)"
key-files:
  created:
    - Temp/reshot2.mjs
    - Temp/cruces-14309-preapply.png
    - Temp/cruces-14782-preapply.png
  modified: []
decisions:
  - "El degrade honesto pre-apply se prueba por la AUSENCIA del heading 'Cruces con el sector' (count 0) + la resolución del Suspense a S:6 VACÍO, NO por la ausencia del tag <section id=cruces>: el wrapper mt-12 es la frontier gated por crucesPublicEnabled (ON en PROD), persiste por diseño (Plan 02), y se llena solo tras el apply de la RPC"
  - "El agente JAMÁS aplicó la DDL 0049 (T-38-09): el apply es checkpoint:human-verify BLOCKING (patrón 52-06); la única prueba válida del DDL es el pgTAP post-apply contra el schema aplicado"
  - "Gate verde (689/689 + tsc) ANTES del deploy (T-38-10): no se desplegó sobre rojo"
metrics:
  duration_min: 10
  tasks: 2
  files: 3
  completed: "2026-07-08T02:23:00Z"
---

# Phase 38 Plan 03: Deploy + smoke + checkpoint operador Summary

Gate completo verde, redeploy del frontend a PROD (patrón caliente docker-cf-build.sh + wrangler, versión `e660715f`), smoke que confirma el **degrade honesto pre-apply** (la sección de cruces resuelve a vacío sin 500 porque la RPC 0049 aún no existe), evidencia demo capturada con helper same-origin, y el checkpoint de operador que entrega el comando EXACTO de apply de la DDL 0049 + su pgTAP + el veredicto visual. El agente NUNCA aplicó la migración.

## What Was Built

### Task 1 — Gate completo + redeploy + smoke (auto, sin commit de código)
- **Gate verde ANTES del deploy:** `pnpm test` → **689/689 verde** (66 files; lockdown-guard 8/8 y banned-vocab incluidos en la suite), `pnpm exec tsc -b` → limpio (exit 0). Baseline 670/689 mantenido, nunca menos.
- **Deploy (patrón caliente):** `docker-cf-build.sh` (OpenNext en Docker Linux — Windows worker roto) → `docker cp` de `.open-next` al host → `npx wrangler deploy` desde `app/` (OAuth host vivo, `wrangler whoami` OK). **Versión desplegada: `e660715f-d456-4965-8c71-09e66e1c5930` al 100%** (creada 2026-07-08T02:16Z, confirmada con `wrangler deployments status`).
- **Smoke (curl PROD `https://observatorio-congreso.thevalis.workers.dev`):** `/`, `/proyecto/14309-04`, `/proyecto/14782-13`, `/parlamentario/D1012` → **todos 200**.
- **Degrade honesto verificado en PROD:** en `/proyecto/14309-04` el heading `Cruces con el sector` está **AUSENTE** (grep count 0) y el Suspense `B:6` resuelve a `S:6` **VACÍO** (`$RC("B:6","S:6")` swap → skeleton reemplazado por null); documento cierra limpio (`</body></html>`); cero `internal server error`/`application error`. `CrucesSection` degradó a null por PGRST202 (RPC 0049 inexistente). Idéntico en 14782-13.
- **Carriles vecinos sin regresión:** `#lobby-tramitacion` y `#idea-matriz` presentes en 14309-04.

### Task 2 — Evidencia de screenshot same-origin (auto, commit 9030c9f)
- **`Temp/reshot2.mjs`** — helper de screenshot con técnica iframe SAME-ORIGIN (harness = página PROD misma origin → iframe in-process rasteriza fullPage completo; evita el clipping OOPIF del harness file:// documentado en 54-05). Base PROD + demo boletines 14309-04/14782-13 documentados; resuelve rutas relativas same-origin; maneja framing SSE/JSON plano y reintento de `save_screenshot`.
- **`Temp/cruces-14309-preapply.png`** (611 KB) — ficha 14309-04 ÍNTEGRA: tramitación, votaciones, lobby, idea matriz, cuerpos legales, similares; rail izquierdo muestra "◆ Cruces" (gated ON), pero SIN contenido de sección de cruces en el cuerpo (degrade honesto PGRST202→null). Prueba visual: el deploy de código NO rompió la ficha pre-apply.
- **`Temp/cruces-14782-preapply.png`** (539 KB) — 14782-13, mismo degrade honesto.

## Verification

- `pnpm test` → 689/689 verde; `pnpm exec tsc -b` → exit 0.
- `wrangler deployments status` → `e660715f` al 100% (2026-07-08T02:16Z).
- curl smoke 4 rutas → 200; heading `Cruces con el sector` count 0 en ambos boletines; Suspense→empty; sin 500.
- `node -e "fs.existsSync('Temp/reshot2.mjs') && /14309-04/.test(...)"` → exit 0.
- 2 capturas pre-apply en Temp/ (611 KB / 539 KB), inspección visual confirma ficha íntegra + degrade honesto.

## Deviations from Plan

### Verification-criteria clarification (no code fix)

**1. La expectativa `grep -c 'id="cruces"' → 0` del env-note era un modelo mental incorrecto**
- **Found during:** Task 1 (smoke).
- **Observación:** el env-note/must-have predecía que `id="cruces"` estaría AUSENTE (count 0) pre-apply. En realidad devuelve 1: el `<section id="cruces">` **wrapper** está gated por `crucesPublicEnabled` (ON en PROD desde 2026-07-02), NO por la existencia de la RPC. Plan 02 documentó explícitamente que "el wrapper `mt-12` persiste (frontier)".
- **Resolución:** NO es bug — el degrade honesto REAL se prueba por (a) AUSENCIA del heading `Cruces con el sector` (count 0), (b) el Suspense resolviendo a `S:6` VACÍO, (c) 200 sin 500. Todo verificado. Cero cambio de código (Reglas 1-3 no aplican).
- **Files modified:** ninguno.

## Threat Flags

None — cero superficie nueva. El agente no aplicó DDL (T-38-09 mitigado: apply = checkpoint blocking). Gate verde antes del deploy (T-38-10). Cero dependencias nuevas (T-38-SC). El falso positivo conocido (tsc/vitest verdes ≠ Postgres ejecutó el DDL, T-38-11 accept) se resuelve con el pgTAP post-apply del operador.

## Operator Debt (checkpoint Task 3 — BLOCKING, pendiente)

**El código está EN VIVO degradando honesto; falta SOLO el apply de la RPC 0049 (Candado A datos), acción EXCLUSIVA de operador.**

1. **Aplicar la DDL** (PGCLIENTENCODING=UTF8 en Windows; NUNCA `supabase db push`):
   ```
   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 -f supabase/migrations/0049_cruces_de_proyecto.sql
   psql "$SUPABASE_DB_URL" -c "insert into supabase_migrations.schema_migrations (version, name) values ('0049','cruces_de_proyecto') on conflict do nothing;"
   ```
2. **Correr el pgTAP** contra el schema aplicado (espera **10/10 ok**):
   ```
   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0049_cruces_de_proyecto.test.sql
   ```
3. **Veredicto visual** en PROD tras el apply:
   - `/proyecto/14309-04` → sección "Cruces con el sector del proyecto" con ~47 parlamentarios (emilia schneider, gonzalo winter, diego schalper…), cada nombre linkeado a `/parlamentario/[id]`, líneas voto/reunión SEPARADAS, caveat 1×, ProvenanceBadge por evidencia.
   - `/proyecto/14782-13` → empty honesto ("Aún no se registran parlamentarios con cruces…") — esperado (sin sector), NO bug.
4. **Anti-insinuación:** cero léxico causal, conteo neutro, cero ranking.

## Notes for Next Plan

- Tras el apply + veredicto OK, el operador escribe "aprobado" y la fase 38 cierra. La sección se monta con datos sin re-deploy (el código ya está en vivo; solo faltaba el dato que la RPC provee).

## Self-Check: PASSED (salvo checkpoint operador pendiente)

- Files: 4/4 FOUND (Temp/reshot2.mjs, Temp/cruces-14309-preapply.png, Temp/cruces-14782-preapply.png, SUMMARY).
- Commits: 1/1 FOUND (9030c9f).
- Deploy: e660715f al 100% confirmado.


## Checkpoint RESUELTO (2026-07-08)

Operador autorizó la aplicación directa ("aplica tu todo"). Ejecutado por el agente con esa autorización:
- 0049 y 0050 APLICADAS a PROD (psql --single-transaction, ON_ERROR_STOP; registradas en schema_migrations).
- pgTAP 0049: **10/10 ok**. pgTAP 0050: **10/10 ok** (primer run destapó FK faltante en el fixture — proyecto padre BTEST-1 — parcheado y committeado; PROD intacto, todo en tx con rollback).
- Superficies MONTADAS en vivo sin re-deploy: /proyecto/14309-04 → "Explorar los 47 cruces"; /proyecto/14782-13 → empty honesto; /parlamentario/D1012 → "Ausente en 1 de 141 votaciones (0,7%). Mediana de su cámara: 0,7% (155 parlamentarios)." + caveat de cobertura. Copy verbatim al contrato.
