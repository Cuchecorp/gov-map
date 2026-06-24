# Discovery: Deps / Config / Build / Tooling — Phase 43
Date: 2026-06-24

---

## CFG-01: `.claude/` no está en `.gitignore` → se puede commitear accidentalmente

- **File:** `.gitignore` (todo el archivo)
- **Evidence:** `git status --short` devuelve `?? .claude/` (untracked, no ignorado). El archivo `.gitignore` no tiene ninguna línea que mencione `.claude/`.
- **Repro:** Un `git add -A` o `git add .` incluye `.claude/` entero — memoria, transcripciones, scheduled_tasks.lock, settings con rutas personales. Si se pushea, cualquier persona con acceso al repo puede ver el historial de conversaciones y configuración privada.
- **Severity:** high
- **Blast radius:** Leak de historial de sesiones Claude, rutas locales del operador, configuración de skills y hooks. Nada de esto debe ser público.
- **Proposed fix (do NOT apply):** Agregar `.claude/` al `.gitignore` (raíz, junto al bloque de "Editor / OS").

---

## CFG-02: `SUPABASE_ANON_KEY` y `PUBLIC_INDEXABLE` no están en `.env.example`

- **File:** `.env.example` (todo el archivo) vs `app/lib/supabase.ts:35`, `app/app/layout.tsx:22`
- **Evidence:**
  - `app/lib/supabase.ts` lee `process.env.SUPABASE_ANON_KEY` — la clave pública del cliente browser-side.
  - `app/app/layout.tsx` lee `process.env.PUBLIC_INDEXABLE`.
  - Ninguna de las dos aparece en `.env.example`.
- **Repro:** Un nuevo operador que clone el repo y copie `.env.example` a `.env` arrancará el frontend con `SUPABASE_ANON_KEY` undefined → el cliente Supabase en el browser falla silenciosamente en producción. `PUBLIC_INDEXABLE` no documentada → el `<meta name="robots">` del layout queda sin entender.
- **Severity:** high
- **Blast radius:** Frontend en producción con cliente Supabase roto (todas las queries del navegador). Indexación de bots indefinida.
- **Proposed fix (do NOT apply):** Agregar a `.env.example`:
  ```
  # Clave pública del proyecto Supabase (safe for browser — NO bypasa RLS).
  SUPABASE_ANON_KEY=
  # Controla <meta name="robots">: "true" = indexable, cualquier otro valor = noindex.
  PUBLIC_INDEXABLE=false
  ```

---

## CFG-03: `SUPABASE_LOCAL_URL` y `SUPABASE_LOCAL_SERVICE_KEY` no están en `.env.example` (vars de dev solo documentadas en código)

- **File:** `.env.example` (todo el archivo) vs `packages/tramitacion/src/ingest-cli.ts:155-156`, `packages/identity/src/seed-cli.ts:213-215`, `packages/adjudication/src/revisor-cli.ts:257-258`, etc.
- **Evidence:** Al menos 6 paquetes (`tramitacion`, `identity`, `adjudication`, `agenda`, `revisor-entidad`) leen `process.env.SUPABASE_LOCAL_URL` y `process.env.SUPABASE_LOCAL_SERVICE_KEY` como override de dev (para apuntar al stack Supabase local). No están en `.env.example`.
- **Repro:** Un nuevo contribuidor corriendo el CLI contra Supabase local (`supabase start`) no sabe que debe setear estas variables y el CLI falla o apunta a PROD.
- **Severity:** medium
- **Blast radius:** Contribuidores nuevos apuntan accidentalmente a PROD desde CLI local. Pérdida de datos o contaminación de la base de datos de producción.
- **Proposed fix (do NOT apply):** Agregar sección "Dev local" a `.env.example`:
  ```
  # --- Dev local (Supabase CLI: supabase start) ---
  # Si se setean, los CLIs de ingesta usan estas en vez de SUPABASE_API_URL/SUPABASE_SECRET_KEY.
  SUPABASE_LOCAL_URL=http://localhost:54321
  SUPABASE_LOCAL_SERVICE_KEY=
  ```

---

## CFG-04: `SUPABASE_URL` (alias) no está en `.env.example` — se lee junto a `SUPABASE_API_URL` pero solo la segunda está documentada

