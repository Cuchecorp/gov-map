---
phase: 03-tabla-maestra-parlamentario-identidad-determinista
verified: 2026-06-18T14:00:00Z
status: human_needed
score: 3/3 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Push schema + seed al Supabase REMOTO"
    expected: "pnpm supabase link + db push + carga del seed (186 filas confirmadas) exitosos en el proyecto remoto"
    why_human: "Requiere DB password / PAT sbp_ que no existe en el entorno CI. Paso de operador documentado en docs/operador-fase3.md."
  - test: "Respaldo R2 funcional"
    expected: "El step 'Respaldo a R2' del workflow backup-parlamentario.yml sube el snapshot con exit 0 cuando las credenciales S3 son válidas"
    why_human: "Las credenciales R2 dan 401 en el entorno actual (03-CONTEXT). El workflow está cableado correctamente (flag --r2 parseado, buildR2Target gateado por presencia de las 4 vars), pero solo se puede verificar end-to-end con una credencial S3 válida."
---

# Phase 3: Tabla Maestra Parlamentario + Identidad Determinista — Verification Report

**Phase Goal:** Existe una tabla maestra `Parlamentario` sembrada con revisión humana desde Cámara y Senado (senadores_vigentes.php con PARLID), respaldada fuera de Supabase, con reconciliación determinista que resuelve los matches no ambiguos sin invocar LLM.

**Verified:** 2026-06-18T14:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | La maestra `Parlamentario` está sembrada desde Cámara y Senado con identidades confirmadas por revisión humana, no auto-generadas | VERIFIED | `supabase/seeds/parlamentario.seed.json`: 186 filas (grep cuenta 186 ocurrencias de `"estado": "confirmado"`, 31 de `"camara": "senado"`). Cada fila tiene provenance real (`origen`, `fecha_captura` 2026-06-18, `enlace` a la URL del endpoint gubernamental). La promoción a `confirmado` pasó por el operador-accept principiado (CR-01 resuelto): `vigentesDeCatalogo` + matcher-confirmed allow-list, nunca blanket-confirm. |
| 2 | El sistema reconcilia un registro foráneo por match determinista sin invocar LLM | VERIFIED | `packages/identity/src/deterministic.ts`: `matchDeterminista` es función pura, fail-closed (cada rama confirma solo con `=== 1`), sin red ni DB. Rama RUT exacto (activa para InfoProbidad Fase 4); rama nombre único en `(cámara, periodo)` (activa hoy); desempate WR-01 por `clave_estricta`. Ambigüedad / homónimo / sin-candidato → `no_confirmado`. Cero invocaciones LLM. |
| 3 | La maestra tiene respaldo periódico fuera de Supabase | VERIFIED | Dos capas: (a) `supabase/seeds/parlamentario.seed.json` en git (snapshot 118 KB, determinista, versionado — autoritativo hoy e independiente del free tier); (b) `.github/workflows/backup-parlamentario.yml` con cron semanal (lunes 06:00 UTC) que regenera el snapshot, commitea el diff con `--preserve-estado`, y gatea R2 por presencia de credencial. El workflow preserva la compuerta humana (no usa `--promote`, nunca revierte `confirmado`). |

**Score:** 3/3 truths verified

---

### Deferred Items

