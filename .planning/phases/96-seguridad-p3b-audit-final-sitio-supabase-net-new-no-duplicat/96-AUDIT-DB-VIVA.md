# Auditoría DB VIVA — Phase 96 (SEC-03, porción DB)

**Fecha de auditoría:** 2026-07-23
**Herramienta:** psql 17.9 (client) sobre Supabase Postgres gestionado (PROD)
**Modo:** READ-ONLY absoluto — cero DDL, cero mutaciones
**Idiom de conexión:** `node -e "readFileSync('.env')"` — la connection string JAMÁS se imprime, logea, ni aparece en este documento
**Filtro obligatorio en toda query de funciones/grants:** `and not exists (select 1 from pg_depend d where d.objid = <obj>.oid and d.deptype = 'e')` (excluye las ~1200 funciones y 28 grants de pgTAP que contaminan toda query naive)

---

## Principio Rector

Las migraciones del repo (guardadas por los guards de Phase 95) NO garantizan el estado de la DB viva. El drift entre migraciones y PROD (una RPC agregada por dashboard, un grant residual) solo se caza aquí, contra `pg_proc`/`pg_class`/`pg_policy` de PROD. Bajo Camino A el cliente público usa `service_role` que bypassa RLS — el allowlist repo es la ÚLTIMA barrera. Esta auditoría verifica que la barrera está en sync con la realidad.

---

## 1. Superficie de Acceso Anon/Authenticated (4 checks de app)

| # | Check | Filtro pg_depend aplicado | Resultado REAL | Estado |
|---|-------|--------------------------|----------------|--------|
| (a) | Funciones `public` EXECUTABLE por anon/authenticated | Sí — excluye pgTAP | **0** | VERDE |
| (b) | Tablas de app con grant a anon/authenticated | Sí — excluye pgTAP | **0** | VERDE |
| (c) | Tablas `public` con RLS deshabilitada | Sí — excluye pgTAP | **0** | VERDE |
| (d) | Policies `to anon` en `public` | Sí — excluye pgTAP | **0** | VERDE |

**Sin filtro (ruido pgTAP):** (a) 1201 funciones, (b) 28 grants — todos de pgTAP, 0 de app.
**Conclusión:** 0 offenders de app confirmados en la superficie de acceso anon/authenticated.

### Queries Verbatim (copiables, con filtro)

**(a) Funciones public EXECUTABLE por anon**
```sql
select count(*) from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) ae on true
where n.nspname = 'public'
  and ae.grantee in (
    select oid from pg_roles where rolname in ('anon','authenticated','public')
  )
  and ae.privilege_type = 'EXECUTE'
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');
-- Resultado: 0
```

**(b) Tablas de app con grant a anon/authenticated**
```sql
select count(*) from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) ae on true
where n.nspname = 'public'
  and c.relkind in ('r','v','m')
  and ae.grantee in (
    select oid from pg_roles where rolname in ('anon','authenticated','public')
  )
  and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e');
-- Resultado: 0
```

**(c) Tablas public con RLS deshabilitada**
```sql
select count(*) from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and not c.relrowsecurity
  and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e');
-- Resultado: 0
```

**(d) Policies `to anon` en public**
```sql
select count(*) from pg_policy pol
join pg_class c on c.oid = pol.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and (pol.polroles @> array[(select oid from pg_roles where rolname='anon')]
       or pol.polroles = '{0}')
  and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e');
-- Resultado: 0
```

---

## 2. Re-derivación del Allowlist (PUBLIC_RPC_ALLOWLIST=26 vs pg_proc vivo)

### Query verbatim (secdef vivos de app)

```sql
select p.proname from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef = true
and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
order by 1;
```

**Resultado:** 25 funciones secdef de app (verificado HOY contra PROD).

### Cruce contra PUBLIC_RPC_ALLOWLIST (26 entradas en `app/lib/lockdown-guard.test.ts:165-192`)

| Categoría | Funciones | N | Interpretación |
|-----------|-----------|---|----------------|
| En allowlist Y secdef vivas | `agregado_por_contraparte`, `aportes_de_parlamentario`, `bienes_de_parlamentario`, `buscar_proyectos_hibrido`, `co_comisionados_de_parlamentario`, `coautores_de_parlamentario`, `comisiones_de_parlamentario`, `comparar_declaraciones`, `contratos_de_parlamentario`, `copartidarios_de_parlamentario`, `cruces_de_parlamentario`, `cruces_de_proyecto`, `de_la_misma_zona`, `declaraciones_de_parlamentario`, `lobby_de_parlamentario`, `lobby_en_tramitacion`, `lobby_menciones_de_boletin`, `militancias_de_parlamentario`, `parlamentario_publico`, `parlamentario_publico_v2`, `parlamentarios_publico`, `parlamentarios_publico_v2`, `subgrafo_red`, `votos_de_parlamentario` | 23 de 26 | OK — coinciden repo↔PROD |
| En allowlist pero INVOKER vivas (no secdef) | `buscar_citaciones`, `match_proyectos` | 2 de 26 | OK — reads PII-safe como invoker; siguen allowlisted legítimamente como barrera de repo |
| Secdef vivas NO en allowlist | `rebeldias_de_parlamentario`, `tasa_ausencia_comparada` | 2 | **Esperado, no un hueco:** carril de voto PODADO (Phase 68-03). Inertes-por-diseño: NO ejecutables por anon (count=0, check (a) verde). NO agregar al allowlist, NO dropear. |