- **File:** `.env.example:19` (`SUPABASE_API_URL=`) vs `packages/cruces/src/clasificar-lobby-cli.ts:107`, `packages/fichas/src/pipeline-cli.ts:150`, `packages/votos/src/run-camara-votos.ts:143`, `packages/lobby/src/ingest-cli.ts:110`, etc.
- **Evidence:** Varios CLIs hacen `process.env.SUPABASE_URL ?? process.env.SUPABASE_API_URL` (o viceversa). Solo `SUPABASE_API_URL` aparece en `.env.example`. `SUPABASE_URL` — que también leen `app/lib/supabase-admin.ts:20` y `app/lib/web-reader-jwt.ts:98` — no está documentada.
- **Repro:** Un operador que setee solo `SUPABASE_API_URL` (como dicta `.env.example`) puede tener componentes que esperan `SUPABASE_URL` fallando silenciosamente.
- **Severity:** medium
- **Blast radius:** `supabase-admin.ts` y `web-reader-jwt.ts` del frontend PROD usan `SUPABASE_URL` — si falta, la superficie admin y la autenticación JWT web_reader fallan.
- **Proposed fix (do NOT apply):** Consolidar en `.env.example`: documentar que `SUPABASE_URL` es el alias canónico (mismo valor que `SUPABASE_API_URL`); o estandarizar el código a uno solo. Mínimo: agregar `SUPABASE_URL=` con nota explicando el alias.

---

## CFG-05: `SUPABASE_DB_URL` no está en `.env.example` pero varios CLIs la leen

- **File:** `.env.example` (todo el archivo) vs `packages/lobby/src/ingest-cli.ts:110`, `packages/dinero/src/ingest-cli.ts:99`, `packages/dinero/src/ingest-cli-servel.ts:107`, `packages/probidad/src/ingest-cli.ts:93`
- **Evidence:** Los CLIs de `lobby`, `dinero` y `probidad` leen `process.env.SUPABASE_DB_URL` (URL directa de Postgres, distinta de la API REST). No está en `.env.example`.
- **Repro:** Estos CLIs pueden necesitar conexión directa a Postgres (p.ej. para operaciones DDL o bulk). Si la variable falta, la lógica de fallback puede apuntar a otro endpoint inesperado.
- **Severity:** medium
- **Blast radius:** CLIs de ingesta de lobby, dinero y probidad fallan o usan fallback incorrecto.
- **Proposed fix (do NOT apply):** Agregar a `.env.example`:
  ```
  # URL directa de Postgres (no la API REST). Obtener en Dashboard → Settings → Database.
  # Formato: postgresql://postgres:<password>@<host>:5432/postgres
  SUPABASE_DB_URL=
  ```

---

## CFG-06: Root `tsconfig.json` no incluye `lobby`, `probidad`, `dinero`, `fichas`, `cruces` en `references` → `tsc -b` en raíz no los verifica

- **File:** `tsconfig.json:3-13`
- **Evidence:**
  ```json
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/ingest" },
    { "path": "./packages/llm" },
    { "path": "./packages/identity" },
    { "path": "./packages/adjudication" },
    { "path": "./packages/tramitacion" },
    { "path": "./packages/agenda" },
    { "path": "./packages/votos" }
  ]
  ```
  Faltan: `packages/lobby`, `packages/probidad`, `packages/dinero`, `packages/fichas`, `packages/cruces`.
- **Repro:** `pnpm typecheck` (raíz) corre `tsc -b` que solo verifica los 8 paquetes listados. Los 5 paquetes omitidos — incluyendo `fichas` (embeddings+LLM), `cruces` (cruces públicos), `dinero` (ChileCompra+SERVEL), `lobby`, `probidad` — pueden tener errores de tipo que CI nunca detecta.
- **Severity:** high
- **Blast radius:** Errores de tipo en código de producción de 5 paquetes pasan desapercibidos. Un refactor del tipo exportado por `@obs/core` o `@obs/llm` rompe silenciosamente los consumidores omitidos.
- **Proposed fix (do NOT apply):** Agregar las 5 referencias faltantes al `tsconfig.json` raíz.

---

