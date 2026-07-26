# Phase 103: NOTIF P3a — Suscripciones + digest + guards authenticated + gate legal - Context

**Gathered:** 2026-07-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Primer dato de usuario del sistema: suscripciones a proyectos/parlamentarios + digest diario por email, con Supabase Auth real (OTP), RLS user-owned, el lockdown-guard extendido al rol `authenticated` desde el primer commit, y el gate legal 21.719 resuelto (pre-autorización del operador registrada en dossier). Incluye el patrón nuevo de cron EGRESO (GH Actions drena cola → Resend). NO incluye: web push, notificaciones instantáneas, cambios al plano service_role existente, ampliación de CSP.

</domain>

<decisions>
## Implementation Decisions

### Auth y login (Área 1 — aceptada completa)
- Gate 0 (provisión operador: publishable key `sb_publishable_…`, plantilla OTP `{{ .Token }}`, `wrangler secret put SUPABASE_PUBLISHABLE_KEY`) NO bloquea la corrida: se construye TODO (schema, guards, UI, digest) y el checkpoint de provisión + evidencia SC2 (curl block de 97-SPIKE-EVIDENCE.md) queda como checkpoint operador al final de la fase.
- Superficie de login: ruta `/cuenta` con OTP por email, reutilizando el patrón de `app/app/spike-auth/actions.ts`; la ruta `/spike-auth` se ELIMINA (era prueba no enlazada).
- Patrón de sesión LOCKED por Phase 97: `app/middleware.ts` Edge fail-open + `app/lib/supabase-user.ts` (publishable key, separado del service_role). CSP intacta (`connect-src 'self'` NO se amplía — auth 100% server-side, cero cliente-navegador Supabase). JAMÁS migrar a convención `proxy` de Next 16 ni resucitar anon legacy (vetado por 97).
- UI de suscripción: botón "Seguir" en ficha de proyecto y ficha de parlamentario (gated por flag NOTIF) + lista de suscripciones en /cuenta.

### Modelo de datos y seguridad (Área 2 — aceptada completa)
- Tres tablas nuevas (migraciones 0069+): `suscripcion` (user_id, tipo proyecto|parlamentario, objetivo_id, created_at), `notificacion_envio` (cola/log del digest, cursor idempotente), `consentimiento` (fecha, versión del texto, método — registro 21.719).
- RLS LOCKED (NOTIF-01): `to authenticated`, `auth.uid() = user_id`, deny-by-default, aisladas del plano service_role; pgTAP usuario-A-no-ve-B obligatorio.
- Lockdown-guard extendido al rol `authenticated` (allowlist de tablas-de-usuario + mutation self-check) como PRIMER commit de la fase (NOTIF-02).
- `notificacion_envio` la escribe SOLO service_role (cron EGRESO); `authenticated` jamás la toca (ni lectura).

### Digest por email (Área 3 — aceptada completa)
- Digest diario L–V, corre después del cron de datos; cursor idempotente sobre novedades (actualidad_senal/tramitación) de las suscripciones del usuario. JAMÁS instantáneo (promesa falsa bajo crons) — el copy lo declara.
- Proveedor: Resend free tier; techo 100 emails/día declarado en docs Y hard-cap en código.
- Doble opt-in (confirmación por email antes de activar), unsubscribe por token opaco en footer SIN login, preference center mínimo en /cuenta.
- PII del email: NUNCA a LLM, logs de CI, ni R2; redacción en cualquier log del cron EGRESO. El patrón EGRESO (cola en tabla → GH Actions → Resend, NO dos-etapas) se documenta como patrón nuevo.

### Gate legal 21.719 (Área 4 — decisión operador)
- El operador (abogado) PRE-AUTORIZÓ el checkpoint legal en la invocación de esta corrida (2026-07-26): "autorizo desde ya el checkpoint legal (soy abogado)". Se registra como sign-off humano en el dossier 21.719 — el agente solo documenta, la autorización es del operador.
- Flag NOTIF: deny-by-default en código, pero flip ON AUTORIZADO en esta corrida — la captura de emails queda expuesta en el deploy final de la fase.
- Alcance del dossier: DPA/subencargado Resend, base de licitud (consentimiento), derechos ARCO-P vía unsubscribe + preference center, política de retención.

### Claude's Discretion
- Naming exacto de columnas, shape del token opaco (opaco, no-JWT, no derivable), plantillas HTML del email, estructura interna de `@obs/notificaciones`, orden de planes tras el primer commit (guard).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/middleware.ts` — Edge fail-open, ya en master (Phase 97), NO tocar el patrón.
- `app/lib/supabase-user.ts` — `updateSession()` + `createUserClient()` con publishable key, separado del service_role.
- `app/app/spike-auth/actions.ts` — patrón OTP send/verify de referencia; la ruta se elimina al construir /cuenta.
- Lockdown-guard + mutation self-check YA EXISTEN (CI, `.github/workflows/ci.yml` + migraciones 0043/0044) — se EXTIENDEN al rol authenticated, no se reescriben.
- Crons GH Actions existentes (leyes-weekly, agenda-weekly, roster-weekly) como referencia de secrets/estructura; el digest es patrón EGRESO nuevo.
- Migraciones: última es 0068_coincidencia_votos_par.sql → las nuevas parten en 0069.

### Established Patterns
- pgTAP en `supabase/tests/` (pre y post-apply); fixtures se validan contra schema real.
- Flags deny-by-default con guard anti-flip (patrón VSIM 0068 / Phase 102).
- Deploy: build OpenNext en Docker Linux, wrangler local, purgar .pnpm-store del mirror, MSYS_NO_PATHCONV=1.
- Monorepo pnpm: `app/` + `packages/*`; nuevo package `@obs/notificaciones` sigue el layout de packages existentes.

### Integration Points
- Fichas de proyecto y parlamentario (botón Seguir, gated).
- `.env` local + GH secrets (RESEND_API_KEY nuevo; SUPABASE_PUBLISHABLE_KEY pendiente de provisión operador).
- 97-DEPLOY-RUNBOOK.md §"Estado de runtime pendiente" y 97-SPIKE-EVIDENCE.md §Reproducción SC2 = pasos exactos del checkpoint operador final.

</code_context>

<specifics>
## Specific Ideas

- Secuencia obligatoria de 97-FALLBACK-NOTIF-103.md: el spike quedó en rama A (verde estructural) — Phase 103 asume middleware+cookies SIN re-verificar SC1; solo la evidencia SC2 end-to-end queda para el checkpoint operador (junto con Gate 0 de provisión, al FINAL de la fase, no bloqueante).
- Techo Resend 100/día: si las suscripciones superan el techo, el digest degrada honesto (cola conserva pendientes para el día siguiente, jamás silencio).

</specifics>

<deferred>
## Deferred Ideas

- Web push / Service Worker (VAPID) — post-v10 (ya en Future Requirements).
- Notificaciones instantáneas — vetadas por diseño (crons).

</deferred>
