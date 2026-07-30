---
fase: 122
fragmento: 03-lobby
estado: borrador
fecha: 2026-07-29
ancla_temporal: "2026-07-29 (select now()::date contra PROD; TimeZone de sesión = UTC)"
grupos: [5, 6]
produce: "Grupos 5 (lobby↔PL) y 6 (lobby_sector_aporte = 0 filas honestas)"
consumido_por: [122-05, 122-06]
metodo_ref: "122-CRUCES-SQL-00-METODO.md"
---

# 122 — CRUCES × SQL · Fragmento 03: lobby ↔ proyecto de ley + vacíos honestos

> Fragmento de auditoría de los **Grupos 5 y 6** del universo cerrado de
> `122-CRUCES-SQL-00-METODO.md §0.3`. Método, régimen, plantilla de fila y vocabulario de veredicto
> (`cuadra` / `discrepancia-corregida` / `discrepancia-declarada`) son los del fragmento 00 y **no se
> redefinen aquí**.
>
> **Régimen:** read-only. Cero DDL/DML, cero deploy, cero flags tocados, **cero fixes de código**
> (los fixes son 122-05; el deploy viaja con la Phase 125). Cero requests a fuentes gubernamentales:
> las únicas lecturas de red son `curl` al Worker propio.
>
> **PII:** este fragmento audita `lobby_audiencia`, la tabla con datos de **terceros** más sensible
> del alcance. Todo lo que sigue son **agregados** y **nombres de columna**. Cero `rut`, cero email,
> cero `contraparte_id`, cero nombres de contrapartes individuales, cero materias verbatim.

**Ancla temporal:** todos los números SQL de este fragmento son al **2026-07-29** (`TimeZone` de
sesión `UTC`), re-verificada al inicio de la corrida:

```bash
set -a; source .env; set +a
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "select now()::date, current_setting('TimeZone');"
# → 2026-07-29|UTC
```

**Deploy leído:** `https://observatorio-congreso.thevalis.workers.dev` (SSR). Es el mismo deploy
**pre-fix** del LÍMITE A de 00 §0.5: todo `nº deploy` de este fragmento es el del código
actualmente desplegado.

---

## 0. Universo de lobby en PROD (línea base del denominador)

Antes de cualquier fila: el denominador contra el que se leen todos los números de abajo.

**`Q-L00` — distribución de `estado_vinculo` y su acoplamiento con `parlamentario_id`:**

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

**`Q-L00b` — universo de parlamentarios alcanzados por lobby confirmado:**

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

| magnitud | nº observado 2026-07-29 |
|----------|------------------------:|
| `lobby_audiencia` — filas totales | 17.762 |
| `estado_vinculo='confirmado'` | **5.106** |
| `estado_vinculo='no_confirmado'` | 12.656 |
| audiencias no confirmadas **con** `parlamentario_id` | **0** |
| parlamentarios distintos con ≥1 confirmada | 136 |
| … de cámara `senado` | **0** |
| filas en `lobby_ingesta_estado` | 136 |

**Hallazgo estructural del denominador honesto (Q-L00):** las 12.656 audiencias `no_confirmado`
tienen `parlamentario_id` **NULL** en el 100 % de los casos. Por construcción, **ninguna audiencia no
confirmada puede atribuirse a un parlamentario**: el denominador de cualquier ficha es honesto *por
imposibilidad de lo contrario*, no por un filtro que alguien recordó escribir. Esto se verifica por
sujeto en §2 (columnas CON y SIN filtro) y es lo que hace que ambos conteos coincidan.

**Consecuencia para `S1338`:** `lobby_audiencia.parlamentario_id` confirmado es **hoy exclusivo de
diputados** (136 de 136). El cero de `S1338` no es wiring roto — es la cobertura real de la fuente.

---

## 1. Menciones de lobby por boletín (Grupo 5, emisor E-020)

Superficie `/proyecto/[boletin]`, sección `Audiencias de lobby que mencionan este boletín`.
Emisor `app/components/lobby-menciones-de-boletin.tsx` — el `total_n` auditado se emite en
`:212-214` (`const mostradas` / `const total = rows[0]?.total_n ?? mostradas` / `const truncado`) y
se renderiza en `:216-228`. La llamada RPC está en `:248-250`.
Origen: `RPC:lobby_menciones_de_boletin` (0062, corregida por **0063** a una fila por audiencia con
`total_n = count(*) over ()` sobre audiencias distintas; `LIMIT 50`).

### 1.1 Sujetos

| sujeto | por qué |
|--------|---------|
| `14309-04` | boletín bicameral de 113 §1.3 / 122-00 §1, el mismo que usó el pgTAP real de 92-04 |
| `16849-12` | boletín con **mayor `total_n`** de menciones en PROD hoy (`Q-L01`) |

