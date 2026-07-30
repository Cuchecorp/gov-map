# Phase 113: INV — Inventario rector de superficies - Research

**Researched:** 2026-07-27
**Domain:** Auditoría estática de superficies Next.js 16 App Router (enumeración de rutas × links × fechas) + selección de sujetos deterministas por SQL contra PROD
**Confidence:** HIGH (todo lo sustantivo se verificó por grep/lectura sobre este repo; cero dependencia de conocimiento entrenado)

## Summary

Esta fase NO necesita librerías nuevas ni investigación de ecosistema: es una fase de **documentación con evidencia**, y todo el insumo vive en este repo. La investigación real fue mapear la superficie: 15 `page.tsx`, ~50 archivos que emiten `href`/`<Link>`, ~25 archivos que renderizan fechas, 40+ call-sites `.rpc(`, y —hallazgo rector— **los links externos NO se construyen mayoritariamente en el frontend: vienen de columnas de la DB** (`proyecto.enlace`, `url_fuente`, `enlace_fuente`, `link_*`) y pasan por un guard único (`safeExternalHref`). Solo **4 constructores de URL externa** viven en código; el resto son URLs almacenadas. Esto cambia radicalmente cómo 115 debe validar patrones: por *columna de origen*, no solo por plantilla en TSX.

Segundo hallazgo rector: **`ProvenanceBadge` es el chokepoint de `fecha_captura`** (25 archivos lo usan, y su prop se llama `capturedAt`). Casi toda fecha-de-captura visible pasa por ahí; el resto de las fechas visibles son fechas-del-hecho formateadas por `fechaCorta`/`fechaCortaSegura`/`diaCalendario`. El inventario debe explotar esta asimetría: inventariar el badge UNA vez y luego enumerar sus 25 call-sites con su columna de origen, en vez de re-derivar la semántica en cada ruta.

Tercer hallazgo: **cinco feature-gates server-only** (`NET`, `CRUCES`, `VSIM`, `MONEY`, `NOTIF`) suprimen bloques enteros —y por tanto links y fechas— según env vars del Worker. Un inventario que no declare el estado del flag para el deploy auditado sería falso: MONEY y NOTIF están OFF, así que superficies como financiamiento/contratos/aportes y los botones de seguir NO emiten links hoy. El inventario debe tener una columna `gate` por bloque.

**Primary recommendation:** Estructurar `113-INVENTARIO.md` en **tres capas** (chrome compartido → catálogo de emisores reusables → 15 rutas que referencian el catálogo), con tablas de columnas fijas y parseables, y usar los grep-comandos verbatim de este documento como *método declarado* (reproducible) en vez de prosa. Los sujetos SQL se eligen con el molde exacto del precedente 93-02 (query verbatim + resultado comentado inline).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Enumeración de rutas | Filesystem (repo) | — | `app/app/**/page.tsx` es la fuente de verdad del router; no se "asume" ninguna ruta |
| Enumeración de links emitidos | Código (Server Components) | — | Todo `<Link>`/`<a href>` se resuelve estáticamente por grep del árbol de componentes; la verificación DOM es 114/125 |
| Origen de URLs externas | Database (columnas) | Código (4 builders) | La mayoría de hrefs externos son valores almacenados, no plantillas de código |
| Semántica de cada fecha | Database (columna) → Componente formatter | — | La fecha nace en una columna/RPC; el TSX solo la formatea. El origen manda |
| Selección de sujetos dinámicos | Database (PROD, read-only psql) | — | Determinismo exige `ORDER BY` estable sobre datos reales, no muestreo manual |
| Supresión de superficies | Frontend Server (env gates) | — | Los 5 gates son server-only (sin `NEXT_PUBLIC_`); afectan qué links existen |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Alcance de rutas**
- Universo = las 15 rutas `app/app/**/page.tsx`: `/`, `/agenda`, `/buscar`, `/comparar`, `/contraparte/[id]`, `/cuenta`, `/metodologia`, `/notificaciones/baja`, `/notificaciones/confirmar`, `/parlamentario/[id]`, `/parlamentarios`, `/proyecto/[boletin]`, `/red`, `/sobre`, `/admin/revisar-entidades`
- `/admin/revisar-entidades` se LISTA como EXCLUIDA del inventario público con razón (gated/no pública); `/cuenta` y `/notificaciones/*` se incluyen marcando su naturaleza (auth/token-based)
- Route handlers / API no son superficies; solo se apendizan si emiten links visibles

**Método de enumeración**
- Links por ruta: análisis de código exhaustivo del árbol de componentes de cada ruta (`<Link>`, `href`, `<a>`, construcción de URLs externas) — la verificación contra DOM real es trabajo de 114 (internos) y 125 (E2E), no de esta fase
- Fechas por ruta: rastreo de cada fecha renderizada hasta su columna/RPC de origen (formatters, props); las que provienen de `fecha_captura` quedan MARCADAS explícitamente
- Cobertura declarada en tabla método×ruta: qué se enumeró exhaustivo (código) vs por muestra (sujetos SQL); cero rutas "asumidas" sin evidencia

**Sujetos dinámicos por SQL**
- Sujetos deterministas elegidos por SQL contra PROD (precedente 93-02): 2 parlamentarios (1 diputado + 1 senador con datos ricos — lobby/patrimonio/votos), 2 boletines (1 con votaciones+similares+cruces, 1 zona solo-Senado), 1 contraparte real
- Criterio: ORDER BY determinista + máxima riqueza de datos (más bloques visibles); query verbatim registrada en el inventario
- Queries read-only vía `set -a; source .env; set +a` + psql; JAMÁS imprimir la URL de conexión

**Artefacto**
- Un solo archivo `113-INVENTARIO.md` en el dir de la fase: 1 sección por ruta con tablas (links internos / externos por fuente / fechas con origen), sección de método+cobertura, sección de sujetos SQL
- Validación de completitud por agente Opus ANTES de cerrar la fase (el inventario es rector de 114/115/116/122/125)

### Claude's Discretion
- Estructura exacta de las tablas y granularidad de componentes compartidos (header/footer/nav se inventarían una vez y se referencian)
- Cómo agrupar links repetidos entre rutas (deduplicación con referencia)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LINK-01 | Existe un inventario rector de superficies (toda ruta pública × links que emite, internos y externos) como artefacto del milestone | §Inventario de superficies (15 rutas verificadas por filesystem), §Emisores de links (mapa archivo→tipo), §Constructores de URL externa (4, verbatim), §Estructura recomendada del artefacto |

