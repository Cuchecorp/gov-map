---
phase: 11
plan: 01
subsystem: db-schema-lobby
tags: [migration, rls, deny-by-default, pii, lobby, pgtap, security-definer-rpc]
requires:
  - "supabase/migrations/0018_piso_pii.sql (convención deny-by-default)"
  - "supabase/migrations/0020_parlamentario_publico.sql (patrón RPC security definer)"
  - "supabase/migrations/0010_agenda.sql (patrón tabla public-read)"
  - "tabla parlamentario (FK destino del sujeto pasivo + del marcador de ingesta)"
provides:
  - "lobby_audiencia (hecho público, public-read, PK Identificador estable)"
  - "lobby_contraparte (sub-maestra deny-by-default, FK a audiencia)"
  - "lobby_de_parlamentario(text) (RPC público security definer)"
  - "lobby_ingesta_estado (marcador de ingesta por-parlamentario, public-read)"
affects:
  - "Plan 11-02 (@obs/lobby writer escribe estas tablas)"
  - "Plan 11-03 (ficha /parlamentario/[id] lee vía lobby_de_parlamentario + lobby_ingesta_estado)"
tech-stack:
  added: []
  patterns:
    - "RLS deny-by-default + revoke explícito anon/authenticated (cierra default privileges del proyecto)"
    - "RPC security definer set search_path='' como único canal público a una tabla deny-by-default"
    - "provenance inline NOT NULL (origen/fecha_captura/enlace)"
    - "FK de identidad nullable, poblado solo si confirmado (IDENT-12)"
key-files:
  created:
    - "supabase/migrations/0021_lobby.sql"
    - "supabase/tests/0021_lobby.test.sql"
  modified: []
decisions:
  - "lobby_contraparte deny-by-default requiere revoke explícito anon/authenticated: este proyecto Supabase concede por DEFAULT PRIVILEGES todos los privilegios a anon en cada tabla nueva de public; RLS sin policy niega filas pero el privilegio seguía presente (LEGAL-03 exige ambos)"
  - "Identificador de leylobby ({INST}AW{N}) es la PK natural de la audiencia, NUNCA el número de URL del listado (Pitfall 1)"
  - "contraparte_id es NULL por construcción y NO es FK a parlamentario; un tercero nunca se enlaza a una persona por adivinanza (Pitfall 4)"
  - "lobby_ingesta_estado distingue 'no ingestado' (fila ausente) de 'ingestado, cero confirmadas' (fila presente) — resuelve Open Question 3"
metrics:
  duration: 6min
  tasks: 3
  files: 2
  completed: 2026-06-19
---

# Phase 11 Plan 01: Migración 0021 Lobby (audiencia pública + contraparte deny-by-default + RPC + marcador) Summary

Migración 0021 que crea el destino de datos de la Fase 11: `lobby_audiencia` (hecho público de la reunión, public-read, keyed por el `Identificador` estable de leylobby), `lobby_contraparte` (sub-maestra deny-by-default de terceros, FK a la audiencia y nunca a una persona), el RPC público `lobby_de_parlamentario` (security definer, único canal a la contraparte, solo audiencias confirmadas) y `lobby_ingesta_estado` (marcador para los tres estados honestos de la ficha) — aplicada al remoto sa-east-1 con pgTAP 19/19 verde.

## What Was Built

- **`lobby_audiencia`** — public-read (espejo de `citacion`/0010). PK = `identificador` (clave natural estable de leylobby, no el número de URL). FK `parlamentario_id` nullable con `on delete set null` (sujeto pasivo, solo si confirmado). `mencion_sujeto`/`estado_vinculo`/`fecha`/`fecha_raw`/`materia`/`enlace_detalle`. Provenance inline NOT NULL. Policy SELECT a anon + grant SELECT + índice por `parlamentario_id`.
- **`lobby_contraparte`** — sub-maestra deny-by-default (copia la convención de 0018). FK `identificador` → `lobby_audiencia` (no a parlamentario). `nombre`/`rol default ''`/`representado_text`/`contraparte_id` (NULL, uso interno, jamás por adivinanza). Provenance inline NOT NULL. `unique (identificador, nombre, rol)`. RLS habilitada SIN policies **+ `revoke all from anon, authenticated`** (defensa en profundidad — ver Deviations). Sin columna RUT.
- **`lobby_de_parlamentario(text)`** — RPC `language sql stable security definer set search_path = ''`. Proyecta solo campos que la fuente publica (sin `contraparte_id`, sin RUT), join audiencia←contraparte, `where parlamentario_id = p_id` (solo confirmadas). `revoke execute from public` + `grant execute to anon`.
- **`lobby_ingesta_estado`** — marcador public-read: PK `parlamentario_id` → parlamentario, `ingestado_hasta date`, `fecha_captura`. Fila presente = ya corrió la ingesta; ausente = no ingestado.
- **`0021_lobby.test.sql`** — 19 aserciones pgTAP: existencia + RLS de las 3 tablas; contraparte deny-by-default (cero policies + sin grant SELECT anon); audiencia public-read (policy + grant); provenance NOT NULL (origen/enlace ×2 tablas); sin FK contraparte→parlamentario; FK sujeto-pasivo nullable; RPC existe + security definer + grant execute anon.