**`Q-L01` — selección del boletín con mayor `total_n` (desempate estable por `boletin asc`):**

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
> (`ERROR: invalid byte sequence for encoding "UTF8"`), así que todas las queries de este fragmento
> escriben `bolet.n` — el `.` de regex casa **cualquier** carácter y por lo tanto es un **superset**
> estricto de `[ií]`. Un superset solo puede **sobre**-contar, nunca sub-contar: si los números
> cuadran con la RPC (y cuadran, §1.2), la sustitución no introdujo diferencia. Verificado además
> re-corriendo §1.2 con la variante ASCII estricta `bolet[ii]n` — **mismo resultado**.

**Correspondencia con 92-04:** este ranking reproduce **exactamente** el top del runbook de la
Phase 92 (`16849-12` 13, `16374-07` 12, `17064-08` 9, `15975-25` 9, `17337-07` 8, `14985-34` 8),
con el mismo orden por conteo. Sin deriva.

### 1.2 Doble lectura: RPC vs primeros principios

**`Q-L02` — la RPC que el sitio invoca, por psql:**

```sql
select count(*) || '|' || coalesce(max(total_n),0)
from public.lobby_menciones_de_boletin('<boletin>');
-- observado 2026-07-29:
--   14309-04 →  1|1     (filas devueltas | total_n)
--   16849-12 → 13|13
```

**`Q-L03` — primeros principios: el fail-closed doble de 0062/0063 reconstruido a mano sobre
`lobby_audiencia`, SIN invocar la RPC** (regex de mención + existencia en `proyecto` +
`estado_vinculo='confirmado'` + `parlamentario_id is not null`):

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

### 1.3 Lectura del DOM del deploy

Patrón **tolerante a los separadores `<!-- -->` de React** (HALLAZGO B de 122-00 §2.3) —
un grep del literal armado devolvería 0 matches y se leería, falsamente, como "el sitio no emite el
número":

```bash
curl -s "https://observatorio-congreso.thevalis.workers.dev/proyecto/<boletin>" -o /tmp/p.html
grep -o -E ".{0,120}mencionan?.{0,160}" /tmp/p.html
```

Salidas observadas (HTML server-rendered, recortadas al conteo):

```html
<!-- /proyecto/14309-04 -->
<p class="text-base leading-relaxed"><span class="font-mono">1</span> <!-- -->audiencia registrada menciona<!-- --> <!-- -->este boletín.</p>

<!-- /proyecto/16849-12 -->
<p class="text-base leading-relaxed"><span class="font-mono">13</span> <!-- -->audiencias registradas mencionan<!-- --> <!-- -->este boletín.</p>
```

### 1.4 Tabla de veredictos (Grupo 5 · menciones por boletín)

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| 5.1 | `/proyecto/14309-04` | `app/components/lobby-menciones-de-boletin.tsx:212-228` (E-020) | `RPC:lobby_menciones_de_boletin` | `Q-L02` | `1` | `1` | `cuadra` |
| 5.2 | `/proyecto/14309-04` | idem (contra-lectura de primeros principios) | `lobby_audiencia.identificador` | `Q-L03` | `1` | `1` | `cuadra` |
| 5.3 | `/proyecto/16849-12` | `app/components/lobby-menciones-de-boletin.tsx:212-228` (E-020) | `RPC:lobby_menciones_de_boletin` | `Q-L02` | `13` | `13` | `cuadra` |
| 5.4 | `/proyecto/16849-12` | idem (contra-lectura de primeros principios) | `lobby_audiencia.identificador` | `Q-L03` | `13` | `13` | `cuadra` |

**RPC ≡ primeros principios en ambos sujetos.** La doble lectura obligatoria no reveló divergencia:
la RPC 0063 implementa lo que declara implementar.

### 1.5 La rama `mostradas < total_n` NO es observable hoy — límite declarado

El plan exige verificar que, cuando `mostradas < total_n`, el sitio muestre `total_n` y no las 50
filas. **Esa rama no se puede observar en PROD hoy**, y se declara en vez de fabricarse:

**`Q-L04` — máximo `total_n` alcanzable sobre TODO el universo de boletines mencionados:**

```sql
-- (mismo prefijo de Q-L01 hasta la CTE `bol`)
select max(coalesce(t.n,0)) as max_total_n, count(*) as boletines_evaluados
from bol b
left join lateral (select max(m.total_n) n from public.lobby_menciones_de_boletin(b.boletin) m) t on true;
-- derivado de la salida completa de Q-L01 observada 2026-07-29: max_total_n = 13, boletines = 82
```

| # | superficie (ruta) | emisor (archivo:línea) | origen | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|--------|----------------|--------|-----------|-----------|
| 5.5 | `/proyecto/[boletin]` — rama truncada | `app/components/lobby-menciones-de-boletin.tsx:214-221` | `RPC:lobby_menciones_de_boletin` (`LIMIT 50`) | `Q-L04` | `max(total_n) = 13` sobre **82** boletines ⇒ `truncado` es `false` en el 100 % de PROD | `no observable: ningún boletín supera el LIMIT 50 en el deploy auditado` | `discrepancia-declarada` |

