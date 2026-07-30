---
phase: 113
plan: 04
subsystem: planning-artifacts
tags: [inventario, links, fechas, cobertura, gates, auditoria]
requires:
  - "113-01 (sujetos deterministas, gates observados, §5)"
  - "113-02 (catálogo E-001..E-060, emisores huérfanos)"
  - "113-06 (§3.1 chokepoint DUAL del badge, §3.3 familias por host)"
  - "113-03 (§4.1-4.3, régimen de las tablas A/B/C)"
provides:
  - "§4.4-4.15: las 12 rutas restantes del universo LOCKED inventariadas"
  - "§4.9.b: la 4ª not-found.tsx apendizada"
  - "§0.4 Tabla D: cobertura método×ruta con 19 filas y vocabulario cerrado"
  - "§0.4.1: los 3 límites declarados del método"
  - "línea de régimen de cierre (el documento no corrige)"
affects:
  - "114 (links internos), 115 (patrones externos), 116/117 (fechas), 122 (cruces), 125 (E2E)"
  - "113-05 (cierre de fase: corre check-inventario.sh con STRICT=1)"
tech-stack:
  added: []
  patterns:
    - "matching literal con grep -qF -- para rutas con [id]/[boletin]; raíz / como caso especial por header de sección"
    - "vocabulario cerrado por columna (3 valores) para impedir celdas inventadas"
key-files:
  created: []
  modified:
    - ".planning/phases/113-inv-inventario-rector-de-superficies/113-INVENTARIO.md"
decisions:
  - "El header de la raíz se escribe `### 4.4 /` sin comillas para que check-inventario.sh lo matchee (la ruta / matchearía cualquier línea con grep -F)"
  - "/admin/revisar-entidades queda EXCLUIDA con una sola fila y razón; cero tablas A/B/C (mitigación T-113-04)"
  - "Las rutas token-based describen el mecanismo (token crudo en link, hash en DB) con `<token>` como placeholder literal; cero tokens de ejemplo"
metrics:
  duration: "~1 sesión"
  completed: 2026-07-27
  tasks: 3
  commits: 3
---

# Phase 113 Plan 04: Cierre del inventario (rutas restantes + Tabla D) Summary

Las 12 rutas restantes del universo LOCKED quedaron inventariadas con sus tablas A/B/C, la 4ª
`not-found.tsx` apendizada y la Tabla D de cobertura método×ruta cerrada con 19 filas, vocabulario
cerrado y los 3 límites del método declarados — el inventario ya es un denominador completo y
auditable para 114/115/116/122/125.

## Qué se construyó

| Task | Qué | Commit |
|------|-----|--------|
| 1 | §4.4 `/`, §4.5 `/agenda`, §4.6 `/buscar`, §4.7 `/comparar`, §4.8 `/parlamentarios`, §4.9 `/red` + §4.9.b `not-found` | `4c5ce9c` |
| 2 | §4.10 `/metodologia`, §4.11 `/sobre`, §4.12 `/cuenta`, §4.13/§4.14 `/notificaciones/*`, §4.15 `/admin/revisar-entidades` **EXCLUIDA** | `e7da24d` |
| 3 | §0.4 Tabla D (19 filas) + §0.4.1 los 3 límites + línea de régimen de cierre | `26433da` |

Archivo modificado (único): `.planning/phases/113-inv-inventario-rector-de-superficies/113-INVENTARIO.md`
(1.232 → 1.864 líneas).

## Los gotchas de fecha exigidos, registrados (no corregidos)

- **`/agenda`** — `citacion.fecha` / `sesion_sala.fecha` son **date-only medianoche UTC**: la parte
  fecha UTC **ES** el día chileno publicado. El helper **`diaCalendario`**
  (`diaCalendarioCitacion` / `dayLabelCitacion`) codifica el contrato. El inventario registra el
  origen; **no convierte** ninguna fecha.
- **`/buscar`** — el año de cada tarjeta sale de **`min(tramitacion_evento.fecha)`** y **JAMÁS de
  `fecha_captura`** (comentario LOCKED verbatim en `app/app/buscar/page.tsx:160`).
