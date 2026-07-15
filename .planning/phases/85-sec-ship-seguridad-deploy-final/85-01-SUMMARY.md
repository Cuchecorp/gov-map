# Phase 85 — Seguridad + Deploy Final: Fix Summary

**Fecha:** 2026-07-15
**Gate:** DEMO-04 (milestone v8.1)
**Revisor:** gsd-code-reviewer (Opus, deep security-only)
**Fixer:** gsd-code-fixer (Sonnet 4.6)
**Suite:** 991/991 tests VERDE tras fixes

---

## Fixes Aplicados

### WR-02 — SHA pinning de GitHub Actions (commit `9040a80`)

**Problema:** Los 10 workflows referenciaban actions por tag mutable (`@v4`). Un tag
reasignable por un atacante que comprometa la cuenta del mantenedor ejecutaría código
malicioso en jobs que portan `SUPABASE_SECRET_KEY`, `R2_SECRET_ACCESS_KEY`, etc.

**Fix:** Todos los `uses:` pinneados a SHA de 40 chars con tag como comentario:
```yaml
- uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
- uses: pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1 # v4.4.0
- uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
- uses: denoland/setup-deno@22d081ff2d3a40755e97629de92e3bcbfa7cf2ed # v2.0.5
```

**Archivos modificados:** todos los `.github/workflows/*.yml` (10 archivos) +
`.github/dependabot.yml` (nuevo — mantiene SHAs al día con PRs automáticas).

---

### D1 — Guard PII como gate de CI (commit `10470b4`)

**Problema:** `lockdown-guard.test.ts` (la única red de PII cuando `service_role` bypassea RLS)
solo corría si el operador ejecutaba `pnpm test` localmente. Un PR de tercero o push sin test
local deployaba sin validar el guard.

**Fix:** Nuevo `.github/workflows/ci.yml` (on push master + pull_request):
- `pnpm --filter ./app test -- --run` → vitest run, cubre lockdown-guard + bento-guards + anti-insinuación
- `pnpm --filter ./app exec tsc --noEmit` → compila tipos sin emitir
- `concurrency: cancel-in-progress: true` → cancela runs viejos en PRs (ahorra minutos GH)
- Actions SHA-pinned coherente con WR-02

---

### WR-01 — Cabeceras de seguridad HTTP (commit `3cb8fd0`)

**Problema:** El sitio público no emitía ninguna cabecera de seguridad HTTP.

**Fix conservador implementado:**

| Cabecera | Valor | Efecto |
|----------|-------|--------|
| `X-Frame-Options` | `DENY` | Anti-clickjacking (sin iframes propios — verificado) |
| `X-Content-Type-Options` | `nosniff` | Previene MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Minimiza datos de referrer |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Fuerza HTTPS |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` | Deshabilita APIs sensibles |
| `Content-Security-Policy-Report-Only` | (ver abajo) | Detecta sin bloquear |

**Por qué CSP en Report-Only:** Next.js 16 inyecta scripts inline en `__NEXT_DATA__` y el
runtime bootstrap de hidratación. Una CSP enforced sin nonces/hashes los bloquea → sitio roto.
OpenNext para Cloudflare Workers no inyecta nonces en el build actual. Report-Only es la
postura correcta hasta confirmar en producción que hay 0 violaciones, luego promover.

**Mecanismo dual:**
- `app/next.config.ts` `async headers()` → Worker OpenNext (SSR + API routes dinámicas)
- `app/public/_headers` → Cloudflare Assets (assets estáticos: `/_next/static/*`, iconos, etc.)

---

## Recomendaciones de Operador (no aplicadas en este ciclo)

### WR-03 — Branch protection en master + backup-parlamentario

**Riesgo aceptado (documentado):** `backup-parlamentario` hace `git push` directo a master con
`contents: write` desde un cron semanal. Si WR-02 se hubiera materializado, este era el target
de mayor valor (único workflow con write).

**Acciones recomendadas (sin urgencia post WR-02 fix):**
1. **Branch protection en master** (Settings → Branches → Add rule): requerir PR + status check
   (`ci` workflow) antes de merge. Excepcionar `github-actions[bot]` para el commit del snapshot.
2. **Alternativa más segura:** cambiar `backup-parlamentario` para abrir un PR con
   `peter-evans/create-pull-request` (SHA-pinned) en vez de push directo. Revisión humana antes
   de merge.
3. Si el push directo es requisito operacional, documentar como riesgo aceptado explícito en el
   runbook de seguridad.

### D2 — pgtap en schema public de PROD

pgtap (extensión de testing) vive en `public` en PROD, lo que expone ~300 funciones y 2 vistas a
`anon` por herencia. No hay datos de app en ellas, pero es superficie innecesaria.

**Acciones recomendadas:**
- Opción A: `DROP EXTENSION pgtap` en PROD (las suites de test corren contra local/preview, no PROD).
- Opción B: mover a schema `extensions` si la versión de Supabase lo permite.
- Disparador: próximo ciclo de mantenimiento DB (no urgente, no bloquea DEMO-04).

### D3 — Drift del ledger supabase_migrations

El ledger registra hasta `0051`, pero `0054` está aplicada en PROD out-of-band (psql directo) y
`0052`/`0053` NO están aplicadas (objetos ausentes). El ledger no refleja el estado real.

**Acción requerida antes de cualquier `supabase db push`:** reconciliar el ledger manualmente.
Correr `supabase db push` con este drift puede reordenar o duplicar migraciones.

Opciones:
```sql
-- Marcar 0054 como "ya aplicada" en el ledger (si no está ya):
INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('0054')
ON CONFLICT DO NOTHING;

-- Decidir si aplicar 0052/0053 (ver D4).
```

### D4 — Migración 0052 (cursor leylobby) = checkpoint MONEY del operador (v7)

`0052` (leylobby_cursor_estado) y `0053` están pendientes. `0052` es el checkpoint MONEY del
roadmap v7 (gate MONEY legal). El conector leylobby sin este cursor re-pide siempre año actual,
página 1, sin avanzar histórico.

**Acción requerida por el operador cuando se reactive el cron leylobby:**
1. Obtener sign-off legal para MONEY (gate v7, sigue pendiente).
2. Aplicar `0052` y `0053` a PROD una vez reconciliado el ledger (D3).
3. Reconciliar ledger incluyendo estas migraciones.

### WR-01 (pendiente post-deploy) — Promover CSP a enforced

1. Hacer deploy con las cabeceras actuales (Report-Only).
2. Abrir DevTools → Application → CSP Violations (o revisar report-uri si se configura).
3. Si 0 violaciones tras 1-2 semanas: cambiar a `Content-Security-Policy` (enforced).
4. Configurar `report-uri` / `report-to` endpoint para recolección continua.

### IN-04 — Migrar CodeQL a Advanced Setup (opcional)

Commitear `.github/workflows/codeql.yml` con `queries: security-extended` para que la
configuración sea auditable y versionada en el repo. Hoy corre vía Default Setup (invisible).

---

## Estado de Gate DEMO-04

**APROBADO.** Las 3 acciones bloqueantes del ciclo fueron aplicadas (WR-01, WR-02, D1).
Las deudas D2/D3/D4/WR-03 están documentadas con dueño y disparador; ninguna bloquea el gate.

_Fixes: 2026-07-15 — Claude (gsd-code-fixer)_