**Por qué no se corrige:** no hay discrepancia que corregir — hay una **rama de código sin ningún
caso real** que la ejerza. El techo actual (13) está a 37 audiencias del `LIMIT 50`. Se declara como
límite del método (LÍMITE C de 00 §0.5, "cero fabricación"): afirmar `cuadra` sobre una rama que el
deploy nunca ejecuta sería un `cuadra` sin evidencia, y la regla dura anti-"todo bien" de 00 §0.1 lo
prohíbe. La lógica de `:214` (`const truncado = total > mostradas`) **lee `total_n`, no
`mostradas`**, y por inspección estática es correcta — pero eso es una lectura de código, no una
observación del DOM, y este fragmento no las confunde.

---

## 2. Lobby en la ficha del parlamentario (Grupo 5, emisor E-002)

Superficie `/parlamentario/[id]`, sección `<section id="lobby">`.
Emisores: `app/components/lobby-de-parlamentario.tsx` (E-002; conteo neutro en `:409-412`) y
`app/components/capa1/lobby-capa1.tsx:31-34` (capa-1), con el rótulo del carril en
`app/app/parlamentario/[id]/page.tsx:611-614` (`conteoLabel`, definido en `:89-100`).
Origen: `RPC:lobby_de_parlamentario` + marcador `lobby_ingesta_estado`.

### 2.1 Denominador honesto — CON y SIN `estado_vinculo='confirmado'`

**`Q-L05` — el corazón de este fragmento. Ambos conteos, lado a lado, más el marcador de ingesta:**

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

| sujeto | CON `estado_vinculo='confirmado'` | SIN el filtro | ¿difieren? | marcador `lobby_ingesta_estado` |
|--------|----------------------------------:|--------------:|:----------:|:-------------------------------:|
| `D1165` | **112** | **112** | **no** | presente (1 fila) |
| `S1338` | **0** | **0** | **no** | **ausente** (0 filas) |

**Veredicto del denominador honesto: no hay nada que corregir, y la razón es estructural.** Los
conteos CON y SIN filtro coinciden porque las 12.656 audiencias `no_confirmado` tienen
`parlamentario_id` NULL (`Q-L00`) — el `where parlamentario_id = p.id` ya las excluye antes de que el
filtro de `estado_vinculo` opine. El número mostrado por el sitio **no** corresponde al conteo sin
filtrar en ningún sentido observable, porque ambos son el mismo número. Queda registrado con ambas
columnas, como exige el plan, para que la afirmación sea auditable y no una promesa.

> **Advertencia para 122-05 / 125 (fragilidad, no defecto):** esta coincidencia depende de una
> **invariante de datos** (`estado_vinculo <> 'confirmado' ⇒ parlamentario_id is null`), no de una
> constraint declarada en el schema. Si una ingesta futura llenara `parlamentario_id` en filas no
> confirmadas, el conteo de `parlamentario-resumen-conteos.ts:312-326` **seguiría siendo honesto**
> (lee el RPC `lobby_de_parlamentario`, que sólo emite confirmadas), pero cualquier query nueva
> escrita "de memoria" contra `lobby_audiencia` sin el filtro dejaría de serlo. La invariante está
> aquí escrita para que se re-verifique, no para que se asuma.

**`Q-L06` — la RPC que el sitio invoca, por psql (el conteo de la UI es `count(distinct identificador)`
sobre estas filas, `parlamentario-resumen-conteos.ts:326`):**

```sql
select count(distinct identificador), count(*) from public.lobby_de_parlamentario('D1165');  -- 112|112
select count(distinct identificador), count(*) from public.lobby_de_parlamentario('S1338');  --   0|0
```

### 2.2 Lectura del DOM

```bash
curl -s "https://observatorio-congreso.thevalis.workers.dev/parlamentario/D1165" -o /tmp/f.html
grep -o -E '<section id="lobby" class="mt-12">.{0,700}' /tmp/f.html | sed 's/<[^>]*>/ | /g'
grep -o -E '"children":\[112," ","reuniones registradas"' /tmp/f.html
```

Observado en `/parlamentario/D1165`:

| bloque | archivo:línea | valor en el DOM |
|--------|---------------|-----------------|
| rótulo del carril (`CarrilHeader`) | `page.tsx:611-613` → `conteoLabel` `:92` | `112` |
| chip del rail lateral | `page.tsx:113` | `"count":"112"` |
| capa-1 (`LobbyCapa1`) | `capa1/lobby-capa1.tsx:32-33` | `112 reuniones` |
| conteo neutro de `LobbySection` | `lobby-de-parlamentario.tsx:410-411` | `112 reuniones registradas.` |

Observado en `/parlamentario/S1338`:

| bloque | valor en el DOM | comentario |
|--------|-----------------|------------|
| rótulo del carril + chip del rail | `—` | `conteoLabel` de `no_ingerido` (`page.tsx:96`) |
| capa-1 (`LobbyCapa1`) | **`0 reuniones`** | ⚠ ver §2.4 |
| `LobbySection` (E-002) completa | **ausente del HTML** | `page.tsx:619` la monta sólo si `conteos.lobby.tipo === "dato"` |
| línea de degradación de capa-1 | `Aún no hay materias publicadas en las fuentes consultadas.` | |

