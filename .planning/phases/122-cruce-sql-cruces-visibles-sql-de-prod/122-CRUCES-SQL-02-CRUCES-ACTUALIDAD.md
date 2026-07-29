---
fase: 122
fragmento: 02-cruces-actualidad
estado: borrador
fecha: 2026-07-29
ancla_temporal: "2026-07-29 (heredada de 122-CRUCES-SQL-00-METODO §0.0.1; TimeZone de sesión = UTC)"
grupos: [3, 4]
produce: "Grupos 3 y 4 — cruces de ficha/proyecto (0039-0052) + panel de actualidad (0065/0066)"
consumido_por: [122-05, 122-06]
---

# 122 — CRUCES × SQL · Fragmento 02: cruces de ficha/proyecto + panel de actualidad

> Fragmento de auditoría de los **Grupos 3 y 4** del universo cerrado de
> `122-CRUCES-SQL-00-METODO.md` §0.3. Consume verbatim su **método** (§0.0), su **vocabulario de
> veredicto** (§0.1), su **plantilla de fila** (§0.2) y sus **sujetos deterministas** (§1).
> El plan **122-06** lo consolida en `122-CRUCES-SQL.md`.
>
> **Régimen:** este fragmento **no corrige** nada, **no despliega** nada, **no toca flags** y
> **no invoca ningún proc de rebuild**. Los fixes son 122-05; el deploy viaja con la Phase 125.

**Prefijo común de toda query de este fragmento** (nunca se repite abajo; el **valor** de
`SUPABASE_DB_URL` jamás se ecoa ni se transcribe):

```bash
set -a; source .env; set +a
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "<query>"
```

**Ancla temporal re-confirmada al inicio de este fragmento:**

```bash
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "select now()::date, current_setting('TimeZone');"
# → 2026-07-29|UTC
```

**Orden de trabajo (honestidad de método):** cada número de la columna `nº SQL` de este fragmento
se **ejecutó primero** y se transcribió después; ninguna tabla se redactó con cifras esperadas
para "confirmarlas" luego. Ídem `nº deploy` (`curl` → `grep` → transcripción).

**Patrón de extracción del DOM (LOCKED por 122-01 §2.3 HALLAZGO B):** React intercala `<!-- -->`
entre el texto y los dígitos. Este fragmento **re-confirmó el separador en la landing**:

```html
<span class="font-mono">452</span> <!-- -->proyectos
```

⇒ todos los `grep` de abajo son **tolerantes al separador** (patrón sobre la clase/el tag, nunca
sobre el literal armado).

---

## 0. Emisores auditados (trazados al catálogo 113 §3.0)

| id | archivo | superficie | origen |
|----|---------|------------|--------|
| **E-044** | `app/components/cruces-de-proyecto.tsx` | `/proyecto/[boletin]` | `RPC:cruces_de_proyecto` |
| **E-053** | `app/components/cruces-de-parlamentario.tsx` | `/parlamentario/[id]` (detalle) | `RPC:cruces_de_parlamentario` |
| *(sin id — capa-1)* | `app/components/capa1/cruces-capa1.tsx` | `/parlamentario/[id]` (capa-1) | `RPC:cruces_de_parlamentario` vía `app/lib/parlamentario-resumen-conteos.ts` |
| **E-055** | `app/components/panel-actualidad.tsx` | `/` | `RPC:actualidad_senales_panel` |

**E-008 `actualidad-module.tsx` NO se audita** (emisor huérfano, 00-METODO §0.4): ningún archivo
non-test lo importa ⇒ no emite DOM ⇒ no tiene `nº deploy` con el que cuadrar. El emisor vigente
de `/` es **E-055**.

### 0.1 Hallazgo de emisor — la capa-1 de cruces NO es E-053

**Descubierto al leer el DOM, no asumido.** El inventario asigna la sección `#cruces` de la ficha
a **E-053**. El DOM demuestra que la ficha tiene **dos** emisores en esa sección, y que el que
rinde el **conteo visible y el estado vacío** es otro archivo:

- `app/app/parlamentario/[id]/page.tsx:676-696` envuelve todo `#cruces` en `crucesPublicEnabled()`
  y renderiza **`CrucesCapa1`** (`app/components/capa1/cruces-capa1.tsx`) con
  `conteos.crucesSectores` + `conteoLabel(conteos.cruces)` — conteos que vienen de
  `app/lib/parlamentario-resumen-conteos.ts:366-391`.
