# Phase 96: SEGURIDAD P3b — Audit final sitio + Supabase — Pattern Map

**Mapped:** 2026-07-23
**Files analyzed:** 6 (1 new test, 1 modified config, 1 modified yaml + 1 modified package.json, 2 new docs, 1 optional new config)
**Analogs found:** 5 / 6 (`.gitleaks.toml` has no repo analog)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/lib/env-example-guard.test.ts` | utility/guard test | transform (read-only fs + in-memory detector) | `app/lib/money-antiflip-guard.test.ts` | exact |
| `app/next.config.ts` | config | request-response (HTTP headers) | self (current file) | self-analog |
| `pnpm-workspace.yaml` + `app/package.json` (Next bump) | config | batch (dep resolution) | `.planning/quick/260715-bvd-*/260715-bvd-SUMMARY.md` + current `pnpm-workspace.yaml` | exact |
| `96-AUDIT-*.md` (audit report doc) | doc | N/A | `.planning/phases/93-*/93-AUDITORIA-CITACIONES.md` | role-match |
| `96-OPERATOR-HANDOFF.md` | doc | N/A | `.planning/phases/75-*/75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md` | role-match |
| `.gitleaks.toml` | config | N/A | — | no analog |

---

## Pattern Assignments

### `app/lib/env-example-guard.test.ts` (guard test, read-only fs + in-memory detector)

**Analog:** `app/lib/money-antiflip-guard.test.ts`

**Imports pattern** (lines 33–35):
```typescript
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
```

**APP_ROOT anchor idiom** (lines 40–44):
```typescript
const APP_ROOT = process.cwd(); // app/  — vitest de app/ corre desde app/
const REPO_ROOT = path.resolve(APP_ROOT, ".."); // raíz del monorepo
const ENV_EXAMPLE = path.join(REPO_ROOT, ".env.example");
```
The new guard copies this exactly, substituting the target file path:
`ENV_EXAMPLE` → same (`.env.example` from `REPO_ROOT`). No secondary constant (no `MONEY_GATE`). The detector reads the same `ENV_EXAMPLE` file.

**Exported pure detector pattern** (lines 139–236, abstracted):
```typescript
// 1. Export the detector as a PURE function (takes string content, returns violations[]).
//    This makes it exercisable in memory without touching the real file (self-check §4).
export function detectarValorNoPlaceholder(envSrc: string): string[] {
  const offenders: string[] = [];
  // heuristic: a line KEY=<value> where <value> matches known-secret formats.
  // Legitimate non-secret values to skip: empty, "false", "true", integers, slugs like "crudo-servel".
  // Real-secret patterns to flag: sb_secret_*, eyJ* (JWT), hex ≥32 chars, postgresql://*:<nonplaceholder>@*, *.r2.cloudflarestorage.com with a key
  for (const line of envSrc.split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const [, value] = line.split("=", 2) ?? [];
    if (!value) continue;
    if (looksLikeRealSecret(value.trim())) {
      offenders.push(line.trim());
    }
  }
  return offenders;
}
```

**Mutation self-check block pattern** (lines 338–435, §4):
```typescript
// §4 Mutation self-check — prove the guard BITES (not a permanent green no-op).
// Inject synthetic "real-looking" values in memory; assert offenders > 0.
describe("(4) Mutation self-check — el guard MUERDE ante valores reales", () => {
  it("base válida → 0 offenders", () => {
    expect(detectarValorNoPlaceholder("SUPABASE_SECRET_KEY=\nSUPABASE_API_URL=\n")).toEqual([]);
  });

  it("MUERDE: sb_secret_ prefix (service_role key)", () => {
    const offenders = detectarValorNoPlaceholder("SUPABASE_SECRET_KEY=sb_secret_realvalueXXXXXXX\n");
    expect(offenders.length).toBeGreaterThan(0);
  });

  it("MUERDE: JWT eyJ prefix", () => {
    const offenders = detectarValorNoPlaceholder("SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx\n");
    expect(offenders.length).toBeGreaterThan(0);
  });

  it("NO MUERDE: MONEY_PUBLIC_ENABLED=false (legítimo booleano)", () => {
    expect(detectarValorNoPlaceholder("MONEY_PUBLIC_ENABLED=false\n")).toEqual([]);
  });

  it("sanity: el walk encontró el archivo real (no es un escaneo vacío)", () => {
    const src = readFileSync(ENV_EXAMPLE, "utf-8");
    expect(src.length).toBeGreaterThan(0);
  });
});
```

**Structural notes for the new file:**
- Place in `app/lib/env-example-guard.test.ts` (NOT `scripts/`). Guards live in `app/lib/*` and run under `pnpm --filter ./app test` automatically (CI picks them up gratis — same pattern as `lockdown-guard.test.ts`, `money-antiflip-guard.test.ts`).
- The new guard has NO `walkSourceFiles` / `walkPackageFiles` (money-antiflip's Vector 3). It has only two sections: (1) real-file assertion (0 offenders against the actual `.env.example`), (2) mutation self-check in memory.
- `stripTsComments` is NOT needed (`.env.example` has no TypeScript comments). Skip it.
- Allowlist for legitimate non-secret values that look formatted but aren't secrets: `false`, `true`, `0`, `1`, `crudo-servel` (the slug), `postgresql://postgres:<password>@<host>:5432/postgres` (template-style placeholder — the angle-brackets mark it as a placeholder, not a real value). The detector must NOT bite on lines like `BACKFILL_ITERATIONS=1` or `SERVEL_CRUDO_BUCKET=crudo-servel`.

---

### `app/next.config.ts` (config, HTTP headers — CSP Report-Only → enforced)

**Analog:** self (current `app/next.config.ts`, lines 1–64)

**Full current headers() block** (lines 11–44) — excerpt to preserve/change:
```typescript
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
  // ↓ THIS is the only line to change (key + value):
  {
    key: "Content-Security-Policy-Report-Only",   // ← REPLACE key
    value: [
      "default-src 'self'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];
```

**Target change — replace ONLY the CSP entry** (RESEARCH.md §Code Examples):
```typescript
  {
    key: "Content-Security-Policy",              // ← enforced (was Report-Only)
    value: [
      "default-src 'self'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",       // Next hydrates with inline scripts; nonce not available in static OpenNext worker
      "connect-src 'self'",                      // browser does NOT talk to Supabase directly (all server-side); validate empirically in deploy
      "object-src 'none'",                       // NET-NEW: was missing from Report-Only policy
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
```

**What stays identical:** all 5 other headers above the CSP entry (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`), the `nextConfig` shape, `source: "/(.*)"`, and the `initOpenNextCloudflareForDev` import at the bottom.

**Minimal diff:** change exactly one `key` string (`"Content-Security-Policy-Report-Only"` → `"Content-Security-Policy"`), add `"connect-src 'self'"` and `"object-src 'none'"` to the value array, remove the comment block about "nonces/hashes pending".

---

### `pnpm-workspace.yaml` + `app/package.json` (dependency hygiene — pnpm audit fix)

**Analog:** current `pnpm-workspace.yaml` (lines 1–40) + quick 260715-bvd pattern

**Exact overrides idiom to copy** (current `pnpm-workspace.yaml` lines 5–14):
```yaml
# In pnpm 11.x overrides live HERE, not in package.json.
# pnpm reads `pnpm.overrides` from package.json NO LONGER — emits WARN and ignores it.
overrides:
  postcss: "^8.5.10"
  esbuild: "^0.28.1"
  uuid: "^11.1.1"
```

**New entries to ADD** to the existing `overrides:` block (do NOT replace — append):
```yaml
overrides:
  postcss: "^8.5.10"        # existing
  esbuild: "^0.28.1"        # existing
  uuid: "^11.1.1"           # existing
  brace-expansion: "^2.1.2" # NEW — DoS regex {}, high
  protobufjs: "^7.6.5"      # NEW — DoS .proto parsing, moderate (already in onlyBuiltDependencies)
  sharp: "^0.35.0"          # NEW — libvips CVEs, high (already in onlyBuiltDependencies)
```

**Gotcha from 260715-bvd SUMMARY (lines 65–73):** after `pnpm install`, pnpm 11 may auto-inject an `allowBuilds:` placeholder block into `pnpm-workspace.yaml` if a new `onlyBuiltDependencies` entry triggers the build-script gate. Remove that placeholder before committing — the repo already uses `onlyBuiltDependencies` (not `allowBuilds`). `protobufjs` and `sharp` are already listed there; no new entries needed for those.

**Next.js bump in `app/package.json`:**
```bash
# Verify exact patched version first:
npm view next version   # confirm ≥16.2.11
# Then bump (from app/ dir):
pnpm add next@^16.2.11
# Regenerate lock:
pnpm install --lockfile-only   # or pnpm install
```
The `app/package.json` change is just the `next` semver pin; no other dep changes.

**Verification sequence** (from 260715-bvd SUMMARY lines 92–103):
```bash
# Confirm no vulnerable versions remain in lockfile:
grep -E 'next@16\.(0|1|2\.[0-9])\.([0-9])' pnpm-lock.yaml  # should be empty
pnpm audit --prod   # must exit 0 with 0 advisories
pnpm test           # full suite green before deploy
```

---

### `96-AUDIT-*.md` (audit report docs — one or more files)

**Analog:** `.planning/phases/93-*/93-AUDITORIA-CITACIONES.md`

**Structure pattern** (lines 1–60 of 93-AUDITORIA-CITACIONES.md):
```markdown
# 96 — AUDITORÍA [area] (plan [N])

