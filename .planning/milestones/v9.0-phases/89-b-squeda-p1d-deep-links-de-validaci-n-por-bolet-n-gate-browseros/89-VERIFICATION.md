---
phase: 89-b-squeda-p1d-deep-links-de-validaci-n-por-bolet-n-gate-browseros
verified: 2026-07-22T02:26:00Z
status: passed
score: 3/3 success criteria verified (11/11 plan must-haves)
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
---

# Phase 89: Deep-links de validación por boletín + gate BrowserOS — Verification Report

**Phase Goal:** Que cada ficha de boletín lleve al ciudadano al punto PRECISO de la fuente oficial para validar el dato — respaldo de trazabilidad, no solo un enlace genérico.
**Verified:** 2026-07-22T02:26:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + PLAN must_haves)

| #   | Truth (Success Criterion) | Status | Evidence |
| --- | ------------------------- | ------ | -------- |
| SC-1 (TRACE-01) | Cada ficha lleva deep-link PRECISO: Senado (`boletin_ini`), Cámara (`prmID`+`prmBOLETIN`, requiere persistir `prmID`), BCN (`idNorma`) | ✓ VERIFIED | `validacion-fuente.tsx` construye Senado SIEMPRE (`buildSenadoUrl`, boletín completo con sufijo), Cámara SOLO si `prm_id_camara != null` (`buildCamaraUrl` prmID+prmBOLETIN), BCN OMITIDO del DOM sin placeholder (líneas 143-144). Columna `prm_id_camara` persistida vía migración 0058 + parser `parseCamaraLegislativo` que ahora emite `{boletin, prmId}` (antes descartaba `<Id>`). `safeExternalHref` aplicado a TODO href externo (líneas 85-86). Cobertura backfill 2549/3659 (69.7%) declarada honesta. |
| SC-2 (TRACE-02) | Deep-links validados EMPÍRICAMENTE (HTTP 200 + content-match); nunca buildId/URLs de sesión; veredicto BrowserOS "valida el dato" | ✓ VERIFIED | `scripts/validar-deeplinks.mjs` corrido en el gate: 12/12 Senado HTTP 200 + match:true (89-BROWSEROS-GATE.md §c). Cámara 16572-06 (prmID=17140) verificado curl HTTP 200. Ninguna URL usa buildId/sesión — hosts fijos + `encodeURIComponent`. Gate BrowserOS 7/7 puntos PASS con 5 screenshots reales en disco (7KB-127KB). |
| SC-3 (TRACE-03) | Fecha de captura visible junto al link + acceso a snapshot R2 ("esto decía la fuente ese día") | ✓ VERIFIED | `validacion-fuente.tsx` muestra "según fuente al {fecha}" (formatFechaCaptura) + bloque Respaldo con fecha+hash abreviado (12 chars) + leyenda "Esto decía la fuente ese día", SIN href de descarga; allowlist de prefijo `tramitacion/` (`esR2PathPermitido`, T-89-06). Wiring en page.tsx vía `leerSourceSnapshot` (read directo service_role, no RPC). Tests confirman omisión con prefijo `infoprobidad/`. |