## Project Constraints (from CLAUDE.md)

Directivas actionables que aplican a esta fase:

- **GSD Workflow Enforcement** — todo cambio de archivo pasa por un comando GSD. Esta fase escribe `113-INVENTARIO.md` dentro de `/gsd:execute-phase`. [CITED: CLAUDE.md §GSD Workflow Enforcement]
- **Trazabilidad a la fuente como principio rector** — cada dato mostrado lleva fuente, fecha y enlace original. El inventario es precisamente el censo de ese contrato. [CITED: CLAUDE.md §Project]
- **`fecha_captura` es el reloj de scraping, jamás el hecho** — gotcha LOCKED (Phase 98). El inventario MARCA, no corrige (corregir es 117). [CITED: CLAUDE.md §Ingesta / MEMORY spike-findings-98]
- **Ingesta respetuosa / rate-limit 2-3s** — no aplica a esta fase (cero requests a fuentes gubernamentales; el inventario es estático + psql). Declararlo explícitamente en §Método evita que el validador Opus lo marque como omisión.
- **Secrets en `.env`; JAMÁS imprimir la URL de conexión** — las queries van con `set -a; source .env; set +a` y `psql "$SUPABASE_DB_URL"`, nunca ecoando la variable.
- **Nada destructivo** — esta fase es 100% read-only sobre PROD (SELECT únicamente) y solo escribe un `.md` nuevo.

## Standard Stack

Esta fase NO instala paquetes. Herramientas ya presentes:

### Core
| Herramienta | Versión | Propósito | Por qué |
|-------------|---------|-----------|---------|
| `psql` (cliente Postgres) | ya en uso | Sujetos deterministas contra PROD, read-only | Precedente 93-02; evita el cap 1k de PostgREST [VERIFIED: `.planning/milestones/v9.0-phases/93-*/93-01-PLAN.md:54`] |
| `rg`/`grep` | ya en uso | Enumeración exhaustiva de `href`, formatters, `.rpc(` | Determinista y re-ejecutable → cumple "método declarado" |
| Filesystem (`find app/app -name page.tsx`) | — | Universo de rutas | Fuente de verdad del App Router; cero rutas asumidas |

### Alternatives Considered
| En vez de | Se podría usar | Trade-off |
|-----------|----------------|-----------|
| Análisis estático por grep | BrowserOS/DOM real sobre el deploy | El CONTEXT lo LOCKEA a análisis de código; DOM real es 114/125. Usar DOM aquí duplicaría trabajo y arriesgaría falsos negativos por gates OFF |
| Grep manual | `next build` + análisis del route manifest | El manifest da rutas pero NO los links emitidos ni las fechas; no aporta sobre el filesystem |
| Documento único | Un JSON/CSV parseable | CONTEXT LOCKEA "un solo archivo `.md`". Mitigación: tablas Markdown de columnas fijas = mecánicamente parseables |

**Installation:** ninguna.

## Package Legitimacy Audit

**No aplica** — esta fase no instala ningún paquete externo (es documentación + queries read-only con herramientas ya presentes en el repo). Cero superficie de slopsquatting.

## Inventario de superficies (verificado por filesystem)

`find app/app -name "page.tsx"` → **15 rutas** [VERIFIED: filesystem, 2026-07-27]

| # | Ruta | Tipo | Dinámica | searchParams observados | Notas de inclusión |
|---|------|------|----------|--------------------------|--------------------|
| 1 | `/` | pública | no | — | `app/app/page.tsx` |
| 2 | `/agenda` | pública | no | `semana` (`YYYY-Www`) | `app/app/agenda/page.tsx:58,72` |
| 3 | `/buscar` | pública | no | `q`, `page` | `app/app/buscar/page.tsx:41` |
| 4 | `/comparar` | pública | no | ids de parlamentario (validados vs `PARLAMENTARIO_ID_RE`) | `app/app/comparar/page.tsx:70,175` |
| 5 | `/contraparte/[id]` | pública | **sí** | sí (pasados a secciones hijas) | `app/app/contraparte/[id]/page.tsx:41,56` |
| 6 | `/cuenta` | **auth (OTP)** | no | sí (leídos y descartados) | INCLUIR marcando naturaleza auth |
| 7 | `/metodologia` | pública | no | — | estática |
| 8 | `/notificaciones/baja` | **token-based** | no | sí (token) | INCLUIR marcando naturaleza; `noindex` |
| 9 | `/notificaciones/confirmar` | **token-based** | no | sí (token) | idem |
| 10 | `/parlamentario/[id]` | pública | **sí** | — | ficha 360 (la más densa) |
| 11 | `/parlamentarios` | pública | no | `q` (trim + cap `MAX_QUERY_CHARS`) | directorio |
| 12 | `/proyecto/[boletin]` | pública | **sí** | — | ficha de proyecto (la más densa en links externos) |
| 13 | `/red` | pública, **gated NET** | no | seed | `NET_PUBLIC_ENABLED` |
| 14 | `/sobre` | pública | no | — | estática |
| 15 | `/admin/revisar-entidades` | **EXCLUIDA** | no | — | gated admin, no pública (CONTEXT LOCKED) |

**Rutas `not-found.tsx` que emiten links** (superficies reales que el inventario debe apendizar, no son `page.tsx`):
`app/app/proyecto/[boletin]/not-found.tsx` (3 hrefs, incl. senado.cl y camara.cl), `app/app/parlamentario/[id]/not-found.tsx` (1), `app/app/contraparte/[id]/not-found.tsx` (1), `app/app/red/not-found.tsx` (1). [VERIFIED: grep]

## Emisores de links (mapa archivo → carga)

Comando declarable: `for f in $(find app/app app/components -name "*.tsx" -not -name "*.test.tsx"); do n=$(grep -c "<Link\|href=" "$f"); [ "$n" -gt 0 ] && echo "$n $f"; done | sort -rn`

**~50 archivos emiten links.** Top por densidad [VERIFIED: grep, 2026-07-27]:

| Archivo | hrefs | Superficie donde aparece |
|---------|-------|--------------------------|
| `components/votos-por-parlamentario.tsx` | 16 | `/parlamentario/[id]` |
| `components/lobby-de-parlamentario.tsx` | 12 | `/parlamentario/[id]` |
| `components/voto-ficha-row.tsx` | 8 | `/proyecto/[boletin]` |
| `app/agenda/page.tsx` | 8 | `/agenda` |
| `components/patrimonio-de-parlamentario.tsx` | 7 | `/parlamentario/[id]` |
| `app/layout.tsx` | 6 | **TODAS** (chrome) |
| `components/week-nav.tsx` | 5 | `/agenda` |
| `components/actualidad-module.tsx` | 5 | `/` |
| `app/sobre/page.tsx` | 5 | `/sobre` |
| `components/{timeline-view, red/red-graph, parlamentario-directory-row, financiamiento-*, contratos-*, aportes-*}` | 4 c/u | varias |
| `app/buscar/page.tsx` | 4 | `/buscar` |
| … (resto con 1–3) | | |

**Chrome compartido (inventariar UNA vez, referenciar en las 15 rutas):**
- `app/app/layout.tsx:58,71,77,83` → CC BY 4.0 (`creativecommons.org`), `/metodologia`, `/sobre`, `mailto:contacto@observatoriocongreso.cl`
- `components/header-nav.tsx:37-41` → `/buscar`, `/parlamentarios`, `/agenda`, `/red`, `/sobre` — **`/red` se filtra del nav cuando NET está OFF** (`header-nav.tsx:63`)
- `components/global-header.tsx:36` → `/` (logo)
- `components/breadcrumbs.tsx` → links dinámicos; el ÚLTIMO ítem va SIN href (segmento actual)

## Constructores de URL externa (los únicos 4 en código)

**Hallazgo rector:** casi todos los links externos que el sitio emite provienen de **columnas de la DB**, no de plantillas en TSX. Solo estos construyen URL:

| Builder | Archivo:línea | Plantilla | Parámetro |
|---------|---------------|-----------|-----------|
| `buildSenadoUrl` | `components/validacion-fuente.tsx` | `https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini={boletin}` | boletín **COMPLETO con sufijo** (sin sufijo devuelve lista, no ficha) |
| `buildCamaraUrl` | `components/validacion-fuente.tsx` | `https://www.camara.cl/legislacion/ProyectosDeLey/tramitacion.aspx?prmID={prmId}&prmBOLETIN={boletin}` | solo cuando `prm_id_camara != null` |
| `enlaceHumanoProyecto` | `components/validacion-fuente.tsx` (test en `components/enlace-humano-proyecto.test.ts`) | **rewrite**: si `proyecto.enlace` es host `tramitacion.senado.cl` + path `/wspublico/` (XML crudo, roto para humanos) → `buildSenadoUrl(boletin)`; en cualquier otro caso VERBATIM | detección por host+path, nunca substring |
| `partidoLegible` | `lib/format.ts:134` | NO construye link: **desactiva** URIs `http://datos.bcn.cl/.../partido-politico/{slug}` derivando nombre del slug (invariante "CERO URI en el DOM") | display-only |

**Guard único de href externo:** `safeExternalHref` (`lib/utils.ts`) — devuelve `null` salvo `http:`/`https:`. Todo href derivado de datos externos pasa por aquí. El inventario debe declararlo como el chokepoint de LINK-03.

**Hosts externos observados en código no-test** [VERIFIED: grep]: `creativecommons.org` (chrome/footer/metodologia/sobre/patrimonio), `datos.bcn.cl` (URI-como-partido, neutralizado), `tramitacion.senado.cl`, `www.camara.cl`, `www.w3.org` (SVG namespace — NO es link).

**Hosts que aparecen solo en fixtures de test** → señal de que **el valor viene de la DB en runtime**: `www.senado.cl`, `senado.cl`, `camara.cl`, `opendata.camara.cl`, `www.leylobby.gob.cl`, `www.mercadopublico.cl`, `api.mercadopublico.cl`, `www.servel.cl`, `datos.cplt.cl`, `www.infoprobidad.cl`. **Implicación crítica para 115:** enumerar patrones desde el TSX daría un inventario incompleto; hay que enumerar también las **columnas** que almacenan URL (`proyecto.enlace`, `url_fuente`, `enlace_fuente`, `link_*`) y muestrear sus valores reales por host vía psql. Documentar esto en §Cobertura como límite del método de código.

## Fechas visibles: formatters y chokepoints

**Formatters centrales** (`lib/format.ts`):
- `fechaCorta(d)` — `Intl.DateTimeFormat("es-CL", {day:"2-digit", month:"short", year:"numeric"})` → "14 may 2026"
- `fechaCortaSegura(raw, fallback="fecha no informada")` — slice ISO + regex antes de `new Date`; NUNCA "Invalid Date"
- `relativeTimeEs(capturedAt, now)` — "hace X min/h/días", ≥7d cae a `fechaCorta`. **Su parámetro se llama `capturedAt`: es el formatter de la fecha de CAPTURA**
- `esStale(capturedAt, now, staleAfterMs=14d)` — umbral por cadence de ingesta
- `lib/dia-calendario.ts` → `diaCalendario` — día calendario Chile (gotcha date-only)
- `lib/week-utils.ts` → `Intl` para semana ISO

**Archivos que renderizan fechas (25, non-test)** [VERIFIED: grep de `Intl.DateTimeFormat|toLocaleDateString|toLocaleString|fechaCorta|relativeTimeEs|diaCalendario`]:
`app/agenda/page.tsx`, `app/comparar/page.tsx`, `app/cuenta/page.tsx`, `components/{actualidad-module, aportes-por-contraparte, capa1/tramitacion-stepper, contratos-de-parlamentario, contratos-por-contraparte, cruces-de-parlamentario, cruces-de-proyecto, estado-actual-block, financiamiento-de-parlamentario, lobby-de-parlamentario, lobby-en-tramitacion, lobby-menciones-de-boletin, militancias-de-parlamentario, panel-actualidad, partido-chip, patrimonio-de-parlamentario, provenance-badge, timeline-event, timeline-view, validacion-fuente, votacion-card, votos-por-parlamentario}`.

**Chokepoint de `fecha_captura`: `ProvenanceBadge`** — usado por **25 archivos** [VERIFIED: grep]:
`app/contraparte/[id]/page.tsx`, `app/proyecto/[boletin]/page.tsx`, `components/{aportes-por-contraparte, autor-row, citacion-card, comisiones-de-parlamentario, contratos-de-parlamentario, contratos-por-contraparte, cruces-de-parlamentario, cruces-de-proyecto, ficha-header, financiamiento-de-parlamentario, idea-matriz-block, lobby-de-parlamentario, parlamentario-header, partido-chip, patrimonio-de-parlamentario, sala-table-section, search-result-card, timeline-event, validacion-fuente, votacion-card, voto-ficha-row, votos-por-parlamentario}`.

