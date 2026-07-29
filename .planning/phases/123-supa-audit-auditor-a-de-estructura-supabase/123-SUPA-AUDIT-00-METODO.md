---
fase: 123
fragmento: 00-metodo
estado: borrador
fecha: 2026-07-29
ancla_temporal: "2026-07-29 (select now()::date contra PROD; TimeZone de sesión = UTC; PostgreSQL 17.6)"
consumido_por: [123-02, 123-03, 123-04, 123-05, 123-06]
manifiesto_ssot: .supabase-ops.yaml
---

# 123 — SUPA-AUDIT · Fragmento 00: método, régimen y universo de ejes

> Fragmento rector de la Phase 123. Fija el **régimen de acceso**, el **vocabulario de veredicto**,
> la **plantilla de fila de offender** y el **universo cerrado de seis ejes** que los fragmentos de
> los planes 123-02/03/04 deben recalcular contra la **DB VIVA**. El plan 123-06 consolida y el
> subagente `supabase-reviewer` emite el veredicto — **y ese veredicto ES el gate**.
>
> **Régimen:** esta fase **no corrige** nada (única excepción: extender un guard, plan 123-05) y
> **no despliega** nada. Los fixes son la **Phase 124**; el deploy es la **Phase 125**.
>
> **SSoT del preflight:** el HOOK de la skill `supabase-ops` carga
> [`.supabase-ops.yaml`](../../../.supabase-ops.yaml), bootstrapeado en el plan 123-01 contra la DB
> viva. Si este fragmento y el manifiesto `supabase-ops.yaml` se contradicen, **se detiene el
> trabajo y se reporta el drift**; no se sigue con datos inconsistentes.

## 0.0 Régimen declarado

| Propiedad | Valor |
|-----------|-------|
| Método | **SQL verbatim read-only contra PROD** (`psql`) sobre los catálogos del sistema |
| Acceso a PROD Postgres | solo `SELECT`. **Cero DDL, cero DML**, cero `supabase db push`, cero `db reset` |
| Invocación psql | `set -a; source .env; set +a` y luego `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "<query>"` — **jamás se ecoa, expande ni escribe el valor de `SUPABASE_DB_URL`**; en todo artefacto de esta fase aparece solo el **nombre** de la variable |
| Fuente de verdad | la **DB VIVA**, nunca `supabase/migrations`. Ver §0.4: el ledger de migraciones miente |
| Filtro obligatorio | al enumerar objetos, **SIEMPRE** `not exists (select 1 from pg_depend d where d.objid=<oid> and d.deptype='e')` — excluye lo que pertenece a extensiones (gotcha pagado en v9.0) |
| Conteo por REST | **prohibido** (PostgREST capa a 1.000 filas). Todo conteo va por `psql -tA` |
| PII | **cero**: se registran **nombres de objeto y de columna** y agregados; **jamás valores** |
| Requests a fuentes gubernamentales | **cero** (camara.cl / senado.cl / BCN / leylobby **no se golpean**) ⇒ el rate-limit 2-3 s de CLAUDE.md **no aplica** a esta fase |
| Flags | **no se toca ningún `*_PUBLIC_ENABLED`**. Los gates se **observan**, no se cambian |
| Deploy | **no se hace en esta fase** (Phase 125) |
| Fixes | **no se hacen en esta fase** (Phase 124), salvo **extender un guard** (plan 123-05, patrón "guard primero") |
| Instalación de paquetes | **cero**. Un `npm/pnpm/pip/cargo install` en esta fase es offender del propio plan |

### 0.0.1 Ancla temporal (ejecutada, no asumida)

```bash
set -a; source .env; set +a
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "select now()::date, current_setting('TimeZone'), version();"
```

Salida real:

```
2026-07-29|UTC|PostgreSQL 17.6 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit
```

**Ancla temporal de la Phase 123 = `2026-07-29`** (TimeZone de sesión `UTC`, PostgreSQL **17.6**).
Todo veredicto de los fragmentos 01/02/03 es **a esta fecha y contra esta versión de motor**. La
versión importa: los catálogos consultados (`pg_proc.proconfig`, `pg_policies`, `pg_depend`) y la
semántica de `search_path=''` son estables en 15+, pero cualquier hallazgo que dependa de una
característica ≥16 debe decirlo explícitamente.

### 0.0.2 Objetivo del boundary auditado

La superficie auditada es el **boundary de seguridad de datos**: qué puede leer un cliente no
autenticado a través de la Data API de Supabase (`anon`), qué puede leer el sitio (que va con
`service_role`, §0.5), y qué protege cada capa. No se audita el frontend salvo el guard CI, que es
parte del boundary por la razón de §0.5.

## 0.1 Vocabulario de veredicto

