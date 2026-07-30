---
phase: 113
plan: 06
subsystem: inventario
tags: [links-externos, provenance, chokepoints, catalogo-sql]
requires: ["113-02"]
provides:
  - "113-INVENTARIO.md §3.1 — ProvenanceBadge chokepoint DUAL + tabla de call-sites de sourceUrl + safeExternalHref (LINK-03)"
  - "113-INVENTARIO.md §3.2 — los 4 builders de URL externa con plantilla verbatim"
  - "113-INVENTARIO.md §3.3 — familias de URL almacenadas en columnas, descubiertas por catálogo"
affects: [115, 116, 122, 125]
tech-stack:
  added: []
  patterns: ["descubrimiento de columnas por information_schema en vez de lista adivinada"]
key-files:
  created: []
  modified:
    - .planning/phases/113-inv-inventario-rector-de-superficies/113-INVENTARIO.md
decisions:
  - "El inventario registra el link POST-rewrite de enlaceHumanoProyecto, nunca el proyecto.enlace crudo"
  - "Las 4 clases de fuente del ROADMAP quedaron resueltas con host+conteo; ninguna requirió declaración de cero"
requirements: [LINK-01]
metrics:
  duration: ~35 min
  completed: 2026-07-27
---

# Phase 113 Plan 06: Chokepoints, builders y URL-desde-columna — Summary

Cerrada la capa de links externos del inventario rector: `ProvenanceBadge` queda declarado
chokepoint **DUAL** (fecha `capturedAt` + link `sourceUrl`) con sus 16 archivos de call-site
trazados a columna/RPC, los 4 builders con plantilla verbatim, y el universo real de URLs-desde-columna
descubierto por catálogo (34 columnas, 8 hosts) con las 4 clases de fuente resueltas por evidencia.

## Qué se hizo

### §3.1 — Chokepoints

- `ProvenanceBadge` documentado en sus dos caras con cita `provenance-badge.tsx:25,37,62`:
  - **Cara A (fecha):** `capturedAt` → `relativeTimeEs` + `esStale` (48 h → amber); `null` →
    "Sin fecha de actualización" + "fuente desconocida"; el badge nunca se omite.
    Regla LOCKED: toda fecha vía `capturedAt` se marca `fecha_captura` sin más análisis.
  - **Cara B (link):** `sourceUrl` → `<a href={safeExternalHref(sourceUrl)} target="_blank"
    rel="noopener noreferrer">fuente oficial ↗</a>`; si el guard devuelve `null` el `<a>` no se
    emite. Regla LOCKED: es el mayor emisor de links externos del sitio.
- **Tabla de call-sites de `sourceUrl`: 17 filas** para los 16 archivos de
  `grep -rl "sourceUrl=" app/components app/app` (15 producción + 1 test). Cada fila lleva expresión
  verbatim del prop, columna/RPC de origen, clase de fuente y gate. **Cero orígenes `indeterminado`.**
- `safeExternalHref` (`lib/utils.ts:15-23`) declarado guard único y **chokepoint de LINK-03**:
  allowlist de esquema `http:`/`https:`, fail-closed, no reescribe la URL.

### §3.2 — Los 4 builders

Tabla con plantilla verbatim, precondición y llamantes: `buildSenadoUrl` (boletín COMPLETO con
sufijo), `buildCamaraUrl` (solo si `prm_id_camara != null`), `enlaceHumanoProyecto` (rewrite por
host+path `tramitacion.senado.cl` + `/wspublico/`, verbatim en cualquier otro caso) y `partidoLegible`
(no construye link: desactiva URIs `datos.bcn.cl/.../partido-politico/{slug}`, invariante
"CERO URI en el DOM").

### §3.3 — Familias de URL almacenadas en columnas

- Descubrimiento por `information_schema.columns` → **34 columnas de URL en 33 tablas**. Ninguna se
  llama `url_fuente`/`enlace_fuente`/`link_*`: el patrón de nombres del research habría descubierto cero.
- 34 queries de host+conteo (`split_part(<col>,'/',3)` + `count(*)`) con resultado inline →
  **8 hosts distintos**, ~78.000 valores de URL almacenados.
- Las 4 clases del ROADMAP **resueltas con host+conteo**, ninguna necesitó declaración de cero:
  - **camara** — `www.camara.cl` + `opendata.camara.cl`
  - **senado** — `tramitacion.senado.cl` + `www.senado.cl` + `web-back.senado.cl`
  - **BCN** — `datos.bcn.cl`, 48 filas en `parlamentario_militancia.enlace`, **jamás como href**
    (`partidoLegible` las desactiva)
  - **leylobby** — `www.leylobby.gob.cl`, 32 en `lobby_audiencia.enlace` y 32 en
    `lobby_audiencia.enlace_detalle`, confirmadas además por búsqueda por VALOR (`like '%leylobby%'`)
