---
phase: 52-cruce2-cruces-nuevos
plan: 06
status: complete
completed: 2026-07-06
type: checkpoint:human-action
---

# 52-06 SUMMARY — Apply 0047 + 0048 a PROD (checkpoint operador)

**Resolución del checkpoint:** el operador autorizó explícitamente en sesión ("Autorizo — ejecuta tú ahora") y el apply se ejecutó bajo esa autorización, vía `psql "$SUPABASE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 -f`, NUNCA `supabase db push`. PGCLIENTENCODING=UTF8.

## Apply

| Migración | Resultado |
|---|---|
| `0047_rebeldias_honestas.sql` | `DROP FUNCTION` → `CREATE FUNCTION` → `REVOKE` ×2 — OK, una transacción |
| `0048_lobby_en_tramitacion.sql` | `CREATE FUNCTION` → `REVOKE` ×2 — OK, una transacción (aplicada 2 veces: inicial + enmienda `distinct`, ver Deviations) |

## pgTAP contra el schema aplicado

- **0047**: `1..11` — **11/11 ok** (contrato 6 + exclusión ausencias + dedupe + título hidratado + empate bancada + empate-con-duplicado CR-04).
- **0048**: `1..9` — **9/9 ok** (contrato 6 + coincidencia-por-semana deduplicada por citación + derivado público + exclusión otra-semana).

## Verificación Camino A (deny)

```
has_function_privilege('anon','public.lobby_en_tramitacion(text)','execute')      → f
has_function_privilege('anon','public.rebeldias_de_parlamentario(text)','execute') → f
```

## Stamping

`supabase_migrations.schema_migrations`: `0047|rebeldias_honestas` + `0048|lobby_en_tramitacion` insertadas (patrón version+name del repo).

## Smoke live post-apply

- `lobby_en_tramitacion('16743-04')` → 2 filas (audiencias reales 2026-W26, Hacienda, coincidencia por semana ISO). El carril 52-03 deja de degradar a null.
- `lobby_en_tramitacion('18216-05')` → 0 filas honesto (citación de 2026-W28, semana en curso sin audiencias registradas aún).

## Deviations (2, ambas dentro del checkpoint)

1. **Fixtures pgTAP no eran robustos contra PROD** (asumían DB limpia tipo `supabase test db`):
   - 0047: `voto.fuente_voter_id` es `NOT NULL` + `UNIQUE (votacion_id, fuente_voter_id)` en PROD y el fixture no lo proveía → se añadió un id de fuente distinto por fila (test-only).
   - 0048: el fixture usaba la semana `2024-W10`, con audiencias REALES en PROD → asserts (7)(8) arrastraban 9 filas. Fixture movido a una semana futura vacía (2091) con `semana_iso` derivada por la MISMA expresión de la RPC (sin hardcodear semana). La semántica ancla-semanal es la decisión LOCKED de 52-CONTEXT (§"quiénes se reunieron con diputados la semana en que la comisión vio el proyecto").
2. **Bug real detectado por smoke y corregido — dupes por citación múltiple:** un boletín citado 2 veces en la misma semana/comisión (caso real 16743-04: sesiones 23 y 24 jun) multiplicaba cada audiencia por citación (4 filas en vez de 2), inflando el conteo neutro "N audiencias" de la UI. Fix: `select distinct` en la RPC (unidad semántica = audiencia × semana, no audiencia × citación). 0048 enmendada y re-aplicada con `create or replace` (misma firma, idempotente, mismo checkpoint — file↔PROD en sync; el stamp no cambia), pgTAP reforzado con segunda citación misma-semana (assert 7 ahora cubre el dedupe).

## Suite

- app/: 535/535 verde (incluye lockdown-guard Block A sobre la 0048 enmendada: cero grant a anon/public).
- Ningún flag `*_PUBLIC_ENABLED` tocado. Cero policies nuevas. Cero grants.

## Addendum post-code-review (misma sesión, mismo checkpoint autorizado)

1. **CR-02 (data):** las 17.730 fechas de `lobby_audiencia` (origen camara-transparencia-lobby) estaban ancladas a medianoche UTC → bajo `America/Santiago` retrocedían un día y 1.014 (lunes) caían en la semana ISO anterior. Normalización one-time por psql (una transacción): `fecha := (fecha_UTC::date) at time zone 'America/Santiago'` → 0 filas UTC-midnight restantes. El parser (`parse-camara-lobby.ts`) quedó fijado a la misma convención (commit `308dc88`).
2. **WR-07 (RPC):** la 0048 se enmendó IN-PLACE (contrato 8 columnas: + `audiencia_id`; drop+recreate por 42P13; doble revoke intacto) y se RE-APLICÓ a PROD: pgTAP **10/10 ok** (incluye caso nuevo: dos audiencias reales mismo día/materia NO colapsan), anon deny `f`, smoke `16743-04` = 5 filas / 5 audiencia_id distintos. El stamp `0048` no cambia.

## Deuda restante (fuera de este plan)

- Deploy Cloudflare del frontend (carriles 52-03/52-04 + F51 viven solo en el repo hasta el próximo deploy; la RPC ya está viva en PROD para el server actual solo tras deploy).
- Rotar DB password (B26, previa).
- Contacto placeholder footer.
