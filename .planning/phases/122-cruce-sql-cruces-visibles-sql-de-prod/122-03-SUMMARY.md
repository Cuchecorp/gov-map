---
phase: 122
plan: 03
subsystem: auditoria-cruces
tags: [cruces, actualidad, sql, prod, panel, senales]
requires: ["122-CRUCES-SQL-00-METODO.md", "113-INVENTARIO.md"]
provides: ["122-CRUCES-SQL-02-CRUCES-ACTUALIDAD.md"]
affects: ["122-05", "122-06", "125"]
key-files:
  created:
    - .planning/phases/122-cruce-sql-cruces-visibles-sql-de-prod/122-CRUCES-SQL-02-CRUCES-ACTUALIDAD.md
  modified: []
decisions:
  - "El cap sospechado en cruces-de-proyecto.tsx:199 NO existe: cruces_de_proyecto y cruces_de_parlamentario son UNBOUNDED en PROD (pg_get_functiondef), así que rows.length es el total honesto"
  - "El universo de tipo_senal del panel es 7 (no 6): agrupacion_materia lo posee el CLI k-means, fuera del proc de 0065"
  - "La capa-1 de cruces de la ficha la emite capa1/cruces-capa1.tsx, no E-053; E-053 solo se monta con tipo === 'dato'"
  - "Sin rezago material del materializado: las 7 comparaciones RPC vs primeros principios coinciden exactamente"
metrics:
  tasks: 2
  commits: 1
  files_created: 1
  filas_veredicto: 31
  completed: 2026-07-29
---

# Phase 122 Plan 03: Cruces de ficha/proyecto + panel de actualidad — Summary

Recálculo por SQL contra PROD de los Grupos 3 y 4 del universo cerrado de 122-01: **31 filas de
veredicto** (28 `cuadra`, 0 `discrepancia-corregida`, 3 `discrepancia-declarada`), con el **cap
sospechado en `cruces-de-proyecto.tsx:199` descartado con evidencia del catálogo de la DB viva**
y el universo real del panel cerrado en **7 `tipo_senal` / 19 filas**, no 6.

## Qué se hizo

**Task 1 — Grupo 3 (cruces de ficha y proyecto, 0039-0052).** Se leyeron los emisores y las
migraciones vigentes, se interrogó `pg_proc` de PROD para decidir el cap, y se hizo la **doble
lectura obligatoria** (RPC por psql + query de primeros principios transcrita del cuerpo de la
migración) para 4 sujetos, contrastada contra el DOM del deploy por `curl`.

**Task 2 — Grupo 4 (panel de actualidad, 0065/0066).** Se enumeró el universo real de
`tipo_senal` desde la base, se invocó `actualidad_senales_panel(null)` completa, se transcribieron
y corrieron **7 queries de primeros principios** desde el proc de 0065 (velocity, nuevos_ingresos,
urgencias, archivados, agenda_citacion, agenda_sala + el denominador de agrupacion_materia), y se
comparó cada número con el DOM de `/`.

## Evidencia clave

**El cap sospechado NO existe** (foco especial del plan-checker). No se confió en la migración en
disco: se interrogó la DB viva.

```sql
select p.proname, coalesce(array_to_string(p.proconfig,','),'(sin proconfig)') cfg,
       (pg_get_functiondef(p.oid) ilike '%limit%') tiene_limit
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public' and p.proname in ('cruces_de_proyecto','cruces_de_parlamentario',
                                           'actualidad_senales_panel','votos_de_parlamentario');
-- actualidad_senales_panel | search_path="",statement_timeout=5s | t
-- cruces_de_parlamentario  | search_path=""                     | f
-- cruces_de_proyecto       | search_path=""                     | f
-- votos_de_parlamentario   | (sin proconfig)                    | t
```

⇒ `cruces_de_proyecto` es **unbounded** ⇒ `rows.length` **es** el total honesto. El precedente
WR-03 (`p_limit: 1000` en `votos_de_parlamentario`) **no se replica aquí**. Además, el boletín con
mayor conteo de PROD **es el sujeto determinista mismo** (`14309-04`, 47) — no hay techo
alcanzable. Segundo sujeto de contraste: `18296-05` (30).

**Cruces — los 4 sujetos cuadran en las 3 lecturas:**

