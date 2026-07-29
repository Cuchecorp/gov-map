# Phase 124: SUPA-FIX — Migraciones aditivas a PROD - Context

**Gathered:** 2026-07-29
**Status:** Ready for planning
**Mode:** Smart discuss autónomo — decisiones del operador YA RESUELTAS en `.planning/PROMPT-v12.0-build-autonomo.md` (pasada 3). No se re-preguntó.

<domain>
## Phase Boundary

Corregir en PROD los defectos de estructura que la Phase 123 encontró, **sin nada destructivo** y con
no-regresión demostrable. Cada fix = **migración aditiva numerada desde `0073`**, aplicada por
`psql --single-transaction`, con pgTAP contra el **schema aplicado** y re-audit a 0 offenders.

**Fuera de alcance:** los 2 offenders con destino `supabase-architect` + checkpoint de operador
(`pgtap` en `public`, `vector`/`unaccent` en `public`) — se diseñan y se bloquean, no se aplican.
Los actos de operador (probe REST con anon key, Database Advisors, creación de bucket) tampoco.
</domain>

<decisions>
## Implementation Decisions

### Numeración — gotcha pagado en 123
La siguiente migración es **`0073`** por el **último archivo del repo**, NO por `schema_migrations`:
el ledger tiene un hueco de **15 migraciones** (`0026`, `0028`, `0030`, `0031`, `0052` y todo
`0059`–`0068`), y "contar archivos" tampoco sirve de control porque `0027`/`0029` no existen en
ninguna de las dos caras. Verificar contra `ls supabase/migrations`, jamás contra el ledger.

### Orden LOCKED de aplicación (lo exige el gate)
1. **`OFF-01`** — default ACL de `supabase_admin` sobre `public` (3 filas con `anon=`: `S`,`r`,`f`).
2. **`OFF-6-04`** — default ACL de `postgres` sobre `storage` (3 filas). **Antes de crear cualquier bucket.**
3. **`OFF-6-03`** — revoke de `net` a roles públicos. El verificador halló que **son 12 funciones**, no 2: incluye `http_delete` y `worker_restart`.

Estos tres van **antes que toda otra migración**, porque `OFF-01` es el único mecanismo que reabre
el boundary **sin línea de código**: mientras viva, todo objeto nuevo que 124 cree nace con grants a
`anon`. El orden no es preferencia, es correctitud.

### El escape de OFF-01 — no se traga en silencio
`postgres` **no es superusuario** (`rolsuper = f`), así que el
`alter default privileges for role supabase_admin` **probablemente falle por membresía**.
Si falla: se reclasifica a **`deuda-operador`** con pasos exactos zero-credential-value, se reporta
explícitamente, y **jamás se escala privilegio** para forzarlo. Fallar y declararlo es el resultado
correcto; fallar y omitirlo, no.

### Régimen de aplicación
- `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f <archivo>`. **JAMÁS `supabase db push`.** Jamás ecoar/expandir el valor de `SUPABASE_DB_URL`.
- **Pre-checks fail-closed** dentro de la migración: si el estado de partida no es el esperado, aborta la transacción en vez de aplicar sobre un supuesto falso.
- **BOM esquivado** (gotcha pagado): el archivo se escribe sin BOM o el `psql` lo tropieza.
- **pgTAP contra el schema APLICADO**, nunca contra el archivo, y cubriendo **específicamente el defecto** que la migración arregla — no un smoke test genérico.
- **Nada destructivo**: cero `DROP`, cero cambio de tipo, cero backfill. Si un fix lo exigiera, se delega el diseño a `supabase-architect` y se BLOQUEA en checkpoint de operador.

### Enganche mecánico con el guard (diseñado en 123)
Al aplicar **`OFF-4-01`** (el `revoke execute … from public` de `f_unaccent`), hay que **borrar su
entrada de `KNOWN_MISSING_REVOKE_FROM_PUBLIC`** en `app/lib/lockdown-guard.test.ts`. Si no se borra,
la suite se pone **roja** — y eso es el diseño, no un fallo. El guard muerde en ambas direcciones.