**Score:** 3/3 success criteria verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `supabase/migrations/0058_proyecto_prm_id_camara.sql` | Columna aditiva SIN grant nuevo | ✓ VERIFIED | `add column if not exists prm_id_camara text` + comment; sin `grant to anon` (no muerde lockdown-guard Block A). |
| `packages/tramitacion/src/parse-camara-legislativo.ts` | Parser emite `{boletin, prmId}` | ✓ VERIFIED | Interface `CamaraProyectoPar {boletin, prmId}`; `out.push({ boletin: bol, prmId: parsed.data.Id ?? null })`. Fail-soft preservado. 8 tests pass. |
| `packages/tramitacion/src/run-backfill-prmid-cli.ts` | CLI LOCAL dos-etapas reanudable | ✓ VERIFIED | Etapa 1 `r2.putImmutable` (crudo XML content-addressed) ANTES del parse; Etapa 2 `sb.from('proyecto').update({prm_id_camara}).eq('boletin')` solo filas existentes + prmId!=null. Rate-limit vía CamaraConnector. Secretos solo de .env. |
| `app/components/validacion-fuente.tsx` | Sección deep-links + fecha + respaldo R2 | ✓ VERIFIED | 211 líneas; Senado/Cámara/BCN fail-honest; safeExternalHref; allowlist R2; sin href de descarga. |
| `app/components/validacion-fuente.test.tsx` | Tests TRACE-01/03 | ✓ VERIFIED | 9 tests: Senado SIEMPRE, Cámara condicional, BCN nunca, allowlist tramitacion/*, rechazo infoprobidad/, guard XSS. |
| `scripts/validar-deeplinks.mjs` | Validación curl 200 + content-match | ✓ VERIFIED | 200 líneas; curl-first Cámara, -sL Senado, sleep 3s, UA identificatorio, muestra ≥10; nunca buildId. |
| `89-BROWSEROS-GATE.md` | Registro del gate | ✓ VERIFIED | URL deploy 9e15ebbd, 12/12 curl, veredicto PASS 7/7, screenshots, 2 bugs corregidos, cobertura 2549/3659, deuda documentada. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `page.tsx` | `ValidacionFuenteSection` | Suspense sibling + rail entry | ✓ WIRED | Import línea 26-27; `ValidacionFuenteServerSection` bajo `<Suspense>` línea 221; rail +1 entry (RailSkeleton nEntries). |
| `validacion-fuente.tsx` | `safeExternalHref` | Guard en href externo | ✓ WIRED | Import línea 15; aplicado a senadoUrl+camaraUrl (85-86). Export confirmado en lib/utils.ts:15. |
| `page.tsx` | `source_snapshot` | Read directo service_role (no RPC) | ✓ WIRED | `leerSourceSnapshot` → `.from("source_snapshot")` línea 606, error real se lanza (honest-error #34). |
| `connector-camara.ts` | R2Store.putImmutable | Etapa 1 crudo antes de parse | ✓ WIRED | `enumerarProyectosConIdXAnno` callback → `r2.putImmutable("camara-legislativo",...)`. |
| `run-backfill-prmid-cli.ts` | `proyecto.prm_id_camara` | update().eq('boletin') | ✓ WIRED | Línea 204-207. |
| deploy Cloudflare | workers.dev | Docker build + wrangler | ✓ WIRED | Version 9e15ebbd-... LIVE (89-03-SUMMARY.md:37,88 + gate). |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| App test suite | `cd app && pnpm test` | 1070 passed (85 files) | ✓ PASS |
| Typecheck | `cd app && pnpm exec tsc --noEmit` | exit 0 | ✓ PASS |
| Tramitacion tests (parser+backfill) | `pnpm --filter @obs/tramitacion test` | 171 passed (18 files) | ✓ PASS |
| Deep-link empirical validation | `node scripts/validar-deeplinks.mjs` (gate) | 12/12 Senado HTTP 200 + match:true | ✓ PASS (via gate evidence) |
| NEXT_REDIRECT re-throw fix | buscar.test.ts | redirect BOLETIN_RE → NEXT_REDIRECT (líneas 59-74) | ✓ PASS |
| renderRow RSC serialization fix | buscar/page.tsx:214,247 + coverage.test.tsx | card data embebido serializable | ✓ PASS |

### Screenshot Evidence (gate BrowserOS)

| File | Size | Status |
| ---- | ---- | ------ |
| 01-buscar-datos-personales-desktop.png | 120040 B | ✓ real |
| 02-buscar-boletin-punteado-redirect.png | 126952 B | ✓ real |
| 03-ficha-16572-06-valida-en-fuente-desktop.png | 97399 B | ✓ real |
| 04-buscar-mobile-390px-constrained.png | 63299 B | ✓ real |
| 04-buscar-mobile-390px.png | 7513 B | ✓ real |

All screenshots exist on disk with non-zero size — not fabricated references.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| TRACE-01 | 89-01, 89-02 | Deep-link preciso por fuente | ✓ SATISFIED | Migración 0058 + parser prmId + UI fail-honest Senado/Cámara/BCN |
| TRACE-02 | 89-02, 89-03 | Validación empírica HTTP 200 + content-match, gate BrowserOS | ✓ SATISFIED | 12/12 curl + gate 7/7 PASS, sin buildId/sesión |
| TRACE-03 | 89-02 | Fecha captura visible + respaldo R2 | ✓ SATISFIED | según-fuente-al + respaldo hash allowlist tramitacion/* |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| validacion-fuente.tsx | 84,143 | "TODO" (Spanish "todo"=every) / "sin placeholder" | ℹ️ Info | Falsos positivos — español, no debt markers. BCN comment afirma explícitamente que NO hay placeholder. |

No debt markers (TBD/FIXME/XXX). No stub returns. No hardcoded-empty rendering (Cámara null → fila omitida es fail-honest intencional, cubierto por test). No console.log-only implementations.

### Deuda documentada (no bloqueante)

- prmID backfill: `MUESTRA_DEFAULT` usa prmId=null → validar-deeplinks no prueba Cámara automáticamente; Cámara verificada manualmente + backfill PROD 2549/3659 corrido. Re-verificación links Cámara automática = deuda documentada en gate.
- mobile screenshot vía CSS constraint (X-Frame-Options: DENY bloquea iframe) — limitación de tooling, no del producto.
- Senado timeout transient (retry inmediato OK) — deuda 95/96 documentada.

### Gaps Summary

Ninguno. Los 3 success criteria del ROADMAP y las 11 must_haves de los 3 planes están verificadas en el código, tests y evidencia del gate. El deploy pasada 1 (87 híbrida ON + 88 filtros + 89 validación) está LIVE en version 9e15ebbd con gate BrowserOS PASS 7/7 y screenshots reales. Los dos bugs de deploy (renderRow RSC no-serializable, NEXT_REDIRECT capturado por try/catch) están corregidos con tests que los cubren (coverage.test.tsx + buscar.test.ts). Suite 1070 + tramitacion 171 verde, tsc exit 0.

---

_Verified: 2026-07-22T02:26:00Z_
_Verifier: Claude (gsd-verifier)_