Su prop es `capturedAt` y usa `relativeTimeEs` + `esStale`. **CORRECCIÓN (plan-checker, 2026-07-27): el badge es chokepoint DUAL** — además de la fecha, renderiza un link EXTERNO vía su prop `sourceUrl` (`<a href={safeExternalHref(sourceUrl)}>`, `provenance-badge.tsx:25,37,62`), y `sourceUrl=` aparece en **16 archivos** [VERIFIED: `grep -rl "sourceUrl=" app/components app/app | wc -l` → 16]. Es el mayor emisor de links externos del sitio: la Tabla B de cada ruta debe recibir una fila por instancia de badge, no solo la Tabla C. **Regla del inventario:** toda fecha que llega vía `capturedAt` se MARCA como `fecha_captura` sin más análisis; toda otra fecha requiere rastreo a su columna.

**Call-sites de `fecha_captura` ya localizados** (muestra, non-test) [VERIFIED: grep]:
`agenda/page.tsx:461,502` (citación + sala), `buscar/page.tsx:160` (comentario LOCKED: año de `min(tramitacion_evento.fecha)`, jamás de `fecha_captura`) y `:237`, `comparar/page.tsx:319,524-525,556` (`fecha_captura_max` del par VSIM), `proyecto/[boletin]/page.tsx:384,475-490,677` (frescura = `fecha_captura` MÁS RECIENTE del set de eventos), `components/actualidad-module.tsx:479-491`, `components/cruces-de-parlamentario.tsx:189` (`fecha_captura = now()` del FULL REBUILD diario, cron `23 3 * * *`), + los tipos `fecha_captura: string` en aportes/contratos/autor-row.

## RPCs y tablas por superficie (origen del dato)

**40+ call-sites `.rpc(`** [VERIFIED: grep]. RPCs distintas observadas:
`resolver_entidad`, `parlamentarios_publico_v2`, `parlamentarios_publico`, `parlamentario_publico_v2`, `militancia_historica_compartida`, `militancias_de_parlamentario`, `comisiones_de_parlamentario`, `coautores_de_parlamentario`, `coincidencia_votos_par`, `agregado_por_contraparte`, `subgrafo_red`, `buscar_citaciones`, `match_proyectos` (+ RPC híbrida en `buscar.ts:212`), `cruces_de_parlamentario`, `cruces_de_proyecto`, `lobby_en_tramitacion`, `lobby_menciones_de_boletin`, `actualidad_senales_panel`, y las RPC de conteos en `lib/parlamentario-resumen-conteos.ts` (votos/lobby/patrimonio/cruces/contratos/aportes).

**Tablas leídas directo (`.from`)** [VERIFIED: grep, conteo de call-sites]:
`suscripcion` (9), `proyecto` (8), `tramitacion_evento` (5), `citacion` (4), `votacion` (3), `sesion_sala` (3), `consentimiento` (2), y 1 c/u: `source_snapshot`, `sesion_tabla_item`, `revision_entidad`, `proyecto_ficha`, `proyecto_embedding`, `proyecto_autor`, `probidad_ingesta_estado`, `lobby_ingesta_estado`, `contratos_ingesta_estado`, `citacion_punto`, `aportes_ingesta_estado`.

> **Nota para el planner:** la columna "origen" de cada fecha en el inventario se llena con `RPC:<nombre>.<campo>` o `tabla.<columna>`. Ambos vocabularios están acotados por las dos listas de arriba — el inventario NO debe inventar nombres.

## Feature gates que suprimen superficies (columna obligatoria del inventario)

Cinco gates server-only, sin prefijo `NEXT_PUBLIC_` (el flag jamás llega al bundle) [VERIFIED: `app/lib/*-gate.ts`]:

| Gate | Env var | Chokepoint | Estado en el deploy auditado | Efecto en links/fechas |
|------|---------|-----------|------------------------------|------------------------|
| NET | `NET_PUBLIC_ENABLED` | `lib/net-gate.ts:37` | **ON** (`/red` LIVE desde v4/v6.1) | `/red` accesible; item de nav presente (`header-nav.tsx:63`) |
| CRUCES | `CRUCES_PUBLIC_ENABLED` | `lib/cruces-gate.ts:40` | **ON** (cutover 2026-06-24) | bloques de cruces emiten links y badges |
| VSIM | `VSIM_PUBLIC_ENABLED` | `lib/vsim-gate.ts:36` | **ON** (dossier firmado v10.0) | `/comparar` muestra `coincidencia_votos_par` + `fecha_captura_max` |
| MONEY | `MONEY_PUBLIC_ENABLED` | `lib/money-gate.ts:33` | **OFF** (LOCKED, no se toca en v12.0) | financiamiento/contratos/aportes NO emiten links ni fechas hoy |
| NOTIF | `NOTIF_PUBLIC_ENABLED` | `lib/notif-gate.ts:38` | **OFF** (inerte, feature PARKED) | `SeguirButton` ausente del DOM; `/cuenta` y `/notificaciones/*` sin efecto útil |

**Regla del inventario:** cada bloque inventariado lleva `gate: —|NET|CRUCES|VSIM|MONEY|NOTIF` y su estado. Un bloque con gate OFF se inventaría igual (existe en código) pero se marca **`no emitido en el deploy auditado`** — así 114/115/125 no persiguen links inexistentes y 116 no audita fechas invisibles.

## Sujetos deterministas por SQL (molde 93-02)

