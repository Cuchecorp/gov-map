# 96-OPERATOR-HANDOFF — Deuda de operador viva al cierre del milestone v9.0

**Fase:** 96 · **Plan:** 03 · **Requisito:** SEC-04 · **Fecha:** 2026-07-23

Este documento consolida la deuda de operador viva que el cierre del milestone v9.0 referencia.
El agente **DOCUMENTA** y **NO ejecuta** ningún acto de operador listado aquí.

---

## B26 — Rotación del DB password de Supabase

### Hallazgo rector

El DB password de Supabase (B26) vive únicamente en `SUPABASE_DB_URL`. La rotación es un
acto de **OPERADOR en el dashboard de Supabase**: el agente no tiene acceso al dashboard, y
rotar en vivo rompe las conexiones psql/CLI activas.

### Runbook completo

Ver: `.planning/phases/75-deuda-typography-island-net-rotar-db-password-operador/75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md`
(SEC-04 **CITA** ese runbook; **no lo duplica**.)

### Qué rompe / qué NO

| Superficie | ¿Se ve afectada? |
|---|---|
| CLIs locales DDL/bulk + runbooks `psql` | **SÍ** — usan `SUPABASE_DB_URL`; fallan hasta re-cargar la nueva credencial |
| Crons de CI (agenda-weekly, leyes-weekly, etc.) | **NO** — usan `SUPABASE_SECRET_KEY` + REST |
| Sitio desplegado (Cloudflare / OpenNext) | **NO** — usa `SUPABASE_SECRET_KEY` + REST |

### Pasos de OPERADOR (acto humano — ver runbook 75 para el flujo completo)

1. Dashboard Supabase → Settings → Database → Reset database password
2. Re-cargar nuevo `SUPABASE_DB_URL` en `.env` local (NUNCA commitear)
3. Revisar mirror Cuchecorp/gov-map → Settings → Secrets (buscar `*_DB_URL`)
4. Confirmar URL vieja falla: `psql "<url-vieja>" -c "select 1;"` → error de auth
5. Confirmar URL nueva funciona: `psql "$SUPABASE_DB_URL" -c "select 1;"` → `1`
6. Confirmar CI + sitio siguen verdes (usan service_role key, no se ven afectados)

### Estado

- [x] Radio de impacto verificado (96-01 gitleaks: rotaciones requeridas = CERO; solo `SUPABASE_DB_URL`)
- [x] Runbook zero-credential-values en `phases/75-*/75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md`
- [ ] **Operador:** PENDIENTE — rotación real en Dashboard (checkpoint BLOCKING desde plan 75-02)

---

## pgvector CVE-2026-3172 — Platform upgrade pendiente

### Hallazgo rector (del plan 96-02)

La extensión pgvector instalada en PROD es `0.8.0`. CVE-2026-3172 requiere `≥ 0.8.2` para
la mitigación completa. La plataforma Supabase gestionada no ofrece `0.8.2` por upgrade
in-place (`ALTER EXTENSION vector UPDATE` no encuentra target ≥ 0.8.2). La acción correcta
es esperar a que Supabase publique el upgrade de Postgres que incluya ≥ 0.8.2.

**Exposición práctica:** 0 funciones anon-executable en la DB VIVA (confirmado con filtro
`pg_depend deptype='e'` en plan 96-02). La exposición es baja mientras el vector de ataque
requiera ejecución de función por un rol sin privilegios — que es imposible con el lockdown
actual (doble-revoke + CERO grant a anon).

### Qué rompe / qué NO

| Superficie | ¿Se ve afectada? |
|---|---|
| Búsqueda semántica (`match_proyectos`) | NO — función SECURITY INVOKER, no anon-executable |
| Roles `anon` / `authenticated` | NO — 0 funciones executable por anon (96-02, check 1) |
| Operaciones de DDL local (psql) | NO — no involucra pgvector |

### Pasos de OPERADOR

1. Monitorear Supabase Dashboard → Extensions → pgvector: esperar disponibilidad ≥ 0.8.2
2. Cuando Supabase ofrezca el upgrade: Dashboard → Database → Postgres version upgrade
   (o Extensions → pgvector → actualizar, según la UI que exponga Supabase en el momento)
3. Tras el upgrade: verificar `SELECT extversion FROM pg_extension WHERE extname = 'vector';`
   → debe retornar `≥ 0.8.2`