| sujeto | (a) RPC | (b) primeros principios | (c) DOM |
|--------|--------:|------------------------:|---------|
| `14309-04` | 47 | 47 | `47 parlamentarios` / `Explorar los 47 cruces` |
| `18296-05` | 30 | 30 | `30 parlamentarios` / `Explorar los 30 cruces` |
| `D1165` | 11 | 11 | conteo `11`, `Ver las 11 señales de lobby por sector`, 11 encabezados, 11 chips |
| `S1338` | 0 | 0 | `sin registros` + *"Aún no se registran reuniones de lobby en las fuentes consultadas."* |

La agregación por sector de `D1165` cuadra **elemento a elemento** con `agruparSectores`
(`32,16,12,6,6,5,5,3,3,1,1`, suma 90), y `nVotos` es `0` tanto en SQL
(`tipo_senal like 'voto%'` → 0; el único tipo materializado en toda `cruce_senal` es
`lobby_sector`) como en el DOM (0 chips con `votos`).

**Panel de actualidad — cero rezago material.** Las **7** comparaciones (a) RPC vs (b) primeros
principios coinciden exactamente:

| señal | RPC | primeros principios | DOM |
|-------|-----|---------------------|-----|
| `velocity` × 3 cortes | 1 / 37 / 44 | 1 / 37 / 44 | 1 / 37 / 44 |
| `urgencias` | 95 | 95 | 95 |
| `agenda_citacion` (senado) | 23 | 23 | 23 |
| `agenda_sala` (camara/senado) | 1 / 2 | 1 / 2 | 1 / 2 |
| `archivados` | 2 | 2 | 2 |
| `nuevos_ingresos` | 0 + causa | 0 | supresión-como-fila verbatim |
| `agrupacion_materia` × 10 | suma 3100 | `proyecto_embedding` = 3100 | 10 clusters |

`fecha_captura` de los 6 tipos temporales = `2026-07-29 11:07:00.015941+00` **al microsegundo**
(reloj del full-rebuild del cron, ≈2 h antes de la corrida). El materializado sigue fiel a las
tablas fuente ⇒ la regla *"(a)==(c) pero (b)≠(a) ⇒ rezago"* **no se gatilló**.

