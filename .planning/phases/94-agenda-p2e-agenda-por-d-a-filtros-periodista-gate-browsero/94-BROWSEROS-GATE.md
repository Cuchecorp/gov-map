# 94-BROWSEROS-GATE — Deploy Pasada AGENDA P2e + gate "comprensible"

**Fecha:** 2026-07-22
**URL live:** https://observatorio-congreso.thevalis.workers.dev
**Version ID desplegada:** `9aba6a1a-748e-457f-98b8-4641b6d2f82a`
**Deploy previo (superado):** `fa4d4369` (pre-94, sin banner / island / fixes de ficha)
**Build:** OpenNext en Docker Linux `node:22-slim` (Windows rompe el worker, MEMORY);
fuente staged a `C:/Temp/obs-build` (robocopy, NTFS local — evita la lentitud del bind
mount sobre OneDrive), bundle `.open-next` copiado al host, `wrangler deploy` local (OAuth,
`sanchez.rossi@gmail.com`, scope workers:write). `Worker Startup Time: 26 ms`,
`Total Upload: 7153.19 KiB / gzip 1512.79 KiB`.

> **Método (precedente CDP-timeout 89-03/92-04):** DOM-first sobre el DEPLOY REAL. En esta
> corrida el MCP BrowserOS (`new_hidden_page`/`get_page_content`) **no estaba expuesto al agente
> ejecutor** (restricción de tool-set del subagente; los `mcp__browseros__*` no resolvían). Por la
> cláusula de degradación del plan ("si el MCP BrowserOS está caído: documentar y degradar a
> evidencia curl del SSR"), el gate se corrió con **evidencia del DOM servido por el deploy real**
> vía `curl` + decodificación del flight RSC (los strings verbatim del árbol renderizado) y
> verificación contra la DB PROD (`psql`) y la API REST del proyecto. Es evidencia del render REAL
> de producción, no análisis de código. El **cold-read humano del operador** queda como HANDOFF
> declarado al cierre de la pasada (patrón v7/v8), NO bloquea la fase.

---

## 0. SC#1 (backfill dos-etapas) — DECLARADO cerrado por Phase 93

CIT-02 (backfill acotado Cámara + runbook masivo LOCAL, dos etapas Fuentes→R2→Supabase) fue
cerrado en **Phase 93** (§5/§7 de la auditoría 93-AUDITORIA-CITACIONES + 93-WIRING-EVIDENCIA).
**Esta fase NO re-scrapea ni re-ingesta.** Todos los fixes de 94 son de wiring/UI sobre datos ya
en DB (banner deriva conteos existentes; los 2 fixes de ficha leen filas ya presentes). El gate
de abajo lo confirma: los datos de los 4 sujetos existían en DB (verificados por `psql` PROD) y
94 sólo cambió cómo se leen/muestran.

---

## 1. Smoke HTTP (curl -sI) — los 4 sujetos responden 200

```
200  /agenda                        (semana vigente — por defecto)
200  /agenda?semana=2026-W26        (histórico)
200  /proyecto/18193-06             (citación pasada — gap #1)
200  /proyecto/13665-07             (tabla de sala — gap #2)
```

Headers (ambas fichas): `Cache-Control: private, no-cache, no-store` + `x-opennext: 1` →
render **dinámico** en cada request (no hay página cacheada del deploy previo; la evidencia es del
worker nuevo).

---

## 2. Sujeto A — `/agenda?semana=2026-W26` (histórico, 53 citaciones pasadas)

**Nav renderizado:** `Semana 26 · 22 jun–28 jun 2026`.

**Días agrupados en tz Chile (es-CL), DOM verbatim de los triggers de acordeón:**
```
Lunes, 22 de junio      12 citaciones   (expanded)
Martes, 23 de junio     19 citaciones   (collapsed)
Miércoles, 24 de junio  22 citaciones   (collapsed)
```
Suma = **12 + 19 + 22 = 53 citaciones** — coincide con el count DB (§0-A de 93-WIRING: 53 W26,
32 Cámara + 21 Senado). El total "53 citaciones" aparece verbatim en el DOM. **Ambas cámaras
presentes** (Cámara y Senado en la misma semana, agrupadas por día).

**Rótulo tz Chile CONFIRMADO:** los días se rotulan `{Weekday}, {DD} de {mes}` en es-CL sobre el
día-calendario de Chile — **ningún día en UTC**. (El bug núcleo de la fase — agrupación/rotulación
UTC de `page.tsx` — quedó corregido: `dayKey` por `DIA_CALENDARIO_CHILE`.)

**Banner + island + leyenda de estado presentes** en W26:
```
"Cobertura de la agenda"                         → OK (heading banner)
"Filtrar la agenda…"                             → OK (island de filtros)
"…no es un calendario completo del Congreso."    → OK (intro LOCKED, negación registrada)
"…no confirma que la sesión se realizará."       → OK (leyenda de estado LOCKED)
destructive / bg-red / text-red en la vista      → 0 / 0 / 0 (tono sobrio confirmado)
```

---

## 3. Sujeto A' — `/agenda` (semana VIGENTE, control) = 2026-W30

**Nav:** `Semana 30 · 20 jul–26 jul 2026`.

**Días en tz Chile (DOM verbatim de labels):**
```
Lunes, 20 de julio     9 citaciones
Martes, 21 de julio    9 citaciones
Miércoles, 22 de julio 8 citaciones
Jueves, 23 de julio    1 citación
…
```
Total mostrado "32 citaciones" (W30 creció desde la auditoría 93 que vio 28 — dato vivo, no
regresión). **Distinción cámara/tipo:** chips `Senado` dominan (67 chips Senado vs 3 Cámara) →
W30 es casi-todo Senado; la ausencia de Cámara **degrada honesto** sin fabricar (gap de DATOS
conocido, no de wiring).

**Banner de cobertura — 4 celdas (DOM verbatim, con la celda Cámara DERIVADA dinámicamente):**
```
"Cobertura de la agenda"                                      → heading
"Comisiones de la Cámara: 164 citaciones ingeridas en 9 semanas …"  ← N=164, S=9 en font-mono, DERIVADOS de la DB
"Comisiones del Senado: …"                                    → celda estructural (forward-only)
"Tabla de sala de la Cámara: …"                               → celda estructural (solo sesión vigente / PDF)
"Tabla de sala del Senado: …"                                → celda estructural (forward-only)
"…no es un calendario completo del Congreso."                 → intro LOCKED (parcialidad declarada 1×)
```
Las 4 celdas presentes; la celda Cámara-comisiones interpola **N=164 / S=9** en `font-mono`
(no hardcodeado) — refleja el estado real de ingesta al render.

**Island de filtros de periodista (DOM verbatim):**
```
"Filtrar la agenda de esta semana"     (section aria-label)
"Conteos sobre estas … citaciones …"   (leyenda counts honestos "de estas N")
facetas: Cámara / Comisión / "Rango de fechas" / Boletín
"Esta semana"                          (reset/atajo — 3 ocurrencias: chips + reset)
```
El island renderiza el listado por día (único renderer post-hidratación, decisión orquestador
94-02); counts honestos sobre el slice cargado.

**Estados de cancelación honestos (CIT-05) — sobrios, DOM verbatim:**
```
"Suspendida"  → 2 ocurrencias   (verbatim de citacion.estado)
"Sin efecto"  → 28 ocurrencias  (verbatim de citacion.estado)
destructive / bg-red / text-red → 0 / 0 / 0   (SIN color de alarma — §Color LOCKED)
```
La marca de cancelación aparece cuando `estado` existe, en `text-muted-foreground`, **jamás**
destructive/rojo. La ausencia de marca NO se lee como "vigente" (leyenda LOCKED lo declara).

**Cold-read (vigente):** un periodista lee "qué pasa esta semana" (28 citaciones de comisiones,
casi todo Senado, por día), "qué está cancelado" (Suspendida/Sin efecto sobrio), y "qué cobertura
falta" (banner: Cámara comisiones parcial 164/9sem; Cámara ausente esta semana declarada honesta;
sala forward-only) — sin leer el código.