Los **tres** valores LOCKED que usan TODOS los fragmentos de la fase. No se admite ningún cuarto
valor, ni prosa libre en la columna `veredicto`.

| veredicto | significado | qué queda registrado |
|-----------|-------------|----------------------|
| `conforme` | el eje cumple el régimen | la **query verbatim** que lo demuestra + su salida (o su recuento cero) |
| `offender` | se detectó una desviación | fila en la tabla de offenders (§0.2) con objeto, riesgo, **fix propuesto** y **destino** |
| `limite-declarado` | el eje **no es verificable** desde esta fase (falta de permiso, objeto fuera de alcance, herramienta no invocable por SQL) | **la evidencia del intento** (comando + error/salida) y el porqué |

**Regla dura (anti-"todo bien"), verbatim:**

> **"0 offenders" solo vale si la query que lo demuestra está transcrita verbatim en el fragmento.
> Una sección con `conforme` y sin bloque ```sql asociado es INVÁLIDA y el plan 123-06 debe
> rechazarla.**

**Corolario:** un `limite-declarado` **nunca** se rellena con una suposición. Cero fabricación: si
no se pudo verificar, se dice que no se pudo verificar y se muestra el intento.

## 0.2 Plantilla de fila de offender

Molde de tabla obligatorio para los fragmentos de 123-02/03/04. Columnas **exactas** y **en este
orden**:

```
| # | objeto (tipo · nombre) | eje | riesgo | fix propuesto | query que lo detectó (Q-NN) | destino |
```

| # | objeto (tipo · nombre) | eje | riesgo | fix propuesto | query que lo detectó (Q-NN) | destino |
|---|------------------------|-----|--------|---------------|-----------------------------|---------|
| *(ejemplo del molde)* | `función · nombre_rpc` | 5 | `search_path` no fijado ⇒ secuestro de resolución | `alter function … set search_path=''` | `Q-07` | `124-aditivo` |

Reglas del molde:

- **`query que lo detectó` NO contiene la query.** Contiene un identificador `Q-NN` que apunta a un
  bloque ```sql **numerado** más abajo **en el mismo fragmento**. Una query dentro de una celda
  destruye la tabla y deja de ser copiable/re-ejecutable.
- **`objeto`** lleva **tipo · nombre** (`tabla · voto`, `función · resolver_identidad`,
  `policy · nombre_policy on tabla`, `bucket · nombre`). Nunca un nombre pelado sin tipo.
