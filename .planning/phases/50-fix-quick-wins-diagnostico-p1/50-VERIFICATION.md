---
phase: 50-fix-quick-wins-diagnostico-p1
verified: 2026-07-02T19:20:00Z
status: passed
score: 12/12 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: initial verification (no prior VERIFICATION.md)
operator_checkpoint: # informational — NOT a phase gap (phase boundary explicitly excludes deploy)
  - "Deploy F45+F46+F50 (Docker Linux + wrangler; creds CF fuera de .env) — checkpoint operador único compartido. El código de F50 es completo y verificado; el render en vivo se confirma tras ese deploy. No cuenta como gap de esta fase."
---

# Phase 50: FIX — Quick wins de bugs del diagnóstico 2026-07-02 (P1) — Verification Report

**Phase Goal:** Eliminar los bugs de código acotados y verificados en vivo del diagnóstico §1 — sin DDL, sin RPC nueva, sin flag flipeado, sin deploy. La primera impresión del sitio deja de estar rota y la doctrina de estados honestos vuelve a cumplirse en el 100% de las rutas.
**Verified:** 2026-07-02T19:20:00Z
**Status:** passed
**Re-verification:** No — initial verification

> Nota: el ROADMAP marca "4/5 plans executed" y deja `50-05-PLAN.md` como `[ ]`, pero `50-05-SUMMARY.md` existe y su código está aplicado y verificado (commits `f7d3cdb`/`82f989c`/`229482e`/`8b849af`). El checkbox del ROADMAP es stale; los 5 planes están ejecutados.

## Goal Achievement

### Observable Truths (12 Success Criteria del ROADMAP)