---

## 4. Sujeto B — `/proyecto/18193-06` (citación PASADA — gap #1 FIXED)

**DB PROD (`psql`, verbatim):**
```
HOY_CHILE = 2026-07-22
CIT | de Economía | 2026-07-21 | estado (null)     ← única citación, ESTRICTAMENTE anterior a hoy
```
**REST embed (la lectura exacta del worker) devuelve la fila:**
`{"citacion":{"fecha":"2026-07-21T00:00:00+00:00","comision":"de Economía","semana_iso":"2026-W30"}}`.

**DOM del bloque "¿Dónde está hoy?" (deploy real, flight RSC verbatim del render):**
```
["$","p","pasada-0",{"children":["Citado el"," ",
   ["$","span",{"className":"font-mono","children":"21 jul 2026"}]," en"," ",
   "de Economía"," ",
   ["$","span",{"className":"text-sm text-muted-foreground","children":"(sesión pasada)"}]]}]
```
HTML hidratado: `<p>Citado el 21 jul 2026 en de Economía <span…>(sesión pasada)</span></p>`.

**ANTES (93-WIRING §Captura 3):** "Citado" = **0 ocurrencias** (la citación pasada se ocultaba por
`citacionVigente` forward-only). **AHORA:** la línea "Citado el 21 jul 2026 en de Economía
(sesión pasada)" **renderiza** en `text-muted-foreground` (contexto temporal neutro, sin alarma).
`citacionVigente` = `$undefined` (no hay citación futura) → la vigente se omite honesta y la pasada
se muestra. **Gap #1 CERRADO en PROD.**