- **`riesgo`** describe la **consecuencia**, no el síntoma ("PII legible por `anon`", no "falta
  policy").
- **`fix propuesto`** es SQL o acción concreta, **no aplicada aquí**.

**Vocabulario cerrado de `destino` — cuatro valores, ninguno más:**

| destino | cuándo |
|---------|--------|
| `124-aditivo` | el fix es una migración **aditiva** numerada desde `0073` (grant/revoke, `alter function … set`, policy nueva, índice) |
| `supabase-architect+checkpoint` | el fix exige **DROP**, **cambio de tipo** o **backfill** ⇒ NO se diseña aquí: se delega a `supabase-architect` y **BLOQUEA en checkpoint de operador** |
| `guard` | el hallazgo es un **punto ciego** de un guard existente ⇒ el guard se **EXTIENDE en esta misma fase** (plan 123-05), antes de que 124 toque nada |
| `deuda-operador` | rotación de credenciales, provisión de secrets, creación de buckets, flips legales ⇒ **jamás acto de agente** |

## 0.3 Universo cerrado — seis ejes y su asignación

Los seis ejes son el universo **completo** de esta auditoría. Ninguno queda huérfano; nada fuera de
esta tabla entra al veredicto de 123-06.

| eje | tema | plan |
|-----|------|------|
| 1 | **Schema** — tablas y columnas de `public`; que **ninguna** tabla quede sin RLS habilitada | **123-02** |
| 2 | **RLS** — `pg_class.relrowsecurity` + **policies reales**; la superficie pública real son las policies `to anon`, **NO** los grants por default (lección v4.0) | **123-02** |
| 3 | **Grants** — cero-grant a `anon`/`authenticated` sobre tablas (régimen `>0044`); `ALTER DEFAULT PRIVILEGES` no re-abriendo lo revocado | **123-02** |
| 4 | **RPCs públicas** — bounded (`LIMIT` explícito + `statement_timeout`), PII-safe, y coincidencia con `PUBLIC_RPC_ALLOWLIST` **en AMBOS sentidos** (nada allowlisted que no exista; nada expuesto que no esté allowlisted) | **123-03** |
| 5 | **`SECURITY DEFINER`** — toda función secdef con `search_path` **fijado** (`search_path=''` o explícito), + vistas secdef (Splinter **0010**/**0011**) | **123-03** |
| 6 | **Buckets / keys / secrets / superficie Data API** — que nada se exponga sin querer, **+ el guard CI como parte del boundary** | **123-04** |

Corpus de partida (verificado 2026-07-29, filtro `pg_depend deptype='e'` aplicado, transcrito en
`.supabase-ops.yaml`): **57 tablas** y **42 funciones** en `public`. Los ejes 1-3 barren las 57
tablas; los ejes 4-5 barren las 42 funciones. Ninguno de los dos barridos puede declararse
`conforme` sobre un subconjunto: si un plan audita menos que el corpus completo, la diferencia es
`limite-declarado` explícito.

## 0.4 El gotcha de `schema_migrations` — DEMOSTRADO

El precedente rector de esta fase (123-CONTEXT §Contra la DB viva) no se afirma: se prueba.

**Q-00a — lo que el ledger DECLARA:**

```sql
select version from supabase_migrations.schema_migrations order by version;
```

Salida real (55 filas):

```
0001 0002 0003 0004 0005 0006 0007 0008 0009 0010 0011 0012 0013 0014 0015
0016 0017 0018 0019 0020 0021 0022 0023 0024 0025 0032 0033 0034 0035 0036
0037 0038 0039 0040 0041 0042 0043 0044 0045 0046 0047 0048 0049 0050 0051
0053 0054 0055 0056 0057 0058 0069 0070 0071 0072
```

**Q-00b — lo que el REPO contiene:**

```bash
ls supabase/migrations | sed 's/_.*//' | sort
```

Salida real (70 archivos):

```
0001 0002 0003 0004 0005 0006 0007 0008 0009 0010 0011 0012 0013 0014 0015
0016 0017 0018 0019 0020 0021 0022 0023 0024 0025 0026 0028 0030 0031 0032
0033 0034 0035 0036 0037 0038 0039 0040 0041 0042 0043 0044 0045 0046 0047
0048 0049 0050 0051 0052 0053 0054 0055 0056 0057 0058 0059 0060 0061 0062
0063 0064 0065 0066 0067 0068 0069 0070 0071 0072
```

**La diferencia:** 15 migraciones existen como archivo en el repo y **NO** figuran en el ledger —
`0026`, `0028`, `0030`, `0031`, `0052`, y todo el tramo `0059`–`0068`. Además `0027` y `0029` no
existen en **ninguna** de las dos caras: la numeración del repo tiene huecos propios, así que
"contar archivos" tampoco sirve como control.

**Q-00c — prueba de existencia de objeto (la DB viva contradice al ledger):**

```sql
select '0059', to_regclass('public.parlamentario_bio') is not null
union all select '0060', to_regproc('public.parlamentario_publico_v2') is not null
union all select '0061', to_regproc('public.cruces_de_proyecto')       is not null
union all select '0062', to_regproc('public.lobby_menciones_de_boletin') is not null
union all select '0063', to_regproc('public.lobby_menciones_de_boletin') is not null
union all select '0064', exists(select 1 from pg_proc p
                                join pg_namespace n on n.oid = p.pronamespace
                                where n.nspname = 'public'
                                  and p.proname = 'co_comisionados_de_parlamentario'
                                  and array_to_string(p.proconfig, ',') like '%statement_timeout%')
union all select '0065', to_regclass('public.actualidad_senal')          is not null
union all select '0066', to_regproc('public.actualidad_senales_panel')   is not null
union all select '0067', to_regproc('public.militancia_historica_compartida') is not null
union all select '0068', to_regproc('public.coincidencia_votos_par')     is not null
order by 1;
```

Salida real — **las diez dan `t`**:

```
0059|t   0060|t   0061|t   0062|t   0063|t   0064|t
0065|t   0066|t   0067|t   0068|t
```

### Tabla de contraste

| versión | en `schema_migrations` | archivo en repo | objetos realmente presentes en la DB |
|---------|------------------------|-----------------|--------------------------------------|
| 0026, 0028, 0030, 0031 | **NO** | sí | asumidos aplicados (schema base v2.0-v3.0 en pie) — se re-verifica por objeto en 123-02 si algún eje depende de ellos |
| 0027, 0029 | NO | **NO** | n/a — hueco de numeración del repo, no una migración perdida |
| 0052 (gate MONEY) | **NO** | sí | `aportes_de_parlamentario` = `t`, `contratos_de_parlamentario` = `t` ⇒ **aplicada** |
| 0059 `bio_comisiones` | **NO** | sí | `parlamentario_bio` **existe** ⇒ aplicada |
| 0060 `bio_partido_publico` | **NO** | sí | `parlamentario_publico_v2` **existe** ⇒ aplicada |
| 0061 `cross_links_conteo_honesto` | **NO** | sí | `cruces_de_proyecto` **existe** ⇒ aplicada |
| 0062 / 0063 `lobby_menciones` | **NO** | sí | `lobby_menciones_de_boletin` **existe** ⇒ aplicadas |
| 0064 `bounded_rpc_statement_timeout` | **NO** | sí | `co_comisionados_de_parlamentario` lleva `statement_timeout=5s` ⇒ aplicada |
| 0065 `actualidad_senal` | **NO** | sí | tabla `actualidad_senal` **existe** ⇒ aplicada |
| 0066 `actualidad_rpc` | **NO** | sí | `actualidad_senales_panel` **existe** ⇒ aplicada |
| 0067 `militancia_historica_compartida` | **NO** | sí | función homónima **existe** ⇒ aplicada |
| 0068 `coincidencia_votos_par` | **NO** | sí | función homónima **existe** ⇒ aplicada |
| 0069–0072 | sí | sí | traza retomada en 0069 (coincide con el precedente documentado) |

**Conclusión escrita, verbatim:**

> **Leer los archivos de migración da una foto FALSA. `supabase_migrations.schema_migrations` está
> incompleta y NO es fuente de verdad. La DB viva manda: toda aserción de la Phase 123 se demuestra
> con una consulta a los catálogos de PROD, jamás leyendo `supabase/migrations`.**

**Corolario operativo para la Phase 124:** como el ledger no refleja lo aplicado, la numeración de
las migraciones de fix **arranca en `0073`** (siguiente al último archivo del repo, no al último del
ledger), y ninguna migración de 124 puede asumir el estado a partir del ledger.

## 0.5 Riesgo rector que hereda toda la fase

Verbatim, y vale para los seis ejes:

> El sitio público lee con **`service_role`** (Camino A, v4.0) ⇒ **RLS no lo protege.** La PII está
> protegida por el **guard CI** (`app/lib/lockdown-guard.test.ts`) que escanea `app/` por `.from` de
> tablas PII y `.rpc` fuera de `PUBLIC_RPC_ALLOWLIST`. **Ese guard es parte del boundary y entra en
> la auditoría (eje 6, plan 123-04).**

Tres consecuencias que los fragmentos deben respetar:

1. Un eje 2 (`RLS`) `conforme` **no** implica que la PII esté protegida en la superficie del sitio.
   RLS protege la **Data API con `anon`**; el sitio la bypassa por diseño. Los ejes 2 y 6 miden
   cosas distintas y **ninguno sustituye al otro**.
2. Un hallazgo del eje 6 que muestre que el guard **debería haber cazado algo y no lo cazó** es un
   punto ciego ⇒ `destino: guard` ⇒ se extiende en el plan **123-05**, en esta fase, antes de 124.
3. La allowlist se verifica **en ambos sentidos** (eje 4): huérfanos (allowlisted sin función viva) y
   expuestos-no-allowlisted. Un sentido solo no cierra el boundary.

## 0.6 Límites del método (declarados por adelantado)

**(A) Esta fase no corrige nada.** Única excepción: **extender un guard** (plan 123-05, patrón
"guard primero"). Todo otro fix es la **Phase 124** como migración aditiva desde `0073`; el deploy es
la **Phase 125**. Un fragmento que aplique un fix es una violación del régimen, no un adelanto.

**(B) Database Advisors / Splinter no son invocables por SQL.** Corren contra el remoto vía dashboard
o `supabase` CLI y esta fase no los ejecuta. Método sustituto: cada hallazgo relevante se **mapea al
catálogo Splinter por número** (p. ej. **0010** `security_definer_view`, **0011**
`function_search_path_mutable`), y el subagente `supabase-reviewer` (plan 123-06) los **reclama** al
consolidar. Los hallazgos Splinter que esta fase no pueda reproducir por SQL van como
`limite-declarado`.

**(C) Cero fabricación.** Un eje no verificable se declara `limite-declarado` **con la evidencia del
intento** (comando + salida/error), jamás se rellena con lo que "debería" ser. Lo mismo aplica al
manifiesto: los campos que el plan 123-01 no pudo verificar dicen literalmente `UNKNOWN — verify` en
`.supabase-ops.yaml`, y ningún fragmento posterior puede tratarlos como hechos.

**(D) Alcance de schema.** Se audita `public` (+ `storage.buckets` para el eje 6). Los schemas
`auth`, `extensions`, `vault`, `supabase_migrations` y `pgmq` quedan **fuera** salvo lectura
puntual como evidencia; nada de `auth.*` se enumera con datos. Cualquier hallazgo que exija tocarlos
es `deuda-operador` o `supabase-architect+checkpoint`.

**(E) Objetos de extensión.** Excluidos por el filtro `pg_depend deptype='e'` del §0.0. Esa exclusión
es **deliberada**: un objeto de extensión no es superficie propia. Si un eje necesitara auditar uno
(p. ej. una función de `pgmq` expuesta por error), se declara como excepción explícita en su
fragmento, con la razón.
