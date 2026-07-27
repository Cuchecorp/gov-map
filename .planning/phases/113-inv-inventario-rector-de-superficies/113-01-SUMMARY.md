---
phase: 113
plan: 01
subsystem: planning-artifacts
tags: [inventario, auditoria, superficies, sujetos-deterministas, feature-gates]
requires: []
provides:
  - "113-INVENTARIO.md §0 (método/cobertura/baseline), §1 (5 sujetos deterministas), §5 (gates observados)"
  - "check-inventario.sh (checklist re-ejecutable, STRICT=0|1)"
  - "Sujetos deterministas D1165, S1338, 14309-04, 17870-05 para 114/115/116/122/125"
  - "Estado observado de los 5 feature-gates en el deploy vivo (cierra assumption A1)"
affects: [114, 115, 116, 122, 125]
tech-stack:
  added: []
  patterns: ["psql read-only vía `set -a; source .env; set +a`", "curl+grep como observación de gates sin BrowserOS", "grep -qF literal para rutas con [id]/[boletin]"]
key-files:
  created:
    - .planning/phases/113-inv-inventario-rector-de-superficies/113-INVENTARIO.md
    - .planning/phases/113-inv-inventario-rector-de-superficies/check-inventario.sh
  modified: []
decisions:
  - "Deploy auditado se ancla por fecha/hora de observación: Cloudflare no expone id de versión en headers"
  - "Sujeto contraparte NO elegido (degradación honesta): contrato y aporte con 0 filas + ruta gated MONEY"
  - "Los 5 gates se observaron por curl+grep contra el deploy vivo, no se copiaron de STATE"
metrics:
  duration: ~45 min
  completed: 2026-07-27
---

# Phase 113 Plan 01: Fundación del inventario rector Summary

Inventario rector fundado con método declarado re-ejecutable, 5 sujetos deterministas elegidos por
SQL contra PROD (con desempate estable) y el estado REAL de los 5 feature-gates observado
empíricamente contra el deploy vivo — no copiado de STATE.

## Qué se construyó

**`113-INVENTARIO.md`** — 6 secciones LOCKED del research; §2/§3/§4 quedan como headers-placeholder
para los Planes 02/03/04.

- **§0 Método y cobertura:** régimen declarado (análisis de CÓDIGO, la fase **no corrige**,
  read-only sobre PROD, cero requests a fuentes gubernamentales ⇒ rate-limit 2-3 s no aplica, cero
  PII, jamás se imprime el valor de `SUPABASE_DB_URL`); comandos verbatim re-ejecutables (rutas,
  `not-found.tsx`, emisores de links, formatters de fecha, `ProvenanceBadge`/`sourceUrl`, `.rpc(` y
  `.from(`); **`find app/app -name "route.ts"` → `0`** registrado como *evidencia por vacío* que
  cierra la decisión LOCKED "route handlers no son superficies"; el **límite del método** (los links
  externos vienen mayoritariamente de columnas de la DB, no de TSX); placeholder de la Tabla D; y el
  **baseline de suite pre-fase**.
- **§1 Sujetos deterministas:** 5 bloques SQL con query verbatim + resultado comentado inline + URL
  PROD + expectativa declarada, replicando el molde 93-02.
- **§5 Gates y su estado:** tabla de 5 filas con chokepoint `archivo:línea`, estado observado y
  evidencia (comando + resultado), más la convención LOCKED de la columna `gate`.

**`check-inventario.sh`** — 5 checks (rutas `page.tsx`, `not-found.tsx`, 4 builders, ≥5 bloques SQL,
Cobertura). Usa `grep -qF --` literal porque `[id]`/`[boletin]` son clases de carácter en BRE; la
ruta `/` se resuelve por su header de sección. `STRICT=0` (waves 2-4) reporta sin fallar;
`STRICT=1` (Plan 05) falla ante cualquier falta. Corre en ~2,8 s.

## Hallazgos sustantivos

| Hallazgo | Evidencia | Impacto |
|----------|-----------|---------|
| **Cero `route.ts` bajo `app/app`** | `find app/app -name "route.ts" \| wc -l` → 0 | La decisión "route handlers no son superficies" queda cerrada por vacío, no por suposición |
| **El mejor senador de PROD tiene 0 lobby y 0 cruces** | `S1338`: `n_lobby=0`, `n_cruces=0` | No es bug de wiring: `lobby_audiencia` confirmado es hoy exclusivo de diputados. `S1338` sirve como sujeto de **estados vacíos honestos** |
| **`contrato` y `aporte` tienen 0 filas en PROD** | `select count(*)` → 0 y 0 | No existe ninguna contraparte real que elegir; el sujeto se degradó honestamente en vez de inventarse |
| **`/contraparte/[id]` 404ea entera** | `curl` → 404; `page.tsx:50-52` gatea como PRIMERA sentencia | 114/116/122/125 no deben perseguir links ni fechas de esa ruta |
| **Los 4 gates de STATE se confirmaron; el deploy no se puede anclar por hash** | headers solo dan `x-opennext: 1` / `server: cloudflare` | El inventario ancla por fecha/hora de observación (2026-07-27 23:04 UTC) |
| **Ambos boletines-sujeto tienen `enlace` = `tramitacion.senado.cl/wspublico/...`** | `split_part(enlace,'/',4)` → `wspublico` | Ejercitan el rewrite de `enlaceHumanoProyecto`; el inventario registra el link **post-rewrite** |

## Sujetos deterministas elegidos

