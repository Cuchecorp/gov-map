---
phase: 113-inv-inventario-rector-de-superficies
verified: 2026-07-27T00:00:00Z
status: passed
score: 21/21 must-haves verified
overrides_applied: 0
---

# Phase 113: INV — Inventario rector de superficies — Verification Report

**Phase Goal:** Existe un artefacto único y exhaustivo que enumera toda ruta pública del sitio con los links que emite y las fechas que muestra, y que alimenta las fases de links, fechas, cruces y la pasada E2E.
**Verified:** 2026-07-27
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP §113 SC1-SC4 + must_haves de los 6 planes)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | Lector ve cada ruta pública sin leer código; dinámicas con sujetos SQL reales | ✓ VERIFIED | §4.1–4.15 = 15 rutas; `find app/app -name page.tsx` → **15** (coincide 1:1). §1.1–1.5 sujetos `D1165`/`S1338`/`14309-04`/`17870-05` + E no-elegible, con SQL verbatim + resultado inline + URL PROD |
| SC2 | Links clasificados int/ext por fuente | ✓ VERIFIED | Tablas A (internos) y B (externos con columna *fuente*: camara/senado/BCN/leylobby/otro) en cada ruta; §3.2 los 4 builders; §3.3 familias URL-desde-columna (34 columnas por catálogo) |
| SC3 | Fechas con columna/RPC de origen, marcadas las de `fecha_captura` | ✓ VERIFIED | Tabla C con columnas fijas *formatter*/*origen*/*¿es fecha_captura?*/*¿vía ProvenanceBadge?*; 63 ocurrencias de `fecha_captura`; regla LOCKED §3.1.1 + bloques "Correspondencia badge ↔ tablas" |
| SC4 | Método y cobertura declarados, cero rutas asumidas | ✓ VERIFIED | §0.2 comandos verbatim; §0.4 Tabla D con **19 filas** (15 rutas + 4 not-found), vocabulario cerrado, sin celdas vacías; §0.4.1 tres límites explícitos |
| P01-a | Método de enumeración con comandos verbatim re-ejecutables | ✓ VERIFIED | §0.2 |
| P01-b | Estado REAL de los 5 feature-gates verificado, no copiado de STATE | ✓ VERIFIED | §5: NET/CRUCES/VSIM ON, MONEY/NOTIF OFF, cada uno con `curl`+grep y chokepoint archivo:línea. `lib/net-gate.ts:37` = `env.NET_PUBLIC_ENABLED === "true"` (cita exacta) |
| P01-c | 5 sujetos deterministas por SQL con ORDER BY desempatado | ✓ VERIFIED | §1.1–1.5; check 4 → 8 bloques ```sql ≥ 5 |
| P01-d | Script de checklist re-ejecutable < 2 s | ✓ VERIFIED | `check-inventario.sh` corrido por el verificador: **exit 0**, 5/5 OK en modo `STRICT=1` |
| P02-a | Chrome compartido inventariado UNA vez, referenciable por id | ✓ VERIFIED | §2 `C-01`..`C-04`; §4 lo referencia por id, no lo repite |
| P02-b | Catálogo de emisores con id estable `E-NNN` | ✓ VERIFIED | §3.0; **60 ids únicos** `E-NNN`; §3.0.1 declara huérfanos con causa |
| P02-c | Emisores con ProvenanceBadge marcados para §3.1 | ✓ VERIFIED | Marcados `**badge** → E-NNN` en tablas B/C |
| P06-a | ProvenanceBadge como chokepoint DUAL con 16 call-sites trazados | ✓ VERIFIED | §3.1; `grep -rl "sourceUrl=" app/components app/app \| wc -l` → **16** (independiente). `provenance-badge.tsx:25,37,62` verificados exactos (`sourceUrl: string \| null`, `safeExternalHref(sourceUrl)`, `href={safeUrl}`) |
| P06-b | 4 builders con plantilla verbatim + `safeExternalHref` como chokepoint | ✓ VERIFIED | `validacion-fuente.tsx:60-62` byte-consistente con §3.2; `buildCamaraUrl:67`, `enlaceHumanoProyecto`, `esR2PathPermitido:46`; `app/lib/utils.ts:15` `safeExternalHref` |
| P06-c | 4 clases de fuente resueltas con host+conteo o cero respaldado | ✓ VERIFIED | §3.3.4 (camara/senado/BCN/leylobby) + §3.3.5 (10 columnas con 0 filas) |
| P03-a | 3 rutas densas con sujeto concreto y 3 tablas | ✓ VERIFIED | §4.1 (20 A / 10 B / 21 C), §4.2, §4.3. Citas muestreadas exactas: `page.tsx:305` `/comparar?a=${id}`, `:328` `/red?seed=${id}`, `ficha-rail.tsx:59` `href={"#" + e.id}` |
| P03-b | Fechas con formatter+origen; `fecha_captura` MARCADAS | ✓ VERIFIED | Ver SC3 |
| P03-c | Externos distinguen builder vs columna | ✓ VERIFIED | Columna *builder o `columna`* poblada en toda Tabla B |
| P03-d | `not-found.tsx` apendizadas como sub-superficie | ✓ VERIFIED | §4.1.b/4.2.b/4.3.b/4.9.b; `find app/app -name not-found.tsx` → **4** (check 2 OK) |
| P04-a | 12 rutas restantes + `/admin/revisar-entidades` EXCLUIDA con razón | ✓ VERIFIED | §4.4–4.15; §4.15 EXCLUIDA con decisión LOCKED + mitigación, y listada para cerrar el denominador |
| P04-b | `/cuenta` y `/notificaciones/*` marcadas por naturaleza | ✓ VERIFIED | §4.12 auth OTP; §4.13/4.14 token-based, sin token inventado |
| P05 | Validador Opus independiente con veredicto registrado + hallazgos cerrados + no-regresión | ✓ VERIFIED | `113-VALIDACION-OPUS.md`: PASS 7/7 con evidencia por criterio; 2 hallazgos no bloqueantes remediados (§4.8, §4.3.c); frontmatter del inventario `estado: validado` |

**Score:** 21/21 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `113-INVENTARIO.md` | §0–§5 completas, estado validado | ✓ VERIFIED | 179 KB, ~1.960 líneas, frontmatter `estado: validado`, `consumido_por: [114,115,116,122,125]` |
| `check-inventario.sh` | Checklist re-ejecutable | ✓ VERIFIED | Ejecutado por el verificador: `STRICT=1` → exit 0, 5/5 OK |
| `113-VALIDACION-OPUS.md` | Veredicto por criterio 1-7 | ✓ VERIFIED | `veredicto: PASS`, tabla con los 7 criterios y evidencia comando→resultado |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| §4 rutas | §3 catálogo | referencia `E-NNN` | ✓ WIRED | 60 ids únicos referenciados desde §4 y desde la Tabla D |
| §0 Tabla D | §4 (19 superficies) | una fila por superficie | ✓ WIRED | 19 filas = 15 `page.tsx` + 4 `not-found.tsx` del filesystem |
| §1 sujetos | PROD Postgres | SQL verbatim + resultado inline | ✓ WIRED | 8 bloques ```sql con ORDER BY desempatado y URL PROD |
| `113-VALIDACION-OPUS.md` | `113-INVENTARIO.md` | veredicto con cita de sección | ✓ WIRED | Cada criterio cita §; el inventario referencia el veredicto en su frontmatter |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Checklist estricto pasa | `STRICT=1 bash check-inventario.sh` | exit 0, 5/5 OK | ✓ PASS |
| Denominador de rutas real | `find app/app -name page.tsx \| wc -l` | 15 | ✓ PASS |
| Denominador de not-found | `find app/app -name not-found.tsx \| wc -l` | 4 | ✓ PASS |
| 16 call-sites de sourceUrl | `grep -rl "sourceUrl=" app/components app/app \| wc -l` | 16 | ✓ PASS |
| Fase no toca código | `git status --porcelain app/ packages/` | vacío | ✓ PASS |
| Higiene: cero credenciales | `grep -cE 'postgres(ql)?://' 113-INVENTARIO.md` | 0 | ✓ PASS |

*No-regresión de la suite:* verificada por invariante — `git status` limpio en `app/` y `packages/`, los 15 commits de la fase son `docs(113-*)` sobre `.planning/` únicamente; no hay superficie de regresión.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LINK-01 | 113-01…06 (los 6) | Inventario rector de superficies (toda ruta pública × links internos y externos) | ✓ SATISFIED | `113-INVENTARIO.md` §0–§5 validado; REQUIREMENTS.md:61 mapea LINK-01 → Phase 113, marcado Complete |

Cero requirement IDs huérfanos: REQUIREMENTS.md mapea a Phase 113 exclusivamente LINK-01, y los 6 planes lo declaran.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `113-INVENTARIO.md` | 1448, 1822, 1869, 1936 | palabra "placeholder" | ℹ️ Info | Falsos positivos: son explicaciones literales (`<token>` es placeholder literal; `prmId=0` NO es placeholder roto; id sintético del gate MONEY). No hay contenido stub |
| `113-INVENTARIO.md` | 245-246, 435, 694 | `\|\|` | ℹ️ Info | Concatenación SQL y OR lógico citados verbatim, no celdas vacías; el propio documento lo declara |

Cero `TBD`/`FIXME`/`XXX`. Cero RUT. Cero URL de conexión.

### Human Verification Required

Ninguna. El gate humano de esta fase (validación Opus independiente) ya se ejecutó y quedó registrado con evidencia re-verificable.

### Gaps Summary

Ninguno. El artefacto rector existe, cierra su denominador contra el filesystem real (19/19 superficies), sus citas `archivo:línea` muestreadas coinciden byte a byte con el código, el checklist estricto pasa re-ejecutado por el verificador, y LINK-01 queda satisfecho y trazado.

---

_Verified: 2026-07-27_
_Verifier: Claude (gsd-verifier)_