Ningún ítem diferido a fases posteriores del milestone.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/identity/src/deterministic.ts` | matchDeterminista fail-closed, sin LLM | VERIFIED | Implementación substantiva: RUT exacto, nombre único en (cámara,periodo), desempate estricto WR-01, fail-closed por construcción (`=== 1` en cada rama). |
| `packages/identity/src/seeder.ts` | runSeeder + upsertMaestra; no auto-confirma | VERIFIED | `runSeeder` reusa `@obs/ingest` (rate-limit, robots, SSRF). Estado inicial `no_confirmado`. `reconciliarMaestra` expone la Resolution como auditoría. `vigentesDeCatalogo` da el allow-list de la compuerta principiada (CR-01). |
| `packages/identity/src/seed-cli.ts` | CLI live end-to-end; --promote principiado; --preserve-estado | VERIFIED | `main` instancia colaboradores reales, corre corrida LIVE, upsert local, exporta snapshot. `--promote` usa allow-list (no blanket). `findWorkspaceRoot` falla cerrado (IN-02). `readEstadoSnapshot` preserva por id + firma de identidad estable (WR-03, IN-03). `--r2` parseado y cableado (WR-02). |
| `supabase/migrations/0005_parlamentario.sql` | DDL parlamentario + RLS deny-by-default | VERIFIED | Tabla `parlamentario` con todas las columnas del modelo, `estado default 'no_confirmado'`, índices únicos parciales, `parlamentario_alias` con FK cascade; RLS habilitada sin policies en ambas tablas. |
| `supabase/seeds/parlamentario.seed.json` | 186 filas reales, estado=confirmado, provenance | VERIFIED | Grep confirma 186 ocurrencias de `"estado": "confirmado"` y 31 de `"camara": "senado"`. Fila de muestra contiene `origen`, `fecha_captura`, `enlace`, `id_diputado_camara`/`parlid_senado`, `nombre_normalizado`. Datos gubernamentales reales capturados live 2026-06-18. |
| `.github/workflows/backup-parlamentario.yml` | Cron semanal; --preserve-estado; R2 gateado | VERIFIED | `on.schedule: cron 0 6 * * 1`. Paso de siembra usa `--preserve-estado` sin `--promote`. Paso R2 con `if: secrets.R2_ACCESS_KEY_ID != ''`. Commitea el diff del snapshot si cambió. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `seed-cli.ts` | `seeder.ts runSeeder` | import + await | WIRED | `main` llama `runSeeder(deps)` con colaboradores reales instanciados |
| `seed-cli.ts` | `writer-supabase.ts SupabaseMaestraWriter` | import + instancia | WIRED | `new SupabaseMaestraWriter({url, serviceKey})` + `upsertMaestra(maestra, writer)` |
| `seed-cli.ts` | `backup.ts exportMaestra` | import + await | WIRED | `exportMaestra(maestra, {writer: fsWriter, r2Enabled, r2})` siempre ejecuta |
| `seeder.ts runSeeder` | `deterministic.ts matchDeterminista` | import + reconciliarMaestra | WIRED | `reconciliarMaestra` corre `matchDeterminista` por fila y devuelve `Map<id, Resolution>`; seed-cli consulta la resolución para el allow-list de promoción fuente (b) |
| `seeder.ts` | `@obs/ingest Fetcher/RobotsGuard/HostRateLimiter` | import + fetchCatalogo | WIRED | `assertAllowedUrl` → `robots.isAllowed` → `rateLimiter.wait` → `fetcher.get` en serie |
| `backup-parlamentario.yml` | `seed-cli.ts` | `pnpm seed:live -- --preserve-estado` | WIRED | El workflow invoca el mismo CLI con la flag correcta; sin `--promote` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `parlamentario.seed.json` | 186 filas Parlamentario | Fetch LIVE Senado XML (31) + Cámara XML (155) capturados 2026-06-18 | Sí — catálogos gubernamentales reales, 0 errores 403/429, tamaños coinciden con 03-RESEARCH | FLOWING |
| `matchDeterminista` | Resolution estado/id | maestra en memoria (186 filas) | Sí — opera sobre el array real de la siembra; testeado con golden sets sobre fixtures reales | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Evidence | Status |
|----------|----------|--------|
| Seed tiene 186 filas todas confirmadas | Grep: 186 hits `"estado": "confirmado"`, 31 hits `"camara": "senado"` en `parlamentario.seed.json` | PASS |
| matchDeterminista fail-closed: ambigüedad no confirma | Código: cada rama confirma solo con `=== 1`; `porNombre.length > 1` → `"homonimo"`; 0 → `"sin-candidato"` | PASS |
| Seeder no auto-confirma | `runSeeder`: `for (const row of maestra) row.estado = "no_confirmado"` antes de retornar; promoción explícita solo con `--promote` + allow-list | PASS |
| Backup preserva estado humano | `--preserve-estado`: `readEstadoSnapshot` indexa por id + firma; loop mergea estado previo; workflow no usa `--promote` | PASS |

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| ID-01 | Tabla maestra sembrada desde Cámara/Senado con identidades confirmadas por revisión humana | SATISFIED | 186 filas confirmadas con provenance; compuerta principiada (allow-list auditada, no blanket); DDL `estado default no_confirmado` |
| ID-02 | Reconciliación determinista sin LLM (RUT exacto / nombre único en cámara+periodo) | SATISFIED | `matchDeterminista` pura, fail-closed, cero red/LLM; rama RUT + rama nombre + desempate estricto |
| ID-09 | Respaldo de la maestra fuera de Supabase | SATISFIED | Snapshot en git (autoritativo hoy); workflow cron semanal para cadencia; R2 cableado y gateado (pendiente credencial operador) |

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `deterministic.ts:97` | Comentario `// NOTA (IN-04, diferido)` sobre `isRutValido` no cableado | Info | Diferido documentado explícitamente; `isRutValido` exportada y testeada para Fase 4. No es un TBD sin seguimiento. |
| `seed-cli.ts` | R2 pendiente de credencial de operador | Info | Documentado en `docs/operador-fase3.md` y en el workflow. No es un marcador de deuda sin referencia. |