**Precedente exacto a copiar:** `.planning/milestones/v9.0-phases/93-agenda-p2d-*/93-WIRING-EVIDENCIA.md` §0 "Sujetos de prueba (deterministas, elegidos por psql PROD)". Su formato —query verbatim en bloque ```sql con el **resultado comentado inline** (`-- 2026-W26|53 …`) + URL PROD a visitar + expectativa declarada— es exactamente lo que 114/116/122/125 necesitan consumir. **Replicar ese formato literalmente.**

**Invocación (declarada en §Método, nunca ecoando la URL):**
```bash
set -a; source .env; set +a
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "<query>"
```

**Sujetos a elegir (5) y tablas donde buscarlos:**

| Sujeto | Criterio de riqueza | Tablas/RPC candidatas | Gotcha |
|--------|--------------------|-----------------------|--------|
| Parlamentario A (diputado) | máximo de bloques visibles: votos + lobby + patrimonio + cruces + comisiones + militancias | contar por `parlamentario_id` en las fuentes de `cruces_de_parlamentario`, lobby, patrimonio, votos | MONEY OFF ⇒ contratos/aportes NO suman bloques visibles; no usarlos como criterio |
| Parlamentario B (senador) | idem, cámara Senado | idem | **PK bio `id='S1344'` vs `parlid_senado=1344`** — el href/param usa el `id` string, no el numérico |
| Boletín A | tiene votaciones + similares + cruces | `votacion`, `proyecto_embedding` (similares), fuente de `cruces_de_proyecto` | `enlace` puede ser el WS XML → `enlaceHumanoProyecto` lo reescribe: verificar ambos casos |
| Boletín B | zona **solo-Senado** (sin `prm_id_camara`) | `proyecto where prm_id_camara is null` | ejercita la rama "sin `buildCamaraUrl`" |
| Contraparte | id real con agregados no vacíos | fuente de `agregado_por_contraparte` | MONEY OFF ⇒ contratos/aportes suprimidos; elegir por lo que SÍ se ve |

**Determinismo obligatorio:** todo `ORDER BY` debe incluir un desempate estable (p. ej. `ORDER BY n_bloques DESC, id ASC LIMIT 1`). Sin desempate, dos corridas pueden devolver sujetos distintos y el inventario deja de ser reproducible — 114/116/122/125 quedarían apuntando a sujetos fantasma.

**Ancla temporal:** registrar `now()::date` de la corrida y el deploy auditado (`e89b79af` según STATE, base `https://observatorio-congreso.thevalis.workers.dev`), como hace 93.

## Architecture Patterns

### Estructura recomendada de `113-INVENTARIO.md` (3 capas)

```
113-INVENTARIO.md
├── 0. Método y cobertura          ← comandos verbatim + tabla método×ruta
├── 1. Sujetos deterministas       ← molde 93-02 (query + resultado inline + URL PROD)
├── 2. Chrome compartido           ← layout/header-nav/global-header/breadcrumbs (UNA vez)
├── 3. Catálogo de emisores        ← ~50 componentes: id, hrefs que emite, fechas que muestra, gate
├── 4. Las 15 rutas                ← por ruta: 3 tablas + referencia a §2 y §3 por id
└── 5. Gates y su estado           ← tabla de 5 flags en el deploy auditado
```

**Por qué esta forma:** deduplicar por catálogo (§3) es lo que hace el documento finito. Sin él, `ProvenanceBadge` (25 call-sites) y el chrome (5 links) se repetirían 15 veces, y 116 tendría que re-derivar la misma semántica una y otra vez. Con catálogo, la sección de cada ruta es una lista de referencias `→ E-014` + lo que es exclusivo de esa ruta.

### Tablas de columnas fijas (contrato con las fases consumidoras)

**Tabla A — links internos por ruta** (consume 114):
`| # | href (plantilla) | emisor (archivo:línea) | ancla `#id`? | condicional/gate | ruta destino |`

**Tabla B — links externos por ruta** (consume 115):
`| # | fuente (camara/senado/BCN/leylobby/otro) | plantilla o columna de origen | builder o `columna` | parámetro | emisor (archivo:línea) | gate |`

> La columna **"builder o columna"** es la que resuelve el hallazgo rector: distingue URL construida en código (4 casos) de URL almacenada en DB (el resto).

**Tabla C — fechas por ruta** (consume 116/117):
`| # | etiqueta visible | formatter | origen (RPC.campo / tabla.columna) | ¿es fecha_captura? | vía ProvenanceBadge? | gate | emisor (archivo:línea) |`

**Tabla D — cobertura método×ruta** (success criterion 4):
`| ruta | links enumerados por | fechas enumeradas por | sujeto usado | ¿exhaustivo o muestra? | evidencia |`

### Anti-patrones a evitar
- **Prosa en vez de tablas** — 5 fases consumen esto mecánicamente; un párrafo no se parsea.
- **Repetir el chrome 15 veces** — infla el doc y garantiza deriva entre copias.
- **Omitir bloques con gate OFF** — el inventario dejaría de ser el denominador completo; 116 no sabría que existe copy de fecha en MONEY.
- **Elegir sujetos "a ojo"** — mata la reproducibilidad; el CONTEXT LOCKEA SQL determinista.
- **Enumerar links externos SOLO desde el TSX** — perdería la mayoría (vienen de columnas). Declarar el límite en §Cobertura.
- **Arreglar algo** — esta fase NO corrige (114/115/117 lo hacen). Un fix aquí rompe el "antes/después" de esas fases.

## Don't Hand-Roll

| Problema | No construir | Usar en su lugar | Por qué |
|----------|--------------|------------------|---------|
| Enumerar rutas | lista escrita a mano | `find app/app -name "page.tsx"` | Filesystem es la verdad; a mano se omiten rutas (`not-found.tsx` ya se coló) |
| Detectar fechas de captura | análisis semántico por ruta | grep de `ProvenanceBadge` / prop `capturedAt` | El chokepoint ya existe; 25 call-sites resueltos de una |
| Validar href externo | regex propia | `safeExternalHref` (`lib/utils.ts`) ya es el guard | Es el contrato vigente; documentarlo, no duplicarlo |
| Nombre de partido desde URI BCN | parseo nuevo | `partidoLegible` (`lib/format.ts:134`) | Invariante "CERO URI en el DOM" ya codificada + testeada |
| Formato de sujetos deterministas | inventar formato | copiar `93-WIRING-EVIDENCIA.md` §0 | Ya probado como insumo consumible por fases posteriores |
| Contar filas de PROD | REST del sitio | `psql -tA` | **PostgREST capa a 1k** → subestima (Pitfall documentado en 93-01) |

**Key insight:** el 80% del valor de esta fase sale de 6 greps + 5 queries. El riesgo NO es técnico, es de **completitud**: omitir una ruta, un gate o una familia de links.

## Common Pitfalls

### Pitfall 1: Inventariar solo los `page.tsx` y perder `not-found.tsx`
**Qué sale mal:** las 4 páginas `not-found.tsx` emiten links (incl. externos a senado.cl y camara.cl) y quedan fuera del denominador de 114/115.
**Por qué pasa:** el CONTEXT define el universo como "las 15 rutas `page.tsx`".
**Cómo evitar:** apendizar `not-found.tsx` como sub-superficie de su ruta padre, declarándolo en §Cobertura (no contradice el CONTEXT: son la misma ruta en estado 404).
**Señal:** `find app/app -name "not-found.tsx"` devuelve 4 archivos.

