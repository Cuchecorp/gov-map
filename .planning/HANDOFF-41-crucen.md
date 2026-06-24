# HANDOFF — Phase 41 (CRUCEN) — listo para ventana fresca

Pegá el bloque de abajo en una sesión nueva (tras `/clear`). Todo el andamiaje ya está commiteado (`ef4426f`): ROADMAP + REQUIREMENTS (CRUCEN-01/02/03) + `41-CONTEXT.md`.

---

Ejecuta **Phase 41 "CRUCEN — Habilitación de cruces (grant gated + dossier + fecha_captura)"** del Observatorio del Congreso 360 en modo autónomo. Es la deuda que destapó el code-review de Phase 37 (WR-02) + los bloqueos que dejó el gate legal de Phase 39: dejar la superficie de cruces LISTA para firmar/encender, **sin firmarla ni encenderla**.

## Dónde estamos
- Repo: `C:\Users\Carlo\OneDrive - pjud.cl\Documentos\GitHub\Observatorio` (git, branch master).
- Phase 37 (SURF ficha parlamentario) CERRADA: CrucesSection gated OFF, verifier PASS. Phase 39 gate legal: **F17 NET firmado approved** (2026-06-24); MONEY y CRUCES quedaron OFF.
- Phase 41 ya está scaffolded: `.planning/phases/41-crucen-*/41-CONTEXT.md` es la **fuente de verdad del diseño — NO re-diseñar**.

## Fuentes de verdad (LEE PRIMERO)
- `.planning/phases/41-crucen-habilitaci-n-de-cruces-grant-gated-dossier-fecha-capt/41-CONTEXT.md` (decisiones LOCKED + refs canónicas + los 6 gates).
- Memoria: `MEMORY.md` + `memory/v4-cruces-progreso.md` (Phase 37 WR-02, Phase 39 gate, gotchas pgTAP-vs-PROD y `revoke from anon,authenticated`).
- `.planning/ROADMAP.md` (Phase 41 Details), `.planning/REQUIREMENTS.md` (CRUCEN-01/02/03), `CLAUDE.md`, skill `supabase-ops`.
- Código a tocar/espejar: `app/components/cruces-de-parlamentario.tsx` + `app/components/provenance-badge.tsx`; `supabase/migrations/0040_cruces_rpc.sql` (RPC actual), `0039_cruce_senal.sql` (tiene `fecha_captura`), `0028_votos_instructivos.sql` (patrón drop+recreate por returns table), `0030_net.sql:250-254` (patrón grant a anon), `docs/legal/17-LEGAL-DOSSIER-NET.md` (espejo del dossier).

## Los 3 deliverables (ver 41-CONTEXT para el detalle)
1. **CRUCEN-01 (fix WR-02):** migración `0041` que proyecta `cruce_senal.fecha_captura` en el RPC `cruces_de_parlamentario` (⚠️ requiere **drop+recreate**, no `create or replace`, porque cambia la returns table; re-emitir `revoke execute from public` Y `from anon, authenticated` tras el recreate — sigue deny-by-default) + componente usa `s.fecha_captura` como `capturedAt` del badge (mata el stale-amber falso) + tipos + tests. Aplicar 0041 a PROD = **checkpoint operador**.
2. **CRUCEN-02 (grant gated):** migración `0042` con `grant execute on function public.cruces_de_parlamentario(text) to anon` — **escrita y commiteada pero NO aplicada** (apply = humano post-sign-off) + pgTAP que la verifica para el día del encendido + guard que impide aplicarla en autónomo.
3. **CRUCEN-03 (dossier legal):** `docs/legal/...-LEGAL-DOSSIER-CRUCES.md` espejo de 17-NET, `signoff: pending`, prep para firma humana (riesgo nuclear = composición lobby↔sector como insinuación; minimización Ley 21.719; doble candado). Firma = humana.

## Cómo proceder (research sonnet-swarm + validadores Opus, máxima calidad/granularidad)
1. **Research vía `/sonnet-swarm`** (o el skill `sonnet-swarm`): paraleliza 3 agentes Sonnet, uno por deliverable (CRUCEN-01 DDL drop+recreate+re-revoke; CRUCEN-02 grant gated+guard; CRUCEN-03 estructura del dossier), cada uno leyendo sus refs canónicas y devolviendo approach + landmines.
2. **Validadores Opus:** 1-2 agentes Opus revisan adversarialmente los hallazgos (especialmente: ¿drop+recreate es necesario?, ¿el recreate re-concede a anon por DEFAULT PRIVILEGES?, ¿el guard de no-aplicar-0042 es robusto?, ¿la proyección sigue PII-safe?).
3. Sintetiza en `41-RESEARCH.md` (incluye una sección `## Validation Architecture` con el mapa de tests, como en 37-RESEARCH.md) y deriva `41-VALIDATION.md` (Nyquist). Commitea.
4. `/gsd:plan-phase 41 --skip-research` → revisa el plan (gsd-plan-checker es Opus) → `/gsd:execute-phase 41`.
5. Cierra con SUMMARY + gsd-verifier (Opus); actualiza `memory/v4-cruces-progreso.md` + `MEMORY.md`; reporta.

## GATES LOCKED — INVIOLABLES (los 6 de 41-CONTEXT)
- **NUNCA flipear `crucesPublicEnabled`** ni defaultearlo ON. Encender = Phase 39 (humano).
- **NUNCA aplicar la migración de grant `0042`** a PROD (se escribe/commitea; apply = humano post-firma). El SUMMARY debe decir EXPLÍCITO que 0042 quedó sin aplicar.
- **NUNCA firmar el dossier** (`signoff: pending`).
- **CRUCEN-01 (0041)** SÍ es aplicable pero como **checkpoint operador** (`psql --db-url --single-transaction` + fila en `schema_migrations`, NUNCA `db push`). No la apliques solo salvo autorización explícita del operador en la corrida.
- Tras el drop+recreate de 0041, **re-emitir el `revoke execute from anon, authenticated`** (Supabase re-concede por DEFAULT PRIVILEGES; el pgTAP que asserta el deny de anon es lo único que lo caza).
- Señales factuales / anti-insinuación §9.1 intacta; PII-safe (sin rut/partido/donante_id).

## Convenciones de ejecución (de este repo)
- Monorepo pnpm (NO npm). Frontend tests desde `app/` con `npx vitest run`; `npx tsc -b`.
- Worktrees OFF → execute-phase serializa los plans en master; el executor secuencial es dueño de STATE.md/ROADMAP.md.
- Build OpenNext en Linux/Docker (no Windows) si hubiera que buildear; aquí probablemente solo tests.
- DDL a PROD: `psql --db-url --single-transaction` + `schema_migrations`; en Windows alimentar el INSERT de schema_migrations por stdin/heredoc con `PGCLIENTENCODING=UTF8` (gotcha multibyte).
- pgTAP-vs-PROD destapa bugs que el mock NO ve (grants/FKs/constraints) — no confiar en "verificado localmente" para el deny-by-default.

Al terminar, reporta el estado y el próximo checkpoint humano (aplicar 0041 si no se hizo; firmar el dossier de cruces + aplicar 0042 + flip del flag = el día del encendido).

---
