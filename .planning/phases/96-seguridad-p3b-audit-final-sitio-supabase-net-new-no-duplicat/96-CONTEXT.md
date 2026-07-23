# Phase 96: SEGURIDAD P3b — Audit final sitio + Supabase (net-new, no duplicativo) - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning
**Mode:** Smart discuss autónomo (recomendaciones auto-aceptadas por directiva de la corrida — PROMPT-v9.0 §Directivas)

<domain>
## Phase Boundary

Los guards (95) revisan MIGRACIONES; esta fase audita la DB VIVA y el repo PÚBLICO con el modelo de amenaza de sujetos hostiles, más la credencial arrastrada (B26). Net-new, no duplicativo de 95.

Alcance (success criteria ROADMAP):
1. **Sitio/repo público**: scan de secretos sobre TODO el historial git (lo alguna vez commiteado se documenta para rotación — el agente NO rota ni imprime valores), `.env.example` sin valores reales (+ guard CI), mensajes de error genéricos (cero texto Postgres/schema al cliente), headers de seguridad verificados en el deploy real, **CSP Report-Only → ENFORCED**.
2. **Supabase vivo**: Splinter + grants/RLS sobre la DB VIVA (pg_proc/pg_policies/grants reales, no solo migraciones), re-derivación del RPC allowlist contra pg_proc vivo, pgvector ≥0.8.2 confirmado (CVE-2026-3172), `pnpm audit` limpio.
3. **B26** (rotación DB password): checkpoint de OPERADOR — el agente documenta el handoff (runbook YA existe: `.planning/phases/75-*/75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md`), NO rota.
4. **Golden gate de identidad re-verificado** — la correctitud del dato ES la defensa legal.

Al cerrar: la pasada 3 cierra el milestone (audit-milestone → complete-milestone v9.0 → cleanup → tag → push a Cuchecorp/gov-map) — eso lo maneja el orquestador, NO es parte de los planes de esta fase. El DEPLOY del CSP enforced SÍ es de esta fase y arrastra los fixes latentes de 94 (WR-01/02 dedup + a11y, ya en master sin bundlear).

**Gates que JAMÁS se cruzan**: flags `*_PUBLIC_ENABLED` (MONEY/NET siguen como estén), sign-offs legales, rotar credenciales, imprimir secrets.

</domain>

<decisions>
## Implementation Decisions

### Scan de secretos (historial completo)
- Herramienta: `gitleaks` 8.30.1 YA instalado local (`gitleaks git` sobre todo el historial, default rules). trufflehog NO disponible — gitleaks basta.
- Salida: reporte SIN valores (redactar: archivo, commit, rule-id, NUNCA el secreto). Lo alguna vez commiteado → tabla de rotación en el handoff de operador. El DB password ya-expuesto es B26 (checkpoint existente, no duplicar).
- Falsos positivos esperables (hashes, sha256 content-addressed, JWT de EJEMPLO en docs): triage explícito con razón por descarte.

### .env.example + errores genéricos
- `.env.example` (32 entradas): assert de solo-placeholders. Recomendación aceptada: guard como test vitest (espejo de los guards existentes en app/lib o scripts) que muerda si un valor parece real (heurística: longitud/formato de keys conocidas sb_secret_, ey.., hex largo, URLs con password).
- Errores genéricos: auditar route handlers / páginas de error / catch de RPCs en app/ — ningún `error.message` de Postgres/PostgREST al cliente; mensaje genérico + log server-side. Si hay leaks, fix mínimo.

### CSP Report-Only → ENFORCED (el ítem riesgoso)
- `app/next.config.ts` hoy: `Content-Security-Policy-Report-Only` (comentario: evita romper hidratación por inline scripts de Next).
- Recomendación aceptada: política enforced pragmática para Next.js App Router estático-SSR sobre OpenNext/Cloudflare: `script-src 'self' 'unsafe-inline'` (Next hidrata con inline scripts sin nonce en este setup; nonce requiere dynamic rendering por-request — NO disponible/estable en el worker estático). `'unsafe-inline'` en script-src + `object-src 'none'` + `base-uri 'self'` + `frame-ancestors 'none'` sigue siendo estrictamente MEJOR que Report-Only-forever (que protege CERO). default-src 'self', connect-src limitado a self + Supabase URL, img-src self+data:, style-src self+'unsafe-inline'.
- Validación EMPÍRICA obligatoria: deploy → BrowserOS/DOM del deploy real (hidratación viva: islands de filtros funcionan, cero errores CSP en console) + curl -sI de headers. Si la política enforced rompe hidratación en el deploy real, degradar honesto: ajustar la política mínimamente (nunca quitar frame-ancestors/object-src) y re-verificar; documentar el trade-off.
- El deploy usa el runbook LOCKED: OpenNext en Docker node:22-slim (NUNCA alpine/Windows), robocopy a C:/Temp/obs-build, wrangler OAuth local. Este deploy arrastra los fixes latentes de 94.