### Pitfall 2: Asumir que los links externos se construyen en el frontend
**Qué sale mal:** el inventario lista 4 patrones y 115 valida 4 patrones — mientras leylobby/mercadopublico/servel/cplt/opendata.camara llegan desde columnas y nunca se validan.
**Por qué pasa:** grep de `https://` en código no-test solo devuelve 4 hosts reales; los otros 10 aparecen únicamente en fixtures de test.
**Cómo evitar:** Tabla B con columna "builder o columna"; muestrear por psql los hosts distintos presentes en las columnas de URL.
**Señal:** un host aparece en `*.test.tsx` pero no en el componente → viene de la DB.

### Pitfall 3: Fechas con gate OFF invisibles al inventario
**Qué sale mal:** MONEY/NOTIF OFF ⇒ los bloques no renderizan; un inventario hecho "mirando la página" los omite y 116 nunca audita ese copy.
**Cómo evitar:** el método es análisis de CÓDIGO (LOCKED), no DOM. Inventariar todo lo que el código puede emitir + columna `gate`.
**Señal:** discrepancia entre lo que el catálogo dice y lo que 125 ve en el DOM → debe explicarse por el gate, no por un error.

### Pitfall 4: PostgREST capa a 1.000 filas
**Qué sale mal:** contar por REST subestima y el sujeto "más rico" elegido es falso.
**Cómo evitar:** `psql -tA` siempre; si se pagina por REST, `.order().range()`.
**Señal:** un count que da exactamente 1000.

### Pitfall 5: `citacion.fecha` es date-only medianoche UTC
**Qué sale mal:** convertir tz corre el día chileno y el inventario registra el origen con la semántica equivocada.
**Cómo evitar:** gotcha LOCKED — la parte UTC ES el día chileno; `diaCalendario` (`lib/dia-calendario.ts`) es el helper correcto. El inventario registra el origen, no convierte.

### Pitfall 6: PK bio `S1344` vs `parlid_senado=1344`
**Qué sale mal:** el sujeto se registra con el numérico y la URL `/parlamentario/1344` 404ea en 114/125.
**Cómo evitar:** registrar en §Sujetos el `id` string EXACTO que va en el href, y la URL PROD completa (como hace 93).

### Pitfall 7: Sujeto sin desempate en el `ORDER BY`
**Qué sale mal:** el inventario no es reproducible; el validador Opus lo rechaza (o peor, no lo nota y 116 audita otro sujeto).
**Cómo evitar:** `ORDER BY <metrica> DESC, <pk> ASC LIMIT 1` sin excepción.

### Pitfall 8: Fechas corruptas en PROD
**Qué sale mal:** hay filas con `fecha='2626-05-25'` (boletín 18232-25) [VERIFIED: skill `spike-findings-98`]. Un sujeto elegido por `max(fecha)` puede caer ahí.
**Cómo evitar:** filtrar `fecha <= current_date` en TODO `max(fecha)`/ventana al elegir sujetos.

## Code Examples

### Enumerar el universo de rutas (método declarable)
```bash
find app/app -name "page.tsx" | sort          # 15 → universo LOCKED
find app/app -name "not-found.tsx" | sort     # 4  → sub-superficies
```

### Enumerar emisores de links con su carga
```bash
for f in $(find app/app app/components -name "*.tsx" -not -name "*.test.tsx" | sort); do
  n=$(grep -c "<Link\|href=" "$f"); [ "$n" -gt 0 ] && echo "$n $f";
done | sort -rn
```

### Enumerar fechas y su formatter
```bash
grep -rn "Intl.DateTimeFormat\|toLocaleDateString\|toLocaleString\|fechaCorta\|relativeTimeEs\|fechaCortaSegura\|diaCalendario" \
  app/app app/components app/lib --include=*.tsx --include=*.ts | grep -v "\.test\."
```

### Localizar el chokepoint de captura
```bash
grep -rln "ProvenanceBadge" app/app app/components | grep -v "\.test\."   # 25 archivos
grep -rn "fecha_captura\|capturedAt" app/app app/components app/lib --include=*.tsx --include=*.ts | grep -v "\.test\."
```

### Enumerar RPCs y tablas (origen del dato)
```bash
grep -rn "\.rpc(" app/app app/lib app/components --include=*.tsx --include=*.ts | grep -v "\.test\."
grep -rhno "\.from(\"[a-z_]*\"" app/app app/components app/lib --include=*.tsx --include=*.ts \
  | sed 's/.*from("//;s/"//' | sort | uniq -c | sort -rn
```

### Sujeto determinista (patrón, molde 93-02)
```bash
set -a; source .env; set +a
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c \
  "select boletin from proyecto where prm_id_camara is null order by boletin asc limit 1"
# → registrar el resultado como comentario inline en el bloque ```sql del inventario
```

## Runtime State Inventory

No aplica — esta fase es NET-NEW documental (crea `113-INVENTARIO.md`) + lecturas read-only. Cero renames, cero refactors, cero migraciones, cero estado de runtime tocado.

## Environment Availability

| Dependencia | Requerida por | Disponible | Notas | Fallback |
|-------------|---------------|-----------|-------|----------|
| `.env` con `SUPABASE_DB_URL` | §Sujetos deterministas | ✓ (verificado en corridas previas 93/110) | pooler IPv4, ref `bctyygbmqcvizyplktuw` | ninguno — sin esto la fase se BLOQUEA |
| `psql` | §Sujetos | ✓ (usado en 93/110/124) | `PGCLIENTENCODING=UTF8` obligatorio para tildes | ninguno viable (REST capa a 1k) |
| `rg`/`grep` | enumeración | ✓ | `grep -P` NO funciona en este entorno (locale) — usar POSIX o la tool Grep | tool Grep |
| Deploy PROD | referencia de URLs | ✓ `https://observatorio-congreso.thevalis.workers.dev` | esta fase NO lo golpea (eso es 114/125) | n/a |

**Sin fallback y bloqueante:** ausencia de `SUPABASE_DB_URL` ⇒ los sujetos no pueden elegirse por SQL determinista ⇒ el success criterion 1 no se cumple. Degradar honesto (declarar "sujetos no elegidos, causa X") en vez de inventar sujetos.

## Validation Architecture

### Test Framework
| Propiedad | Valor |
|-----------|-------|
| Framework | Vitest (`app/vitest.config.ts`), suite app ~1418 tests + packages ~1310 |
| Comando rápido | `pnpm --filter <pkg> test` / vitest en foco |
| Suite completa | `pnpm test` (root) |