## CFG-07: `tsconfig.base.json` no mapea `@obs/llm`, `@obs/votos`, `@obs/lobby`, `@obs/probidad`, `@obs/dinero`, `@obs/fichas`, `@obs/cruces` en `paths`

- **File:** `tsconfig.base.json:16-31`
- **Evidence:** `paths` mapea solo: `@obs/core`, `@obs/ingest`, `@obs/identity`, `@obs/adjudication`, `@obs/dinero`, `@obs/tramitacion`, `@obs/agenda`. Faltan: `@obs/llm`, `@obs/votos`, `@obs/lobby`, `@obs/probidad`, `@obs/fichas`, `@obs/cruces`. (Nota: `@obs/dinero` sí está en paths pero no en `tsconfig.json` references — inconsistencia adicional.)
- **Repro:** Si algún paquete importa `@obs/llm` o `@obs/cruces` via path alias en un contexto donde solo se usa `tsconfig.base.json` (sin el override del paquete que declara la `reference`), el compilador no resuelve el path y falla con "module not found".
- **Severity:** medium
- **Blast radius:** Imports cross-paquete con alias `@obs/*` pueden fallar en IDEs o en compilaciones que usan solo `tsconfig.base.json`.
- **Proposed fix (do NOT apply):** Agregar los paths faltantes a `tsconfig.base.json` y alinear con las references del `tsconfig.json` raíz.

---

## CFG-08: `app/tsconfig.json` usa `target: "ES2017"` mientras `tsconfig.base.json` usa `target: "ES2022"` — downlevel silencioso

- **File:** `app/tsconfig.json:3`, `tsconfig.base.json:3`
- **Evidence:**
  - `app/tsconfig.json`: `"target": "ES2017"`
  - `tsconfig.base.json`: `"target": "ES2022"`
- **Repro:** El app frontend compila a ES2017 (IE11-era). Código que use `Array.at()`, `Object.hasOwn()`, top-level await, `structuredClone()` etc. se downlevela o falla. Además, `app/tsconfig.json` usa `"lib": ["dom", "dom.iterable", "esnext"]` mientras base usa `["ES2022"]` — mezcla de lib targets. No es bloqueante hoy pero es deuda porque Next.js 16 con Cloudflare Workers requiere al menos ES2020.
- **Severity:** medium
- **Blast radius:** Código del frontend que usa APIs ES2022+ puede fallar en runtime Cloudflare Workers si el downlevel de TS las elimina o las polyfills no están. También confunde IDEs con qué APIs son seguras.
- **Proposed fix (do NOT apply):** Cambiar `app/tsconfig.json` a `"target": "ES2022"` (Cloudflare Workers lo soporta). Alinear `lib` con el de base.

---

## CFG-09: Deno (`supabase/functions/deno.json`) usa `zod@3` mientras todos los paquetes Node usan `zod@4` — ruptura de API garantizada si comparten esquemas

- **File:** `supabase/functions/deno.json:16`, todos los `packages/*/package.json`
- **Evidence:**
  - `supabase/functions/deno.json`: `"zod": "npm:zod@3"`
  - Todos los paquetes Node (`core`, `llm`, `identity`, etc.): `"zod": "^4.4.3"`
- **Repro:** Zod v4 tiene breaking changes respecto a v3 (`.parse()` behavior, `.safeParse()` types, `.brand()`, `.pipe()` semántica). Si los esquemas Zod de `@obs/core` o `@obs/ingest` — importados en los Edge Functions Deno via `deno.json` imports — usan APIs de v4, el Edge Function compilará con v3 y romperá en runtime con errores crípticos (campo inesperadamente undefined, validaciones que no fallan cuando deben, etc.).
- **Severity:** high
- **Blast radius:** Edge Functions de ingesta (el worker de Supabase) pueden validar incorrectamente payloads. Datos corruptos o sin validar llegan a R2/Supabase.
- **Proposed fix (do NOT apply):** Actualizar `supabase/functions/deno.json` a `"zod": "npm:zod@4"` y verificar compatibilidad de los esquemas importados. O — si v4 tiene issues con Deno — aislar los esquemas compartidos en un subconjunto v3-compatible.

---

