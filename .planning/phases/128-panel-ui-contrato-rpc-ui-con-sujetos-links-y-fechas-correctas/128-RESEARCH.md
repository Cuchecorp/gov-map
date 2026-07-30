# Phase 128: PANEL-UI — Contrato RPC/UI con sujetos, links y fechas correctas - Research

**Researched:** 2026-07-30
**Domain:** Next.js 16 RSC + contrato jsonb `actualidad_senal.evidencia` (PROD) + régimen anti-insinuación
**Confidence:** HIGH (todo verificado contra el código del repo y contra PROD por `psql -tA | tr -d '\r'`, `PGCLIENTENCODING=UTF8`, read-only; cero web research, cero REST)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**RATIFICACIONES DEL OPERADOR (2026-07-30 — verbatim, LOCKED)**
- **O-1:** Opción A ratificada (evidencia jsonb — ya aplicada a PROD).
- **O-2:** Tile Votaciones L4 se construye VISIBLE (VSIM ON + sign-off legal 2026-07-30).
- **O-3:** Tile materia MUERE sin tombstone.
- **O-4:** Cruce urgencia↔citación (L5) como CHIPS dentro de los tiles 1-2 — yuxtaposición de dos hechos fechados, jamás relación. Molde: "Urgencia {grado} fechada el {d} · Citado el {d}".
- **O-5:** Tile SALA primero, comisiones segundo.
- **O-6:** Tile urgencias SIN link agregado de tile (los ítems cargan la navegación); el filtro de urgencia en /buscar queda FUERA de v13.0.
- **O-7:** Presupuesto de densidad: 4 ítems + "y N más →" por tile; el loop BrowserOS de 129 lo arbitra sobre el deploy real (puede BAJARLO con evidencia, no subirlo).

**Diseño de tiles (spike editorial §3.2, ratificado)**
- **D-01:** Grilla: 1 Sala-semana (L2) → 2 Comisiones citadas (L1+L5 chips+L6 ítem+L7 cobertura) → 3 Urgencias por grado (L3, conteo por BOLETINES distintos, "95" muere) → 4 Movimiento reciente → 5 Votaciones (L4) → 6 Ingresos/archivos fusionados. Tile materia AUSENTE del DOM.
- **D-02:** Datos desde `evidencia` jsonb de la RPC 0066 (firma intacta): `items[*]`, `total`, `consultado_al`, `fuente.{dataset,origen}` (fuenteLabel DESDE DATO, no mapa hardcodeado). NOTA post-0081: los ítems de agenda traen `puntos`/`tabla` (con ítems `boletin:null` incluidos, `en_corpus:false`) + `puntos_total`/`tabla_total` — renderizar por `materia` cuando no hay boletín; jamás asumirlo. `nuevos_ingresos` usa `cobertura_camara` como etiqueta de ventana (herencia 0065) — no leerla como cámara.
- **D-03:** Links: helper central NUEVO de links internos (`/proyecto/{b}#estado|#timeline|#votaciones`, `/agenda#...?semana=` usando `semana_iso` del jsonb). Ítems `en_corpus:false` → texto plano + enlace externo de la fuente. Regla 126 D-05: componentes nuevos con prefijo `components/panel-*` (el anti-drift muerde); si el helper emite labels visibles, alta en SUPERFICIES (126 D-08).
- **D-04:** L4 votaciones: una línea por votación (jamás agregada por boletín); Senado `resultado` NULL → "resultado no informado por la fuente" (jamás fabricar); conteos solo confirmados (283.550 global). Copy del carril más minado — linter como gate.
- **D-05:** Fechas 3 carriles: hecho con verbo en el cuerpo (idioms IMPORTADOS de `IDIOMS_APROBADOS` del guard 126 — single-source); footer SOLO `Fuente: {desde dato} · según fuente al {d}` (hechos pasados → fecha_max; agenda futura → consultado_al del jsonb); `"datos al"` = 0 ocurrencias (grep -o | wc -l); `fecha_captura` jamás visible.
- **D-06:** Cobertura declarada: "23 citaciones del Senado · 0 de la Cámara en las fuentes consultadas"; Cámara como "tabla semanal" (fila sintética `camara:sesion:2026-W31`, numero/tipo/hora NULL — jamás fabricar "Sesión N.º a las HH:MM"); ceros con denominador.
- **D-07:** Ingresos/archivos: "{N} eventos de {M} proyecto(s)" nombrando boletines — jamás "2 movimientos" que sugiera 2 proyectos. Urgencias: clave `descripcion` verbatim de fuente (0081 renombró `grado`→`descripcion`); si la UI muestra grado tipificado, lo deriva ELLA con fallback honesto al literal.

**Régimen**
- **D-08:** RSC puro (header del panel: NUNCA "use client"); `/` ya es force-dynamic; 1 RPC como hoy. Cero RPC nueva, cero allowlist.
- **D-09:** Todo copy nuevo pasa el carril PANEL del linter (SUPERFICIES_PANEL ya declara los 7 archivos previstos por 126); denylist viva (`señal`/`exprés`/`los más`/`captura` pelado...).
- **D-10:** El "queda bien" visual NO es de esta fase (129); esta fase cierra CORRECTITUD por tests + fragmentos DOM del render local.

### Claude's Discretion
- Composición interna de cada `panel-tile-*.tsx` (props, sub-vistas puras), siempre que los nombres de archivo sean los 7 congelados.
- Estrategia de derivación de grado tipificado desde `descripcion` (D-07 delega en la UI con fallback honesto).
- Forma exacta del contrato TS del jsonb (interfaces por señal vs unión discriminada).

### Deferred Ideas (OUT OF SCOPE)
- Filtro de urgencia en /buscar (O-6 lo dejó fuera).
- Tile "Por sector" variante B (REQUIREMENTS §Future).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Descripción | Research Support |
|----|-------------|------------------|
| PANEL-02 | Cada ítem enlaza a `/proyecto/{b}#ancla` o `/agenda…?semana=`; ningún link 404 (guard `en_corpus`); helper central nuevo | §Contrato del jsonb (flag `en_corpus` por ítem, verificado); §Anclas reales; §Pitfall P1 (orden `?query#hash`); §Inventario de hrefs |
| PANEL-03 | Propuesta editorial: sala, comisiones+cruce, urgencias por grado, movimiento nombrado, ingresos/archivos como proyectos, tile materia ELIMINADO | §Inventario de señales PROD (conteos reales); §Urgencias por grado (5/42/24 verificado); §Qué muere de panel-actualidad.tsx |
| PANEL-04 | Votaciones L4 visibles, una línea por votación, Senado `resultado` NULL honesto | §Fuente de datos L4 (tabla `public.votacion`, columnas reales, 1049/1049 NULL en Senado) |
| PANEL-05 | Fechas de 3 carriles; `"datos al"` desaparece; `fecha_captura` jamás visible | §Semántica de fechas; §Helpers de fecha existentes; §Validation (grep DOM) |
| PANEL-07 | Cobertura y asimetrías con denominador; Cámara como "tabla semanal"; vacío honesto con causa | §Cobertura verificada (23 Senado / 0 Cámara en citaciones); §Fila sintética `camara:sesion:2026-W31` (numero/tipo/hora NULL confirmado) |
</phase_requirements>

## Summary

El trabajo de esta fase es **wiring, no descubrimiento**: la migración 0080+0081 ya dejó en PROD todo lo que la UI necesita nombrar, y `SenalRow.evidencia` ya está declarado en `panel-actualidad.tsx:44` pero **jamás se lee**. Lo que falta es (a) tipar el jsonb por señal, (b) romper el tile genérico `TileSenal` en 6 tiles editoriales con nombres de archivo ya congelados por 126, (c) un helper central de links internos en `lib/`, y (d) una fuente de datos para el tile L4 que **no viene de la RPC** — la RPC 0066 no emite señal de votaciones, así que el tile 5 lee `public.votacion` directamente (precedente vivo: `actualidad-module.tsx:244`, tabla NO-PII, permitido por `lockdown-guard`).