**Sin embargo:** esta fase **no produce código** — produce un documento. Los tests de la suite existente NO validan su completitud. La validación es de otra naturaleza: **checklist reproducible + validador Opus**.

### Phase Requirements → Test Map
| Req ID | Comportamiento | Tipo | Comando automatizable | ¿Existe? |
|--------|----------------|------|------------------------|----------|
| LINK-01 | Las 15 rutas del filesystem tienen sección en el inventario | checklist automatizable | `for r in $(find app/app -name page.tsx); do grep -q "$(dirname ${r#app/app})" 113-INVENTARIO.md \|\| echo "FALTA $r"; done` | ❌ Wave 0 (script de check) |
| LINK-01 | Toda sección de ruta tiene las 3 tablas (internos/externos/fechas) | checklist | contar headers por sección | ❌ Wave 0 |
| LINK-01 | Los 4 builders de URL externa están citados | grep | `grep -q "buildSenadoUrl\|buildCamaraUrl\|enlaceHumanoProyecto\|partidoLegible" 113-INVENTARIO.md` | ❌ Wave 0 |
| LINK-01 | Los 5 sujetos tienen query verbatim + resultado + URL PROD | grep de bloques ```sql | `grep -c '```sql' 113-INVENTARIO.md` ≥ 5 | ❌ Wave 0 |
| LINK-01 | Existe tabla método×cobertura | grep | `grep -q "Cobertura" 113-INVENTARIO.md` | ❌ Wave 0 |
| LINK-01 | Completitud sustantiva | **validador Opus** | manual-only (juicio) | gate de fase |

### Sampling Rate
- **Por task commit:** el check de rutas (script del Wave 0) — corre en < 2 s
- **Cierre de fase:** validador Opus con criterios explícitos (abajo) ANTES de marcar la fase completa
- **Suite existente:** debe seguir verde (esta fase no la toca; correr una vez como no-regresión)

### Criterios de aceptación del validador Opus (por sección)
1. **Rutas:** las 15 de `find` están; `/admin/revisar-entidades` figura como EXCLUIDA con razón; `/cuenta` y `/notificaciones/*` marcadas por naturaleza; las 4 `not-found.tsx` apendizadas.
2. **Links internos:** toda plantilla `href="/..."` del catálogo aparece en al menos una ruta; el chrome está inventariado una vez y referenciado.
3. **Links externos:** los 4 builders citados con plantilla verbatim; toda familia de URL-desde-columna declarada con su columna; `safeExternalHref` declarado como chokepoint; clasificación por fuente (camara/senado/BCN/leylobby/otros) completa.
4. **Fechas:** toda fecha lleva formatter + origen (`RPC.campo` o `tabla.columna`); las que van por `capturedAt`/`ProvenanceBadge` están MARCADAS como `fecha_captura`; los nombres de RPC/tabla pertenecen a las listas cerradas de este research.
5. **Sujetos:** 5 sujetos, cada uno con query verbatim + resultado inline + URL PROD + `ORDER BY` con desempate; ancla temporal y deploy declarados; PK bio en formato string.
6. **Cobertura:** tabla método×ruta sin celdas vacías; el límite "links externos desde columnas" declarado explícitamente; cero rutas sin evidencia.
7. **Régimen:** el documento no corrige nada (es inventario); `fecha_captura` nunca se presenta como el hecho ni siquiera en los ejemplos; ninguna URL de conexión impresa.

### Wave 0 Gaps
- [ ] Script de checklist rutas-vs-filesystem (bash, en el dir de la fase o inline en el plan) — cubre LINK-01
- [ ] Ninguna instalación de framework necesaria (Vitest ya existe; esta fase no aporta tests unitarios)

*(No se requieren tests unitarios nuevos: el entregable es documental. El "test" es el checklist + el gate Opus.)*

## Security Domain

`security_enforcement: true`, ASVS L1.

### Categorías ASVS aplicables

| Categoría ASVS | Aplica | Control estándar en esta fase |
|----------------|--------|-------------------------------|
| V2 Authentication | no | la fase no toca auth (solo documenta que `/cuenta` es OTP) |
| V3 Session Management | no | — |
| V4 Access Control | **sí** | El inventario NO debe filtrar superficies gated como si fueran públicas; `/admin/revisar-entidades` se declara EXCLUIDA |
| V5 Input Validation | no | cero input de usuario; las queries son literales sin interpolación |
| V6 Cryptography | no | — |
| V7 Error/Log | **sí** | JAMÁS imprimir `SUPABASE_DB_URL` (contiene credenciales) en logs, comandos ecoados o el documento |
| V8 Data Protection | **sí** | El inventario NO debe contener PII: sin RUT, sin emails de parlamentarios, sin datos de tablas PII (`aporte`, `contrato`, `rut`, `infoprobidad`) más allá del *nombre de la columna* |

### Patrones de amenaza para esta fase

| Patrón | STRIDE | Mitigación |
|--------|--------|------------|
| Credencial de DB filtrada al documento o al log | Information Disclosure | `set -a; source .env; set +a` + `psql "$SUPABASE_DB_URL"` sin `echo`; nunca pegar la URL en el `.md` |
| PII de sujetos reales en el inventario | Information Disclosure | Registrar ids y boletines (no-PII); nunca RUT/email/monto individual; los sujetos son públicos por diseño (parlamentarios, boletines) |
| Documentar r2_path de dominios PII | Information Disclosure | `esR2PathPermitido` (`validacion-fuente.tsx`) allowlista solo `tramitacion/`; no listar keys de `infoprobidad/`, `servel/`, `money/`, `rut/` |
| Escritura accidental a PROD | Tampering | Solo `SELECT`; cero DDL/DML; sin `--single-transaction` porque no hay writes |

## State of the Art

No aplica materialmente: la fase no depende de librerías externas ni de APIs con versionado. Lo único "state of the art" relevante es interno al repo:

| Antes | Ahora | Cuándo cambió | Impacto en el inventario |
|-------|-------|---------------|--------------------------|
| Links externos como plantillas en TSX | mayoría almacenados en columnas de DB | evolución v2→v10 | Tabla B necesita columna "builder o columna" |
| `proyecto.enlace` → WS XML (roto para humanos) | `enlaceHumanoProyecto` reescribe a ficha humana | v9.0 (T-89-07) | Registrar el link **post-rewrite**, no el crudo |
| anon REST viva | anon muerta; sitio en `service_role` | Camino A, 2026-06-26 | Los RPCs del inventario son server-side; 114/115 no pueden probarlos desde el navegador |
| `/red` oculto | NET ON | v4/v6.1 | `/red` cuenta como superficie pública |

## Assumptions Log

| # | Claim | Sección | Riesgo si es falso |
|---|-------|---------|--------------------|
| A1 | El deploy auditado es `e89b79af` (último de STATE) y los gates están NET/CRUCES/VSIM ON, MONEY/NOTIF OFF | §Feature gates | Si el operador redeployó con otro flag, el inventario declara un estado falso → 114/115/125 persiguen links inexistentes. **Mitigación: verificar el estado real del flag contra el deploy al inicio de la fase, no asumirlo de STATE.** |
| A2 | Los ~10 hosts que aparecen solo en fixtures de test provienen de columnas de la DB en runtime | §Constructores de URL externa, Pitfall 2 | Si alguno se construye en un archivo no cubierto por el grep, se subestima el set de patrones para 115. **Mitigación: confirmar por psql `select distinct` sobre las columnas de URL.** |
| A3 | `MAX_QUERY_CHARS` y demás constantes de validación no emiten links | §Inventario | Riesgo nulo |
| A4 | `.planning/milestones/v9.0-phases/93-*/93-WIRING-EVIDENCIA.md` sigue siendo el mejor molde (no fue superado por un formato posterior) | §Sujetos | Bajo: formato mejorable, no incorrecto |

## Open Questions (RESOLVED)

> Las 3 preguntas quedaron resueltas en planificación (2026-07-27). Cada una lleva su `RESOLVED:` inline con el plan/task que la ejecuta.

1. **¿Las 4 `not-found.tsx` entran al inventario?** — **RESOLVED: SÍ**, como sub-superficie de su ruta padre. Ejecutado por 113-03 (T1/T2/T3, sub-secciones `4.N.b`) y 113-04 (T2, verificación de las 4) y chequeado por `check-inventario.sh`.
   - Lo que sabemos: emiten links (incl. externos), no son `page.tsx`, el CONTEXT LOCKEA el universo en 15 `page.tsx`.
   - Lo incierto: si el validador Opus lo leerá como violación del scope.
   - Recomendación: **incluirlas como sub-superficie de su ruta padre**, con nota explícita en §Cobertura. No contradice el CONTEXT (misma ruta, estado 404) y evita un agujero real para 114.

2. **¿Cómo enumerar exhaustivamente los patrones de URL almacenados en columnas?** — **RESOLVED:** descubrimiento por catálogo (`information_schema.columns` con `column_name ~ 'url|enlace|link'`), NO por lista adivinada — el patrón `url_fuente|enlace_fuente|link_*` omitía `enlace`/`enlace_detalle` de audiencias de lobby, que es donde vive leylobby. Ejecutado por 113-02 T4, con criterio duro de que las 4 clases (camara/senado/BCN/leylobby) queden resueltas.
   - Lo que sabemos: el análisis de código no los alcanza; psql sí.
   - Lo incierto: cuántas columnas de URL distintas hay (se observan `proyecto.enlace`, `url_fuente`, `enlace_fuente`, `link_*`).
   - Recomendación: una query por columna de URL (`select distinct split_part(<col>,'/',3) host, count(*) ...`) y registrar el resultado en Tabla B como "familias por host". Es barato y cierra el agujero de 115.

3. **¿Estado real de los gates en el deploy?** — **RESOLVED:** se OBSERVA contra el deploy (curl + grep de superficies testigo) y se registra la evidencia; prohibido copiarlo de STATE. Ejecutado por 113-01 T3 (corre DESPUÉS de los sujetos T2, que aporta las fichas testigo). Cierra la assumption A1.
   - Recomendación: verificar el flag efectivo por observación del deploy (¿aparece `/red` en el nav? ¿hay bloque de financiamiento?) y registrar la evidencia, en vez de copiar STATE.

## Sources

### Primaria (HIGH confidence — este repo, verificado en sesión)
- `app/app/**/page.tsx` (15), `app/app/**/not-found.tsx` (4) — filesystem
- `app/components/validacion-fuente.tsx` — `buildSenadoUrl`, `buildCamaraUrl`, `enlaceHumanoProyecto`, `esR2PathPermitido`
- `app/lib/format.ts` — `fechaCorta`, `relativeTimeEs`, `esStale`, `fechaCortaSegura`, `partidoLegible`
- `app/lib/utils.ts` — `safeExternalHref`
- `app/lib/{net,cruces,vsim,money,notif}-gate.ts` — los 5 chokepoints de flag
- `app/components/header-nav.tsx`, `global-header.tsx`, `breadcrumbs.tsx`, `app/app/layout.tsx` — chrome
- `.planning/milestones/v9.0-phases/93-agenda-p2d-*/93-WIRING-EVIDENCIA.md` §0 — molde de sujetos deterministas
- `.planning/milestones/v9.0-phases/93-*/93-01-PLAN.md:54,97` — invocación psql verbatim, Pitfall cap 1k
- `.planning/phases/113-*/113-CONTEXT.md`, `.planning/REQUIREMENTS.md:11-18,61-68`, `.planning/ROADMAP.md` §113-125
- `.claude/skills/spike-findings-98/SKILL.md` — landmines de fechas (filas `2626-05-25`, `fecha_captura` = scrape)
- `./CLAUDE.md` — constraints del proyecto

### Secundaria (MEDIUM)
- `.planning/STATE.md` — estado de flags y deploy (usado como hipótesis A1, a verificar)

### Terciaria
- Ninguna. Esta fase no requirió búsqueda web: todo el dominio es interno al repo.

## Metadata

**Confidence breakdown:**
- Inventario de rutas y emisores: **HIGH** — enumerado por filesystem/grep en sesión
- Constructores de URL y chokepoints de fecha: **HIGH** — código leído verbatim
- Estado de los gates en el deploy: **MEDIUM** — leído de STATE, no observado en el deploy (A1)
- Cobertura de URLs almacenadas en columnas: **MEDIUM** — inferida de la asimetría código/fixtures (A2); cerrable con 1 query
- Método de sujetos deterministas: **HIGH** — precedente 93-02 leído

**Research date:** 2026-07-27
**Valid until:** ~2026-08-26 (30 días; se invalida antes si hay un deploy que cambie flags o se agreguen rutas)