- **E-053 (`CrucesSection`) solo se monta si `conteos.cruces.tipo === "dato"`**
  (`page.tsx:682-694`), dentro del `DetalleColapsable`. Con 0 señales **E-053 no se monta**: su
  empty-state interno (`cruces-de-parlamentario.tsx:128-139`, *"No se registran cruces de sector
  para este parlamentario…"*) es **código inalcanzable en producción** para el caso vacío.

Consecuencia para la auditoría: el **cero-como-cero** de S1338 lo emite la **capa-1**, no E-053.
Se audita el DOM real (§2), no el componente que el inventario nombraba.

---

## 1. Cruces de proyecto

### 1.0 ¿Es `cruces_de_proyecto` bounded? — **NO** (verificado contra la DB viva)

El plan-checker sospechaba un **cap** en `cruces-de-proyecto.tsx:199` (`const n = rows.length`),
por precedente confirmado en `app/lib/parlamentario-resumen-conteos.ts:271-278` (WR-03: `p_limit:
1000` sobre `votos_de_parlamentario`, donde D1165 con 3.752 votos mostraría `1000` como total).

**La sospecha se descarta con evidencia.** No se leyó solo la migración en disco (que podría
estar redefinida por otra posterior): se interrogó **el catálogo de la DB de PROD**.

```sql
-- Q-01: ¿las RPC VIVAS de PROD llevan LIMIT? (+ su proconfig)
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

| RPC | ¿bounded en PROD? | ¿el componente muestra `.length`? | ¿el `.length` es honesto? |
|-----|-------------------|-----------------------------------|---------------------------|
| `cruces_de_proyecto` | **NO** (sin `LIMIT`) | **sí** — `cruces-de-proyecto.tsx:199` `const n = rows.length` | **sí**: sin cap, `rows.length` **es** el total |
| `cruces_de_parlamentario` | **NO** (sin `LIMIT`) | **sí** — `parlamentario-resumen-conteos.ts:387` `crucesTotal = crucesFilas.length` | **sí**: sin cap, `.length` **es** el total |
| `actualidad_senales_panel` | **SÍ** (`limit 200`, 0066:52) | no emite conteo de filas (renderiza una fila por señal) | n/a — ver §3.0 |
| `votos_de_parlamentario` | **SÍ** (`p_limit`) | sí (`.length` con `p_limit: 1000`) | **no** — WR-03, **fuera del alcance de este fragmento** (Grupo 1 → 122-02) |

Consistente con las definiciones en disco: `0049_cruces_de_proyecto.sql:104-108` cierra con
`order by p.nombre_normalizado asc;` **sin LIMIT** (orden alfabético neutro, anti-ranking), y
`0041_cruces_rpc_fecha_captura.sql:43` con `order by cs.conteo desc, cs.sector_id asc;` sin LIMIT.
Ninguna migración posterior las redefine (`grep -rln "cruces_de_parlamentario\|cruces_de_proyecto\|cruce_senal" supabase/migrations`
→ 0039, 0040, 0041, 0042, 0043, 0044, 0048, 0049, 0050, 0052, 0065; ninguna de las posteriores a
0049 vuelve a declarar estas dos funciones).

**Veredicto sobre el cap sospechado: no existe.** Se registra igual (regla dura §0.1: un "no
encontré discrepancias" solo vale con la query transcrita).

### 1.1 Sujeto A — `14309-04` (boletín bicameral, 00-METODO §1)

```sql
-- Q-02: (a) la MISMA RPC que invoca el sitio
select count(*) from cruces_de_proyecto('14309-04');
-- observado 2026-07-29: 47
```

```sql
-- Q-03: (b) primeros principios — reproduce el cuerpo de 0049 verbatim (mismos CTE,
--       mismos joins, mismos filtros), sin pasar por la función
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

```bash
# Q-04: (c) el nº que muestra el deploy — comando VERBATIM (tolerante a `<!-- -->`)
curl -s https://observatorio-congreso.thevalis.workers.dev/proyecto/14309-04 -o /tmp/p14309.html
grep -o -E 'tabular-nums text-muted-foreground">[0-9]+ parlamentario' /tmp/p14309.html
# → tabular-nums text-muted-foreground">47 parlamentario
grep -o -E 'Explorar los [0-9]+ cruces' /tmp/p14309.html
# → Explorar los 47 cruces
```

### 1.2 Sujeto B de contraste — el boletín con MAYOR conteo de cruces de PROD

```sql
-- Q-05: selección del boletín de mayor conteo (el que reventaría el cap si lo hubiera)
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

**El máximo de PROD ES el sujeto A** (`14309-04`, 47) — el sujeto determinista del inventario 113
ya era el techo del universo. Para tener un segundo caso >0 se toma el **runner-up `18296-05`**
(30 cruces). Ambos están **muy por debajo** de cualquier límite: no hay límite.

```sql
-- Q-06: doble lectura de 18296-05 — (a) RPC y (b) primeros principios
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

```bash
# Q-07: (c) el DOM de 18296-05
curl -s https://observatorio-congreso.thevalis.workers.dev/proyecto/18296-05 -o /tmp/p18296.html
grep -o -E 'tabular-nums text-muted-foreground">[0-9]+ parlamentario' /tmp/p18296.html
# → tabular-nums text-muted-foreground">30 parlamentario
grep -o -E 'Explorar los [0-9]+ cruces' /tmp/p18296.html
# → Explorar los 30 cruces
```

### 1.3 Tabla de veredicto — Grupo 3.a (cruces de proyecto)

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| 3.a-1 | `/proyecto/14309-04` | `app/components/cruces-de-proyecto.tsx:199,205` (E-044) | `RPC:cruces_de_proyecto` | `Q-02` | `47` | `47` (`47 parlamentarios`) | `cuadra` |
| 3.a-2 | `/proyecto/14309-04` | `app/components/cruces-de-proyecto.tsx:263` (E-044) | `RPC:cruces_de_proyecto` | `Q-02` | `47` | `47` (`Explorar los 47 cruces`) | `cuadra` |
| 3.a-3 | *(no-superficie)* RPC vs primeros principios, `14309-04` | `supabase/migrations/0049_cruces_de_proyecto.sql:69-108` | `RPC:cruces_de_proyecto` vs `cruce_senal` | `Q-02` vs `Q-03` | `47` vs `47` | n/a (control interno) | `cuadra` |
| 3.a-4 | `/proyecto/18296-05` | `app/components/cruces-de-proyecto.tsx:199,205,263` (E-044) | `RPC:cruces_de_proyecto` | `Q-06` | `30` | `30` (`30 parlamentarios` / `Explorar los 30 cruces`) | `cuadra` |
| 3.a-5 | *(no-superficie)* RPC vs primeros principios, `18296-05` | `supabase/migrations/0049_cruces_de_proyecto.sql:69-108` | `RPC:cruces_de_proyecto` vs `cruce_senal` | `Q-06` | `30` vs `30` | n/a (control interno) | `cuadra` |
| 3.a-6 | *(no-superficie)* cap sospechado en `rows.length` | `app/components/cruces-de-proyecto.tsx:199` (E-044) | `pg_proc.pg_get_functiondef` | `Q-01` | `tiene_limit = f` (sin LIMIT) | máximo de PROD = `47`, sin techo alcanzable | `cuadra` |

---

## 2. Cruces de parlamentario

### 2.1 Sujeto A — `D1165` (11 cruces según 00-METODO §1.2)

```sql
-- Q-08: (a) la MISMA RPC que invoca el sitio
select count(*) from cruces_de_parlamentario('D1165');
-- observado 2026-07-29: 11
```

```sql
-- Q-09: (b) primeros principios — cuerpo de 0041 verbatim (mismo join al catálogo sector)
select count(*)
  from public.cruce_senal cs
  join public.sector s on s.codigo = cs.sector_id
 where cs.parlamentario_id = 'D1165';
-- observado 2026-07-29: 11

-- control adicional: sin el join al catálogo (¿pierde el join alguna señal?)
select count(*) from public.cruce_senal where parlamentario_id = 'D1165';
-- observado 2026-07-29: 11   ⇒ el join a `sector` NO descarta ninguna señal
```

```sql
-- Q-10: agregación por sector (contraste contra `agruparSectores`,
--       app/lib/parlamentario-resumen-conteos.ts:148-164)
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

```sql
-- Q-11: ¿existe HOY alguna señal de tipo voto? (`agruparSectores` sumaría nVotos
--       para `tipo_senal like 'voto%'`; el plan exige que hoy sea 0)
select count(*) from public.cruce_senal
 where parlamentario_id = 'D1165' and tipo_senal like 'voto%';
-- observado 2026-07-29: 0

select distinct tipo_senal from public.cruce_senal order by 1;
-- observado 2026-07-29: lobby_sector      (ÚNICO tipo materializado en toda la tabla)
```

```bash
# Q-12: (c) el DOM de la ficha D1165 — capa-1, chip del resumen y detalle E-053
curl -s https://observatorio-congreso.thevalis.workers.dev/parlamentario/D1165 -o /tmp/D1165.html

# c.1 — conteo junto al h2 de capa-1
grep -o -E '¿Con qué sectores tuvo reuniones de lobby\?</span><span class="ml-auto text-sm font-normal text-muted-foreground">[^<]*' /tmp/D1165.html
# → …text-muted-foreground">11

# c.2 — chips por sector de capa-1 (11 chips)
grep -o -E '<li class="inline-block rounded-full border border-border bg-card px-3 py-1 text-sm">.{0,220}?</li>' /tmp/D1165.html | sed -E 's/<[^>]*>//g'
# → Salud y farmacéutica · 32 reuniones
#   Comercio, industria y retail · 16 reuniones
#   Gremios, sindicatos y asociaciones · 12 reuniones
#   Educación · 6 reuniones
#   Trabajo y previsión social · 6 reuniones
#   Banca, finanzas y seguros · 5 reuniones
#   Seguridad, justicia y defensa · 5 reuniones
#   Transporte y telecomunicaciones · 3 reuniones
#   Vivienda, urbanismo y obras públicas · 3 reuniones
#   Medio ambiente y recursos hídricos · 1 reunión
#   Minería y energía · 1 reunión      (11 chips; suma = 90)

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

### 2.2 Sujeto B — `S1338` (0 cruces, **vacío honesto**)

```sql
-- Q-13: (a) RPC y (b) primeros principios
select count(*) from cruces_de_parlamentario('S1338');
-- observado 2026-07-29: 0

select count(*) from public.cruce_senal cs
  join public.sector s on s.codigo = cs.sector_id
 where cs.parlamentario_id = 'S1338';
-- observado 2026-07-29: 0
```

```bash
# Q-14: (c) el DOM de S1338 — ¿el cero se presenta COMO cero?
curl -s https://observatorio-congreso.thevalis.workers.dev/parlamentario/S1338 -o /tmp/S1338.html
grep -o -E 'id="cruces"' /tmp/S1338.html | sort -u        # → id="cruces"   (la sección EXISTE)
grep -o -E 'id="cruces" class="mt-12".{0,900}' /tmp/S1338.html
```

**Fragmento de DOM literal — el cero-como-cero (transcrito verbatim de la salida del `curl`):**

```html
<section id="cruces" class="mt-12"><div class="rounded-lg border-[1.5px] border-accent-product bg-card p-4 space-y-3"><h2 class="flex items-center gap-2 text-lg font-semibold text-accent-product"><span>¿Con qué sectores tuvo reuniones de lobby?</span><span class="ml-auto text-sm font-normal text-muted-foreground">sin registros</span></h2><p class="text-xs text-muted-foreground">Sectores de las contrapartes registradas bajo la Ley del Lobby (Ley 20.730). El número indica cuántas reuniones aparecen en el registro oficial; solo muestra hechos públicos, no establece relación entre una reunión y ninguna otra actuación del parlamentario.</p><p class="text-sm text-muted-foreground">Aún no se registran reuniones de lobby en las fuentes consultadas.</p></div></section>
```

Y el chip del índice de la ficha (payload RSC, mismo `curl`):

```
{\"id\":\"cruces\",\"label\":\"Lobby por sector\",\"count\":\"sin registros\",\"marker\":\"diamante\"}
```

**Distinción 3-estado verificada** (`derivarEstado`, `parlamentario-resumen-conteos.ts:391`
`derivarEstado({ total: 0, ingestado: true })`):

| estado | cómo se vería | ¿es lo observado? |
|--------|---------------|-------------------|
| `dato` | `11` + chips + detalle | no |
| **`vacio`** | **`sin registros`** + *"Aún no se registran reuniones de lobby en las fuentes consultadas."* | **SÍ — es lo observado** |
| `no_ingerido` | `—` / *"pendiente"* | no |
| *(ausencia de sección)* | sin `id="cruces"` en el HTML | no — la sección **está presente** |

⇒ **el cero se presenta como cero**: la superficie no se oculta, no se rellena, y no se declara
falsamente "no ingerido". Cumple 00-METODO §0.5 LÍMITE C.

### 2.3 Tabla de veredicto — Grupo 3.b (cruces de parlamentario)

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| 3.b-1 | `/parlamentario/D1165` | `app/components/capa1/cruces-capa1.tsx:50-57` ← `app/lib/parlamentario-resumen-conteos.ts:387` | `RPC:cruces_de_parlamentario` | `Q-08` | `11` | `11` | `cuadra` |
| 3.b-2 | `/parlamentario/D1165` | `app/app/parlamentario/[id]/page.tsx:687` | `RPC:cruces_de_parlamentario` | `Q-08` | `11` | `11` (`Ver las 11 señales de lobby por sector`) | `cuadra` |
| 3.b-3 | `/parlamentario/D1165` | `app/components/cruces-de-parlamentario.tsx:149` (E-053, encabezados de señal) | `RPC:cruces_de_parlamentario` | `Q-08` | `11` señales | `11` encabezados | `cuadra` |
| 3.b-4 | `/parlamentario/D1165` | `app/components/capa1/cruces-capa1.tsx:20-37` (chips por sector) ← `agruparSectores` `:148-164` | `cruce_senal.conteo` agrupado por `sector.etiqueta` | `Q-10` | 11 sectores; `32,16,12,6,6,5,5,3,3,1,1` (suma **90**) | 11 chips; `32,16,12,6,6,5,5,3,3,1,1` (suma **90**) | `cuadra` |
| 3.b-5 | `/parlamentario/D1165` | `app/components/capa1/cruces-capa1.tsx:28-34` (dimensión `nVotos`) | `cruce_senal.tipo_senal like 'voto%'` | `Q-11` | `0` | `0` chips con `votos` | `cuadra` |
| 3.b-6 | *(no-superficie)* RPC vs primeros principios, `D1165` | `supabase/migrations/0041_cruces_rpc_fecha_captura.sql:32-44` | `RPC:cruces_de_parlamentario` vs `cruce_senal` | `Q-08` vs `Q-09` | `11` vs `11` | n/a (control interno) | `cuadra` |
| 3.b-7 | `/parlamentario/S1338` | `app/components/capa1/cruces-capa1.tsx:50-57,73-77` | `RPC:cruces_de_parlamentario` | `Q-13` | `0` | `sin registros` + *"Aún no se registran reuniones de lobby en las fuentes consultadas."* (cero declarado, sección presente) | `cuadra` |
| 3.b-8 | *(no-superficie)* RPC vs primeros principios, `S1338` | `supabase/migrations/0041_cruces_rpc_fecha_captura.sql:32-44` | `RPC:cruces_de_parlamentario` vs `cruce_senal` | `Q-13` | `0` vs `0` | n/a (control interno) | `cuadra` |
| 3.b-9 | `/parlamentario/S1338` | `app/components/cruces-de-parlamentario.tsx:128-139` (E-053, empty-state) | `RPC:cruces_de_parlamentario` | `Q-13` | `0` | **no emitido en el deploy** — E-053 solo se monta con `conteos.cruces.tipo === "dato"` (`page.tsx:682`) ⇒ su empty-state es inalcanzable | `discrepancia-declarada` |

**Sobre 3.b-9:** es **código muerto, no un dato erróneo**. El cero-como-cero **sí** se presenta
(fila 3.b-7, capa-1). No se corrige aquí porque no hay número mal mostrado: se **declara** para que
el catálogo 113 corrija la atribución de emisor y para que 122-05 decida si el empty-state
duplicado de E-053 se retira (limpieza) o se conserva como salvaguarda. **No es urgente ni
user-facing.**

---

## 3. Panel de actualidad — señales

### 3.0 Universo real de `tipo_senal` (derivado de la base, no asumido)

El plan hablaba de "6 señales"; 00-METODO §0.3 Grupo 4 advertía que **el denominador lo cierra la
base**. Se cerró:

```sql
-- Q-15: universo observado de tipos de señal
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

**Diferencia respecto de "6", registrada:** hay **7 `tipo_senal`** — los **6 temporales** que
materializa `actualidad.materializar_senales()` (0065) **más** `agrupacion_materia`, que el proc
**NO** toca (su `delete` está acotado a los 6 temporales, 0065:111-113) y que **posee el CLI
k-means**. El allow-list del `check` de 0065:52-54 declara exactamente esos 7. Los 7 tipos
producen **19 filas** (una por corte de cámara / cluster).

**¿La RPC bounded corta algo?** No:

```sql
-- Q-16: la MISMA RPC que invoca el sitio, completa
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

**19 filas de 19 en la tabla, contra un `limit 200` (0066:52)** ⇒ el bound **no está activo**;
el panel muestra el universo completo. Se registra (fila 4-0 de §3.7).

### 3.1 Frescura del materializado (para poder adjudicar rezago)

```sql
-- Q-17: ¿cuándo se materializó cada tipo?
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

Los 6 tipos temporales comparten `fecha_captura` **al microsegundo** = `2026-07-29 11:07:00.015941+00`:
es el `now()` del **full-rebuild** del cron `'7 11,14,17,20 * * 1-5'` (0065:326-330), corrido
**hoy** — no una observación de la fuente (regla del reloj, 0065:26-28). `agrupacion_materia` trae
su propio reloj (CLI k-means, 13:05 de hoy).

⇒ **rezago del materializado ≈ 2 h**, dentro de la cadencia intradía. Se verifica igual señal por
señal (§3.2-3.6): un rebuild reciente no garantiza que su agregación siga siendo correcta.

### 3.2 `velocity` — primeros principios (transcritos de 0065:127-135)

```sql
-- Q-18: PP velocity. NOTA DE SHELL: el literal '(sin cámara)' con tilde revienta el
--       encoding de -c en Git Bash/Windows (ERROR: invalid byte sequence for encoding
--       "UTF8": 0xe1 0x6d 0x61). Se sustituye el literal por 'SIN-CAMARA' — cambia SOLO
--       la etiqueta del grupo NULL, jamás el conteo ni el agrupamiento.
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

### 3.3 `nuevos_ingresos` — primeros principios (0065:159-169)

```sql
-- Q-19: PP nuevos_ingresos (ventana REAL 7d; '2022-2026' es piso de corpus, no ventana)
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
ventana'`. Es exactamente lo que devuelve la RPC (Q-16). **Cero honesto, no 0-como-hecho.**

### 3.4 `urgencias` y `archivados` — primeros principios (0065:196-203 / 0065:286-295)

```sql
-- Q-20: PP urgencias
select count(*), max(fecha) from public.tramitacion_evento
 where tipo = 'urgencia'
   and fecha <= current_date
   and fecha >= current_date - interval '30 days';
-- observado 2026-07-29: 95|2026-07-22 00:00:00+00
```

```sql
-- Q-21: PP archivados
select count(*), max(fecha) from public.tramitacion_evento
 where fecha <= current_date
   and fecha >= current_date - interval '30 days'
   and (descripcion ilike '%archiv%' or descripcion ilike '%retira%')
   and descripcion not ilike '%desarchiv%'
   and descripcion not ilike '%retira y hace presente%';
-- observado 2026-07-29: 2|2026-07-06 00:00:00+00
```

### 3.5 `agenda_citacion` y `agenda_sala` — primeros principios (0065:232-237 / 0065:260-265)

```sql
-- Q-22: PP agenda_citacion (futuras; date-only medianoche UTC = día chileno, SIN tz)
select coalesce(nullif(regexp_replace(camara, '\s+', '', 'g'), ''), 'SIN-CAMARA') cam,
       count(*) n, max(fecha)
  from public.citacion
 where fecha::date >= current_date
 group by 1 order by 1;
-- observado 2026-07-29: senado|23|2026-08-10 00:00:00+00      (NINGUNA fila 'camara')
```

```sql
-- Q-23: PP agenda_sala (futuras)
select coalesce(nullif(regexp_replace(camara, '\s+', '', 'g'), ''), 'SIN-CAMARA') cam,
       count(*) n, max(fecha)
  from public.sesion_sala
 where fecha::date >= current_date
 group by 1 order by 1;
-- observado 2026-07-29:
--   camara|1|2026-08-03 00:00:00+00
--   senado|2|2026-08-05 00:00:00+00
```

### 3.6 `agrupacion_materia` — denominador (no lo materializa el proc de 0065)

```sql
-- Q-24: suma de los 10 clusters vs. el corpus embebido y el corpus total
select sum(conteo) from actualidad_senal where tipo_senal = 'agrupacion_materia';
-- observado 2026-07-29: 3100
select count(*) from public.proyecto_embedding;   -- observado: 3100
select count(*) from public.proyecto;             -- observado: 3675
```

⇒ los 10 clusters particionan **exactamente** el corpus embebido (`3100 = 3100`, sin doble conteo
ni pérdida). El denominador **honesto** del tile es `proyecto_embedding`, **no** `proyecto`: el
tile agrupa **3.100 de 3.675** proyectos (84,4 %) y **no lo declara** — ver §3.8 (hallazgo de copy
para 122-05; los números en sí cuadran).

### 3.7 Lectura del DOM de `/` — comandos verbatim

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

> **Gotcha de método registrado:** un `grep -o -E 'Por materia</h2>.{0,9000}'` sobre el HTML de
> una sola línea produce **backtracking catastrófico** (el comando superó 120 s y hubo que
> abortarlo). Para contar hijos de un tile hay que usar **greps literales sobre el marcador de
> fila** (`grep -o -F '<!-- -->proyectos'`), no un salto de N miles de caracteres desde el título.

### 3.8 Tabla de veredicto — Grupo 4 (panel de actualidad)

`nº SQL` = **(a) RPC** / **(b) primeros principios**. Si (a) y (b) coinciden, se escribe una sola vez.

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| 4-0 | `/` | `app/components/panel-actualidad.tsx:274-286` (E-055) | `RPC:actualidad_senales_panel` (`limit 200`) | `Q-15`, `Q-16` | `19` filas / `7` tipos | `7` tiles, `18` filas activas + `1` supresión = `19` | `cuadra` |
| 4-1 | `/` tile *Movimiento reciente* | `panel-actualidad.tsx:230-231` (E-055) | `actualidad_senal.conteo` (`velocity`, `(sin cámara)`) | `Q-16` / `Q-18` | `1` / `1` | `1` | `cuadra` |
| 4-2 | `/` tile *Movimiento reciente* | `panel-actualidad.tsx:230-231` (E-055) | `actualidad_senal.conteo` (`velocity`, `C.Diputados`) | `Q-16` / `Q-18` | `37` / `37` | `37` | `cuadra` |
| 4-3 | `/` tile *Movimiento reciente* | `panel-actualidad.tsx:230-231` (E-055) | `actualidad_senal.conteo` (`velocity`, `Senado`) | `Q-16` / `Q-18` | `44` / `44` | `44` | `cuadra` |
| 4-4 | `/` tile *Urgencias del Ejecutivo* | `panel-actualidad.tsx:230-231` (E-055) | `actualidad_senal.conteo` (`urgencias`, `30d`) | `Q-16` / `Q-20` | `95` / `95` | `95` | `cuadra` |
| 4-5 | `/` tile *Citaciones próximas* | `panel-actualidad.tsx:230-231` (E-055) | `actualidad_senal.conteo` (`agenda_citacion`, `senado`) | `Q-16` / `Q-22` | `23` / `23` | `23` | `cuadra` |
| 4-6 | `/` tile *Sesiones de sala* | `panel-actualidad.tsx:230-231` (E-055) | `actualidad_senal.conteo` (`agenda_sala`, `camara`) | `Q-16` / `Q-23` | `1` / `1` | `1` | `cuadra` |
| 4-7 | `/` tile *Sesiones de sala* | `panel-actualidad.tsx:230-231` (E-055) | `actualidad_senal.conteo` (`agenda_sala`, `senado`) | `Q-16` / `Q-23` | `2` / `2` | `2` | `cuadra` |
| 4-8 | `/` tile *Nuevos ingresos* | `panel-actualidad.tsx:183-200` (E-055, rama supresión) | `actualidad_senal.supresion_causa` | `Q-16` / `Q-19` | `0` / `0` | `sin nuevos ingresos fechados en la ventana — en las fuentes consultadas al 28 jul 2026` (**supresión-como-fila**, tile presente) | `cuadra` |
| 4-9 | `/` tile *Archivos y retiros* | `panel-actualidad.tsx:230-231` (E-055) | `actualidad_senal.conteo` (`archivados`, `30d`) | `Q-16` / `Q-21` | `2` / `2` | `2` | `cuadra` |
| 4-10 | `/` tile *Por materia* | `panel-actualidad.tsx:225-231` (E-055) | `actualidad_senal.conteo` (`agrupacion_materia`, clusters 0-9) | `Q-16` / `Q-24` | 10 clusters: `452,615,95,363,192,62,421,335,272,293` (suma **3100**) | 10 clusters: mismos valores (`421` vía streaming Suspense, `<div hidden id="S:1">`) | `cuadra` |
| 4-11 | `/` tile *Por materia* | `panel-actualidad.tsx:209-210,225-229` (E-055) | `actualidad_senal.materia` | `Q-16` | `(sin materia)` ×10 | `(sin materia)` ×10, verbatim | `cuadra` |
| 4-12 | `/` chips de cobertura | `panel-actualidad.tsx:237-241` (E-055) | `actualidad_senal.cobertura_camara` | `Q-16` | `(sin cámara)`, `C.Diputados`, `Senado`, `senado`, `camara`, `senado`, `2022-2026 (piso de corpus)` | idénticos; **cero literal de ranking** (`grep` de denylist → vacío) | `cuadra` |
| 4-13 | `/` — rezago del materializado | `supabase/migrations/0065_actualidad_senal.sql:88-309` | `actualidad_senal.fecha_captura` | `Q-17` | rebuild `2026-07-29 11:07:00.015941+00` (6 tipos temporales, al µs) + `13:05:51.779+00` (`agrupacion_materia`, CLI) | n/a — el DOM no expone `fecha_captura` | `cuadra` |
| 4-14 | `/` — denominador del tile *Por materia* | `panel-actualidad.tsx:67` (`FRAMING.agrupacion_materia = "proyectos"`) | `proyecto_embedding` vs `proyecto` | `Q-24` | `3100` clusterizados de `3675` proyectos (84,4 %) | `452 proyectos`… sin declarar que la base es el corpus **embebido**, no todos los proyectos | `discrepancia-declarada` |
| 4-15 | `/` — dos grafías de cámara en el mismo panel | `panel-actualidad.tsx:237-241` (E-055) ← `0065:233,261` (`citacion.camara` / `sesion_sala.camara` CRUDAS) | `actualidad_senal.cobertura_camara` | `Q-16`, `Q-22`, `Q-23` | `senado`/`camara` (agenda, crudas) vs `Senado`/`C.Diputados` (velocity, normalizadas por D2) | los 6 chips conviven en la misma landing: `C.Diputados`, `Senado`, `(sin cámara)`, `senado`, `camara` | `discrepancia-declarada` |

**Sobre 4-13 — no hay rezago material.** La regla del plan (*"si (a)==(c) pero (b)≠(a) ⇒
`discrepancia-declarada` por rezago"*) **no se gatilla**: las **7 comparaciones (a) vs (b) de
§3.2-3.6 coinciden exactamente**. El materializado se reconstruyó hoy a las 11:07 UTC (≈2 h antes
de esta corrida) y sigue siendo fiel a `tramitacion_evento` / `citacion` / `sesion_sala`. **No se
invocó `actualidad.materializar_senales()` ni se escribió una sola fila** (T-122-08).

**Sobre 4-14 — por qué `discrepancia-declarada` y no `-corregida`.** Los **números cuadran**
(SQL = deploy); lo que falta es una **declaración de cobertura** ("3.100 de 3.675 proyectos con
texto procesado"). Añadirla es un cambio de **copy** que 122-05 puede aplicar, pero exige una
cifra que hoy **ninguna columna del contrato de la RPC emite** (`actualidad_senales_panel` no
devuelve denominador): declararla en el cliente implicaría o bien una consulta nueva o bien una
columna nueva ⇒ **SQL**, no solo copy. Se declara con ambos números para que 122-05 decida.

**Sobre 4-15 — por qué `discrepancia-declarada` y no `-corregida`.** El defecto **D2** de 0065
(normalizar `camara` con `regexp_replace`) se aplica a `velocity`, pero para `agenda_citacion` /
`agenda_sala` la fuente entrega ya `senado`/`camara` en minúscula y el `regexp_replace` **no
mayusculiza**: el ciudadano ve `Senado` y `senado` como chips distintos en la misma pantalla.
El fix correcto es **normalizar en el materializador (SQL)**, no maquillar en el cliente —
maquillarlo en `panel-actualidad.tsx` dejaría la tabla con dos grafías y trasladaría la deuda.
**No afecta ningún conteo.** Queda para 122-05/124 con ambas grafías registradas.

---

## 4. Límites de este fragmento

Declarados por adelantado o descubiertos con evidencia; ninguno se rellena con un número
fabricado (00-METODO §0.5 LÍMITE C).

**L-02.1 — `nº deploy` es PRE-fix.** Herencia directa del LÍMITE A de 00-METODO: los fixes de
122-05 no se despliegan en esta fase (el deploy viaja con la **Phase 125**). Las filas 4-14 y
4-15 seguirán mostrando lo registrado aquí hasta que 125 despliegue.

**L-02.2 — `agrupacion_materia` no tiene "primeros principios" reproducible en SQL.** Su
materialización la hace el **CLI k-means** (fuera de `actualidad.materializar_senales()`, cuyo
`delete` está acotado a los 6 tipos temporales, 0065:111-113). Reproducir sus 10 clusters exigiría
re-correr k-means sobre `proyecto_embedding` — cómputo, no una query. Lo que **sí** se verificó
(Q-24) es la propiedad falsable disponible: **la suma de los clusters iguala exactamente el corpus
embebido** (`3100 = 3100`), es decir la partición no duplica ni pierde proyectos. Se declara el
límite en vez de fabricar una réplica del clustering.

**L-02.3 — `fecha_captura` no es observable en el DOM.** El panel no expone `fecha_captura`
(por diseño: regla del reloj, 0065:26-28 — `fecha_captura` **jamás** es un hecho legislativo). El
rezago del materializado (fila 4-13) se adjudica por SQL contra el reloj del rebuild, no contra el
sitio. El `datos al {fecha}` que sí muestra el panel viene de `fecha_max` (= la fecha del **hecho**),
que es lo correcto.

**L-02.4 — el `limit 200` de `actualidad_senales_panel` está inactivo hoy, pero es un techo real.**
Con 19 filas (Q-15) el bound no corta nada. Si `agrupacion_materia` creciera a >180 clusters, el
panel **silenciaría** filas sin aviso (el componente no emite un total). No es un defecto hoy y
**no se toca** (cambiarlo es SQL, y el gate correcto para eso es 124). Se registra como
observación, no como veredicto.

**L-02.5 — un `tipo_senal` con CERO filas en la tabla sería invisible.** El `check` de 0065:52-54
declara **7** tipos y hoy los **7 tienen filas** (Q-15), de modo que el caso no se materializa. Pero
`PanelActualidad` construye `tiposPresentes` filtrando `porTipo.has(t)` (`panel-actualidad.tsx:301`):
un tipo sin ninguna fila **no produciría tile**, ni siquiera vacío. La supresión-como-fila de 0065
lo previene *por construcción* (el proc siempre inserta al menos una fila por tipo temporal), y por
eso hoy **no hay ninguna señal ocultada** — pero la garantía vive en SQL, no en el cliente.
Se declara; **no se corrige aquí**.

**L-02.6 — no hay "vacío no recalculable" en este fragmento.** Los dos ceros observados
(`S1338` = 0 cruces, `nuevos_ingresos` = 0 ingresos en ventana) se recalcularon por SQL, se
verificaron en el DOM y **ambos se presentan como cero declarado**, con su literal transcrito
(§2.2 y §3.7). Ninguno se rellenó ni se ocultó.

**L-02.7 — gates OFF fuera del denominador (LÍMITE B de 00-METODO).** MONEY y NOTIF están **OFF**;
ninguno de sus cruces pertenece a los Grupos 3 y 4, así que este fragmento no tiene filas
`no emitido en el deploy` por gate. **CRUCES** está **ON**, que es la condición necesaria para que
§1 y §2 sean observables.

---

## 5. Recuento

| grupo | filas de veredicto | `cuadra` | `discrepancia-corregida` | `discrepancia-declarada` |
|-------|-------------------:|---------:|-------------------------:|-------------------------:|
| 3.a — cruces de proyecto | 6 | 6 | 0 | 0 |
| 3.b — cruces de parlamentario | 9 | 8 | 0 | 1 |
| 4 — panel de actualidad | 16 | 14 | 0 | 2 |
| **total** | **31** | **28** | **0** | **3** |

**Ninguna discrepancia se corrige en este fragmento** (los fixes son 122-05). Las 3 declaradas —
3.b-9 (empty-state inalcanzable de E-053), 4-14 (denominador del tile *Por materia* sin declarar) y
4-15 (dos grafías de cámara en el mismo panel) — **no alteran ningún conteo mostrado**: son
atribución de emisor, declaración de cobertura y consistencia de etiqueta.

**Verificación de régimen de este fragmento:** cero cadenas de conexión Postgres
(`SUPABASE_DB_URL` aparece solo como **nombre** de variable, nunca expandido); cero RUT, cero
email, cero nombre de
contraparte de lobby (solo agregados y `sector.etiqueta`, catálogo público); **todas** las queries
son `select` — cero DDL, cero DML, cero invocación de
`actualidad.materializar_senales()`; cero requests a fuentes gubernamentales (solo `curl` al Worker
propio, 5 requests); cero flags tocados; cero archivos de `app/` o `supabase/` modificados.
