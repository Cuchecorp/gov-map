# 90-BIO-LEDGER — Apply de 0059 a PROD + pgTAP + corrida LIVE de bio

**Fase:** 90 (PERSONAS P2a — Conector bio oficial dos-etapas + membresía de comisiones)
**Plan:** 90-03
**Ejecutado:** 2026-07-22

---

## 1. Apply de la migración 0059 a PROD

Migración **aditiva** (4 tablas nuevas deny-by-default, RLS on, cero grant anon) — dentro de la
autoridad del agente por precedente de pasada-1 (0055–0058). Sin riesgo destructivo.

**Precondición verificada** (idempotencia): antes de aplicar, `count(*)` de las 4 tablas en
`information_schema.tables` = **0** (schema limpio, nunca aplicada). Segura de aplicar UNA vez.

**Comando LOCKED** (NUNCA `supabase db push`; `SUPABASE_DB_URL` de `.env` BOM-safe):

```
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0059_bio_comisiones.sql
```

**Resultado:**

```
CREATE TABLE / ALTER TABLE / REVOKE   (× 4 tablas: parlamentario_bio, parlamentario_militancia, comision, comision_membresia)
```

Todo en una sola transacción (`--single-transaction` → rollback atómico si algo falla). Aplicada
**una sola vez**. **NO se re-aplica** (los `create table` no son re-ejecutables sin drop).

---

## 2. pgTAP contra el schema APLICADO

Prueba de que Postgres ejecutó el DDL (build/typecheck son falso-positivo, research Pitfall 6):

```
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0059_bio_comisiones.test.sql
```

**Resultado: 28 ok / 0 not ok** (`plan(28)`).

- Las 4 tablas existen (ok 1–4).
- RLS habilitada en las 4 (ok 5–8).
- Deny-by-default: cero policies en las 4 (ok 9–12).
- Deny-by-default: anon SIN grant SELECT en las 4 (ok 13–16).
- Provenance NOT NULL (origen/fecha_captura/enlace) (ok 17–25).
- Nullables honestos (profesion / hasta / cargo) (ok 26–28).

Confirma: **RLS on, cero policies, cero grant anon, provenance NOT NULL** contra el schema vivo.

---

## 3. Corrida LIVE acotada de bio

_(completado en Task 3 — ver sección abajo)_