Verificación de la ausencia de E-002 en `S1338` (los tres literales LOCKED de
`lobby-de-parlamentario.tsx` — intro `:341-344`, caveat `:314-316`, toggle `:272`):

```bash
for P in D1165 S1338; do
  grep -c "Audiencias registradas bajo la Ley del Lobby" f_$P.html
  grep -c "su identidad" f_$P.html
  grep -c "Agrupar por contraparte" f_$P.html
done
# D1165 → 1 / 1 / 1        S1338 → 0 / 0 / 0
```

⇒ Los empty-states (a) `no ingestado` (`:348-370`) y (b) `ingestado, cero` (`:373-394`) de E-002
**son código inalcanzable en la superficie desplegada**: el gate `tipo === "dato"` de `page.tsx:619`
los cortocircuita siempre. Se registra en §4 como cero honesto con matiz, no como bug de datos.

### 2.3 Estado 3-valores de `S1338` vs el marcador observado

| pregunta | respuesta observada |
|----------|---------------------|
| ¿qué estado 3-valores emite el sitio? | **`no_ingerido`** — el rótulo es `—`, que `conteoLabel` (`page.tsx:95-96`) emite **sólo** para `no_ingerido` (`vacio` emitiría `sin registros`) |
| ¿corresponde al marcador `lobby_ingesta_estado`? | **sí**: `Q-L05` → 0 filas para `S1338`. Con `total=0` + marcador ausente, `derivarEstado` (`parlamentario-resumen-conteos.ts:228-238`) devuelve `no_ingerido`. Correcto |
| contraste de control | el mismo `conteoLabel` emite `sin registros` para el carril `cruces` de `S1338` en la misma página (`"count":"sin registros"`) — el 3-estado **sí** discrimina, no está colapsado |

### 2.4 Tabla de veredictos (Grupo 5 · ficha del parlamentario)

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| 5.6 | `/parlamentario/D1165` | `app/app/parlamentario/[id]/page.tsx:611-613` (`conteoLabel`) | `RPC:lobby_de_parlamentario` | `Q-L05`, `Q-L06` | `112` | `112` | `cuadra` |
| 5.7 | `/parlamentario/D1165` | `app/components/capa1/lobby-capa1.tsx:32-33` | `RPC:lobby_de_parlamentario` | `Q-L06` | `112` | `112` | `cuadra` |
| 5.8 | `/parlamentario/D1165` | `app/components/lobby-de-parlamentario.tsx:410-411` (E-002) | `RPC:lobby_de_parlamentario` | `Q-L06` | `112` | `112` | `cuadra` |
| 5.9 | `/parlamentario/D1165` — **denominador honesto** | `app/lib/parlamentario-resumen-conteos.ts:312-332` | `lobby_audiencia.estado_vinculo` | `Q-L05` | CON filtro `112` · SIN filtro `112` | `112` | `cuadra` |
| 5.10 | `/parlamentario/S1338` — rótulo del carril | `app/app/parlamentario/[id]/page.tsx:95-96` | `lobby_ingesta_estado.parlamentario_id` | `Q-L05` | `0` audiencias + `0` filas de marcador ⇒ `no_ingerido` | `—` | `cuadra` |
| 5.11 | `/parlamentario/S1338` — **capa-1** | `app/app/parlamentario/[id]/page.tsx:617` + `capa1/lobby-capa1.tsx:32-33` | `lobby_ingesta_estado.parlamentario_id` | `Q-L05` | estado real = `no_ingerido` (no cuantificable) | **`0 reuniones`** | **`discrepancia-corregida`** |

#### Fila 5.11 — el hallazgo de este fragmento

`page.tsx:617` pasa a `LobbyCapa1`:

```tsx
total={conteos.lobby.tipo === "dato" ? conteos.lobby.n : 0}
```

Colapsa **`vacio` y `no_ingerido` al literal `0`**, y `lobby-capa1.tsx:32-33` lo imprime como el
hecho `0 reuniones`. Resultado observado en `/parlamentario/S1338`: la **misma sección** declara
`—` en su encabezado (honesto: "no ingerido") y `0 reuniones` tres líneas más abajo (afirmación de
hecho: "se ingirió y no hubo ninguna"). Las dos frases se contradicen dentro del mismo
`<section id="lobby">`.

Esto contradice la regla LOCKED del propio componente E-002
(`lobby-de-parlamentario.tsx:47`, gate de contenido §9.1 punto 9):

> *"Un vacío es un HECHO, no una virtud: 'no ingestado' ≠ 'ingestado, cero'."*

**Números:** nº SQL = no hay número (el estado real es `no_ingerido`, que por definición **no** tiene
denominador conocido); nº deploy = `0`. El número erróneo queda registrado, no se borra.

