---
fase: 122
artefacto: 122-CRUCES-SQL
estado: validado
fecha: 2026-07-29
ancla_temporal: "2026-07-29 (select now()::date contra PROD; TimeZone de sesión = UTC)"
consumido_por: [125]
consolida:
  - 122-CRUCES-SQL-00-METODO.md
  - 122-CRUCES-SQL-01-RELACIONES-COMPARAR.md
  - 122-CRUCES-SQL-02-CRUCES-ACTUALIDAD.md
  - 122-CRUCES-SQL-03-LOBBY.md
  - 122-CRUCES-SQL-04-FIXES.md
filas_de_veredicto: 82
veredictos: { cuadra: 72, discrepancia-corregida: 2, discrepancia-declarada: 8 }
---

# 122 — CRUCES × SQL · artefacto único de la fase

> **Qué es.** El recálculo por **SQL verbatim read-only contra PROD** de **todos** los números de
> cruce que el sitio muestra, contrastado contra el **DOM real del deploy**. Cada fila lleva su
> query, sus dos números y su veredicto. Un lector puede auditar la fase entera sin abrir el código.
>
> **Cómo se lee.** El vocabulario de veredicto es de **tres** valores (§0.1). Toda fila cita un
> identificador `Q-NN` que apunta a un bloque ```sql (o ```bash, para el lado deploy) transcrito en
> este mismo archivo. **Ningún `cuadra` existe sin su query.**
>
> **Régimen.** Cero DDL, cero DML, cero deploy, cero flags tocados, cero requests a fuentes
> gubernamentales, cero PII, cero cadenas de conexión. `SUPABASE_DB_URL` aparece **solo como nombre
> de variable**, jamás expandido.
>
> **Los 5 fragmentos NO se borran**: quedan en el directorio de la fase como evidencia de la corrida.
> Este artefacto los consolida y **manda sobre ellos** en caso de discrepancia (§0.6).

## Índice