## CFG-10: `docker-cf-build.sh` usa `--no-frozen-lockfile` con comentario que sugiere que el gate de pnpm 11 no está resuelto en Docker

- **File:** `docker-cf-build.sh:18`
- **Evidence:**
  ```bash
  pnpm install --no-frozen-lockfile || echo "[docker-build] install returned nonzero (ignored-builds gate) — continuing..."
  ```
  El script usa `--no-frozen-lockfile` (instala versiones más nuevas que el lockfile si existen) y además ignora el exit code con `||`. En CI (`deploy-cloudflare.yml`) se usa correctamente `--frozen-lockfile --ignore-scripts`, pero el script Docker de build local no.
- **Repro:** Un build Docker local puede instalar versiones más nuevas de dependencias que las del lockfile, produciendo un bundle diferente al de CI. El `|| echo` además oculta errores reales de install.
- **Severity:** medium
- **Blast radius:** Build local Docker puede diferir del build CI → "works on my machine". Difícil de reproducir bugs de runtime en producción.
- **Proposed fix (do NOT apply):** Cambiar a `pnpm install --frozen-lockfile --ignore-scripts` (igual que CI) y eliminar el `||`. Si hay un error real de install, debe fallar ruidosamente.

---

## CFG-11: Root `package.json` `scripts.lint` es un placeholder — no corre ESLint real

- **File:** `package.json:11`
- **Evidence:**
  ```json
  "lint": "echo \"(lint placeholder — configurar en fase posterior)\""
  ```
  `app/package.json` sí tiene `"lint": "eslint"` con `eslint-config-next`. Los 13 paquetes en `packages/` no tienen script `lint` ni configuración ESLint propia.
- **Repro (seed verificado):** `pnpm lint` en raíz imprime el echo y sale con 0. CI no tiene un paso de lint (ningún workflow corre lint). Los paquetes de backend (`@obs/ingest`, `@obs/llm`, etc.) nunca son linteados.
- **Severity:** medium
- **Blast radius:** Errores de linting en los 13 paquetes de backend (imports innecesarios, `any` implícito, etc.) nunca son detectados. El riesgo crece con cada paquete nuevo.
- **Proposed fix (do NOT apply):** Agregar ESLint flat config en raíz que cubra `packages/**/*.ts` y correr `eslint --flag unstable_ts_config` o equivalente. Agregar paso `lint` en CI (puede ser un workflow separado o parte de un futuro CI unificado).

---

## CFG-12: `.gitignore` no tiene regla para `*.tsbuildinfo` por debajo de `packages/*/` — potencial commit de artefactos si el patrón glob no cubre subdirectorios

- **File:** `.gitignore:22`
- **Evidence:**
  ```
  *.tsbuildinfo
  ```
  Este glob en `.gitignore` cubre archivos en el root pero en Git, los globs sin `/` se aplican a cualquier directorio — verificado: `git check-ignore packages/core/tsconfig.tsbuildinfo` debería matchear. Sin embargo, actualmente los `dist/` de paquetes SÍ existen en disco (verificado: `packages/dinero/dist/` tiene 44 archivos, `packages/core/dist/` tiene 10) y NO están trackeados (`git ls-files packages/*/dist` retorna vacío). Riesgo real: si alguien corre `tsc -b` localmente y luego `git add -p`, los `.tsbuildinfo` y `dist/` podrían incluirse.
- **Repro:** `dist/` está en `.gitignore` como glob simple — mismo comportamiento que `*.tsbuildinfo`. Actualmente funciona. Riesgo bajo pero conviene explicitarlo.
- **Severity:** low
- **Blast radius:** Artefactos de build en el repo → tamaño de repo crece, CI potencialmente usa build cacheado stale. Sin impacto de seguridad.
- **Proposed fix (do NOT apply):** Mantener como está pero agregar `packages/*/dist/` y `packages/*/*.tsbuildinfo` explícitos para mayor claridad. O confirmar que el glob actual es suficiente (git lo aplica recursivamente).

---

## CFG-13: `backfill.yml` workflow referencia `supabase/functions/ingest-worker/backfill.ts` que existe — pero corre Deno con `--unstable-sloppy-imports --no-check`, omitiendo type-checking