**Fix propuesto para 122-05** (no aplicado aquí): que `LobbyCapa1` reciba el `CarrilEstado` completo
en vez de un `number` ya colapsado, y omita la línea de conteo cuando el estado no es `dato` —
espejo exacto de `cruces-capa1.tsx:28` (`{sector.nVotos > 0 && …}`), que ya resuelve el mismo
problema por omisión honesta. **No** es un fix de copy: es un fix de tipo. Alcance: sólo
`page.tsx:617` + `capa1/lobby-capa1.tsx:31-34`; cero SQL, cero migración.

**No se corrige en este fragmento** (régimen: los fixes son 122-05) y **no se despliega en esta
fase** (LÍMITE A: el deploy viaja con la Phase 125 — `S1338` seguirá mostrando `0 reuniones` en PROD
hasta entonces).

---

## 3. Cobertura declarada lobby ↔ PL

### 3.1 Recálculo con la query VERBATIM de 92-04

Query transcrita **verbatim** del runbook
`.planning/milestones/v9.0-phases/92-personas-p2c-lobby-legible-audiencia-pl-fail-closed/92-04-APPLY-RUNBOOK.md`
§3, con la única sustitución declarada en §1.1 (`bolet[ií]n` → `bolet.n`, superset) y una columna
`pct` añadida al final para no calcular el porcentaje a mano:

**`Q-L07`:**

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

### 3.2 Cifra 92-04 vs cifra observada hoy

| magnitud | cifra 92-04 (v9.0) | **cifra observada 2026-07-29** | ¿cambió? |
|----------|-------------------:|-------------------------------:|:--------:|
| denominador — audiencias confirmadas con `parlamentario_id` y `materia` | 5.106 | **5.106** | no |
| numerador — audiencias con ≥1 mención VÁLIDA (explícita + existente) | 195 | **195** | no |
| **cobertura** | **~3,8 %** | **3,82 %** | **no** |
| boletines distintos alcanzados | 82 | **82** | no |

**Fecha de observación: 2026-07-29** (ancla temporal de la fase, `TimeZone` de sesión `UTC`).

**Veredicto sobre la cifra: el `~3,8 %` sigue vigente.** No hay copy que actualizar por cambio de
número. La cobertura es **baja por diseño** (fail-closed doble: sólo enlaza cuando el número de
boletín está explícito en la materia **y** el proyecto existe en `proyecto`; jamás por tema, keyword
ni similitud). 195/5.106 es el dato honesto, no un defecto de ingesta.

### 3.3 Dónde vive ese literal en el código — **no vive en ninguna parte**

Búsqueda exigida por el plan, más tres variantes de refuerzo:

```bash
grep -rn "cobertura" app --include=*.tsx | grep -v "\.test\."
grep -rn "cobertura" app --include=*.ts  | grep -v "\.test\."
grep -rn "3,8 *%\|3\.8 *%\|5\.106\|5106" app --include=*.tsx --include=*.ts | grep -v "\.test\."
grep -rn -i "menciona" app/app/metodologia/page.tsx app/app/sobre/page.tsx
```

Resultado observado 2026-07-29:

- Las coincidencias de `cobertura` en `app/` pertenecen **todas** a otras superficies:
  `app/components/agenda-cobertura.tsx` + `app/app/agenda/page.tsx:129,286-350` (banner de cobertura
  de **/agenda**), `app/app/buscar/page.tsx:60-68` + `app/lib/coverage.ts` (banner *"Busca sobre N
  proyectos de ley"* de **/buscar**), `app/app/comparar/page.tsx:519` (asimetría de cámara),
  `app/app/metodologia/page.tsx:35` y `app/app/sobre/page.tsx:52` (frases genéricas de cobertura
  incremental por fuente).
- La búsqueda de las cifras (`3,8 %` / `3.8 %` / `5.106` / `5106`) devuelve **cero** coincidencias en
  `app/` fuera de tests (la única línea con `3.8` es `busqueda-hibrida-gate.ts:10`, una métrica de
  benchmark de búsqueda, sin relación).
- `metodologia` y `sobre` **no** mencionan el canal de menciones de lobby.

⇒ **El literal de cobertura lobby↔PL NO existe en la superficie.** Ese es el hallazgo, tal como el
plan lo anticipó: **cobertura parcial no declarada**.

Lo que la superficie **sí** declara hoy es el **criterio** (que la mención debe ser explícita), en
dos literales LOCKED de `lobby-menciones-de-boletin.tsx`:

- leyenda anti-causal `:87` — *"La materia de estas audiencias menciona el número de este boletín en
  el registro público de la Ley del Lobby (Ley 20.730). La mención es un dato del registro; no
  implica influencia en la tramitación ni relación causal con el proyecto."*
- empty-state `:95` — *"…Esto no describe la actividad de lobby en torno al proyecto; solo cuenta las
  materias que citan explícitamente este número de boletín."*

Ambos son honestos y **cualitativamente** correctos, pero **ninguno cuantifica** cuán parcial es el
canal. Un lector del boletín `14309-04` ve `1 audiencia registrada menciona este boletín` sin
enterarse de que sólo el 3,82 % de las audiencias confirmadas entra siquiera en este canal.

### 3.4 Tabla de veredictos (Grupo 5 · cobertura)

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| 5.12 | `/proyecto/[boletin]` — cifra de cobertura | (ninguno — literal inexistente) | `lobby_audiencia.estado_vinculo` × `proyecto.boletin_num` | `Q-L07` | `195/5106 = 3,82 %`, 82 boletines | `no emitido: no existe literal de cobertura en la superficie` | **`discrepancia-corregida`** |
| 5.13 | `/proyecto/[boletin]` — criterio declarado | `app/components/lobby-menciones-de-boletin.tsx:87` y `:95` | (copy LOCKED) | `Q-L07` | n/a (cualitativo) | leyenda + empty emitidos, verificados en el DOM de ambos sujetos | `cuadra` |

#### Fila 5.12 — fix propuesto para 122-05

**Ubicación propuesta:** una línea de cobertura declarada dentro de
`LobbyMencionesView` (`lobby-menciones-de-boletin.tsx`), **inmediatamente después** de la leyenda
anti-causal (`:182-186`) y **antes** del bloque de conteo (`:216-228`), de modo que la parcialidad se
lea **antes** que el número. Debe aparecer en los **tres** caminos de la vista (con filas, empty, y
la rama truncada), porque en el empty es donde más se puede leer un `0` como "no hubo lobby".

**Restricciones de copy que el fix debe respetar** (122-CONTEXT §Vacíos y copy):

- idiom aprobado **"según fuente al …"**; **"captura" pelado PROHIBIDO**; `fecha_captura` **jamás**
  se presenta como el hecho.
- cero causalidad, cero intención — la línea describe **el canal**, no a nadie.
- la cifra viaja **con su fecha** (`2026-07-29`), nunca sola.
- el número parcial nunca se presenta como total.
- si el fix introduce vocabulario nuevo → **extender el linter anti-insinuación ANTES del copy**
  (patrón Wave-0). La leyenda y el empty de este componente ya están en `NEGACIONES_LOCKED`
  (exportadas en `:87` y `:95` precisamente para que el linter las reste); **una línea nueva que
  contenga términos negados deberá exportarse igual** o el guard producirá un falso positivo
  (lección BLOCKER 91, anotada en el propio archivo `:83-86`).

**Decisión pendiente para 122-05 (no adjudicada aquí):** si la cifra se **hornea** como literal
fechado o se **deriva** en runtime. Hornearla es un literal que envejece en silencio; derivarla
exigiría una **RPC pública nueva** = aguja completa (cero-grant `>0044`, secdef PII-safe con
`search_path`, `PUBLIC_RPC_ALLOWLIST`, bounded) — coste desproporcionado para una línea de copy.
Este fragmento **recomienda hornear con fecha explícita** y re-verificar la cifra en cada milestone
con `Q-L07`, que es re-ejecutable tal cual. La adjudicación es de 122-05.

---

## 4. Vacíos honestos

> **Regla LOCKED (transcrita de 122-CONTEXT §Vacíos y copy y de 122-00 §0.3 Grupo 6):**
> **cero filas se presenta como cero; jamás se rellena, jamás se oculta la superficie.**
>
> **Regla de admisión de esta sección:** toda fila DEBE traer su query verbatim. **Un vacío afirmado
> sin query no se acepta** — es indistinguible de una omisión.

| qué | query verbatim | nº observado | causa estructural | ¿es bug? | dónde se declara en la UI |
|-----|----------------|-------------:|-------------------|:--------:|---------------------------|
| **`lobby_sector_aporte`** | `Q-L08` | **0** | Stub estructural de la migración **0052**: la CTE `empresa_sector` está escrita `where false` (`0052:130-136`), por lo que la arista `<rut de la empresa → sector>` **no existe** y el `join empresa_sector es on es.rut_empresa = cta.rut_proveedor` (`0052:166`) no puede producir ninguna fila. Además RUT-01 sigue en 0 % con el backfill de ChileCompra pendiente | **NO** | **No emitida.** La superficie que la consumiría está bajo **MONEY (OFF)** ⇒ fuera del deploy auditado (LÍMITE B). Además `grep -rn "lobby_sector_aporte" app` (sin tests) → **cero** consumidores: hoy la señal no está cableada a ningún componente |
| **`nVotos` de los sectores de cruce** | `Q-L09`, `Q-L10` | **0** | `cruce_senal.tipo_senal` toma **un solo** valor en PROD (`lobby_sector`, 781 filas). `agruparSectores` (`parlamentario-resumen-conteos.ts:155`) suma a `nVotos` sólo lo que hace `startsWith("voto")`, y no existe ninguna señal así. La rama queda reservada (`:78`, `:145-146`) | **NO** | **Omisión honesta.** `capa1/cruces-capa1.tsx:28` monta el fragmento sólo con `{sector.nVotos > 0 && …}` ⇒ con 0 **no se pinta nada**: no se fabrica un "0 votos" que sugiera una dimensión medida y vacía |
| **`S1338` sin lobby** | `Q-L05`, `Q-L06` | **0** audiencias · **0** filas de marcador | `lobby_audiencia.parlamentario_id` confirmado es **hoy exclusivo de diputados**: 136 de 136 (`Q-L00b`), cero senadores. `S1338` es el senador de PROD con **más** riqueza de bloques (122-00 §1.2) y aun así no tiene lobby | **NO** (conteo 0 real, no wiring roto) | Rótulo del carril `—` (`no_ingerido`, correcto — §2.3). **PERO** la capa-1 imprime `0 reuniones`: ver **fila 5.11**, `discrepancia-corregida` |
| **`S1338` sin cruces** | `Q-L11` | **0** | `cruce_senal` se materializa desde `lobby_sector` (0039/0052); sin audiencias de lobby no hay señal de sector que materializar. Cero de lobby ⇒ cero de cruces, por construcción. Ver también `122-CRUCES-SQL-02-CRUCES-ACTUALIDAD.md §2` | **NO** | Rótulo del carril `cruces` = **`sin registros`** (`conteoLabel` de `vacio`, `page.tsx:93-94`), observado en el DOM de `/parlamentario/S1338`. Correcto: el materializador **sí** corrió, y no produjo señales |
| **Empty-states (a)/(b) de E-002 inalcanzables** | `Q-L05` + los 3 `grep -c` de §2.2 | **0** ocurrencias en el DOM | `page.tsx:619` monta `LobbySection` sólo si `conteos.lobby.tipo === "dato"` ⇒ los caminos `noIngestado` (`lobby-de-parlamentario.tsx:348-370`) y `totalAudiencias === 0` (`:373-394`) **nunca** se alcanzan desde esta superficie | **NO** — es código defensivo, no un vacío de datos | No se declara (y no hace falta): el 3-estado del rótulo ya cubre el caso. Registrado aquí para que un auditor futuro **no** lo lea como "el empty-state está roto" |
| **Rama truncada `mostradas < total_n`** | `Q-L04` | `max(total_n) = 13` sobre 82 boletines (techo `LIMIT 50`) | Ningún boletín de PROD alcanza 50 menciones ⇒ `truncado` es `false` en el 100 % de los casos | **NO** — rama sin caso real | No aplica. Ver **fila 5.5**, `discrepancia-declarada` |

### 4.1 Queries de §4

**`Q-L08` — `lobby_sector_aporte`:**

```sql
select count(*) from public.cruce_senal where tipo_senal='lobby_sector_aporte';
-- observado 2026-07-29: 0
```

> **`0` filas es el resultado CORRECTO por construcción; rellenarlo exigiría un dato que la fuente
> no entrega hoy.**
>
> Esta frase está aquí, verbatim y dirigida a un auditor futuro, para que **nadie lea este cero como
> un defecto**. La migración 0052 lo declara desde su propio encabezado: *"STUB ESTRUCTURAL
> correcto-por-construcción"* (`0052:3`, `0052:23`), y modela la arista faltante como una
> **relación honesta-vacía** (`where false` → 0 filas, tipos correctos) precisamente para que el día
> que exista un sector clasificado por RUT de empresa el cruce se encienda **sin cambiar el
> esquema**. Un `0` aquí significa *"la arista `<rut de la empresa → sector>` todavía no existe en
> ninguna fuente ingerida"*, **no** *"ningún parlamentario tiene este cruce"*. Cero filas se
> presenta como cero: jamás se rellena, jamás se oculta la superficie.

**`Q-L09` — el universo real de `tipo_senal` (lo que demuestra que `nVotos` no puede ser > 0):**

```sql
select tipo_senal, count(*) from public.cruce_senal group by 1 order by 2 desc;
-- observado 2026-07-29: lobby_sector|781      (una sola fila: no hay ningún otro tipo_senal)
select distinct tipo_senal from public.cruce_senal;
-- observado 2026-07-29: lobby_sector
```

**`Q-L10` — señales de voto (la rama `startsWith("voto")` de `agruparSectores`):**

```sql
select count(*) from public.cruce_senal where tipo_senal like 'voto%';
-- observado 2026-07-29: 0
```

**`Q-L11` — cruces de `S1338`:**

```sql
select count(*) from public.cruce_senal where parlamentario_id='S1338';
-- observado 2026-07-29: 0
```

---

## 5. Límites de este fragmento

Declarados por adelantado, no descubiertos a posteriori. Los tres límites globales de
`122-00 §0.5` (A: el nº deploy es PRE-fix · B: los bloques gated OFF no emiten DOM · C: cero
fabricación) **aplican íntegros** y no se repiten aquí. Lo específico de lobby:

1. **La rama truncada (`LIMIT 50`) no es recalculable contra el deploy.** Ningún boletín supera 13
   menciones (`Q-L04`). Se declara en la fila **5.5** con veredicto `discrepancia-declarada` en vez
   de afirmar `cuadra` sobre una rama que el deploy nunca ejecuta.

2. **El Grupo 6 (`lobby_sector_aporte`) no tiene `nº deploy` posible.** Está bajo **MONEY (OFF)** y,
   además, `grep` no encuentra ningún consumidor en `app/` — no hay superficie que pudiera emitir un
   número aunque el gate se abriera. Se declara (§4), no se omite: la fila existe con su query y su
   cero.

3. **Los empty-states (a)/(b) de E-002 son inalcanzables desde `/parlamentario/[id]`** por el gate
   `tipo === "dato"` de `page.tsx:619`. Su copy no se pudo auditar contra el DOM porque el DOM no lo
   contiene. Se declara en §4; **no** se propone eliminarlos (son la defensa del componente si otra
   superficie lo montara).

4. **El denominador honesto se apoya hoy en una invariante de datos, no en una constraint.**
   `estado_vinculo <> 'confirmado' ⇒ parlamentario_id is null` se **observó** (`Q-L00`), no está
   declarado en el schema. La advertencia de §2.1 pide re-verificarlo, no asumirlo. Proponer una
   constraint sería un cambio de esquema ⇒ **fuera de alcance** de esta fase (va a 124).

5. **Sustitución de regex declarada.** Todas las queries escriben `bolet.n` donde 0063/92-04 escriben
   `bolet[ií]n`, por una limitación de encoding del shell de este entorno. Es un **superset**
   estricto (sólo puede sobre-contar) y se contrastó con la variante ASCII estricta `bolet[ii]n`,
   con resultado idéntico en ambos sujetos de §1.2. Registrado en §1.1.

6. **Cobertura por muestreo, no exhaustiva, en §1.** Se auditaron 2 boletines de 82 con menciones
   (el sujeto canónico + el máximo). El ranking completo de los 82 sí se computó (`Q-L01`), pero sólo
   2 se leyeron contra el DOM. Ampliar a los 82 exigiría 82 `curl` al Worker propio — desproporcionado
   frente al régimen de "lectura del deploy con mesura" de 122-00 §0.0.

7. **Cero fuentes gubernamentales.** `leylobby.gob.cl`, `camara.cl`, `senado.cl` y BCN **no fueron
   consultados** en ningún momento. Todo dato de lobby de este fragmento sale de `lobby_audiencia` en
   PROD (ya ingerida) o del DOM del Worker propio.

---

## Resumen de veredictos de este fragmento

| veredicto | filas | cuáles |
|-----------|------:|--------|
| `cuadra` | **10** | 5.1, 5.2, 5.3, 5.4, 5.6, 5.7, 5.8, 5.9, 5.10 (9 numéricas) + 5.13 (1 cualitativa) |
| `discrepancia-corregida` | **2** | **5.11** (`0 reuniones` sobre un carril `no_ingerido`) · **5.12** (cobertura parcial no declarada en la superficie) |
| `discrepancia-declarada` | **1** | **5.5** (rama truncada `LIMIT 50` no observable en PROD) |

**Para 122-05** — las dos filas `discrepancia-corregida`, con el fix propuesto ya escrito:
**5.11** (fix de tipo en `page.tsx:617` + `capa1/lobby-capa1.tsx:31-34`, espejo de
`cruces-capa1.tsx:28`) y **5.12** (línea de cobertura declarada en `lobby-menciones-de-boletin.tsx`
tras la leyenda `:182-186`, con cifra `3,82 %` **y** fecha `2026-07-29`, idiom "según fuente al …",
y export a `NEGACIONES_LOCKED` si introduce vocabulario negado).

**La cobertura declarada ~3,8 % sigue vigente**: 195/5.106 = **3,82 %** sobre **82** boletines
distintos, observado el **2026-07-29** — idéntica a la cifra de 92-04. Lo que falta no es actualizar
el número: es **decirlo en la superficie**.

---

> **CERRADAS POR 122-05** (`122-CRUCES-SQL-04-FIXES.md` §1, commits `df6364d` RED → `5c8f1a4` GREEN;
> Wave-0 del linter en `45cdac4`). **Ambas** filas `discrepancia-corregida` de este fragmento tienen
> ya su cambio de código con test de respaldo; **cero** filas degradadas:
>
> - **5.11** → `LobbyCapa1` recibe el `CarrilEstado` completo y **omite** la línea de conteo salvo
>   `tipo === "dato"` (`page.tsx:617` + `capa1/lobby-capa1.tsx`). El cero honesto (`dato` n=0) se
>   conserva. Fix de tipo, cero SQL — tal como este fragmento lo propuso.
> - **5.12** → `COBERTURA_MENCIONES_LOBBY` en `lobby-menciones-de-boletin.tsx`, tras la leyenda y
>   **antes** del conteo, en los **tres** caminos de la vista. Cifra **horneada con su fecha**
>   (adjudicación pendiente de §3.4, resuelta a favor de hornear). Sin entrada en
>   `NEGACIONES_LOCKED`: el literal no contiene término prohibido ni para negarlo.
>
> **El veredicto de ambas filas NO cambia** (`discrepancia-corregida` es su valor definitivo; el
> número erróneo queda registrado arriba, no se borra). **LÍMITE A sigue vigente:** el fix no está
> desplegado — `S1338` seguirá mostrando `0 reuniones` en PROD hasta la **Phase 125**.