- **`/comparar`** — `fecha_captura_max` del par (`RPC:coincidencia_votos_par`) marcada **`sí`** en
  *¿es fecha_captura?*, con la nota de que el copy dice "según fuente al", no "captura" pelado
  (guard de vocabulario). Gate **VSIM** en su fila.
- **`/red`** — gate **NET** y `4.9.b not-found.tsx` apendizada.

## Hallazgos (registrados, no arreglados — el régimen de 113 prohíbe corregir)

1. **`/` no emite ninguna `fecha_captura`** (corrige la premisa del plan). `grep -n "fecha_captura"
   app/components/panel-actualidad.tsx` → sin match; el contrato de 9 columnas de
   `RPC:actualidad_senales_panel` ni la trae. El módulo que sí la tenía
   (`actualidad-module.tsx`, **E-008**) es un emisor **huérfano** (§3.0.1). Consecuencia para 116:
   el riesgo de `/` es el inverso — `fecha_max` es un **agregado** de la RPC 0066 y hay que verificar
   que se derive del hecho.
2. **Corrección de catálogo:** **E-032** (`estado-actual-block.tsx`) figuraba en `/` — su único
   call-site non-test es `app/app/proyecto/[boletin]/page.tsx:9,128`. Y **E-046** (`bento-tile.tsx`)
   figuraba recibiendo `href` desde **E-055**: `PanelActualidad`/`TileSenal` montan `BentoTile`
   **sin** prop `href` ⇒ el panel **no emite ningún link**. Los hrefs de bento de `/` son solo de
   E-024.
3. **Candidato #2 de 115:** `/buscar` es la **única** superficie que pasa `proyecto.enlace` al badge
   **sin** el rewrite de `enlaceHumanoProyecto` (`buscar-filtros.tsx:493`). Como 3.658 de 3.659
   filas apuntan a `tramitacion.senado.cl/wspublico/...`, el "fuente oficial ↗" de cada resultado
   apunta hoy al **XML crudo**. En `/proyecto/[boletin]` el mismo valor sí se reescribe.
4. **`/red` no usa `ProvenanceBadge`:** emite su propia `<dl class="net-prov">` y formatea fechas con
   **`fechaLiteral`** (regex `yyyy-mm-dd`, `arista-hecho.tsx:15-20`), sin `Intl` ni `fechaCorta`.
   116 debe tratarlo como un formatter propio.
5. **`/admin/revisar-entidades`** es la única ruta que **escribe** en la DB
   (`sb.rpc("resolver_entidad")`) y fabrica un `fecha_captura` con el **reloj del revisor**
   (`new Date().toISOString()`, `page.tsx:126`). Registrado como metadato, sin enumerar su superficie.

## Seguridad y privacidad (threat model del plan)

| Threat | Disposición | Cómo se cumplió |
|--------|-------------|-----------------|
| T-113-04 (`/admin/revisar-entidades`) | mitigate | Una sola fila con la marca literal **`EXCLUIDA`** + razón "gated admin, no pública (decisión LOCKED del CONTEXT)". **Cero** tablas A/B/C, cero enumeración de su superficie |
| T-113-08 (`/notificaciones/*`, `/cuenta`) | mitigate | Mecanismo de token descrito (crudo en el link, **hash** en DB, HMAC por-usuario, ventana de expiración) con `<token>` como **placeholder literal**. Cero tokens de ejemplo. Cero emails: `grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+'` sobre el documento devuelve **solo** `contacto@observatoriocongreso.cl`, el buzón institucional público del footer |
| T-113-02 (Tabla D y §4) | mitigate | Solo ids públicos (`D1165`, `S1338`, `14309-04`, `17870-05`) y nombres de columna; cero RUT, cero email de persona, cero monto individual |
| T-113-SC (installs) | accept | La fase no instaló ningún paquete |

## Verificación

```
bash .planning/phases/113-inv-inventario-rector-de-superficies/check-inventario.sh
OK check 1 — las 15 rutas page.tsx están en el inventario
OK check 2 — las 4 not-found.tsx están apendizadas
OK check 3 — los 4 builders de URL externa están citados
OK check 4 — 8 bloques sql (>= 5 sujetos deterministas)
OK check 5 — declaración de Cobertura presente
RESULTADO: sin faltas (STRICT=0)
```

