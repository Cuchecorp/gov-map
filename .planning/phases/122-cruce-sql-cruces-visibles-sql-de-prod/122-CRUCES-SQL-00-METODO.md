---
fase: 122
fragmento: 00-metodo
estado: borrador
fecha: 2026-07-29
ancla_temporal: "2026-07-29 (select now()::date contra PROD; TimeZone de sesión = UTC)"
consumido_por: [122-02, 122-03, 122-04, 122-05, 122-06]
---

# 122 — CRUCES × SQL · Fragmento 00: método, universo y sujetos

> Fragmento rector de la Phase 122. Fija el **método**, el **vocabulario de veredicto**, la
> **plantilla de fila** y el **universo cerrado** de cruces visibles que los fragmentos 01/02/03
> (planes 122-02/03/04) deben recalcular. El plan 122-06 consolida todos los fragmentos en
> `122-CRUCES-SQL.md`.
>
> **Régimen:** este fragmento **no corrige** nada y **no despliega** nada. Los fixes son 122-05;
> el deploy viaja agrupado con la Phase 125.

## 0. Método y cobertura

### 0.0 Régimen declarado

| Propiedad | Valor |
|-----------|-------|
| Método | **SQL verbatim read-only contra PROD** (`psql`) + **lectura del DOM del deploy propio** (`curl`) |
| Acceso a PROD Postgres | solo `SELECT`. **Cero DDL, cero DML**, cero `supabase db push` en esta fase |
| Invocación psql | `set -a; source .env; set +a` y luego `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "<query>"` — **jamás se ecoa ni se escribe el valor de `SUPABASE_DB_URL`**; en este documento aparece solo el **nombre** de la variable |
| Conteo por REST | **prohibido** (PostgREST capa a 1.000 filas). Todo conteo va por `psql -tA` |
| RPC vs primeros principios | donde el sitio lee por RPC, se invoca la **misma RPC** por psql **y además** la query "de primeros principios" que la RPC pretende implementar; ambos números se comparan |
| PII | **cero**: ni RUT, ni email, ni monto individual. Se registran *nombres de columna* y **agregados**, nunca valores de columnas PII |
| Requests a fuentes gubernamentales | **cero** (camara.cl / senado.cl / BCN / leylobby **no se golpean**) ⇒ el rate-limit 2-3 s de CLAUDE.md **no aplica** a esta fase |
| Lectura del deploy | `curl -s https://observatorio-congreso.thevalis.workers.dev/<ruta>` (SSR, HTML server-rendered). **No** es fuente gubernamental. Se usa con mesura |
| Flags | **no se toca ningún `*_PUBLIC_ENABLED`**. Los gates se **observan**, no se cambian |
| Deploy | **no se hace en esta fase** (viaja agrupado con la Phase 125) |

### 0.0.1 Ancla temporal (ejecutada, no asumida)

```bash
set -a; source .env; set +a
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "select now()::date, current_setting('TimeZone');"
# → 2026-07-29|UTC
```

**Ancla temporal de la Phase 122 = `2026-07-29`** (TimeZone de sesión `UTC`). Todo número SQL
registrado en los fragmentos 01/02/03 es **a esta fecha**. El inventario 113 se corrió el
**2026-07-27**: 2 días de deriva de ingesta separan ambas corridas, y esa deriva es esperada —
por eso §1 re-verifica los sujetos en vez de copiar sus conteos.

### 0.0.2 Base URL del deploy leído

`https://observatorio-congreso.thevalis.workers.dev` — mismo deploy que auditó 113
(`deploy_auditado: observado 2026-07-27 23:04 UTC`). Cloudflare no expone id de versión en headers,
así que la identidad del deploy se establece por **observación de gates** (§2), no por un id.

## 0.1 Vocabulario de veredicto

Los **tres** valores LOCKED que usan TODOS los fragmentos de la fase. No se admite ningún cuarto
valor, ni prosa libre en la columna `veredicto`.

