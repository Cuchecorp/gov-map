# Stack Research

**Domain:** v10.0 — Panel de actualidad legislativa (landing) + notificaciones por suscripción, sobre Observatorio del Congreso 360 (Next.js 16 App Router / OpenNext-Cloudflare Workers + Supabase Postgres/pgvector 0.8 + R2 + GH Actions)
**Researched:** 2026-07-23
**Confidence:** HIGH (señales + clustering); MEDIUM/HIGH (notificaciones — depende de decisión de seguridad del operador)

> **Regla de oro de este milestone:** casi todo lo que se necesita YA está en el sobre actual (Postgres + pg_cron + GH Actions + R2). Las UNICAS piezas net-new son: (1) un envío de email transaccional (Resend), y (2) el primer subsistema de datos-de-usuario (Supabase Auth + tablas con RLS real + publishable key). Todo lo demás son patrones SQL/cron sobre datos ya ingeridos. **No añadir infra de cola, cache ni broker.**

---

## Recommended Stack

### Core Technologies (nuevas / cambios)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Tabla de señales precomputada** (`senal_actualidad`, tabla normal Postgres) refrescada por **pg_cron** | Postgres 15+ (ya en Supabase) | (a) Señales cuantitativas del panel — movimiento, nuevos ingresos, urgencias, votaciones próximas, leyes publicadas | Cero infra nueva. El panel lee de una tabla plana e indexada (rápido, SSR-friendly bajo service_role), y un job la reconstruye. Preferible a **materialized view** aquí porque las señales combinan varias fuentes/ventanas y quieres control de orden/etiqueta/dedup; una tabla `TRUNCATE`+`INSERT` (o `UPSERT`) en una transacción da lecturas consistentes sin el lock de `REFRESH` no-concurrente ni la unique-index de `CONCURRENTLY`. |
| **Supabase Auth — Email OTP (6-dígitos) / Magic Link** | GoTrue actual (Supabase plataforma) | (c) Identidad del usuario que se suscribe | Sin password (el proyecto no quiere gestionar credenciales). OTP/magic-link es el flujo mínimo defendible. **Requiere Custom SMTP** (ver Resend) — el SMTP interno de Supabase da solo **2 auth-emails/hora** y no es para producción. |
| **Supabase publishable key** (`sb_publishable_…`) **+ RLS estricta** SOLO en el esquema/tablas de suscripción | Formato de llaves nuevo (GA 2026; legacy anon/service_role se retiran fin de 2026) | (c) Primer acceso de baja-privilegio del navegador, ACOTADO a `suscripcion`/`usuario_perfil` | Hoy la anon está MUERTA y el sitio corre service_role (bypassa RLS). Para datos de usuario necesitas lo contrario: privilegio bajo + RLS que muerde. La publishable key = mismo privilegio bajo que la anon legacy, con RLS `auth.uid() = user_id`. **Se introduce sin resucitar la anon**: es una llave nueva, y las tablas de suscripción son las UNICAS con policies `to authenticated`; el resto del esquema público sigue sin exposición anon. |
| **Resend** (email transaccional) | API v4 / SDK `resend` 4.x | (c) Entrega de: (1) los correos de auth de Supabase (OTP/magic link) vía Custom SMTP, y (2) el digest/alertas de suscripción vía API HTTP | Free tier **3.000 emails/mes, 100/día, 1 dominio verificado, logs 30 días** ([Resend quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits)). Cubre arranque holgado. SDK TS nativo, funciona desde GH Actions (Node) y desde Edge/Workers (HTTP). Un solo proveedor cubre AMBOS caminos (auth SMTP + digest API) → una sola verificación de dominio, una sola factura. |

### Supporting Libraries / patrones

