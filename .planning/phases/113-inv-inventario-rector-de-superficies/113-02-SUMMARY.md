---
phase: 113
plan: 02
subsystem: planning-artifacts
tags: [inventario, chrome, emisores, links, fechas, provenance-badge]
requires:
  - "113-01: §0 (comandos declarados), §1 (sujetos), §5 (gates + convención de la columna gate)"
provides:
  - "113-INVENTARIO.md §2 (chrome compartido C-01..C-04, inventariado UNA vez)"
  - "113-INVENTARIO.md §3 (catálogo de emisores E-001..E-060 con hrefs, fechas→origen, gate, rutas)"
  - "Ampliación declarada del vocabulario de origen: 11 RPCs con evidencia archivo:línea"
  - "Marca `→ ver §3.1` en los 25 emisores de ProvenanceBadge (contrato para el Plan 06)"
affects: [113-03, 113-04, 113-06, 114, 115, 116, 122, 125]
tech-stack:
  added: []
  patterns:
    - "ids estables C-0N / E-NNN como mecanismo de deduplicación entre secciones"
    - "re-verificación de números de línea por `grep -n` antes de escribirlos (no copiar del research)"
    - "`—` obligatorio en vez de celda vacía"
key-files:
  created: []
  modified:
    - .planning/phases/113-inv-inventario-rector-de-superficies/113-INVENTARIO.md
decisions:
  - "El chrome se inventaría una sola vez (§2) y §4 lo referencia por id C-0N; los 4 archivos del chrome llevan además id E-NNN que apunta a §2 para no romper el orden de densidad"
  - "Los emisores huérfanos (sin call-site non-test) se inventarían igual pero se marcan: son parte del denominador, no del DOM"
  - "La Tabla D (§0.4) recibe celdas placeholder explícitas en vez de vacías, sin fabricar contenido de Plan 04"
metrics:
  duration: ~35 min
  completed: 2026-07-27
---

# Phase 113 Plan 02: Chrome compartido y catálogo de emisores Summary

Las dos capas que hacen finito el inventario: el chrome se inventaría **una** vez con ids `C-01..C-04`
y los ~50 componentes que emiten links o fechas quedan indexados como `E-001..E-060` con su origen en
vocabulario cerrado — de modo que §4 referencie en vez de re-derivar 15 veces la misma semántica.

## Qué se construyó

### §2 Chrome compartido (`C-01`..`C-04`)

Alcance declarado: las 4 piezas aplican a **las 15 rutas** (incluidas `/contraparte/[id]`, que 404ea
por gate MONEY pero cuyo 404 igual renderiza el chrome, y `/admin/revisar-entidades`, excluida del
inventario público). Regla explícita de no-repetición: §4 **no** repite estos hrefs.

| id | pieza | hrefs |
|----|-------|-------|
| `C-01` | `app/app/layout.tsx` (footer) | CC BY 4.0 (`:58`), `/metodologia` (`:70-71`), `/sobre` (`:76-77`), `mailto:contacto@observatoriocongreso.cl` (`:83`) |
| `C-02` | `app/components/header-nav.tsx` | `/buscar` `/parlamentarios` `/agenda` `/red` `/sobre` (`:37-41`, render `:72-73`) |
| `C-03` | `app/components/global-header.tsx` | `/` (wordmark, `:35-36`) |
| `C-04` | `app/components/breadcrumbs.tsx` | hrefs dinámicos provistos por la página (`:38-39`) |

- La fila de `/red` lleva **`NET`** en la columna gate, con el mecanismo exacto citado:
  `NAV_ITEMS.filter((item) => item.href !== "/red")` en `header-nav.tsx:61-63` ⇒ con NET OFF el nodo
  está **ausente del DOM**, no es un link a 404. El flag crudo nunca cruza al islote cliente: se lee
  en `global-header.tsx:30` y baja como el boolean `showRed`.
- `C-04` registra la **nota de comportamiento** "último ítem sin href" (`breadcrumbs.tsx:44-50`,
  contrato en `:12-14`): es un `<span aria-current="page">`, no un link.
- **Todos** los números de línea fueron re-verificados por `grep -n` contra el árbol actual antes de
  escribirse. El research citaba `header-nav.tsx:63` para `/red`; esa línea resultó ser la del
  **filtro**, no la de la declaración (`:40`) — ambas quedan registradas por separado.