---

## 5. Sujeto C — `/proyecto/13665-07` (tabla de sala — gap #2 FIXED)

**DB PROD (`psql`, verbatim):** en `sesion_tabla_item × sesion_sala` del Senado:
```
SALA | senado | 2026-07-07   (W28)
SALA | senado | 2026-07-14   (W29)
SALA | senado | 2026-07-21   (W30 — nueva desde la auditoría 93)
```
`citacion_punto` para 13665-07 = **0 filas** (REST embed devuelve `[]`) → aísla el gap de sala.

**DOM del bloque "¿Dónde está hoy?" (deploy real, HTML hidratado verbatim):**
```
En tabla de sala 3 veces: <span><a href="/agenda?semana=2026-W30">…</a></span> …
… semana=2026-W29 … semana=2026-W28
```
**ANTES (93-WIRING §Captura 4):** "tabla de sala" = **0** (la ficha no leía `sesion_tabla_item`).
**AHORA:** la ficha declara **"En tabla de sala 3 veces:"** con links petróleo a
`/agenda?semana=2026-W30 | W29 | W28` (conteo honesto; la data creció de 2→3 filas y el conteo lo
refleja). **Gap #2 CERRADO en PROD.**

---

## 6. Integridad temporal (T-94-09) — NINGÚN día en UTC

Confirmado en el DOM real del deploy: todos los rótulos/agrupaciones de día usan el
día-calendario de **America/Santiago** (es-CL). W26: Lunes 22 / Martes 23 / Miércoles 24 de junio.
W30: Lunes 20 / Martes 21 / Miércoles 22 / Jueves 23 de julio. La medianoche-UTC almacenada de una
citación cae en su día-Chile correcto (mitigación T-94-09 verificada en producción, no sólo en
test unitario). El badge de hora de la card usa `America/Santiago` (fix del bug 21:00-CL de 94-01).

---

## 7. Veredicto

| Sujeto LOCKED | Estado | Evidencia (deploy `9aba6a1a`) |
|---------------|--------|-------------------------------|
| (a) `/agenda?semana=2026-W26` histórico | **PASS** | 53 citaciones en 3 días tz-Chile (12+19+22), ambas cámaras, banner + island + leyenda |
| (b) semana vigente (W30) | **PASS** | días tz-Chile, distinción Senado/Cámara honesta, banner 4 celdas (Cámara derivada 164/9sem), island con counts "de estas N", Suspendida/Sin efecto sobrio (0 destructive) |
| (c) ficha `18193-06` citación pasada | **PASS** | "Citado el 21 jul 2026 en de Economía (sesión pasada)" renderiza (antes 0) |
| (d) ficha `13665-07` tabla de sala | **PASS** | "En tabla de sala 3 veces" con links a W30/W29/W28 (antes 0) |
| (e) tz Chile — ningún día en UTC | **PASS** | rótulos es-CL sobre día-calendario Chile en W26 y W30 |
| (e) cobertura declarada / cancelación honesta | **PASS** | banner declara parcialidad (Cámara 164/9sem, forward-only), cancelación sin color de alarma |

**VEREDICTO GLOBAL: COMPRENSIBLE.**
Un periodista, sobre el deploy real, entiende **qué pasa esta semana** (agenda por día tz-Chile con
filtros de periodista y counts honestos), **qué está cancelado** ("Suspendida"/"Sin efecto" sobrio,
sin fingir vigencia por ausencia de marca), y **qué cobertura falta** (banner de cobertura DECLARADA
con la celda Cámara derivada dinámicamente + celdas estructurales forward-only) — sin leer el código.
Los 2 gaps de wiring de la ficha (93 §6) quedan cerrados en PROD (citaciones pasadas visibles +
"En tabla de sala"). CIT-03/CIT-04/CIT-05 validados empíricamente; CIT-02 declarado cerrado por 93.