El contrato del jsonb **no es homogéneo entre señales** y ese es el hallazgo más importante para el planner: `velocity` NO trae `descripcion` (el copy del spike §3.2 "Informe de Comisión Mixta…" **no es renderizable** con el dato actual), los ítems de `agenda_sala` **no traen `semana_iso`** (solo los de `agenda_citacion` lo traen — hay que derivarlo con `week-utils`), y la clave `quorum` de `tabla[]` significa cosas distintas por cámara: en Senado es numérico (`"1"`, `"5"`) y en Cámara es el **literal de urgencia** (`"SUMA (04.08.2026)"`, `"DISCUSIÓN INMEDIATA"`). Confundirlas sería un error de dato visible.

Los guards de 126 están vivos y muerden: los 7 nombres de archivo están dados de alta preventivamente y el anti-drift `(1f)` es **recursivo** — cualquier `panel-*.tsx` no declarado hace fallar el guard. `IDIOMS_APROBADOS` es exportado y debe **importarse**, no re-tipearse.

**Primary recommendation:** tipar el jsonb como unión discriminada por `tipo_senal` en un módulo nuevo `lib/panel-evidencia.ts` (parse defensivo, cero `as`), crear `lib/links-internos.ts` con orden `?query#hash` correcto y guard `en_corpus`, y construir los 6 tiles como vistas puras testeables con fixtures — exactamente el patrón `TileSenal`/`*View` que ya existe.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Agregación de señales + sujetos | Database (proc `materializar_senales` 0080/0081) | — | Ya hecho en 127; SEN-02 LOCKED prohíbe agregación on-read |
| Lectura de señales | Frontend Server (RSC, `sb.rpc`) | — | `/` es `force-dynamic`; service_role server-only |
| Lectura de votaciones (L4) | Frontend Server (RSC, `.from("votacion")`) | — | La RPC 0066 no emite votaciones; tabla NO-PII; precedente `actualidad-module.tsx` |
| Cruce L5 urgencia↔agenda | Frontend Server (render) | — | CONTEXT `<specifics>`: cruce EN RENDER, no señal nueva |
| Construcción de hrefs | Frontend Server (`lib/links-internos.ts`) | — | Puro, sin I/O; testeable sin DOM |
| Formato de fecha es-CL | Frontend Server (`lib/format.ts`, `lib/dia-calendario.ts`) | — | Helpers existentes con `timeZone:"UTC"` horneado |
| Copy / anti-insinuación | Guard CI (`anti-insinuacion-guard.test.ts`) | — | Carril PANEL ya declarado por 126 |

## Project Constraints (from CLAUDE.md)

- **GSD workflow enforcement:** ningún edit fuera de un comando GSD.
- **Next.js:** "This is NOT the Next.js you know" (`app/AGENTS.md`) — consultar `node_modules/next/dist/docs/` antes de escribir código de framework. Next 16 App Router, RSC por defecto.
- **Server-only:** cero llamadas a fuentes externas desde el cliente; API keys nunca en el bundle.
- **Trazabilidad:** cada dato con fuente, fecha y enlace; jamás intención ni causalidad.
- **Tailwind v4:** `bg-[var(--x)]` obligatorio; `-[--x]` bare **falla** `bento-guards` (A)/(cero-bare-var-shorthand).

---

## Contrato REAL del jsonb en PROD (VERIFICADO 2026-07-30)

Query: `select tipo_senal, jsonb_pretty(evidencia) from public.actualidad_senal where supresion_causa is null …`
(`psql -tA | tr -d '\r'`, `PGCLIENTENCODING=UTF8`, read-only; URL jamás ecoada).

### Inventario de filas vivas (8 filas + 10 de `agrupacion_materia`)

| tipo_senal | conteo | cobertura_camara | fecha_max | supresion_causa |
|---|---|---|---|---|
| `agenda_citacion` | 23 | `Senado` | 2026-08-10 | — |
| `agenda_sala` | 1 | `Cámara de Diputados` | 2026-08-03 | — |
| `agenda_sala` | 2 | `Senado` | 2026-08-05 | — |
| `urgencias` | 95 | NULL | 2026-07-22 | — |
| `velocity` | 2 | `Senado` | 2026-07-28 | — |
| `velocity` | 2 | `Cámara de Diputados` | 2026-07-24 | — |
| `archivados` | 2 | NULL | 2026-07-06 | — |
| `nuevos_ingresos` | 0 | `2022-2026 (piso de corpus)` | 2026-07-28 | `sin nuevos ingresos fechados en la ventana` |
| `agrupacion_materia` ×10 | 452/615/62/421/335/272/293/95/363/192 | NULL | NULL | — |

**[VERIFIED: psql PROD]** — La grafía de cámara ya es única (`Cámara de Diputados` / `Senado`), fix 127 confirmado. `agrupacion_materia` sigue emitiendo 10 filas: **el tile muere en la UI, la señal sigue en la DB** — el filtro es del cliente (D-01/O-3).

### Claves de nivel superior (TODAS las señales positivas, idénticas)

```
{ "items": [...], "total": N, "consultado_al": "2026-07-30",
  "fuente": { "origen": "...", "dataset": "..." } }
```

| tipo_senal | `fuente.dataset` | `fuente.origen` | `total` |
|---|---|---|---|
| `agenda_citacion` | `agenda` | `plataforma-agenda` | 23 |
| `agenda_sala` | `agenda` | `plataforma-agenda` | 1 / 2 |
| `urgencias` | `tramitacion` | `plataforma-tramitacion` | 95 |
| `velocity` | `tramitacion` | `plataforma-tramitacion` | 2 |
| `archivados` | `tramitacion` | `plataforma-tramitacion` | 2 |

`consultado_al = "2026-07-30"` en **todas** — este es el valor para el footer de las señales de agenda (hecho futuro), D-05. **[VERIFIED: psql PROD]**

La fila suprimida (`nuevos_ingresos`) conserva `evidencia = '{}'` — **no tiene `items`, `total`, `consultado_al` ni `fuente`**. El parse debe tolerarlo (path de supresión ya existente).

### Shape de `items[]` por señal — CLAVES EXACTAS

**`velocity`** (⚠ **NO trae `descripcion`**):
```json
{ "fecha": "2026-07-28", "enlace": "https://tramitacion.senado.cl/wspublico/tramitacion.php",
  "titulo": "Amplía la penalización dispuesta en el artículo 304 bis del Código Penal…",
  "boletin": "16569-25", "en_corpus": true, "enlace_evento": null }
```

**`archivados`** / **`urgencias`** (= velocity **+ `descripcion`**):
```json
{ "fecha": "2026-07-06", "enlace": "…", "titulo": "Modifica cuerpos legales…",
  "boletin": "16725-06", "en_corpus": true,
  "descripcion": "Cuenta, Comunicación de la diputada Romero…", "enlace_evento": null }
```
En `urgencias`, `descripcion` es el **grado**: `Suma` | `Simple` | `Discusión inmediata` (verbatim de fuente, 0081 renombró `grado`→`descripcion`).

**`agenda_citacion`** (ítem = citación; los sujetos viven anidados en `puntos[]`):
```json
{ "fecha": "2026-08-03", "enlace": "https://web-back.senado.cl/api/commissions_citations?limit=100",
  "comision": "de Medio Ambiente, Cambio Climático y Bienes Nacionales",
  "horario": "12:30 a 14:00", "semana_iso": "2026-W32",
  "puntos_total": 1,
  "puntos": [ { "boletin": null, "titulo": null, "enlace": null,
                "materia": "Recibir al Alcalde de la comuna de Concepción…",
                "posicion": 0, "en_corpus": false } ] }
```