### §3 Catálogo de emisores (`E-001`..`E-060`)

Enumeración **regenerada** con los comandos de §0.2 (no copiada): 50 archivos emiten links, 28
formatean fechas, 25 renderizan `ProvenanceBadge`, 15 pasan `sourceUrl=`, 18 tablas leídas directo.

- `E-001`..`E-050` = los 50 emisores de links, en **densidad descendente** (mismo `sort -rn` del
  comando declarado). `E-051`..`E-060` = los 10 que no emiten href propio pero muestran fechas o
  alimentan el badge.
- Cada fila: `componente | hrefs (con archivo:línea) | fechas (formatter → origen) | gate | rutas`.
- Los 4 archivos del chrome llevan id `E-NNN` que **apunta a §2** (`E-006`, `E-021`, `E-031`,
  `E-034`), para no romper el orden de densidad ni duplicar los hrefs.
- Los 25 emisores de `ProvenanceBadge` llevan `→ ver §3.1` en las columnas de fechas y hrefs
  (verificado programáticamente: cero archivos PB sin marca).
- §3.1/§3.2/§3.3 quedan como headers-placeholder del Plan 06, tal como pide el objetivo.

## Hallazgos sustantivos

| Hallazgo | Evidencia | Impacto |
|----------|-----------|---------|
| **2 emisores HUÉRFANOS con 13 hrefs entre ambos** | `grep -rn "VotoFichaRow\|ActualidadModule"` non-test → sólo definiciones propias, tipos y comentarios; **cero call-sites** | 114/125 **no** deben perseguir esos hrefs en el DOM: `voto-ficha-row.tsx` (8 hrefs) y `actualidad-module.tsx` (5 hrefs) no se renderizan en ninguna ruta. `panel-actualidad.tsx` es el near-clone vivo que reemplazó al segundo en `/` |
| **La lista cerrada de RPCs del research estaba incompleta en 11 nombres** | 7 RPCs de datos llegan por segundo argumento multilínea (`votos_de_parlamentario`, `lobby_de_parlamentario`, `declaraciones_de_parlamentario`, `bienes_de_parlamentario`, `comparar_declaraciones`, `contratos_de_parlamentario`, `aportes_de_parlamentario`), 1 más en `buscar.ts:213` (`buscar_proyectos_hibrido`) y 3 por **variable** vía `crossLinkReader(rpc)` (`parlamentario/[id]/page.tsx:187-190,198-200`) | El plan autorizaba ampliar "declarando la evidencia": se añadieron con su `archivo:línea` probatorio en una tabla propia. Sin esto, las fichas de parlamentario habrían quedado con orígenes falsos o vacíos |
| **`app/app/contraparte/[id]/page.tsx` es falso positivo del grep de `ProvenanceBadge`** | su único match es un **comentario** (`:19`); el badge real lo ponen `contratos-por-contraparte` y `aportes-por-contraparte` | El "25 archivos" del método incluye 1 no-render; queda declarado en `E-060` para que §3.1 (Plan 06) no busque un call-site inexistente |
| **`estado-actual-block.tsx:429` renderiza `urgenciaFuente.fechaCaptura` como fecha visible** | `fechaCorta(urgenciaFuente.fechaCaptura)` | Candidato directo de la fase **116** (fechas): `fecha_captura` es reloj de scraping, jamás el hecho. Queda marcado en su fila |
| **`app/app/cuenta/page.tsx` define su propio `fechaCorta` local** | `:90-91`, `Intl.DateTimeFormat("en-CA")`, distinto del de `lib/format.ts` | Formatter duplicado fuera del chokepoint compartido; queda registrado en `E-052` |

## Deviations from Plan

**1. [Rule 2 - Correctness] Ampliación del vocabulario cerrado de origen con 11 RPCs**
- **Found during:** Task 2
- **Issue:** la lista de RPCs del plan no contenía los nombres que llegan por segundo argumento
  multilínea o por variable. Usarla a ciegas habría dejado los bloques de votos, lobby, patrimonio,
  contratos, aportes y cross-links **sin origen** o con uno inventado.