### Supabase DB VIVA
- Splinter: correr los lints de Supabase sobre la DB viva (queries del proyecto splinter vía psql — el agente supabase-reviewer del repo ya mapea Splinter; salida = findings con severidad y triage).
- Grants/RLS reales: psql contra PROD — enumerar (a) funciones en public con sus ACLs (pg_proc + aclexplode: ninguna ejecutable por anon/authenticated fuera de diseño), (b) tablas con RLS deshabilitada o policies `to anon` inesperadas, (c) grants de tabla a anon/authenticated (deben ser CERO post-0044/0045).
- Re-derivación allowlist: PUBLIC_RPC_ALLOWLIST (26) vs pg_proc VIVO — funciones vivas que no están en migraciones (drift PROD-vs-repo) y viceversa. Complementa Direction-B de 95 (que era repo-only).
- pgvector: `select extversion from pg_extension where extname='vector'` ≥ 0.8.2 (CVE-2026-3172). Si <0.8.2: `alter extension vector update` es DDL sobre PROD gestionado — documentar como nota de operador si Supabase no expone la versión objetivo; NO forzar.
- SUPABASE_DB_URL en .env (cargar con set -a source, jamás imprimir). Solo SELECT/lints — cero DDL en esta fase (0064 fue la última).

### pnpm audit + golden gate
- `pnpm audit --prod` (y completo): limpio o parchado vía overrides en pnpm-workspace.yaml (precedente quick 260715-bvd). Si un advisory no tiene fix upstream: documentar triage con severidad y exposición real.
- Golden gate identidad: re-correr los golden sets (packages/adjudication golden-set.test.ts, cruces golden, gate DIPID de votos en CI) — `pnpm test` de packages verde ES la evidencia; citar counts.

### B26 y handoff
- B26: NO rotar. Actualizar/citar el runbook 75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md en el handoff final de la fase + cualquier secreto nuevo hallado por gitleaks se SUMA a la tabla de rotación del mismo handoff.
- El handoff de cierre de milestone (deuda operador viva: B26, sign-offs F13/F17, gates v7.0) se consolida en un doc de fase (96-OPERATOR-HANDOFF.md) que el cierre de milestone referencia.

### Claude's Discretion
- Estructura exacta de los planes (probable: 01 repo público [gitleaks/.env/errores/pnpm audit], 02 DB viva [Splinter/grants/allowlist/pgvector/golden], 03 CSP enforced + deploy + verificación empírica + handoff).
- Política CSP exacta connect-src/img-src (leer el CSP Report-Only actual y ajustar).
- Si `pnpm audit` requiere overrides: qué versión pin.
- Formato del reporte de auditoría (un 96-AUDIT.md por plan o consolidado).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `gitleaks` 8.30.1 en PATH local.
- `app/next.config.ts` — CSP Report-Only actual (base de la política enforced) + resto de headers de seguridad (v8.1: X-Content-Type-Options, etc.).
- Agente `supabase-reviewer` (repo-level) — mapeo Splinter + escáneres; úsese como referencia de queries, la ejecución va por psql directo.
- `.planning/phases/75-*/75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md` — runbook B26 completo (zero-credential-values).
- `packages/adjudication/src/golden/golden-set.test.ts`, `packages/cruces/src/golden/*` — golden gates existentes; CI gate DIPID de votos (Phase 65).
- Runbook deploy: `milestones/v6.0-phases/61-*/61-02-SUMMARY.md` (Docker node:22-slim + C:/Temp + wrangler OAuth; pnpm 11 dangerouslyAllowAllBuilds).
- Precedente pnpm overrides: `.planning/quick/260715-bvd-*` (pnpm-workspace.yaml overrides).
- BrowserOS MCP `http://127.0.0.1:9200/mcp` + wrapper `scripts/bros-cli.mjs` (gotchas: sleep 8-10s entre screenshots, evaluate_script usa expression).

### Established Patterns
- Guard = test vitest con detector puro + mutation self-check en memoria.
- Auditoría = doc de fase con N/M declarado y queries verbatim (patrón 93-AUDITORIA).
- psql PROD read-only: `set -a; source .env; set +a` + `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "..."` — JAMÁS imprimir la URL/password.
- Deploy verification: BrowserOS DOM sobre el deploy real (cascada CSS/hidratación solo se caza ahí).

### Integration Points
- `app/next.config.ts` (CSP enforced).
- `.github/workflows/ci.yml` (si se agrega guard .env.example al CI — ya corre la suite vitest de app, un test nuevo entra gratis).
- `pnpm-workspace.yaml` (overrides si audit lo exige).
- Sitio PROD: https://observatorio-congreso.thevalis.workers.dev (deploy actual 369f9cbe; este deploy arrastra fixes latentes 94).

</code_context>

<specifics>
## Specific Ideas

- "Lo alguna vez commiteado se rota" → el agente DOCUMENTA la rotación (tabla en handoff), jamás rota ni imprime.
- CSP enforced con Report-Only-forever = cero protección (Pitfall 12) — enforce pragmático > perfecto.
- La re-derivación del allowlist vs DB VIVA es el complemento de 95 (repo-only): cierra el triángulo repo↔allowlist↔PROD.
- Deploy de esta fase = último deploy del milestone; verificar también que los fixes latentes 94 (dedup counts ficha + a11y) quedaron bundleados.

</specifics>

<deferred>
## Deferred Ideas

- Nonce-based CSP (requiere dynamic rendering por-request en el worker) — post-milestone si se migra el rendering.
- Rate-limiting a nivel Cloudflare Worker/WAF propio — fuera de milestone.
- Rotación efectiva de credenciales halladas — acto de operador (handoff).

</deferred>