**`agenda_sala`** (⚠ **NO trae `semana_iso`**):
```json
{ "fecha": "2026-08-04", "tipo": "Ordinaria", "numero": "47", "hora_inicio": "16:00",
  "enlace": "https://web-back.senado.cl/api/weekly_table?limit=100",
  "tabla_total": 5,
  "tabla": [ { "boletin": "14782-13", "titulo": "Equipara el derecho de sala cuna…",
               "enlace": "https://tramitacion.senado.cl/wspublico/tramitacion.php",
               "materia": "Proyecto de ley, iniciado en Mensaje… (Boletín Nº 14.782-13)…",
               "posicion": 1, "quorum": "5", "en_corpus": true,
               "parte_sesion": "ORDEN DEL DÍA" } ] }
```

**Fila sintética de Cámara** (D-06) — ítem scalars verificados:
```json
{ "tipo": null, "numero": null, "hora_inicio": null, "fecha": "2026-08-03",
  "enlace": "https://www.camara.cl/verDoc.aspx?prmId=0&prmTipo=TABLASEMANAL",
  "tabla_total": 25 }
```
`sesion_sala.id = 'camara:sesion:2026-W31'`, `numero/tipo/hora_inicio` NULL en la tabla base. **[VERIFIED: psql PROD]** — jamás fabricar "Sesión N.º X a las HH:MM" para Cámara.

### ⚠ `quorum` significa DOS cosas distintas según cámara

| Cámara | Valores reales de `tabla[].quorum` |
|---|---|
| Senado (`senado:sesion:10240/10241`) | `"1"`, `"5"` — quórum numérico |
| Cámara (`camara:sesion:2026-W31`) | `"SUMA (04.08.2026)"`, `"DISCUSIÓN INMEDIATA"`, `"SIMPLE (12.08.2026)"`, `null` |

**[VERIFIED: psql PROD]** — Este es el chip de urgencia de la tabla de Cámara del spike (Tile 1). Renderizar `quorum` como "quórum" en Cámara sería un dato falso; renderizarlo como urgencia en Senado también. **Regla: derivar por cámara, con fallback a no mostrar.** El `(04.08.2026)` adjunto tiene semántica NO verificada (R7 del spike) → **no afirmarla**, mostrar solo el grado.

### Paridad y flags verificados

| Métrica | Valor PROD |
|---|---|
| Urgencias: eventos vs boletines distintos por grado | `Suma` 57 ev / **42 bol** · `Simple` 24 / **24** · `Discusión inmediata` 14 / **5** |
| `en_corpus:false` en items de nivel 1 (`urgencias`/`velocity`/`archivados`) | **0 de 95 / 0 de 4 / 0 de 2** (sin riesgo 404, confirma spike) |
| `agenda_citacion`: puntos con boletín / total / `en_corpus:true` | **20 / 31 / 17** |
| Cámara sala `tabla_total` | 25 |
| Boletines de agenda con urgencia (cruce L5, distintos) | **13 boletines** (`12712-24`, `14782-13`, `18258-07`, `18389-04`, …) |

Los conteos de urgencias **coinciden exactamente** con el spike (5/42/24). El "95" que debe morir es el `conteo` de eventos. **[VERIFIED: psql PROD]**

⚠ **Cruce L5 — un boletín tiene VARIAS urgencias** (`14782-13` tiene 4 fechas distintas; `18389-04` es `Simple 2026-07-06` y luego `Suma 2026-07-08`). La regla debe ser **la más reciente por `fecha`**, no la de mayor grado (ordenar por grado sería un ranking implícito y además fabricaría un hecho). Idiom aprobado: `vigente desde`.

---

## Dónde vive L4 (votaciones) — la RPC 0066 NO las trae

**Fuente exacta: tabla `public.votacion`, lectura directa `.from("votacion")`.**

Columnas reales (`information_schema`, **[VERIFIED: psql PROD]**):

| columna | tipo | nullable |
|---|---|---|
| `id` | text | NO |
| `boletin` | text | NO |
| `fecha` | timestamptz | SÍ |
| `etapa` | text | SÍ |
| `tipo` | text | SÍ |
| `quorum` | text | SÍ |
| `resultado` | text | SÍ |
| `total_si` / `total_no` / `total_abstencion` / `total_pareo` | integer | NO |
| `camara` | text | NO |
| `origen` | text | NO |
| `fecha_captura` | timestamptz | NO |
| `enlace` | text | NO |

⚠ **No existen columnas `si`/`no`/`abstencion`** — son `total_*`.

**Régimen:** `votacion` **NO** está en `PII_TABLES` (`lockdown-guard.test.ts:150-165`) ⇒ `.from("votacion")` desde el árbol público es **legal** y ya tiene precedente vivo: `app/components/actualidad-module.tsx:244` (`VotadoEstaSemana`) y `app/app/proyecto/[boletin]/page.tsx:302,562`. **Cero RPC nueva, cero allowlist** (respeta D-08). No hay ninguna RPC de votaciones en `PUBLIC_RPC_ALLOWLIST`.

**Estado del dato:**

| camara | filas | `resultado` NULL | max(fecha) |
|---|---|---|---|
| `diputados` | 3.806 | **0** | 2026-07-22 |
| `senado` | 1.049 | **1.049 (100 %)** | 2026-07-22 |

**[VERIFIED: psql PROD]** — Confirma D-04: en Senado **jamás** hay resultado; "resultado no informado por la fuente" es el path normal, no el borde.

Filas reales del 2026-07-22 (las del spike):
```
18216-05 | diputados | Aprobado | si=80  no=48 abs=2  | Única | COMISIÓN MIXTA
18384-08 | diputados | Aprobado | si=117 no=4  abs=8  | Única | TERCER TRÁMITE
18259-08 | diputados | Aprobado | si=124 no=1  abs=3  | Particular | PRIMER TRÁMITE
18384-08 | senado    | <NULL>   | si=40  no=0  abs=0  | Discusión general | Segundo trámite constitucional
17012-14 | senado    | <NULL>   | si=8   no=26 abs=0  | Discusión única | Tercer trámite constitucional
```
`18384-08` tiene **6 votaciones el mismo día en Senado** — evidencia directa de por qué D-04 prohíbe agregar por boletín.

**Grafía de cámara:** `votacion.camara` es `"diputados"` / `"senado"` **en minúscula** — NO pasó por el fix del materializador (que solo tocó `actualidad_senal`). El tile L4 debe normalizar a `Cámara de Diputados` / `Senado` en el cliente para no romper la grafía única del panel. Helper existente reutilizable: `CamaraChip` (`components/camara-chip.tsx`, `classify()` acepta `"diputados"`), aunque su label es `"Cámara"` (corto) — evaluar en el planner si el chip sirve o hace falta una función `grafiaCamaraCiudadana()` local.

**PostgREST cap 1k:** relevante solo si se pidieran >1000 filas. El tile pide 4 con `.order("fecha",{ascending:false}).limit(N)` ⇒ **no aplica**. Pero ⚠ **`order by fecha desc` sin desempate no es determinista** (gotcha B-01/D-03 del milestone): usar `.order("fecha",{ascending:false}).order("id",{ascending:false})` para un orden total.

⚠ **Títulos:** `votacion` no tiene título de proyecto. `actualidad-module.tsx` resuelve con un `leerTitulos(sb, boletines)` (lookup NO-PII sobre `proyecto`) — reutilizar ese patrón.