- §3.3.5 lista las 11 columnas con cero ocurrencias en PROD al 2026-07-27, con causa.
- §3.3.6 deja 5 consecuencias accionables para 115.

## Hallazgos para las fases consumidoras

1. **Candidato #1 de 115:** `tramitacion_evento.enlace` tiene **982** filas en
   `tramitacion.senado.cl` que **no** pasan por `enlaceHumanoProyecto` (E-038 `timeline-event.tsx:42`).
   Si su path es `/wspublico/`, son links a XML crudo. Registrado sin corregir (esta fase no arregla).
2. `lobby_contraparte.enlace` (17.681) y `source_snapshot.source_url` (4.383) existen en DB pero
   **no se emiten al DOM** — 115/125 no deben perseguirlas.
3. Los 4 call-sites bajo MONEY (`aporte.enlace`, `contrato.enlace`) tienen columnas de respaldo
   **vacías**: aunque el gate se encendiera, no habría link.
4. `enlace_fuente` **no es una columna**: es clave dentro del jsonb `cruce_senal.evidencia`,
   originada en `lobby_audiencia.enlace` / `contrato.enlace` (`0039_cruce_senal.sql:107`,
   `0052_...sql:99,154`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] La query de descubrimiento del plan devuelve cero filas**

- **Found during:** Task 2
- **Issue:** el plan especifica `... and data_type like '%char%' and column_name ~ 'url|enlace|link'`.
  En Postgres las columnas `text` reportan `data_type = 'text'`, no `'character varying'` — y **todas**
  las columnas de URL de este esquema son `text`. La query devuelve **0 filas**, lo que habría
  producido un §3.3 vacío y un falso "no hay URLs en columnas", justo el agujero que el plan quería cerrar.
- **Fix:** se registró la query del plan **verbatim con su resultado real (0 filas)** como paso de
  descubrimiento fallido, y a continuación la query corregida (`data_type in ('text','character
  varying','character')`, resto idéntico) con sus 34 filas inline. La corrección queda documentada
  en el propio §3.3.1 para que sea re-ejecutable y auditable.
- **Files modified:** `113-INVENTARIO.md` (§3.3.1)
- **Commit:** e1b55d1

**2. [Rule 1 - Bug] Reconciliación del conteo de `sourceUrl=` entre §3.0 y §0.2**

- **Found during:** Task 1
- **Issue:** el cuadro de regeneración de §3 (Plan 02) decía **15 archivos** y §0.2 decía **16**.
- **Fix:** no se tocó §3.0; se añadió en §3.1.4 el bloque **"Reconciliación con §3.0"** explicando que
  ambos números son correctos con su denominador (16 totales = 15 producción + 1 test; el propio
  `provenance-badge.tsx` queda fuera de ambos porque declara el prop en vez de pasarlo).
- **Files modified:** `113-INVENTARIO.md` (§3.1.4)
- **Commit:** da173fb

## Threat mitigations aplicadas

| Threat | Cómo |
|--------|------|
| T-113-05 | Todas las queries de §3.3 devuelven sólo `split_part(...,'/',3)` (host) + `count(*)`. Cero `select <col>` completo. `SUPABASE_DB_URL` nunca ecoado ni escrito (`grep -E 'postgres(ql)?://'` sin match) |
| T-113-06 | Cero keys de `r2_path`; dominios PII (`infoprobidad/`, `servel/`, `money/`, `rut/`) fuera. `pii_contraparte_declaracion.enlace` consultada sólo por host+conteo → 0 filas |
| T-113-10 | La tabla de call-sites registra la **expresión del prop**, nunca valores de URL de filas reales |
| T-113-03 | Sólo `SELECT`. Cero DDL, cero DML |

## Verification

- `STRICT=0 bash check-inventario.sh` → **exit 0**; check 3 (los 4 builders citados) **OK**,
  check 4 (bloques SQL) **OK**, check 5 (cobertura) **OK**. Los 2 "FALTA" restantes son de **§4**
  (Plan 04, aún pendiente), no de este plan.
- `grep -q 'sourceUrl' && buildSenadoUrl && buildCamaraUrl && enlaceHumanoProyecto && partidoLegible
  && safeExternalHref` → todos presentes.
- `grep -q 'information_schema.columns'` + `grep -qi 'leylobby'` → presentes.
- `grep -nE '\|[[:space:]]*\|'` → 2 matches, **ambos dentro de bloques de código** (operador `||` de
  SQL en §1.5 y de TypeScript en §3.1.3). **Cero celdas de tabla vacías.**
- `grep -nE 'postgres(ql)?://'` → sin match.

## Self-Check: PASSED

- `113-INVENTARIO.md` existe y contiene `### 3.1`, `### 3.2`, `### 3.3`.
- Commits verificados en `git log`: `da173fb` (Task 1), `e1b55d1` (Task 2).