| § | contenido |
|---|-----------|
| [0](#0-método-y-cobertura) | Método y cobertura |
| [1](#1-sujetos-deterministas-y-gates-observados) | Sujetos deterministas y gates observados |
| [2](#2-relaciones-entre-parlamentarios) | Relaciones entre parlamentarios (+ conteos del resumen, + `/red`) |
| [3](#3-comparar-4-ejes--vsim) | `/comparar` — 4 ejes + VSIM |
| [4](#4-cruces-de-ficha-y-de-proyecto) | Cruces de ficha y de proyecto |
| [5](#5-panel-de-actualidad) | Panel de actualidad |
| [6](#6-lobbypl) | lobby ↔ proyecto de ley |
| [7](#7-coberturas-declaradas-fuera-de-los-6-grupos-huecos-cerrados-en-122-06) | Coberturas declaradas fuera de los 6 grupos (huecos cerrados aquí) |
| [—](#vacíos-honestos) | Vacíos honestos |
| [—](#fixes-aplicados) | Fixes aplicados |
| [—](#límites-declarados) | Límites declarados |
| [—](#cobertura--inventario-113) | Cobertura × inventario 113 |
| [—](#veredicto-de-la-fase) | Veredicto de la fase |

---

## 0. Método y cobertura

### 0.0 Régimen declarado

| Propiedad | Valor |
|-----------|-------|
| Método | **SQL verbatim read-only contra PROD** (`psql`) + **lectura del DOM del deploy propio** (`curl`) |
| Acceso a PROD Postgres | solo `SELECT`. **Cero DDL, cero DML**, cero `supabase db push` en esta fase |
| Invocación psql | `set -a; source .env; set +a` y luego `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "<query>"` — **jamás se ecoa ni se escribe el valor de `SUPABASE_DB_URL`**; en este documento aparece solo el **nombre** de la variable |
| Conteo por REST | **prohibido** (PostgREST capa a 1.000 filas). Todo conteo va por `psql -tA` |
| RPC vs primeros principios | donde el sitio lee por RPC, se invoca la **misma RPC** por psql **y además** la query "de primeros principios" que la RPC pretende implementar; ambos números se comparan |
| PII | **cero**: ni RUT, ni email, ni monto individual, ni nombre de contraparte, ni materia verbatim de audiencia. Se registran *nombres de columna* y **agregados** |
| Requests a fuentes gubernamentales | **cero** (camara.cl / senado.cl / BCN / leylobby **no se golpean**) ⇒ el rate-limit 2-3 s de CLAUDE.md **no aplica** a esta fase |
| Lectura del deploy | `curl -s https://observatorio-congreso.thevalis.workers.dev/<ruta>` (SSR, HTML server-rendered). **No** es fuente gubernamental. Se usa con mesura |
| Flags | **no se toca ningún `*_PUBLIC_ENABLED`**. Los gates se **observan**, no se cambian |
| Deploy | **no se hace en esta fase** (viaja agrupado con la Phase 125) |

**Prefijo común de TODA query `Q-NN` de tipo ```sql de este artefacto** (no se repite en cada bloque):

```bash
set -a; source .env; set +a
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "<query>"
```

### 0.0.1 Ancla temporal (ejecutada, no asumida)

```bash
set -a; source .env; set +a
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "select now()::date, current_setting('TimeZone');"
# → 2026-07-29|UTC
```

**Ancla temporal de la Phase 122 = `2026-07-29`** (TimeZone de sesión `UTC`). Todo número SQL de este
artefacto es **a esta fecha**. El inventario 113 se corrió el **2026-07-27**: 2 días de deriva de
ingesta separan ambas corridas, y esa deriva es esperada — por eso §1 re-verifica los sujetos en vez
de copiar sus conteos.

### 0.0.2 Base URL del deploy leído

`https://observatorio-congreso.thevalis.workers.dev` — mismo deploy que auditó 113
(`deploy_auditado: observado 2026-07-27 23:04 UTC`). Cloudflare no expone id de versión en headers,
así que la identidad del deploy se establece por **observación de gates** (§1.2), no por un id.

### 0.1 Vocabulario de veredicto

Los **tres** valores LOCKED. No se admite ningún cuarto valor, ni prosa libre en la columna
`veredicto`.

| veredicto | significado | qué queda registrado |
|-----------|-------------|----------------------|
| `cuadra` | el número calculado por SQL **es igual** al número que emite el deploy | la query verbatim + el nº SQL + el nº deploy (idénticos) |
| `discrepancia-corregida` | SQL y deploy **difieren**, y el fix se aplicó al código del sitio (o como migración aditiva) en el **plan 122-05** | **ambos** números + la query + el fix aplicado. El número erróneo NO se borra |
| `discrepancia-declarada` | SQL y deploy **difieren**, o el cruce **no es recalculable**, y **NO se corrige en esta fase** | **ambos** números (o la evidencia de la no-recalculabilidad) + **el porqué** de no corregir |

**Regla dura (anti-"todo bien"):** la afirmación *"no encontré discrepancias"* **solo vale** si la
query que lo demuestra está **transcrita verbatim**. Un `cuadra` sin bloque ```sql asociado es
inválido.

**Corolario:** toda discrepancia queda con **ambos números y la query**, aunque se corrija. Un fix
nunca borra la evidencia del número anterior.

### 0.2 Plantilla de fila

Molde obligatorio. Columnas **exactas** y **en este orden**:

```
| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
```

Reglas del molde:

- **`query verbatim` NO contiene la query.** Contiene un **identificador** `Q-NN` que apunta a un
  bloque numerado en este archivo. Las queries dentro de una celda destruyen la tabla y dejan de ser
  copiables/re-ejecutables.
- **`origen`** usa el vocabulario cerrado del inventario 113 §0.2: `RPC:<nombre>` o
  `tabla.<columna>`. No se inventan nombres de RPC ni de tabla.
- **`emisor`** cita `archivo:línea` y, cuando exista, el id `E-NNN` del catálogo §3.0 de 113.
- **`nº deploy`** es lo leído del DOM por `curl`; si el bloque no emite DOM (gate OFF, emisor
  huérfano, cero filas), se escribe la razón literal en vez de un número.

### 0.3 Universo cerrado de cruces visibles

Universo **derivado del inventario 113**, no asumido. Seis grupos, más un séptimo bloque de
**huecos cerrados en la consolidación** (§7 y las filas `H-*`, detectadas por el barrido
emisor-por-emisor de la [tabla de cobertura](#cobertura--inventario-113)).

| grupo | tema | plan que lo auditó | sección de este artefacto |
|-------|------|--------------------|---------------------------|
| 1 | Relaciones entre parlamentarios (5 bloques + conteos del resumen) | 122-02 | §2 |
| 2 | `/comparar` — 4 ejes + VSIM | 122-02 | §3 |
| 3 | Cruces de ficha y de proyecto | 122-03 | §4 |
| 4 | Panel de actualidad — señales | 122-03 | §5 |
| 5 | lobby ↔ PL | 122-04 | §6 |
| 6 | `lobby_sector_aporte` (0 filas honestas) | 122-04 | [Vacíos honestos](#vacíos-honestos) |
| — | **huecos de cobertura cerrados en 122-06** (`/red`, `lobby_en_tramitacion`, coberturas de `/buscar` y `/agenda`) | **122-06** | §2 (`H-1`/`H-2`), §6 (`H-3`/`H-4`), §7 (`H-5`/`H-6`) |

Detalle de emisores por grupo (verbatim del fragmento 00 §0.3):

- **Grupo 1** — **E-022** `app/components/cross-links-parlamentario.tsx`; readers en
  `app/app/parlamentario/[id]/page.tsx:198-206` (`crossLinkReader`, `:190-195`) sobre las 5 RPCs
  `copartidarios_de_parlamentario`, `de_la_misma_zona`, `co_comisionados_de_parlamentario`,
  `coautores_de_parlamentario`, `militancia_historica_compartida` (REL-04, RPC 0067). Conteos del
  resumen: **E-029**, cuya *dependencia de conteo* es `app/lib/parlamentario-resumen-conteos.ts`
  — **la lib NO tiene id `E-NNN` propio**; se cita por ruta, jamás se le fabrica un id.
- **Grupo 2** — **E-051** `app/app/comparar/page.tsx`. El literal VSIM lo emite
  `app/components/similitud-votacion-comparar.tsx:120`, inventariado en **§4.7 filas C3/C4** de 113 y
  **sin id `E-NNN` propio** (jamás fabricar `E-051b`).
- **Grupo 3** — **E-044** `cruces-de-proyecto.tsx` sobre `RPC:cruces_de_proyecto`; **E-053**
  `cruces-de-parlamentario.tsx` sobre `RPC:cruces_de_parlamentario`. Origen `cruce_senal`
  (+ `evidencia` jsonb). Migraciones **0047–0050**.
- **Grupo 4** — **E-055** `panel-actualidad.tsx` sobre `RPC:actualidad_senales_panel`.
  Migraciones **0065/0066**.
- **Grupo 5** — **E-020** `lobby-menciones-de-boletin.tsx` sobre `RPC:lobby_menciones_de_boletin`;
  **E-002** `lobby-de-parlamentario.tsx` sobre `RPC:lobby_de_parlamentario`. Denominador honesto
  obligatorio: excluye `lobby_audiencia.estado_vinculo <> 'confirmado'`.
- **Grupo 6** — `lobby_sector_aporte`: stub **estructural** de la migración **0052**, gated por
  MONEY. **0 filas es HONESTO, no un bug.**

### 0.4 Emisores huérfanos — advertencia

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

**Consecuencias para esta fase:** §5 audita **E-055**, **NO E-008**. Y la auditoría descubrió **dos
huérfanos más** por la misma vía (números que no llegan a ningún DOM):

- **`E-029 ResumenView`** — sin call-site (§2.0). Sus conteos SÍ se auditaron, en las superficies que
  realmente los emiten (rail, header de carril, disclosure, asistencia, capa-1).
- **empty-state de `E-053`** — no se monta porque `page.tsx:682` exige `tipo === "dato"` (fila 3.b-9).

Un número emitido por un huérfano **no tiene "nº deploy" con el que cuadrar**. Se declara; jamás se
borra del denominador.

### 0.5 Límites del método (declarados por adelantado)

**LÍMITE A — el "nº deploy" es PRE-fix.** Los fixes de UI de esta fase (plan 122-05) **no se
despliegan aquí**: el deploy viaja agrupado con la **Phase 125**. Todo `nº deploy` de este artefacto
es el del **código actualmente desplegado (pre-fix)**; una fila `discrepancia-corregida` seguirá
mostrando el número viejo en producción hasta que 125 despliegue. La **re-verificación post-deploy es
la Phase 125**, no ésta.

**LÍMITE B — los bloques gated OFF no emiten DOM ⇒ no son observables.** **MONEY** y **NOTIF** están
**OFF** (§1.2). Sus cruces (financiamiento, contratos, aportes; notificaciones) **no producen número
en el deploy**. Quedan **fuera del denominador de lo cuadrable**, pero **declarados**, no omitidos.

**LÍMITE C — cero fabricación.** Cualquier cruce **no recalculable** por falta de datos en PROD se
**declara como límite con evidencia** (la query que devuelve 0 filas o el error observado) en vez de
fabricar el número. Patrón "vacío honesto": cero filas se presenta como cero. Ningún número de este
artefacto es estimado, redondeado ni recordado — todos vienen de una salida de `psql` o de un `curl`
transcrito.

### 0.6 Reglas de consolidación aplicadas por 122-06

1. **Coherencia de veredicto — manda el estado final tras 122-05.** Ante cualquier contradicción
   entre fragmentos, gana el fragmento **04** (el más tardío) y se anota. **Contradicciones
   encontradas: cero.** Las 2 filas `discrepancia-corregida` (5.11 y 5.12) conservan ese veredicto
   como valor definitivo; ninguna fue degradada (`122-CRUCES-SQL-04-FIXES.md` §2: sección de "Fixes
   NO aplicados" explícitamente vacía). La aritmética de cobertura de la bitácora
   (2 corregidas = 2 fixes aplicados + 0 no aplicados) **cierra**.
2. **Queries verbatim.** Se copian tal cual del fragmento de origen; **jamás** se reescriben "para
   que se lean mejor". Se conservan incluso sus notas de encoding (`bolet.n`, `SIN-CAMARA`).
3. **Renumeración global de los bloques.** Los `Q-NN` de este artefacto son **globales y
   correlativos** (`Q-01`…`Q-84`). El mapeo desde los ids locales de cada fragmento está en §0.7.
4. **Ids de fila preservados.** `1.x`, `2.x`, `3.x`, `3.a-N`, `3.b-N`, `4-N`, `5.N` son los mismos de
   los fragmentos, porque los handoffs a 124/125 los nombran así. Las filas nuevas de esta
   consolidación llevan prefijo **`H-`** (hueco cerrado).

### 0.7 Mapeo de renumeración de queries

| bloques de este artefacto | origen |
|---------------------------|--------|
| `Q-01`…`Q-03` | fragmento 00 `Q-S1`…`Q-S3` |
| `Q-04`…`Q-35` | fragmento 01 `Q-01`…`Q-32` |
| `Q-36`…`Q-41` | fragmento 01 `Q-D1`…`Q-D6` (greps del deploy) |
| `Q-42`…`Q-55` | fragmento 02 `Q-01`…`Q-14` |
| `Q-56`…`Q-65` | fragmento 02 `Q-15`…`Q-24` |
| `Q-66`…`Q-78` | fragmento 03 `Q-L00`, `Q-L00b`, `Q-L01`…`Q-L11` |
| `Q-79`…`Q-86` | **nuevos en 122-06** — cierre de huecos de cobertura (filas `H-1`…`H-6`): `Q-79`/`Q-80`/`Q-81` `/red`; `Q-82`/`Q-83`/`Q-84` `lobby_en_tramitacion`; `Q-85`/`Q-86` coberturas de `/buscar` y `/agenda` |

---

## 1. Sujetos deterministas y gates observados

### 1.1 Sujetos (re-verificados, no copiados)

Los sujetos son los del inventario 113 §1.1/§1.2/§1.3, re-verificados contra PROD **hoy
(2026-07-29)** re-ejecutando **verbatim** las mismas queries de selección.

**Regla de estabilidad LOCKED:** si la query de selección devuelve **otro** id, **NO se cambia de
sujeto**. Se **registra la deriva** y 122 y 125 **siguen con los sujetos del inventario 113** para
mantener la comparabilidad entre fases.

| sujeto | query | valor 2026-07-27 (inventario 113) | valor de hoy (2026-07-29) | ¿sigue siendo el sujeto elegido? |
|--------|-------|-----------------------------------|---------------------------|----------------------------------|
| `D1165` (diputado) | `Q-01` | `D1165\|3752\|112\|6\|11\|2\|2\|6` | `D1165\|3752\|112\|6\|11\|2\|2\|6` — **idéntico a 113** | **sí** — la query lo re-elige (top-1) |
| `S1338` (senador) | `Q-02` | `S1338\|949\|0\|9\|0\|0\|1\|3` | `S1338\|949\|0\|9\|0\|0\|1\|3` — **idéntico a 113** | **sí** — la query lo re-elige (top-1) |
| `14309-04` (boletín bicameral) | `Q-03` | `14309-04\|7\|1\|47\|t` | `14309-04\|7\|1\|47\|t` — **idéntico a 113** | **sí** — la query lo re-elige (top-1) |

**Sin deriva.** Las 3 queries re-eligen los mismos 3 sujetos con los mismos conteos que el
2026-07-27. La regla de estabilidad no tuvo que aplicarse.

**`Q-01` — Sujeto A, diputado con máxima riqueza de bloques visibles:**

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

**`Q-02` — Sujeto B, senador con máxima riqueza de bloques visibles:**

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

**`Q-03` — Sujeto C, boletín bicameral con votaciones + similares + cruces:**

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

**Línea base de conteos observados hoy** (agregados; cero PII):

| sujeto | votos | lobby confirmado | patrimonio (declaraciones) | cruces (`cruce_senal`) | comisiones | militancias | bloques visibles |
|--------|------:|-----------------:|---------------------------:|-----------------------:|-----------:|------------:|-----------------:|
| `D1165` | 3.752 | 112 | 6 | 11 | 2 | 2 | **6** |
| `S1338` | 949 | **0** | 9 | **0** | **0** | 1 | **3** |

> `S1338` con `n_lobby = 0` y `n_cruces = 0` **no es un bug de wiring**: es el mejor senador de PROD
> por riqueza. Sirve como sujeto de **estados vacíos honestos**.

| boletín | votaciones | embedding | `cruces_de_proyecto()` | `prm_id_camara` presente |
|---------|-----------:|----------:|-----------------------:|:------------------------:|
| `14309-04` | 7 | 1 | **47** | `t` (bicameral) |

### 1.2 Gates observados en el deploy

Observados **hoy (2026-07-29)** leyendo el **DOM real** (SSR). **El DOM manda sobre cualquier nota
previa. No se tocó ningún flag.**

```bash
# CRUCES / NET / MONEY(financiamiento) / lobby — secciones presentes en la ficha del sujeto A
curl -s https://observatorio-congreso.thevalis.workers.dev/parlamentario/D1165 \
  | grep -o -E 'id="(relaciones|cruces|dinero|financiamiento|lobby)"' | sort -u
# → id="cruces" / id="lobby" / id="relaciones"

# VSIM — el literal de similitud de votación en /comparar
curl -s "https://observatorio-congreso.thevalis.workers.dev/comparar?a=D1165&b=S1338" \
  | grep -c "Coinciden en"
# → 0   (NO significa VSIM OFF — ver HALLAZGO A)

# VSIM con par MISMO-CÁMARA
curl -s "https://observatorio-congreso.thevalis.workers.dev/comparar?a=D1165&b=D1170" \
  | grep -o -E ".{40}Coinciden en.{160}"

# NET / MONEY / NOTIF — por código HTTP de la ruta gated
curl -s -o /dev/null -w "%{http_code}\n" "https://observatorio-congreso.thevalis.workers.dev/red?seed=D1165"
curl -s -o /dev/null -w "%{http_code}\n" "https://observatorio-congreso.thevalis.workers.dev/contraparte/1"
curl -s -o /dev/null -w "%{http_code}\n" "https://observatorio-congreso.thevalis.workers.dev/cuenta"
curl -s "https://observatorio-congreso.thevalis.workers.dev/cuenta" \
  | grep -o -i -E "no est[^<\"]{0,60}disponible" | sort -u
```

> **Gotcha de shell registrado:** la URL de `/comparar` va **SIEMPRE entre comillas dobles**. Sin
> ellas, el `&` manda el comando a background y el `?` globbea ⇒ el comando anotado no sería
> reproducible.

| gate | veredicto observado | evidencia (comando → salida) |
|------|---------------------|------------------------------|
| **CRUCES** | **ON** | `id="cruces"` presente en el DOM de `/parlamentario/D1165` |
| **VSIM** | **ON** | `curl "…/comparar?a=D1165&b=D1170"` → `Coinciden en <!-- -->3655<!-- --> de <!-- -->3672<!-- --> votaciones compartidas (<!-- -->100<!-- -->%)` |
| **NET** | **ON** | `"…/red?seed=D1165"` → **`200`** (con NET OFF la ruta 404ea, 113 §4.9.b) |
| **MONEY** | **OFF** | `"…/contraparte/1"` → **`404`** (gate MONEY, `page.tsx:50-52`); y en la ficha `D1165` **no** aparecen `id="dinero"` ni `id="financiamiento"` |
| **NOTIF** | **OFF** (ruta viva, feature **inerte**) | `…/cuenta` → **`200`**, pero el DOM emite `no están disponible` ⇒ la ruta responde y declara la indisponibilidad |

**Coincide con el CONTEXT y con 113** (`NET: ON, CRUCES: ON, VSIM: ON, MONEY: OFF, NOTIF: OFF`).

### 1.3 Dos hallazgos de método que gobiernan todo el artefacto

**HALLAZGO A — el par `D1165 × S1338` NO sirve para el literal VSIM.** `D1165` es **diputado** y
`S1338` es **senador**: no comparten ninguna votación, así que el eje **sí se renderiza** (VSIM ON)
pero en su **empty-state honesto**. ⇒ `grep -c "Coinciden en"` devuelve **`0`** para ese par.
**Cero NO es evidencia de gate OFF.** El par de trabajo mismo-cámara es **`D1165 × D1170`**.

**HALLAZGO B — el DOM lleva separadores de React (`<!-- -->`) entre el texto y los números.** Un
grep del literal armado **no matchea nunca**:

```html
Coinciden en <!-- -->3655<!-- --> de <!-- -->3672<!-- --> votaciones compartidas (<!-- -->100<!-- -->%).
```

⇒ **todos** los greps de este artefacto son **tolerantes a los separadores**
(`grep -o -E '.{N}<literal>.{M}'` y lectura de los dígitos). Un grep ingenuo devolvería 0 matches y
se leería, falsamente, como "el sitio no emite el número".

**Cómo se separó el HTML renderizado del flight payload de RSC.** Cada literal aparece DOS veces en
la respuesta: una en el HTML SSR y otra escapada dentro del payload de React
(`\"children\":\"27 parlamentarios comparten…`). El **`nº deploy` registrado es siempre el del HTML
renderizado**; los greps se filtraron con `grep -v '\\"'` cuando hizo falta. Ambos coincidieron en el
100 % de los casos leídos.

---

## 2. Relaciones entre parlamentarios

Superficie `/parlamentario/[id]` (§4.1 de 113, filas A4/A5). Emisor **E-022**
`app/components/cross-links-parlamentario.tsx` (`:105` el `conteoTexto`, `:133` el `Ver los N`,
`:140` el `Mostrando los primeros N de M`). Readers en
`app/app/parlamentario/[id]/page.tsx:198-206` (lector genérico `crossLinkReader` en `:187-196`);
el conteo lo arma `totalReal(filas)` (`page.tsx:365-368`) leyendo la columna **`total_n`** que
0061/0067 proyectan con `count(*) over ()` **antes** del `limit 20`.

**Captura del lado deploy** (una vez por superficie, grepeada sobre el archivo):

```bash
curl -s https://observatorio-congreso.thevalis.workers.dev/parlamentario/D1165          > /tmp/d1165.html
curl -s https://observatorio-congreso.thevalis.workers.dev/parlamentario/S1338          > /tmp/s1338.html
curl -s "https://observatorio-congreso.thevalis.workers.dev/comparar?a=D1165&b=S1338"   > /tmp/cmp_AS.html
curl -s "https://observatorio-congreso.thevalis.workers.dev/comparar?a=D1117&b=D1177"   > /tmp/cmp_DD.html
curl -s "https://observatorio-congreso.thevalis.workers.dev/comparar?a=D1165&b=D1170"   > /tmp/v_D1165D1170.html
curl -s "https://observatorio-congreso.thevalis.workers.dev/comparar?a=D1009&b=D1012"   > /tmp/v_D1009D1012.html
curl -s "https://observatorio-congreso.thevalis.workers.dev/comparar?a=D1009&b=S1110"   > /tmp/v_D1009S1110.html
```

### 2.1 Sujeto A — `D1165` (diputado, rico)

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| 1.1 | `/parlamentario/D1165` | `app/components/cross-links-parlamentario.tsx:105` (E-022) · reader `page.tsx:198` | `RPC:copartidarios_de_parlamentario` | `Q-04` / `Q-09` | `27` (`total_n`; filas devueltas `20`) | `27` | `cuadra` |
| 1.2 | `/parlamentario/D1165` | `app/components/cross-links-parlamentario.tsx:91` (E-022) · reader `page.tsx:199` | `RPC:de_la_misma_zona` | `Q-05` / `Q-10` | `0` (cero filas ⇒ `total_n` NULL) | `ausente del DOM` (`Q-36` → `0`) | `cuadra` |
| 1.3 | `/parlamentario/D1165` | `app/components/cross-links-parlamentario.tsx:105` (E-022) · reader `page.tsx:200` | `RPC:co_comisionados_de_parlamentario` | `Q-06` / `Q-11` | `24` (`total_n`; filas `20`) | `24` | `cuadra` |
| 1.4 | `/parlamentario/D1165` | `app/components/cross-links-parlamentario.tsx:105` (E-022) · reader `page.tsx:201` | `RPC:coautores_de_parlamentario` | `Q-07` / `Q-12` | `48` (`total_n`; filas `20`) | `48` | `cuadra` |
| 1.5 | `/parlamentario/D1165` | `app/components/cross-links-parlamentario.tsx:105` (E-022) · reader `page.tsx:206` | `RPC:militancia_historica_compartida` | `Q-08` / `Q-13` | `2` (`total_n`; filas `2`) | `2` | `cuadra` |

**Literales del DOM (verbatim, HTML renderizado):**

```
27 parlamentarios comparten el partido de la militancia vigente.
24 parlamentarios comparten al menos una comisión.
48 parlamentarios han co-firmado al menos un proyecto de ley.
En las militancias registradas: 2 parlamentarios militaron en un mismo partido (en períodos posiblemente distintos).
```

**Verificación explícita `total_n` vs `.length` cap-eado (regla LOCKED WR-01/WR-02).** Los tres ejes
cap-eados (`27`, `24`, `48` con `limit 20` en el canal de datos) muestran el **`total_n` honesto**,
NO el `.length`. Además el truncamiento se **declara** (`CrossLinkBloque:140`), nunca es silencioso:

```bash
grep -o -E 'Mostrando los primeros[^\\]{0,40}' /tmp/d1165.html | sort -u
# → Mostrando los primeros <!-- -->8<!-- --> de <!-- -->24<!-- -->
# → Mostrando los primeros <!-- -->8<!-- --> de <!-- -->27<!-- -->
# → Mostrando los primeros <!-- -->8<!-- --> de <!-- -->48<!-- -->
```

**Ningún bloque de la ficha muestra `.length` con `total_n` mayor ⇒ cero `discrepancia-corregida` en
§2.1.**

**Bloque "De la misma zona" ausente — es correcto, no un bug** (hallazgo 101-01 re-confirmado hoy):
la Cámara **no** registra distrito en PROD. `Q-14` lo prueba en agregado y sin fabricar zona:

```
diputados|155|0|0     ← 155 diputados, 0 con distrito, 0 con circunscripción
senado|31|0|31        ← 31 senadores, todos con circunscripción
```

`de_la_misma_zona('D1165')` devuelve 0 filas ⇒ `CrossLinkBloque` retorna `null`
(`cross-links-parlamentario.tsx:91`) ⇒ la `<section>` entera se omite (evidencia: `Q-36`).

### 2.2 Sujeto B — `S1338` (senador)

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| 1.6 | `/parlamentario/S1338` | `app/components/cross-links-parlamentario.tsx:105` (E-022) · reader `page.tsx:198` | `RPC:copartidarios_de_parlamentario` | `Q-04` / `Q-09` | `9` | `9` | `cuadra` |
| 1.7 | `/parlamentario/S1338` | `app/components/cross-links-parlamentario.tsx:105` (E-022) · reader `page.tsx:199` | `RPC:de_la_misma_zona` | `Q-05` / `Q-10` | `4` | `4` | `cuadra` |
| 1.8 | `/parlamentario/S1338` | `app/components/cross-links-parlamentario.tsx:91` (E-022) · reader `page.tsx:200` | `RPC:co_comisionados_de_parlamentario` | `Q-06` / `Q-11` | `0` (cero filas) | `ausente del DOM` (`Q-37` → `0`) | `cuadra` |
| 1.9 | `/parlamentario/S1338` | `app/components/cross-links-parlamentario.tsx:105` (E-022) · reader `page.tsx:201` | `RPC:coautores_de_parlamentario` | `Q-07` / `Q-12` | `21` (`total_n`; filas `20`) | `21` | `cuadra` |
| 1.10 | `/parlamentario/S1338` | `app/components/cross-links-parlamentario.tsx:105` (E-022) · reader `page.tsx:206` | `RPC:militancia_historica_compartida` | `Q-08` / `Q-13` | `2` | `2` | `cuadra` |

**Literales del DOM (verbatim):**

```
9 parlamentarios comparten el partido de la militancia vigente.
4 parlamentarios comparten la zona electoral (distrito o circunscripción).
21 parlamentarios han co-firmado al menos un proyecto de ley.
En las militancias registradas: 2 parlamentarios militaron en un mismo partido (en períodos posiblemente distintos).
Mostrando los primeros <!-- -->8<!-- --> de <!-- -->9<!-- -->.
Mostrando los primeros <!-- -->8<!-- --> de <!-- -->21<!-- -->.
```

### 2.3 [RULE-1] `S1338` **NO** es el caso de vacío honesto que asumía el plan

El plan 122-02 pedía: *"Para S1338 verificar el contrato de vacío honesto: los 5 ejes en
`total_n = 0` ⇒ el deploy debe emitir la ausencia DECLARADA (`RelacionesSection vacio`)"*.
**La realidad de PROD lo contradice y manda la realidad:** `S1338` tiene **4 de 5 ejes con datos**
(9 / 4 / 0 / 21 / 2). El contrato `RelacionesSection vacio` (`page.tsx:382-395`) **no se dispara**
para este sujeto — y no puede dispararse para ninguno: `Q-15` (búsqueda determinista de un sujeto con
los 5 ejes en `total_n = 0`) devuelve **`(0 filas)`**. Se declara como **LÍMITE 1**, con la query que
lo demuestra, en vez de fabricar un sujeto o de afirmar que el contrato "funciona". Lo que **sí**
quedó verificado es el vacío honesto **por bloque** (`return null` con `total_n = 0`): filas **1.2**
y **1.8**.

### 2.4 Conteos del resumen de la ficha (chips above-the-fold)

Punto único de conteos: `app/lib/parlamentario-resumen-conteos.ts` (`contarCarriles` `:262-442`,
`derivarEstado` `:228-238`). **La lib NO tiene id `E-NNN` propio**: se cita por ruta.

#### 2.4.0 [RULE-1] Dónde salen realmente los chips: E-029 **no emite DOM**

El plan asumía que los chips los renderiza **E-029** `app/components/parlamentario-resumen.tsx`
(`ResumenView`). **En el código desplegado `ResumenView` no tiene call-site:**

```bash
grep -rn "ResumenView\|ParlamentarioResumen" app --include=*.tsx --include=*.ts \
  | grep -v "\.test\." | grep -v "components/parlamentario-resumen.tsx"
# → (sin resultados)

grep -n "parlamentario-resumen" app/app/parlamentario/\[id\]/page.tsx
# → 10:} from "@/components/parlamentario-resumen";   ← importa SOLO `construirChips` + el tipo `ResumenChip`

grep -c 'aria-label="Secciones de la ficha"' /tmp/d1165.html   # → 0
grep -c 'aria-label="Secciones de la ficha"' /tmp/s1338.html   # → 0
```

Los chips que **sí** llegan al DOM los emite el **rail**: `ParlamentarioRail` (`page.tsx:520-550`)
consume `construirChips(conteos)` → `chipToRailEntry` (`page.tsx:108`) → `FichaRail`. Es **la misma
lib de conteos**, expuesta por otra superficie. Mismo patrón de emisor huérfano de §0.4. Emisores
realmente auditados:

| emisor real | archivo:línea | qué emite |
|-------------|---------------|-----------|
| rail (chips) | `app/app/parlamentario/[id]/page.tsx:520-550` vía `construirChips` (`parlamentario-resumen.tsx:128-161`) | los 4 conteos del rail |
| header de carril | `app/app/parlamentario/[id]/page.tsx:585-703` (`CarrilHeader conteo=`) | el conteo del `<h2>` de cada carril |
| disclosure | `app/components/detalle-colapsable.tsx` (`Ver detalle (N)`) | el mismo conteo del carril |
| asistencia | `app/components/votos-por-parlamentario.tsx:717-728` | `Presente en N de M … · Ausente en K` **o** `Emitió N votos registrados` |
| capa-1 votos | `app/components/capa1/votos-capa1.tsx:74-100` | desglose por sentido + `%` de asistencia |

#### 2.4.1 Tabla de veredicto

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| 2.1 | `/parlamentario/D1165` #votos | `page.tsx:586` + `detalle-colapsable` · conteo de `parlamentario-resumen-conteos.ts:279-291` | `RPC:votos_de_parlamentario` (`p_limit: 1000`) vs `voto.parlamentario_id` | `Q-16` / `Q-17` | **`3752`** (real, `estado_vinculo='confirmado'`) | **`1000`** (`Ver detalle (1000)`) | `discrepancia-declarada` (WR-03) |
| 2.2 | `/parlamentario/D1165` #lobby | `page.tsx:613` · `parlamentario-resumen-conteos.ts:326` | `RPC:lobby_de_parlamentario` → `count(distinct identificador)` vs `lobby_audiencia.identificador` | `Q-19` / `Q-20` | `112` | `112` (`Ver detalle (112)`) | `cuadra` |
| 2.3 | `/parlamentario/D1165` #patrimonio | `page.tsx` `CarrilHeader` · `parlamentario-resumen-conteos.ts:350` | `RPC:declaraciones_de_parlamentario` vs `declaracion.parlamentario_id` | `Q-21` / `Q-22` | `6` | `6` (`Ver detalle (6)`) | `cuadra` |
| 2.4 | `/parlamentario/D1165` #cruces | `page.tsx` `CarrilHeader` (chip "Lobby por sector") · `parlamentario-resumen-conteos.ts:387` | `RPC:cruces_de_parlamentario` vs `cruce_senal.parlamentario_id` | `Q-23` / `Q-24` | `11` | `11` | `cuadra` |
| 2.5 | `/parlamentario/D1165` #votos | `app/components/votos-por-parlamentario.tsx:717-724` | `voto.seleccion <> 'ausente'` sobre confirmados | `Q-18` | `3723` de `3752` | `973` de `1000` | `discrepancia-declarada` (hereda 2.1) |
| 2.6 | `/parlamentario/D1165` #votos (capa-1) | `app/components/capa1/votos-capa1.tsx:74-100` | `voto.seleccion` (desglose) | `Q-25` | `si 1764 · no 1772 · abstención 171 · pareo 16 · ausente 29` (Σ 3752); asistencia `99,2 %` | `A favor 469 · En contra 466 · Abstención 22 · Pareo 16 · Ausente 27` (Σ 1000); asistencia `97,3 %` | `discrepancia-declarada` (hereda 2.1) |
| 2.7 | `/parlamentario/S1338` #votos | `page.tsx:586` + `detalle-colapsable` | `RPC:votos_de_parlamentario` (`p_limit: 1000`) vs `voto.parlamentario_id` | `Q-16` / `Q-17` | `949` (bajo el cap) | `949` | `cuadra` |
| 2.8 | `/parlamentario/S1338` #lobby | `page.tsx:613` · `derivarEstado` (`:228-238`) | `RPC:lobby_de_parlamentario` + `lobby_ingesta_estado` | `Q-19` / `Q-20` / `Q-26` | `0` audiencias **y** `0` filas de marcador ⇒ estado `no_ingerido` | `—` | `cuadra` |
| 2.9 | `/parlamentario/S1338` #patrimonio | `page.tsx` `CarrilHeader` | `RPC:declaraciones_de_parlamentario` vs `declaracion.parlamentario_id` | `Q-21` / `Q-22` | `9` | `9` | `cuadra` |
| 2.10 | `/parlamentario/S1338` #cruces | `page.tsx` `CarrilHeader` (chip "Lobby por sector") | `RPC:cruces_de_parlamentario` vs `cruce_senal.parlamentario_id` | `Q-23` / `Q-24` | `0` **con** gate CRUCES ON ⇒ estado `vacio` | `sin registros` | `cuadra` |
| 2.11 | `/parlamentario/S1338` #votos (asistencia) | `app/components/votos-por-parlamentario.tsx:725-728` | `voto.seleccion <> 'ausente'` | `Q-18` / `Q-25` | `949` presentes de `949`; `0` ausentes | `Emitió 949 votos registrados.` (rama `ausentes = 0`) | `cuadra` |

#### 2.4.2 WR-03 — el cap `p_limit: 1000` con AMBOS números

Es la discrepancia REAL más grande del artefacto y se registra completa, **sin borrar el número
erróneo** (§0.1, corolario):

| magnitud | nº SQL (PROD, `Q-16`/`Q-18`/`Q-25`) | nº deploy (`/parlamentario/D1165`) | delta |
|----------|------------------------------------:|-----------------------------------:|------:|
| votos confirmados | **3.752** | **1.000** | −2.752 |
| presentes | **3.723** | 973 | −2.750 |
| ausentes | **29** | 27 | −2 |
| a favor | 1.764 | 469 | −1.295 |
| en contra | 1.772 | 466 | −1.306 |
| abstención | 171 | 22 | −149 |
| pareo | 16 | 16 | 0 |
| asistencia (%) | **99,2 %** | **97,3 %** | −1,9 pp |

**Doble lectura, ejecutada:** la RPC devuelve exactamente `1000` filas para `D1165` (`Q-17`) mientras
la query de primeros principios devuelve `3752` (`Q-16`). Confirmado en el DOM (`Q-39`).

**Hallazgo agravante que el plan no anticipaba:** el cap **no solo trunca el total**, sino que
distorsiona la **composición**. `votos_de_parlamentario` ordena `by vo.fecha desc` — el chip muestra
el desglose de las **1.000 votaciones más recientes** presentado como si fuera el histórico completo.
La `%` de asistencia mostrada (97,3 %) es la de esa ventana, no la real (99,2 %). La ventana es
además **inestable**: cada ingesta nueva cambia los 5 números sin que el total mostrado (1000) se
mueva.

**Por qué `discrepancia-declarada` y no `-corregida`:** el fix honesto exige un **RPC de conteo
dedicado** (aguja completa por régimen: cero-grant `>0044`, secdef PII-safe con `search_path`,
`PUBLIC_RPC_ALLOWLIST`, bounded) y el cambio **simultáneo** de 5 superficies sincronizadas byte-a-byte
(chip, `<h2>`, `Ver detalle`, asistencia, capa-1). Handoff: **Phase 124**.

#### 2.4.3 Denominador de lobby — verificado, honesto en ambos sujetos

`lobby_de_parlamentario` (definición leída de PROD) **NO filtra `estado_vinculo`**. El código dedupe
por `identificador` (`parlamentario-resumen-conteos.ts:326`). Se contrastaron las tres lecturas
(`Q-19`, `Q-20`):

| sujeto | `count(distinct identificador)` **sin** filtro | **con** `estado_vinculo='confirmado'` | vía RPC (lo que ve el sitio) | nº deploy |
|--------|----------------------------------------------:|--------------------------------------:|------------------------------:|----------:|
| `D1165` | `112` | `112` | `112` | `112` |
| `S1338` | `0` | `0` | `0` | `—` |

**Los tres números coinciden.** La garantía es **por los datos, no por el predicado** — ver §6.1
(`Q-66`) para la causa estructural y §Límites para la fragilidad declarada.

#### 2.4.4 Estados 3-valores verificados por SQL (no asumidos)

| chip | nº deploy | SQL | veredicto |
|------|-----------|-----|-----------|
| `S1338` · Reuniones de lobby | `—` (`no_ingerido`) | `lobby_audiencia` = 0 filas **y** `lobby_ingesta_estado` = **0** filas ⇒ `ingestado = false` | `cuadra` — "—" es el estado honesto correcto |
| `S1338` · Lobby por sector | `sin registros` (`vacio`) | `cruce_senal` = 0 filas, gate CRUCES **ON** ⇒ `ingestado = true` (cron global) | `cuadra` |
| `D1165` · Reuniones de lobby | `112` (`dato`) | `lobby_ingesta_estado` = **1** fila | `cuadra` |
| `S1338` · Declaraciones de patrimonio | `9` (`dato`) | `probidad_ingesta_estado` = **1** fila | `cuadra` |
| ambos · Financiamiento y contratos | `pendiente` | MONEY **OFF** (§1.2) ⇒ cero RPC de dinero invocado | `cuadra` — LÍMITE B |

### 2.5 [HUECO CERRADO EN 122-06] `/red` — el grafo de relaciones (E-011, gate NET ON)

**Por qué está aquí.** El barrido de cobertura emisor-por-emisor (tabla final) detectó que **E-011**
`app/components/red/red-graph.tsx` emite un cruce cuantificado —`80 vecinos · 235 hechos
documentados`— que el universo §0.3 **no había incluido**. Es un **HUECO real**, no una omisión
justificable: se cierra **aquí y ahora** con el mismo método (RPC por psql + primeros principios +
`curl` del deploy), no se declara "no aplica".

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| H-1 | `/red?seed=D1165` | `app/components/red/red-graph.tsx:333,573` (E-011) | `RPC:subgrafo_red` vs `arista.extremo_a` / `.extremo_b` | `Q-79` / `Q-80` / `Q-81` | RPC: `80` vecinos · `235` hechos seed↔vecino (grafo completo: `81` nodos / `4501` aristas) · primeros principios sobre `arista`: `80` / `235` | `80 vecinos<!-- --> ·<!-- --> <!-- -->235 hechos documentados` | `cuadra` |
| H-2 | `/red?seed=S1338` | `app/components/red/red-graph.tsx:424` (E-011, estado honesto `aristas.length === 0`) | `RPC:subgrafo_red` vs `arista` | `Q-79` / `Q-80` / `Q-81` | RPC: `0` nodos / `0` aristas · primeros principios: `0` | `Aún no hay relaciones para mostrar para este parlamentario. Cuando existan hechos públicos que vinculen a dos parlamentarios …` (**cero-como-cero**, ruta `200`) | `cuadra` |

**Nota de contrato (leída del código, no asumida):** los `235 hechos` **no** son las `4501` aristas
del subgrafo. `red-graph.tsx:328` suma sólo los hechos **seed↔vecino** (`hechosPorVecino`); las
aristas vecino↔vecino existen en el JSON pero no entran en ese total. La query `Q-79` reproduce
exactamente ese predicado (`e->>'a' = seed or e->>'b' = seed`), y `Q-80` lo confirma contra la tabla
base. **Los tres números coinciden.**

### 2.6 Queries de §2

**`Q-04` — copartidarios: filas devueltas + `total_n`**

```sql
select count(*), max(total_n) from public.copartidarios_de_parlamentario('<SUJETO>');
-- observado 2026-07-29: D1165 → 20|27   ·   S1338 → 9|9
```

**`Q-05` — de la misma zona**

```sql
select count(*), max(total_n) from public.de_la_misma_zona('<SUJETO>');
-- observado 2026-07-29: D1165 → 0|NULL   ·   S1338 → 4|4
```

**`Q-06` — co-comisionados**

```sql
select count(*), max(total_n) from public.co_comisionados_de_parlamentario('<SUJETO>');
-- observado 2026-07-29: D1165 → 20|24   ·   S1338 → 0|NULL
```

**`Q-07` — co-autores**

```sql
select count(*), max(total_n) from public.coautores_de_parlamentario('<SUJETO>');
-- observado 2026-07-29: D1165 → 20|48   ·   S1338 → 20|21
```

**`Q-08` — militancia histórica compartida**

```sql
select count(*), max(total_n) from public.militancia_historica_compartida('<SUJETO>');
-- observado 2026-07-29: D1165 → 2|2   ·   S1338 → 2|2
```

**`Q-09` — copartidarios = militancia VIGENTE compartida por `partido_alias`**

```sql
select count(distinct p2.id)
from public.parlamentario_militancia m1
join public.parlamentario_militancia m2
  on m2.partido_alias = m1.partido_alias and m2.es_actual
join public.parlamentario p2 on p2.id = m2.parlamentario_id
where m1.parlamentario_id = '<SUJETO>' and m1.es_actual and p2.id <> '<SUJETO>';
-- observado 2026-07-29: D1165 → 27   ·   S1338 → 9      (== total_n de Q-04)
```

**`Q-10` — misma zona = distrito o circunscripción coincidente (NULL nunca matchea)**

```sql
select count(*)
from public.parlamentario p1
join public.parlamentario p2
  on p2.id <> p1.id
 and ( (p1.distrito is not null       and p2.distrito = p1.distrito)
    or (p1.circunscripcion is not null and p2.circunscripcion = p1.circunscripcion) )
where p1.id = '<SUJETO>';
-- observado 2026-07-29: D1165 → 0   ·   S1338 → 4        (== total_n de Q-05)
```

**`Q-11` — co-comisionados = `comision_membresia` compartida**

```sql
select count(distinct cm2.parlamentario_id)
from public.comision_membresia cm1
join public.comision_membresia cm2 on cm2.comision_id = cm1.comision_id
where cm1.parlamentario_id = '<SUJETO>' and cm2.parlamentario_id <> '<SUJETO>';
-- observado 2026-07-29: D1165 → 24   ·   S1338 → 0       (== total_n de Q-06)
```

**`Q-12` — co-autores = `proyecto_autor` con `estado_vinculo='confirmado'` en AMBOS lados**

```sql
select count(distinct a2.parlamentario_id)
from public.proyecto_autor a1
join public.proyecto_autor a2
  on a2.boletin = a1.boletin
 and a2.estado_vinculo = 'confirmado'
 and a2.parlamentario_id is not null
 and a2.parlamentario_id <> '<SUJETO>'
join public.parlamentario p2 on p2.id = a2.parlamentario_id
where a1.parlamentario_id = '<SUJETO>' and a1.estado_vinculo = 'confirmado';
-- observado 2026-07-29: D1165 → 48   ·   S1338 → 21      (== total_n de Q-07)
```

**`Q-13` — militancia histórica NET-NEW-ONLY (cruce por `partido_alias`, excluyendo alias vigente compartido)**

```sql
select count(distinct p2.id)
from public.parlamentario_militancia m1
join public.parlamentario_militancia m2
  on m2.partido_alias = m1.partido_alias
 and m2.parlamentario_id <> m1.parlamentario_id
join public.parlamentario p2 on p2.id = m2.parlamentario_id
where m1.parlamentario_id = '<SUJETO>' and p2.id <> '<SUJETO>'
  and not exists (
    select 1
    from public.parlamentario_militancia mv1
    join public.parlamentario_militancia mv2
      on mv2.partido_alias = mv1.partido_alias
     and mv2.parlamentario_id = m2.parlamentario_id
     and mv2.es_actual
    where mv1.parlamentario_id = '<SUJETO>' and mv1.es_actual);
-- observado 2026-07-29: D1165 → 2   ·   S1338 → 2        (== total_n de Q-08)
```

**`Q-14` — cobertura de zona por cámara (agregado, cero PII)**

```sql
select camara, count(*) n, count(distrito) con_distrito, count(circunscripcion) con_circ
from public.parlamentario group by 1 order by 1;
-- observado 2026-07-29:
--   diputados|155|0|0
--   senado|31|0|31
```

**`Q-15` — ¿existe algún sujeto con los 5 ejes en `total_n = 0`? (contrato de vacío honesto)**

```sql
select p.id,
  coalesce((select max(total_n) from public.copartidarios_de_parlamentario(p.id)),0)      c1,
  coalesce((select max(total_n) from public.de_la_misma_zona(p.id)),0)                    c2,
  coalesce((select max(total_n) from public.co_comisionados_de_parlamentario(p.id)),0)    c3,
  coalesce((select max(total_n) from public.coautores_de_parlamentario(p.id)),0)          c4,
  coalesce((select max(total_n) from public.militancia_historica_compartida(p.id)),0)     c5
from public.parlamentario p
where coalesce((select max(total_n) from public.copartidarios_de_parlamentario(p.id)),0)   = 0
  and coalesce((select max(total_n) from public.de_la_misma_zona(p.id)),0)                 = 0
  and coalesce((select max(total_n) from public.co_comisionados_de_parlamentario(p.id)),0) = 0
  and coalesce((select max(total_n) from public.coautores_de_parlamentario(p.id)),0)       = 0
  and coalesce((select max(total_n) from public.militancia_historica_compartida(p.id)),0)  = 0
order by p.id asc            -- desempate estable por PK
limit 3;
-- observado 2026-07-29: (0 filas) → el contrato NO es observable en PROD
```

**`Q-16` — votos: primeros principios (el número REAL)**

```sql
select count(*)
from public.voto v
join public.votacion vo on vo.id = v.votacion_id
where v.parlamentario_id = '<SUJETO>' and v.estado_vinculo = 'confirmado';
-- observado 2026-07-29: D1165 → 3752   ·   S1338 → 949
-- (sin el filtro de estado_vinculo el total es idéntico: D1165 → 3752, S1338 → 949)
```

**`Q-17` — votos: la MISMA RPC que lee el sitio, con el mismo `p_limit`**

```sql
select count(*) from public.votos_de_parlamentario('<SUJETO>', 1000, 0);
-- observado 2026-07-29: D1165 → 1000  (CAP alcanzado)   ·   S1338 → 949  (bajo el cap)
```

**`Q-18` — asistencia (presentes = selección distinta de `ausente`)**

```sql
-- (a) primeros principios
select count(*)
from public.voto v join public.votacion vo on vo.id = v.votacion_id
where v.parlamentario_id = '<SUJETO>' and v.estado_vinculo = 'confirmado'
  and v.seleccion <> 'ausente';
-- observado 2026-07-29: D1165 → 3723   ·   S1338 → 949

-- (b) lo que ve el sitio (misma RPC, mismo cap)
select count(*) from public.votos_de_parlamentario('<SUJETO>', 1000, 0) where seleccion <> 'ausente';
-- observado 2026-07-29: D1165 → 973   ·   S1338 → 949
```

**`Q-19` — lobby: denominador honesto por `identificador`, con y sin el predicado**

```sql
select count(distinct identificador) from public.lobby_audiencia where parlamentario_id = '<SUJETO>';
-- observado 2026-07-29: D1165 → 112   ·   S1338 → 0

select count(distinct identificador) from public.lobby_audiencia
where parlamentario_id = '<SUJETO>' and estado_vinculo = 'confirmado';
-- observado 2026-07-29: D1165 → 112   ·   S1338 → 0     ⇒ el predicado NO cambia el número hoy
```

**`Q-20` — lobby vía la RPC que lee el sitio (dedupe por `identificador`, espejo del código)**

```sql
select count(distinct identificador) from public.lobby_de_parlamentario('<SUJETO>');
-- observado 2026-07-29: D1165 → 112   ·   S1338 → 0
```

**`Q-21` / `Q-22` — patrimonio: tabla base vs RPC**

```sql
select count(*) from public.declaracion where parlamentario_id = '<SUJETO>';          -- Q-21
-- observado 2026-07-29: D1165 → 6   ·   S1338 → 9
select count(*) from public.declaraciones_de_parlamentario('<SUJETO>');               -- Q-22
-- observado 2026-07-29: D1165 → 6   ·   S1338 → 9
```

**`Q-23` / `Q-24` — cruces: tabla base vs RPC**

```sql
select count(*) from public.cruce_senal where parlamentario_id = '<SUJETO>';          -- Q-23
-- observado 2026-07-29: D1165 → 11   ·   S1338 → 0
select count(*) from public.cruces_de_parlamentario('<SUJETO>');                      -- Q-24
-- observado 2026-07-29: D1165 → 11   ·   S1338 → 0
```

**`Q-25` — desglose REAL por selección (fuente única de "Cómo votó")**

```sql
select v.seleccion, count(*)
from public.voto v join public.votacion vo on vo.id = v.votacion_id
where v.parlamentario_id = '<SUJETO>' and v.estado_vinculo = 'confirmado'
group by 1 order by 1;
-- observado 2026-07-29:
--   D1165 → abstencion|171 · ausente|29 · no|1772 · pareo|16 · si|1764        (Σ 3752)
--   S1338 → abstencion|23  · no|157     · si|769                              (Σ 949)
```

**`Q-26` — marcadores de ingesta (deciden `vacio` vs `no_ingerido`)**

```sql
select count(*) from public.lobby_ingesta_estado    where parlamentario_id = '<SUJETO>';
-- observado 2026-07-29: D1165 → 1   ·   S1338 → 0
select count(*) from public.probidad_ingesta_estado where parlamentario_id = '<SUJETO>';
-- observado 2026-07-29: S1338 → 1
```

**`Q-79` — [122-06] `/red`: la MISMA RPC que lee el sitio, con el predicado de "hechos" del componente**

```sql
-- (a) tamaño del subgrafo completo
select jsonb_array_length(r->'nodos') n_nodos, jsonb_array_length(r->'aristas') n_aristas
from (select public.subgrafo_red('<SUJETO>') r) s;
-- observado 2026-07-29: D1165 → 81|4501   ·   S1338 → 0|0

-- (b) lo que el componente MUESTRA: vecinos y hechos seed↔vecino (red-graph.tsx:328,333)
with a as (select jsonb_array_elements(public.subgrafo_red('<SUJETO>')->'aristas') e)
select count(*) filter (where e->>'a'='<SUJETO>' or e->>'b'='<SUJETO>') hechos_seed,
       count(distinct case when e->>'a'='<SUJETO>' then e->>'b'
                           when e->>'b'='<SUJETO>' then e->>'a' end) vecinos
from a;
-- observado 2026-07-29: D1165 → 235|80   ·   S1338 → 0|0
```

**`Q-80` — [122-06] `/red`: primeros principios contra la tabla `arista`**

```sql
select count(*) hechos_pp,
       count(distinct case when extremo_a = '<SUJETO>' then extremo_b else extremo_a end) vecinos_pp
from public.arista
where extremo_a = '<SUJETO>' or extremo_b = '<SUJETO>';
-- observado 2026-07-29: D1165 → 235|80   ·   S1338 → 0|0      (== Q-79(b))
select count(*) from public.arista;   -- observado 2026-07-29: 7394 (universo del grafo)
```

**`Q-81` — [122-06] `/red`: lectura del DOM (tolerante a `<!-- -->`)**

```bash
curl -s "https://observatorio-congreso.thevalis.workers.dev/red?seed=D1165" -o /tmp/red_D1165.html
grep -o -E '.{40}vecinos.{60}' /tmp/red_D1165.html
# → …<p class="net-b-seednote">80 vecinos<!-- --> ·<!-- --> <!-- -->235 hechos documentados<!-- -->.

curl -s -o /dev/null -w "%{http_code}\n" "https://observatorio-congreso.thevalis.workers.dev/red?seed=S1338"   # → 200
curl -s "https://observatorio-congreso.thevalis.workers.dev/red?seed=S1338" \
  | grep -o -E '.{80}no hay relaciones para mostrar.{0,120}'
# → …<p class="text-base leading-relaxed text-muted-foreground">Aún no hay relaciones para mostrar
#    para este parlamentario. Cuando existan hechos públicos que vinculen a dos parlamentarios …
```

---

## 3. `/comparar` (4 ejes + VSIM)

Emisor **E-051** `app/app/comparar/page.tsx` (`CompararEjes` `:217-548`). Pares usados:

- **Par 1 (cross-cámara, estados de ausencia):** `A = D1165`, `B = S1338` — los sujetos deterministas.
- **Par 2 (mismo-cámara, con datos):** `A = D1117`, `B = D1177` — **elegido por SQL** con desempate
  estable (`Q-27`).

> **[RULE-1] Corrección al plan — el 4º eje NO es "partido vigente".** En el código real
> (`page.tsx:446-492`) el 4º eje es **"Zona electoral"**, y `parlamentarios_publico_v2` es el
> **roster** del que sale `circunscripcion`/`distrito` (`zonaDe`, `:659-668`). No existe eje de
> partido vigente en `/comparar`. Se audita el eje que el deploy emite.
>
> **[RULE-1] Ningún par diputado-diputado puede "tener datos en los 4 ejes".** `Q-14` prueba que los
> **155** diputados de PROD tienen `distrito` **y** `circunscripcion` en NULL. El par 2 se eligió
> maximizando los **3 ejes determinables**; el 4º queda como caso de ausencia honesta.

### 3.1 Los 4 ejes

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| 3.1 | `/comparar?a=D1165&b=S1338` · Militancia (histórica) | `app/app/comparar/page.tsx:627-638` (E-051) | `RPC:militancia_historica_compartida` | `Q-28` / `Q-13` | columnas `2` / `2`; par **ausente** en ambas direcciones (listas completas: 2<20 y 2<20) | columnas `2` / `2`; `…no registran militancia histórica compartida fuera del partido vigente.` | `cuadra` |
| 3.2 | `/comparar?a=D1165&b=S1338` · Comisiones | `app/app/comparar/page.tsx:334-391` (E-051) | `RPC:comisiones_de_parlamentario` | `Q-29` / `Q-30` | intersección `camara::nombre` = `0`; listas `2` y `0`, ambas < `CAP_RPC_COMISIONES` (50) ⇒ completas | `En las fuentes consultadas al 2026-07-29, no comparten comisiones.` | `cuadra` |
| 3.3 | `/comparar?a=D1165&b=S1338` · Co-autoría de proyectos | `app/app/comparar/page.tsx:641-652` + `:406-434` (E-051) | `RPC:coautores_de_parlamentario` | `Q-31` / `Q-32` | columnas `48` / `21`; boletines co-firmados = **`0`** (ausencia REAL) | columnas `48` / `21`; `…están truncadas (más de 20 registros…) y no permiten determinar si comparten proyectos co-firmados.` | `discrepancia-declarada` (fail-closed CR-01 — ver §3.3) |
| 3.4 | `/comparar?a=D1165&b=S1338` · Zona electoral | `app/app/comparar/page.tsx:454-492` + `:659-668` (E-051) | `RPC:parlamentarios_publico_v2` → `parlamentario.circunscripcion` / `.distrito` | `Q-33` | `D1165` zona NULL; `S1338` `Circunscripción 7` ⇒ no comparten | `Sin zona electoral registrada para …`; `Circunscripción 7`; `…no comparten zona` | `cuadra` |
| 3.5 | `/comparar?a=D1117&b=D1177` · Militancia (histórica) | `app/app/comparar/page.tsx:264-295` (E-051) | `RPC:militancia_historica_compartida` | `Q-28` / `Q-13` | columnas `2` / `44`; par **presente** (dirección A→B `true`, B→A `false`) | columnas `2` / `44`; `Militaron en un mismo partido (en períodos posiblemente distintos; sin compartir el partido vigente).` | `cuadra` |
| 3.6 | `/comparar?a=D1117&b=D1177` · Comisiones | `app/app/comparar/page.tsx:372-388` (E-051) | `RPC:comisiones_de_parlamentario` | `Q-29` / `Q-30` | intersección RPC = `2`; primeros principios (`comision_membresia`) = `2`; listas `3` y `3` (< 50 ⇒ completas) | `Comparten 2 comisiones` | `cuadra` |
| 3.7 | `/comparar?a=D1117&b=D1177` · Co-autoría de proyectos | `app/app/comparar/page.tsx:406-444` (E-051) | `RPC:coautores_de_parlamentario` (`n_proyectos`) | `Q-31` / `Q-32` | columnas `56` / `89`; `n_proyectos` del par = **`20`**; primeros principios = **`20`** | columnas `56` / `89`; `Comparten 20 proyectos co-firmados.` | `cuadra` |
| 3.8 | `/comparar?a=D1117&b=D1177` · Zona electoral | `app/app/comparar/page.tsx:454-492` (E-051) | `RPC:parlamentarios_publico_v2` | `Q-33` | ambas zonas NULL ⇒ no comparten (NULL nunca hace match) | `Sin zona electoral registrada para …` ×2; `…no comparten zona` | `cuadra` |

### 3.2 Los 3 estados verificados (compartido / no compartido / eje ausente)

| estado | evidencia observada | filas |
|--------|---------------------|-------|
| **compartido** | `Comparten 2 comisiones` · `Comparten 20 proyectos co-firmados` · `Militaron en un mismo partido` | 3.5, 3.6, 3.7 |
| **no compartido** (ausencia DECLARADA con fuente y fecha) | `En las fuentes consultadas al 2026-07-29, no comparten comisiones.` · `…no comparten zona` · `…no registran militancia histórica compartida fuera del partido vigente.` | 3.1, 3.2, 3.4, 3.8 |
| **eje ausente / indeterminado** (declara el límite del canal, NO un 0) | `Las listas consultadas al 2026-07-29 están truncadas (más de 20 registros por parlamentario) y no permiten determinar si comparten proyectos co-firmados.` | 3.3 |

**Ningún eje emite un `0` pelado que se lea como "no comparten".**

**Disciplina de completitud, verificada.** Las columnas muestran `totalHonesto` = `total_n`
(`page.tsx:594-597`), NO el `.length` cap-eado: la fila 3.7 lo prueba en el caso duro — `D1177` tiene
`total_n = 89` con la lista cap-eada en 20 filas, y el DOM emite **`89 co-autores registrados`**.

**El eje de comisiones NO emite `total_n`** (`page.tsx:580-583`): su única señal de completitud es
`length < CAP_RPC_COMISIONES` (50). **Ningún par auditado roza el cap** (`2`, `0`, `3`, `3`):

```bash
grep -c "Lista posiblemente truncada" /tmp/cmp_AS.html   # → 0
grep -c "Lista posiblemente truncada" /tmp/cmp_DD.html   # → 0
```

⇒ **cero `discrepancia-corregida` por el cap de comisiones.**

### 3.3 Fila 3.3 — por qué es `discrepancia-declarada`

El SQL **determina el hecho**: `D1165` y `S1338` comparten **0** boletines co-firmados confirmados
(`Q-32`). El deploy **no lo afirma**: declara indeterminación porque ambas listas están truncadas
(48>20 y 21>20) y `interseccionPar` (`page.tsx:605-618`) es **fail-closed** por diseño CR-01 — con
ambas listas cap-eadas prefiere declarar el límite antes que afirmar una ausencia que podría ser
falsa. Es la disciplina correcta y **no se toca**: el riesgo #1 del proyecto es una ausencia falsa con
atribución de fuente. Se registra igual, con ambos lados. El fix honesto sería que la RPC emitiera
membresía de par — **diseño de RPC nuevo, handoff Phase 124**.

### 3.4 VSIM — "Coinciden en N de M"

Emisor: `app/components/similitud-votacion-comparar.tsx:120` (inventariado en **§4.7 filas C3/C4**
de 113 — **sin id `E-NNN` propio**). Origen `RPC:coincidencia_votos_par` (0068). Gate **VSIM ON**.

**Los 3 pares son los del precedente 104-03**, nombrados verbatim en su SUMMARY:

> *"N/M cuadra contra SQL para **3 pares reales** (D1165/D1170=3655/3672; D1009/D1012=932/2495;
> M=0 D1009/S1110 → 'Sin votaciones compartidas suficientes')."*

**Denominador VSIM explícito** (0068, leído verbatim de la migración): sólo votaciones donde **ambos**
emitieron selección **sustantiva** `seleccion in ('si','no','abstencion')` sobre
`estado_vinculo = 'confirmado'`. **`pareo` y `ausente` están EXCLUIDOS** del numerador **y** del
denominador (VSIM-01). Cada lado deduplica por `votacion_id` con
`having count(distinct seleccion) = 1`.

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| 4.1 | `/comparar?a=D1165&b=D1170` | `app/components/similitud-votacion-comparar.tsx:120` (113 §4.7 C3/C4) | `RPC:coincidencia_votos_par` | `Q-34` / `Q-35` | `n_coinciden = 3655`, `m_compartidas = 3672`, cociente real `99,537 %` | `Coinciden en 3655 de 3672 votaciones compartidas (100%).` | `cuadra` (ver §3.5) |
| 4.2 | `/comparar?a=D1009&b=D1012` | `app/components/similitud-votacion-comparar.tsx:120` (113 §4.7 C3/C4) | `RPC:coincidencia_votos_par` | `Q-34` / `Q-35` | `932` / `2495`, cociente real `37,355 %` | `Coinciden en 932 de 2495 votaciones compartidas (37%).` | `cuadra` |
| 4.3 | `/comparar?a=D1009&b=S1110` | `app/components/similitud-votacion-comparar.tsx:96-108` (113 §4.7 C3/C4) | `RPC:coincidencia_votos_par` | `Q-34` / `Q-35` | `0` / `0` / `fecha_captura_max` NULL (cross-cámara) | `Sin votaciones compartidas suficientes en las fuentes consultadas al 2026-07-29.` — **sin figura, sin `0 %`** | `cuadra` |

**Literales del DOM, verbatim (con los separadores de React):**

```html
<p class="mt-4 text-sm">Coinciden en <!-- -->3655<!-- --> de <!-- -->3672<!-- --> votaciones compartidas (<!-- -->100<!-- -->%).</p>
<p class="mt-4 text-sm">Coinciden en <!-- -->932<!-- --> de <!-- -->2495<!-- --> votaciones compartidas (<!-- -->37<!-- -->%).</p>
Sin votaciones compartidas suficientes en las fuentes consultadas al 2026-07-29.
```

**Doble lectura ejecutada en los 3 pares:** la RPC y la query de primeros principios (`Q-35`)
devuelven **exactamente los mismos N y M** en los tres casos. Cero divergencia RPC ↔ primeros
principios.

**Par bonus `D1117 × D1177`** (leído en el mismo `curl` de §3.1): SQL `2774 / 2917` (cociente
`95,098 %`), deploy `Coinciden en 2774 de 2917 votaciones compartidas (95%).` — `cuadra`
(`Math.round(95.098) = 95`).

### 3.5 El lead `(100%)` sobre `3655/3672` — adjudicado como `cuadra`

- **Cociente real:** `3655 / 3672 = 99,537 %` (`Q-35`).
- **Número mostrado:** `100 %`.
- **Mecanismo exacto:** `page.tsx:518` — `const pct = m > 0 ? Math.round((n / m) * 100) : null;`
  `Math.round(99.537) = 100`. **No es floor, no es ceil, no es un bug de formato.**
- **Es la cifra FIRMADA, no una desviación.** El dossier legal VSIM fija verbatim
  `X = round(N/M·100)` (§43) y declara la base-rate empírica observada de 19 % a 100 % (§83). El
  precedente **104-03** ya lo adjudicó: *"VSIM '(100%)' para 3655/3672 es dossier-compliant … NO se
  cambia round a floor/decimal"*.
- **La lectura deshonesta la neutraliza el caveat obligatorio adyacente**, verificado presente en los
  3 pares:

```bash
grep -c "La coincidencia alta es la norma, no una señal" /tmp/v_D1165D1170.html   # → 1
grep -c "La coincidencia alta es la norma, no una señal" /tmp/v_D1009D1012.html   # → 1
grep -c "La coincidencia alta es la norma, no una señal" /tmp/v_D1009S1110.html   # → 1
```

Cambiar `round` → `floor`/decimal desviaría de una cifra legalmente firmada sin ganancia de
honestidad (sería Rule 4: decisión legal, no de agente). **No entra a 122-05.**

**Cobertura y provenance** (pares con `M > 0`):

```
Cobertura del voto: Cámara ~80% confirmado por identificador; Senado ~20% por nombre (probable). …
Fuente: votaciones de Cámara y Senado · según fuente al 2026-07-28.
```

La fecha `2026-07-28` del DOM es exactamente el `fecha_captura_max` que emite la RPC (`Q-34`) — **es
la fecha de la FUENTE**, y el idiom es el aprobado (`según fuente al …`; "captura" pelado prohibido).
El par 4.3 cae en la rama `m === 0`, que **no renderiza la línea de cobertura**: sin figura no hay
denominador que acotar. Registrado para que no se lea como leyenda faltante.

### 3.6 Queries de §3

**`Q-27` — selección determinista del par diputado-diputado (desempate estable por `(a, b)`)**

```sql
with com as (
  select cm1.parlamentario_id a, cm2.parlamentario_id b, count(distinct cm1.comision_id) n
  from public.comision_membresia cm1
  join public.comision_membresia cm2
    on cm2.comision_id = cm1.comision_id and cm2.parlamentario_id > cm1.parlamentario_id
  group by 1, 2),
coa as (
  select a1.parlamentario_id a, a2.parlamentario_id b, count(distinct a1.boletin) n
  from public.proyecto_autor a1
  join public.proyecto_autor a2
    on a2.boletin = a1.boletin and a2.parlamentario_id > a1.parlamentario_id
  where a1.estado_vinculo = 'confirmado' and a2.estado_vinculo = 'confirmado'
  group by 1, 2)
select com.a, com.b, com.n n_comisiones, coa.n n_coproyectos,
       exists(select 1 from public.militancia_historica_compartida(com.a) m where m.id = com.b) mil_hist
from com join coa on coa.a = com.a and coa.b = com.b
join public.parlamentario pa on pa.id = com.a and pa.camara = 'diputados'
join public.parlamentario pb on pb.id = com.b and pb.camara = 'diputados'
where exists(select 1 from public.militancia_historica_compartida(com.a) m where m.id = com.b)
order by com.n desc, coa.n desc, com.a asc, com.b asc
limit 3;
-- observado 2026-07-29:
--   D1117|D1177|2|20|t     ← par elegido
--   D1082|D1150|1|34|t
--   D1062|D1177|1|22|t
```

**`Q-28` — eje 1: columnas de militancia histórica + presencia del par en AMBAS direcciones**

```sql
select coalesce((select max(total_n) from public.militancia_historica_compartida('<A>')),0),
       coalesce((select max(total_n) from public.militancia_historica_compartida('<B>')),0),
       exists(select 1 from public.militancia_historica_compartida('<A>') where id = '<B>'),
       exists(select 1 from public.militancia_historica_compartida('<B>') where id = '<A>');
-- observado 2026-07-29: D1165×S1338 → 2|2|false|false   ·   D1117×D1177 → 2|44|true|false
```

**`Q-29` — eje 2: comisiones vía RPC (intersección por identidad COMPUESTA `camara::nombre`)**

```sql
select (select count(*) from public.comisiones_de_parlamentario('<A>')) len_a,
       (select count(*) from public.comisiones_de_parlamentario('<B>')) len_b,
       (select count(distinct x.nombre)
          from public.comisiones_de_parlamentario('<A>') x
          join public.comisiones_de_parlamentario('<B>') y
            on y.camara = x.camara and y.nombre = x.nombre) compartidas;
-- observado 2026-07-29: D1165×S1338 → 2|0|0   ·   D1117×D1177 → 3|3|2
-- CAP_RPC_COMISIONES = 50 → ninguna lista roza el cap ⇒ completitud afirmable
```

**`Q-30` — eje 2: primeros principios contra `comision_membresia`**

```sql
select count(distinct cm1.comision_id)
from public.comision_membresia cm1
join public.comision_membresia cm2 on cm2.comision_id = cm1.comision_id
where cm1.parlamentario_id = '<A>' and cm2.parlamentario_id = '<B>';
-- observado 2026-07-29: D1165×S1338 → 0   ·   D1117×D1177 → 2   (== Q-29)
```

**`Q-31` — eje 3: columnas (`total_n`) + `n_proyectos` del par en ambas direcciones**

```sql
select coalesce((select max(total_n) from public.coautores_de_parlamentario('<A>')),0),
       coalesce((select max(total_n) from public.coautores_de_parlamentario('<B>')),0),
       coalesce((select n_proyectos from public.coautores_de_parlamentario('<A>') where id = '<B>'),-1),
       coalesce((select n_proyectos from public.coautores_de_parlamentario('<B>') where id = '<A>'),-1);
-- observado 2026-07-29: D1165×S1338 → 48|21|-1|-1  (-1 = el par NO está en la lista cap-eada)
--                       D1117×D1177 → 56|89|20|-1
```

**`Q-32` — eje 3: primeros principios (boletines co-firmados confirmados por AMBOS)**

```sql
select count(distinct a1.boletin)
from public.proyecto_autor a1
join public.proyecto_autor a2 on a2.boletin = a1.boletin
where a1.parlamentario_id = '<A>' and a2.parlamentario_id = '<B>'
  and a1.estado_vinculo = 'confirmado' and a2.estado_vinculo = 'confirmado';
-- observado 2026-07-29: D1165×S1338 → 0   ·   D1117×D1177 → 20   (== n_proyectos de Q-31)
```

**`Q-33` — eje 4: zona desde el MISMO roster que lee el sitio**

```sql
select id, coalesce(circunscripcion,'NULL'), coalesce(distrito,'NULL')
from public.parlamentarios_publico_v2()
where id in ('D1165','S1338','D1117','D1177') order by id;
-- observado 2026-07-29:
--   D1117|NULL|NULL   ·   D1165|NULL|NULL   ·   D1177|NULL|NULL   ·   S1338|7|NULL
```

**`Q-34` — VSIM: la MISMA RPC que lee el sitio**

```sql
select n_coinciden, m_compartidas, fecha_captura_max
from public.coincidencia_votos_par('<A>', '<B>');
-- observado 2026-07-29:
--   D1165 × D1170 → 3655|3672|2026-07-28 21:34:00.132+00
--   D1009 × D1012 →  932|2495|2026-07-28 21:34:00.132+00
--   D1009 × S1110 →    0|   0|NULL
--   D1117 × D1177 → 2774|2917|2026-07-28 21:34:00.132+00   (par bonus)
```

**`Q-35` — VSIM: primeros principios, denominador VSIM-01 explícito**

```sql
with a as (
  select v.votacion_id, min(v.seleccion) s
  from public.voto v
  where v.parlamentario_id = '<A>'
    and v.estado_vinculo = 'confirmado'
    and v.seleccion in ('si','no','abstencion')
  group by 1 having count(distinct v.seleccion) = 1),
b as (
  select v.votacion_id, min(v.seleccion) s
  from public.voto v
  where v.parlamentario_id = '<B>'
    and v.estado_vinculo = 'confirmado'
    and v.seleccion in ('si','no','abstencion')
  group by 1 having count(distinct v.seleccion) = 1)
select count(*) filter (where a.s = b.s)                                  as n_coinciden,
       count(*)                                                           as m_compartidas,
       round(100.0 * count(*) filter (where a.s = b.s) / nullif(count(*),0), 3) as pct_real
from a join b using (votacion_id);
-- observado 2026-07-29:
--   D1165 × D1170 → 3655|3672|99.537    (el deploy muestra 100 % = round)
--   D1009 × D1012 →  932|2495|37.355    (el deploy muestra  37 %)
--   D1009 × S1110 → (0 filas del join)  ⇒ N = M = 0, empty-state honesto
--   D1117 × D1177 → 2774|2917|95.098    (el deploy muestra  95 %)
```

### 3.7 Greps de lectura del deploy (`nº deploy`) de §2 y §3

**`Q-36` — ausencia del bloque de zona en `D1165`**

```bash
grep -c "De la misma zona" /tmp/d1165.html                              # → 0
grep -c "zona electoral (distrito o circunscripción)" /tmp/d1165.html   # → 0
grep -c 'id="relaciones"' /tmp/d1165.html                               # → 1  (la sección SÍ existe)
```

**`Q-37` — ausencia del bloque de co-comisión en `S1338`**

```bash
grep -c "En la misma comisión" /tmp/s1338.html            # → 0
grep -c "comparten al menos una comisión" /tmp/s1338.html # → 0
grep -c 'id="relaciones"' /tmp/s1338.html                 # → 1
```

**`Q-38` — conteos de los bloques de relaciones (patrón tolerante a `<!-- -->`)**

```bash
grep -o -E '.{60}comparten el partido de la militancia vigente' /tmp/d1165.html
grep -o -E '.{60}comparten al menos una comisión'               /tmp/d1165.html
grep -o -E '.{60}han co-firmado al menos un proyecto'           /tmp/d1165.html
grep -o -E '.{80}militaron en un mismo partido'                 /tmp/d1165.html
grep -o -E 'Mostrando los primeros[^\\]{0,40}'                  /tmp/d1165.html | sort -u
```

**`Q-39` — chips y conteos de carril**

```bash
grep -o -E '(Votaciones|Reuniones de lobby|Declaraciones de patrimonio|Lobby por sector|Financiamiento y contratos)</span><span class="ml-auto[^>]*>[^<]{0,20}' /tmp/d1165.html
grep -o -E 'Votaciones</h2><span[^>]*>[^<]{0,20}' /tmp/d1165.html
# → Votaciones</h2><span class="text-sm text-muted-foreground">1000
grep -o -E 'Ver detalle \([0-9]+\)'               /tmp/d1165.html
# → Ver detalle (1000)  |  Ver detalle (112)  |  Ver detalle (6)
grep -o -E 'Presente en.{0,140}'                  /tmp/d1165.html | grep -v '\\\\'
# → Presente en<!-- --> <span class="font-mono">973<!-- --> de <!-- -->1000</span> <!-- -->votaciones · Ausente en <span class="font-mono">27</span>.
grep -o -E 'A favor [0-9]+ · En contra [0-9]+ · [^<]{0,80}' /tmp/d1165.html | tail -1
grep -o -E '[0-9.,]+%?</span><span class="text-xs text-muted-foreground">asistencia' /tmp/d1165.html
```

**`Q-40` — ejes de `/comparar`**

```bash
grep -o -E '.{60}militaron en un mismo partido que.{0,40}' /tmp/cmp_DD.html | grep -v '\\"'
grep -o -E '.{50}co-autores registrados.{0,10}'            /tmp/cmp_DD.html | grep -v '\\"'
grep -o -E '.{80}proyectos co-firmados.{0,10}'             /tmp/cmp_DD.html | grep -v '\\"'
grep -o -E 'Comparten <!-- -->[0-9]+</span>'               /tmp/cmp_DD.html | sort -u
grep -c  "Lista posiblemente truncada"                     /tmp/cmp_DD.html   # → 0
```

**`Q-41` — literal VSIM (tolerante a los separadores de React)**

```bash
grep -o -E 'class="mt-4 text-sm">Coinciden en.{0,120}' /tmp/v_D1165D1170.html
grep -o -E 'Sin votaciones compartidas suficientes en las fuentes consultadas al[^<]{0,20}' /tmp/v_D1009S1110.html
grep -c  "La coincidencia alta es la norma, no una señal"  /tmp/v_D1165D1170.html   # → 1
grep -o -E 'Fuente: votaciones de Cámara y Senado.{0,120}' /tmp/v_D1165D1170.html | grep -v '\\"'
```

---

## 4. Cruces de ficha y de proyecto

**Emisores auditados** (trazados al catálogo 113 §3.0):

| id | archivo | superficie | origen |
|----|---------|------------|--------|
| **E-044** | `app/components/cruces-de-proyecto.tsx` | `/proyecto/[boletin]` | `RPC:cruces_de_proyecto` |
| **E-053** | `app/components/cruces-de-parlamentario.tsx` | `/parlamentario/[id]` (detalle) | `RPC:cruces_de_parlamentario` |
| *(sin id — capa-1)* | `app/components/capa1/cruces-capa1.tsx` | `/parlamentario/[id]` (capa-1) | `RPC:cruces_de_parlamentario` vía `app/lib/parlamentario-resumen-conteos.ts` |

**Orden de trabajo (honestidad de método):** cada número de la columna `nº SQL` se **ejecutó
primero** y se transcribió después; ninguna tabla se redactó con cifras esperadas para "confirmarlas"
luego. Ídem `nº deploy` (`curl` → `grep` → transcripción).

### 4.0 Hallazgo de emisor — la capa-1 de cruces NO es E-053

**Descubierto al leer el DOM, no asumido.** El inventario asigna la sección `#cruces` de la ficha
a **E-053**. El DOM demuestra que la ficha tiene **dos** emisores en esa sección, y que el que rinde
el **conteo visible y el estado vacío** es otro archivo:

- `app/app/parlamentario/[id]/page.tsx:676-696` envuelve todo `#cruces` en `crucesPublicEnabled()` y
  renderiza **`CrucesCapa1`** (`app/components/capa1/cruces-capa1.tsx`) con
  `conteos.crucesSectores` + `conteoLabel(conteos.cruces)` — conteos de
  `app/lib/parlamentario-resumen-conteos.ts:366-391`.
- **E-053 (`CrucesSection`) solo se monta si `conteos.cruces.tipo === "dato"`** (`page.tsx:682-694`).
  Con 0 señales **E-053 no se monta**: su empty-state interno (`cruces-de-parlamentario.tsx:128-139`)
  es **código inalcanzable en producción** para el caso vacío.

Consecuencia: el **cero-como-cero** de `S1338` lo emite la **capa-1**, no E-053. Se audita el DOM
real, no el componente que el inventario nombraba.

### 4.1 ¿Es `cruces_de_proyecto` bounded? — **NO** (verificado contra la DB viva)

El plan-checker sospechaba un **cap** en `cruces-de-proyecto.tsx:199` (`const n = rows.length`), por
precedente confirmado en WR-03 (§2.4.2). **La sospecha se descarta con evidencia**: no se leyó sólo
la migración en disco (que podría estar redefinida por otra posterior), se interrogó **el catálogo de
la DB de PROD** (`Q-42`).

| RPC | ¿bounded en PROD? | ¿el componente muestra `.length`? | ¿el `.length` es honesto? |
|-----|-------------------|-----------------------------------|---------------------------|
| `cruces_de_proyecto` | **NO** (sin `LIMIT`) | **sí** — `cruces-de-proyecto.tsx:199` | **sí**: sin cap, `rows.length` **es** el total |
| `cruces_de_parlamentario` | **NO** (sin `LIMIT`) | **sí** — `parlamentario-resumen-conteos.ts:387` | **sí**: sin cap, `.length` **es** el total |
| `actualidad_senales_panel` | **SÍ** (`limit 200`, 0066:52) | no emite conteo de filas | n/a — ver §5.0 |
| `votos_de_parlamentario` | **SÍ** (`p_limit`) | sí (`.length` con `p_limit: 1000`) | **no** — WR-03 (§2.4.2) |

Consistente con las definiciones en disco: `0049_cruces_de_proyecto.sql:104-108` cierra con
`order by p.nombre_normalizado asc;` **sin LIMIT** (orden alfabético neutro, anti-ranking), y
`0041_cruces_rpc_fecha_captura.sql:43` con `order by cs.conteo desc, cs.sector_id asc;` sin LIMIT.
Ninguna migración posterior las redefine.

**Veredicto sobre el cap sospechado: no existe.** Se registra igual (regla dura §0.1).

### 4.2 Cruces de proyecto — tabla de veredicto (Grupo 3.a)

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| 3.a-1 | `/proyecto/14309-04` | `app/components/cruces-de-proyecto.tsx:199,205` (E-044) | `RPC:cruces_de_proyecto` | `Q-43` | `47` | `47` (`47 parlamentarios`) | `cuadra` |
| 3.a-2 | `/proyecto/14309-04` | `app/components/cruces-de-proyecto.tsx:263` (E-044) | `RPC:cruces_de_proyecto` | `Q-43` | `47` | `47` (`Explorar los 47 cruces`) | `cuadra` |
| 3.a-3 | *(no-superficie)* RPC vs primeros principios, `14309-04` | `supabase/migrations/0049_cruces_de_proyecto.sql:69-108` | `RPC:cruces_de_proyecto` vs `cruce_senal` | `Q-43` vs `Q-44` | `47` vs `47` | n/a (control interno) | `cuadra` |
| 3.a-4 | `/proyecto/18296-05` | `app/components/cruces-de-proyecto.tsx:199,205,263` (E-044) | `RPC:cruces_de_proyecto` | `Q-47` | `30` | `30` (`30 parlamentarios` / `Explorar los 30 cruces`) | `cuadra` |
| 3.a-5 | *(no-superficie)* RPC vs primeros principios, `18296-05` | `supabase/migrations/0049_cruces_de_proyecto.sql:69-108` | `RPC:cruces_de_proyecto` vs `cruce_senal` | `Q-47` | `30` vs `30` | n/a (control interno) | `cuadra` |
| 3.a-6 | *(no-superficie)* cap sospechado en `rows.length` | `app/components/cruces-de-proyecto.tsx:199` (E-044) | `pg_proc.pg_get_functiondef` | `Q-42` | `tiene_limit = f` (sin LIMIT) | máximo de PROD = `47`, sin techo alcanzable | `cuadra` |

**Selección del sujeto de contraste (`Q-46`):** el **máximo de PROD ES el sujeto A** (`14309-04`, 47)
— el sujeto determinista del inventario 113 ya era el techo del universo. El segundo caso >0 es el
runner-up **`18296-05`** (30). Ambos **muy por debajo** de cualquier límite.

### 4.3 Cruces de parlamentario — tabla de veredicto (Grupo 3.b)

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| 3.b-1 | `/parlamentario/D1165` | `app/components/capa1/cruces-capa1.tsx:50-57` ← `app/lib/parlamentario-resumen-conteos.ts:387` | `RPC:cruces_de_parlamentario` | `Q-49` | `11` | `11` | `cuadra` |
| 3.b-2 | `/parlamentario/D1165` | `app/app/parlamentario/[id]/page.tsx:687` | `RPC:cruces_de_parlamentario` | `Q-49` | `11` | `11` (`Ver las 11 señales de lobby por sector`) | `cuadra` |
| 3.b-3 | `/parlamentario/D1165` | `app/components/cruces-de-parlamentario.tsx:149` (E-053, encabezados de señal) | `RPC:cruces_de_parlamentario` | `Q-49` | `11` señales | `11` encabezados | `cuadra` |
| 3.b-4 | `/parlamentario/D1165` | `app/components/capa1/cruces-capa1.tsx:20-37` (chips por sector) ← `agruparSectores` `:148-164` | `cruce_senal.conteo` agrupado por `sector.etiqueta` | `Q-51` | 11 sectores; `32,16,12,6,6,5,5,3,3,1,1` (suma **90**) | 11 chips; `32,16,12,6,6,5,5,3,3,1,1` (suma **90**) | `cuadra` |
| 3.b-5 | `/parlamentario/D1165` | `app/components/capa1/cruces-capa1.tsx:28-34` (dimensión `nVotos`) | `cruce_senal.tipo_senal like 'voto%'` | `Q-52` | `0` | `0` chips con `votos` | `cuadra` |
| 3.b-6 | *(no-superficie)* RPC vs primeros principios, `D1165` | `supabase/migrations/0041_cruces_rpc_fecha_captura.sql:32-44` | `RPC:cruces_de_parlamentario` vs `cruce_senal` | `Q-49` vs `Q-50` | `11` vs `11` | n/a (control interno) | `cuadra` |
| 3.b-7 | `/parlamentario/S1338` | `app/components/capa1/cruces-capa1.tsx:50-57,73-77` | `RPC:cruces_de_parlamentario` | `Q-54` | `0` | `sin registros` + *"Aún no se registran reuniones de lobby en las fuentes consultadas."* (cero declarado, sección presente) | `cuadra` |
| 3.b-8 | *(no-superficie)* RPC vs primeros principios, `S1338` | `supabase/migrations/0041_cruces_rpc_fecha_captura.sql:32-44` | `RPC:cruces_de_parlamentario` vs `cruce_senal` | `Q-54` | `0` vs `0` | n/a (control interno) | `cuadra` |
| 3.b-9 | `/parlamentario/S1338` | `app/components/cruces-de-parlamentario.tsx:128-139` (E-053, empty-state) | `RPC:cruces_de_parlamentario` | `Q-54` | `0` | **no emitido en el deploy** — E-053 solo se monta con `conteos.cruces.tipo === "dato"` (`page.tsx:682`) ⇒ su empty-state es inalcanzable | `discrepancia-declarada` |

**Sobre 3.b-9:** es **código muerto, no un dato erróneo**. El cero-como-cero **sí** se presenta (fila
3.b-7, capa-1). Se **declara** para que el catálogo 113 corrija la atribución de emisor. **No es
urgente ni user-facing.** Handoff: **catálogo 113**, sin acción de código.

**El cero-como-cero de `S1338`, verbatim del DOM** (`Q-55`):

```html
<section id="cruces" class="mt-12"><div class="rounded-lg border-[1.5px] border-accent-product bg-card p-4 space-y-3"><h2 class="flex items-center gap-2 text-lg font-semibold text-accent-product"><span>¿Con qué sectores tuvo reuniones de lobby?</span><span class="ml-auto text-sm font-normal text-muted-foreground">sin registros</span></h2><p class="text-xs text-muted-foreground">Sectores de las contrapartes registradas bajo la Ley del Lobby (Ley 20.730). El número indica cuántas reuniones aparecen en el registro oficial; solo muestra hechos públicos, no establece relación entre una reunión y ninguna otra actuación del parlamentario.</p><p class="text-sm text-muted-foreground">Aún no se registran reuniones de lobby en las fuentes consultadas.</p></div></section>
```

| estado | cómo se vería | ¿es lo observado? |
|--------|---------------|-------------------|
| `dato` | `11` + chips + detalle | no |
| **`vacio`** | **`sin registros`** + *"Aún no se registran reuniones de lobby en las fuentes consultadas."* | **SÍ — es lo observado** |
| `no_ingerido` | `—` / *"pendiente"* | no |
| *(ausencia de sección)* | sin `id="cruces"` en el HTML | no — la sección **está presente** |

⇒ **el cero se presenta como cero**: la superficie no se oculta, no se rellena, y no se declara
falsamente "no ingerido". Cumple LÍMITE C.

### 4.4 Queries de §4

**`Q-42` — ¿las RPC VIVAS de PROD llevan LIMIT? (+ su proconfig)**

```sql
select p.proname,
       coalesce(array_to_string(p.proconfig, ','), '(sin proconfig)') cfg,
       (pg_get_functiondef(p.oid) ilike '%limit%') tiene_limit
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('cruces_de_proyecto','cruces_de_parlamentario',
                    'actualidad_senales_panel','votos_de_parlamentario');
-- observado 2026-07-29:
--   actualidad_senales_panel | search_path="",statement_timeout=5s | t
--   cruces_de_parlamentario  | search_path=""                     | f
--   cruces_de_proyecto       | search_path=""                     | f
--   votos_de_parlamentario   | (sin proconfig)                    | t
```

**`Q-43` — cruces de proyecto: la MISMA RPC que invoca el sitio**

```sql
select count(*) from cruces_de_proyecto('14309-04');
-- observado 2026-07-29: 47
```

**`Q-44` — cruces de proyecto: primeros principios (cuerpo de 0049 verbatim)**

```sql
with sec as (
  select sector_id from public.proyecto_ficha
   where boletin = '14309-04' and sector_id is not null
),
afavor as (
  select distinct v.parlamentario_id
    from public.voto v
    join public.votacion vo on vo.id = v.votacion_id
   where vo.boletin = '14309-04'
     and v.seleccion = 'si'
     and v.estado_vinculo = 'confirmado'
     and v.parlamentario_id is not null
)
select count(*)
  from public.cruce_senal cs
  join sec    on cs.sector_id       = sec.sector_id
  join afavor a on a.parlamentario_id = cs.parlamentario_id
  join public.sector s        on s.codigo = cs.sector_id
  join public.parlamentario p on p.id     = cs.parlamentario_id;
-- observado 2026-07-29: 47
```

**`Q-45` — el nº que muestra el deploy (tolerante a `<!-- -->`)**

```bash
curl -s https://observatorio-congreso.thevalis.workers.dev/proyecto/14309-04 -o /tmp/p14309.html
grep -o -E 'tabular-nums text-muted-foreground">[0-9]+ parlamentario' /tmp/p14309.html
# → tabular-nums text-muted-foreground">47 parlamentario
grep -o -E 'Explorar los [0-9]+ cruces' /tmp/p14309.html
# → Explorar los 47 cruces
```

**`Q-46` — selección del boletín de mayor conteo (el que reventaría el cap si lo hubiera)**

```sql
select p.boletin, (select count(*) from cruces_de_proyecto(p.boletin)) n
  from public.proyecto p
 order by (select count(*) from cruces_de_proyecto(p.boletin)) desc, p.boletin asc
 limit 5;
-- observado 2026-07-29:
--   14309-04|47
--   18296-05|30
--   10986-24|0
--   11929-13|0
--   12712-24|0
```

**`Q-47` — doble lectura de `18296-05` — (a) RPC y (b) primeros principios**

```sql
select count(*) from cruces_de_proyecto('18296-05');
-- observado 2026-07-29: 30

with sec as (
  select sector_id from public.proyecto_ficha
   where boletin = '18296-05' and sector_id is not null
),
afavor as (
  select distinct v.parlamentario_id
    from public.voto v
    join public.votacion vo on vo.id = v.votacion_id
   where vo.boletin = '18296-05'
     and v.seleccion = 'si'
     and v.estado_vinculo = 'confirmado'
     and v.parlamentario_id is not null
)
select count(*)
  from public.cruce_senal cs
  join sec    on cs.sector_id       = sec.sector_id
  join afavor a on a.parlamentario_id = cs.parlamentario_id
  join public.sector s        on s.codigo = cs.sector_id
  join public.parlamentario p on p.id     = cs.parlamentario_id;
-- observado 2026-07-29: 30
```

**`Q-48` — el DOM de `18296-05`**

```bash
curl -s https://observatorio-congreso.thevalis.workers.dev/proyecto/18296-05 -o /tmp/p18296.html
grep -o -E 'tabular-nums text-muted-foreground">[0-9]+ parlamentario' /tmp/p18296.html
# → tabular-nums text-muted-foreground">30 parlamentario
grep -o -E 'Explorar los [0-9]+ cruces' /tmp/p18296.html
# → Explorar los 30 cruces
```

**`Q-49` — cruces de parlamentario: la MISMA RPC que invoca el sitio**

```sql
select count(*) from cruces_de_parlamentario('D1165');
-- observado 2026-07-29: 11
```

**`Q-50` — cruces de parlamentario: primeros principios (cuerpo de 0041 verbatim)**

```sql
select count(*)
  from public.cruce_senal cs
  join public.sector s on s.codigo = cs.sector_id
 where cs.parlamentario_id = 'D1165';
-- observado 2026-07-29: 11

-- control adicional: sin el join al catálogo (¿pierde el join alguna señal?)
select count(*) from public.cruce_senal where parlamentario_id = 'D1165';
-- observado 2026-07-29: 11   ⇒ el join a `sector` NO descarta ninguna señal
```

**`Q-51` — agregación por sector (contraste contra `agruparSectores`, `:148-164`)**

```sql
select s.etiqueta, sum(cs.conteo) n_reuniones
  from public.cruce_senal cs
  join public.sector s on s.codigo = cs.sector_id
 where cs.parlamentario_id = 'D1165'
   and cs.tipo_senal = 'lobby_sector'
 group by s.etiqueta
 order by n_reuniones desc, s.etiqueta asc;
-- observado 2026-07-29:
--   Salud y farmacéutica|32
--   Comercio, industria y retail|16
--   Gremios, sindicatos y asociaciones|12
--   Educación|6
--   Trabajo y previsión social|6
--   Banca, finanzas y seguros|5
--   Seguridad, justicia y defensa|5
--   Transporte y telecomunicaciones|3
--   Vivienda, urbanismo y obras públicas|3
--   Medio ambiente y recursos hídricos|1
--   Minería y energía|1
--   (11 filas; suma = 90)
```

**`Q-52` — ¿existe HOY alguna señal de tipo voto?**

```sql
select count(*) from public.cruce_senal
 where parlamentario_id = 'D1165' and tipo_senal like 'voto%';
-- observado 2026-07-29: 0

select distinct tipo_senal from public.cruce_senal order by 1;
-- observado 2026-07-29: lobby_sector      (ÚNICO tipo materializado en toda la tabla)
```

**`Q-53` — el DOM de la ficha `D1165`: capa-1, chip del resumen y detalle E-053**

```bash
curl -s https://observatorio-congreso.thevalis.workers.dev/parlamentario/D1165 -o /tmp/D1165.html

# c.1 — conteo junto al h2 de capa-1
grep -o -E '¿Con qué sectores tuvo reuniones de lobby\?</span><span class="ml-auto text-sm font-normal text-muted-foreground">[^<]*' /tmp/D1165.html
# → …text-muted-foreground">11

# c.2 — chips por sector de capa-1 (11 chips)
grep -o -E '<li class="inline-block rounded-full border border-border bg-card px-3 py-1 text-sm">.{0,220}?</li>' /tmp/D1165.html | sed -E 's/<[^>]*>//g'
# → Salud y farmacéutica · 32 reuniones … Minería y energía · 1 reunión   (11 chips; suma = 90)

# c.3 — trigger del DetalleColapsable
grep -o -E 'Ver las [0-9]+ señales de lobby por sector' /tmp/D1165.html
# → Ver las 11 señales de lobby por sector

# c.4 — encabezados de señal emitidos por E-053 (TOLERANTE a singular/plural:
#        el grep de "reuniones" pelado PIERDE las 2 señales de conteo 1)
grep -o -E '[0-9]+ reuni[^ ]* con gestores del sector [^<\\"]{0,45}' /tmp/D1165.html | sed 's/[<\\].*//' | sort -u | wc -l
# → 11

# c.5 — ¿el DOM pinta una dimensión de VOTOS en los chips? (debe ser 0)
grep -c 'tabular-nums">[0-9]*</span> votos' /tmp/D1165.html
# → 0
```

**`Q-54` — cruces de `S1338`: (a) RPC y (b) primeros principios**

```sql
select count(*) from cruces_de_parlamentario('S1338');
-- observado 2026-07-29: 0

select count(*) from public.cruce_senal cs
  join public.sector s on s.codigo = cs.sector_id
 where cs.parlamentario_id = 'S1338';
-- observado 2026-07-29: 0
```

**`Q-55` — el DOM de `S1338`: ¿el cero se presenta COMO cero?**

```bash
curl -s https://observatorio-congreso.thevalis.workers.dev/parlamentario/S1338 -o /tmp/S1338.html
grep -o -E 'id="cruces"' /tmp/S1338.html | sort -u        # → id="cruces"   (la sección EXISTE)
grep -o -E 'id="cruces" class="mt-12".{0,900}' /tmp/S1338.html
```

---

## 5. Panel de actualidad

Emisor **E-055** `app/components/panel-actualidad.tsx` sobre `RPC:actualidad_senales_panel`
(migraciones **0065/0066**), superficie `/`. **E-008 `actualidad-module.tsx` NO se audita** (emisor
huérfano, §0.4).

**Patrón de extracción del DOM re-confirmado en la landing:**

```html
<span class="font-mono">452</span> <!-- -->proyectos
```

⇒ todos los `grep` de §5 son **tolerantes al separador** (patrón sobre la clase/el tag, nunca sobre
el literal armado).

### 5.0 Universo real de `tipo_senal` (derivado de la base, no asumido)

El plan hablaba de "6 señales"; §0.3 advertía que **el denominador lo cierra la base**. Se cerró con
`Q-56`: hay **7 `tipo_senal`** — los **6 temporales** que materializa
`actualidad.materializar_senales()` (0065) **más** `agrupacion_materia`, que el proc **NO** toca (su
`delete` está acotado a los 6 temporales, 0065:111-113) y que **posee el CLI k-means**. El allow-list
del `check` de 0065:52-54 declara exactamente esos 7. Los 7 tipos producen **19 filas** (una por
corte de cámara / cluster).

**19 filas de 19 en la tabla, contra un `limit 200` (0066:52)** ⇒ el bound **no está activo**; el
panel muestra el universo completo (fila 4-0).

### 5.1 Tabla de veredicto (Grupo 4)

`nº SQL` = **(a) RPC** / **(b) primeros principios**. Si (a) y (b) coinciden, se escribe una sola vez.

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| 4-0 | `/` | `app/components/panel-actualidad.tsx:274-286` (E-055) | `RPC:actualidad_senales_panel` (`limit 200`) | `Q-56`, `Q-57` | `19` filas / `7` tipos | `7` tiles, `18` filas activas + `1` supresión = `19` | `cuadra` |
| 4-1 | `/` tile *Movimiento reciente* | `panel-actualidad.tsx:230-231` (E-055) | `actualidad_senal.conteo` (`velocity`, `(sin cámara)`) | `Q-57` / `Q-59` | `1` / `1` | `1` | `cuadra` |
| 4-2 | `/` tile *Movimiento reciente* | `panel-actualidad.tsx:230-231` (E-055) | `actualidad_senal.conteo` (`velocity`, `C.Diputados`) | `Q-57` / `Q-59` | `37` / `37` | `37` | `cuadra` |
| 4-3 | `/` tile *Movimiento reciente* | `panel-actualidad.tsx:230-231` (E-055) | `actualidad_senal.conteo` (`velocity`, `Senado`) | `Q-57` / `Q-59` | `44` / `44` | `44` | `cuadra` |
| 4-4 | `/` tile *Urgencias del Ejecutivo* | `panel-actualidad.tsx:230-231` (E-055) | `actualidad_senal.conteo` (`urgencias`, `30d`) | `Q-57` / `Q-61` | `95` / `95` | `95` | `cuadra` |
| 4-5 | `/` tile *Citaciones próximas* | `panel-actualidad.tsx:230-231` (E-055) | `actualidad_senal.conteo` (`agenda_citacion`, `senado`) | `Q-57` / `Q-63` | `23` / `23` | `23` | `cuadra` |
| 4-6 | `/` tile *Sesiones de sala* | `panel-actualidad.tsx:230-231` (E-055) | `actualidad_senal.conteo` (`agenda_sala`, `camara`) | `Q-57` / `Q-64` | `1` / `1` | `1` | `cuadra` |
| 4-7 | `/` tile *Sesiones de sala* | `panel-actualidad.tsx:230-231` (E-055) | `actualidad_senal.conteo` (`agenda_sala`, `senado`) | `Q-57` / `Q-64` | `2` / `2` | `2` | `cuadra` |
| 4-8 | `/` tile *Nuevos ingresos* | `panel-actualidad.tsx:183-200` (E-055, rama supresión) | `actualidad_senal.supresion_causa` | `Q-57` / `Q-60` | `0` / `0` | `sin nuevos ingresos fechados en la ventana — en las fuentes consultadas al 28 jul 2026` (**supresión-como-fila**, tile presente) | `cuadra` |
| 4-9 | `/` tile *Archivos y retiros* | `panel-actualidad.tsx:230-231` (E-055) | `actualidad_senal.conteo` (`archivados`, `30d`) | `Q-57` / `Q-62` | `2` / `2` | `2` | `cuadra` |
| 4-10 | `/` tile *Por materia* | `panel-actualidad.tsx:225-231` (E-055) | `actualidad_senal.conteo` (`agrupacion_materia`, clusters 0-9) | `Q-57` / `Q-65` | 10 clusters: `452,615,95,363,192,62,421,335,272,293` (suma **3100**) | 10 clusters: mismos valores (`421` vía streaming Suspense, `<div hidden id="S:1">`) | `cuadra` |
| 4-11 | `/` tile *Por materia* | `panel-actualidad.tsx:209-210,225-229` (E-055) | `actualidad_senal.materia` | `Q-57` | `(sin materia)` ×10 | `(sin materia)` ×10, verbatim | `cuadra` |
| 4-12 | `/` chips de cobertura | `panel-actualidad.tsx:237-241` (E-055) | `actualidad_senal.cobertura_camara` | `Q-57` | `(sin cámara)`, `C.Diputados`, `Senado`, `senado`, `camara`, `senado`, `2022-2026 (piso de corpus)` | idénticos; **cero literal de ranking** (`grep` de denylist → vacío) | `cuadra` |
| 4-13 | `/` — rezago del materializado | `supabase/migrations/0065_actualidad_senal.sql:88-309` | `actualidad_senal.fecha_captura` | `Q-58` | rebuild `2026-07-29 11:07:00.015941+00` (6 tipos temporales, al µs) + `13:05:51.779+00` (`agrupacion_materia`, CLI) | n/a — el DOM no expone `fecha_captura` | `cuadra` |
| 4-14 | `/` — denominador del tile *Por materia* | `panel-actualidad.tsx:67` (`FRAMING.agrupacion_materia = "proyectos"`) | `proyecto_embedding` vs `proyecto` | `Q-65` | `3100` clusterizados de `3675` proyectos (84,4 %) | `452 proyectos`… sin declarar que la base es el corpus **embebido**, no todos los proyectos | `discrepancia-declarada` |
| 4-15 | `/` — dos grafías de cámara en el mismo panel | `panel-actualidad.tsx:237-241` (E-055) ← `0065:233,261` (`citacion.camara` / `sesion_sala.camara` CRUDAS) | `actualidad_senal.cobertura_camara` | `Q-57`, `Q-63`, `Q-64` | `senado`/`camara` (agenda, crudas) vs `Senado`/`C.Diputados` (velocity, normalizadas por D2) | los 6 chips conviven en la misma landing: `C.Diputados`, `Senado`, `(sin cámara)`, `senado`, `camara` | `discrepancia-declarada` |

**Sobre 4-13 — no hay rezago material.** La regla del plan (*"si (a)==(c) pero (b)≠(a) ⇒
`discrepancia-declarada` por rezago"*) **no se gatilla**: las **7 comparaciones (a) vs (b) coinciden
exactamente**. El materializado se reconstruyó hoy a las 11:07 UTC (≈2 h antes de la corrida) y sigue
siendo fiel a `tramitacion_evento` / `citacion` / `sesion_sala`. **No se invocó
`actualidad.materializar_senales()` ni se escribió una sola fila.**

**Sobre 4-14 — por qué `discrepancia-declarada` y no `-corregida`.** Los **números cuadran**
(SQL = deploy); lo que falta es una **declaración de cobertura** ("3.100 de 3.675 proyectos con texto
procesado"). Exige una cifra que hoy **ninguna columna del contrato de la RPC emite** ⇒ **SQL**, no
sólo copy. Handoff: **Phase 124** (denominador en la RPC) → copy en **125**.

**Sobre 4-15 — por qué `discrepancia-declarada` y no `-corregida`.** El defecto **D2** de 0065
(normalizar `camara` con `regexp_replace`) se aplica a `velocity`, pero para `agenda_citacion` /
`agenda_sala` la fuente entrega ya `senado`/`camara` en minúscula y el `regexp_replace` **no
mayusculiza**: el ciudadano ve `Senado` y `senado` como chips distintos en la misma pantalla. El fix
correcto es **normalizar en el materializador (SQL)**, no maquillar en el cliente. **No afecta ningún
conteo.** Handoff: **Phase 124** (corrección en 0065).

### 5.2 Queries de §5

**`Q-56` — universo observado de tipos de señal**

```sql
select tipo_senal, count(*), max(fecha_max) from actualidad_senal group by 1 order by 1;
-- observado 2026-07-29:
--   agenda_citacion   |1 |2026-08-10 00:00:00+00
--   agenda_sala       |2 |2026-08-05 00:00:00+00
--   agrupacion_materia|10|            (fecha_max NULL en las 10)
--   archivados        |1 |2026-07-06 00:00:00+00
--   nuevos_ingresos   |1 |2026-07-28 00:00:00+00
--   urgencias         |1 |2026-07-22 00:00:00+00
--   velocity          |3 |2026-07-28 00:00:00+00

select count(*) from actualidad_senal;
-- observado 2026-07-29: 19
```

**`Q-57` — la MISMA RPC que invoca el sitio, completa**

```sql
select tipo_senal, ventana, conteo, cobertura_camara, materia, cluster_id, fecha_max, supresion_causa
  from actualidad_senales_panel(null)
 order by tipo_senal, cobertura_camara nulls last, cluster_id nulls last;
-- observado 2026-07-29 (19 filas):
--   agenda_citacion   |futuras|23 |senado                     |             |  |2026-08-10 00:00:00+00|
--   agenda_sala       |futuras|1  |camara                     |             |  |2026-08-03 00:00:00+00|
--   agenda_sala       |futuras|2  |senado                     |             |  |2026-08-05 00:00:00+00|
--   agrupacion_materia|       |452|                           |(sin materia)|0 |                      |
--   agrupacion_materia|       |615|                           |(sin materia)|1 |                      |
--   agrupacion_materia|       |95 |                           |(sin materia)|2 |                      |
--   agrupacion_materia|       |363|                           |(sin materia)|3 |                      |
--   agrupacion_materia|       |192|                           |(sin materia)|4 |                      |
--   agrupacion_materia|       |62 |                           |(sin materia)|5 |                      |
--   agrupacion_materia|       |421|                           |(sin materia)|6 |                      |
--   agrupacion_materia|       |335|                           |(sin materia)|7 |                      |
--   agrupacion_materia|       |272|                           |(sin materia)|8 |                      |
--   agrupacion_materia|       |293|                           |(sin materia)|9 |                      |
--   archivados        |30d    |2  |                           |             |  |2026-07-06 00:00:00+00|
--   nuevos_ingresos   |7d     |0  |2022-2026 (piso de corpus) |             |  |2026-07-28 00:00:00+00|sin nuevos ingresos fechados en la ventana
--   urgencias         |30d    |95 |                           |             |  |2026-07-22 00:00:00+00|
--   velocity          |7d     |1  |(sin cámara)               |             |  |2026-07-22 00:00:00+00|
--   velocity          |7d     |37 |C.Diputados                |             |  |2026-07-24 00:00:00+00|
--   velocity          |7d     |44 |Senado                     |             |  |2026-07-28 00:00:00+00|
```

**`Q-58` — ¿cuándo se materializó cada tipo?**

```sql
select tipo_senal, min(fecha_captura), max(fecha_captura)
  from actualidad_senal group by 1 order by 1;
-- observado 2026-07-29:
--   agenda_citacion   |2026-07-29 11:07:00.015941+00|2026-07-29 11:07:00.015941+00
--   agenda_sala       |2026-07-29 11:07:00.015941+00|2026-07-29 11:07:00.015941+00
--   agrupacion_materia|2026-07-29 13:05:51.779+00   |2026-07-29 13:05:51.779+00
--   archivados        |2026-07-29 11:07:00.015941+00|2026-07-29 11:07:00.015941+00
--   nuevos_ingresos   |2026-07-29 11:07:00.015941+00|2026-07-29 11:07:00.015941+00
--   urgencias         |2026-07-29 11:07:00.015941+00|2026-07-29 11:07:00.015941+00
--   velocity          |2026-07-29 11:07:00.015941+00|2026-07-29 11:07:00.015941+00
```

**`Q-59` — PP `velocity` (0065:127-135)**

```sql
-- NOTA DE SHELL: el literal '(sin cámara)' con tilde revienta el encoding de -c en
-- Git Bash/Windows (ERROR: invalid byte sequence for encoding "UTF8": 0xe1 0x6d 0x61).
-- Se sustituye el literal por 'SIN-CAMARA' — cambia SOLO la etiqueta del grupo NULL,
-- jamás el conteo ni el agrupamiento.
select coalesce(nullif(regexp_replace(camara, '\s+', '', 'g'), ''), 'SIN-CAMARA') cam,
       count(*) n, max(fecha)
  from public.tramitacion_evento
 where fecha <= current_date
   and fecha >= current_date - interval '7 days'
 group by 1 order by 1;
-- observado 2026-07-29:
--   C.Diputados|37|2026-07-24 00:00:00+00
--   Senado     |44|2026-07-28 00:00:00+00
--   SIN-CAMARA |1 |2026-07-22 00:00:00+00
```

**`Q-60` — PP `nuevos_ingresos` (0065:159-169; ventana REAL 7d, '2022-2026' es piso de corpus)**

```sql
select count(*) from (
  select boletin, min(fecha) primer
    from public.tramitacion_evento
   where fecha <= current_date
   group by boletin
  having min(fecha) >= date '2022-01-01'
     and min(fecha) >= current_date - interval '7 days'
) pe;
-- observado 2026-07-29: 0
```

⇒ **0 ingresos en la ventana con la fuente FRESCA** ⇒ el proc toma la rama `if not found`
(0065:170-177) y emite **supresión-como-fila** con causa `'sin nuevos ingresos fechados en la
ventana'`. **Cero honesto, no 0-como-hecho.**

**`Q-61` — PP `urgencias` (0065:196-203)**

```sql
select count(*), max(fecha) from public.tramitacion_evento
 where tipo = 'urgencia'
   and fecha <= current_date
   and fecha >= current_date - interval '30 days';
-- observado 2026-07-29: 95|2026-07-22 00:00:00+00
```

**`Q-62` — PP `archivados` (0065:286-295)**

```sql
select count(*), max(fecha) from public.tramitacion_evento
 where fecha <= current_date
   and fecha >= current_date - interval '30 days'
   and (descripcion ilike '%archiv%' or descripcion ilike '%retira%')
   and descripcion not ilike '%desarchiv%'
   and descripcion not ilike '%retira y hace presente%';
-- observado 2026-07-29: 2|2026-07-06 00:00:00+00
```

**`Q-63` — PP `agenda_citacion` (0065:232-237; date-only medianoche UTC = día chileno, SIN tz)**

```sql
select coalesce(nullif(regexp_replace(camara, '\s+', '', 'g'), ''), 'SIN-CAMARA') cam,
       count(*) n, max(fecha)
  from public.citacion
 where fecha::date >= current_date
 group by 1 order by 1;
-- observado 2026-07-29: senado|23|2026-08-10 00:00:00+00      (NINGUNA fila 'camara')
```

**`Q-64` — PP `agenda_sala` (0065:260-265)**

```sql
select coalesce(nullif(regexp_replace(camara, '\s+', '', 'g'), ''), 'SIN-CAMARA') cam,
       count(*) n, max(fecha)
  from public.sesion_sala
 where fecha::date >= current_date
 group by 1 order by 1;
-- observado 2026-07-29:
--   camara|1|2026-08-03 00:00:00+00
--   senado|2|2026-08-05 00:00:00+00
```

**`Q-65` — `agrupacion_materia`: suma de los 10 clusters vs el corpus embebido y el corpus total**

```sql
select sum(conteo) from actualidad_senal where tipo_senal = 'agrupacion_materia';
-- observado 2026-07-29: 3100
select count(*) from public.proyecto_embedding;   -- observado: 3100
select count(*) from public.proyecto;             -- observado: 3675
```

⇒ los 10 clusters particionan **exactamente** el corpus embebido (`3100 = 3100`, sin doble conteo ni
pérdida). El denominador **honesto** del tile es `proyecto_embedding`, **no** `proyecto`: el tile
agrupa **3.100 de 3.675** proyectos (84,4 %) y **no lo declara** (fila 4-14).

### 5.3 Lectura del DOM de `/` — comandos verbatim

```bash
curl -s https://observatorio-congreso.thevalis.workers.dev/ -o /tmp/home.html   # → 200

# títulos de tile
grep -o -E '<h2 class="text-lg font-semibold mb-4">[^<]*</h2>' /tmp/home.html | sed -E 's/<[^>]*>//g'
# → Movimiento reciente / Urgencias del Ejecutivo / Citaciones próximas /
#   Sesiones de sala / Nuevos ingresos / Archivos y retiros / Por materia     (7 tiles)

# conteos por fila (patrón TOLERANTE al separador `<!-- -->` de React)
grep -o -E '<p class="mt-1 text-\[13px\]"><span class="font-mono">[0-9]+</span>' /tmp/home.html \
  | grep -o -E '[0-9]+'
# → 1 37 44 95 23 1 2 2 452 615 95 363 192 62 335 272 293      (17 conteos en el HTML inicial)

# el cluster 421 NO falta: llega por streaming de Suspense
grep -o -E '.{80}>421<.{80}' /tmp/home.html
# → …</ul></section></div><div hidden id="S:1"><span class="font-mono">421</span></div><script>$RS=…

# chips de cobertura declarada
grep -o -E 'bg-accent-product-soft rounded-full">[^<]*' /tmp/home.html | sed 's/.*rounded-full">//'
# → (sin cámara) / C.Diputados / Senado / senado / camara / senado

# la supresión-como-fila (nuevos_ingresos)
grep -o -E 'sin nuevos ingresos fechados en la ventana.{0,140}' /tmp/home.html | sed -E 's/<[^>]*>//g'
# → sin nuevos ingresos fechados en la ventana — en las fuentes consultadas al 28 jul 2026

# los 10 clusters de agrupacion_materia (grep literal — sin backtracking)
grep -o -F '<!-- -->proyectos' /tmp/home.html | wc -l          # → 10
grep -o "(sin materia)" /tmp/home.html | wc -l                 # → 20 (10 en HTML + 10 en payload RSC)

# denylist anti-ranking (T-52-13) sobre TODA la landing
grep -o -i -E "los m[aá]s|m[aá]s activ|top [0-9]|ranking|l[ií]der" /tmp/home.html | sort -u
# → (vacío: cero insinuación de ranking)
```

> **Gotcha de método registrado:** un `grep -o -E 'Por materia</h2>.{0,9000}'` sobre el HTML de una
> sola línea produce **backtracking catastrófico** (el comando superó 120 s y hubo que abortarlo).
> Para contar hijos de un tile hay que usar **greps literales sobre el marcador de fila**
> (`grep -o -F '<!-- -->proyectos'`), no un salto de N miles de caracteres desde el título.

---

## 6. lobby↔PL

> **PII:** esta sección audita `lobby_audiencia`, la tabla con datos de **terceros** más sensible del
> alcance. Todo lo que sigue son **agregados** y **nombres de columna**. Cero `rut`, cero email, cero
> `contraparte_id`, cero nombres de contrapartes individuales, cero materias verbatim.

### 6.1 Universo de lobby en PROD (línea base del denominador)

| magnitud | nº observado 2026-07-29 | query |
|----------|------------------------:|-------|
| `lobby_audiencia` — filas totales | 17.762 | `Q-67` |
| `estado_vinculo='confirmado'` | **5.106** | `Q-66` |
| `estado_vinculo='no_confirmado'` | 12.656 | `Q-66` |
| audiencias no confirmadas **con** `parlamentario_id` | **0** | `Q-66` |
| parlamentarios distintos con ≥1 confirmada | 136 | `Q-67` |
| … de cámara `senado` | **0** | `Q-67` |
| filas en `lobby_ingesta_estado` | 136 | `Q-67` |

**Hallazgo estructural del denominador honesto (`Q-66`):** las 12.656 audiencias `no_confirmado`
tienen `parlamentario_id` **NULL** en el 100 % de los casos. Por construcción, **ninguna audiencia no
confirmada puede atribuirse a un parlamentario**: el denominador de cualquier ficha es honesto *por
imposibilidad de lo contrario*, no por un filtro que alguien recordó escribir.

**Consecuencia para `S1338`:** `lobby_audiencia.parlamentario_id` confirmado es **hoy exclusivo de
diputados** (136 de 136). El cero de `S1338` no es wiring roto — es la cobertura real de la fuente.

### 6.2 Menciones de lobby por boletín (emisor E-020)

Superficie `/proyecto/[boletin]`, sección `Audiencias de lobby que mencionan este boletín`. Emisor
`app/components/lobby-menciones-de-boletin.tsx` — el `total_n` auditado se emite en `:212-214` y se
renderiza en `:216-228`. Origen: `RPC:lobby_menciones_de_boletin` (0062, corregida por **0063** a una
fila por audiencia con `total_n = count(*) over ()`; `LIMIT 50`).

**Sujetos:** `14309-04` (el bicameral de §1.1, el mismo del pgTAP real de 92-04) y `16849-12`
(boletín con **mayor `total_n`** de menciones en PROD hoy, `Q-68`).

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| 5.1 | `/proyecto/14309-04` | `app/components/lobby-menciones-de-boletin.tsx:212-228` (E-020) | `RPC:lobby_menciones_de_boletin` | `Q-69` | `1` | `1` | `cuadra` |
| 5.2 | `/proyecto/14309-04` | idem (contra-lectura de primeros principios) | `lobby_audiencia.identificador` | `Q-70` | `1` | `1` | `cuadra` |
| 5.3 | `/proyecto/16849-12` | `app/components/lobby-menciones-de-boletin.tsx:212-228` (E-020) | `RPC:lobby_menciones_de_boletin` | `Q-69` | `13` | `13` | `cuadra` |
| 5.4 | `/proyecto/16849-12` | idem (contra-lectura de primeros principios) | `lobby_audiencia.identificador` | `Q-70` | `13` | `13` | `cuadra` |
| 5.5 | `/proyecto/[boletin]` — rama truncada | `app/components/lobby-menciones-de-boletin.tsx:214-221` | `RPC:lobby_menciones_de_boletin` (`LIMIT 50`) | `Q-71` | `max(total_n) = 13` sobre **82** boletines ⇒ `truncado` es `false` en el 100 % de PROD | `no observable: ningún boletín supera el LIMIT 50 en el deploy auditado` | `discrepancia-declarada` |

**RPC ≡ primeros principios en ambos sujetos.** La doble lectura obligatoria no reveló divergencia:
la RPC 0063 implementa lo que declara implementar.

**Literales del DOM (patrón tolerante a `<!-- -->`):**

```html
<!-- /proyecto/14309-04 -->
<p class="text-base leading-relaxed"><span class="font-mono">1</span> <!-- -->audiencia registrada menciona<!-- --> <!-- -->este boletín.</p>

<!-- /proyecto/16849-12 -->
<p class="text-base leading-relaxed"><span class="font-mono">13</span> <!-- -->audiencias registradas mencionan<!-- --> <!-- -->este boletín.</p>
```

**Sobre 5.5 — por qué no se corrige:** no hay discrepancia que corregir — hay una **rama de código
sin ningún caso real** que la ejerza. El techo actual (13) está a 37 audiencias del `LIMIT 50`.
Afirmar `cuadra` sobre una rama que el deploy nunca ejecuta sería un `cuadra` sin evidencia, y la
regla dura §0.1 lo prohíbe. La lógica de `:214` (`const truncado = total > mostradas`) **lee
`total_n`, no `mostradas`**, y por inspección estática es correcta — pero eso es una lectura de
código, no una observación del DOM. Handoff: **Phase 125** (verificación post-deploy si algún boletín
superara 50); sin acción de código. El test `declara la cobertura en el camino TRUNCADO` de 5.12 **sí**
ejercita esa rama con un fixture (`total_n: 80`).

**Correspondencia con 92-04:** el ranking de `Q-68` reproduce **exactamente** el top del runbook de la
Phase 92 (`16849-12` 13, `16374-07` 12, `17064-08` 9, `15975-25` 9, `17337-07` 8, `14985-34` 8), con
el mismo orden por conteo. Sin deriva.

### 6.3 Lobby en la ficha del parlamentario (emisor E-002)

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| 5.6 | `/parlamentario/D1165` | `app/app/parlamentario/[id]/page.tsx:611-613` (`conteoLabel`) | `RPC:lobby_de_parlamentario` | `Q-72`, `Q-73` | `112` | `112` | `cuadra` |
| 5.7 | `/parlamentario/D1165` | `app/components/capa1/lobby-capa1.tsx:32-33` | `RPC:lobby_de_parlamentario` | `Q-73` | `112` | `112` | `cuadra` |
| 5.8 | `/parlamentario/D1165` | `app/components/lobby-de-parlamentario.tsx:410-411` (E-002) | `RPC:lobby_de_parlamentario` | `Q-73` | `112` | `112` | `cuadra` |
| 5.9 | `/parlamentario/D1165` — **denominador honesto** | `app/lib/parlamentario-resumen-conteos.ts:312-332` | `lobby_audiencia.estado_vinculo` | `Q-72` | CON filtro `112` · SIN filtro `112` | `112` | `cuadra` |
| 5.10 | `/parlamentario/S1338` — rótulo del carril | `app/app/parlamentario/[id]/page.tsx:95-96` | `lobby_ingesta_estado.parlamentario_id` | `Q-72` | `0` audiencias + `0` filas de marcador ⇒ `no_ingerido` | `—` | `cuadra` |
| 5.11 | `/parlamentario/S1338` — **capa-1** | `app/app/parlamentario/[id]/page.tsx:617` + `capa1/lobby-capa1.tsx:32-33` | `lobby_ingesta_estado.parlamentario_id` | `Q-72` | estado real = `no_ingerido` (**no cuantificable**) | **`0 reuniones`** | **`discrepancia-corregida`** |

**Denominador honesto — CON y SIN `estado_vinculo='confirmado'` (`Q-72`):**

| sujeto | CON `estado_vinculo='confirmado'` | SIN el filtro | ¿difieren? | marcador `lobby_ingesta_estado` |
|--------|----------------------------------:|--------------:|:----------:|:-------------------------------:|
| `D1165` | **112** | **112** | **no** | presente (1 fila) |
| `S1338` | **0** | **0** | **no** | **ausente** (0 filas) |

**Veredicto del denominador honesto: no hay nada que corregir, y la razón es estructural.** Los
conteos CON y SIN filtro coinciden porque las 12.656 audiencias `no_confirmado` tienen
`parlamentario_id` NULL (`Q-66`) — el `where parlamentario_id = p.id` ya las excluye antes de que el
filtro de `estado_vinculo` opine. Registrado con ambas columnas para que la afirmación sea auditable
y no una promesa. (Fragilidad declarada en [Límites](#límites-declarados), L-4.)

**Estado 3-valores de `S1338`:**

| pregunta | respuesta observada |
|----------|---------------------|
| ¿qué estado 3-valores emite el sitio? | **`no_ingerido`** — el rótulo es `—`, que `conteoLabel` (`page.tsx:95-96`) emite **sólo** para `no_ingerido` (`vacio` emitiría `sin registros`) |
| ¿corresponde al marcador `lobby_ingesta_estado`? | **sí**: `Q-72` → 0 filas para `S1338`. Con `total=0` + marcador ausente, `derivarEstado` devuelve `no_ingerido` |
| contraste de control | el mismo `conteoLabel` emite `sin registros` para el carril `cruces` de `S1338` en la misma página — el 3-estado **sí** discrimina, no está colapsado |

**Ausencia de E-002 en `S1338`, verificada** (los tres literales LOCKED de `lobby-de-parlamentario.tsx`):

```bash
for P in D1165 S1338; do
  grep -c "Audiencias registradas bajo la Ley del Lobby" f_$P.html
  grep -c "su identidad" f_$P.html
  grep -c "Agrupar por contraparte" f_$P.html
done
# D1165 → 1 / 1 / 1        S1338 → 0 / 0 / 0
```

⇒ los empty-states (a) `no ingestado` y (b) `ingestado, cero` de E-002 **son código inalcanzable en
la superficie desplegada**: el gate `tipo === "dato"` de `page.tsx:619` los cortocircuita siempre.
Registrado en [Vacíos honestos](#vacíos-honestos) como cero honesto con matiz, **no** como bug.

#### Fila 5.11 — el hallazgo del fragmento de lobby

`page.tsx:617` pasaba a `LobbyCapa1`:

```tsx
total={conteos.lobby.tipo === "dato" ? conteos.lobby.n : 0}
```

Colapsa **`vacio` y `no_ingerido` al literal `0`**, y `lobby-capa1.tsx:32-33` lo imprime como el
hecho `0 reuniones`. Resultado observado en `/parlamentario/S1338`: la **misma sección** declara `—`
en su encabezado (honesto: "no ingerido") y `0 reuniones` tres líneas más abajo (afirmación de hecho:
"se ingirió y no hubo ninguna"). Las dos frases se contradicen dentro del mismo `<section id="lobby">`,
contra la regla LOCKED del propio componente E-002 (`lobby-de-parlamentario.tsx:47`):

> *"Un vacío es un HECHO, no una virtud: 'no ingestado' ≠ 'ingestado, cero'."*

**Números:** nº SQL = **no hay número** (el estado real es `no_ingerido`, que por definición **no**
tiene denominador conocido); nº deploy = `0`. **El número erróneo queda registrado, no se borra.**
**Corregida en 122-05** — ver [Fixes aplicados](#fixes-aplicados) fila 1.

### 6.4 Cobertura declarada lobby ↔ PL

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| 5.12 | `/proyecto/[boletin]` — cifra de cobertura | (ninguno en el deploy auditado — literal inexistente **pre-fix**) | `lobby_audiencia.estado_vinculo` × `proyecto.boletin_num` | `Q-74` | `195/5106 = 3,82 %`, 82 boletines | `no emitido: no existe literal de cobertura en la superficie` | **`discrepancia-corregida`** |
| 5.13 | `/proyecto/[boletin]` — criterio declarado | `app/components/lobby-menciones-de-boletin.tsx:87` y `:95` | (copy LOCKED) | `Q-74` | n/a (cualitativo) | leyenda + empty emitidos, verificados en el DOM de ambos sujetos | `cuadra` |

**Cifra 92-04 vs cifra observada hoy (`Q-74`):**

| magnitud | cifra 92-04 (v9.0) | **cifra observada 2026-07-29** | ¿cambió? |
|----------|-------------------:|-------------------------------:|:--------:|
| denominador — audiencias confirmadas con `parlamentario_id` y `materia` | 5.106 | **5.106** | no |
| numerador — audiencias con ≥1 mención VÁLIDA (explícita + existente) | 195 | **195** | no |
| **cobertura** | **~3,8 %** | **3,82 %** | **no** |
| boletines distintos alcanzados | 82 | **82** | no |

**El `~3,8 %` sigue vigente.** La cobertura es **baja por diseño** (fail-closed doble: sólo enlaza
cuando el número de boletín está explícito en la materia **y** el proyecto existe en `proyecto`;
jamás por tema, keyword ni similitud). 195/5.106 es el dato honesto, no un defecto de ingesta.

**Dónde vivía ese literal en el código pre-fix — en ninguna parte.** Búsqueda ejecutada:

```bash
grep -rn "cobertura" app --include=*.tsx | grep -v "\.test\."
grep -rn "cobertura" app --include=*.ts  | grep -v "\.test\."
grep -rn "3,8 *%\|3\.8 *%\|5\.106\|5106" app --include=*.tsx --include=*.ts | grep -v "\.test\."
grep -rn -i "menciona" app/app/metodologia/page.tsx app/app/sobre/page.tsx
```

- Las coincidencias de `cobertura` pertenecen **todas** a otras superficies (`/agenda`, `/buscar`,
  `/comparar`, `metodologia`, `sobre`).
- Las cifras (`3,8 %` / `3.8 %` / `5.106` / `5106`) devuelven **cero** coincidencias fuera de tests.
- `metodologia` y `sobre` **no** mencionan el canal de menciones de lobby.

⇒ **cobertura parcial no declarada**. Lo que la superficie **sí** declaraba es el **criterio** (que la
mención debe ser explícita), en dos literales LOCKED (`:87` leyenda anti-causal y `:95` empty-state).
Ambos honestos y **cualitativamente** correctos, pero **ninguno cuantificaba** cuán parcial es el
canal. **Corregida en 122-05** — ver [Fixes aplicados](#fixes-aplicados) fila 2.

### 6.5 [HUECO CERRADO EN 122-06] `lobby_en_tramitacion` — el segundo canal lobby↔PL (E-041)

**Por qué está aquí.** El barrido de cobertura detectó que **E-041**
`app/components/lobby-en-tramitacion.tsx` está **montado** en `/proyecto/[boletin]`
(`app/app/proyecto/[boletin]/page.tsx:198`) y emite conteos de un cruce lobby↔PL —por **coincidencia
temporal**, un canal distinto del de menciones de E-020— que el universo §0.3 **no había incluido**.
**HUECO real**, cerrado aquí con el método completo.

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| H-3 | `/proyecto/14309-04` | `app/components/lobby-en-tramitacion.tsx:187-197` (E-041, empty honesto) | `RPC:lobby_en_tramitacion` | `Q-82` | `0` | `No se registran reuniones de lobby en las semanas en que una comisión vio este proyecto, según las fuentes consultadas.` (heading + caveat **presentes**; cero-como-cero) | `cuadra` |
| H-4 | `/proyecto/17337-07` | `app/components/lobby-en-tramitacion.tsx:202,222-230` (E-041, total dedup + desglose por semana) | `RPC:lobby_en_tramitacion` | `Q-82` | total **`219`**; por semana `2026-W20 → 55`, `W21 → 33`, `W23 → 65`, `W24 → 61`, `W26 → 5` | mismos 5 conteos en el DOM (`55, 33, 65, 61, 5`; Σ **219**) | `cuadra` |

**Selección del sujeto no vacío (`Q-83`, sondeo acotado a 200 boletines con puntos de citación):**
`94` de `125` evaluados tienen ≥1 coincidencia; el máximo es **`17337-07` (219)**, seguido de
`13529-34` (214) y `14767-03` (181). `14309-04` está en el `0` — su cero es real, no un canal muerto.

**Contrato leído del código, no asumido:** el total mostrado es **deduplicado por semana**
(`lobby-en-tramitacion.tsx:202`, `WR-02`), no el número de filas del join por comisión, y el caveat
anti-causal **precede** siempre al número: *"Se muestran por coincidencia de fechas… La coincidencia
temporal no implica relación entre la reunión y la tramitación del proyecto."* Verificado presente en
ambos sujetos, incluido el camino vacío.

### 6.6 Queries de §6

**`Q-66` — distribución de `estado_vinculo` y su acoplamiento con `parlamentario_id`**

```sql
select coalesce(estado_vinculo,'(null)'),
       count(*),
       count(*) filter (where parlamentario_id is not null)
from public.lobby_audiencia
group by 1 order by 2 desc;
-- observado 2026-07-29:
-- no_confirmado|12656|0
-- confirmado   | 5106|5106
```

**`Q-67` — universo de parlamentarios alcanzados por lobby confirmado**

```sql
select count(*) from public.lobby_audiencia;                                  -- 17762
select count(*) from public.lobby_ingesta_estado;                             -- 136
select count(distinct parlamentario_id) from public.lobby_audiencia
 where estado_vinculo='confirmado';                                           -- 136
select p.camara, count(distinct l.parlamentario_id)
  from public.lobby_audiencia l join public.parlamentario p on p.id=l.parlamentario_id
 where l.estado_vinculo='confirmado' group by 1;
-- observado 2026-07-29: diputados|136        (cero filas para 'senado')
```

**`Q-68` — selección del boletín con mayor `total_n` (desempate estable por `boletin asc`)**

```sql
-- Prefiltro de candidatos (heurística de extracción, superset de la RPC) y luego el
-- total_n EXACTO de la propia RPC por candidato: el ranking no se estima, se mide.
with base_aud as (
  select a.materia from public.lobby_audiencia a
  where a.estado_vinculo='confirmado' and a.parlamentario_id is not null and a.materia is not null
),
ext_a as (select (regexp_matches(materia, '\m(\d{1,3}(?:\.\d{3})+|\d{3,6})-(\d{1,2})\M', 'g')) g from base_aud),
ext_b as (select (regexp_matches(materia, '(bolet.n|bol\.)(\s+[^[:space:][:digit:]]+){0,2}\s+(\d{1,3}(?:\.\d{3})+|\d{3,6})\M(?!-[[:digit:]])', 'gi')) g from base_aud),
cand as (select replace(g[1],'.','') num from ext_a union select replace(g[3],'.','') num from ext_b),
bol  as (select distinct pr.boletin from cand c join public.proyecto pr on pr.boletin_num = c.num)
select b.boletin, coalesce(t.n,0) as total_n
from bol b
left join lateral (select max(m.total_n) n from public.lobby_menciones_de_boletin(b.boletin) m) t on true
order by coalesce(t.n,0) desc, b.boletin asc
limit 8;
-- observado 2026-07-29:
-- 16849-12|13
-- 16374-07|12
-- 15975-25|9
-- 17064-08|9
-- 14985-34|8
-- 17337-07|8
-- 14838-03|7
-- 14993-12|7
```

> **Nota de método (transparencia del `bolet.n`).** El gatillo de la rama (b) en 0063 es
> `(bolet[ií]n|bol\.)`. La `í` acentuada no sobrevive al paso por el shell de este entorno
> (`ERROR: invalid byte sequence for encoding "UTF8"`), así que todas las queries de §6 escriben
> `bolet.n` — el `.` de regex casa **cualquier** carácter y por lo tanto es un **superset** estricto
> de `[ií]`. Un superset solo puede **sobre**-contar, nunca sub-contar. Verificado además
> re-corriendo la doble lectura con la variante ASCII estricta `bolet[ii]n` — **mismo resultado**.

**`Q-69` — la RPC que el sitio invoca, por psql**

```sql
select count(*) || '|' || coalesce(max(total_n),0)
from public.lobby_menciones_de_boletin('<boletin>');
-- observado 2026-07-29:
--   14309-04 →  1|1     (filas devueltas | total_n)
--   16849-12 → 13|13
```

**`Q-70` — primeros principios: el fail-closed doble de 0062/0063 reconstruido a mano**

```sql
with req as (
  select ('<boletin>' ~ '^(\d{3,6}|\d{1,3}(\.\d{3})+)(-\d{1,2})?$') as ok,
         replace(split_part('<boletin>','-',1),'.','')              as base,
         nullif(split_part('<boletin>','-',2),'')                   as sufijo
),
pat as (
  select r.ok, r.base, r.sufijo,
         '(' || r.base || '|' || regexp_replace(r.base,'(\d{1,3})(\d{3})$','\1.\2') || ')' as base_dot
  from req r
)
select count(distinct a.identificador)
from public.lobby_audiencia a
join public.parlamentario p on p.id = a.parlamentario_id
cross join pat
where pat.ok
  and a.estado_vinculo = 'confirmado'          -- DENOMINADOR HONESTO
  and a.parlamentario_id is not null           -- fail-closed identidad
  and a.materia is not null
  and exists (select 1 from public.proyecto pr
               where pr.boletin = '<boletin>' or pr.boletin_num = pat.base)   -- fail-closed #2
  and (
    (pat.sufijo is not null and a.materia ~ ('\m'||pat.base_dot||'-'||pat.sufijo||'\M'))
    or a.materia ~* ('(bolet.n|bol\.)(\s+[^[:space:][:digit:]]+){0,2}\s+'||pat.base_dot||'\M(?!-[[:digit:]])')
  );
-- observado 2026-07-29:  14309-04 → 1 ;  16849-12 → 13
```

**`Q-71` — máximo `total_n` alcanzable sobre TODO el universo de boletines mencionados**

```sql
-- (mismo prefijo de Q-68 hasta la CTE `bol`)
select max(coalesce(t.n,0)) as max_total_n, count(*) as boletines_evaluados
from bol b
left join lateral (select max(m.total_n) n from public.lobby_menciones_de_boletin(b.boletin) m) t on true;
-- derivado de la salida completa de Q-68 observada 2026-07-29: max_total_n = 13, boletines = 82
```

**`Q-72` — denominador honesto: ambos conteos lado a lado, más el marcador de ingesta**

```sql
select p.id,
  (select count(distinct l.identificador) from public.lobby_audiencia l
     where l.parlamentario_id=p.id and l.estado_vinculo='confirmado')      as conf_distinct,
  (select count(*) from public.lobby_audiencia l
     where l.parlamentario_id=p.id and l.estado_vinculo='confirmado')      as conf_rows,
  (select count(distinct l.identificador) from public.lobby_audiencia l
     where l.parlamentario_id=p.id)                                        as sinfiltro_distinct,
  (select count(*) from public.lobby_audiencia l
     where l.parlamentario_id=p.id)                                        as sinfiltro_rows,
  (select count(*) from public.lobby_ingesta_estado e
     where e.parlamentario_id=p.id)                                        as marcador
from public.parlamentario p
where p.id in ('D1165','S1338')
order by p.id;
-- observado 2026-07-29:
-- D1165|112|112|112|112|1
-- S1338|  0|  0|  0|  0|0
```

**`Q-73` — la RPC que el sitio invoca, por psql**

```sql
select count(distinct identificador), count(*) from public.lobby_de_parlamentario('D1165');  -- 112|112
select count(distinct identificador), count(*) from public.lobby_de_parlamentario('S1338');  --   0|0
```

**`Q-74` — cobertura lobby↔PL, query VERBATIM de 92-04** (única sustitución declarada:
`bolet[ií]n` → `bolet.n`; columna `pct` añadida para no calcular el porcentaje a mano)

```sql
with base as (
  select a.identificador, a.materia
  from public.lobby_audiencia a
  where a.estado_vinculo='confirmado' and a.parlamentario_id is not null and a.materia is not null
),
menciones as (
  -- (a) {base}-{sufijo} en cualquier posición → inequívoca por el sufijo
  select b.identificador,
         replace((regexp_matches(b.materia, '\m(\d{1,3}(?:\.\d{3})*|\d{3,6})-\d{2}\M', 'g'))[1], '.', '') as base
  from base b
  union all
  -- (b) base pelada SOLO tras gatillo "boletín"/"boletin"/"bol." (<=2 tokens sin dígitos)
  select b.identificador,
         replace((regexp_matches(b.materia, '(?:bolet.n|bol\.)(?:\s+[^[:space:][:digit:]]+){0,2}\s+(\d{1,3}(?:\.\d{3})*|\d{3,6})\M(?!-\d)', 'gi'))[1], '.', '') as base
  from base b
),
validas as (
  -- EXISTENCIA (fail-closed #2): el boletín citado existe en proyecto
  select distinct m.identificador
  from menciones m
  join public.proyecto pr on pr.boletin_num = m.base or split_part(pr.boletin,'-',1) = m.base
)
select
  (select count(*) from base)    as total_confirmadas_con_materia,
  (select count(*) from validas) as audiencias_con_mencion_valida,
  (select count(distinct base) from menciones m2
     join public.proyecto pr2 on pr2.boletin_num=m2.base or split_part(pr2.boletin,'-',1)=m2.base
  ) as boletines_distintos_mencionados,
  round(100.0*(select count(*) from validas)/nullif((select count(*) from base),0), 2) as pct;
-- observado 2026-07-29: 5106|195|82|3.82
```

**`Q-75` — `lobby_sector_aporte` (Grupo 6)**

```sql
select count(*) from public.cruce_senal where tipo_senal='lobby_sector_aporte';
-- observado 2026-07-29: 0
```

**`Q-76` — el universo real de `tipo_senal`**

```sql
select tipo_senal, count(*) from public.cruce_senal group by 1 order by 2 desc;
-- observado 2026-07-29: lobby_sector|781      (una sola fila: no hay ningún otro tipo_senal)
select distinct tipo_senal from public.cruce_senal;
-- observado 2026-07-29: lobby_sector
```

**`Q-77` — señales de voto (la rama `startsWith("voto")` de `agruparSectores`)**

```sql
select count(*) from public.cruce_senal where tipo_senal like 'voto%';
-- observado 2026-07-29: 0
```

**`Q-78` — cruces de `S1338`**

```sql
select count(*) from public.cruce_senal where parlamentario_id='S1338';
-- observado 2026-07-29: 0
```

**`Q-82` — [122-06] `lobby_en_tramitacion`: la MISMA RPC que lee el sitio (+ desglose por semana)**

```sql
select count(*) from public.lobby_en_tramitacion('<boletin>');
-- observado 2026-07-29: 14309-04 → 0   ·   16849-12 → 0   ·   17337-07 → 219

select semana_iso, count(*) from public.lobby_en_tramitacion('17337-07') group by 1 order by 1;
-- observado 2026-07-29:
--   2026-W20|55
--   2026-W21|33
--   2026-W23|65
--   2026-W24|61
--   2026-W26|5      (Σ 219 == el total dedup que muestra el componente)
```

**`Q-83` — [122-06] sondeo acotado del canal `lobby_en_tramitacion`** (¿el cero de `14309-04` es del
boletín o del canal?)

```sql
set statement_timeout='150s';
with b as (select distinct boletin from public.citacion_punto where boletin is not null limit 200)
select count(*) filter (where n>0) con_datos, count(*) evaluados, coalesce(max(n),0) max_n
from (select b.boletin, (select count(*) from public.lobby_en_tramitacion(b.boletin)) n from b) x;
-- observado 2026-07-29: 94|125|219   ⇒ el canal está VIVO; el cero de 14309-04 es del boletín

-- top-3 del mismo sondeo (desempate estable por boletin asc)
--   17337-07|219   ·   13529-34|214   ·   14767-03|181
```

**`Q-84` — [122-06] lectura del DOM de `lobby_en_tramitacion`**

```bash
curl -s "https://observatorio-congreso.thevalis.workers.dev/proyecto/14309-04" -o /tmp/p.html
grep -o -E 'No se registran reuniones de lobby en las semanas[^<\\]{0,80}' /tmp/p.html
# → No se registran reuniones de lobby en las semanas en que una comisión vio este proyecto, según las fuentes consultadas.

curl -s "https://observatorio-congreso.thevalis.workers.dev/proyecto/17337-07" -o /tmp/p17337.html
grep -o -E 'class="font-mono">[0-9]+</span> *(<!-- -->)? *reuni[^<]{0,20}' /tmp/p17337.html
# → 5 reuniones | 61 reuniones | 65 reuniones | 33 reuniones | 55 reuniones     (Σ 219)
grep -o -E 'Semana <span class="font-mono">[0-9W-]+</span>' /tmp/p17337.html
# → 2026-W26 · 2026-W24 · 2026-W23 · 2026-W21 · 2026-W20
```

---

## 7. Coberturas declaradas fuera de los 6 grupos (huecos cerrados en 122-06)

Dos emisores más quedaron fuera del universo §0.3 y **sí** emiten una **cobertura** cuantificada. El
barrido emisor-por-emisor los detectó; se cierran aquí con SQL + DOM, no se declaran "no aplica".

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| H-5 | `/buscar` — banner de cobertura del corpus | `app/app/buscar/page.tsx:60-68` (E-017) ← `app/lib/coverage.ts` (`contarCoberturaBusqueda`) | `tabla.proyecto_embedding` (count exacto, cache 1 h) | `Q-65` / `Q-85` | `3100` (== el mismo corpus embebido del tile *Por materia*, §5) | `Busca sobre <!-- -->3100<!-- --> proyectos de ley (<!-- -->período legislativo 2022–2026<!-- -->).` | `cuadra` |
| H-6 | `/agenda` — banner *Cobertura de la agenda* | `app/components/agenda-cobertura.tsx:59-62` ← `app/app/agenda/page.tsx:296-341` (E-004) | `tabla.citacion` (`camara='camara'`: count + min/max de `fecha`) | `Q-86` / `Q-85` | `164` citaciones · `9` semanas · rango `2026-05-11 → 2026-07-07` | `Comisiones de la Cámara: 164 citaciones ingeridas en 9 semanas (2026-05-11→2026-07-07); el histórico completo del período está pendiente de carga.` | `cuadra` |

**Nota de contrato (H-6):** las `9 semanas` **no** son un `count(distinct)` de semanas ISO — son el
ancho del rango `floor(díasEntre/7)+1` (`page.tsx:346-355`, `semanasEntre`), y el propio JSDoc lo
declara (`agenda-cobertura.tsx:21-22`). `Q-86` reproduce **esa** aritmética, no otra. El banner
declara además su propia parcialidad (*"el histórico completo del período está pendiente de carga"*),
que es el patrón correcto.

**Nota de contrato (H-5):** el N del banner es `count(proyecto_embedding)` — *los proyectos realmente
indexados*, **nunca hardcodeado** (`coverage.ts` lo documenta como anti-patrón LOCKED T-63-14) y con
**frontera de error honesta**: si el count falla, el banner se **oculta** en vez de decir "0"
(WR-02). Ese camino de error no es observable hoy y no se fabrica.

**`Q-85` — [122-06] lectura del DOM de los dos banners**

```bash
curl -s "https://observatorio-congreso.thevalis.workers.dev/buscar" | grep -o -E 'Busca sobre.{0,120}'
# → Busca sobre <!-- -->3100<!-- --> proyectos de ley (<!-- -->período legislativo 2022–2026<!-- -->).

curl -s "https://observatorio-congreso.thevalis.workers.dev/agenda" -o /tmp/agenda.html
grep -o -E '.{120}class="font-mono">164.{0,160}' /tmp/agenda.html | sed -E 's/<[^>]*>//g'
# → Comisiones de la Cámara: 164 citaciones ingeridas en 9 semanas (2026-05-11→2026-07-07);
#   el histórico completo del período está pendiente de carga.
```

**`Q-86` — [122-06] cobertura de `/agenda` (Cámara) por primeros principios**

```sql
select count(*) n, min(fecha)::date, max(fecha)::date,
       floor((max(fecha)::date - min(fecha)::date)/7)+1 semanas
from public.citacion where camara='camara';
-- observado 2026-07-29: 164|2026-05-11|2026-07-07|9
```

---

## Vacíos honestos

> **Regla LOCKED (122-CONTEXT §Vacíos y copy; §0.3 Grupo 6):**
> **cero filas se presenta como cero; jamás se rellena, jamás se oculta la superficie.**
>
> **Regla de admisión de esta sección:** toda fila DEBE traer su query verbatim. **Un vacío afirmado
> sin query no se acepta** — es indistinguible de una omisión.

| qué | query verbatim | nº observado | causa estructural | ¿es bug? | dónde se declara en la UI |
|-----|----------------|-------------:|-------------------|:--------:|---------------------------|
| **`lobby_sector_aporte`** (Grupo 6) | `Q-75` | **0** | Stub estructural de la migración **0052**: la CTE `empresa_sector` está escrita `where false` (`0052:130-136`), por lo que la arista `<rut de la empresa → sector>` **no existe** y el `join empresa_sector es on es.rut_empresa = cta.rut_proveedor` (`0052:166`) no puede producir ninguna fila. Además RUT-01 sigue en 0 % con el backfill de ChileCompra pendiente | **NO** | **No emitida.** La superficie que la consumiría está bajo **MONEY (OFF)** ⇒ fuera del deploy auditado (LÍMITE B). Además `grep -rn "lobby_sector_aporte" app` (sin tests) → **cero** consumidores: hoy la señal no está cableada a ningún componente |
| **`nVotos` de los sectores de cruce** | `Q-76`, `Q-77` | **0** | `cruce_senal.tipo_senal` toma **un solo** valor en PROD (`lobby_sector`, 781 filas). `agruparSectores` (`parlamentario-resumen-conteos.ts:155`) suma a `nVotos` sólo lo que hace `startsWith("voto")`, y no existe ninguna señal así. La rama queda reservada | **NO** | **Omisión honesta.** `capa1/cruces-capa1.tsx:28` monta el fragmento sólo con `{sector.nVotos > 0 && …}` ⇒ con 0 **no se pinta nada**: no se fabrica un "0 votos" que sugiera una dimensión medida y vacía |
| **`S1338` sin lobby** | `Q-72`, `Q-73` | **0** audiencias · **0** filas de marcador | `lobby_audiencia.parlamentario_id` confirmado es **hoy exclusivo de diputados**: 136 de 136 (`Q-67`), cero senadores. `S1338` es el senador de PROD con **más** riqueza de bloques y aun así no tiene lobby | **NO** (conteo 0 real, no wiring roto) | Rótulo del carril `—` (`no_ingerido`, correcto). **PERO** la capa-1 imprimía `0 reuniones`: fila **5.11**, `discrepancia-corregida` |
| **`S1338` sin cruces** | `Q-78`, `Q-54` | **0** | `cruce_senal` se materializa desde `lobby_sector` (0039/0052); sin audiencias de lobby no hay señal de sector que materializar. Cero de lobby ⇒ cero de cruces, por construcción | **NO** | Rótulo del carril `cruces` = **`sin registros`** (`conteoLabel` de `vacio`), observado en el DOM. Correcto: el materializador **sí** corrió, y no produjo señales |
| **`S1338` sin relaciones en `/red`** | `Q-79`, `Q-80`, `Q-81` | **0** nodos / **0** aristas | Coherente con el vacío de lobby: `arista` se alimenta de audiencias confirmadas (7.394 filas, ninguna incidente a `S1338`) | **NO** | `Aún no hay relaciones para mostrar para este parlamentario. Cuando existan hechos públicos que vinculen a dos parlamentarios …` — ruta `200`, sección presente, **cero-como-cero** |
| **`14309-04` sin lobby en tramitación** | `Q-82`, `Q-83`, `Q-84` | **0** | El canal está **vivo** (94/125 boletines sondeados tienen ≥1, máximo 219): el cero es **de este boletín**, no del canal | **NO** | `No se registran reuniones de lobby en las semanas en que una comisión vio este proyecto, según las fuentes consultadas.` — heading + caveat anti-causal **presentes** |
| **`nuevos_ingresos` = 0 en la ventana** | `Q-57`, `Q-60` | **0** | 0 boletines con primer evento fechado dentro de los 7 días, **con la fuente fresca** ⇒ rama `if not found` de 0065:170-177 | **NO** | **Supresión-como-fila**: el tile existe y dice `sin nuevos ingresos fechados en la ventana — en las fuentes consultadas al 28 jul 2026`. No es un `0` presentado como hecho |
| **Empty-states (a)/(b) de E-002 inalcanzables** | `Q-72` + los 3 `grep -c` de §6.3 | **0** ocurrencias en el DOM | `page.tsx:619` monta `LobbySection` sólo si `conteos.lobby.tipo === "dato"` ⇒ los caminos `noIngestado` (`:348-370`) y `totalAudiencias === 0` (`:373-394`) **nunca** se alcanzan desde esta superficie | **NO** — código defensivo, no un vacío de datos | No se declara (y no hace falta): el 3-estado del rótulo ya cubre el caso. Registrado para que un auditor futuro **no** lo lea como "el empty-state está roto" |
| **Empty-state de E-053 inalcanzable** | `Q-54` | **0** ocurrencias en el DOM | `page.tsx:682` exige `tipo === "dato"` ⇒ el empty de `cruces-de-parlamentario.tsx:128-139` es código muerto | **NO** — atribución de emisor | El cero **sí** se declara, por la capa-1 (fila 3.b-7). Fila 3.b-9 lo registra como `discrepancia-declarada` de catálogo |
| **Rama truncada `mostradas < total_n`** | `Q-71` | `max(total_n) = 13` sobre 82 boletines (techo `LIMIT 50`) | Ningún boletín de PROD alcanza 50 menciones ⇒ `truncado` es `false` en el 100 % de los casos | **NO** — rama sin caso real | No aplica. Fila **5.5**, `discrepancia-declarada` |

### `lobby_sector_aporte` — nota dirigida al auditor futuro

> **`0` filas es el resultado CORRECTO por construcción; rellenarlo exigiría un dato que la fuente
> no entrega hoy.**
>
> Esta frase está aquí, verbatim, para que **nadie lea este cero como un defecto**. La migración 0052
> lo declara desde su propio encabezado: *"STUB ESTRUCTURAL correcto-por-construcción"* (`0052:3`,
> `0052:23`), y modela la arista faltante como una **relación honesta-vacía** (`where false` → 0
> filas, tipos correctos) precisamente para que el día que exista un sector clasificado por RUT de
> empresa el cruce se encienda **sin cambiar el esquema**. Un `0` aquí significa *"la arista
> `<rut de la empresa → sector>` todavía no existe en ninguna fuente ingerida"*, **no** *"ningún
> parlamentario tiene este cruce"*. Cero filas se presenta como cero: jamás se rellena, jamás se
> oculta la superficie. **NO es bug.**

---

## Fixes aplicados

Bitácora del plan **122-05** (`122-CRUCES-SQL-04-FIXES.md`). Único plan de la fase que tocó código.
**Cero deploy** (viaja con la Phase 125), **cero flags** tocados, **cero migraciones**: la última
migración numerada del repo sigue siendo **0072**.

**Aritmética de cobertura (identidad obligatoria, verificada por 122-06):**

```
filas en la tabla de fixes                =  2
filas en "Fixes NO aplicados"             =  0
                                           ---
suma                                       =  2
total de filas `discrepancia-corregida`    =  2      ✔ IDENTIDAD CUMPLIDA
```

**Cero filas huérfanas. Cero filas degradadas.** El techo de alcance del plan (8 filas / 6 archivos
de `app/`) **no se activó**: 2 filas, 3 archivos de `app/` tocados.

| # | fila origen | discrepancia (nº deploy → nº SQL) | archivo:línea | qué cambió | test de respaldo | estado |
|---|-------------|-----------------------------------|---------------|------------|------------------|--------|
| 1 | **5.11** (§6.3) | deploy: **`0 reuniones`** (un HECHO cuantificado) → SQL: **no hay número** — el estado real de `S1338` es `no_ingerido` (`Q-72`: 0 audiencias **y** 0 filas de marcador), que por definición **no tiene denominador conocido** | `app/app/parlamentario/[id]/page.tsx:617` + `app/components/capa1/lobby-capa1.tsx:18-45` | **Fix de TIPO, no de copy.** `page.tsx` pasaba `total={conteos.lobby.tipo === "dato" ? conteos.lobby.n : 0}`, colapsando `vacio` **y** `no_ingerido` al literal `0`. Ahora `LobbyCapa1` recibe el **`CarrilEstado` completo** y la línea de conteo se emite **sólo** con `tipo === "dato"`; con `vacio`/`no_ingerido`/`pendiente` se **omite** — espejo exacto de `cruces-capa1.tsx:28`. **El cero honesto se preserva:** un carril `dato` con `n: 0` **sigue** imprimiendo `0 reuniones` | `components/capa1/lobby-capa1.test.tsx` → `describe("5.11 — un estado no-\`dato\` JAMÁS se imprime como el hecho \`0 reuniones\`")`, **5 casos** | **aplicado** |
| 2 | **5.12** (§6.4) | deploy: **no emitido** — no existía literal de cobertura en ninguna superficie → SQL (`Q-74`): **195 / 5.106 = 3,82 %** sobre **82** boletines | `app/components/lobby-menciones-de-boletin.tsx` — constante `COBERTURA_MENCIONES_LOBBY` + render en `LobbyMencionesView` (tras la leyenda anti-causal, **antes** del conteo) | Línea de **cobertura parcial declarada**, presente en los **tres** caminos de la vista (con filas, empty y truncado). Cifra **horneada con su fecha**. Idiom aprobado **"según fuente al …"**; **"captura" pelado ausente**; cero causalidad, cero intención — describe **el canal**, no a nadie; el parcial **nunca** se presenta como total | `components/lobby-menciones-de-boletin.test.tsx` → `describe("LobbyMencionesView — 5.12: cobertura parcial declarada")`, **5 casos** (presencia en los 3 caminos + orden leyenda→cobertura→conteo + cifra con fecha y sin "captura" + negative-match anti-causal); y `lib/anti-insinuacion-guard.test.ts` → `(1e) COBERTURA-122` | **aplicado** |

**Decisión adjudicada en 122-05: la cifra se HORNEA (con su fecha).** Derivarla en runtime exigiría
una **RPC pública nueva** = aguja completa (secdef PII-safe, `search_path=''`, bounded,
`statement_timeout`, doble-revoke, `PUBLIC_RPC_ALLOWLIST`) + pgTAP + apply — desproporcionado para
una línea de copy, y añadiría superficie SQL a una fase cuyo régimen es *cero apply*. La cifra **no
cambió** entre 92-04 (v9.0) y hoy (5.106 / 195 / 82 idénticos): el horneado no es frágil en la
práctica.

**Wave-0 del linter, ejecutada ANTES del copy** (commit `45cdac4`, anterior a `5c8f1a4`): declarar una
cifra de cobertura parcial abre la tentación de **editorializar el HUECO**. Decir "3,8 %" es un
HECHO; decir que es *"la punta del iceberg"*, una *"cifra negra"* o un *"subregistro"* **afirma un
número no observado y atribuye ocultamiento a la fuente**. Se añadió `TERMINOS_COBERTURA`
(6 términos, constante **nueva**, cero renames) + el caso `(1e) COBERTURA-122` + un mutation
self-check. **El detector MUERDE (demostrado, no afirmado):** quitando el spread, el self-check falla
(`1 failed | 41 passed`); restaurado → **42 passed**.

**Commits:** `45cdac4` (Wave-0 del linter) → `df6364d` (RED, 12 tests fallando) → `5c8f1a4` (GREEN).

**Estado de la suite y de los guards al cierre de 122-05:** `pnpm vitest run` → **1572 passed /
107 files**; `pnpm exec tsc --noEmit` → **exit 0**; **guards de régimen 11/11 verdes**
(anti-insinuación 42, lockdown 22, anti-flip VSIM/NOTIF/MONEY 20 c/u, bento 122, name-match-RUT 15,
env-example 16, integ-scope 3, provider-guard 3).

**LÍMITE A sigue vigente:** estos fixes **no están en producción**. `/parlamentario/S1338` seguirá
mostrando `0 reuniones` y `/proyecto/[boletin]` seguirá sin declarar su cobertura **hasta que la
Phase 125 despliegue**.

---

## Límites declarados

Declarados con evidencia, no descubiertos a posteriori. Los tres límites globales del método
(**A**: el nº deploy es PRE-fix · **B**: los bloques gated OFF no emiten DOM · **C**: cero
fabricación) están en §0.5 y **aplican íntegros a todo el artefacto**.

### L-1 — el contrato `RelacionesSection vacio` NO es observable en PROD

El plan pedía verificarlo con `S1338`; `S1338` tiene **4 de 5 ejes con datos**. La búsqueda
determinista de un sujeto con los 5 ejes en `total_n = 0` (`Q-15`) devuelve **0 filas**. El contrato
**no se declara verificado ni se declara roto** — se declara **no observable**, con la query que lo
demuestra. Lo que sí se verificó es el vacío honesto **por bloque** (`return null` con `total_n = 0`),
en dos casos independientes: filas **1.2** y **1.8**.

### L-2 — el eje de zona no es auditable en pares diputado-diputado

`Q-14`: los **155** diputados de PROD tienen `distrito` y `circunscripcion` en NULL. Para cualquier
par dip-dip el eje sólo puede rendir ausencia declarada. No es un defecto del cruce sino una brecha
de datos de la fuente Cámara (hallazgo 101-01, re-confirmado hoy en agregado). El eje se auditó
igualmente (filas 3.4 y 3.8).

### L-3 — tres emisores huérfanos no tienen "nº deploy"

`E-029 ResumenView`, `E-003 voto-ficha-row`, `E-008 actualidad-module` y el empty-state de `E-053`:
sus números **no llegan a ningún DOM** (§0.4). Los conteos SÍ se auditaron, en las superficies que
realmente los emiten. **La superficie no se borra del denominador: se declara.** Handoff: **catálogo
113** (atribución de emisor); sin acción de código.

### L-4 — el denominador honesto de lobby se apoya en una invariante de DATOS, no en una constraint

`estado_vinculo <> 'confirmado' ⇒ parlamentario_id is null` se **observó** (`Q-66`), no está declarado
en el schema. Si una ingesta futura llenara `parlamentario_id` en filas no confirmadas, el conteo de
`parlamentario-resumen-conteos.ts:312-326` **seguiría siendo honesto** (lee el RPC, que sólo emite
confirmadas), pero cualquier query nueva escrita "de memoria" contra `lobby_audiencia` sin el filtro
dejaría de serlo. La invariante está escrita **para que se re-verifique, no para que se asuma**.
Proponer una constraint es cambio de esquema ⇒ **Phase 124**.

### L-5 — `agrupacion_materia` no tiene "primeros principios" reproducible en SQL

Su materialización la hace el **CLI k-means**, fuera de `actualidad.materializar_senales()` (cuyo
`delete` está acotado a los 6 tipos temporales, 0065:111-113). Reproducir sus 10 clusters exigiría
re-correr k-means sobre `proyecto_embedding` — **cómputo, no una query**. Lo que **sí** se verificó
(`Q-65`) es la propiedad falsable disponible: **la suma de los clusters iguala exactamente el corpus
embebido** (`3100 = 3100`), es decir la partición no duplica ni pierde proyectos. Se declara el
límite en vez de fabricar una réplica del clustering.

### L-6 — `fecha_captura` no es observable en el DOM (y así debe ser)

El panel no expone `fecha_captura` por diseño (regla del reloj, 0065:26-28 — `fecha_captura` **jamás**
es un hecho legislativo). El rezago del materializado (fila 4-13) se adjudica por SQL contra el reloj
del rebuild, no contra el sitio. El `datos al {fecha}` que sí muestra el panel viene de `fecha_max`
(= la fecha del **hecho**), que es lo correcto.

### L-7 — dos bounds inactivos hoy que siguen siendo techos reales

- `actualidad_senales_panel` `limit 200`: con 19 filas (`Q-56`) no corta nada. Si `agrupacion_materia`
  creciera a >180 clusters, el panel **silenciaría** filas sin aviso (el componente no emite total).
- `lobby_menciones_de_boletin` `LIMIT 50`: el techo de PROD es 13 (`Q-71`), a 37 del límite.

Ninguno es defecto hoy y **no se tocan** (cambiarlos es SQL ⇒ **Phase 124** / verificación en **125**).

### L-8 — un `tipo_senal` con CERO filas sería invisible

`PanelActualidad` construye `tiposPresentes` filtrando `porTipo.has(t)` (`panel-actualidad.tsx:301`):
un tipo sin ninguna fila **no produciría tile**, ni siquiera vacío. La supresión-como-fila de 0065 lo
previene *por construcción*, y por eso hoy **no hay ninguna señal ocultada** — pero **la garantía vive
en SQL, no en el cliente**. Se declara; no se corrige aquí.

### L-9 — sustitución de regex declarada (encoding del shell)

Todas las queries de §6 escriben `bolet.n` donde 0063/92-04 escriben `bolet[ií]n`, y `SIN-CAMARA`
donde 0065 escribe `(sin cámara)`, por una limitación de encoding del shell de este entorno. La
primera es un **superset** estricto (sólo puede sobre-contar) y se contrastó con la variante ASCII
`bolet[ii]n` con resultado idéntico; la segunda cambia **sólo la etiqueta** del grupo NULL, jamás el
conteo ni el agrupamiento.

### L-10 — cobertura por muestreo, no exhaustiva, en los canales de lobby

Se auditaron 2 boletines de 82 con menciones (el canónico + el máximo) y 2 de los sondeados en
`lobby_en_tramitacion` (el canónico + el máximo del sondeo de 200). El ranking completo sí se computó
por SQL (`Q-68`, `Q-83`), pero sólo esos se leyeron contra el DOM: ampliar exigiría decenas de `curl`
al Worker propio — desproporcionado frente al régimen de "lectura del deploy con mesura" (§0.0).

### L-11 — cero fuentes gubernamentales

`leylobby.gob.cl`, `camara.cl`, `senado.cl` y BCN **no fueron consultados** en ningún momento. Todo
dato sale de PROD (ya ingerido) o del DOM del Worker propio.

### Fixes NO aplicados — su motivo y su handoff nombrado

Las **8** filas `discrepancia-declarada` **nacieron declaradas**: ninguna fue degradada por 122-05.
Se listan con su handoff para que 124/125 no las busquen en la tabla de fixes.

| fila | qué | por qué NO se corrigió en 122-05 | handoff |
|------|-----|---------------------------------|---------|
| **2.1 / 2.5 / 2.6** | cap `p_limit: 1000` en votos: `D1165` tiene **3.752**, el deploy muestra **1.000** en chip, `<h2>` y `Ver detalle`. Agravante: la RPC ordena `by fecha desc` ⇒ **también distorsiona la composición** (mostrado 469/466/22/16/27 vs real 1764/1772/171/16/29; asistencia 99,2 % → 97,3 %) | El número correcto **no existe** en la respuesta actual: exige un **RPC de conteo dedicado** (aguja completa). Y la **sincronía obligatoria** manda: `parlamentario-resumen-conteos.ts:271-278` es espejo byte-a-byte del cap de `VotosSection` — cambiar un solo lado **desincroniza** chip y sección; tocar ambos sin el dato honesto sólo movería la mentira de sitio | **Phase 124 (SUPA-FIX)** — requiere SQL nuevo. **No se escribió `0073`**: el diseño de la RPC de conteo es de 124 |
| **3.3** | co-autoría en `/comparar` truncada a 20: el SQL determina `0` compartidos, el deploy declara indeterminación | Es la **disciplina fail-closed CR-01 deliberada** — una ausencia falsa con atribución de fuente es el riesgo #1 del proyecto. El fix exigiría **rediseñar la RPC** para emitir membresía de par | **Phase 124** (rediseño de RPC) |
| **3.b-9** | empty-state muerto de **E-053** (`cruces-de-parlamentario.tsx:128-139`) | Hallazgo de **catálogo / atribución de emisor**, prioridad baja. No altera ningún conteo mostrado. Mismo caso que los empty-states inalcanzables de E-002: **código defensivo, no bug de datos** | **catálogo 113**; sin acción de código |
| **4-14** | tile *Por materia* agrupa **3.100 / 3.675 (84,4 %)** sin declarar la cobertura | El fix exige un **denominador que la RPC no emite**: es **SQL, no sólo copy**. Los números cuadran — es cobertura no declarada, no un número falso | **Phase 124** (denominador en la RPC) → copy en **125** |
| **4-15** | dos grafías de cámara en la landing (`Senado`/`C.Diputados` normalizadas vs `senado`/`camara` crudas de agenda) | El fix correcto es el **materializador 0065** (defecto D2, `0065:233,261` emiten la columna cruda), **no** maquillar en el cliente: normalizar en el componente escondería el defecto de origen | **Phase 124** (corrección en 0065) |
| **5.5** | rama `LIMIT 50` de lobby no observable: `max(total_n) = 13` sobre los 82 boletines | **No hay discrepancia que corregir** — es una rama de código sin ningún caso real que la ejerza. Por inspección estática `:214` lee `total_n`, no `mostradas`, y es correcta | **Phase 125** (verificación post-deploy si algún boletín superara 50); sin acción de código |

**Adjudicaciones cerradas (no son deuda):**

- **Lead VSIM `(100%)` sobre `3655/3672`** → **`cuadra`** (§3.5). `Math.round(99,537) = 100`; cifra
  firmada en el dossier VSIM §43 y ya adjudicada por 104-03. Cambiarla sería Rule 4 (decisión legal).
- **Denominador de lobby** → honesto **de facto** hoy (112 = 112 = 112) y honesto **por construcción**
  (`Q-66`). Riesgo latente declarado en **L-4**.

---

## Cobertura × inventario 113

Barrido **determinista** de las **60** filas del catálogo §3.0 de `113-INVENTARIO.md` (`E-001`…`E-060`),
una por una. **Criterio de clasificación, escrito ANTES de la tabla:**

- **`sí` (emite cruce/conteo)** = emite un número derivado de **más de una entidad**, o un **N/M**, o
  una **cobertura**. **DEBE** estar auditado en §2–§7. Si no lo estaba: **HUECO** → se cerró aquí con
  el método completo (SQL + primeros principios + DOM).
- **`no` (no emite cruce)** = link, fecha, chrome, primitiva de UI, fila individual, o componente
  presentacional cuyo número lo pone su llamante (ya auditado ahí). **Fuera del alcance de 122**, se
  marca así con su motivo.
- **`gated OFF` / `huérfano`** = fuera del **denominador observable**; **DECLARADO con su motivo**,
  nunca omitido en silencio.

**Resumen del barrido:** 15 emisores emiten cruce/conteo y **los 15 están auditados** · 34 no emiten
cruce · 8 gated OFF (MONEY/NOTIF) · 3 huérfanos. **Huecos abiertos: 0** (los 6 detectados se cerraron
en esta consolidación: filas `H-1`…`H-6`).

| emisor (E-NNN) | archivo | ¿emite un cruce/conteo? | ¿auditado en 122? | sección | motivo si NO |
|----------------|---------|-------------------------|-------------------|---------|--------------|
| E-001 | `votos-por-parlamentario.tsx` | **sí** — `Presente en N de M · Ausente en K`, desglose y % de asistencia | **sí** | §2.4 (2.5, 2.6, 2.11) | — |
| E-002 | `lobby-de-parlamentario.tsx` | **sí** — conteo neutro de audiencias | **sí** | §6.3 (5.8) | — |
| E-003 | `voto-ficha-row.tsx` | — | **no** (fuera del denominador observable) | §0.4, L-3 | **huérfano**: cero call-sites non-test ⇒ sus números no llegan a ningún DOM |
| E-004 | `app/agenda/page.tsx` | **sí** — cobertura de la agenda (`164` citaciones en `9` semanas) | **sí** — *hueco cerrado en 122-06* | §7 (H-6) | — |
| E-005 | `patrimonio-de-parlamentario.tsx` | **sí** — conteo de declaraciones (carril + paginación) | **sí** | §2.4 (2.3, 2.9) vía `RPC:declaraciones_de_parlamentario` | — |
| E-006 | `app/layout.tsx` | no | n/a | — | chrome (CC BY, `/metodologia`, `/sobre`, `mailto:`); no emite fechas ni conteos |
| E-007 | `week-nav.tsx` | no | n/a | — | navegación: deriva la semana ISO de la URL, no de la DB |
| E-008 | `actualidad-module.tsx` | — | **no** (fuera del denominador observable) | §0.4, L-3 | **huérfano**: superseded por `panel-actualidad.tsx` (E-055), que **sí** se auditó (§5) |
| E-009 | `app/sobre/page.tsx` | no | n/a | — | copy estático + links |
| E-010 | `timeline-view.tsx` | no | n/a | — | timeline de eventos: fechas y hrefs de urgencia, sin número cruzado |
| E-011 | `red/red-graph.tsx` | **sí** — `N vecinos · M hechos documentados` | **sí** — *hueco cerrado en 122-06* | §2.5 (H-1, H-2) | — |
| E-012 | `parlamentario-directory-row.tsx` | no | n/a | — | fila de directorio: link + chip; el conteo del roster no lo emite ella |
| E-013 | `financiamiento-de-parlamentario.tsx` | sí (aportes) | **no** — gate **MONEY OFF** | LÍMITE B; chip `pendiente` verificado en §2.4.4 | `no emitido en el deploy auditado`: el gate impide todo DOM |
| E-014 | `contratos-por-contraparte.tsx` | sí (contratos por contraparte) | **no** — gate **MONEY OFF** | LÍMITE B | ruta `/contraparte/[id]` responde **404** entera (`page.tsx:50-52`) |
| E-015 | `contratos-de-parlamentario.tsx` | sí (contratos) | **no** — gate **MONEY OFF** | LÍMITE B | `no emitido en el deploy auditado` |
| E-016 | `aportes-por-contraparte.tsx` | sí (aportes por contraparte) | **no** — gate **MONEY OFF** | LÍMITE B | ruta 404 entera |
| E-017 | `app/buscar/page.tsx` | **sí** — `Busca sobre N proyectos de ley` (cobertura del corpus) | **sí** — *hueco cerrado en 122-06* | §7 (H-5) | — |
| E-018 | `sala-table-section.tsx` | no | n/a | — | tabla de sala: ítems y links a PDF; no emite conteo derivado |
| E-019 | `partido-chip.tsx` | no | n/a | — | chip presentacional (militancia vigente + badge); cero conteos |
| E-020 | `lobby-menciones-de-boletin.tsx` | **sí** — `total_n` de audiencias que mencionan el boletín | **sí** | §6.2 (5.1–5.5) y §6.4 (5.12, 5.13) | — |
| E-021 | `header-nav.tsx` | no | n/a | — | chrome de navegación |
| E-022 | `cross-links-parlamentario.tsx` | **sí** — los 5 conteos de relaciones (`total_n`) | **sí** | §2.1 y §2.2 (1.1–1.10) | — |
| E-023 | `app/proyecto/[boletin]/not-found.tsx` | no | n/a | — | copy estático 404 |
| E-024 | `app/page.tsx` | no | n/a | — | host de la landing; los conteos del panel los pone E-055 (auditado §5) |
| E-025 | `app/metodologia/page.tsx` | no | n/a | — | copy estático + links |
| E-026 | `voto-row.tsx` | no | n/a | — | fila de un voto individual; sin agregación |
| E-027 | `validacion-fuente.tsx` | no | n/a | — | construye links a Senado/Cámara; cero números derivados |
| E-028 | `search-result-card.tsx` | no | n/a | — | **JSDoc §5 LOCKED**: *"NUNCA score/cosine/rank/número de similitud"* — verificado por grep; el resultado no emite cifra |
| E-029 | `parlamentario-resumen.tsx` | sí (chips `Presente en N de M`) | **no** (fuera del denominador observable) — pero **sus conteos SÍ se auditaron** | §2.4.0, §2.4.1, L-3 | **huérfano**: `ResumenView` sin call-site. Los mismos conteos se auditaron en sus emisores reales (rail, `CarrilHeader`, disclosure, asistencia, capa-1) |
| E-030 | `mencion-boletin-chip.tsx` | no | n/a | — | chip con link a `/proyecto/{boletin}` |
| E-031 | `global-header.tsx` | no | n/a | — | chrome |
| E-032 | `estado-actual-block.tsx` | no | n/a | — | estado de tramitación + fechas; sin número cruzado |
| E-033 | `citacion-card.tsx` | no | n/a | — | tarjeta de citación (props); el agregado de agenda lo emite E-004 |
| E-034 | `breadcrumbs.tsx` | no | n/a | — | chrome de navegación |
| E-035 | `autor-row.tsx` | no | n/a | — | fila de autoría individual; el agregado lo emite E-022/E-051 |
| E-036 | `app/parlamentario/[id]/page.tsx` | **sí** — `CarrilHeader conteo=` y `construirChips` (host de todos los conteos de la ficha) | **sí** | §2.4 (2.1–2.11), §4.3 | — |
| E-037 | `ui/button.tsx` | no | n/a | — | primitiva de UI (`asChild`) |
| E-038 | `timeline-event.tsx` | no | n/a | — | evento individual + link externo |
| E-039 | `seguir-button.tsx` | sí (suscripciones) | **no** — gate **NOTIF OFF** | LÍMITE B | feature inerte: `/cuenta` responde 200 pero declara la indisponibilidad |
| E-040 | `provenance-badge.tsx` | no | n/a | — | chokepoint de fecha + link externo; su fecha es materia de la Phase 117, no un cruce |
| E-041 | `lobby-en-tramitacion.tsx` | **sí** — total dedup + conteo por semana | **sí** — *hueco cerrado en 122-06* | §6.5 (H-3, H-4) | — |
| E-042 | `ficha-rail.tsx` | **sí** — los chips con conteo del rail | **sí** | §2.4.0 y §2.4.1 (mismo `construirChips`) | — |
| E-043 | `ficha-header.tsx` | no | n/a | — | header del proyecto + link a Cámara |
| E-044 | `cruces-de-proyecto.tsx` | **sí** — `N parlamentarios` / `Explorar los N cruces` | **sí** | §4.2 (3.a-1…3.a-6) | — |
| E-045 | `capa1/tramitacion-stepper.tsx` | no | n/a | — | stepper de etapas + fechas |
| E-046 | `bento/bento-tile.tsx` | no | n/a | — | presentacional: el número y el href se los pasa el llamante (E-055, auditado §5) |
| E-047 | `app/red/not-found.tsx` | no | n/a | — | copy estático 404 (gate NET) |
| E-048 | `app/proyecto/[boletin]/page.tsx` | no | n/a | — | host de la ficha de proyecto: badge y datos; los conteos los emiten E-044/E-020/E-041 (auditados) |
| E-049 | `app/parlamentario/[id]/not-found.tsx` | no | n/a | — | copy estático 404 |
| E-050 | `app/contraparte/[id]/not-found.tsx` | no | **no** — gate **MONEY OFF** | LÍMITE B | sub-superficie de una ruta 404 entera |
| E-051 | `app/comparar/page.tsx` | **sí** — los 4 ejes + columnas `total_n` + el `%` VSIM | **sí** | §3 (3.1–3.8, 4.1–4.3) | — |
| E-052 | `app/cuenta/page.tsx` | sí (suscripciones/consentimientos) | **no** — gate **NOTIF OFF** | LÍMITE B | ruta viva pero feature inerte; no emite superficie útil |
| E-053 | `cruces-de-parlamentario.tsx` | **sí** — encabezados de señal por sector | **sí** | §4.3 (3.b-3, 3.b-9) | — |
| E-054 | `militancias-de-parlamentario.tsx` | no | n/a | — | lista de militancias con fechas; el cruce entre parlamentarios lo emite E-022/E-051 |
| E-055 | `panel-actualidad.tsx` | **sí** — los conteos de las 7 señales | **sí** | §5 (4-0…4-15) | — |
| E-056 | `votacion-card.tsx` | no | n/a | — | tarjeta de una votación; delega links a E-027 |
| E-057 | `comisiones-de-parlamentario.tsx` | no | n/a | — | lista de comisiones; la **intersección** (el cruce) la computa y emite E-051 (auditado, filas 3.2/3.6) |
| E-058 | `idea-matriz-block.tsx` | no | n/a | — | bloque de texto de idea matriz |
| E-059 | `parlamentario-header.tsx` | no | n/a | — | header de ficha; delega a E-034/E-019 |
| E-060 | `app/contraparte/[id]/page.tsx` | sí (agregado por contraparte) | **no** — gate **MONEY OFF** | LÍMITE B | ruta 404 entera (`page.tsx:50-52`) |

**Cero filas con `¿auditado en 122?` = NO sin motivo escrito.** Los 11 `no` corresponden a
**8 gated OFF** (declarados por LÍMITE B, con su evidencia de gate en §1.2) y **3 huérfanos**
(declarados en §0.4 y L-3, con el grep que prueba la ausencia de call-site). Ninguno se cerró con un
"no aplica" pelado.

---

## Veredicto de la fase

**Cruces auditados: 82 filas de veredicto.**

| veredicto | filas | % |
|-----------|------:|--:|
| `cuadra` | **72** | 87,8 % |
| `discrepancia-corregida` | **2** | 2,4 % |
| `discrepancia-declarada` | **8** | 9,8 % |
| **total** | **82** | 100 % |

**Desglose por sección (la suma cierra):**

| sección | filas | `cuadra` | `corregida` | `declarada` |
|---------|------:|---------:|------------:|------------:|
| §2 — relaciones + conteos del resumen (+ `/red`) | 23 | 20 | 0 | 3 (2.1, 2.5, 2.6) |
| §3 — `/comparar` + VSIM | 11 | 10 | 0 | 1 (3.3) |
| §4 — cruces de ficha y de proyecto | 15 | 14 | 0 | 1 (3.b-9) |
| §5 — panel de actualidad | 16 | 14 | 0 | 2 (4-14, 4-15) |
| §6 — lobby↔PL (+ `lobby_en_tramitacion`) | 15 | 12 | 2 (5.11, 5.12) | 1 (5.5) |
| §7 — coberturas de `/buscar` y `/agenda` | 2 | 2 | 0 | 0 |
| **total** | **82** | **72** | **2** | **8** |

*(Los 76 originales de los fragmentos 01/02/03 —32 + 31 + 13— más las **6** filas `H-1`…`H-6` que
cerraron los huecos detectados por el barrido de cobertura.)*

**Cobertura del universo:** los **6 grupos** del §0.3 tienen filas; **ningún grupo quedó sin
auditar**; los **60** emisores del inventario 113 fueron barridos uno por uno y **no queda ningún
hueco abierto**. Por eso el front-matter dice `estado: validado`.

### Qué queda pendiente de observar sobre el deploy real (Phase 125)

Los fixes de UI de esta fase **no se despliegan aquí** (LÍMITE A). La Phase 125 debe, **sobre el
deploy final**:

1. **Desplegar** — es el único modo de que los 2 fixes lleguen a producción.
2. **Re-verificar contra el DOM desplegado**, con el patrón tolerante a `<!-- -->` (HALLAZGO B):
   - `/parlamentario/S1338` → la capa-1 de `<section id="lobby">` **no** debe emitir ningún dígito, y
     el encabezado debe seguir en `—` (fila 5.11).
   - `/parlamentario/D1165` → **sigue** mostrando `112 reuniones` (control de no-regresión: es un
     `dato`; el fix no debe tocarlo).
   - `/proyecto/14309-04` y `/proyecto/16849-12` → la línea de cobertura debe aparecer **antes** del
     conteo, con `3,8 %` y `29 jul 2026` (fila 5.12).
3. **Re-ejecutar `Q-74`** para confirmar que la cifra horneada sigue vigente; si cambió, actualizar
   **cifra y fecha juntas** en `COBERTURA_MENCIONES_LOBBY`.
4. **Re-correr las 82 filas** de este artefacto sobre el deploy final: cada una trae su query y su
   número, de modo que 125 **no tiene que volver a decidir qué auditar ni con qué query**. Las 72
   `cuadra` son controles de no-regresión; las 8 `discrepancia-declarada` deben **seguir declaradas**
   (ninguna se corrigió) salvo que la Phase 124 haya aterrizado el SQL correspondiente.
5. **Vigilar la fila 5.5** (rama `LIMIT 50` de lobby): si algún boletín superase 50 menciones, la rama
   pasa a ser observable y debe verificarse entonces.

**Lo que este artefacto NO afirma:** que el sitio esté libre de errores. Afirma que **82 números
visibles fueron recalculados contra PROD y contra el DOM**, que **2** divergencias se corrigieron con
test de respaldo, que **8** quedan declaradas con ambos números y su handoff nombrado, y que **cero**
números de este documento son estimados, recordados o fabricados.

---

## Procedencia

| fragmento | qué aportó | filas |
|-----------|------------|------:|
| `122-CRUCES-SQL-00-METODO.md` | método, vocabulario, plantilla, universo, sujetos, gates | — |
| `122-CRUCES-SQL-01-RELACIONES-COMPARAR.md` | §2 (sin `H-1`/`H-2`) y §3 | 32 |
| `122-CRUCES-SQL-02-CRUCES-ACTUALIDAD.md` | §4 y §5 | 31 |
| `122-CRUCES-SQL-03-LOBBY.md` | §6 (sin `H-3`/`H-4`) y Vacíos honestos | 13 |
| `122-CRUCES-SQL-04-FIXES.md` | Fixes aplicados; **manda sobre los anteriores** ante contradicción | — |
| **este plan (122-06)** | consolidación, renumeración global, barrido de cobertura y **cierre de 6 huecos** (`H-1`…`H-6`) | 6 |

Los fragmentos **no se borran**: quedan en el directorio de la fase como evidencia de la corrida.