**Fase:** 96-seguridad-p3b-...
**Ejecutado:** 2026-07-23
**Fuente de las cifras:** psql `-tA` directo contra PROD (`$SUPABASE_DB_URL` de `.env`, `PGCLIENTENCODING=UTF8`). NUNCA vía REST.
**Principio rector:** [declarar lo hallado; never fabricate status]

---

## N/M declarado — [area]

| Ítem auditado | Resultado | Filtro aplicado | Veredicto |
|---|---|---|---|
| Funciones public EXECUTABLE por anon | **0** | `pg_depend deptype='e'` excluye pgTAP | VERDE |
| ... | ... | ... | ... |

## Queries verbatim

```sql
-- [exacta query usada, copiable directamente en psql]
```

## Hallazgos

### Verde (sin acción requerida)
- ...

### Gaps / handoff de operador
- pgvector 0.8.0 (CVE-2026-3172): plataforma no ofrece ≥0.8.2 → ver 96-OPERATOR-HANDOFF.md
```

**Key format rules from 93-AUDITORIA analog:**
- Declare N/M (count found / count expected) in every table.
- Queries verbatim: paste-able, with the `not exists (pg_depend deptype='e')` filter shown inline for every function/grant query.
- "Principio rector" block at top (transparency statement).
- Never leave a metric without its query.

---

### `96-OPERATOR-HANDOFF.md` (operator note — zero credential values)

**Analog:** `.planning/phases/75-*/75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md`

**Structure pattern** (full file, ~99 lines):
```markdown
# [Task-ID] — [what the operator must do]: nota de operador