**Flag VSIM:** `vsimPublicEnabled()` (`lib/vsim-gate.ts`) gatea **similitud de votación** (`/comparar`), no el hecho de votación. El tile L4 muestra hechos factuales, ya públicos en `/proyecto#votaciones` sin gate. El planner debe decidir explícitamente si el tile se envuelve en el gate; **el flag jamás se flipea por agente** (ya está ON según memoria + sign-off legal 2026-07-30, así que en ambos casos el tile se ve).

---

## Helper central de links internos (`app/lib/links-internos.ts`)

### Inventario de hrefs dispersos hoy (**11 archivos**, `/proyecto/…`)

| Archivo | Línea | Patrón |
|---|---|---|
| `app/agenda/page.tsx` | 84, 268 | `/proyecto/${q}` (redirect), `/proyecto/${c.boletin}` |
| `app/buscar/page.tsx` | 53 | `/proyecto/${q}` |
| `app/proyecto/[boletin]/page.tsx` | 129 | `/proyecto/${boletin}` |
| `components/actualidad-module.tsx` | 222, 327 | `/proyecto/${it.boletin}` |
| `components/capa1/tramitacion-stepper.tsx` | 137 | `/proyecto/${boletin}?${qs}#timeline` ← **único con orden correcto** |
| `components/citacion-card.tsx` | 130 | `/proyecto/${boletin}` |
| `components/mencion-boletin-chip.tsx` | 41 | `/proyecto/${boletin}` |
| `components/sala-table-section.tsx` | 94 | `/proyecto/${item.boletin}` |
| `components/search-result-card.tsx` | 85 | `/proyecto/${boletin}` |
| `components/timeline-view.tsx` | 243 | `/proyecto/${boletin}${q?`?${q}`:""}#timeline` |
| `components/voto-ficha-row.tsx` | 119,126,200,207 | `/proyecto/${voto.boletin}` |
| `components/votos-por-parlamentario.tsx` | 483, 490 | `/proyecto/${grupo.boletin}` |
| `lib/agenda-buscar.ts` / `lib/buscar.ts` | 64 / 196 | `/proyecto/${…}` (redirects) |

**Ninguno usa anclas salvo `#timeline`** (2 sitios). El helper es net-new; **no** hace falta migrar los call-sites existentes en esta fase (alcance = panel), pero el planner puede declararlo como superficie única para el panel.

**Ubicación:** `app/lib/links-internos.ts`. **[VERIFIED: guard test]** — el anti-drift `(1f)` solo escanea `app/components/`, y el comentario de `SUPERFICIES_PANEL` dice explícitamente: *"NO entra a este array (D-08): el helper central de links internos de la Phase 128 vive en `lib/` y emite hrefs, no copy renderizado… Si ese helper terminara emitiendo labels visibles, 128 debe sumarlo explícitamente a SUPERFICIES_PANEL."* ⇒ **el helper NO debe emitir labels visibles**; si emite texto, hay que darlo de alta.

### Anclas que existen REALMENTE

`app/app/proyecto/[boletin]/page.tsx` — `<section id="…">`:
`estado` (140) · `timeline` (153) · `votaciones` (162) · `autores` (177) · `lobby-tramitacion` (196) · `lobby-menciones` (215) · `cruces` (235) · `idea-matriz` (242) · `cuerpos-legales` (249) · `similares` (258) · `validacion-fuente` (272).

⚠ `#cruces` está detrás de un gate (Candado B) — el ancla puede no montarse. Las 3 que el panel usa (`#estado`, `#timeline`, `#votaciones`) **son incondicionales**. **[VERIFIED: codebase]**

`app/app/agenda/page.tsx` — `resultados` (113) · `citaciones` (139) · `tabla-sala` (146). **[VERIFIED: codebase]**

`/agenda` acepta `?semana=YYYY-Www` (`page.tsx:74-75`, `parseISOWeek` degrada a semana actual sin redirect).

### ⚠ Pitfall P1 — el orden `?query#hash` del spike/CONTEXT es INVÁLIDO

El spike §3.2 y el CONTEXT D-03 escriben `/agenda#tabla-sala?semana=2026-W32`. En una URL el **query va ANTES del fragmento**: escrito así, `?semana=…` queda **dentro del fragmento** y Next nunca lo lee como searchParam ⇒ la semana se ignora silenciosamente y `parseISOWeek` cae a la semana actual (degradación muda, no error).

**Forma correcta:** `/agenda?semana=2026-W32#tabla-sala`. Precedente correcto en el repo: `tramitacion-stepper.tsx:137` (`/proyecto/${boletin}?${qs}#timeline`). El helper debe construirlo así y un unit test debe morder el orden invertido.

### Fuente de `semana_iso` — asimétrica

- `agenda_citacion.items[].semana_iso` = `"2026-W32"` ✓ presente.
- `agenda_sala.items[]` **NO tiene `semana_iso`** ⇒ derivar de `items[].fecha` con `semanaIsoKey(...isoWeekOf(new Date(fecha)))` de `lib/week-utils.ts`.

⚠ `fecha` es **date-only** (`"2026-08-04"`); `new Date("2026-08-04")` se parsea como medianoche **UTC** y `isoWeekOf` opera en UTC ⇒ correcto, sin tz shift. Nunca convertir a zona de Chile (gotcha rector v9.0/v12.0).

---

## Componentes y utilidades reutilizables

| Utilidad | Ubicación | Qué da | Nota |
|---|---|---|---|
| `isoWeekOf`, `semanaIsoKey`, `parseISOWeek`, `getWeekBounds`, `formatWeekLabel` | `lib/week-utils.ts` | semana ISO anclada al jueves, todo en UTC | `formatWeekLabel` → `"Semana 32 · 3–9 ago 2026"` |
| `fechaCivilCorta(iso)` | `lib/dia-calendario.ts:115` | date-only → `"10 ago 2026"` sin tz shift | Para **agenda** (hecho futuro) |
| `fechaCorta(Date)` | `lib/format.ts:49` | timestamp → es-CL con `timeZone:"UTC"` horneado | Para hechos pasados |
| `fechaHechoCorta(Date, fallback)` | `lib/format.ts:84` | igual + fallback `"fecha no informada"` | Usado por `actualidad-module` |
| `fechaHechoCortaSegura` / `fechaCortaSegura` | `lib/format.ts:106,275` | + `fechaPlausible` | Para fechas de fuente no confiable |
| `conteoVotacion(si,no)` | `lib/format.ts:250` | string de conteo | Candidato para el tile L4 |
| `VOTO_PRESENTACION`, `LEYENDA_ANTI_INSINUACION` | `lib/voto-presentacion.ts` | vocabulario de voto sancionado | El carril más minado (D-04) |
| `CamaraChip` | `components/camara-chip.tsx` | chip Cámara/Senado; `classify()` tolera `"diputados"` | Labels cortos (`"Cámara"`) |
| `BentoTile` / `BentoGrid` | `components/bento/` | `span: 2|4|6`, `asChild` | El panel emite un `BentoTile` por tile |
| `estado-bucket.ts` | `lib/` | buckets de estado | No necesario para el panel |

**`rotuloFecha` / `fuenteLabel`** viven hoy en `panel-actualidad.tsx` y están exportados y testeados — ver §Qué muere.

### Guards que asertan sobre la grilla / el estilo

| Guard | Qué muerde |
|---|---|
| `bento-guards.test.ts` (A) cero-hex | literal hex en archivos bento; `href="#abc"` y `url(#abcdef)` exentos (WR-03) |
| `bento-guards.test.ts` tipografía | arbitrary values fuera de whitelist: `text-[13px]`, `text-[11px]`, `px-[9px]`, `gap-[14px]`, `w-[3px]`, `rounded-[2px]` **ya sancionados** por el panel actual; un `text-[12px]` nuevo **falla** |
| `bento-guards.test.ts` cero-bare-var-shorthand | escanea **`app/components/**` completo**: `bg-[--camara]` falla, `bg-[var(--camara)]` pasa |
| `bento-coherencia-guard.test.ts` | firewall `card.tsx` sin `radius-tile`; exclusión `/red` |