**Conclusión:** cero drift no-explicado. El allowlist repo está en sync con la superficie viva ejecutable. Las 2 secdef fuera de allowlist son intencionales (exclusión deliberada, 68-03) y ya inertes (anon-executable=0).

---

## 3. Splinter — Lints de Seguridad de la DB viva

### 3a. search_path en funciones secdef

```sql
select p.proname, p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef = true
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
order by 1;
```

**Resultado:** Todas las 25 funciones secdef de app tienen `proconfig = {"search_path=\"\""}` (search_path vacío bloqueado). Este es el patrón seguro recomendado por Supabase (previene schema injection). **VERDE — sin advisory.**

### 3b. Tablas de app sin primary key

```sql
select c.relname from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and not exists (
    select 1 from pg_index i where i.indrelid = c.oid and i.indisprimary
  )
  and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e');
```

**Resultado:** 0 tablas de app sin primary key. **VERDE.**

### Resumen Splinter

| Check Splinter | Resultado | Severidad | Triage |
|----------------|-----------|-----------|--------|
| Funciones secdef con search_path inseguro | 0 — todas usan `search_path=""` | — | VERDE |
| Tablas de app sin primary key | 0 | — | VERDE |
| Funciones executable por anon | 0 (excl. pgTAP) | — | VERDE |
| Tablas con RLS deshabilitada | 0 (excl. pgTAP) | — | VERDE |

---

## 4. pgvector — Versión + GAP + Handoff

### Queries verbatim

```sql
-- Versión instalada
select extversion from pg_extension where extname = 'vector';
-- → 0.8.0

-- Versión disponible para update en la plataforma
select default_version from pg_available_extensions where name = 'vector';
-- → 0.8.0
```

**Resultado verificado HOY:**
- `extversion` instalada: **0.8.0**
- `default_version` disponible: **0.8.0** (la plataforma Supabase gestionada topa en 0.8.0)

### GAP: CVE-2026-3172

| Ítem | Valor |
|------|-------|
| Versión viva | 0.8.0 |
| Versión requerida | ≥0.8.2 (fix del CVE) |
| `alter extension vector update` alcanza ≥0.8.2? | **NO** — `pg_available_extension_versions` topa en 0.8.0 |
| Acción del agente | **NINGUNA DDL** — se documenta como handoff de operador |
| Ruta de remediación | Upgrade de plataforma Postgres en el dashboard de Supabase (acto de operador, posible downtime) |

### Exposición práctica (CVE-2026-3172) — matización

CVE-2026-3172 afecta pgvector ≤ 0.8.1. El advisory de pgvector (fuente: github.com/pgvector/pgvector) indica que la vulnerabilidad requiere capacidad de ejecutar SQL sobre la DB. En este proyecto:
- **0 funciones de app ejecutables por anon** (check (a) = 0 con filtro pg_depend)
- **0 tablas con RLS deshabilitada** (check (c) = 0)
- El cliente público usa `service_role` (gestionado server-side; las claves no se exponen al navegador)

**Conclusión de exposición:** La superficie de ataque del CVE requiere capacidad de ejecutar SQL arbitrario, que anon NO tiene en esta DB. La exposición práctica es **baja** mientras se mantiene el lockdown actual. El handoff permanece abierto hasta que Supabase publique ≥0.8.2 en su plataforma.

**Handoff de operador:** Ver `96-OPERATOR-HANDOFF.md` — checkpoint B27 (pgvector platform upgrade). El agente NO corrió `alter extension vector update` (sería DDL en fase read-only y fallaría silenciosamente).

---

## Resumen Ejecutivo

| Área | Resultado | Blocking |
|------|-----------|----------|
| Funciones public EXECUTABLE por anon (app) | **0** — VERDE | No |
| Tablas de app con grant a anon/authenticated | **0** — VERDE | No |
| Tablas public con RLS deshabilitada | **0** — VERDE | No |
| Policies `to anon` en public | **0** — VERDE | No |
| Allowlist drift no-explicado | **0** — 25 secdef vivos, todos explicados | No |
| Splinter: search_path secdef | **0 inseguros** — todas usan `search_path=""` | No |
| Splinter: tablas sin PK | **0** | No |
| pgvector gap ≥0.8.2 | Gap real — **handoff de operador** (platform upgrade) | No (exposición baja) |
| **BLOCKING items** | **NINGUNO** | — |

La DB viva está en el estado esperado post-0044/0045. El allowlist repo (26 entradas) está en sync con la superficie ejecutable real (25 secdef de app). Las 2 secdef fuera de allowlist (`rebeldias_de_parlamentario`, `tasa_ausencia_comparada`) son inertes por diseño (68-03). El único ítem abierto es el upgrade de pgvector, que es un acto de operador y tiene exposición práctica baja dado el lockdown.

---

*Generado por Phase 96 Plan 02 — agente READ-ONLY, cero DDL, connection string no impresa*
