# Architecture Research

**Domain:** v10.0 — Panel de actualidad legislativa (landing) + señales + notificaciones por suscripción
**Researched:** 2026-07-23
**Confidence:** HIGH (integración contra código real leído; auth-on-Workers verificado con docs actuales)

> Alcance: cómo las TRES capacidades nuevas —(a) señales de actualidad, (b) landing-panel, (c) suscripciones+notificaciones— se enchufan al monorepo existente sin romper invariantes LOCKED. Todo lo afirmado abajo se ancla a archivos reales citados. Lo NO verificado se marca.

---

## Standard Architecture (estado actual — leído del repo)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  FRONTEND  — Next.js 16 App Router, OpenNext → Cloudflare Workers          │
│  app/app/page.tsx (home bento, force-dynamic) · /buscar /parlamentarios    │
│  /agenda /proyecto/[b] /parlamentario/[id]                                 │
│  Lee SOLO server-side vía createServerSupabase() = service_role (bypassa   │
│  RLS). SIN auth, SIN middleware, SIN dato de usuario. import "server-only" │
├──────────────────────────────────────────────────────────────────────────┤
│  SEGURIDAD  — Camino A (app/lib/supabase.ts)                               │
│  service_role ES el boundary. Guards CI que MUERDEN (app/lib/*.test.ts):   │
│   · lockdown-guard   : (A) migr >0044 sin grant anon/public               │
│                        (B) árbol público no toca .from(PII) ni .rpc(∉ALLOW)│
│   · anti-insinuacion : denylist de vocabulario sobre SUPERFICIES_* (incl.  │
│                        app/page.tsx + actualidad-module.tsx)               │
│   · bento-guards     : cero-hex + tipografía-whitelist + bare-var          │
├──────────────────────────────────────────────────────────────────────────┤
│  DATOS  — Supabase Postgres (Pro), migraciones 0001-0064                   │
│  Tablas normalizadas (NO-PII: proyecto/votacion/tramitacion_evento/        │
│  citacion/lobby_audiencia/proyecto_ficha…) + tablas PII (parlamentario/    │
│  cruce_senal/…). RLS habilitada SIN policies (deny-by-default) + revoke.   │
│  RPCs security-definer PII-safe, bounded (LIMIT + statement_timeout 5s).   │
│  cruce_senal = precedente de SEÑAL precomputada (0039) por pg_cron.        │
├──────────────────────────────────────────────────────────────────────────┤
│  INGESTA  — dos etapas LOCKED: fuente → R2 crudo → Supabase                │
│  GH Actions crons (.github/workflows/*.yml) corriendo CLIs TS/@obs con     │
│  SUPABASE_SECRET_KEY. leyes-weekly = L-V 20:00 UTC. Repo público =         │
│  minutos ilimitados. pg_cron interno para materializar cruce_senal.        │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities (nuevos vs existentes)

| Component | Responsibility | Nuevo / Modificado |
|-----------|----------------|--------------------|
| `actualidad_senal` (tabla) | Señales precomputadas del panel (movimiento, ingresos, urgencias, próximas votaciones, leyes nuevas) | **NUEVO** — espeja `cruce_senal` (0039) |
| `actualidad.materializar_senales()` (proc) | Full-rebuild transaccional de las señales, invocado por pg_cron/CLI | **NUEVO** — espeja `cruces.materializar_cruces()` |
| RPC(s) `actualidad_*` PII-safe bounded | Lectura del panel desde la landing | **NUEVO** — enhebra la aguja 0064 + allowlist |
| `app/app/page.tsx` | Landing = panel de actualidad (reemplaza bento producto-céntrico) | **MODIFICADO** (conserva BentoGrid/tiles/tokens) |
| `suscripcion` + `notificacion_envio` (tablas user-owned) | Primer dato DE USUARIO; RLS `to authenticated` real | **NUEVO** — primer uso de RLS con policies |
| Supabase Auth + `@supabase/ssr` + `middleware.ts` | Sesión de usuario (cookies) sobre Workers | **NUEVO** — primer auth del sistema |
| Cron de EGRESO (GH Actions) | Computa novedades por suscripción → envía email | **NUEVO patrón** (no es ingesta de dos etapas) |

---

## Recommended Project Structure (deltas sobre el repo real)

```
supabase/migrations/
├── 0065_actualidad_senal.sql          # tabla + proc materializador + pg_cron (espeja 0039)
├── 0066_actualidad_rpc.sql            # RPC(s) bounded PII-safe del panel (espeja 0064)
├── 0067_auth_suscripcion.sql          # suscripcion + notificacion_envio + RLS to authenticated
│                                       #   PRIMERA migración con CREATE POLICY (rol authenticated)
packages/
├── @obs/actualidad/                    # (opción A) CLI materializador reusable local+CI
│   └── src/run-actualidad-prod-cli.ts  # espeja run-tramitacion-prod-cli.ts
└── @obs/notificaciones/                # egreso: computa novedades por suscripción + envía email
    └── src/run-notificaciones-cli.ts
.github/workflows/
├── actualidad-refresh.yml              # (si materializa por CLI, no pg_cron) L-V intradía
└── notificaciones-daily.yml            # EGRESO diario: novedades → email (nuevo patrón)
app/
├── middleware.ts                       # NUEVO — refresco de sesión Supabase (auth)
├── lib/supabase-user.ts                # NUEVO — cliente @supabase/ssr (rol authenticated, NO service_role)
├── app/page.tsx                        # MODIFICADO — panel de actualidad
├── app/(auth)/…                        # login/verify/unsubscribe
├── components/panel/*.tsx              # NUEVO — tiles del panel (reusan BentoGrid/BentoTile)
└── lib/*.test.ts                       # guards extendidos (allowlist, anti-insinuación, bento)
```

### Structure Rationale

- **Materialización de señales:** hay DOS precedentes en el repo — pg_cron interno (`cruce_senal`, 0039) y CLI-en-GH-Actions (`run-tramitacion-prod-cli`). Recomendación: **CLI en GH Actions** para las señales (ver Decisión 1), reservando pg_cron solo si la señal es 100% SQL sin lógica TS.
- **Auth aislado en `supabase-user.ts`:** el cliente de usuario (`authenticated`, respeta RLS) NUNCA es el mismo objeto que `createServerSupabase()` (`service_role`, bypassa RLS). Separarlos evita que un guard/refactor confunda superficies.
- **`@obs/notificaciones` separado:** el egreso NO es ingesta; mezclarlo con conectores fuente→R2 contaminaría la regla de dos etapas.

---

## Decisión 1 — ¿Dónde viven las señales?

**Recomendación: tabla `actualidad_senal` precomputada por materializador full-rebuild (espejo `cruce_senal`/0039), + RPC(s) bounded PII-safe para leerla. NO agregación on-read pesada, NO vistas materializadas.**

### Opciones evaluadas contra el repo real

| Opción | Precedente en repo | Veredicto |
|--------|--------------------|-----------|
| (i) RPC de agregación **on-read** | `parlamentarios_publico_v2` (0064), `actualidad-module.tsx` lee `.from()` en vivo con `force-dynamic` | OK para señales BARATAS y acotadas (votado-esta-semana ya se hace así). NO para agregaciones caras (clustering por tema, "más movimiento" sobre 3.657 proyectos) — chocaría con `statement_timeout 5s` (0057/0064) |
| (ii) **Tabla precomputada** por cron (`actualidad_senal`) | `cruce_senal` (0039) + `cruces.materializar_cruces()` full-rebuild + pg_cron | **ELEGIDA.** El cómputo caro corre offline; la landing lee filas ya materializadas → RPC trivialmente bounded. Full-rebuild transaccional (delete+insert) da conteos/evidencia coherentes por corrida (D-11 de 0039) |
| (iii) Vistas materializadas + `REFRESH` | — (sin precedente en el repo) | RECHAZADA. Introduce un mecanismo nuevo sin precedente; `REFRESH MATERIALIZED VIEW CONCURRENTLY` compite por locks y no encaja con el idiom de proc-security-definer + provenance-inline que ya usa el repo |

### Trade-offs con el modelo bounded-RPC (statement_timeout 5s) y Pro-plan

- El panel lee de `actualidad_senal` (filas ya computadas) → la RPC de lectura es un `select … order … limit N` que cabe holgado en 5s. Mismo patrón que las 9 RPCs de 0064.
- El cómputo pesado (clustering, "más movimiento", ranking factual de recencia) vive en el materializador (offline), donde NO hay `statement_timeout 5s` de RPC pública. Puede tomar segundos sin afectar la superficie.
- **Clustering por tema:** los embeddings pgvector 768-dim ya existen (v6.1). El agrupamiento factual (jamás editorial — PROJECT §core) corre **offline en el materializador** y escribe `grupo_tema_id` a las filas de `actualidad_senal`, NO on-read. Evita HNSW-kNN por cada request de la landing.

### Frecuencia de cron y qué cambia en los YAML

- **Fuentes YA ingeridas:** el panel deriva de datos que `leyes-weekly` / `agenda-weekly` ya trajeron a Supabase. El materializador de señales **NO toca las fuentes** (lee Supabase) → NO aplica el rate-limit 2-3s del WAF ni robots.txt. Puede correr tan seguido como se quiera.
- **GH Actions scheduling:** cron mínimo es 5 min; el scheduler puede retrasarse en horas pico (best-effort, no garantizado — no apto para "tiempo real", sí para intradía). Repo público = minutos ilimitados (ya explotado por `leyes-weekly`).
- **YAML nuevo `actualidad-refresh.yml`:** clona el molde de `leyes-weekly.yml` (checkout/pnpm/node 22/install `--ignore-scripts`) pero **sin R2** (no descarga crudo) y con `SUPABASE_SECRET_KEY`+`SUPABASE_API_URL` solamente. Cambio de cadencia: `cron: "0 11,14,17,20 * * 1-5"` (varias veces intradía L-V) en lugar del único `0 20`.
- Si algún día una señal SÍ requiere ingesta nueva de fuente (p.ej. leyes recién publicadas en BCN que no estén ingeridas), ESO va por el pipeline de dos etapas normal (fuente→R2→Supabase), separado del materializador.

---

## Decisión 2 — Landing panel: qué se reemplaza vs conserva

### Conservar (LOCKED de v8.0/bento)

- **Primitivas:** `BentoGrid`, `BentoTile` (spans 2/4/6, variants), contenedor `max-w-[1120px]`, tokens `--radius-tile`/`--radius-control`, `import Link`, `force-dynamic`.
- **Régimen de diseño (candados que MUERDEN):** `bento-guards.test.ts` escanea `app/page.tsx` + `components/actualidad-module.tsx` por (I) cero-hex, (II) tipografía-whitelist, (III) bare-var. **El linter home SÍ muerde sobre la nueva landing** → todo tile nuevo del panel debe usar tokens (`bg-[var(--…)]`, `text-accent-product`) y cualquier arbitrary value nuevo (`text-[Npx]`) debe añadirse a `WHITELIST_ARBITRARIOS` con razón, o el CI falla.
- **Anti-insinuación:** `anti-insinuacion-guard.test.ts` ya incluye `app/page.tsx` y `actualidad-module.tsx` en `SUPERFICIES_HOME`. El copy del panel ("más movimiento", "urgencias") pasa por la denylist → prohibido vocabulario de ranking/juicio/causalidad. Conteos factuales en Mono en-dash, como `conteoVotacion`.

### Reemplazar

- El **hero producto-céntrico** ("Busca cualquier proyecto…") y las 3 entry-cards se degradan/reordenan; el protagonista pasa a ser "qué está pasando HOY". La SearchBox puede conservarse como tile secundario.
- Los 3 tiles de `actualidad-module.tsx` (votado/urgencias/frescura) son el **germen del panel** — se amplían con nuevas señales, no se botan.

### ¿Lee RPCs nuevas o reusa?

- **Reusa** el patrón `.from()` server-side de `actualidad-module.tsx` para señales baratas sobre tablas NO-PII (votado-esta-semana ya lo hace, sin RPC — decisión Phase 78 "cero RPC nueva").
- **RPCs nuevas allowlisted** SOLO para leer `actualidad_senal` (tabla precomputada) o para agregaciones que excedan un `.from()` simple. Cada RPC nueva enhebra la aguja LOCKED (ver Integración/invariantes).
- **Clustering:** corre offline en el materializador (Decisión 1), NO on-read. La landing lee `grupo_tema_id` ya escrito.

---

## Decisión 3 — Suscripciones + notificaciones (el cambio más estructural)

### 3a. Supabase Auth en App Router sobre OpenNext/Workers — VERIFICADO

- `@supabase/ssr` es el paquete vigente (auth-helpers deprecado). Usa cookies HTTP-only para la sesión; **requiere Next.js middleware** para refrescar el token (Server Components no pueden escribir cookies).
- **OpenNext Cloudflare:** usa runtime **Node.js** (nodejs_compat de Workers), NO Edge. **Soporta middleware estándar**. **CAVEAT verificado (docs OpenNext, 2026):** "Node Middleware (introducido en Next 15.2) NO está soportado aún" → el `middleware.ts` debe ser el middleware clásico (Edge-style API, que OpenNext ejecuta en Node), NO el nuevo `runtime: 'nodejs'` middleware. Confianza: MEDIUM (docs lo dicen; NO probado en este repo — flag para spike).
- **Impacto estructural:** el sitio HOY **no tiene `middleware.ts`** y todo es `force-dynamic` sin auth. Añadir auth introduce el PRIMER middleware del repo → riesgo de deploy nuevo (el build OpenNext ya es delicado: symlinks Windows, corre en Linux CI). **Recomendación: spike de deploy con un `middleware.ts` mínimo ANTES de construir la feature completa.**
- Cookies: el cliente de usuario (`@supabase/ssr` `createServerClient`) lee/escribe cookies vía las APIs de Next; en Workers las cookies funcionan bajo nodejs_compat. Verificar en el spike que `Set-Cookie` sobrevive el pipeline OpenNext.

### 3b. Tablas user-owned con RLS real — PRIMERA VEZ, convivencia con el lockdown-guard

- `suscripcion(user_id uuid references auth.users, tipo, target_id, …)` + `notificacion_envio(…)`. **Primera vez que el proyecto usa `CREATE POLICY` con filas accesibles** (hoy TODAS las tablas son deny-by-default sin policies).
- **Convivencia con `lockdown-guard` (Bloque A):** el guard bloquea `GRANT … TO anon`, `GRANT … TO public`, y `CREATE POLICY … TO anon` / `FOR SELECT TO anon` en migraciones >0044. **`authenticated` es OTRO rol** — el regex del guard matchea SOLO `anon|public` (líneas 221, 266-268 de `lockdown-guard.test.ts`). **Por lo tanto `CREATE POLICY … TO authenticated USING (auth.uid() = user_id)` NO dispara el guard.** Esto es correcto y deseado: `authenticated` es el rol de usuario logueado, distinto de la superficie anónima que el lockdown cierra.
  - VERIFICADO leyendo el regex: `grantToAnon = /grant\s+\S[\s\S]*?\bto\s+[\w,\s]*\b(anon|public)\b/` y `/create\s+policy\s+[\s\S]*?\bto\s+[\w,\s]*\banon\b/`. Un policy `to authenticated` no contiene `anon` ni `public` tras el `to` → 0 offenders.
  - CUIDADO: NO usar policies `to public` (dispara el guard, y `authenticated` no es `public`). El idiom seguro es policy explícita `to authenticated` con `USING (auth.uid() = user_id)` por operación (select/insert/update/delete).
- **Cliente de acceso:** las tablas user-owned se leen/escriben con el cliente **`authenticated`** (`@supabase/ssr`, respeta RLS), NUNCA con `service_role`. Si se accediera por `service_role` se bypasearía RLS y un usuario vería suscripciones de otro (AP2).
  - Decisión de guard: extender `lockdown-guard` para exigir que `suscripcion`/`notificacion_envio` se toquen SOLO vía `supabase-user.ts` desde la web (no `.from()` service_role público). No basta con añadirlas a `PII_TABLES` porque el cron de egreso SÍ las lee con service_role (job de servidor, fuera del árbol web).

### 3c. Envío de alertas = EGRESO (nuevo patrón, NO dos etapas)

- La regla de dos etapas (fuente→R2→Supabase) es de **ingesta**. El envío de emails es **egreso** y NO cabe en ella. Es un patrón nuevo LEGÍTIMO: "cron lee Supabase → computa novedades por suscripción → envía email".
- **Dónde corre:** GH Actions diario (`notificaciones-daily.yml`) con `@obs/notificaciones` CLI, MISMO molde que los crons existentes (Node 22, `SUPABASE_SECRET_KEY`). Alternativa: Supabase Edge Function + pg_cron + pg_net (patrón documentado Supabase). Recomendación: **GH Actions** (consistente con el repo; los Edge Functions no están desplegados hoy — deuda v1.0).
- **Proveedor de email:** Resend (SDK simple, DKIM/dominio verificable) es el estándar actual con Supabase. Confianza MEDIUM. La API key va en `.env` / secret de repo (constraint PROJECT §secrets).
- **Cómputo de novedades:** el cron compara el estado actual de `proyecto`/`tramitacion_evento`/`votacion` contra un cursor por suscripción (columna `ultima_notificacion` en `suscripcion`), espejo del patrón cursor de `leylobby_cursor_estado` (0053) y `leyes_rotacion_estado` (0054). Idempotencia: registra cada envío en `notificacion_envio` para no re-enviar.
- **Cliente en el cron:** el CLI de notificaciones corre con `service_role` (como todos los crons) → lee `suscripcion` bypasseando RLS, lo cual es correcto para un job de servidor (no es superficie de usuario). RLS protege la superficie WEB, no el job.

### 3d. Unsubscribe / verificación de email

- **Double opt-in:** al suscribirse, enviar email de verificación con token firmado; solo activar la suscripción tras click. Evita suscribir a terceros y spam.
- **Unsubscribe:** link con token opaco (no adivinable) en cada email → ruta pública `/desuscribir?token=…` que marca la fila inactiva. NO requiere login (one-click, requisito legal de emails). Esta ruta escribe con un RPC bounded security-definer específico (token → update), NO expone la tabla.
- **Ley 21.719 / minimización:** el email del usuario es dato personal → almacenar mínimo, con base de licitud (consentimiento explícito del double opt-in), y este subsistema entra en la pasada de asesoría legal (constraint PROJECT §legal).

---

## Decisión 4 — Build order sugerido

**Orden: (0) spike auth-on-Workers → (1) señales+panel intercalados → (2) notificaciones. Con checkpoint humano legal antes de exponer suscripciones.**

```
Fase 0  SPIKE deploy: middleware.ts mínimo + @supabase/ssr sobre OpenNext/Workers
        → de-risk el bloqueante estructural ANTES de construir nada encima.
        (Verifica cookies + Set-Cookie + middleware clásico en Node runtime.)
             │  (si el spike falla → replantear auth; el panel de datos NO depende de esto)
             ▼
Fase 1  SEÑALES (datos, empírico primero): SPIKE de qué es computable HOY
        → 0065 actualidad_senal + materializador + YAML refresh intradía
        → 0066 RPC(s) bounded del panel
             │
             ▼  (intercalado: cada señal validada → tile en el panel)
Fase 2  PANEL (frontend): app/page.tsx reemplaza bento → tiles del panel
        reusando BentoGrid; guards bento+anti-insinuación muerden; BrowserOS gate
        + benchmark UX vs senado.cl/camara.cl
             │
             ▼
Fase 3  NOTIFICACIONES (usuario): 0067 suscripcion+RLS to authenticated
        → auth UI (login/verify) → @obs/notificaciones egreso cron
        → unsubscribe/double-opt-in
             │
             ▼
        [CHECKPOINT HUMANO LEGAL] antes de exponer captura de emails al público
        (Ley 21.719 — acto humano, jamás un agente)
```

### Rationale del orden

- **Señales antes que panel** lo pide el operador (PROJECT §método: "Primero QUÉ, después CÓMO"). Pero **intercalar** panel por señal permite validar cada tile con BrowserOS sin esperar todas las señales.
- **Notificaciones al final:** es el cambio más estructural (auth, RLS real, egreso) y el ÚNICO con checkpoint legal humano → aislarlo evita que su riesgo bloquee el panel, que es puro dato ya ingerido.
- **Spike de auth en Fase 0** (paralelo a señales, sin dependencia): el mayor riesgo desconocido es OpenNext+middleware+cookies. De-riskearlo temprano evita descubrir en Fase 3 que el deploy no soporta la sesión.

---

## Anti-Patterns (específicos de este milestone)

### AP1: Agregar la landing/panel con clustering pgvector on-read
**Qué:** correr HNSW-kNN o "más movimiento sobre 3.657 proyectos" en cada request de `/`.
**Por qué mal:** choca con `statement_timeout 5s` de las RPCs públicas; la home es `force-dynamic` (una query cara por visita); DoS barato en repo público (Pitfall 12 del CLAUDE.md).
**En vez:** precomputar en `actualidad_senal` offline (materializador + pg_cron/CLI); la landing lee filas ya listas.

### AP2: Leer tablas user-owned (`suscripcion`) con service_role desde la web
**Qué:** usar `createServerSupabase()` (service_role) para mostrar "mis suscripciones".
**Por qué mal:** service_role bypassa RLS → un usuario vería/editaría suscripciones de otro. Es una fuga de dato de usuario.
**En vez:** cliente `@supabase/ssr` (`authenticated`) que respeta RLS `USING (auth.uid() = user_id)`. service_role SOLO en el cron de egreso (job de servidor, no superficie).

### AP3: Escribir el copy del panel sin pasar por la denylist anti-insinuación
**Qué:** tiles con "los proyectos más activos", "el diputado que más se reúne", ranking, %.
**Por qué mal:** `anti-insinuacion-guard.test.ts` (SUPERFICIES_HOME incluye page.tsx) falla el CI; y viola la regla rectora (riesgo existencial #2, "máquina de sospechas").
**En vez:** conteos factuales fechados con fuente/enlace, Mono en-dash; "N trámites esta semana" no "el más activo".

### AP4: Meter el envío de email en el pipeline de dos etapas
**Qué:** tratar el email como un "conector" con paso R2.
**Por qué mal:** dos etapas es INGESTA (fuente inmutable→R2→derivado). Email es EGRESO, no tiene fuente ni crudo que versionar.
**En vez:** patrón nuevo explícito `@obs/notificaciones` (cron lee Supabase → computa → Resend), idempotente vía `notificacion_envio` + cursor por suscripción.

### AP5: Hardcodear un arbitrary value nuevo en un tile del panel
**Qué:** `text-[17px]` o `gap-[20px]` ad-hoc en un tile nuevo.
**Por qué mal:** `bento-guards.test.ts` (II) falla el CI (no está en `WHITELIST_ARBITRARIOS`).
**En vez:** usar paso Tailwind estándar, `[var(--token)]`, o añadir el off-step a la whitelist con razón documentada.

---

## Integration Points

### Internal Boundaries (nuevas)

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Landing panel ↔ señales | `.from()` NO-PII barato + RPC bounded sobre `actualidad_senal` | Reusa patrón `actualidad-module.tsx`; clustering ya materializado |
| Materializador ↔ Supabase | proc security-definer (pg_cron) O CLI GH Actions (service_role) | Espeja `cruces.materializar_cruces()` (0039); NO toca fuentes → sin rate-limit |
| Web usuario ↔ `suscripcion` | cliente `@supabase/ssr` (`authenticated`, RLS `auth.uid()=user_id`) | PRIMER uso de RLS con policies; NUNCA service_role |
| Cron egreso ↔ email | `@obs/notificaciones` (service_role read) → Resend | Nuevo patrón EGRESO; idempotente vía `notificacion_envio` |
| Middleware ↔ sesión | `middleware.ts` clásico (Edge-style, ejecutado en Node por OpenNext) | Node Middleware 15.2+ NO soportado por OpenNext → usar el clásico |

### Invariantes LOCKED que toca cada pieza (y cómo se extienden sin romperlos)

| Invariante LOCKED | Pieza que la toca | Extensión segura |
|-------------------|-------------------|------------------|
| **Dos etapas fuente→R2→Supabase** | Señales (materializa desde Supabase) · Notificaciones (egreso) | NO la violan: no ingieren de fuente. Si una señal requiere fuente nueva → pipeline normal aparte |
| **PUBLIC_RPC_ALLOWLIST + bounded** | RPC(s) `actualidad_*` + RPC unsubscribe-por-token | Cada RPC nueva: migración >0044 cero-grant + security-definer + `set search_path=''` + `set statement_timeout='5s'` + LIMIT + añadir a `PUBLIC_RPC_ALLOWLIST` (guard Direction-B exige que exista la función) |
| **RLS deny-by-default (sin policies)** | `suscripcion`/`notificacion_envio` (SÍ policies, `to authenticated`) | Primera excepción: policies `to authenticated USING (auth.uid()=user_id)`. NO dispara lockdown-guard (matchea solo anon/public). `actualidad_senal` sigue deny-by-default + revoke |
| **lockdown-guard Bloque B (.from PII / .rpc allowlist)** | Cliente de usuario nuevo | El guard escanea `app/`; el cliente `authenticated` es legítimo. Extender guard: exigir que `suscripcion` se toque solo vía `supabase-user.ts` |
| **Camino A: web lee service_role** | Auth añade un SEGUNDO cliente (`authenticated`) | Coexisten: service_role para datos públicos (panel, señales), `authenticated` para datos de usuario. Documentar la dualidad en `supabase-user.ts` como se hizo en `supabase.ts` |
| **Candados bento (cero-hex/tipografía/bare-var) + anti-insinuación** | Panel (page.tsx + tiles nuevos) | Los guards YA muerden sobre page.tsx → tiles nuevos deben cumplir tokens/whitelist/denylist o el CI falla |
| **Checkpoint legal humano (Ley 21.719)** | Captura de emails (primer dato de usuario) | Gate humano antes de exponer suscripción pública; jamás lo flipea un agente (precedente MONEY/NET flags) |

---

## Scaling Considerations

| Escala | Ajuste |
|--------|--------|
| 0–1k usuarios | Materializador intradía L-V; cron notificaciones diario; Resend free/starter. Pro-plan holgado |
| 1k–100k | Señales precomputadas siguen O(1) por request; el cron de egreso se vuelve el cuello (N suscripciones × comparación) → batch + cursor + posible mover a pgmq/Edge Function; Resend de pago |
| 100k+ | Notificaciones event-driven (Database Webhooks al insertar `tramitacion_evento`) en vez de barrido diario; fan-out por cola |

### Primer cuello de botella real
El **cron de egreso** (computar novedades por suscripción). Mitigación desde el día 1: cursor `ultima_notificacion` por suscripción + registro idempotente en `notificacion_envio` → nunca recomputa histórico. NO el panel (lee filas precomputadas).

---

## Gaps / spikes recomendados

1. **Spike auth-on-Workers (Fase 0, bloqueante estructural):** `middleware.ts` mínimo + `@supabase/ssr` desplegado en OpenNext/Workers → verificar cookies `Set-Cookie` + refresh de sesión. Confianza actual MEDIUM (docs OpenNext dicen "middleware clásico sí, Node Middleware 15.2+ no"; NO probado en este repo).
2. **Spike señales computables (Fase 1, pide el operador):** qué señales salen de datos YA ingeridos vs requieren ingesta nueva (leyes recién publicadas BCN — ¿ingeridas?).
3. **Decisión materializador:** pg_cron (100% SQL, como 0039) vs CLI GH Actions (si hay lógica TS de clustering). Verificar si el clustering por embeddings es expresable en SQL puro o necesita TS.
4. **Proveedor email:** confirmar Resend vs alternativa; verificar dominio/DKIM y encaje con `.env`/secrets del repo. Confianza MEDIUM.

---

## Sources

- Repo real (HIGH): `app/app/page.tsx`, `app/components/actualidad-module.tsx`, `app/lib/supabase.ts`, `app/lib/lockdown-guard.test.ts`, `app/lib/bento-guards.test.ts`, `app/lib/anti-insinuacion-guard.test.ts`, `supabase/migrations/0039_cruce_senal.sql`, `0052_…`, `0064_bounded_rpc_statement_timeout.sql`, `.github/workflows/{leyes-weekly,roster-weekly,deploy-cloudflare,ci}.yml`, `.planning/PROJECT.md`, `CLAUDE.md`
- [Setting up Server-Side Auth for Next.js — Supabase Docs](https://supabase.com/docs/guides/auth/server-side/nextjs) — @supabase/ssr, middleware para refrescar sesión — HIGH
- [@opennextjs/cloudflare docs](https://opennext.js.org/cloudflare) — Node runtime, middleware estándar soportado, Node Middleware 15.2+ NO soportado — MEDIUM (no probado en este repo)
- [Sending Emails — Supabase Docs](https://supabase.com/docs/guides/functions/examples/send-emails) / [Resend + Supabase Edge Functions](https://resend.com/docs/send-with-supabase-edge-functions) — patrón de egreso email — MEDIUM
- [Scheduling Edge Functions / Supabase Cron](https://supabase.com/docs/guides/functions/schedule-functions) — pg_cron + pg_net, ≤8 jobs ≤10 min — HIGH

---
*Architecture research for: v10.0 panel de actualidad + notificaciones*
*Researched: 2026-07-23*
