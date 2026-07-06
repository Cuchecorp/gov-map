---
phase: 52-cruce2-cruces-nuevos
plan: 02
subsystem: cruces / RPC PII-safe
tags: [rpc, security-definer, camino-a, semana-iso, lobby, tramitacion, pgtap]
requires:
  - "citacion.semana_iso + citacion_punto.boletin (0010, public-read)"
  - "lobby_audiencia + parlamentario deny-by-default (0021/0005)"
  - "idiom RPC PII-safe doble-revoke (0047)"
provides:
  - "RPC lobby_en_tramitacion(p_boletin text) — yuxtaposición temporal lobby × tramitación PII-safe"
  - "pgTAP 0048 (contrato + fixture coincidencia por semana ISO)"
  - "lobby_en_tramitacion en PUBLIC_RPC_ALLOWLIST (consumible por 52-03)"
affects:
  - "52-03 (UI /proyecto/[boletin] consume la RPC verbatim; degrada honesta pre-apply)"
  - "52-06 (apply operador de 0048 por psql, acumulable con 0047)"
tech-stack:
  added: []
  patterns:
    - "RPC security definer PII-safe idiom 0047 (create or replace + doble revoke + CERO grant)"
    - "coincidencia por semana ISO con at time zone 'America/Santiago' explícito (Pitfall 2 timezone)"
key-files:
  created:
    - supabase/migrations/0048_lobby_en_tramitacion.sql
    - supabase/tests/0048_lobby_en_tramitacion.test.sql
  modified:
    - app/lib/lockdown-guard.test.ts
decisions:
  - "Función NUEVA → SIN drop previo (0047 dropeó solo por cambiar returns table existente)"
  - "Yuxtaposición pura: sin flag *_PUBLIC_ENABLED, sin cruce_senal, sin tipo_senal — recomputa en cada llamada"
  - "at time zone 'America/Santiago' explícito antes de to_char(...,'IYYY\"-W\"IW') — supuesto A1 load-bearing documentado, no confirmable sin PROD"
  - "SOLO audiencias confirmadas (estado_vinculo='confirmado' + parlamentario_id not null) — no fabrica identidad (IDENT-12)"
metrics:
  duration: ~6min
  tasks: 2
  files: 3
  completed: 2026-07-06
---

# Phase 52 Plan 02: RPC lobby_en_tramitacion — yuxtaposición lobby × tramitación por semana ISO Summary

RPC `lobby_en_tramitacion(p_boletin text)` security-definer PII-safe (espejo mecánico del idiom 0047) que devuelve las audiencias de lobby registradas en la MISMA semana ISO en que una comisión vio el boletín — yuxtaposición temporal pura (`citacion.semana_iso` × `citacion_punto.boletin` × `lobby_audiencia.fecha` normalizada a America/Santiago), sin flag nuevo, sin señal materializada, con doble revoke y CERO grant a anon (Camino A).

## What Was Built

### Task 1 — Migración 0048 (commit `b8bd655`)
- `create or replace function public.lobby_en_tramitacion(p_boletin text)` — función NUEVA, SIN drop previo.
- `returns table` de 7 columnas en el orden LOCKED del contrato: `parlamentario_nombre, camara, materia, fecha_reunion, semana_iso, comision, enlace_detalle`.
- `language sql stable security definer set search_path = ''` — lee `parlamentario` (deny-by-default) y `lobby_audiencia` INTERNAMENTE, emite solo derivado público (`nombre_normalizado` + `camara`; JAMÁS partido/rut/email).
- Join de semana ISO: `to_char((a.fecha at time zone 'America/Santiago'), 'IYYY"-W"IW') = c.semana_iso` (huso explícito, load-bearing — A1).
- Filtros: `cp.boletin = p_boletin and a.estado_vinculo = 'confirmado' and a.parlamentario_id is not null`; `order by a.fecha desc nulls last`.
- ACL determinista VERBATIM de 0047: `revoke all ... from public;` + `revoke all ... from anon, authenticated;` — CERO grant.
- Cabecera espejo de 0047: semántica anti-causal, checkpoint operador para apply (52-06, `psql --db-url --single-transaction`, nunca `db push`, PGCLIENTENCODING=UTF8), la 0048 es la siguiente tras 0047 en disco.