| # | Sujeto | Id | Riqueza observada | URL PROD |
|---|--------|----|-------------------|----------|
| A | Diputado | `D1165` | 6/6 bloques: 3.752 votos, 112 lobby, 6 patrimonio, 11 cruces, 2 comisiones, 2 militancias | `/parlamentario/D1165` |
| B | Senador | `S1338` | 3 bloques: 949 votos, 9 patrimonio, 1 militancia (0 lobby / 0 cruces / 0 comisiones) | `/parlamentario/S1338` |
| C | Boletín bicameral | `14309-04` | 7 votaciones, 1 embedding, **47 cruces**, `prm_id_camara=14891` | `/proyecto/14309-04` |
| D | Boletín solo-Senado | `17870-05` | 256 votaciones, 355 eventos, sin `prm_id_camara` (1 de 1.110) | `/proyecto/17870-05` |
| E | Contraparte | **no elegida** | `contrato`=0, `aporte`=0 + ruta gated MONEY | `no emitido en el deploy auditado` |

Todas las queries llevan desempate estable por PK; los `max(fecha)` filtran `fecha <= current_date`
(PROD tiene filas corruptas como `2626-05-25`).

## Estado observado de los gates (cierra assumption A1)

| Gate | Estado | Evidencia sintética |
|------|--------|---------------------|
| NET | **ON** | `href="/red"` en `/` (1 ocurrencia); `/red` → 200 |
| CRUCES | **ON** | `<section id="cruces">` presente en `/proyecto/14309-04` y `/parlamentario/D1165` |
| VSIM | **ON** | `<h2>Similitud de votación</h2>` con `1054 de 3609 votaciones compartidas (29%)` |
| MONEY | **OFF** | `/contraparte/...` → 404; 0 hrefs `/contraparte/` en ambas fichas; `section#financiamiento-pendiente` con `count: "pendiente"` |
| NOTIF | **OFF** | `SeguirButton` ausente del DOM (`grep -oic 'Seguir'` → 0) |

Los 5 gates son server-only (sin `NEXT_PUBLIC_`, con `import "server-only"`, fail-closed a
`=== "true"`). Ninguno quedó `indeterminado`.

## Baseline de suite (pre-fase, 2026-07-27)

| Workspace | Test files | Tests passed | Skipped |
|-----------|-----------:|-------------:|--------:|
| `app` | 107 | 1428 | 0 |
| `packages/*` (18) | 176 | 1535 | 11 |
| **Total** | **283** | **2963** | 11 |

`pnpm test` exit 0. El Plan 05 compara contra estos números observados.

## Deviations from Plan

**1. [Rule 3 - Blocking] Matching de la ruta `/` por regex del header en vez del literal `### 4.4 /`**
- **Found during:** Task 1
- **Issue:** el plan prescribía buscar la cadena literal `### 4.4 /`, lo que acopla el script a una
  numeración que todavía no escribe nadie (§4 la escriben los Planes 02/03/04). Si esos planes
  numeran distinto, el check 1 fallaría contra un inventario correcto.
- **Fix:** el caso especial de `/` busca `^### 4\.[0-9]+ /$` (misma intención, resistente a la
  numeración final). El header esperado sigue siendo del tipo `### 4.4 /`.
- **Files modified:** `check-inventario.sh`
- **Commit:** `027c9b8`

**2. [Rule 2 - Correctness] Sujeto E degradado en vez de elegido**
- **Found during:** Task 2
- **Issue:** el plan pedía "1 contraparte con agregados no vacíos". En PROD `contrato` y `aporte`
  tienen 0 filas, y la ruta está gated MONEY (404 completa).
- **Fix:** se aplicó la instrucción explícita de degradación honesta del propio plan
  (`sujetos no elegidos — causa: <X>`), con la query que **prueba** el vacío como bloque SQL nº 5.
  No se inventó ningún id.
- **Commit:** `3e909bb`

**3. [Nota, no deviación] `check-inventario.sh` corre en ~2,8 s, no < 2 s**
- El costo es arranque de procesos en Windows/MSYS (`find` + `grep` por ruta), no algoritmo. Muy por
  debajo del `max feedback latency` de 120 s de 113-VALIDATION.md.

## Threat Flags

Ninguna. La fase es read-only: cero DDL/DML sobre PROD, cero paquetes instalados, cero credenciales
o PII en el artefacto (`grep 'postgres://\|postgresql://\|@aws-\|bctyygbmqcvizyplktuw'` → 0
ocurrencias; solo aparecen *nombres* de columna, nunca valores).

## Verificación

- `bash check-inventario.sh` (STRICT=0) → exit **0**, imprime 5 líneas de check
- `bash -n check-inventario.sh` → exit **0**
- `grep -c '^## ' 113-INVENTARIO.md` → **6**
- `grep -c '```sql' 113-INVENTARIO.md` → **5**
- `grep -c 'net-gate\|cruces-gate\|vsim-gate\|money-gate\|notif-gate'` → **5**
- Cero credenciales, cero `según STATE`, `NEXT_PUBLIC_` solo en la frase que declara su ausencia

## Commits

| Task | Commit | Descripción |
|------|--------|-------------|
| 1 | `027c9b8` | esqueleto + §0 método + `check-inventario.sh` |
| 2 | `3e909bb` | §1 sujetos deterministas por SQL contra PROD |
| 3 | `1c5f0ba` | §5 gates verificados empíricamente contra el deploy vivo |

## Para el Plan 02

- §2 (chrome), §3 (catálogo de emisores) y §4 (las 15 rutas) siguen marcadas `_(pendiente)_`.
- La Tabla D (§0.4) y la resolución de la Open Question 2 (columnas de URL por
  `information_schema.columns`) son trabajo de 02/04.
- Correr `bash check-inventario.sh` con `STRICT=0` tras cada task; el Plan 05 lo corre con
  `STRICT=1`.

## Self-Check: PASSED

- Archivos declarados: 3/3 FOUND
- Commits declarados: 3/3 FOUND (`027c9b8`, `3e909bb`, `1c5f0ba`)
