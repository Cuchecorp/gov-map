---
phase: 117-fecha-fix-etiquetas-de-fecha-corregidas
plan: 02
subsystem: frontend / carril /proyecto/[boletin]
tags: [FECHA-02, F-03, F-04, F-05, F-07, F-09, F-10, F-13, fechas, accesibilidad]
requires:
  - "117-01 — fechaHechoCorta / fechaPlausible / props notaAgregacion del badge"
  - "116-FECHAS-AUDIT.md §3 (F-03, F-04, F-05, F-07, F-09, F-13) + §1.2 fila 1 y fila 10"
  - "app/lib/dia-calendario.ts — contrato date-only-medianoche-UTC"
provides:
  - "guard de plausibilidad en los DOS `fechaValida` del carril proyecto (timeline-view + estado-actual-block)"
  - "rótulo del hito en el timeline (`Hito del …`) y separador `—` en el stepper"
  - "las 6 fechas date-only del bloque '¿Dónde está hoy?' —incluidos los 2 aria-label— por badgeFechaCitacion"
  - "badge de la sección Tramitación con calificador de agregación (evento más reciente)"
affects:
  - "117-03 (mismos contratos; el patrón de omisión honesta por plausibilidad ya está sentado)"
  - "117-04 / 117-DISPOSICION.md — antes/después verbatim de 7 hallazgos"
tech-stack:
  added: []
  patterns:
    - "guard de plausibilidad PUESTO EN EL HELPER COMPARTIDO: `fechaValida` de timeline-view la reusa el stepper ⇒ un cambio cubre capa-1 y capa-2"
    - "paridad texto/aria-label por construcción: el mismo helper alimenta ambos canales"
    - "TDD por gate: RED commiteado antes del GREEN en las dos tareas con comportamiento"
key-files:
  created: []
  modified:
    - app/components/timeline-view.tsx
    - app/components/timeline-view.test.tsx
    - app/components/timeline-event.tsx
    - app/components/capa1/tramitacion-stepper.tsx
    - app/components/capa1/tramitacion-stepper.test.tsx
    - app/components/estado-actual-block.tsx
    - app/components/estado-actual-block.test.tsx
    - app/app/proyecto/[boletin]/page.tsx
decisions:
  - "El guard F-04 vive en `fechaValida` (helper compartido), NO en cada render: el stepper lo hereda sin tocarlo y ningún consumidor futuro puede saltárselo por olvido"
  - "`timeline-event.tsx` DUPLICA el guard localmente porque recibe un `Date` ya construido por el llamante — defensa en profundidad sobre el canal que no pasa por `fechaValida`"
  - "F-07 se cierra DISTINTO en cada superficie según adyacencia real verificada en el árbol: separador `—` en el stepper (fecha adyacente a la descripción), rótulo `Hito del` en el timeline (fecha en el header, descripción en otro `<p>`)"
  - "`fechaCorta(urgenciaFuente.fechaCaptura)` CONSERVADO — es el helper correcto para una fecha_captura y sobrevive al diff intacto"
metrics:
  duration: ~35 min
  tasks: 3
  files: 8
  completed: 2026-07-28
---

# Phase 117 Plan 02: Carril /proyecto — cada fecha rotulada por lo que es

Siete hallazgos cerrados sobre la superficie donde conviven las tres semánticas de fecha (hecho, captura, date-only): ninguna fecha implausible llega al DOM, las fechas del hecho se rinden con el día chileno real, las date-only con el helper que el propio archivo ya declaraba, y el badge de sección declara que su frescura es la del evento más reciente, no la del set.

## Qué se hizo, por hallazgo (antes/después verbatim)

### F-04 — el año 2626 (`timeline-view.tsx:53-68`, `estado-actual-block.tsx:87-102`, `timeline-event.tsx:96`)

**Antes** (`timeline-view.tsx`, idéntico en `estado-actual-block.tsx`):

```ts
export function fechaValida(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}
```

**Después:**

```ts
export function fechaValida(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return fechaPlausible(d) ? d : null;
}
```

El guard vive en el helper COMPARTIDO: `capa1/tramitacion-stepper.tsx` importa `fechaValida` de `timeline-view` (T-55-11), así que capa-1 lo hereda sin una línea de cambio. `timeline-event.tsx` lo duplica localmente (`{fecha && fechaPlausible(fecha) && …}`) porque recibe un `Date` YA construido por el llamante — es el único canal que no pasa por `fechaValida`.