| veredicto | significado | qué queda registrado |
|-----------|-------------|----------------------|
| `cuadra` | el número calculado por SQL **es igual** al número que emite el deploy | la query verbatim + el nº SQL + el nº deploy (idénticos) |
| `discrepancia-corregida` | SQL y deploy **difieren**, y el fix se aplica al código del sitio (o como migración aditiva) en el **plan 122-05** | **ambos** números + la query + el fix aplicado. El número erróneo NO se borra |
| `discrepancia-declarada` | SQL y deploy **difieren**, o el cruce **no es recalculable**, y **NO se corrige en esta fase** | **ambos** números (o la evidencia de la no-recalculabilidad) + **el porqué** de no corregir |

**Regla dura (anti-"todo bien"):** la afirmación *"no encontré discrepancias"* **solo vale** si la
query que lo demuestra está **transcrita verbatim** en el fragmento. Un `cuadra` sin bloque ```sql
asociado es inválido y el plan 122-06 debe rechazarlo.

**Corolario:** toda discrepancia queda con **ambos números y la query**, aunque se corrija. Un fix
nunca borra la evidencia del número anterior.

## 0.2 Plantilla de fila

Molde de tabla obligatorio para los fragmentos 01/02/03. Columnas **exactas** y **en este orden**:

```
| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
```

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| *(ejemplo del molde)* | `/parlamentario/D1165` | `app/components/…tsx:NNN` | `RPC:…` o `tabla.columna` | `Q-01` | `n` | `n` | `cuadra` |

Reglas del molde:

- **`query verbatim` NO contiene la query.** Contiene un **identificador** `Q-NN` que apunta a un
  bloque ```sql numerado más abajo **en el mismo fragmento**. Las queries largas dentro de una celda
  destruyen la tabla y dejan de ser copiables/re-ejecutables.
- **`origen`** usa el vocabulario cerrado del inventario 113 §0.2: `RPC:<nombre>` o
  `tabla.<columna>`. No se inventan nombres de RPC ni de tabla.
- **`emisor`** cita `archivo:línea` y, cuando exista, el id `E-NNN` del catálogo §3.0 de 113.
- **`nº deploy`** es lo leído del DOM por `curl`; si el bloque no emite DOM (gate OFF, emisor
  huérfano, cero filas), se escribe la razón literal en vez de un número.

## 0.3 Universo cerrado de cruces visibles

Universo **derivado del inventario 113**, no asumido. Cada grupo cita al menos un id de emisor
`E-0NN` del catálogo §3.0 de 113. Seis grupos, asignados a tres planes de auditoría.

### Grupo 1 — Relaciones entre parlamentarios → **plan 122-02**

- **5 bloques de ficha**, emisor **E-022** `app/components/cross-links-parlamentario.tsx`
  (`:112` el `/parlamentario/{p.id}`, `:130` el `verTodosHref`). Los **readers** que alimentan los
  5 bloques viven en `app/app/parlamentario/[id]/page.tsx:198-206` (lector genérico
  `crossLinkReader`, definido en `:190-195`) y son las 5 RPCs:
  `copartidarios_de_parlamentario`, `de_la_misma_zona`, `co_comisionados_de_parlamentario`,
  `coautores_de_parlamentario`, `militancia_historica_compartida` (esta última = REL-04, RPC 0067).
- **Conteos del resumen**, emisor **E-029** `app/components/parlamentario-resumen.tsx` (`:91` las
  anclas `#{carril}`). Sus **conteos** viven en la lib `app/lib/parlamentario-resumen-conteos.ts`
  (`RPC:votos_de_parlamentario`, `lobby_de_parlamentario`, `declaraciones_de_parlamentario`,
  `cruces_de_parlamentario`, `contratos_de_parlamentario`, `aportes_de_parlamentario`).
  **La lib NO tiene id `E-NNN` propio**: el inventario la registra como la *dependencia de conteo*
  de E-029. Citarla como `app/lib/parlamentario-resumen-conteos.ts`, **jamás** fabricarle un id.
- Superficie: `/parlamentario/[id]` (§4.1 de 113; filas A4/A5 de la Tabla A).

### Grupo 2 — `/comparar`: 4 ejes + VSIM → **plan 122-02**

- Emisor **E-051** `app/app/comparar/page.tsx` (0 hrefs propios; ejes vía
  `RPC:militancia_historica_compartida`, `RPC:comisiones_de_parlamentario`,
  `RPC:coautores_de_parlamentario`, `RPC:parlamentarios_publico_v2`).