**Fase:** 96 · **Plan:** [N] · **Requisito:** [SEC-NN] · **Fecha:** 2026-07-23

## Hallazgo rector (radio de impacto)
[1–3 sentences: what the gap is, why the AGENT does not act, what the operator must do]

## Evidencia (verificación estática, read-only)
[what was verified read-only; grep counts with 0 references; no secret values ever]

## Qué rompe / qué NO
| Superficie | ¿Se ve afectada? |
|---|---|
| ... | ... |

## Pasos de OPERADOR (acto humano)
1. [step in Supabase/platform dashboard]
2. [step local]
...
[numbered, imperative, no secret values]

## Estado
- [x] verificado read-only
- [ ] **Operador:** [pending checkpoint — BLOCKING or informational]
```

**Content for 96-OPERATOR-HANDOFF.md** (consolidates multiple items):
- **B26** (DB password rotation): cite / reference runbook `75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md` verbatim — do NOT duplicate the runbook; just point to it and confirm the status checkbox is still open.
- **pgvector CVE-2026-3172**: document `extversion=0.8.0`, `default_version=0.8.0` (platform cap), `alter extension vector update` fails silently (no target ≥0.8.2). Action: Supabase Dashboard → Database → Extensions → upgrade Postgres version when ≥0.8.2 becomes available. Clarify that anon-executable functions = 0, so practical exposure is limited (pending CVE severity confirmation — Open Question 1).
- **gitleaks FP triage**: table of 4 findings with veredicto (all FP), and whether `.gitleaks.toml` allowlist was added.
- **Milestone deuda viva** cross-references: sign-offs F13/F17, gates v7.0 (cite from MEMORY, do not re-derive).
- **Zero credential values rule** (from 75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md line 97): "Esta nota no contiene ningún valor de secret." — same closing statement required.

---

### `.gitleaks.toml` (optional config — no repo analog)

**No analog in this codebase.** Shape from gitleaks 8.x documentation:

```toml
# .gitleaks.toml — allowlist for known false positives in the git history.
# Regenerate scan: gitleaks git --redact --config .gitleaks.toml
# Expected: 0 findings after allowlist.

title = "Observatorio gitleaks config"

