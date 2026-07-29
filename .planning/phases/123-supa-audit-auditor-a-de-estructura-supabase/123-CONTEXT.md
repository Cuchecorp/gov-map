# Phase 123: SUPA-AUDIT — Auditoría de estructura Supabase - Context

**Gathered:** 2026-07-29
**Status:** Ready for planning
**Mode:** Smart discuss autónomo — decisiones del operador YA RESUELTAS en `.planning/PROMPT-v12.0-build-autonomo.md` (pasada 3). No se re-preguntó.

<domain>
## Phase Boundary

Auditar la superficie de datos **como boundary de seguridad real**, contra la **DB VIVA** (no contra
los archivos de migración): cada tabla, política RLS, grant, RPC pública, entrada de
`PUBLIC_RPC_ALLOWLIST` y función `SECURITY DEFINER` con su `search_path`.

**Esta fase NO corrige nada.** Emite veredicto y lista de offenders con fix propuesto. Los fixes
son la Phase 124 (SUPA-FIX). La única excepción: **extender un guard** cuando el audit descubre un
punto ciego — eso sí se hace aquí (patrón "guard primero").

**Fuera de alcance:** aplicar migraciones (→124), cruces de datos (→122), deploy (→125).
</domain>

<decisions>
## Implementation Decisions

### El gate
- El subagente **`supabase-reviewer`** emite el veredicto y **ese veredicto ES el gate** — no es una opinión consultiva. La skill `supabase-ops` arranca con su HOOK de preflight (manifiesto `.supabase-ops.yaml`, fija el target, rechaza drift).
- `supabase-reviewer` **NO aplica ni arregla nada**: reporta y propone el fix. Si el audit descubre algo destructivo o de arquitectura, se delega el diseño a `supabase-architect` y se BLOQUEA en checkpoint de operador.

### Contra la DB viva, no contra las migraciones
- Toda aserción se demuestra con una **consulta a la DB viva**. Precedente rector: las migraciones **0059-0068 fueron aplicadas sin traza en `schema_migrations`** (retomada en 0069) — leer los archivos de migración da una foto FALSA.
- Filtro **`not exists (pg_depend deptype='e')` SIEMPRE** al enumerar objetos, para excluir lo que pertenece a extensiones (gotcha pagado en v9.0).
- **"0 offenders" se demuestra con la consulta que lo prueba, jamás se afirma.** Una sección sin la query es una sección inválida.

### Cobertura de la auditoría
Seis ejes, cada uno con su consulta verbatim y su tabla de resultados:
1. **Schema** — tablas y columnas; que ninguna tabla nueva quede sin RLS.
2. **RLS** — `rowsecurity` habilitada + políticas reales; ojo: la superficie pública real son las policies `to anon`, NO los grants por default (lección v4.0).
3. **Grants** — cero-grant a `anon`/`authenticated` sobre tablas (régimen `>0044`); `ALTER DEFAULT PRIVILEGES` no re-abriendo lo revocado.
4. **RPCs públicas** — bounded (LIMIT + `statement_timeout`), PII-safe, y coincidencia exacta con `PUBLIC_RPC_ALLOWLIST` en ambos sentidos (nada allowlisted que no exista; nada expuesto que no esté allowlisted).
5. **SECURITY DEFINER** — toda función secdef con `search_path` fijado (`search_path=''` o explícito).
6. **Buckets / keys / secrets** — que nada se exponga por la Data API sin querer.

### Régimen de acceso
- Solo `SELECT` read-only a PROD: `set -a; source .env; set +a` + `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "…"`. **Jamás ecoar ni escribir el valor de `SUPABASE_DB_URL`.**
- **Cero PII** en el artefacto: nombres de objeto y de columna, nunca valores.
- Cero DDL, cero DML, cero `supabase db push`, cero deploy, cero flags `*_PUBLIC_ENABLED` tocados.

### Guards
- Los guards existentes (**lockdown Block A–E**, **Direction-B allowlist**) se corren y deben quedar **verdes**.
- Si el audit encuentra un **punto ciego** —algo que un guard debería haber cazado y no cazó— el guard se **EXTIENDE en esta fase**, antes de que 124 toque nada. Patrón "guard primero" (Wave-0 de v10.0/v11.0).

### Claude's Discretion
- Granularidad de los planes y orden de los seis ejes.
- Formato exacto de las tablas de offenders, mientras cada fila lleve objeto + riesgo + fix propuesto + la query que lo detectó.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Skill `supabase-ops` (preflight + ruteo por nivel de riesgo) y subagentes `supabase-reviewer` (gate) / `supabase-architect` (diseño de lo destructivo).
- `PUBLIC_RPC_ALLOWLIST` en `app/lib/` con su guard Direction-B (14/14 en v9.0).
- Guards lockdown Block A–E (22 aserciones) — precedente v9.0/v11.0.
- Migraciones 0039–0072 como referencia del régimen: doble-revoke, cero-grant, secdef PII-safe con `search_path`, `statement_timeout='5s'`, `LIMIT` explícito, drop-before-create.

### Established Patterns
- RPC pública nueva = **aguja completa**: cero-grant (`>0044`), SECURITY DEFINER PII-safe con `search_path`, entrada en allowlist, bounded.
- pgTAP contra el **schema aplicado**, nunca contra el archivo.
- `psql --single-transaction -f` para aplicar; **jamás `supabase db push`**.

### Integration Points
- Supabase ref `bctyygbmqcvizyplktuw` (sa-east-1, pooler IPv4). Última migración en repo: `0072`.
- El sitio público lee con **service_role** (Camino A, v4.0) ⇒ RLS no lo protege: la PII está protegida por el **guard CI** que escanea `app/` por `.from` de tablas PII y `.rpc` fuera de la allowlist. Ese guard es parte del boundary y entra en la auditoría.
</code_context>

<specifics>
## Specific Ideas

- Demostrar explícitamente el gotcha `schema_migrations` incompleto: comparar lo que dice `schema_migrations` contra lo que existe de verdad en la DB viva, y dejarlo escrito.
- Verificar la allowlist en **ambos sentidos** (huérfanos y expuestos-no-allowlisted).
- Si aparece un offender que exige DROP, cambio de tipo o backfill → **no se diseña aquí**: se marca para `supabase-architect` + checkpoint de operador.
</specifics>

<deferred>
## Deferred Ideas

- Aplicar los fixes → **Phase 124** (migraciones aditivas numeradas desde 0073).
- Rotación de credenciales / carga de secrets → **deuda de operador viva** (B26, CF secrets), jamás acto de agente.
- Deploy → **Phase 125**.
</deferred>