- Las 6 sub-secciones de Task 1 y las 6 de Task 2 existen (`grep '### 4.N'`).
- Header de la raíz presente como `### 4.4 /` (regex `^### 4\.[0-9]+ /[[:space:]]*$` del script).
- Tabla D: **19 filas** de datos (15 rutas + 4 `not-found`), verificado con `awk` acotado a §0.4.
- **Cero celdas de tabla vacías**: `grep -nE '^\|.*\|[[:space:]]*\|'` filtrando las filas separadoras
  → sin match.

## Desviaciones del plan

### Auto-fixed

**1. [Rule 1 - Bug] El header de `/` debía ir sin comillas para que el checker lo matcheara**
- **Found during:** Task 1 (verificación)
- **Issue:** se escribió `### 4.4 \`/\`` siguiendo el estilo de §4.1-4.3; `check-inventario.sh:56`
  exige `^### 4\.[0-9]+ /[[:space:]]*$` (la raíz `/` matchearía cualquier línea con `grep -F`, por
  eso el script usa el header como caso especial). El check 1 reportaba `FALTA ruta /`.
- **Fix:** header cambiado a `### 4.4 /` + nota inline explicando por qué rompe el estilo.
- **Commit:** `4c5ce9c`

**2. [Rule 1 - Bug] La premisa del plan sobre `fecha_captura` en `/` era incorrecta**
- **Found during:** Task 1
- **Issue:** el plan indicaba "hay `fecha_captura` en el módulo — marcarla". El módulo vivo
  (`panel-actualidad.tsx`) no la tiene; el que la tenía es huérfano.
- **Fix:** se registró el hecho con doble evidencia (grep + contrato de la RPC) en vez de inventar
  una fila. Se documentó la consecuencia para 116.
- **Commit:** `4c5ce9c`

**3. [Rule 1 - Bug] Dos entradas del catálogo §3.0 inexactas para `/`**
- **Found during:** Task 1
- **Issue:** E-032 listado en `/` (su único call-site es `/proyecto/[boletin]`) y E-046 listado como
  receptor de `href` desde E-055 (que no pasa `href`).
- **Fix:** corregido por evidencia de import dentro de §4.4, sin editar §3 (el catálogo es artefacto
  del Plan 02; la corrección queda trazada en la ruta que la detectó).
- **Commit:** `4c5ce9c`

### Diferidas

**`grep -nE '\|[[:space:]]*\|'` sin match — 2 falsos positivos irreducibles.** El criterio de
aceptación pedía cero matches del patrón en TODO el archivo. Quedan 2, ambos **fuera de tablas** y
dentro de bloques de código citados **verbatim** de planes anteriores:
`.../113-INVENTARIO.md:293` (`select 'c:' || c.rut_proveedor …`, SQL del Sujeto E) y `:552`
(`proto === "https:" || proto === "http:"`, el cuerpo de `safeExternalHref`). Alterarlos rompería la
re-ejecutabilidad de la evidencia. La verificación se ejecutó con el patrón acotado a filas de tabla
(`^\|.*\|[[:space:]]*\|` menos separadoras) → **cero matches**. Registrado para el validador Opus y
para 113-05.

## Auth gates

Ninguno. La fase no requirió credenciales nuevas: todo el trabajo fue análisis de código sobre el
repo (cero requests a fuentes gubernamentales, cero queries nuevas a PROD — las de §1/§3.3 ya las
habían corrido los planes 01/02/06).

## Known Stubs

Ninguno. §0.4 pasó de placeholder `_(pendiente — Plan 04)_` a tabla completa; no quedan marcas
`pendiente` en el documento salvo las que describen estado de datos reales (`count: "pendiente"` del
carril MONEY, que es copy del producto, no un stub del inventario).

## Self-Check: PASSED

- `FOUND` `.planning/phases/113-inv-inventario-rector-de-superficies/113-INVENTARIO.md` (1.864 líneas)
- `FOUND` commit `4c5ce9c` — §4.4-4.9
- `FOUND` commit `e7da24d` — §4.10-4.15
- `FOUND` commit `26433da` — Tabla D + límites + régimen