**Vacíos honestos verificados con literal transcrito:** `S1338` (0 cruces) y `nuevos_ingresos`
(0 ingresos en ventana → *"sin nuevos ingresos fechados en la ventana — en las fuentes consultadas
al 28 jul 2026"*). **Ninguno rellenado, ninguno oculto.** Los 19 de 19 registros de la tabla llegan
al DOM (`limit 200` inactivo).

**Anti-ranking (T-52-13):** `grep -o -i -E "los m[aá]s|m[aá]s activ|top [0-9]|ranking|l[ií]der"`
sobre toda la landing → **vacío**. Los chips declaran proveniencia, no ranking.

## Filas `discrepancia-declarada` (3) — insumo para 122-05

Ninguna altera un conteo mostrado. Cero se corrigieron aquí (los fixes son 122-05).

**1. `3.b-9` — empty-state de E-053 inalcanzable en producción.**
`app/components/cruces-de-parlamentario.tsx:128-139` contiene un empty-state
(*"No se registran cruces de sector para este parlamentario…"*) que **nunca se renderiza**: la
página monta `CrucesSection` solo si `conteos.cruces.tipo === "dato"`
(`app/app/parlamentario/[id]/page.tsx:682`). El cero-como-cero real lo emite la capa-1.
**Fix propuesto para 122-05:** corregir la atribución de emisor en el catálogo 113 (§3.0 fila
E-053 → añadir `capa1/cruces-capa1.tsx` como emisor del conteo/estado vacío) y decidir si el
empty-state duplicado de E-053 se retira. **Prioridad baja, no user-facing.**

**2. `4-14` — el tile *Por materia* no declara su denominador.**
Los 10 clusters suman `3100` = `proyecto_embedding`, pero `proyecto` tiene `3675`: el tile agrupa
**3.100 de 3.675 proyectos (84,4 %)** y muestra *"452 proyectos"* sin decir que la base es el
corpus **embebido**. Los números cuadran; falta la declaración de cobertura parcial (CONTEXT
§Denominadores: *"el número parcial nunca se presenta como total"*).
**Fix propuesto para 122-05:** declarar la cobertura en el tile con la cifra observada **y su
fecha** (idiom aprobado). **Ojo:** `actualidad_senales_panel` **no emite denominador** — el fix
requiere o una consulta nueva o una columna nueva ⇒ es **SQL**, no solo copy. 122-05 debe decidir
si cabe en su régimen o se deriva a 124.

**3. `4-15` — dos grafías de cámara conviven en el mismo panel.**
`velocity` normaliza por D2 (`C.Diputados`, `Senado`), pero `agenda_citacion`/`agenda_sala` toman
`camara` CRUDA de la fuente (`senado`, `camara`, en minúscula, sin tilde). El ciudadano ve los 6
chips juntos: `C.Diputados`, `Senado`, `(sin cámara)`, `senado`, `camara`.
**Fix propuesto para 122-05:** normalizar **en el materializador (0065:233,261)**, no maquillar en
`panel-actualidad.tsx` — maquillar dejaría la tabla con dos grafías y trasladaría la deuda.
**No afecta ningún conteo.** Al ser una migración sobre el proc de rebuild, 122-05 debe evaluar si
entra como migración aditiva o se deriva a 124.

## Desviaciones del plan (RULE-1 — mandó la realidad)

**1. [RULE-1] El emisor del conteo y del vacío de cruces en la ficha NO es E-053.**
- **Antes (plan, `read_first` de Task 1):** auditar `app/components/cruces-de-parlamentario.tsx`
  como el emisor del conteo y del cero de `S1338`.
- **Realidad observada en el DOM:** la sección `#cruces` de `/parlamentario/S1338` emite
  *"¿Con qué sectores tuvo reuniones de lobby?"* + `sin registros` +
  *"Aún no se registran reuniones de lobby en las fuentes consultadas."* — literales que viven en
  `app/components/capa1/cruces-capa1.tsx:51,75`, **no** en E-053.
  `grep -rn "Con qué sectores tuvo reuniones de lobby" app --include=*.tsx` lo confirma con un
  único call-site, y `page.tsx:682` demuestra que E-053 solo se monta con `tipo === "dato"`.
- **Después:** se auditan **ambos** emisores (§0.1 y §2 del fragmento), el veredicto del
  cero-como-cero se atribuye a la capa-1 (fila `3.b-7`) y el empty-state muerto de E-053 se
  registra aparte (fila `3.b-9`). Tomado al pie de la letra, el plan habría concluido "el cero se
  presenta mal" o habría transcrito un literal que **no está en el DOM**.

**2. [RULE-1] El universo del panel son 7 `tipo_senal`, no 6.**
- **Antes (plan/CONTEXT):** "Panel de actualidad — 6 señales × SQL".
- **Realidad:** `select tipo_senal, count(*) … group by 1` devuelve **7** tipos y **19** filas.
  Los 6 son los que materializa `actualidad.materializar_senales()`; el séptimo,
  `agrupacion_materia`, lo posee el **CLI k-means** y el proc lo excluye a propósito de su `delete`
  (0065:111-113). El `check` de 0065:52-54 declara los 7.
- **Después:** el fragmento cierra el denominador contra la base (§3.0) y registra la diferencia
  explícitamente, tal como 00-METODO §0.3 Grupo 4 lo exigía.

**3. [RULE-1] `agrupacion_materia` no tiene "primeros principios" en SQL — se declara el límite.**
- **Antes (plan, Task 2):** "por cada tipo … (b) la query de primeros principios que el proc de
  0065 materializa para ese tipo".
- **Realidad:** el proc de 0065 **no materializa** `agrupacion_materia`; su origen es un k-means
  sobre `proyecto_embedding` (cómputo, no query). Reproducirlo exigiría re-correr el clustering.
- **Después:** en vez de fabricar una réplica, se verificó la propiedad falsable disponible
  (`sum(conteo)` = `count(proyecto_embedding)` = `3100`: la partición no duplica ni pierde) y se
  declaró el límite **L-02.2**. Patrón "vacío honesto" aplicado al método, no solo a los datos.

**4. [RULE-1] El "cap" que el plan pedía reventar no existe — se registra igual.**
El plan preveía `discrepancia-corregida`/`-declarada` si `rows.length` topaba en el LIMIT.
`pg_get_functiondef` sobre PROD demuestra que no hay LIMIT y que el máximo de PROD es 47. Se
registró como fila de veredicto `cuadra` **con la query transcrita** (regla dura §0.1: un
"no encontré discrepancias" sin query es inválido), en vez de omitir el chequeo por negativo.

**5. [Desviación de proceso] Un solo commit para las 2 tareas.** Ambas escriben el **mismo**
archivo y el plan lo declara así en `files_modified`. Un commit por tarea habría dejado un commit
intermedio con §3/§4 ausentes y el `verify` automatizado de Task 2 en rojo. Se hizo **un commit**
(`8e248e5`) cuyo mensaje enumera Task 1 y Task 2 por separado. Mismo criterio que 122-01.

## Gotchas de método registrados (para 122-04/05/06)

**G-1 — El grep de "reuniones" pelado PIERDE señales.** `D1165` tiene 11 señales, dos de ellas con
`conteo = 1` ⇒ el DOM dice *"1 **reunión** con gestores…"* (singular). Un
`grep -o -E "[0-9]+ reuniones con gestores"` devuelve **9** y se leería como discrepancia falsa.
Patrón correcto: `[0-9]+ reuni[^ ]* con gestores`.

**G-2 — Suspense de React esconde filas del HTML inicial.** El cluster `421` **no** aparece en el
flujo principal del HTML de `/`: llega en `<div hidden id="S:1">…</div>` que `$RS` inyecta. Un
conteo ingenuo de conteos daría 17 en vez de 18 activos. Hay que buscar el número también fuera
del tile.

**G-3 — Backtracking catastrófico en HTML de una sola línea.** `grep -o -E 'Por materia</h2>.{0,9000}'`
**colgó el comando >120 s**. Para contar hijos de un tile, usar greps **literales** sobre el
marcador de fila (`grep -o -F '<!-- -->proyectos' | wc -l`), nunca un salto de miles de caracteres.

**G-4 — El literal `(sin cámara)` revienta el encoding de `psql -c` en Git Bash/Windows**
(`ERROR: invalid byte sequence for encoding "UTF8": 0xe1 0x6d 0x61`), pese a `PGCLIENTENCODING=UTF8`.
Se sustituyó por `'SIN-CAMARA'` en la query de primeros principios: cambia **solo la etiqueta del
grupo NULL**, jamás el conteo ni el agrupamiento. Queda documentado en el bloque `Q-18`.

**G-5 — Confirmado el separador `<!-- -->` de 122-01 §2.3 HALLAZGO B**, también en la landing:
`<span class="font-mono">452</span> <!-- -->proyectos`. Todos los greps del fragmento son
tolerantes (patrón sobre clase/tag, nunca sobre el literal armado).

## Cumplimiento del régimen (T-122-07 / -08 / -09 / -SC)

- **T-122-07:** cero cadenas de conexión Postgres en el artefacto (`grep -c -E "postgres(ql)?://"`
  → **0**); `SUPABASE_DB_URL` aparece solo como **nombre** de variable, nunca expandido ni ecoado.
- **T-122-08:** **cero DDL, cero DML**; `actualidad.materializar_senales()` **nunca se invocó**.
  Todas las queries del fragmento son `select`.
- **T-122-09:** cero PII — solo agregados, `sector.etiqueta` (catálogo público) e ids públicos de
  parlamentario. Cero RUT, cero email, cero nombre de contraparte de lobby
  (`grep -c -i -E "[0-9]{7,8}-[0-9kK]\b|@[a-z]+\.(cl|com)"` → **0**).
- **T-122-SC:** cero instalaciones de paquetes.
- Cero requests a fuentes gubernamentales (5 `curl` al Worker propio); cero flags tocados; cero
  deploy; cero archivos de `app/` o `supabase/` modificados.

## Self-Check: PASSED

- `122-CRUCES-SQL-02-CRUCES-ACTUALIDAD.md` existe (`git show --stat 8e248e5` → 1 archivo)
- `verify` de Task 1: `grep -q "## 2. Cruces de parlamentario"` → **PASS**;
  `grep -c "cruces_de_proyecto"` → **18**
- `verify` de Task 2: `grep -q "## 3. Panel de actualidad"` → **PASS**;
  `grep -q "## 4. Límites de este fragmento"` → **PASS**
- §1 tiene 2 sujetos (`14309-04` + `18296-05`) con nº SQL, nº deploy y veredicto
- §2 tiene `D1165` y `S1338`; el caso `S1338` incluye el `<section id="cruces">` literal completo
  que prueba el cero-como-cero
- Queda escrito que `cruces_de_proyecto`/`cruces_de_parlamentario` **no** son bounded y que el
  componente usa `.length` **honestamente** (§1.0)
- §3 tiene una fila por `tipo_senal` observado (7 tipos / 19 filas), cada una con nº RPC, nº de
  primeros principios y nº del DOM
- Toda señal con conteo 0 tiene su literal de DOM transcrito (`S1338`, `nuevos_ingresos`)
- 20 bloques ```sql numerados `Q-01`…`Q-24`; cada fila de veredicto referencia al menos uno
- Commit `8e248e5` existe; `git status --short` no lista ningún archivo de `app/` ni `supabase/`
  tocado por este plan
