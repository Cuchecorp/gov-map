# Phase 95: SEGURIDAD P3a — Guards extendidos sobre RPCs nuevas + bounded RPCs - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning
**Mode:** Smart discuss autónomo (recomendaciones auto-aceptadas por directiva de la corrida — PROMPT-v9.0 §Directivas)

<domain>
## Phase Boundary

Cada RPC/superficie nueva de P1/P2 (86-94) amplió la superficie de ataque bajo el modelo service_role (RLS bypasseada por diseño → cada RPC ES el boundary). Esta fase re-corre y EXTIENDE los guards existentes (lockdown/PUBLIC_RPC_ALLOWLIST, PII-guard, anti-insinuación, pgTAP) sobre lo nuevo, acota TODA RPC nueva contra DoS (LIMIT + statement_timeout + cap de match_count), y elimina el drift del allowlist en ambas direcciones. Los guards deben MORDER (mutation self-check) sobre las superficies nuevas — no pasar por vacío.

**Fuera de alcance:** DB VIVA y repo público (Splinter, secret-scan historial, CSP, headers, pnpm audit, B26) = Phase 96. Flags `*_PUBLIC_ENABLED`, sign-offs legales, rotación de credenciales = gates que el agente JAMÁS cruza.

**Modelo de amenaza (LOCKED, no OWASP genérico):** repo PÚBLICO en GitHub + sujetos capaces de hostilidad (parlamentarios) + service_role bypassa RLS → el guard ES el muro. La correctitud del dato ES la defensa legal.

</domain>

<decisions>
## Implementation Decisions

### Inventario de superficie nueva P1/P2 (objeto de la fase)
- RPCs nuevas v9.0 (migraciones 0055-0063): `buscar_proyectos_hibrido` (0055/0056/0057), `parlamentario_publico_v2`, `parlamentarios_publico_v2`, `militancias_de_parlamentario`, `comisiones_de_parlamentario`, `copartidarios_de_parlamentario`, `de_la_misma_zona`, `co_comisionados_de_parlamentario`, `coautores_de_parlamentario` (0060/0061), `lobby_menciones_de_boletin` (0062/0063).
- Superficies UI nuevas: /buscar híbrido + island filtros (87/88), deep-links (89), ficha bio/partido/cross-links (91), lobby materia+menciones (92), /agenda por día + island filtros (94).
- El plan DEBE re-derivar este inventario desde las migraciones y el código (no confiar en esta lista de memoria) — es exactamente el "allowlist sin drift" de SC#3.

### Bounded RPCs (SC#2)
- Gap CONFIRMADO por scout: `statement_timeout` existe SOLO en `buscar_proyectos_hibrido` (0057, patrón `set local statement_timeout` — template a reusar). Las 8 RPCs bio/cross-links (0060/0061) y `lobby_menciones_de_boletin` (0063) tienen LIMIT (50/20/1) pero CERO statement_timeout.
- Recomendación aceptada: migración nueva (≥0064) que re-emite las RPCs sin timeout con el patrón 0057 (`create or replace` con drop explícito previo si cambia la firma — idiom 42P13; NO alterar firmas → evitar re-armar default privileges). Doble-revoke + cero grant a anon VERBATIM (Block A >0044 del lockdown-guard).
- Cap de `match_count`: verificar que `buscar_proyectos_hibrido` capea el parámetro dentro de la función (no confiar en el caller); si no capea, incluirlo en la migración.
- Timeout recomendado: mismo valor que 0057 (consistencia); las RPCs baratas (limit 1/20/50) también lo llevan — es contra pathological plans, no contra volumen normal.
- Aplicación a PROD: DDL aditivo de RPCs públicas ya-servidas = precedente 0055-0063 (el agente aplica por `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f`, NUNCA `db push`) + pgTAP contra schema aplicado.

### Guards extendidos (SC#1) — extender, NO duplicar
- lockdown-guard (`app/lib/lockdown-guard.test.ts`): ya escanea migraciones por grants a anon/public y mantiene PUBLIC_RPC_ALLOWLIST (26 entradas, las nuevas YA enumeradas). Extender: asserts de bounded-ness (toda RPC nueva en migración final tiene statement_timeout + LIMIT) si el guard puede detectarlo estáticamente sobre el SQL de migraciones — decisión fina al planner.
- PII-guard CI: verificar que cubre las superficies nuevas (`.from` PII + `.rpc` no-allowlisted en app/ — direcciones ya existentes); las RPCs v2 devuelven partido DIRECTO por decisión operador 2026-07-21 (NO es PII: dato público del cargo electo); RUT/email/terceros siguen prohibidos — asserts sobre las firmas de retorno de las RPCs nuevas (pgTAP `proargnames`/columnas, idiom Phase 42).
- Anti-insinuación: ya extendido en 91-03 (cross-links), 92-03 (lobby), 94-02 (agenda) — RE-CORRER y verificar mutation self-check cubre cada superficie nueva; extender solo si el linter no cubre alguna superficie de P1 (/buscar híbrido, deep-links 89).
- pgTAP: gap CONFIRMADO por scout — búsqueda híbrida (0055-0057) NO tiene test pgTAP (`supabase/tests/` salta de 0052 a 0059). Escribir pgTAP para la RPC híbrida (security definer, PII-safe, bounded, search_path) + pgTAP de la migración nueva de timeouts. Correr contra schema APLICADO (runner real `psql -tA -f`, no `supabase test db` stale).