Efecto sobre el caso real de PROD (boletín `18232-25`, evento `2626-05-25`): la fila deja de apropiarse del "Último hito" (que se elige por fecha MÁXIMA) y el bloque cae al hito plausible más reciente. La fecha se OMITE; el hecho (tipo + descripción + enlace a fuente) sigue visible.

**Límite declarado (audit §6, límite 7):** esto filtra el RENDER. Las 2 filas corruptas de `tramitacion_evento` se reportan a la fase de ingesta; 117 no toca la base.

**Commits:** `bc63488` (timeline/stepper/evento) · `97aaf7d` (estado-actual-block) · RED `3804dcf` / `0e3e755`

### F-05 — día UTC en `tramitacion_evento.fecha` (4 renders)

`fechaCorta(…)` → `fechaHechoCorta(…)` en:

| Archivo | Render |
|---|---|
| `timeline-event.tsx` | fecha del hito en el header |
| `capa1/tramitacion-stepper.tsx` | fecha del paso |
| `capa1/tramitacion-stepper.tsx` | urgencia vigente del encabezado |
| `estado-actual-block.tsx` | "Último hito" y "Urgencia … vigente desde el" |

Assert de comportamiento: un evento de `2023-11-17T00:14:41Z` ahora rinde **`16 nov 2023`** (el día chileno real), no el 17. Las filas date-only disfrazadas (44.569) siguen rindiendo su parte UTC — `fechaHechoCorta` ramifica por presencia de hora, no convierte a ciegas.

**Commits:** `bc63488`, `97aaf7d`

### F-07 — rótulo del hito, cerrado DISTINTO en cada superficie

La adyacencia se verificó en el árbol, no se asumió del audit:

**`capa1/tramitacion-stepper.tsx`** — la fecha YA vive dentro del MISMO `<p>` que `{evento.descripcion}`. Antes:

```tsx
{evento.descripcion}
{d && <span className="ml-2 font-mono …">{fechaCorta(d)}</span>}
```

Después: `{" — "}` (U+2014) antepuesto al `<span>` ⇒ `{descripcion} — {fecha}`. **CERO rótulo nuevo**: la descripción ES el sustantivo del hecho.

**`timeline-event.tsx`** — aquí la fecha NO es adyacente (vive en el header junto al `CamaraChip`; la descripción está en un `<p>` aparte, más abajo), así que un separador no diría de qué es la fecha. Después:

```tsx
<span className="text-sm text-muted-foreground leading-none">
  Hito del <span className="font-mono">{fechaHechoCorta(fecha)}</span>
</span>
```

`Hito del …` es el idiom YA registrado en el fixture `(1d)` del linter (Plan 01) — no se inventó rótulo alguno. El `font-mono` bajó al `<span>` interior para que sólo la fecha vaya en mono, sin cambiar la caja.

**Commit:** `bc63488`

### F-09 — seis renders date-only con el formatter que el archivo prohíbe (`estado-actual-block.tsx`)

La inconsistencia más dura del audit: el JSDoc de `DIA_CALENDARIO_CHILE_HOY` (`:152-165`) declara que las fechas de citación/sala NO se convierten de zona… y seis líneas más abajo el render usaba `fechaCorta`.

Las SEIS ocurrencias migraron a `badgeFechaCitacion` (que delega en `diaCalendarioCitacion`, el MISMO helper que el archivo ya usaba para decidir vigencia):

| Render | Canal |
|---|---|
| citación vigente | texto |
| citación pasada | texto |
| tabla de sala (1 aparición) | texto |
| tabla de sala (1 aparición) | **aria-label** |
| tabla de sala (N apariciones) | **aria-label** |
| tabla de sala (N apariciones) | texto |

Assert de comportamiento: `2026-07-20T00:00:00Z` ahora rinde **`20-jul`** y el DOM no contiene `19`. Los dos `aria-label` usan EXACTAMENTE el mismo helper que el texto visible: el nombre accesible es el canal ÚNICO de la fecha para quien usa lector de pantalla, y con `fechaCorta` decía un día distinto del visible (T-117-05). La paridad quedó por construcción, no por convención, y hay assert por `getByLabelText`.

La citación vigente maneja el `null` de retorno con omisión honesta: si la fecha es impresentable se omite el fragmento `" el {fecha}"` y la línea conserva la comisión — nunca "Invalid Date", nunca una fecha inventada.

**Commit:** `97aaf7d`

### F-13 — `relativeTimeEs` sobre una fecha del hecho (`estado-actual-block.tsx`)

**Antes:**