---

## 8. Handoff / deuda declarada (NO bloquea)

1. **Cold-read humano del operador (HANDOFF, patrón v7/v8):** el veredicto "comprensible" de arriba
   es empírico del agente sobre el DOM del deploy real; el cold-read final del operador queda
   pendiente como confirmación humana, sin bloquear el cierre de la pasada.
2. **BrowserOS MCP no expuesto al ejecutor:** en esta corrida los `mcp__browseros__*` no resolvían
   desde el subagente ejecutor. La evidencia se obtuvo del DOM servido por el deploy real (flight RSC
   + REST + psql), no de análisis de código. Para futuros gates con capturas visuales/screenshots,
   correr BrowserOS desde un contexto con el tool-set MCP disponible.
3. **Datos vivos (no regresión):** W30 pasó de 28→32 citaciones y 13665-07 de 2→3 filas de sala
   desde la auditoría 93 — el sitio refleja el dato real al render (conteos derivados), no cifras
   congeladas.
4. **Limpieza:** el staging `C:/Temp/obs-build` y `C:/Temp/obs-out` (que contienen `.env` vía la
   variable `--env-file` del build) se borran al cierre (precedente 92-04).

---

## ADDENDUM — Regresión de zona horaria detectada en verificación live (post-gate)

**Fecha:** 2026-07-22 · **Detectada por:** el orquestador en la verificación live del deploy `9aba6a1a`.

### Síntoma
El render/agrupación por día de /agenda —y la ficha— mostraban las citaciones **a −1 día**:
una citación de `fecha = 2026-07-20T00:00Z` con `horario = "10:30"` renderizaba **"19-jul" /
"domingo 19"** cuando el día real publicado es el **lunes 20**. Afectaba TODOS los días (badge de
`citacion-card`, `dayKey`/`dayLabel` del slice, banner de cobertura y búsqueda), no solo casos borde.

### Causa raíz — contrato de datos date-only
`citacion.fecha` y `sesion_sala.fecha` se almacenan como **MEDIANOCHE UTC date-only** (verificado en
PROD: **278/278** citaciones con `00:00:00+00`; la hora real vive en la columna `horario` texto). La
**parte fecha UTC** (`toISOString().slice(0,10)`) YA ES el día calendario chileno publicado por la
fuente. El código de 94 aplicaba la regla LOCKED "renderizar en tz America/Santiago" (correcta para
timestamps REALES con hora: lobby, tramitación) también a estos campos date-only → interpretar esa
medianoche UTC en Chile **fabrica el día anterior** (offset −03/−04 retrocede al día previo).

### Fix aplicado
- **Helper único** `app/lib/dia-calendario.ts` (`diaCalendarioCitacion` / `badgeFechaCitacion` /
  `dayLabelCitacion`) que codifica el contrato: para estos dos campos se usa la parte fecha UTC (el
  día publicado), SIN conversión de zona. Docstring con el contrato completo.
- **`app/app/agenda/page.tsx`**: slice `dayKey`/`dayLabel`, cobertura min/max y resultados de
  búsqueda usan el helper (antes `DIA_CALENDARIO_CHILE` tz America/Santiago).
- **`app/components/citacion-card.tsx`**: badge de fecha usa `badgeFechaCitacion` (revierte el
  `timeZone: America/Santiago` SOLO para estos campos date-only).
- **`app/components/estado-actual-block.tsx`**: `citacionVigente`/`citacionesPasadas` comparan el
  día publicado (helper) vs **hoy-Chile** (el instante actual SÍ es tz Chile — correcto);
  `semanaIsoChile` deriva la semana del día publicado. `DIA_CALENDARIO_CHILE` → `…_HOY` (aplica
  SOLO a "hoy"). 11929-13 (hoy 22-jul) sigue vigente; 18193-06 (21-jul) sigue pasada.
- **`app/components/agenda-filtros.tsx`**: docstring — el island consume `dayKey`/`dayLabel` del
  server tal cual, NUNCA re-deriva con `Date` local ni tz.
- **Tests**: el test "00:00Z renderiza el día anterior" se **invirtió** (00:00Z renderiza SU fecha
  UTC) + caso 20-jul/19-jul; nuevo `lib/dia-calendario.test.ts` con fixture midnight-UTC + horario
  texto. Suite completa verde (**1217**), `tsc -b` limpio.

### Verificación live del redeploy
Ver §Redeploy más abajo (hash nuevo + evidencia curl del día correcto "20-jul"/"lunes 20").
