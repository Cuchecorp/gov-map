# Runbook — backfill masivo de noticias (LOCAL, jamás GH Actions)

**Regla LOCKED (CLAUDE.md):** backfill masivo = corrida LOCAL del operador. El cron
`news-daily` solo hace novedades incrementales acotadas (cap 500 llamadas de clasificación).

## Precondiciones

- `.env` con `SUPABASE_URL`/`SUPABASE_API_URL`, `SUPABASE_SECRET_KEY`, `R2_*`,
  `DEEPSEEK_API_KEY`.
- `packages/news/src/eval/veredicto-135.json` presente con `eleccion` no nula (el CLI de
  clasificación NO corre sin vara aprobada).

## Corrida (idempotente y reanudable)

```bash
# 1. Ingesta (R2 + Supabase). Re-corrida sin novedades = [skip] sin tocar la fuente.
set -a && source .env && set +a
pnpm --filter @obs/news exec tsx src/run-news-cli.ts

# 2. Clasificación de pendientes. Cap duro 500/corrida: para backfills grandes, REPETIR el
#    comando hasta que reporte procesadas=0 — cada corrida toma el siguiente tramo pendiente
#    y escribe su propia fila en llm_ledger (conteo consultable por run_id).
pnpm --filter @obs/news exec tsx src/clasificador/clasificar-noticias-cli.ts
```

## Verificación post-corrida

```sql
-- estados: pendiente debe tender a 0; clasificada/descartada crecen
select estado, count(*) from noticia group by estado;
-- causas de rechazo consultables
select rejection_stage, count(*) from noticia_dead_letter group by rejection_stage;
-- gasto por corrida
select run_id, modelo, llamadas from llm_ledger order by created_at desc limit 10;
```

## Reanudación tras un corte

Nada que limpiar: el clasificador solo lee `estado='pendiente'`; lo ya clasificado o
descartado no se reprocesa; el ledger registró lo consumido (se escribe aunque la corrida
aborte a mitad). Repetir el comando.
