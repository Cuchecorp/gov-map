---
phase: 51-leg2-legibilidad-profunda
verified: 2026-07-03T00:00:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification: []
operator_checkpoints:  # Documented operator debt — NOT phase gaps (mirror 0028/0041)
  - item: "Aplicar 0047_rebeldias_honestas.sql a PROD por psql --db-url (51-01 Task 4)"
    why: "RPC vive en Postgres PROD; tsc/vitest no prueban que Postgres ejecutó el drop+recreate. Consumidor degrada honesto pre-apply (titulo null → fallback boletín). Explícitamente diferido, patrón LOCKED."
    steps: "psql -f 0047 + psql -f test 0047 (verde) + insert schema_migrations '0047'"
  - item: "Deploy Cloudflare (build OpenNext Docker Linux + wrangler)"
    why: "Checkpoint operador fuera de fase; hace visibles los cambios de UI en el sitio."
---

# Phase 51: LEG2 — Legibilidad profunda Verification Report

**Phase Goal:** Ejecutar las propuestas anti-sobrecarga del diagnóstico (§2): que la ficha de parlamentario y la ficha de proyecto se lean en minutos sin perder un solo dato ni violar la doctrina anti-insinuación. El volumen repetitivo se agrega y colapsa; el detalle queda a un clic, server-driven.
**Verified:** 2026-07-03
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria SC1..SC9)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | Votos agregados por proyecto: UNA línea-resumen (conteos + rango) con líneas individuales bajo "ver detalle" | ✓ VERIFIED | `votos-por-parlamentario.tsx`: `resumenDeArco` (:207), `ResumenLinea` (:291) "Votó en {N} ocasiones… entre {mesInicio} y {mesFin}", `ProyectoGrupo` muestra solo resumen por defecto (:430), expande con `?votosVer` (:351,435). Chip "Presente en N de M" en header (`parlamentario-resumen.tsx:73-77`) + "Período" (`parlamentario-header.tsx:58-61`) cierran §2.1. |
| SC2 | Timeline dos niveles + "¿dónde está hoy?": bloque estado actual, hitos siempre visibles, urgencias colapsadas | ✓ VERIFIED | `estado-actual-block.tsx`: `derivarEstadoActual` (:72) 3 líneas con omisión honesta, RSC "¿Dónde está hoy?" (:124), cableado primer elemento tras header (`page.tsx:62`). `timeline-view.tsx`: `esEventoUrgencia` (:40) / `paresDeUrgencia` (:145), colapso ≥2 mismo tipo, "Urgencia {tipo} renovada {N} veces" (:170), expand `?urgencias` (:160). |
| SC3 | Patrimonio tarjeta-resumen (B3): tarjeta con conteos, detalle server-driven, sin URIs CPLT, jamás `<dl>` inline | ✓ VERIFIED | `patrimonio-de-parlamentario.tsx`: `esUriCplt` (:312) filtra `^https?://` en `paresDeContenido` (:344) y `camposVisibles` (:430); tarjeta con conteos desde `seriePatrimonio([version])[0]` (:421); `<dl>`/detalle solo bajo `?ver=` . |
| SC4 | Comparador cableado (B4): UI para dos versiones (no solo deep-link), copy no contradictorio | ✓ VERIFIED | `<form method="get">` (:666) con dos selects (name a/b) + botón "Comparar" (:705), label "Elige dos fechas para comparar" (:671). Con <2 versiones el form se omite y queda hecho neutro (:640). Compat `?comparar=A,B` conservada. |
| SC5 | Rebeldías honestas (B5): ausencias excluidas, título hidratado, dedupe por votación | ✓ VERIFIED | `0047_rebeldias_honestas.sql`: `drop function` (:38), `security definer set search_path=''` (:45), 2× `seleccion <> 'ausente'` (:56,67), `distinct on (votacion_id)` (:59), `left join proyecto` para titulo (:64), `revoke all`+`grant execute to anon` (:78-79). Consumidor `votos-por-parlamentario.tsx` usa `r.titulo` (:683-688); `RebeldiaRow` extendido (`types.ts:222-226`). Guard `anonGrantOffenders` (:193) exime por-sentencia solo allowlisted. |
| SC6 | Lobby agrupado por contraparte: "con quién se reúne más" + cronológico, caveat 1×/sección | ✓ VERIFIED | `lobby-de-parlamentario.tsx`: `agruparPorContraparte` (:110) freq DESC = default (:579), `normalizarVista` (:153) + toggle `?vista=cronologica` (:215,541), `CaveatIdentidad` 1× (:252,326), `IdentityMarker` por fila removido, contraparte verbatim nunca enlazada. |
| SC7 | Provenance por sección donde había 100+ badges idénticos, sin perder trazabilidad | ✓ VERIFIED | `timeline-event.tsx`: `ProvenanceBadge` por-evento RETIRADO (0 import/uso; solo comentarios :9-13), link "Ver fuente oficial ↗" conservado por evento (:48). UN `ProvenanceBadge` en heading de `TimelineSection` (`page.tsx:195,210`). |
| SC8 | Footer global: CC BY 4.0, metodología, fuentes, contacto en toda página | ✓ VERIFIED | `app/layout.tsx`: `<footer>` tras children (:49), "CC BY 4.0" (:63), links `/metodologia` (:71) `/sobre` (:77) + `mailto` contacto (:83). `app/metodologia/page.tsx` existe (h1 "Metodología" :22); `/sobre` existe. Scope-caveat: ChileCompra/SERVEL solo en comentario, no en footer render. |
| SC9 | Suite verde + tsc limpio + lockdown-guard verde; anti-insinuación intacta (negative-match) | ✓ VERIFIED | Orchestrator re-ran: suite app/ **486/486 verde**, `tsc -b` exit 0. Guard refinado (per-sentencia, deny-by-default intacto). Anti-insinuación: mt-12 frontier LOCKED intacta (`parlamentario/[id]/page.tsx`), 0 debt markers en archivos tocados, banned-vocab negative-match tests presentes (votos/patrimonio/estado-actual/resumen). |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/components/votos-por-parlamentario.tsx` | resumen por arco + ?votosVer + rebeldías título | ✓ VERIFIED | resumenDeArco/ResumenLinea/buildVotosVerHref present + wired |
| `app/components/voto-ficha-row.tsx` | dead code B24 removido | ✓ VERIFIED | 0 matches de "no disponible aún" |
| `app/lib/types.ts` | RebeldiaRow +titulo/etapa | ✓ VERIFIED | :222-226 contrato de 7 columnas 0047 |
| `app/components/patrimonio-de-parlamentario.tsx` | esUriCplt + tarjeta + form GET | ✓ VERIFIED | esUriCplt/seriePatrimonio/method=get present |
| `app/components/lobby-de-parlamentario.tsx` | agrupación + toggle + caveat 1× | ✓ VERIFIED | agruparPorContraparte/normalizarVista/CaveatIdentidad present |
| `app/components/estado-actual-block.tsx` | RSC "¿Dónde está hoy?" | ✓ VERIFIED | derivarEstadoActual + omisión honesta, no "use client" |
| `app/components/timeline-view.tsx` | 2 niveles + colapso urgencias | ✓ VERIFIED | esEventoUrgencia/paresDeUrgencia/?urgencias present |
| `app/components/timeline-event.tsx` | badge por-evento removido | ✓ VERIFIED | 0 ProvenanceBadge import/uso; link fuente conservado |
| `app/components/parlamentario-header.tsx` | Período (Mono) | ✓ VERIFIED | :58-61 omitido si null; sin PII |
| `app/lib/parlamentario-resumen-conteos.ts` | asistencia derivada | ✓ VERIFIED | Asistencia interface + derivación misma lectura React.cache |
| `app/app/layout.tsx` | footer global CC BY | ✓ VERIFIED | footer + links + gate PUBLIC_INDEXABLE intacto |
| `app/app/metodologia/page.tsx` | página mínima honesta | ✓ VERIFIED | existe con h1 Metodología |
| `app/app/proyecto/[boletin]/page.tsx` | wiring EstadoActualBlock + 1 badge | ✓ VERIFIED | import + render + TimelineSection badge |
| `app/lib/lockdown-guard.test.ts` | guard refinado por-sentencia | ✓ VERIFIED | anonGrantOffenders exime solo grant execute de allowlisted |
| `supabase/migrations/0047_rebeldias_honestas.sql` | drop+recreate honesto | ✓ VERIFIED | todos los patrones presentes (apply a PROD = operador) |
| `supabase/tests/0047_rebeldias_honestas.test.sql` | pgTAP acompañante | ✓ VERIFIED | archivo en disco (6.3KB) |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| votos-por-parlamentario.tsx | ?votosVer | buildVotosVerHref (:242) | ✓ WIRED |
| votos-por-parlamentario.tsx | RebeldiaRow.titulo | consumidor VotosView (:683) | ✓ WIRED |
| patrimonio-de-parlamentario.tsx | seriePatrimonio | conteos tarjeta (:421) | ✓ WIRED |
| patrimonio-de-parlamentario.tsx | ?a/?b/?comparar | form method=get (:666) | ✓ WIRED |
| lobby-de-parlamentario.tsx | ?vista | toggle server-driven (:215,541) | ✓ WIRED |
| page.tsx | estado-actual-block.tsx | primer elemento tras header (:62) | ✓ WIRED |
| timeline-view.tsx | ?urgencias | expand server-driven (:160) | ✓ WIRED |
| layout.tsx | /metodologia | link footer (:71) | ✓ WIRED |
| parlamentario-resumen.tsx | contarCarriles asistencia | derivada de filas cacheadas (:169) | ✓ WIRED |
| 0047 migration | PUBLIC_RPC_ALLOWLIST | rebeldias ya en lista | ✓ WIRED |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| — | debt markers (TBD/FIXME/XXX) | — | 0 en archivos tocados |
| — | dead code B24 "no disponible aún" | — | 0 matches (removido) |
| — | ProvenanceBadge por-evento (SC7) | — | 0 import/uso en timeline-event |

Ninguna anti-pattern bloqueante. Anti-insinuación intacta: mt-12 frontier LOCKED, honest-state 1×/sección, cero composición dinero/lobby+voto, banned-vocab negative-match, deny-by-default del guard preservado (refinamiento SOLO por-sentencia allowlisted).

### Requirements Coverage

| Requirement | Description | Status |
|-------------|-------------|--------|
| LEG2 / SC1..SC9 | Legibilidad profunda (extiende LEG-01..03) | ✓ SATISFIED — 9/9 SC verificados en código |

### Operator Checkpoints (documented debt — NOT gaps)

| # | Item | Why deferred |
|---|------|-------------|
| 1 | Aplicar `0047_rebeldias_honestas.sql` a PROD (`psql --db-url` + pgTAP + schema_migrations) | Patrón LOCKED 0028/0041; agente nunca aplica DDL. Consumidor degrada honesto pre-apply (titulo null → fallback boletín). Autonomía de fase: "construir + testear; deploy = checkpoint operador". |
| 2 | Deploy Cloudflare (OpenNext Docker Linux + wrangler) | Checkpoint operador fuera de fase; hace visibles los cambios de UI. |

Estos NO son gaps: el objetivo de fase (legibilidad entregada en el código, sin pérdida de dato, doctrina intacta) está logrado y verificable en el codebase. El apply/deploy son deuda de operador registrada, idéntica a fases previas.

### Gaps Summary

Ninguno. Los 9 success criteria del ROADMAP están implementados, substantivos y cableados en el código; suite 486/486 verde y `tsc -b` limpio (re-run del orquestador). Los únicos items pendientes son los dos checkpoints de operador (apply 0047 + deploy Cloudflare), diferidos explícitamente por la autonomía de la fase y el patrón LOCKED — deuda de operador, no gaps de fase.

---

_Verified: 2026-07-03_
_Verifier: Claude (gsd-verifier)_