```tsx
Urgencia {urgenciaEstado.tipo} vigente desde el{" "}
<span className="font-mono">{fechaCorta(urgenciaEstado.desde)}</span>{" "}
(
<span className="font-mono">{relativeTimeEs(urgenciaEstado.desde)}</span>
).
```

**Después:** el paréntesis y su `<span>` se eliminaron; queda sólo la fecha absoluta, ahora por `fechaHechoCorta`. `relativeTimeEs` salió del import.

Motivo verbatim del audit: ese helper existe para el reloj de SCRAPING (su parámetro se llama `capturedAt`) y a ≥7 días degrada a la fecha absoluta ⇒ el bloque mostraba DOS VECES la misma fecha ("vigente desde el 22 jul 2026 (22 jul 2026)"), que es el caso NORMAL de una urgencia. `grep -c "relativeTimeEs"` en el archivo = **0**.

**Commit:** `97aaf7d`

### F-03 — badge de sección sobre un MAX (`page.tsx` + `estado-actual-block.tsx`)

**`app/app/proyecto/[boletin]/page.tsx`** — el `<ProvenanceBadge>` del heading "Tramitación" recibe `notaAgregacion="evento más reciente"` ⇒ rinde `según fuente al {fecha} (evento más reciente)`. El `reduce` NO cambió y el número de badges tampoco (SC7: UN badge por sección, `grep -c "ProvenanceBadge"` = 3, igual que antes).

El comentario del origen se corrigió: la columna es `tramitacion_evento.fecha_captura`. La atribución a la tabla de snapshots crudos era **imposible** — esa tabla no tiene ni `fecha_captura` ni `proyecto_id` (§1.2 fila 1 del audit). Junto al `reduce` quedó registrado el defecto que el calificador hace visible: en PROD, boletín `14309-04`, `max(fecha_captura) = 2026-07-09` sobre 99 eventos cuyo hecho más reciente es del `2026-07-07` — un solo evento re-scrapeado hoy hacía que la sección entera afirmara frescura.

**`estado-actual-block.tsx` (matiz)** — el idiom de `:429` es el CONTRAEJEMPLO LIMPIO del audit y NO se tocó; sólo se le sumó el calificador:

```tsx
según {sourceLabel(urgenciaFuente.origen)} al{" "}
<span className="font-mono">{fechaCorta(urgenciaFuente.fechaCaptura)}</span>{" "}
(evento más reciente).
```

**Commits:** `1c6d931` (page) · `97aaf7d` (bloque)

### F-10 residual — `mesAnioFormatter` (`timeline-view.tsx:29-41`)

`timeZone: "UTC"` añadida (NO `America/Santiago`). Sin la opción, el mes/año del rótulo de período dependía de la zona del RUNTIME; y en un evento del día 1 de mes, convertir a Chile no habría corrido un día sino un MES entero en este rótulo.

**Commit:** `bc63488`

## Prohibición LOCKED respetada

`grep -n "fechaCorta(" app/components/estado-actual-block.tsx` devuelve **una sola línea**:

```
468:                  {fechaCorta(urgenciaFuente.fechaCaptura)}
```

Es exactamente la ocurrencia permitida. `fecha_captura` NO se ruteó por `fechaHechoCorta` en ningún punto: su rama de hora real formatea en la zona de Chile y cambiaría el día visible en silencio — el defecto preciso que esta fase existe para impedir.

## Deviations from Plan

### Deviaciones auto-resueltas

**1. [Rule 1 — Bug de test] `tramitacion-stepper.test.tsx` rompió con el separador de F-07**

- **Found during:** Task 1, GREEN.
- **Issue:** el assert `(a)` usaba `screen.getByText("Informe de comisión de Hacienda")`. RTL compara contra el texto DIRECTO del nodo (sólo los text-node hijos inmediatos): al insertar `{" — "}` como text-node hermano dentro del mismo `<p>`, el texto directo pasó a `"Informe de comisión de Hacienda — "` y la coincidencia exacta falló. No es una regresión del componente: el hito sigue visible y el DOM es el que el plan pide.
- **Fix:** los tres asserts del caso `(a)` pasaron a coincidencia parcial por regex, con un comentario que ancla el porqué a F-07. Lo que el test prueba —que el hito clave está visible— se conserva estricto.
- **Files modified:** `app/components/capa1/tramitacion-stepper.test.tsx`
- **Commit:** `bc63488`

**2. [Rule 3 — Bloqueante] dos acceptance criteria por `grep` mordían la PROSA, no el código**