### Alcance de los offenders
De los 13 de 123: **8 con destino `124-aditivo`** (los que aplica esta fase), 2 `architect+checkpoint`
(fuera), 3 `guard` (ya cerrados por A4/A5/A6 en 123).

Los tres de exactitud del backlog (`B-01` cap de 1.000 en votos con distorsión de composición por
`order by fecha desc`; `B-02` denominador del tile *Por materia* 3.100/3.675; `B-03`) son **aditivos**
(RPC de conteo dedicada, firma v2 paralela — precedente 0060) y entran si el presupuesto de la fase
lo permite; si no, se declaran con handoff nombrado. Nunca se cierran en silencio.

### Claude's Discretion
- Cuántas migraciones y cómo agrupar los 8 offenders aditivos (una por offender vs. agrupadas por afinidad), mientras el orden LOCKED de los tres primeros se respete.
- Forma exacta de los pre-checks y de las aserciones pgTAP.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `123-SUPA-AUDIT.md` — los 13 offenders con riesgo/fix/query/destino, los 7 huecos y las 5 exigencias del gate.
- `123-SUPA-REVIEWER-VEREDICTO.md` — el veredicto verbatim (PASS con reservas) y el orden LOCKED.
- `.supabase-ops.yaml` — manifiesto bootstrapeado desde la DB viva (57 tablas, 42 funciones en `public`).
- Precedente de aplicación: migraciones `0055`–`0072` aplicadas por `psql --single-transaction` con pgTAP contra schema aplicado.
- `app/lib/lockdown-guard.test.ts` — guard 35 tests, con `KNOWN_MISSING_REVOKE_FROM_PUBLIC` (`:1098`), `PUBLIC_EXTENSION_ALLOWLIST` (`:1226`) y `PII_TABLES` + completitud (A7).

### Established Patterns
- RPC pública nueva = **aguja completa**: cero-grant (`>0044`), SECURITY DEFINER PII-safe con `search_path`, entrada en `PUBLIC_RPC_ALLOWLIST`, bounded (`LIMIT` + `statement_timeout`).
- Firma v2 **paralela** en vez de alterar la existente (precedente 0060): evita `42P13` y la re-arma de default privileges.
- `drop-before-create` + doble-revoke en toda redefinición de función.

### Integration Points
- Supabase ref `bctyygbmqcvizyplktuw`. Última migración en repo: `0072`.
- Suite `app/` **1590** + `tsc` 0 + guards de régimen (lockdown ahora 35) como línea base.
- El sitio lee con `service_role` (`rolbypassrls = t`) ⇒ el guard CI es el único control efectivo del boundary público. `anon`=3s / `authenticated`=8s de `statement_timeout` por rol; **`service_role` sin techo** — que es justo la ruta que usa el sitio.
</code_context>

<specifics>
## Specific Ideas

- `OFF-4-03`: 17 RPCs sin `LIMIT`/`statement_timeout`. El gate dice explícitamente **"NO lo bajen"** de severidad, porque `service_role` no tiene techo por rol.
- `OFF-4-02`: 7 funciones trigger con `EXECUTE TO PUBLIC` — hoy no explotables, pero un cambio de tipo de retorno las vuelve explotables en silencio.
- La re-corrida del audit debe dar **0 offenders en lo corregido**, demostrado con la misma consulta que los detectó — no con una nueva escrita para pasar.

</specifics>

<deferred>
## Deferred Ideas

- **`OP-1`** probe REST con anon key (decide si `OFF-6-01` escala a bloqueante) — **checkpoint de operador, respondido 2026-07-29: seguir con lo no bloqueado**.
- **`OP-2`** Database Advisors + `DEBT.md` (FKs sin índice 0001, índices sin uso/duplicados 0005/0009, `auth.*` sin `(select …)` 0003, bloat 0020) — deuda, no bloqueo.
- **`OP-3`** creación del bucket `crudo-servel` — deuda de operador (DDL de storage).
- **`OP-4`** destino de `pgtap` y de las suites pgTAP — `supabase-architect` + checkpoint.
- Los 4 huecos de auditoría que 123 declaró (pgmq/pg_cron al régimen, esquemas fuera de `public`, Edge Function `ingest-worker`, `graphql_public`) — auditoría, no fix.
- Deploy → **Phase 125**.
</deferred>