- **Fix:** se aplicó la instrucción explícita del propio plan ("si aparece uno nuevo, verificarlo por
  grep y añadirlo declarando la evidencia") — tabla de ampliación con `archivo:línea` por RPC.
- **Files modified:** `113-INVENTARIO.md` (§3, subsección *Vocabulario de la columna origen*)
- **Commit:** `14ff29c`

**2. [Rule 3 - Blocking] Celdas placeholder explícitas en la Tabla D (§0.4)**
- **Found during:** Task 2 (verificación `grep -nE '\|[[:space:]]*\|'`)
- **Issue:** el criterio "cero celdas vacías" fallaba por la fila placeholder de la **Tabla D**, que
  escribió el Plan 01 y que llena el **Plan 04**. Bloqueaba una verificación de este plan por trabajo
  ajeno.
- **Fix:** las 6 celdas se rellenaron con el literal `_(pendiente — Plan 04)_`. **No se fabricó
  contenido** de §0.4: sigue explícitamente marcada como pendiente de Plan 04.
- **Commit:** `14ff29c`

**3. [Nota, no deviación] El único match residual de `\|[[:space:]]*\|` es el operador SQL `||`**
- Línea 293 (`select 'c:' || c.rut_proveedor ...`, bloque SQL del sujeto E, escrito por el Plan 01).
  Es concatenación de Postgres dentro de un fence ```sql, no una celda de tabla vacía.

## Threat Flags

Ninguna. Este plan es **puro análisis de código**: cero queries a PROD, cero requests a fuentes,
cero paquetes instalados, cero DDL/DML. Los dispositions `mitigate` de T-113-05 / T-113-06 / T-113-10
aplican a §3.3 y §3.1, que escribe el **Plan 06** — aquí sólo se registran *nombres* de RPC y de
columna, jamás valores de fila ni keys de R2.

## Verificación

| Criterio | Comando | Resultado |
|----------|---------|-----------|
| §2 con los 4 ids | `grep -c 'C-01\|C-02\|C-03\|C-04'` | **5** (> 0) |
| Catálogo ≥ 40 ids | `grep -o 'E-[0-9]\{3\}' \| sort -u \| wc -l` | **60** |
| Sin ids duplicados | `grep -o '^\| E-[0-9]\{3\}' \| sort \| uniq -d` | **vacío** |
| Cero celdas vacías | `grep -nE '\|[[:space:]]*\|'` | sólo la línea 293 (operador SQL `\|\|`) |
| Todo PB marcado | loop sobre los 25 archivos de `grep -rln ProvenanceBadge` buscando `§3.1` en su fila | **0 sin marca** |
| Checklist | `bash check-inventario.sh` (STRICT=0) | **exit 0** |
| Líneas citadas reales | `grep -n` de cada `archivo:línea` de §2 | **todas verificadas** contra el árbol actual |

Las 6 faltas que reporta `check-inventario.sh` con `STRICT=0` corresponden **todas** a §4 (las 15
rutas + las 4 `not-found.tsx`), que escriben los Planes 03/04. Es el estado esperado en wave 2.

## Commits

| Task | Commit | Descripción |
|------|--------|-------------|
| 1 | `527cf3a` | §2 chrome compartido `C-01`..`C-04` con gate NET en `/red` |
| 2 | `14ff29c` | §3 catálogo `E-001`..`E-060` + ampliación de vocabulario + hallazgo de huérfanos |

## Para los Planes 03/04/06

- **§4** referencia `C-0N` (chrome) y `E-NNN` (emisores) **por id**; no repite hrefs ya inventariados.
- **Plan 06** hereda 3 headers-placeholder ya escritos: §3.1 (25 call-sites `ProvenanceBadge` + 15
  expresiones `sourceUrl=`), §3.2 (los 4 builders) y §3.3 (familias URL-desde-columna). `E-060`
  advierte que 1 de los 25 matches es un comentario, no un render.
- **§0.4 (Tabla D)** sigue siendo trabajo del Plan 04; sus celdas están marcadas, no llenas.
- Los emisores huérfanos `E-003` y `E-008` deben excluirse de cualquier expectativa de DOM en
  114/125.

## Self-Check: PASSED

- Archivos declarados: 1/1 FOUND (`113-INVENTARIO.md`)
- Commits declarados: 2/2 FOUND (`527cf3a`, `14ff29c`)