## Operator Checkpoint (Task 3): APLICADO + pgTAP VERDE

El remoto sa-east-1 fue alcanzable (igual que en 09-03/10). Se extrajo `SUPABASE_DB_URL` con node (esquivando el BOM de `.env`, Pitfall 5) y se aplicó 0021 vía `psql --single-transaction`. La prueba pgTAP corrió contra el schema aplicado: **19/19 PASS**. No quedó como verificación humana diferida — se completó en este entorno.

Confirmado contra el schema aplicado: `anon` NO tiene grant SELECT sobre `lobby_contraparte` (tras el revoke); SÍ sobre `lobby_audiencia`; el RPC es security definer con EXECUTE para anon.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/Security] `revoke all` explícito anon/authenticated en `lobby_contraparte`**
- **Found during:** Task 3 (pgTAP contra el schema aplicado — assertion 8 FALLÓ en la primera corrida).
- **Issue:** El proyecto Supabase concede por `ALTER DEFAULT PRIVILEGES` todos los privilegios de tabla a `anon`/`authenticated` sobre CADA tabla nueva en `public`. Por eso `anon` heredó SELECT sobre `lobby_contraparte` aunque la migración nunca lo otorgó. La RLS sin policy niega las FILAS, pero LEGAL-03 (y el pgTAP) exigen que el PRIVILEGIO tampoco exista (defensa en profundidad). Nota: las tablas PII previas (incl. el exemplar `pii_contraparte_declaracion`/0018) tienen el mismo grant heredado — descansan solo en la RLS; ver Threat Flags.
- **Fix:** Añadido `revoke all on lobby_contraparte from anon, authenticated;` a la migración; aplicado al remoto; pgTAP re-corrido 19/19 PASS.
- **Files modified:** `supabase/migrations/0021_lobby.sql`
- **Commit:** 33aca27

**2. [Rule 1 - Bug] `plan(18)` → `plan(19)` en el pgTAP**
- **Found during:** Task 3 (`finish()` reportó "planned 18 but ran 19").
- **Issue:** El `plan(N)` estaba subcontado por una aserción.
- **Fix:** `plan(19)`. Sin warning de plan-mismatch tras la corrección.
- **Files modified:** `supabase/tests/0021_lobby.test.sql`
- **Commit:** 33aca27

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: default-privileges-on-pii | supabase/migrations/ (tablas PII previas) | El proyecto concede por default todos los privilegios a anon/authenticated en tablas nuevas de `public`. Las tablas PII deny-by-default existentes (`pii_contraparte_declaracion`/0018, `parlamentario`) descansan solo en la RLS para negar a anon; el privilegio de tabla sigue concedido. 0021 lo corrige para `lobby_contraparte` con `revoke`. Recomendación para el verificador/operador: evaluar un `revoke all from anon, authenticated` retroactivo sobre las tablas PII previas (o un ALTER DEFAULT PRIVILEGES que no conceda a anon) como hardening de LEGAL-03. No bloquea la fase (la RLS sigue negando las filas), pero la defensa en profundidad no estaba completa. |

## Decisions Made

- Deny-by-default real = RLS-on + cero policies + `revoke all from anon, authenticated` (no basta el "no grant"; hay que revocar el default heredado). Patrón a copiar en Phases 12/14/15.
- `Identificador` ({INST}AW{N}) como PK natural de la audiencia; el número de URL del listado es un artefacto inestable (Pitfall 1).
- `contraparte_id` NULL por construcción, nunca FK a parlamentario, nunca por adivinanza de nombre (Pitfall 4).
- `lobby_ingesta_estado` minimal (FK + fecha, public-read) resuelve el gap de `VotosView.noIngestado` (Open Question 3).

## Self-Check: PASSED

- FOUND: supabase/migrations/0021_lobby.sql
- FOUND: supabase/tests/0021_lobby.test.sql
- FOUND commit: 472f3bd (Task 1 migración)
- FOUND commit: 74983a7 (Task 2 pgTAP)
- FOUND commit: 33aca27 (deviation fix)
- pgTAP 19/19 PASS contra el schema aplicado al remoto sa-east-1.