| #  | Truth (SC) | Status | Evidence |
| -- | ---------- | ------ | -------- |
| 1  | **B1** — pill del home apunta a boletín real | ✓ VERIFIED | `app/app/page.tsx:27` `{ query: "14309-04", mono: true }`; grep confirma cero `15234-07` en page.tsx |
| 2  | **B6** — umbral ámbar por cadence (14d), call-site intacto | ✓ VERIFIED | `app/lib/format.ts:10` `STALE_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000`; cero `48 * 60 * 60 * 1000`; `provenance-badge.tsx` (fuente) NO figura en el diff de la fase (solo su test) |
| 3  | **B7** — agenda chequea `.error` y lanza | ✓ VERIFIED | `agenda/page.tsx:288` (CitacionesSection), `:433`/`:436` (senado/cámara), `:455` (probe forward-only) `throw new Error(...)`; "No hay citaciones" (`:296`) solo en query-exitosa-cero-filas |
| 4  | **B8** — CamaraChip omite null en desconocida; literal ausente de prod | ✓ VERIFIED | `camara-chip.tsx:41` `if (kind === "desconocida") return null;`; el literal "Cámara origen desconocida" solo aparece en comentario (`:23`) y descripción de test — nunca en render |
| 5  | **B9** — 4 error.tsx es-CL, firma `unstable_retry` sin `reset` | ✓ VERIFIED | Existen `proyecto/[boletin]`, `parlamentarios`, `buscar`, `agenda`/error.tsx; grep `reset\b` = 0 en `**/error.tsx`; agenda/error.tsx usa `unstable_retry`, "use client", botón "Reintentar" |
| 6  | **B10** — copy lobby por cámara; senado nunca "camara.cl/transparencia"; RPC allowlisted | ✓ VERIFIED | `lobby-de-parlamentario.tsx:80-88` `fuenteLobbyPorCamara`: senado → "el registro de la Ley del Lobby del Senado"; `page.tsx:328-349` `LobbySectionConCamara` vía `parlamentario_publico` (ya allowlisted) + throw-on-error; enlace por fila intacto |
| 7  | **B12** — `capitalize` Tailwind removido; `capitalizarPrimera` en uso | ✓ VERIFIED | grep `className="capitalize"` = 0 en agenda/page.tsx; `capitalizarPrimera(...)` en `:244` y `:325` |
| 8  | **B14** — votación con resultado null muestra línea explícita | ✓ VERIFIED | `votacion-card.tsx:82-91` ternario: rama null renderiza `<p>Desenlace no informado por la fuente.</p>`; barra/totales (arriba) intactos |
| 9  | **B15** — AutoresList prop `iniciativa`; copy Mensaje solo si Mensaje | ✓ VERIFIED | `autores-list.tsx:16` prop `iniciativa`; `:26-28` `iniciativa === "Mensaje" ? "Iniciativa del Ejecutivo (Mensaje)." : "Autores no informados."`; `ficha-header.tsx:57` `iniciativa={proyecto.iniciativa}` |
| 10 | **B17** — `fechaCortaSegura` en los 2 sitios; sin `new Date(...fecha_presentacion)` crudo | ✓ VERIFIED | `patrimonio-de-parlamentario.tsx:384` y `:608` usan `fechaCortaSegura`; los `new Date` restantes (`:381`,`:647`) son sobre `fecha_captura`, no `fecha_presentacion` |
| 11 | **HS** — honest-state 1×/sección; voto-ficha-row.tsx sin cambios | ✓ VERIFIED | `votos-por-parlamentario.tsx:331` `hayArcoSinIdea`; nota única `:442-447`; "no disponible aún" removido del per-arco; `voto-ficha-row.tsx` NO figura en el diff de la fase (dead code intacto) |
| 12 | **Global** — suite ≥377 verde, tsc limpio, lockdown 7/7, cero RPC/.from PII/DDL/flag | ✓ VERIFIED | Suite ejecutada: **400 passed / 43 files** (0 fallos); `tsc -b` exit 0; `lockdown-guard.test.ts` 7/7; los 24 archivos del diff están 100% bajo `app/` (cero `supabase/`, `.sql`, `.py`, RPC nueva) |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/app/page.tsx` | pill 14309-04 | ✓ VERIFIED | boletín real; sin 15234-07 |
| `app/lib/format.ts` | esStale 14d + capitalizarPrimera + fechaCortaSegura | ✓ VERIFIED | `:10`, `:108`, `:121`; 18 tests verdes |
| `app/app/agenda/page.tsx` | throw-on-error + capitalizarPrimera | ✓ VERIFIED | 4 throws; sin `capitalize` CSS |
| `app/components/camara-chip.tsx` | return null en desconocida | ✓ VERIFIED | `:41`; dot neutro (`camaraDotColor`) intacto |
| `app/app/{proyecto/[boletin],parlamentarios,buscar,agenda}/error.tsx` | 4 boundaries es-CL | ✓ VERIFIED | existen; `unstable_retry`, sin `reset` |
| `app/components/lobby-de-parlamentario.tsx` | copy por cámara | ✓ VERIFIED | `fuenteLobbyPorCamara`; enlace por fila intacto |
| `app/components/votacion-card.tsx` | honest-state null | ✓ VERIFIED | `:88-90` |
| `app/components/autores-list.tsx` | copy Mensaje | ✓ VERIFIED | prop `iniciativa` cableada desde ficha-header |
| `app/components/patrimonio-de-parlamentario.tsx` | fechaCortaSegura ×2 | ✓ VERIFIED | `:384`, `:608` |
| `app/components/votos-por-parlamentario.tsx` | nota 1×/sección | ✓ VERIFIED | `:442-447` |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `ficha-header.tsx` | `AutoresList` | `iniciativa={proyecto.iniciativa}` | ✓ WIRED | `:57` |
| `page.tsx` LobbySectionConCamara | `parlamentario_publico` → LobbySection | RPC allowlisted → prop `camara` | ✓ WIRED | `:337`→`:349`, throw-on-error `:341` |
| `agenda/page.tsx` throws | `agenda/error.tsx` | boundary captura throw server | ✓ WIRED | boundary creado en Plan 03; throws en Plan 05 |
| `patrimonio-de-parlamentario.tsx` | `fechaCortaSegura` | import `@/lib/format` (Plan 01) | ✓ WIRED | `:16` import, `:384`/`:608` uso |
| `provenance-badge.tsx` | `esStale` | default 14d propaga sin tocar call-site | ✓ WIRED | fuente sin cambios; default nuevo aplica |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| tsc build limpio | `pnpm --filter app exec tsc -b` | exit 0 | ✓ PASS |
| Suite completa | `pnpm --filter app test` | 400 passed / 43 files | ✓ PASS |
| Lockdown guard | (dentro de la suite) | `lockdown-guard.test.ts` 7/7 | ✓ PASS |
| Alcance del diff | `git diff-tree` 14 commits de código | 24 archivos, 100% bajo `app/` | ✓ PASS |

### Requirements Coverage

Los bugs del diagnóstico (B1,B6,B7,B8,B9,B10,B12,B14,B15,B17,HS) no mapean a REQ-* nuevo (fase de fixes). Todos cubiertos por los 12 SC arriba.

### Anti-Patterns Found

Ninguno. Cero `TODO`/`FIXME`/`XXX` en los archivos tocados; cero returns vacíos hollow; el único `return null` (camara-chip) es el fix intencional B8 (omitir chip), no un stub. `voto-ficha-row.tsx` (dead code) deliberadamente NO tocado.

### Human Verification Required

Ninguno bloqueante para el goal de la fase. El único pendiente es el **deploy F45+F46+F50** (Docker Linux + wrangler; creds Cloudflare no en `.env`) — checkpoint operador único compartido, explícitamente FUERA del boundary de esta fase (goal: "sin deploy"). El render visual en vivo ("Jueves, 2 de julio", chip omitido, pill navegable) queda 100% cubierto por lógica unit-testeada; su confirmación en el navegador ocurre tras ese deploy operador. No cuenta como gap.

### Gaps Summary

Sin gaps. Los 12 success criteria del ROADMAP están verificados contra el código (no contra los SUMMARYs): strings confirmados por grep, ramas de render leídas directamente, wiring de props/RPC trazado, y suite completa + tsc + lockdown ejecutados por el verificador (400/400 verde, exit 0, 7/7). El alcance del diff (24 archivos, todos bajo `app/`) confirma Camino A intacto: cero RPC nueva, cero `.from()` PII, cero DDL, cero flag flipeado.

---

_Verified: 2026-07-02T19:20:00Z_
_Verifier: Claude (gsd-verifier)_