- El literal VSIM **"Coinciden en {n} de {m} votaciones compartidas ({pct}%)"** lo emite
  `app/components/similitud-votacion-comparar.tsx:120`, sobre `RPC:coincidencia_votos_par`.
  Ese componente está inventariado en **§4.7 (filas C3/C4)** de 113 y **NO tiene id `E-NNN` propio**
  en §3.0 — se cita **§4.7 C3/C4**; **jamás fabricar un sufijo de id** tipo `E-051b`.
- Gate: **VSIM** (solo el eje de similitud de votación).

### Grupo 3 — Cruces de ficha y de proyecto → **plan 122-03**

- Emisor **E-044** `app/components/cruces-de-proyecto.tsx` (`:130` el href de parlamentario,
  `:168` la fecha del hecho, `:176-177` el badge) sobre `RPC:cruces_de_proyecto`.
- Emisor **E-053** `app/components/cruces-de-parlamentario.tsx` (`:178` fecha, `:194-197` badge)
  sobre `RPC:cruces_de_parlamentario`.
- Origen de datos: `cruce_senal` (+ `cruce_senal.evidencia` jsonb). Migraciones **0047–0050**.
- Gate: **CRUCES** (ON). Superficies `/proyecto/[boletin]` (§4.2) y `/parlamentario/[id]` (§4.1).

### Grupo 4 — Panel de actualidad: 6 señales → **plan 122-03**

- Emisor **E-055** `app/components/panel-actualidad.tsx` (contrato de la RPC documentado en
  `:96-97`; rótulo de fecha `:100-108`, `:227`) sobre `RPC:actualidad_senales_panel`.
- Migraciones **0065/0066**. Superficie `/` (§4.4). Señales: `agenda_citacion`, `agenda_sala`,
  `velocity`, `urgencias`, `nuevos_ingresos`, `archivados` / `agrupacion_materia` — el fragmento 02
  cierra el denominador exacto contra el contrato de la RPC, no contra esta lista.
- Una query por señal (precedente Phase 104).

### Grupo 5 — lobby ↔ proyecto de ley → **plan 122-04**

- Emisor **E-020** `app/components/lobby-menciones-de-boletin.tsx` (`:138` href de parlamentario,
  `:164` href externo de la audiencia, `:129` fecha) — el **`total_n`** que se audita se emite en
  `:212-213`; sobre `RPC:lobby_menciones_de_boletin`.
- Emisor **E-002** `app/components/lobby-de-parlamentario.tsx` sobre `RPC:lobby_de_parlamentario`.
- **Denominador honesto obligatorio:** excluye `lobby_audiencia.estado_vinculo <> 'confirmado'`.
  Si el denominador mostrado incluye lo no confirmado, es discrepancia y se arregla.
- Recalcular la **cobertura declarada ~3,8 %** contra PROD: si cambió, el copy se actualiza con la
  cifra observada **y su fecha**.

### Grupo 6 — `lobby_sector_aporte`: 0 filas HONESTAS → **plan 122-04**

- Stub **estructural** de la migración **0052**, gated por MONEY. **0 filas es HONESTO, no un bug.**
- El plan 122-04 lo deja registrado explícitamente con esa palabra, para que un auditor futuro no
  lo lea como defecto. Cero filas se presenta como cero: jamás se rellena, jamás se oculta.

### Asignación resumida

| grupo | tema | plan |
|-------|------|------|
| 1 | Relaciones entre parlamentarios (5 bloques + conteos del resumen) | **122-02** |
| 2 | `/comparar` — 4 ejes + VSIM | **122-02** |
| 3 | Cruces de ficha y de proyecto | **122-03** |
| 4 | Panel de actualidad — 6 señales | **122-03** |
| 5 | lobby ↔ PL | **122-04** |
| 6 | `lobby_sector_aporte` (0 filas honestas) | **122-04** |

## 0.4 Emisor huérfano — advertencia

Registrado **verbatim** desde §3.0.1 del inventario 113:

> `E-003` (`voto-ficha-row.tsx`, 8 hrefs) y `E-008` (`actualidad-module.tsx`, 5 hrefs) aparecen en el
> loop de conteo pero **ningún archivo non-test los importa**:
>
> ```bash
> grep -rn "VotoFichaRow\|ActualidadModule" app --include=*.tsx --include=*.ts | grep -v "\.test\."
> # → sólo definiciones propias, tipos en app/lib/types.ts y menciones en comentarios; cero call-sites
> ```
>
> Consecuencia para las fases consumidoras: **114/125 no deben perseguir esos 13 hrefs en el DOM** —
> no se renderizan en ninguna de las 15 rutas. Se inventarían igual porque existen en el código y son
> parte del denominador (misma regla que un bloque gated OFF). `panel-actualidad.tsx` (E-055) es el
> near-clone vivo que reemplazó a `actualidad-module.tsx` en `/`.

**Consecuencia para la Phase 122:** el plan **122-03 audita E-055** (`panel-actualidad.tsx`),
**NO E-008** (`actualidad-module.tsx`). Un número emitido por E-008 **no llega a ningún DOM** y por
lo tanto no tiene "nº deploy" con el que cuadrar.

## 0.5 Límites del método

Declarados **por adelantado**, no descubiertos a posteriori.

**LÍMITE A — el "nº deploy" es PRE-fix.** Los fixes de UI de esta fase (plan 122-05) **no se
despliegan aquí**: el deploy viaja agrupado con la **Phase 125**. Por lo tanto todo `nº deploy`
registrado en los fragmentos es el del **código actualmente desplegado (pre-fix)**, y una fila con
veredicto `discrepancia-corregida` seguirá mostrando el número viejo en producción hasta que 125
despliegue. La **re-verificación post-deploy es la Phase 125**, no ésta.

**LÍMITE B — los bloques gated OFF no emiten DOM ⇒ no son observables.** **MONEY** y **NOTIF** están
**OFF** (§2). Sus cruces (financiamiento, contratos, aportes; notificaciones) **no producen número
en el deploy**. Quedan **fuera del denominador de lo cuadrable**, pero **declarados**, no omitidos:
la fila existe con `nº deploy` = `no emitido en el deploy auditado` y veredicto
`discrepancia-declarada`. Se declara, jamás se borra la superficie.

**LÍMITE C — cero fabricación.** Cualquier cruce **no recalculable** por falta de datos en PROD se
**declara como límite con evidencia** (la query que devuelve 0 filas o el error observado) en vez de
fabricar el número. Patrón "vacío honesto": cero filas se presenta como cero. Ningún número de este
artefacto es estimado, redondeado ni recordado — todos vienen de una salida de `psql` o de un `curl`
transcrito.

## 1. Sujetos deterministas (re-verificados)

Los sujetos son los del inventario 113 §1.1/§1.2/§1.3, re-verificados contra PROD **hoy
(2026-07-29)** re-ejecutando **verbatim** las mismas queries de selección. Ver los bloques
`Q-S1`/`Q-S2`/`Q-S3` en §1.1 para las queries completas.