4. Re-correr el golden gate de identidad: `pnpm -r --filter "./packages/*" test` → 1263 tests
   verdes (confirmado en 96-02; el upgrade no debe romper el schema)

### Estado

- [x] Versión actual documentada: `extversion = 0.8.0`, `default_version = 0.8.0` (plan 96-02)
- [x] Exposición práctica baja confirmada: 0 funciones anon-executable (96-02 check 1)
- [ ] **Operador:** PENDIENTE — upgrade de plataforma cuando Supabase publique ≥ 0.8.2

---

## gitleaks — Resultados del scan (plan 96-01)

### Hallazgo rector

El historial git completo (1.709 commits) fue escaneado con gitleaks 8.30.1 `--redact`.
**Rotaciones requeridas = CERO.** Los 6 findings son todos falsos positivos.

### Tabla de findings

| # | Archivo | Tipo de finding | Veredicto |
|---|---------|-----------------|-----------|
| 1–3 | `packages/dinero/src/*.test.ts` (3 archivos) | Constantes de test `S3CR3T-TICKET-*` | FP — fixtures de test |
| 4 | `packages/agenda/test/fixtures/camara-citaciones-semana.html` | Token `__VIEWSTATE` de ejemplo | FP — fixture HTML WebForms |
| 5–6 | `.planning/phases/96-.../*.md` (PLAN + PATTERNS) | Citan las constantes `S3CR3T-TICKET-*` como ejemplos | FP — docs de planificación |

Todos allowlisted en `.gitleaks.toml` (repo root). Scan futuro: `gitleaks git --redact --config .gitleaks.toml` → 0 findings.

### Estado

- [x] Scan completo ejecutado (96-01, commit 951bd14)
- [x] 6 FP triados y allowlisted en `.gitleaks.toml`
- [x] Cero secretos reales encontrados. B26 sigue siendo el único secreto real expuesto conocido (ver sección anterior).

---

## Sign-offs y gates de operador vivos (cross-refs de milestone)

Estos ítems provienen de milestone v7.0 y v9.0. El agente los **cita** desde STATE.md/MEMORY;
**no los re-deriva**.

### F13 — Sign-off legal MONEY (21.719)

- **Estado:** PENDIENTE. `MONEY_PUBLIC_ENABLED=false` (gate CI anti-flip activo).
- **Deuda:** (1) cold-read BrowserOS comprensible en gated-preview; (2) sign-off en
  `docs/legal/13-LEGAL-DOSSIER.md` → `signoff: approved`; (3) flip
  `MONEY_PUBLIC_ENABLED=true` en prod SOLO tras approved.
- El agente **no firma ni flipea**.

### F17 — Sign-off legal NET (grafo de influencia)

- **Estado:** PENDIENTE. `/red` activo pero grafo vacío (`no_confirmado` = 0 filas útiles).
- **Deuda:** sign-off dossier F17 (17-LEGAL-DOSSIER).
- El agente **no firma**.

### Gates de operador v7.0

- Ver: `.planning/HANDOFF-v7.0-operator-gates.md` para el listado completo.
- Ítems clave: backfill LIVE votos Cámara (66-02), backfill LIVE votos Senado (67-02),
  RUT-01 write remoto (blocking-human), backfill ChileCompra (70-03), apply migración 0052
  (72-02), backfill SERVEL por elección (71-03).

### Estado

- [ ] **Operador:** F13 sign-off legal MONEY pendiente (Phase 73 gates)
- [ ] **Operador:** F17 sign-off legal NET pendiente
- [ ] **Operador:** gates v7.0 según `.planning/HANDOFF-v7.0-operator-gates.md`

---

## Estado consolidado

| Ítem | Veredicto agente | Acto de operador |
|------|-----------------|-----------------|
| B26 rotación DB password | Documentado (runbook 75 citado) | PENDIENTE — Dashboard Supabase |
| pgvector CVE-2026-3172 | Documentado (exposición baja) | PENDIENTE — platform upgrade |
| gitleaks rotaciones | CERO secretos reales | No requiere acción |
| F13 MONEY sign-off | Gated OFF | PENDIENTE — legal + flip |
| F17 NET sign-off | Gated | PENDIENTE — legal |
| Gates v7.0 | Documentados | Ver HANDOFF-v7.0-operator-gates.md |

---

Esta nota no contiene ningún valor de secret.