### Allowlist sin drift (SC#3) — bidireccional
- Dirección A (servida→enumerada): todo `.rpc()` en app/ ⊆ PUBLIC_RPC_ALLOWLIST — ya existe en guard CI; re-correr y verificar que caza las llamadas nuevas (91/92/94).
- Dirección B (enumerada→respaldada): toda entrada del allowlist debe corresponder a una función definida en migraciones (caza entradas stale/typo). Si no existe este assert, agregarlo al lockdown-guard (estático sobre `supabase/migrations/*.sql`).
- La comparación contra la DB VIVA (pg_proc real) es Phase 96 (re-derivación), NO esta fase.

### Mutation self-check (SC#4)
- Patrón ya establecido (68-01 anti-insinuación, 69-01 name-match, 70-02 frozen-reconciler): el test muta EN MEMORIA el input (ej. migración sintética con RPC sin timeout, entrada allowlist fantasma, `.rpc()` fuera de lista, término insinuante en superficie nueva) y aserta que el guard FALLA. Cero mutación de archivos reales.
- Cada guard extendido gana su mutation self-check sobre lo NUEVO específicamente (no basta el self-check viejo sobre superficies viejas).

### Claude's Discretion
- Estructura exacta de los asserts de bounded-ness (estático sobre SQL vs pgTAP contra schema) — elegir lo que muerda más y duplique menos.
- Valor exacto del statement_timeout (consistencia con 0057 como default).
- Si `match_proyectos` (RPC vieja tras flag) también gana timeout en la misma migración — recomendado sí, es barata y sigue servida.
- Orden de planes (guards primero vs migración primero) — respetar que pgTAP corre contra schema aplicado.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/lib/lockdown-guard.test.ts` — PUBLIC_RPC_ALLOWLIST (26 RPCs, nuevas ya enumeradas) + anonGrantOffenders (Block A: cero grant a anon/public >0044, multi-función, `to public`).
- `app/lib/anti-insinuacion-guard.test.ts` — linter 201 términos sobre texto renderizado post-stripTsComments, NEGACIONES_LOCKED restadas, mutation self-check; ya cubre lobby/cross-links/agenda.
- `app/lib/name-match-rut-guard.test.ts`, `money-antiflip-guard.test.ts` — patrón mutation self-check en memoria.
- `supabase/migrations/0057_busqueda_hibrida_statement_timeout.sql` — template exacto de `set local statement_timeout` en RPC security definer.
- `supabase/tests/0060/0061/0062*.test.sql` — pgTAP idiom del proyecto (proargnames, array_to_string, fixtures contra schema real).
- Runner pgTAP real: `PGCLIENTENCODING=UTF8 psql -tA -f` contra scratch/PROD aplicado.

### Established Patterns
- Migración aditiva de RPC: `create or replace` (drop explícito si cambia firma — 42P13 re-arma default privileges, evitar), doble-revoke, comentario de procedencia, pgTAP hermano.
- Guard = test vitest en app/lib que lee archivos del repo con fs, detector puro + mutation self-check en memoria.
- Apply a PROD por psql --single-transaction (precedente 0059-0063, el agente aplica DDL aditivo público; checkpoint operador solo cuando la fase lo marca).

### Integration Points
- `supabase/migrations/` — migración nueva ≥0064.
- `supabase/tests/` — pgTAP nuevos (0055-0057 gap + migración nueva).
- `app/lib/*guard*.test.ts` — extensiones; suite app (991+) + packages (1103) deben quedar verdes; `tsc --noEmit` limpio.
- CI: guards ya corren en la suite vitest de app/ (PII-guard en ci.yml).

</code_context>

<specifics>
## Specific Ideas

- "Los guards MUERDEN sobre lo nuevo, no pasan por vacío" — cada extensión demuestra con mutation self-check que detectaría la regresión específica nueva.
- Gap real #1 (scout): statement_timeout ausente en 9 RPCs nuevas (0060/0061/0063) → migración 0064.
- Gap real #2 (scout): pgTAP inexistente para búsqueda híbrida (0055-0057) — el producto estrella sin test de schema.
- Fixes latentes de 94 (WR-01/02 + a11y) ya en master viajan con el próximo deploy — esta fase NO deploya frontend salvo que un fix de guard lo exija; el deploy de cierre puede ir en 96.

</specifics>

<deferred>
## Deferred Ideas

- Auditoría DB VIVA (pg_proc vs allowlist, Splinter, grants reales) → Phase 96 (net-new, no duplicativo).
- Rate-limiting a nivel Worker/Cloudflare (WAF propio) — fuera de milestone; statement_timeout es la mitigación DoS de esta fase.

</deferred>