- **Found during:** Tasks 1 y 2, verificación de criterios.
- **Issue:** (a) `grep -c "Hito del" timeline-event.tsx` daba 2 (el criterio pide 1) porque el comentario que explica el fix citaba el idiom verbatim; (b) `grep -c "relativeTimeEs" estado-actual-block.tsx` daba 2 (el criterio pide 0) porque el comentario de F-13 citaba el nombre del helper eliminado. El código estaba correcto en ambos casos.
- **Fix:** las dos menciones se reformularon sin perder la explicación ("el rótulo usado abajo es el idiom ya registrado en el fixture del linter" / "se eliminó el paréntesis con el tiempo relativo. Ese helper existe para el reloj de SCRAPING…"). Los criterios quedan cumplidos y siguen siendo verificables por grep.
- **Files modified:** `app/components/timeline-event.tsx`, `app/components/estado-actual-block.tsx`
- **Commits:** `bc63488`, `97aaf7d`

**3. [Rule 3 — Bloqueante] `grep -c "source_snapshot"` en `page.tsx` no puede ser 0**

- **Found during:** Task 3.
- **Issue:** el archivo tiene un lector legítimo de `source_snapshot` (`:653+`, permitido bajo Camino A). El criterio apunta a los COMENTARIOS sobre el origen del `capturedAt`, no al archivo entero.
- **Fix:** el comentario nuevo cita la columna real (`tramitacion_evento.fecha_captura`) y se refiere a la otra tabla como "la tabla de snapshots crudos", sin re-introducir el identificador en la explicación del `capturedAt`. Las 4 ocurrencias restantes son todas del lector legítimo.
- **Files modified:** `app/app/proyecto/[boletin]/page.tsx`
- **Commit:** `1c6d931`

Ninguna desviación requirió escalación (cero Rule 4).

## Verificación

| Check | Resultado |
|---|---|
| `pnpm vitest run` (app) | **1509/1509 verde**, 107 archivos (base 1495 tras Plan 01 → +14) |
| `pnpm -r exec tsc -b` | **exit 0** |
| linter anti-insinuación | **40/40 verde**, 0 offenders con los idioms nuevos ya en el fixture |
| `grep -c "fechaPlausible" timeline-view.tsx` | 2 (≥1) |
| `grep -v '^\s*[*/]' timeline-event.tsx \| grep -c "fechaCorta("` | **0** |
| `grep -v '^\s*[*/]' tramitacion-stepper.tsx \| grep -c "fechaCorta("` | **0** |
| `grep -c 'timeZone: "UTC"' timeline-view.tsx` | 1 |
| `grep -c "Hito del" timeline-event.tsx` | **1** |
| em-dash no-JSDoc en `tramitacion-stepper.tsx` | presente, en la línea contigua al `<span>` de la fecha |
| `grep -v '^\s*[*/]' estado-actual-block.tsx \| grep -c "fechaCorta("` | **1** — y es `fechaCaptura` (`:468`) |
| `grep -c "relativeTimeEs" estado-actual-block.tsx` | **0** |
| `grep -c "evento más reciente" estado-actual-block.tsx` | 1 |
| `grep -c "según" estado-actual-block.tsx` | 5 (el idiom limpio sobrevive) |
| `grep -n "notaAgregacion" page.tsx` | `:518` con `"evento más reciente"` |
| `grep -c "ProvenanceBadge" page.tsx` | 3 (sin aumentar — SC7 intacto) |
| `grep -rn "2626" app/components/` | sólo comentarios y tests que documentan el caso |
| Flags / `.env` | **NO tocados** |
| `git diff --diff-filter=D` sobre los 5 commits | cero archivos eliminados |

## Known Stubs

Ninguno. Los siete hallazgos están cerrados en el render con asserts de comportamiento. Lo que queda abierto es DEUDA DE DATOS ya declarada y fuera de alcance de 117 (audit §6, límites 6 y 7): las 2 filas corruptas de `tramitacion_evento` siguen en la base (aquí sólo se filtran del render) y la columna con dos semánticas mezcladas se mitiga por heurística en presentación, no se corrige en la ingesta.

## Threat Flags

Ninguna superficie de red, auth, acceso a archivos ni schema fue tocada. El diff es presentacional + tests. Los dos mitigate del registro (T-117-04 dato falso publicado, T-117-05 accesibilidad) quedaron implementados CON test; T-117-06 se respetó: cero filtro global, cero `America/Santiago` global — el guard es por render y por rango.

## Self-Check: PASSED

Los 5 commits (`3804dcf`, `bc63488`, `0e3e755`, `97aaf7d`, `1c6d931`) existen en el árbol y los 8 archivos declarados como modificados existen en disco.