| Library / patrón | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **k-means en SQL puro** (Lloyd sobre `vector` con `<=>`) o **extensión `kmeans` PGXN** | pgvector 0.8.x | (b) Agrupar por TEMA los proyectos con movimiento reutilizando los embeddings 768d ya existentes | k pequeño (p.ej. 8–15 clusters sobre las ~decenas/cientos de PLs con movimiento reciente), corrido **OFFLINE en el mismo cron de señales** con **seed fija** → determinista. No necesita índice; es un scan sobre un subconjunto pequeño. Guardar `cluster_id` + `centroid` en `senal_actualidad`. |
| **Etiqueta factual del cluster = moda de `materia`/`comisión`** (SQL `mode()`), NO LLM | — | (b) Nombrar el cluster sin editorializar | El proyecto ya tiene materia/comisión por PL. La etiqueta del cluster = la materia/comisión más frecuente del cluster (dato de la fuente, con fuente/fecha). Cero riesgo de "máquina de sospechas" ni de alucinación. Cae dentro de la regla rectora: label es dato, no interpretación. |
| **`web-push` / `pushforge`** | pushforge (zero-dep, Workers-compatible) | (c, FALLBACK) Web push VAPID como canal alternativo al email | Solo si el operador quiere push. `pushforge` corre en Cloudflare Workers/Deno sin deps nativas ([PushForge](https://github.com/draphy/pushforge)). Requiere Service Worker en el cliente + tabla `push_subscription`. **Recomendado DIFERIR** (ver "What NOT to Use" — CSP + service worker + gestión de VAPID añaden superficie; email cubre el caso 1). |
| **Supabase JS** (`@supabase/supabase-js`) v2 | ya en el repo | Cliente Auth (`signInWithOtp`, `verifyOtp`) en Route Handlers/Server Actions + cliente RLS con publishable key | Reutiliza el cliente existente; solo se añade el flujo de Auth. |
| **`resend` SDK** | 4.x | Envío del digest desde el cron (Node en GH Actions) | `import { Resend } from 'resend'`; una línea por email o batch. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **pg_cron** (ya instalado) | Scheduler del refresco de señales + clustering, y (opción B) del digest | Añadir 1–2 jobs: `senal-actualidad-refresh` (intradía, p.ej. cada 3–6 h L–V) y opcionalmente `digest-diario`. ≤8 jobs concurrentes, ≤10 min/job — el refresco es un agregado sobre datos ya en DB, sub-segundo. |
| **GitHub Actions cron** (ya en uso) | Alternativa/host del digest diario (Node + `resend`) | Si el digest requiere lógica TS compleja o llamar Resend con retry/observabilidad, correrlo en Actions (ya hay el patrón de crons semanales). GH Actions NO tiene el límite de 10ms CPU de Workers ni los 100/día de invocaciones. |

## Installation

```bash
# Frontend / Route Handlers (ya existe @supabase/supabase-js)
pnpm add resend                      # SDK email (digest + fallback)
# (opcional, solo si se hace web push)
pnpm add pushforge                   # VAPID web push, Workers-compatible

# Postgres (SQL, una vez) — pg_cron ya instalado; solo nuevos jobs + tablas
#   create table senal_actualidad (...);            -- tabla plana precomputada
#   create table usuario_perfil (...);              -- RLS: auth.uid()=id
#   create table suscripcion (...);                 -- RLS: auth.uid()=user_id
#   create table notificacion_pendiente (...);      -- cola de digest (tabla, no broker)
#   select cron.schedule('senal-actualidad', '0 */4 * * 1-5', $$ call refrescar_senales() $$);

# Supabase Dashboard (acción de operador, no código):
#   - Auth > Providers > Email: enable Email OTP / Magic Link
#   - Auth > SMTP: Custom SMTP = Resend (host smtp.resend.com, credenciales de Resend)
#   - Settings > API Keys: crear publishable key (sb_publishable_…) — NO reactivar anon legacy
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Tabla `senal_actualidad` precomputada por pg_cron | **Materialized view + `REFRESH CONCURRENTLY`** | Si la señal fuera UNA sola query determinista y no necesitaras dedup/orden/etiqueta cruzada. `CONCURRENTLY` exige unique index y recomputa todo; para señales multi-fuente la tabla + `TRUNCATE/UPSERT` en txn es más simple y evita el lock del refresh no-concurrente. |
| Tabla `senal_actualidad` precomputada | **SQL agregado directo en cada request** | Solo si las señales fueran triviales y de bajo costo. En la landing (primera pantalla, mucho tráfico) precomputar evita recalcular agregados por visita y da latencia estable bajo service_role. |
| k-means SQL con seed fija (determinista) | **Agrupación por vecindad HNSW** (kNN transitivo / componentes conexas sobre umbral de similitud) | Si prefieres clusters "orgánicos" sin fijar k. Riesgo: menos determinista y clusters de tamaño desigual. k-means con seed fija es reproducible y explicable — mejor para un producto que exige trazabilidad. |
| Etiqueta = moda de materia/comisión (factual) | **Label por LLM** (DeepSeek/MiniMax) | Solo si materia/comisión no discriminan bien el cluster Y con eval propio + guardrail anti-editorial + validación humana. Contradice la regla rectora si se usa por defecto → evitar en v10.0. |
| Resend (email) | **Supabase Auth interno SMTP** | NUNCA en producción para volumen: 2 auth-emails/hora. Solo dev. |
| Resend | **Amazon SES / Postmark / SendGrid** | SES si superas 3.000/mes de forma sostenida (más barato a escala, más setup). Postmark si necesitas mejor deliverability transaccional pagada. Para el arranque, Resend free basta. |
| Digest desde **GH Actions cron** | **pg_cron + pg_net → Edge Function** | Si quieres el digest 100% dentro de Supabase sin CI. Válido; pero GH Actions ya es el patrón de crons del repo y no tiene límites de CPU/tiempo de Edge — menos fricción reutilizar el mismo host. |
| Email (canal primario) | **Web push (pushforge/VAPID)** | Si el operador prioriza alertas instantáneas y hay apetito por Service Worker + CSP-tuning. Diferir a un milestone posterior. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Reactivar la anon key legacy** para leer tablas de suscripción | Resucitar la anon reabre superficie en TODO el esquema (RLS histórica no diseñada para anon); rompe el lockdown Camino A | **Publishable key nueva** (`sb_publishable_`) + RLS `to authenticated` SOLO en `suscripcion`/`usuario_perfil`; resto del esquema intacto |
| **service_role para escribir suscripciones desde el navegador** | service_role bypassa RLS → un cliente hostil podría suscribir/leer de otros usuarios; repo público = sujetos hostiles | **RLS real** con la publishable key: policies `auth.uid() = user_id`; o Route Handler server-side que valida la sesión y escribe con service_role tras `auth.getUser()` |
| **`response_format`/LLM para etiquetar clusters por defecto** | Editorializa; riesgo "máquina de sospechas" (riesgo existencial #2 del PROJECT) | Etiqueta factual = moda de materia/comisión (dato de fuente) |
| **Materialized view con `REFRESH` no-concurrente en tabla que la landing lee** | Toma `ACCESS EXCLUSIVE` lock → la landing se bloquea durante el refresh | Tabla precomputada con `TRUNCATE`+`INSERT`/UPSERT en una txn, o matview + `CONCURRENTLY` (con unique index) |
| **Web push como canal primario en v10.0** | Service Worker + VAPID + `connect-src`/`worker-src` en la CSP enforced (deploy `09f1d5c2`) + gestión de suscripciones caducadas = superficie nueva sin payoff inmediato | Email vía Resend primero; push como fase futura opcional |
| **BullMQ/Redis o cualquier broker para el digest** | Infra extra que contradice "todo en Supabase/CF/GH" | Tabla `notificacion_pendiente` como cola + cron que la drena (o pgmq si ya está instalado) |
| **Enviar el correo del usuario al LLM o loguearlo en claro en repo público** | El email es PII real bajo **Ley 21.719** (vigencia plena 2026-12-01) → dato personal, no "fuente pública" | Email vive solo en `auth.users` (Supabase) + `usuario_perfil`; nunca en logs de CI, nunca al LLM, nunca en R2 crudo |
| **Cloudflare Workers Cron para el digest pesado** | Free plan = 10 ms CPU/invocación + 100k req/día + sin retries automáticos | GH Actions (sin límite de CPU) o pg_cron+Edge |

## Stack Patterns by Variant

**Si el operador quiere el modelo de seguridad más simple y auditable (RECOMENDADO):**
- Toda escritura/lectura de suscripción pasa por **Route Handlers server-side**: `supabase.auth.getUser()` valida la sesión (cookie), y el handler escribe con service_role tras filtrar por `user.id`.
- Porque mantiene UN solo cliente privilegiado, no expone ninguna llave nueva al navegador, y el boundary es el mismo patrón "cada superficie valida" del PROJECT (Key Decision v9.0: cada RPC enhebra la aguja). RLS queda como defensa en profundidad, no como único muro.

**Si el operador quiere lecturas reactivas directas desde el cliente (realtime de "mis suscripciones"):**
- Emitir **publishable key** + RLS `auth.uid() = user_id` estricta SOLO en `suscripcion`/`usuario_perfil` (+ `revoke all` al resto para el rol `authenticated`).
- Porque habilita el cliente Supabase en el navegador con privilegio bajo real, sin resucitar la anon. Requiere `connect-src 'self' + *.supabase.co` en la CSP (ya está para el proyecto).

**Si el volumen de digest supera 100 emails/día:**
- Agrupar en **digest diario batched** (1 email por usuario con N novedades) y/o subir a Resend pago ($20/mes, 50k) o Amazon SES.
- Porque el free tier tope real es 100/día, no 3.000/mes; el digest batched mantiene 1 email/usuario/día → 100 usuarios activos caben en free.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `resend` 4.x | Node 18+ (GH Actions) / Fetch (Workers, Edge) | SDK usa fetch; funciona server-side en ambos hosts. Nunca desde el navegador (expone API key). |
| Supabase publishable key | RLS policies existentes | Comportamiento idéntico a anon legacy en permisos; convive con service_role sin afectarlo. Legacy anon/service_role válidas hasta que se desactiven manualmente (retiro fin 2026). |
| Custom SMTP (Resend) | Supabase Auth (GoTrue) | Sube el límite de auth-emails de 2/h (interno) a 30 nuevos usuarios/h (custom SMTP default, configurable). |
| pushforge | Cloudflare Workers / Deno / Node | Zero-dep, TS-first; si se adopta push. Requiere VAPID keypair en secrets. |
| k-means SQL / kmeans PGXN | pgvector 0.8.x `vector`/`halfvec` | Opera sobre columnas `vector(768)` ya existentes; `<=>` (cosine) como distancia — consistente con cómo se generaron los embeddings Gemini. |
| pg_cron (nuevos jobs) | pg_net (ya instalado) | Solo se necesita pg_net si el cron invoca una Edge Function; si el refresco es SQL puro (`call refrescar_senales()`), no. |

## Sources

- [Resend — account quotas and limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits) / [New Free Tier](https://resend.com/blog/new-free-tier) — free 3.000/mes, 100/día, 1 dominio, logs 30d — **HIGH**
- [Supabase — Understanding API keys](https://supabase.com/docs/guides/getting-started/api-keys) / [Migrating to publishable and secret keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys) / [Discussion #40300](https://github.com/orgs/supabase/discussions/40300) — publishable = privilegio bajo (RLS respetada), legacy retiro fin 2026, proyectos nuevos ya sin anon/service_role legacy — **HIGH**
- [Supabase — Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) / [Going into prod checklist](https://supabase.com/docs/guides/deployment/going-into-prod) — SMTP interno 2 auth-emails/h no apto prod; custom SMTP obligatorio; Resend/SES/Postmark soportados — **HIGH**
- [kmeans PGXN extension](https://pgxn.org/dist/kmeans/doc/kmeans.html) / [pgvector production 2026](https://devstarsj.github.io/2026/06/22/pgvector-postgres-vector-database-production-2026/) / [Encore — you probably don't need a vector DB](https://encore.dev/blog/you-probably-dont-need-a-vector-database) — k-means como window function en PG; pgvector < 10M vectores = simple/rápido; clusters semánticos emergen de embeddings — **MEDIUM/HIGH**
- [PostgreSQL — materialized views with concurrent refresh](https://www.postgresql.org/about/featurematrix/detail/materialized-views-with-concurrent-refresh) / [Stormatics — matviews when caching makes sense](https://stormatics.tech/blogs/postgresql-materialized-views-when-caching-your-query-results-makes-sense) — `CONCURRENTLY` requiere unique index + recomputa todo; refresh no-concurrente toma lock; pg_cron cadencia — **HIGH**
- [PushForge (GitHub)](https://github.com/draphy/pushforge) / [Cloudflare Agents — push notifications](https://developers.cloudflare.com/agents/guides/push-notifications/) — VAPID web push zero-dep en Workers/Deno; Push API soporte universal 2026 — **MEDIUM**
- [Cloudflare Workers Cron Triggers limits 2026 (Runhooks)](https://runhooks.app/blog/cloudflare-workers-cron-triggers-limits/) / [Crontap](https://crontap.com/blog/cloudflare-workers-cron-minute-limit) — free 5 crons, 100k req/día, 10ms CPU, sin retries — **MEDIUM/HIGH**

---
*Stack research for: v10.0 panel de actualidad + notificaciones (adiciones al sobre existente Supabase/Cloudflare/GH Actions)*
*Researched: 2026-07-23*