### Task 2 — pgTAP 0048 + allowlist (commit `d6668a0`)
- `supabase/tests/0048_lobby_en_tramitacion.test.sql`: `begin; select plan(9); ... finish(); rollback;`.
  - 6 asserts de contrato: (1) `has_function`, (2) `array_to_string(proargnames,',')` posicional pineado, (3) `prosecdef=true`, (4) `proconfig like '%search_path=%'`, (5) `not has_function_privilege('anon',...)` (Camino A deny), (6) returns `!~* '\y(partido|rut|email)\y'` (no-PII).
  - Fixture de coincidencia por semana: parlamentario + proyecto + citación en `'2024-W10'` + citacion_punto (boletín `BTEST-01`) + dos audiencias confirmadas (una `2024-03-06` en ISO week 10, otra `2024-04-10` en otra semana).
  - (7) count = 1 (solo la de la misma semana); (8) fila trae `nombre|semana_iso|comision` esperados; (9) caso negativo explícito (la audiencia de otra semana NO aparece).
- `app/lib/lockdown-guard.test.ts`: `"lobby_en_tramitacion"` añadido a `PUBLIC_RPC_ALLOWLIST` en orden alfabético (tras `lobby_de_parlamentario`, antes de `match_proyectos`). Único cambio al guard — la regla Block-A ya cubre el doble-revoke (cero grants → nada que allowlistear en grants).

## Verification

- Gate 0048: exactamente 2 `revoke all on function public.lobby_en_tramitacion(text) from`, 0 `grant ... to anon/public` — PASS.
- `pnpm exec vitest run lib/lockdown-guard.test.ts` → 8/8 verde.
- Suite completa app/ → 497/497 verde.
- `pnpm exec tsc -b` → limpio.
- pgTAP 0048 NO corre en vitest (es `.test.sql`, fuera del glob) — se corre por operador en 52-06 contra el schema aplicado.

## Deviations from Plan

None — plan ejecutado exactamente como fue escrito. (Nota: la suite completa corrió 497 tests en vez de solo el guard filtrado porque el flag de filtro `-- --run lib/lockdown-guard` no acotó vitest; el guard se re-corrió aislado a modo de confirmación — 8/8.)

## Threat Model Compliance

- **T-52-04 (EoP, re-abre EXECUTE a anon):** mitigado — doble revoke `from public` + `from anon, authenticated`; pgTAP assert (5); guard CI Block-A verde.
- **T-52-05 (Info Disclosure, filtra PII):** mitigado — returns table emite solo `nombre_normalizado` + `camara`; el cuerpo no selecciona partido/rut/email; pgTAP assert (6).
- **T-52-06 (Tampering, SQLi vía p_boletin):** mitigado — arg parametrizado; `search_path=''`; validación del path vive en 52-03.
- **T-52-07 (integridad narrativa causal):** transferido a UI (52-03) + documentado en la cabecera de 0048 (yuxtaposición temporal, no causal).

## Notes for Next Plans

- **52-03 (UI):** consume el contrato de 7 columnas VERBATIM; debe degradar honesta pre-apply (la RPC aún no existe en PROD) y renderizar el caveat anti-causal (T-52-07).
- **52-06 (apply operador):** aplicar 0048 por `psql --db-url --single-transaction` (acumulable con 0047), luego correr `supabase/tests/0048_lobby_en_tramitacion.test.sql` por `psql -tA -f` contra el schema aplicado. El supuesto A1 (timezone de `semana_iso`) se confirma en ese momento contra un par real `(fecha, semana_iso)`.
- Ningún flag `*_PUBLIC_ENABLED` tocado; ninguna migración aplicada a PROD; cero DDL ejecutado.

## Self-Check: PASSED

- FOUND: supabase/migrations/0048_lobby_en_tramitacion.sql
- FOUND: supabase/tests/0048_lobby_en_tramitacion.test.sql
- FOUND: app/lib/lockdown-guard.test.ts
- FOUND commit: b8bd655 (Task 1)
- FOUND commit: d6668a0 (Task 2)