⇒ los tiles nuevos deben **reusar las clases arbitrarias ya sancionadas** del `TileSenal` actual, o el planner debe prever el alta en la whitelist (archivo `bento-guards.test.ts`).

---

## Qué se conserva vs qué muere en `app/components/panel-actualidad.tsx` (315 líneas)

| Líneas | Elemento | Veredicto |
|---|---|---|
| 1-4 | imports (`createServerSupabase`, `fechaCorta`, `fechaCivilCorta`, `BentoTile`) | **CONSERVA** |
| 6-32 | docblock con reglas A-F | **REESCRIBE** (regla F muere con el tile materia; añadir reglas de links/fechas) |
| 34-45 | `interface SenalRow` (9 cols, `evidencia: Record<string,unknown>` **nunca leída**) | **CONSERVA la interfaz**, añade el tipado de `evidencia` |
| 47-56 | `TITULO` (7 títulos) | **MUERE** — los 6 tiles nuevos llevan título propio editorial |
| 58-68 | `FRAMING` ("N trámites en 7 días", "95 urgencias…") | **MUERE** — los contadores sin sujeto son el defecto raíz |
| 70-80 | `ORDEN_TIPO` (7 tipos, `agrupacion_materia` incluido) | **REEMPLAZA** por el orden D-01 (6 tiles, sin materia) |
| 82-85 | `TIPOS_AGENDA` set | **CONSERVA** |
| 87-92 | `fechaValida` | **CONSERVA** |
| 94-126 | `rotuloFecha(tipo, iso)` (+ docblock F-14/WR-05) | **CONSERVA** — exportada y con 5 tests; es el ruteo date-only correcto |
| 128-141 | `fuenteLabel(tipo, cobertura)` **mapa hardcodeado** | **MUERE** (D-02: la fuente sale de `evidencia.fuente.{dataset,origen}`) |
| 143-154 | `claseCamara(cobertura)` barra cívica 3px | **CONSERVA** (regla A: sin cámara → sin barra) |
| 160-255 | `TileSenal` — tile genérico, contador + chip + footer `datos al` | **MUERE** → 6 componentes `panel-tile-*.tsx` |
| **245** | `{rotulo && <> · datos al {rotulo}</>}` | **⚠ ÚNICA ocurrencia funcional de `"datos al"` en todo `app/`** (la otra, línea 236, es un comentario). Matarla cierra PANEL-05 |
| 257-269 | `SPAN_TIPO` | **REEMPLAZA** por spans de los 6 tiles nuevos |
| 271-315 | `PanelActualidad()` async: `sb.rpc("actualidad_senales_panel",{p_tipo:null})`, throw-on-error (#34), `porTipo` Map, `ORDEN_TIPO.filter` | **CONSERVA la mecánica**; cambia el ruteo a los tiles nuevos + añade la lectura de `votacion` para L4 |

**Regla C (supresión = causa verbatim como cuerpo) se CONSERVA íntegra** — sigue viva para `nuevos_ingresos` (conteo=0, causa verbatim en PROD).

`app/app/page.tsx:5,138` monta `<PanelActualidad />` dentro de `<BentoGrid>` con `<Suspense>`; `export const dynamic = "force-dynamic"` (línea 15) es load-bearing. **No tocar.**

## Tests existentes de panel-actualidad (`panel-actualidad.test.tsx`, 237 líneas)

`makeSenal()` (fixture `SenalRow` con `evidencia: {}`) + 6 `describe`:

| Describe | Qué asserta | Veredicto |
|---|---|---|
| señal ACTIVA (velocity) | conteo `42` + `/trámites en 7 días/` + chip `C.Diputados` | **MUERE** (FRAMING muere; además el literal `C.Diputados` ya no existe en PROD — hoy es `Cámara de Diputados`) |
| — mismo — 2º test | `/Fuente:/` + **`/datos al/`** + `/jul 2026/` | **MUERE e INVIERTE**: el nuevo test debe asertar `según fuente al` y **`expect(texto).not.toContain("datos al")`** |
| — 3º test | ausencia de `top`/`los más` | **CONSERVA** (ampliar denylist) |
| WR-01 chip nunca filtra `30d`/`futuras` | token interno ausente | **CONSERVA** — invariante viva |
| WR-02 títulos distintos agenda | headings `Citaciones próximas`/`Sesiones de sala` | **REEMPLAZA** por los títulos editoriales nuevos |
| señal SUPRIMIDA | causa verbatim + `en las fuentes consultadas al` + cero `"0"` mudo | **CONSERVA** |
| `(sin materia)` ×2 | render verbatim de materia | **MUERE** con O-3 |
| F-14 `rotuloFecha` (5 tests) | `"10 ago 2026"`, no ISO, sin correr el día, null honesto, mismo formato ambas ramas | **CONSERVA íntegro** |

⚠ El fixture debe actualizarse: `cobertura_camara: "C.Diputados"` es **stale** — PROD emite `"Cámara de Diputados"` desde 127. Un fixture stale hace pasar tests sobre una grafía que ya no existe.

## Naming congelado por 126 (D-06) — los 7 archivos de `SUPERFICIES_PANEL`

`app/lib/anti-insinuacion-guard.test.ts:323-332`:

```
components/panel-actualidad.tsx        ← ya existe
components/panel-tile-sala.tsx         ← Tile 1 (L2)
components/panel-tile-comisiones.tsx   ← Tile 2 (L1+L5+L6+L7)
components/panel-tile-urgencias.tsx    ← Tile 3 (L3)
components/panel-tile-movimiento.tsx   ← Tile 4 (velocity)
components/panel-tile-votaciones.tsx   ← Tile 5 (L4)
components/panel-tile-ingresos.tsx     ← Tile 6 (nuevos_ingresos+archivados)
components/panel-item-proyecto.tsx     ← ítem nombrado reusable
```

(Son **8** entradas, no 7: `panel-actualidad.tsx` + 7 nuevas.) **[VERIFIED: codebase]**

**Anti-drift `(1f)` es RECURSIVO** (`:1157-1196`, WR-04): escanea `app/components/` con `readdirSync(..., {recursive:true})` y muerde `(^|\/)panel-.+\.tsx$` **y** `^panel[^/]*\/.+\.tsx$` (un `components/panel/tile-sala.tsx` también cae). Excluye `*.test.tsx`. Compara contra `TODAS_LAS_SUPERFICIES`, no solo `SUPERFICIES_PANEL`. ⇒ **cualquier archivo fuera de esos 8 nombres rompe el guard en el mismo commit**; el alta debe ir en el mismo commit.

**`IDIOMS_APROBADOS`** (`:766-777`, **exportado**) — importar verbatim, no re-tipear:
```ts
["Citado el", "vigente desde", "En tabla de sala de la Cámara del", "según fuente al"]
```
⚠ El stem es `"vigente desde"` — **no** `"fechada el"`. El CONTEXT O-4 propone el molde *"Urgencia {grado} fechada el {d}"* y el spike usa ambos. **El planner debe elegir el idiom registrado (`vigente desde`) o dar de alta el nuevo stem en `IDIOMS_APROBADOS` en Wave 0** — este es el hueco de régimen más probable de la fase.

Si algún copy nuevo **NIEGA** un término prohibido, debe registrarse verbatim en `NEGACIONES_LOCKED` **ANTES** de que la superficie entre al scan (Pitfall 3, lección BLOCKER 91).

---

## Architecture Patterns

### Diagrama de flujo

```
┌── PROD Postgres ──────────────────────────────────────────┐
│  actualidad_senal (8+10 filas, evidencia jsonb poblada)    │
│  votacion (4.855 filas, NO-PII)                            │
│  proyecto (títulos, lookup NO-PII)                         │
└──────────┬───────────────────────────┬─────────────────────┘
           │ rpc actualidad_senales_   │ .from("votacion")
           │ panel(p_tipo:null)        │ .order(fecha desc, id desc).limit(N)
           ▼                           ▼
┌── app/components/panel-actualidad.tsx (RSC async, service_role) ──┐
│  throw-on-error (#34) · filas: SenalRow[] · Map porTipo            │
│  parse evidencia → lib/panel-evidencia.ts (unión discriminada)     │
│  cruce L5 EN RENDER: urgencias.items ⋈ boletín ⋈ agenda items      │
│  filtra 'agrupacion_materia' (O-3, muere sin tombstone)            │
└───┬───────┬────────┬────────┬─────────┬────────┬──────────────────┘
    ▼       ▼        ▼        ▼         ▼        ▼
  sala  comisiones urgencias movimiento votaciones ingresos   ← panel-tile-*.tsx (vistas puras)
    └───────┴────────┴────────┴─────────┴────────┘
                     │ usa
                     ▼
      panel-item-proyecto.tsx  ──► lib/links-internos.ts
        · en_corpus true  → <Link href={hrefProyecto(b,"estado")}>
        · en_corpus false → texto plano + <a href={enlace fuente}> rel=noopener
                     │
                     ▼  footer (D-05, carril 3)
        `Fuente: {fuente.dataset legible} · según fuente al {consultado_al|fecha_max}`
```

### Pattern 1: vista pura + wrapper async (ya establecido en el repo)
**Qué:** `export async function X()` lee la DB; `export function XView({items})` renderiza. El test importa solo `XView` y le pasa fixtures — cero DB, cero mocks de red.
**Cuándo:** todos los tiles.
**Fuente:** `panel-actualidad.tsx:160` (`TileSenal`) y `actualidad-module.tsx:239/294` (`VotadoEstaSemana`/`VotadoEstaSemanaView`).

### Pattern 2: parse defensivo del jsonb
`evidencia` llega como `Record<string, unknown>` deserializado por supabase-js. **No usar `as ItemUrgencia[]`.** Un narrowing con type-guards por clave (o zod, ya en el stack) mantiene honesto el path de datos ausentes: `puntos` puede faltar, `numero` puede ser `null`, `descripcion` no existe en `velocity`.

### Pattern 3: guard `en_corpus` en el punto de link
```tsx
// Source: contrato 0081 verificado en PROD
{it.en_corpus && it.boletin
  ? <Link href={hrefProyecto(it.boletin, "estado")}>{it.boletin} — {it.titulo}</Link>
  : <><span>{it.materia}</span> <a href={it.enlace ?? enlaceSenal} target="_blank" rel="noopener noreferrer">fuente</a></>}
```
⚠ Para los ítems `en_corpus:false`, `titulo` y `enlace` son **null** — el texto disponible es `materia` (a veces un párrafo de 400 caracteres; el planner debe definir un truncado honesto, p.ej. `extractoIdea` de `format.ts:235`).

### Anti-patterns a evitar
- **`as` sobre el jsonb** — el parse silencioso convierte una clave ausente en `undefined` renderizado.
- **Agregar votaciones por boletín** — `18384-08` tiene 6 el mismo día (D-04).
- **`order by fecha desc` sin desempate** — no determinista (gotcha B-01); desempatar por `id`.
- **`"use client"` en el panel** — D-08, RSC puro.
- **Mostrar `quorum` como quórum en Cámara** o como urgencia en Senado.
- **`bg-[--x]` bare** — falla `bento-guards`.
- **Contar eventos donde el hecho es el proyecto** — "95 urgencias" / "2 movimientos".

## Don't Hand-Roll

| Problema | No construir | Usar | Por qué |
|---|---|---|---|
| Semana ISO desde una fecha | aritmética propia | `isoWeekOf` + `semanaIsoKey` (`lib/week-utils.ts`) | ancla al jueves, años de 53 semanas, todo en UTC |
| Fecha date-only → es-CL | `new Date(...).toLocaleDateString()` | `fechaCivilCorta` | conversión de zona correría el día |
| Fecha timestamp → es-CL | `Intl` ad-hoc | `fechaCorta` / `fechaHechoCorta` | `timeZone:"UTC"` ya horneado (117-01) |
| Chip de cámara | mapa nuevo | `CamaraChip` (`classify()` tolera `"diputados"`) | omite el chip si la cámara no aplica (B8) |
| Validación de shape jsonb | ifs anidados | `zod` (ya en el stack) o type-guards explícitos | el contrato no es homogéneo entre señales |
| Truncado de texto largo | `slice(0,N)` | `extractoIdea(idea, max)` (`format.ts:235`) | corta en palabra, sin cortar tildes |

**Key insight:** la fase entera es cableado sobre infraestructura existente; cada helper hand-rolled es un carril nuevo que los guards no cubren.

## Common Pitfalls

### P1 — Orden `?query#hash` invertido
**Qué falla:** `/agenda#tabla-sala?semana=2026-W32` mete el query dentro del fragmento; Next no lo ve y `parseISOWeek` cae mudamente a la semana actual.
**Cómo evitar:** `/agenda?semana=…#tabla-sala`; unit test que muerda el orden.
**Señal temprana:** el link "abre" la agenda pero siempre en la semana de hoy.

### P2 — `velocity` no trae `descripcion`
**Qué falla:** el copy del spike Tile 4 (*"Informe de Comisión Mixta…"*) no es renderizable: los items de `velocity` solo tienen `fecha/enlace/titulo/boletin/en_corpus/enlace_evento`.
**Cómo evitar:** Tile 4 muestra `titulo` + `trámite del {fecha}` + cámara desde `cobertura_camara` de la fila. **No inventar la descripción del trámite.** (`archivados` y `urgencias` sí traen `descripcion`.)

### P3 — `agenda_sala` sin `semana_iso`
**Cómo evitar:** derivar con `week-utils` desde `items[].fecha`; nunca hardcodear.

### P4 — `quorum` polisémico por cámara
Ver §Contrato. Derivar por cámara; ante duda, no mostrar.

### P5 — Fixture con grafía stale (`"C.Diputados"`)
Los tests actuales pasarían sobre una grafía que PROD ya no emite. Actualizar el fixture a `"Cámara de Diputados"` / `"Senado"`.

### P6 — Idiom `"fechada el"` no está en `IDIOMS_APROBADOS`
El array registrado tiene `"vigente desde"`. Usar el registrado o dar de alta el nuevo en Wave 0, antes del copy.

### P7 — Múltiples urgencias por boletín en el cruce L5
`14782-13` tiene 4; `18389-04` pasa de `Simple` a `Suma`. Tomar la **más reciente por fecha**; ordenar por grado sería ranking implícito.

### P8 — `agrupacion_materia` sigue viva en la DB
O-3 mata el **tile**, no la señal: `PanelActualidad` debe filtrarla explícitamente. Si el ruteo se hace por "lo que llegue", los 10 tiles de `(sin materia)` reaparecen.

### P9 — Arbitrary values de Tailwind fuera de la whitelist
`bento-guards` muerde un `text-[12px]` nuevo. Reusar las clases ya sancionadas del `TileSenal` actual.

### P10 — Cámara sala: `numero`/`tipo`/`hora_inicio` NULL
Verificado en PROD (`camara:sesion:2026-W31`). El render debe decir solo el día + "tabla semanal"; jamás "Sesión N.º".

## State of the Art (dentro del proyecto)

| Antes | Ahora | Cuándo | Impacto |
|---|---|---|---|
| `evidencia` vacía en la DB | `evidencia` poblada con sujetos, `total`, `consultado_al`, `fuente` | 0080+0081, Phase 127 | el panel puede nombrar sujetos sin RPC nueva |
| clave `grado` en urgencias | clave `descripcion` | 0081 | D-07: si la UI quiere grado tipificado lo deriva ella |
| grafías `C.Diputados`/`camara`/`senado` mezcladas | `Cámara de Diputados` / `Senado` en `actualidad_senal` | 0080 (`actualidad.grafia_camara`) | fixtures de test quedaron stale; `votacion.camara` NO fue tocada |
| agenda sin `puntos_total`/`tabla_total` | totales anidados + ítems `boletin:null` con `en_corpus:false` | 0081 | "y N más →" honesto (O-7) sin re-consultar |

**Obsoleto:** `FRAMING`/`TITULO`/`fuenteLabel` hardcodeados; el mapa estático de fuente muere con D-02.

## Assumptions Log

| # | Claim | Sección | Riesgo si es falso |
|---|---|---|---|
| A1 | El tile L4 no necesita envolverse en `vsimPublicEnabled()` (gatea similitud, no el hecho de votación) | §L4 | Si el operador lee el gate como cobertura de todo lo de voto, el tile se publicaría fuera del gate previsto — **decisión explícita del planner, no por defecto** |
| A2 | `leerTitulos` de `actualidad-module.tsx` es reutilizable tal cual para el lookup de títulos de L4 | §L4 | Habría que escribir un lookup nuevo (bajo impacto) |
| A3 | Los 3 anclas del panel (`#estado`/`#timeline`/`#votaciones`) se montan siempre en la ficha | §Anclas | Verificado por lectura del JSX (no están tras gate), pero no probado en runtime — Phase 129/138 lo cierra sobre el deploy |
| A4 | El total global de votos confirmados (283.550) no se muestra en el panel (el tile muestra conteos por votación) | D-04 | Si el planner quisiera un total agregado, hay que re-medirlo contra PROD antes de mostrarlo |

## Open Questions (RESOLVED)

> **Cierre B-2 del plan-checker (2026-07-30):** las 4 preguntas quedaron adjudicadas en los planes:
> Q1 (idiom `vigente desde` vs `fechada el`) → RESUELTA en 128-01: se registra `fechada el` + las
> variantes de género/número (`fechado el`, `fechadas en`, `En tabla de sala del`) en el
> single-source NUEVO `app/lib/idioms-panel.ts` (fix B-4: el guard importa DESDE ahí, dirección
> LEYENDA_*; los tiles importan genuinamente). Q2 (texto en_corpus:false) → RESUELTA en 128-01/03:
> `extractoIdea(…,120)` + enlace externo, cero link interno. Q3 (chip Cámara: quorum vs cruce L5)
> → RESUELTA en 128-03: cruce L5; el literal `quorum` de Cámara NO se renderiza como quórum.
> Q4 (migrar los 14 call-sites de /proyecto/ al helper) → RESUELTA en 128-01: NO en esta fase —
> deuda declarada en el SUMMARY.

1. **Idiom de urgencia: `vigente desde` (registrado) vs `fechada el` (spike/O-4)**
   - Sabemos: `IDIOMS_APROBADOS` solo contiene `"vigente desde"`.
   - Falta: cuál usa el copy final.
   - Recomendación: Wave 0 decide — usar el registrado, o dar de alta el nuevo stem **antes** de escribir copy.

2. **Texto de los ítems `en_corpus:false`** (título y enlace son null; solo hay `materia`, a veces 400+ caracteres)
   - Recomendación: `extractoIdea(materia, ~120)` + enlace externo de la señal; el loop 129 arbitra el largo.

3. **Chip de urgencia en Tile 1 (Cámara): `quorum` literal vs cruce L5 con `urgencias`**
   - Ambos existen (`"SUMA (04.08.2026)"` en `quorum` de Cámara; el cruce por boletín da la urgencia fechada).
   - Recomendación: usar el **cruce L5** como fuente única (mismo molde en ambos tiles, fecha verificable); el `quorum` de Cámara queda de respaldo. Nunca afirmar el `(04.08.2026)` (R7).

4. **¿Migrar los 14 call-sites de `/proyecto/…` al helper?** Fuera del alcance del panel; el planner puede dejarlo como deuda declarada.

## Environment Availability

| Dependencia | Requerida por | Disponible | Versión | Fallback |
|---|---|---|---|---|
| `psql` | verificación contra PROD | ✓ | PostgreSQL 17.9 | — |
| `SUPABASE_DB_URL` en `.env` | idem | ✓ | — | — |
| Vitest + Testing Library | tests de vistas puras | ✓ | ya en `app/` | — |
| Deploy / BrowserOS | criterios visuales | n/a | — | Fase 129/138 |

Sin dependencias faltantes.

## Validation Architecture

### Test Framework
| Propiedad | Valor |
|---|---|
| Framework | Vitest + @testing-library/react (jsdom) |
| Config | `app/vitest.config.*` (paquete `app/` con config propia — lección Phase 43: un paquete sin config es CI-DARK) |
| Quick run | `cd app && pnpm vitest run components/panel-*.test.tsx lib/links-internos.test.ts` |
| Full suite | `cd app && pnpm test` (baseline v12.0: 1590) |
| Guards | `cd app && pnpm guards` (baseline 127: `11 passed (11)` / `334 passed (334)`) |

⚠ Gotcha v12.0: `vitest run lib/*guard*.test.ts` **sale 0 sin correr nada** si el glob no matchea. Verificar el conteo de tests ejecutados, no solo el exit code.

### Phase Requirements → Test Map
| Req | Comportamiento | Tipo | Comando | ¿Existe? |
|---|---|---|---|---|
| PANEL-02 | `hrefProyecto(b,"estado")` → `/proyecto/{b}#estado` | unit | `pnpm vitest run lib/links-internos.test.ts -t "proyecto"` | ❌ Wave 0 |
| PANEL-02 | `hrefAgenda("tabla-sala","2026-W32")` → `/agenda?semana=2026-W32#tabla-sala` (query ANTES del hash) | unit | idem `-t "orden query hash"` | ❌ Wave 0 |
| PANEL-02 | ítem `en_corpus:false` → **cero** `<a href^="/proyecto">`, sí enlace externo | unit DOM | `pnpm vitest run components/panel-item-proyecto.test.tsx` | ❌ Wave 0 |
| PANEL-03 | `agrupacion_materia` en las filas → **cero** `(sin materia)` en el DOM y cero heading "Por materia" | unit DOM | `components/panel-actualidad.test.tsx -t "materia"` | ⚠ existe e **invierte** |
| PANEL-03 | urgencias: `"5 proyectos con Discusión inmediata"` (boletines distintos), y `"95"` ausente del tile | unit | `components/panel-tile-urgencias.test.tsx` | ❌ Wave 0 |
| PANEL-03 | ingresos/archivos: `"2 eventos de 1 proyecto"` con boletín nombrado | unit | `components/panel-tile-ingresos.test.tsx` | ❌ Wave 0 |
| PANEL-04 | 2 votaciones del mismo boletín → **2 `<li>`**, jamás 1 agregado | unit | `components/panel-tile-votaciones.test.tsx -t "una línea por votación"` | ❌ Wave 0 |
| PANEL-04 | `resultado:null` → `"resultado no informado por la fuente"`, y **no** contiene `Rechazado`/`Aprobado` | unit | idem `-t "resultado null"` | ❌ Wave 0 |
| PANEL-04 | `camara:"diputados"` → grafía `Cámara de Diputados` (nunca minúscula suelta) | unit | idem `-t "grafía"` | ❌ Wave 0 |
| PANEL-05 | `document.body.textContent` del panel completo **no contiene** `"datos al"` | unit DOM | `components/panel-actualidad.test.tsx -t "datos al"` | ❌ Wave 0 |
| PANEL-05 | footer contiene `"según fuente al"` (idiom importado de `IDIOMS_APROBADOS`, no re-tipeado) | unit | idem | ❌ Wave 0 |
| PANEL-05 | `fecha_captura` nunca en el DOM (control positivo: la fecha del hecho sí aparece) | unit | idem | ❌ Wave 0 |
| PANEL-05 | `rotuloFecha` agenda date-only → `"10 ago 2026"`, sin correr el día | unit | `-t "F-14"` | ✅ existe (conservar los 5) |
| PANEL-07 | `"23 citaciones del Senado · 0 de la Cámara en las fuentes consultadas"` con denominador | unit | `components/panel-tile-comisiones.test.tsx` | ❌ Wave 0 |
| PANEL-07 | fila Cámara con `numero/tipo/hora_inicio:null` → **cero** `Sesión N` y cero `:` de hora fabricada | unit | `components/panel-tile-sala.test.tsx -t "no fabrica sesión"` | ❌ Wave 0 |
| PANEL-07 | supresión (`nuevos_ingresos`) → causa verbatim, cero `"0"` mudo | unit | existente, conservar | ✅ existe |
| Régimen | `panel-*.tsx` real ∈ `SUPERFICIES_PANEL` (anti-drift recursivo) | guard | `pnpm vitest run lib/anti-insinuacion-guard.test.ts -t "1f"` | ✅ existe |
| Régimen | carril PANEL del linter verde sobre el copy nuevo | guard | `pnpm vitest run lib/anti-insinuacion-guard.test.ts` | ✅ existe |
| Régimen | cero `.rpc()` fuera del allowlist; cero `.from()` PII | guard | `pnpm vitest run lib/lockdown-guard.test.ts` | ✅ existe |
| Régimen | Tailwind: cero hex, cero `-[--var]`, arbitrary values sancionados | guard | `pnpm vitest run lib/bento-guards.test.ts` | ✅ existe |

### Greps DOM anti-"datos al" (evidencia de cierre, D-10 = render local)

```bash
# Sobre el HTML renderizado localmente del panel (o `document.body.innerHTML` volcado):
grep -o "datos al" panel.html | wc -l          # DEBE ser 0
grep -o "según fuente al" panel.html | wc -l   # DEBE ser >= 1  (control positivo apareado)
grep -o "(sin materia)" panel.html | wc -l     # DEBE ser 0
grep -o "fecha_captura" panel.html | wc -l     # DEBE ser 0
grep -o 'href="/proyecto/' panel.html | wc -l  # DEBE ser >= 1  (el panel dejó de ser mudo)
```

⚠ Gotchas de instrumento pagados en v12.0, aplicables aquí:
- `grep -c` **topa en 1** sobre HTML de una sola línea → usar `grep -o … | wc -l`.
- `grep -i` combinado con `-F` sobre estos literales da 0 siempre → no combinar.
- `pipefail` + `grep -q` sale 141 → no encadenar así.
- Un **cero fuerte** exige control positivo apareado (por eso `según fuente al >= 1` acompaña a `datos al == 0`).
- React intercala `<!-- -->` entre expresiones adyacentes → los greps deben ser sobre literales completos, no sobre frases partidas por interpolación.

### Sampling Rate
- **Por commit de tarea:** `pnpm vitest run components/panel-*.test.tsx lib/links-internos.test.ts` (verificar el conteo de tests > 0).
- **Por merge de wave:** `pnpm guards` + `pnpm test`.
- **Gate de fase:** suite completa verde + los 5 greps DOM + `pnpm guards` antes de `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `lib/links-internos.ts` + `.test.ts` — PANEL-02 (incluye el test del orden `?…#…`)
- [ ] `lib/panel-evidencia.ts` + `.test.ts` — contrato TS del jsonb (unión discriminada por señal)
- [ ] Alta del idiom de urgencia en `IDIOMS_APROBADOS` **si** se usa `"fechada el"` (decisión O-4 vs registro 126)
- [ ] Actualizar el fixture `makeSenal()` a la grafía viva (`"Cámara de Diputados"`) y añadir `evidencia` realista
- [ ] `components/panel-tile-{sala,comisiones,urgencias,movimiento,votaciones,ingresos}.test.tsx` + `panel-item-proyecto.test.tsx`
- [ ] Whitelist de `bento-guards` si algún arbitrary value nuevo entra

## Security Domain

| ASVS | Aplica | Control |
|---|---|---|
| V2 Authentication | no | panel público, sin auth |
| V3 Session | no | RSC sin sesión |
| V4 Access Control | **sí** | Camino A: el cliente público es `service_role` y **bypassa RLS** ⇒ la protección real es `lockdown-guard` (allowlist de `.rpc`, `PII_TABLES` prohibidas en `.from`). `votacion` NO es PII ⇒ `.from("votacion")` es legal; `parlamentario` seguiría prohibido |
| V5 Input Validation | **sí** | `evidencia` es jsonb no tipado — parse defensivo (zod/type-guards), jamás `as`. `?semana=` es input no confiable ya validado por `parseISOWeek` |
| V6 Cryptography | no | — |

| Patrón de amenaza | STRIDE | Mitigación |
|---|---|---|
| Enlaces externos de la fuente (`target="_blank"`) | Tampering | `rel="noopener noreferrer"` obligatorio |
| Interpolación de `materia`/`titulo` de fuente externa | Tampering/XSS | JSX escapa por defecto; **jamás** `dangerouslySetInnerHTML` |
| Filtrado de PII vía título de proyecto | Info Disclosure | `proyecto`/`votacion` son NO-PII; el lookup de títulos no toca `parlamentario` |
| Flag flip por agente | Elevation | `vsim-antiflip-guard` vivo; ningún agente flipea flags |

## Sources

### Primarias (HIGH)
- PROD Supabase por `psql -tA | tr -d '\r'`, `PGCLIENTENCODING=UTF8`, read-only — inventario de `actualidad_senal`, `jsonb_pretty(evidencia)` por señal, `information_schema.columns` de `votacion`, filas de `votacion`, `sesion_sala`, agregados de urgencias y del cruce L5.
- Codebase: `app/components/panel-actualidad.tsx`, `panel-actualidad.test.tsx`, `app/app/page.tsx`, `app/app/proyecto/[boletin]/page.tsx`, `app/app/agenda/page.tsx`, `app/components/actualidad-module.tsx`, `app/lib/{week-utils,dia-calendario,format,vsim-gate,voto-presentacion}.ts`, `app/lib/{anti-insinuacion-guard,lockdown-guard,bento-guards,bento-coherencia-guard}.test.ts`.
- `.planning/spikes/v13.0-editorial-portada.md`, `.planning/ROADMAP.md §128`, `.planning/REQUIREMENTS.md`, `128-CONTEXT.md`, `127-VERIFICATION.md`.

### Secundarias (MEDIUM)
- `.planning/research/v13.0-panel-actualidad-hallazgos.md` (citado indirectamente vía el spike).

### Terciarias (LOW)
- Ninguna. Cero web research (por instrucción).

## Metadata

**Confianza:**
- Contrato del jsonb: **HIGH** — leído de PROD, clave por clave.
- Fuente de L4: **HIGH** — tabla, columnas, nulls y precedente de código verificados.
- Helper de links / anclas: **HIGH** — anclas leídas del JSX; el pitfall del orden `?…#…` es determinista.
- Naming congelado / guards: **HIGH** — leídos del test que muerde.
- Encuadre del gate VSIM sobre el tile L4: **MEDIUM** (A1 — decisión del planner).

**Research date:** 2026-07-30
**Valid until:** 2026-08-06 (el panel lee datos que se re-materializan; los conteos citados son del 2026-07-30 y cambiarán — el **contrato de claves** es lo estable)