[allowlist]
description = "FP triage 2026-07-23: test fixtures and guard constants"
paths = [
  # FP 1-3: constantes de test del guard de redacción de ticket dinero (S3CR3T-TICKET-* son fixtures)
  "packages/dinero/src/run-dinero-masivo-cli.test.ts",
  "packages/dinero/src/ingest-run.test.ts",
  "packages/dinero/src/connector-chilecompra.test.ts",
  # FP 4: fixture HTML de scraping WebForms (__VIEWSTATE token de ejemplo, no un secreto propio)
  "packages/agenda/test/fixtures/camara-citaciones-semana.html",
]
```

**Placement:** repo root (alongside `.gitignore`, `pnpm-workspace.yaml`). Invocation: `gitleaks git --redact --config .gitleaks.toml` → must exit 0 after allowlist. If adding, add a one-line comment in the audit report documenting that these 4 paths were allowlisted.

---

## Shared Patterns

### psql read-only idiom (apply to all plan-02 audit queries)
**Source:** `75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md` line 43 + RESEARCH.md Pattern 2
```bash
# Load without printing:
DB_URL=$(node -e "const fs=require('fs');console.log(fs.readFileSync('.env','utf8').match(/^SUPABASE_DB_URL=(.+)$/m)[1].trim())")
PGCLIENTENCODING=UTF8 psql "$DB_URL" -tA -c "<query>"
# NEVER echo or log DB_URL itself.
```
Apply to: every psql call in plan-02 (grants/RLS audit, allowlist drift, pgvector version, Splinter lints).

### pg_depend filter (apply to ALL function/grant audit queries)
**Source:** RESEARCH.md Pattern 2 + §Live Audit Findings
```sql
-- Mandatory suffix on every pg_proc / role_table_grants query:
and not exists (
  select 1 from pg_depend d
  where d.objid = p.oid   -- or c.oid for table grants
  and d.deptype = 'e'
)
```
Without this filter: 1201 pgTAP functions + 28 pgTAP grants appear as offenders. With it: 0 app offenders. This filter is the single most important pattern in the DB audit plan.

### pnpm 11 overrides location (apply to dep hygiene tasks)
**Source:** `pnpm-workspace.yaml` lines 5–14 + quick 260715-bvd SUMMARY
- Overrides go in `pnpm-workspace.yaml` under `overrides:`, NOT in `package.json` `pnpm.overrides`.
- `pnpm-workspace.yaml` already has the key; new entries are appended to the existing block.
- After `pnpm install`: check for spurious `allowBuilds:` placeholder injection and remove it before committing.

### Deploy runbook (apply to plan-03 CSP enforced deploy)
**Source:** `.planning/milestones/v6.0-phases/61-02-SUMMARY.md` (all gotchas verified)

Critical steps (exact pattern, no deviation):
```powershell
# 1. Copy source to non-OneDrive local path (avoids virtiofs bottleneck):
robocopy "C:\Users\Carlo\OneDrive - pjud.cl\Documentos\GitHub\Observatorio" C:\Temp\obs-build /E /XD node_modules .next .open-next .git

# 2. Docker build (node:22-slim ONLY — not alpine, not Windows):
docker build -t obs-build -f C:\Temp\obs-build\Dockerfile.cf C:\Temp\obs-build

# 3. Extract .open-next from container:
docker run --name obs-tmp obs-build true
docker cp obs-tmp:/app/.open-next C:\Temp\obs-build\app\.open-next
docker rm obs-tmp

# 4. Deploy via wrangler 4.x (global, OAuth — NOT pnpm-local wrangler):
node "C:\Users\Carlo\AppData\Roaming\npm\node_modules\wrangler\bin\wrangler.js" deploy --config wrangler.jsonc
# (run from app/ dir)
```
Gotchas from 61-02-SUMMARY.md:
- `node:22-alpine` cannot run workerd (musl ABI mismatch) → always `node:22-slim`.
- Global `wrangler` at `C:\Users\Carlo\miniconda3\Scripts\wrangler` is a Python impostor → use explicit `node .../AppData/Roaming/npm/.../wrangler.js`.
- CLOUDFLARE_API_TOKEN not in CI secrets → local OAuth path is the only available route.

### Guard structure invariant (apply to env-example-guard.test.ts)
**Source:** `app/lib/money-antiflip-guard.test.ts` JSDoc (lines 1–31)
Every guard in `app/lib/` must satisfy:
1. Detector is a **pure exported function** (takes string content, returns `string[]` violations).
2. A **mutation self-check** section (§4) runs the detector against in-memory fixtures — proves the guard bites.
3. A **sanity check** asserts the file being tested is non-empty (walker or file not vacuous).
4. Guard reads files with `readFileSync` — does NOT `import` server-only modules.
5. Guard ONLY reads and asserts. It never edits the files it checks.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `.gitleaks.toml` | config | N/A | No secret-scan config files exist in this repo; shape provided from gitleaks 8.x docs above |

---

## Metadata

**Analog search scope:** `app/lib/`, `pnpm-workspace.yaml`, `.planning/phases/75-*/`, `.planning/phases/93-*/`, `.planning/quick/260715-bvd-*/`, `.planning/milestones/v6.0-phases/61-*/`
**Files scanned:** 9 analog files read
**Pattern extraction date:** 2026-07-23