- **File:** `.github/workflows/backfill.yml:50-53`
- **Evidence:**
  ```yaml
  run: |
    deno run \
      --allow-env --allow-net \
      --unstable-sloppy-imports --no-check \
      ingest-worker/backfill.ts
  ```
  `--no-check` desactiva el type-checker de Deno. `--unstable-sloppy-imports` permite imports sin extensión (comportamiento no estándar, marcado explícitamente como unstable en Deno).
- **Repro:** El backfill de M1 corre sin verificación de tipos. Un error de tipo en `backfill.ts` que rompa la lógica de rate-limit o de escritura a R2 pasaría desapercibido hasta runtime.
- **Severity:** low
- **Blast radius:** Backfills masivos con código roto en tipos. Dado que el backfill de M1 es del DummyConnector (no fuentes reales), el riesgo actual es bajo pero crece cuando se reuse el pattern para fuentes reales.
- **Proposed fix (do NOT apply):** Remover `--no-check` y asegurarse de que `supabase/functions/deno.json` esté correcto para que el check pase. Mantener `--unstable-sloppy-imports` solo si es necesario (registrar el porqué).

---

## CFG-14: `minimumReleaseAgeExclude` en `pnpm-workspace.yaml` pineando `openai@6.44.0` — excepción de seguridad sin caducidad

- **File:** `pnpm-workspace.yaml:22-23`
- **Evidence:**
  ```yaml
  minimumReleaseAgeExclude:
    - openai@6.44.0
  ```
  Esta línea exige a pnpm permitir instalar `openai@6.44.0` antes del período mínimo de "madurez" de release. Es una excepción puntual con una versión exacta hardcodeada.
- **Repro:** Si `openai` publica una versión `6.44.1` con un fix de CVE, pnpm no la instalará automáticamente porque la excepción es exacta a `6.44.0`. La excepción tampoco tiene comentario explicando por qué se necesitaba (fecha de urgencia, PR relacionado).
- **Severity:** low
- **Blast radius:** Puede bloquear actualizaciones de seguridad de `openai` si la excepción no se revisa al hacer `pnpm update`.
- **Proposed fix (do NOT apply):** Agregar un comentario con fecha y razón. Remover la excepción una vez que `openai@6.44.0` lleve más de 7 días publicada (el período por defecto).

---

## Verificación de seeds del encargo

| Seed | Resultado |
|------|-----------|
| Root `scripts.lint` = echo placeholder | **CONFIRMADO** — `package.json:11` |
| `.gitignore` no ignora `.claude/` | **CONFIRMADO** — `git status` muestra `?? .claude/`; `git check-ignore .claude` falla |
| `dist/` committed | **FALSO** — `git ls-files packages/*/dist` vacío; dist/ en disco pero no trackeado |
| `*.tsbuildinfo` committed | **FALSO** — no trackeado |
| Deno + pnpm coexisten | **CONFIRMADO** — `deno.json`/`deno.lock` en raíz Y `supabase/functions/deno.json`. Deno sigue activo (Edge Functions + backfill.yml). No es config muerta. |
| `SUPABASE_SECRET_KEY` vs `SUPABASE_SERVICE_KEY` mismatch | **CONFIRMADO PARCIALMENTE** — `.env.example` tiene ambas (`SUPABASE_SECRET_KEY` línea 19 y `SUPABASE_SERVICE_KEY` línea 67). El código las usa: paquetes de ingesta usan `SUPABASE_SECRET_KEY`, `supabase-admin.ts` y los CLIs de `lobby`/`dinero`/`probidad` usan `SUPABASE_SERVICE_KEY`. Son ROLES diferentes (secret_key = service_role para ingesta, service_key = service_role para admin frontend). La dualidad es intencional pero confusa — CFG-04 ya documenta la proliferación de aliases. |
| `SUPABASE_JWT_SECRET` en `.env.example` | **CONFIRMADO PRESENTE** — línea 21 de `.env.example` ya lo tiene. Seed falso. |
| `.gitattributes` ausente | **CONFIRMADO** — no existe ningún `.gitattributes` en raíz. Riesgo de CRLF/LF en Windows sin normalización Git. No escalado a finding separado porque el `.gitignore` tiene `*.log` y el repo opera en Windows solo en operador local; CI es Ubuntu. |