**Regla de estabilidad LOCKED:** si la query de selección devuelve **otro** id, **NO se cambia de
sujeto**. Se **registra la deriva** (id nuevo + conteos de ambos) y 122 y 125 **siguen con los
sujetos del inventario 113** para mantener la comparabilidad entre fases (decisión del
122-CONTEXT §Método de recálculo: *"reutilizando los sujetos ya elegidos por el inventario 113
(§1.1–1.3) para que 122 y 125 hablen del mismo caso"*).

| sujeto | query (ref) | valor 2026-07-27 (inventario 113) | valor de hoy (2026-07-29) | ¿sigue siendo el sujeto elegido? |
|--------|-------------|-----------------------------------|---------------------------|----------------------------------|
| `D1165` (diputado) | §1.1 de 113 → `Q-S1` | `D1165\|3752\|112\|6\|11\|2\|2\|6` | `D1165\|3752\|112\|6\|11\|2\|2\|6` — **idéntico a 113** | **sí** — la query lo re-elige (top-1) |
| `S1338` (senador) | §1.2 de 113 → `Q-S2` | `S1338\|949\|0\|9\|0\|0\|1\|3` | `S1338\|949\|0\|9\|0\|0\|1\|3` — **idéntico a 113** | **sí** — la query lo re-elige (top-1) |
| `14309-04` (boletín bicameral) | §1.3 de 113 → `Q-S3` | `14309-04\|7\|1\|47\|t` | `14309-04\|7\|1\|47\|t` — **idéntico a 113** | **sí** — la query lo re-elige (top-1) |

**Sin deriva.** Las 3 queries de selección re-eligen los mismos 3 sujetos con los mismos conteos que
el 2026-07-27. La regla de estabilidad no tuvo que aplicarse.

### 1.1 Queries de selección re-ejecutadas (verbatim)

Prefijo común a los tres bloques (no se repite abajo):

```bash
set -a; source .env; set +a
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "<query>"
```

**`Q-S1` — Sujeto A, diputado con máxima riqueza de bloques visibles** (verbatim de 113 §1.1):

```sql
with base as (
  select p.id, p.camara,
    (select count(*) from voto v                    where v.parlamentario_id  = p.id) n_votos,
    (select count(*) from lobby_audiencia l         where l.parlamentario_id  = p.id
                                                      and l.estado_vinculo = 'confirmado') n_lobby,
    (select count(*) from declaracion d             where d.parlamentario_id  = p.id) n_patrimonio,
    (select count(*) from cruce_senal c             where c.parlamentario_id  = p.id) n_cruces,
    (select count(*) from comision_membresia cm     where cm.parlamentario_id = p.id) n_comisiones,
    (select count(*) from parlamentario_militancia m where m.parlamentario_id = p.id) n_militancias
  from parlamentario p where p.camara = 'diputados'
)
select id, n_votos, n_lobby, n_patrimonio, n_cruces, n_comisiones, n_militancias,
  (case when n_votos>0 then 1 else 0 end)+(case when n_lobby>0 then 1 else 0 end)
 +(case when n_patrimonio>0 then 1 else 0 end)+(case when n_cruces>0 then 1 else 0 end)
 +(case when n_comisiones>0 then 1 else 0 end)+(case when n_militancias>0 then 1 else 0 end) bloques
from base
order by bloques desc,
         (n_votos+n_lobby+n_patrimonio+n_cruces+n_comisiones+n_militancias) desc,
         id asc                       -- desempate estable por PK
limit 1;
-- observado 2026-07-29: D1165|3752|112|6|11|2|2|6
```

**`Q-S2` — Sujeto B, senador con máxima riqueza de bloques visibles** (verbatim de 113 §1.2):

```sql
with base as (
  select p.id,
    (select count(*) from voto v                    where v.parlamentario_id  = p.id) n_votos,
    (select count(*) from lobby_audiencia l         where l.parlamentario_id  = p.id
                                                      and l.estado_vinculo = 'confirmado') n_lobby,
    (select count(*) from declaracion d             where d.parlamentario_id  = p.id) n_patrimonio,
    (select count(*) from cruce_senal c             where c.parlamentario_id  = p.id) n_cruces,
    (select count(*) from comision_membresia cm     where cm.parlamentario_id = p.id) n_comisiones,
    (select count(*) from parlamentario_militancia m where m.parlamentario_id = p.id) n_militancias
  from parlamentario p where p.camara = 'senado'
)
select id, n_votos, n_lobby, n_patrimonio, n_cruces, n_comisiones, n_militancias,
  (case when n_votos>0 then 1 else 0 end)+(case when n_lobby>0 then 1 else 0 end)
 +(case when n_patrimonio>0 then 1 else 0 end)+(case when n_cruces>0 then 1 else 0 end)
 +(case when n_comisiones>0 then 1 else 0 end)+(case when n_militancias>0 then 1 else 0 end) bloques
from base
order by bloques desc,
         (n_votos+n_lobby+n_patrimonio+n_cruces+n_comisiones+n_militancias) desc,
         id asc                       -- desempate estable por PK
limit 1;
-- observado 2026-07-29: S1338|949|0|9|0|0|1|3
```

**`Q-S3` — Sujeto C, boletín bicameral con votaciones + similares + cruces** (verbatim de 113 §1.3):

```sql
select p.boletin,
       (select count(*) from votacion vo          where vo.boletin = p.boletin) n_votaciones,
       (select count(*) from proyecto_embedding e where e.boletin  = p.boletin) n_embedding,
       (select count(*) from cruces_de_proyecto(p.boletin))                     n_cruces,
       (p.prm_id_camara is not null)                                            tiene_camara
from proyecto p
where exists (select 1 from proyecto_ficha f
               where f.boletin = p.boletin and f.sector_id is not null)
  and p.prm_id_camara is not null
  and exists (select 1 from proyecto_embedding e where e.boletin = p.boletin)
order by (select count(*) from cruces_de_proyecto(p.boletin)) desc,
         (select count(*) from votacion vo where vo.boletin = p.boletin) desc,
         p.boletin asc                -- desempate estable por PK
limit 1;
-- observado 2026-07-29: 14309-04|7|1|47|t
```

### 1.2 Línea base de conteos observados hoy (2026-07-29)

Estos son los números contra los que los planes **122-02 / 122-03 / 122-04** comparan lo que emite
el deploy. Son **agregados**; cero PII.

**`D1165` y `S1338`** — salida de `Q-S1` / `Q-S2` desglosada:

| sujeto | votos | lobby confirmado | patrimonio (declaraciones) | cruces (`cruce_senal`) | comisiones | militancias | bloques visibles |
|--------|------:|-----------------:|---------------------------:|-----------------------:|-----------:|------------:|-----------------:|
| `D1165` | 3.752 | 112 | 6 | 11 | 2 | 2 | **6** |
| `S1338` | 949 | **0** | 9 | **0** | **0** | 1 | **3** |

> `S1338` con `n_lobby = 0` y `n_cruces = 0` **no es un bug de wiring**: es el mejor senador de PROD
> por riqueza. Sirve como sujeto de **estados vacíos honestos** para 122-02/03/04.

**`14309-04`** — salida de `Q-S3` desglosada:

| boletín | votaciones | embedding | `cruces_de_proyecto()` | `prm_id_camara` presente |
|---------|-----------:|----------:|-----------------------:|:------------------------:|
| `14309-04` | 7 | 1 | **47** | `t` (bicameral) |

Los tres sujetos son **idénticos a 113** en id y en todos sus conteos: la ingesta de los 2 días
intermedios no los movió.

## 2. Gates observados en el deploy

Observados **hoy (2026-07-29)** contra `https://observatorio-congreso.thevalis.workers.dev` leyendo
el **DOM real** (SSR). **El DOM manda sobre cualquier nota previa**: si un gate observado difiere de
lo que dice el CONTEXT, se registra la observación. **No se tocó ningún flag.**

### 2.1 Comandos verbatim

```bash
# CRUCES / NET / MONEY(financiamiento) / lobby — secciones presentes en la ficha del sujeto A
curl -s https://observatorio-congreso.thevalis.workers.dev/parlamentario/D1165 \
  | grep -o -E 'id="(relaciones|cruces|dinero|financiamiento|lobby)"' | sort -u

# VSIM — el literal de similitud de votación en /comparar
curl -s "https://observatorio-congreso.thevalis.workers.dev/comparar?a=D1165&b=S1338" \
  | grep -c "Coinciden en"
```

> **Gotcha de shell registrado:** la URL de `/comparar` va **SIEMPRE entre comillas dobles**. Sin
> ellas, el `&` manda el comando a background y el `?` globbea ⇒ el comando anotado en el artefacto
> no sería reproducible.

Salida observada del primer comando (ficha `D1165`):

```
id="cruces"
id="lobby"
id="relaciones"
```

Salida observada del segundo comando (`/comparar?a=D1165&b=S1338`): **`0`** — ver §2.3, **no
significa VSIM OFF**.

Comandos complementarios (necesarios para cerrar los 5 gates; ver §2.3 el porqué):

```bash
# VSIM con par MISMO-CÁMARA (el par D1165×S1338 es cross-cámara ⇒ 0 votaciones compartidas)
curl -s "https://observatorio-congreso.thevalis.workers.dev/comparar?a=D1165&b=D1170" \
  | grep -o -E ".{40}Coinciden en.{160}"

# NET / MONEY / NOTIF — por código HTTP de la ruta gated
curl -s -o /dev/null -w "%{http_code}\n" "https://observatorio-congreso.thevalis.workers.dev/red?seed=D1165"
curl -s -o /dev/null -w "%{http_code}\n" "https://observatorio-congreso.thevalis.workers.dev/contraparte/1"
curl -s -o /dev/null -w "%{http_code}\n" "https://observatorio-congreso.thevalis.workers.dev/cuenta"
curl -s "https://observatorio-congreso.thevalis.workers.dev/cuenta" \
  | grep -o -i -E "no est[^<\"]{0,60}disponible" | sort -u
```

### 2.2 Resultados observados

| gate | veredicto observado | evidencia (comando → salida) |
|------|---------------------|------------------------------|
| **CRUCES** | **ON** | `curl … /parlamentario/D1165 \| grep -o -E 'id="(…)"'` → `id="cruces"` presente en el DOM |
| **VSIM** | **ON** | `curl "…/comparar?a=D1165&b=D1170" \| grep -o -E ".{40}Coinciden en.{160}"` → `Coinciden en <!-- -->3655<!-- --> de <!-- -->3672<!-- --> votaciones compartidas (<!-- -->100<!-- -->%)` |
| **NET** | **ON** | `curl -s -o /dev/null -w "%{http_code}" "…/red?seed=D1165"` → **`200`** (con NET OFF la ruta 404ea, 113 §4.9.b) |
| **MONEY** | **OFF** | `curl -s -o /dev/null -w "%{http_code}" "…/contraparte/1"` → **`404`** (gate MONEY, `page.tsx:50-52`); y en la ficha `D1165` **no** aparecen `id="dinero"` ni `id="financiamiento"` |
| **NOTIF** | **OFF** (ruta viva, feature **inerte**) | `curl … /cuenta` → **`200`**, pero el DOM emite `no están disponible` ⇒ la ruta responde y declara la indisponibilidad; no emite superficie útil de notificaciones |

**Coincide con el CONTEXT y con 113** (`gates_observados: { NET: ON, CRUCES: ON, VSIM: ON,
MONEY: OFF, NOTIF: OFF }`). Ningún flag fue tocado.

### 2.3 Dos hallazgos de método que heredan los planes 02/03/04

**HALLAZGO A — el par `D1165 × S1338` NO sirve para el literal VSIM.** `D1165` es **diputado** y
`S1338` es **senador**: no comparten ninguna votación, así que el eje **sí se renderiza** (VSIM está
ON) pero en su **empty-state honesto**:

```
Similitud de votación … votaciones compartidas suficientes en las fuentes consultadas al …
```

⇒ `grep -c "Coinciden en"` devuelve **`0`** para ese par. **Cero NO es evidencia de gate OFF**: es
el vacío honesto de un par cross-cámara. El plan **122-02 debe auditar el literal VSIM con pares
MISMO-CÁMARA**; el par de trabajo verificado hoy es **`D1165 × D1170`** (los dos diputados con más
votos de PROD: `D1170` 3.773 votos, `D1165` 3.752). El par cross-cámara `D1165 × S1338` sigue siendo
útil, pero como caso de **empty-state**, no de número.

**HALLAZGO B — el DOM lleva separadores de React (`<!-- -->`) entre el texto y los números.** Un
grep del literal completo (`"Coinciden en 3655 de 3672 …"`) **no matchea nunca** en este deploy,
porque el HTML real es:

```html
Coinciden en <!-- -->3655<!-- --> de <!-- -->3672<!-- --> votaciones compartidas (<!-- -->100<!-- -->%).
```

⇒ los fragmentos 01/02/03 deben extraer el "nº deploy" con un patrón que **tolere los separadores**
(p. ej. `grep -o -E ".{40}Coinciden en.{160}"` y leer los dígitos), **jamás** con un grep del literal
armado. Un grep ingenuo devolvería 0 matches y se leería, falsamente, como "el sitio no emite el
número".

> **Pista para 122-02 (no adjudicada aquí):** el par `D1165 × D1170` emite **3.655 de 3.672** y un
> porcentaje mostrado de **100 %**, cuando el cociente real es **99,5 %**. Queda **registrado como
> lead** para que 122-02 lo recalcule contra `RPC:coincidencia_votos_par` y lo resuelva con el
> vocabulario de §0.1. Este fragmento **no emite veredicto** sobre él.

