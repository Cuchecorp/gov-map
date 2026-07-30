---
phase: 113
slug: inv-inventario-rector-de-superficies
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-27
---

# Phase 113 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (suite existente app ~1418 + packages ~1310) — esta fase NO produce código; la validación es checklist + validador Opus |
| **Config file** | `app/vitest.config.ts` (existente; no se toca) |
| **Quick run command** | Script checklist rutas-vs-filesystem (Wave 0, bash inline) |
| **Full suite command** | `pnpm test` (no-regresión, una vez) |
| **Estimated runtime** | checklist < 2 s; suite completa ~minutos |

---

## Sampling Rate

- **After every task commit:** Correr el script checklist rutas-vs-filesystem (< 2 s)
- **After every plan wave:** Re-correr checklist completo (rutas + tablas + builders + sujetos + cobertura)
- **Before `/gsd:verify-work`:** Validador Opus con los 7 criterios de aceptación (gate de fase) + suite existente verde
- **Max feedback latency:** ~120 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| rutas-completas | TBD | 1 | LINK-01 | — | Las 15 rutas del filesystem tienen sección | checklist | `for r in $(find app/app -name page.tsx); do grep -q "$(dirname ${r#app/app})" 113-INVENTARIO.md \|\| echo "FALTA $r"; done` | ❌ Wave 0 | pending |
| tablas-por-ruta | TBD | 1 | LINK-01 | — | Toda sección de ruta tiene las 3 tablas (internos/externos/fechas) | checklist | contar headers por sección | ❌ Wave 0 | pending |
| builders-citados | TBD | 1 | LINK-01 | — | Los 4 builders de URL externa citados con plantilla verbatim | grep | `grep -q "buildSenadoUrl" 113-INVENTARIO.md` (×4) | ❌ Wave 0 | pending |
| sujetos-sql | TBD | 1 | LINK-01 | — | 5 sujetos con query verbatim + resultado + URL PROD | grep | `grep -c '\`\`\`sql' 113-INVENTARIO.md` ≥ 5 | ❌ Wave 0 | pending |
| cobertura-declarada | TBD | 1 | LINK-01 | — | Tabla método×cobertura sin celdas vacías | grep | `grep -q "Cobertura" 113-INVENTARIO.md` | ❌ Wave 0 | pending |
| completitud-sustantiva | TBD | final | LINK-01 | — | Inventario completo según los 7 criterios | validador Opus | manual-only (gate de fase) | — | pending |

---

## Criterios de aceptación del validador Opus (gate de cierre)

1. **Rutas:** las 15 de `find` están; `/admin/revisar-entidades` EXCLUIDA con razón; `/cuenta` y `/notificaciones/*` marcadas por naturaleza; las 4 `not-found.tsx` apendizadas.
2. **Links internos:** toda plantilla `href="/..."` del catálogo aparece en al menos una ruta; chrome inventariado una vez y referenciado.
3. **Links externos:** 4 builders citados con plantilla verbatim; toda familia de URL-desde-columna declarada con su columna; `safeExternalHref` declarado como chokepoint; clasificación por fuente completa.
4. **Fechas:** toda fecha lleva formatter + origen (`RPC.campo` o `tabla.columna`); las que van por `capturedAt`/`ProvenanceBadge` MARCADAS como `fecha_captura`; nombres de RPC/tabla dentro de las listas cerradas del research.
5. **Sujetos:** 5 sujetos con query verbatim + resultado inline + URL PROD + `ORDER BY` con desempate; ancla temporal y deploy declarados; PK bio en formato string.
6. **Cobertura:** tabla método×ruta sin celdas vacías; límite "links externos desde columnas" declarado; cero rutas sin evidencia.
7. **Régimen:** el documento no corrige nada; `fecha_captura` jamás presentada como el hecho; ninguna URL de conexión impresa.

## Wave 0 Gaps

- [ ] Script de checklist rutas-vs-filesystem (bash, inline en el plan) — cubre LINK-01
- [x] Framework: ninguno nuevo (entregable documental)