No se encontraron marcadores `TBD`, `FIXME`, ni `XXX` sin referencia de seguimiento formal en los archivos de la fase.

---

### Code Review Status

El 03-REVIEW.md documenta 3 críticos + 6 warnings + 4 info. Todos resueltos excepto IN-04 (deferred, aceptado explícitamente):

- **CR-01** (promote blanket): RESUELTO — `promoteToConfirmado` recibe allow-list explícita; `seed-cli` solo muta en memoria los ids del allow-list.
- **CR-02** (fechas militancia inválidas): RESUELTO — `parseFecha` fail-closed; partido=null en caso de fecha inválida, logeado.
- **CR-03** (id="S?" / "D?" colapsa filas): RESUELTO — parsers lanzan si PARLID/Id ausente.
- **WR-01** a **WR-06**: todos RESUELTOS (clave estricta para desempate, --r2 cableado, preserve por firma estable, recency en militancias, floor-check en parsers, tightened schema).
- **IN-04** (RUT mod-11 no cableado): DEFERRED — aceptado explícitamente; `isRutValido` disponible para Fase 4.

---

### Human Verification Required

#### 1. Push schema + seed al Supabase REMOTO

**Test:** Ejecutar los pasos de `docs/operador-fase3.md`: `supabase link --project-ref <ref>`, `supabase db push`, cargar el seed (186 filas) con service key del proyecto remoto, verificar que la tabla `parlamentario` queda con 186 filas confirmadas y RLS activa.

**Expected:** Migración 0005 aplicada, 186 filas cargadas en el proyecto Supabase remoto, RLS habilitada en `parlamentario` y `parlamentario_alias`, anon sin acceso.

**Why human:** Requiere DB password / PAT `sbp_` que no está disponible en el entorno de CI. No es un gap de implementación — el código está completo; es un paso de operador con credencial de cuenta.

#### 2. Respaldo R2 funcional

**Test:** Proveer credenciales R2 válidas (`R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`) como secrets del repositorio y disparar manualmente `backup-parlamentario.yml` via `workflow_dispatch`. Verificar que el step "Respaldo a R2" corre (condición `if` cumplida) y termina con exit 0.

**Expected:** El snapshot se sube a R2 con éxito; log del CLI muestra `R2 OK`; el objeto existe en el bucket.

**Why human:** Las credenciales R2 dan 401 en el entorno actual. La lógica de upload está cableada correctamente (`buildR2Target` + `exportMaestra` con `r2Enabled=true`), pero solo se puede verificar end-to-end con una credencial S3 válida.

---

### Gaps Summary

No hay gaps de implementación. Los tres criterios de éxito del roadmap están satisfechos:

1. **SC-1 (maestra sembrada con revisión humana):** 186 filas reales, todas `confirmado`, con provenance hacia endpoints gubernamentales. La compuerta de promoción es principiada (allow-list auditada, no blanket-confirm).
2. **SC-2 (reconciliación determinista sin LLM):** `matchDeterminista` pura y fail-closed, con desempate por clave estricta (WR-01 resuelto). Cero invocaciones a modelos.
3. **SC-3 (respaldo fuera de Supabase):** Snapshot en git (autoritativo hoy) + workflow de cadencia semanal cableado. R2 como segundo destino queda pendiente de credencial de operador, no de código.

Los dos ítems de verificación humana (push remoto y R2) son pasos de operador con dependencia de credencial, no evidencia de implementación incompleta.

---

_Verified: 2026-06-18T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
