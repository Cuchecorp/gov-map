---
phase: 117-fecha-fix-etiquetas-de-fecha-corregidas
plan: 01
subsystem: frontend / capa de presentación de fechas
tags: [FECHA-02, F-01, F-04, F-05, F-10, F-11, anti-insinuacion, formatters, chokepoint]
requires:
  - "116-FECHAS-AUDIT.md §3 (F-01, F-04, F-05, F-10, F-11) — el contrato con fix sugerido"
  - "app/lib/dia-calendario.ts — contrato date-only-medianoche-UTC ya codificado"
provides:
  - "fechaCorta con timeZone UTC explícita (contrato, no accidente del entorno)"
  - "fechaHechoCorta / fechaHechoCortaSegura — fecha del HECHO ramificada por presencia de hora"
  - "fechaPlausible — predicado de plausibilidad [1990, now+5a]"
  - "ProvenanceBadge props origenFecha / notaAgregacion + idiom LOCKED 'según fuente al {fecha}'"
  - "SUPERFICIES_FECHA en el linter anti-insinuación (20 superficies) + test (1d) de idioms"
affects:
  - "los 17 call-sites de ProvenanceBadge (un solo cambio en el chokepoint)"
  - "planes 117-02 / 117-03 / 117-04 (consumen los contratos sin re-derivar)"
tech-stack:
  added: []
  patterns:
    - "Wave-0 LOCKED: el linter se extiende ANTES de que aterrice el copy nuevo"
    - "TDD por gate: test RED commiteado antes de la implementación GREEN"
    - "source-scan del chokepoint para lo que Radix no monta en jsdom (precedente SC7 de 115)"
key-files:
  created: []
  modified:
    - app/lib/anti-insinuacion-guard.test.ts
    - app/lib/format.ts
    - app/lib/format.test.ts
    - app/components/provenance-badge.tsx
    - app/components/provenance-badge.test.tsx
    - app/components/citacion-card.test.tsx
    - app/components/sala-table-section.test.tsx
    - app/components/cruces-de-parlamentario.test.tsx
    - app/components/search-result-card.test.tsx
    - app/components/timeline-view.test.tsx
decisions:
  - "FECHA-117-OFFENDER-01 resuelto por decisión A del orquestador: la frase preexistente de cruces se registra verbatim en NEGACIONES_LOCKED; no se relaja el linter ni se toca copy ciudadano publicado"
  - "timeZone UTC —NO America/Santiago— en fechaCortaFormatter: convertir a Chile correría un día las ~45.618 filas date-only disfrazadas"
  - "fechaHechoCorta MITIGA en el render; la corrección de fondo (dos semánticas en una columna) es de ingesta y queda DECLARADA"
metrics:
  duration: ~40 min
  tasks: 3
  files: 10
  completed: 2026-07-28
---

# Phase 117 Plan 01: Capa transversal de fechas — linter, formatters y chokepoint

Idiom LOCKED "según fuente al {fecha}" en el chokepoint del badge (fin de "Actualizado hace X" en los 17 call-sites), `timeZone: "UTC"` explícita en `format.ts` y tres helpers nuevos (`fechaHechoCorta`, `fechaHechoCortaSegura`, `fechaPlausible`) que los planes 02/03/04 consumen sin re-derivar reglas de zona horaria.

## Qué se hizo, por hallazgo (antes/después verbatim)

### F-01 — copy del chokepoint (`app/components/provenance-badge.tsx`)

**Antes** (`:90`):

```tsx
<span>Actualizado {relativeTimeEs(capturedAt)}</span>
```

**Después** (`:126-135`):

```tsx
<span>
  {origenFecha === "recalculo"
    ? "recalculado por el Observatorio al "
    : "según fuente al "}
  {fechaCorta(capturedAt)}
  {notaAgregacion !== undefined && ` (${notaAgregacion})`}
</span>
```

La señal de recencia no se perdió: bajó al tooltip (`:176`, `<div>consultado {relativeTimeEs(capturedAt)}</div>`), junto al `toISOString()` que ya estaba. Intactos: la rama `capturedAt === null` ("Sin fecha de actualización" / "fuente desconocida"), `displaySource`, el `·`, el enlace `fuente oficial ↗`, `safeExternalHref`, la lógica `declarar`/`densidad` y la caja del `<span>` (WR-05 de 115).

**Commit:** `767d39a` (GREEN) · `c7927d6` (RED)

### F-10 — timeZone explícita (`app/lib/format.ts`)

**Antes** (`:12-16`):

```ts
const fechaCortaFormatter = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit", month: "short", year: "numeric",
});
```

**Después** (`:26-31`): el mismo formatter con `timeZone: "UTC"`.

**Evidencia dura del defecto**: el test RED reprodujo el bug EN VIVO en este runtime (zona Chile) — `fechaCorta(new Date("2026-07-20T00:00:00Z"))` devolvía `"19 jul 2026"`, el día ANTERIOR al publicado. No era teórico: el día renderizado dependía de dónde corriera el proceso. Ahora es contrato del código.

`grep -c 'America/Santiago' app/lib/format.ts` = **1** (solo el formatter de la rama hora-real de `fechaHechoCorta`; jamás en `fechaCortaFormatter`).

**Commit:** `34fac5c` (GREEN) · `77443e2` (RED)

### F-11 — JSDoc que mentía (`app/components/provenance-badge.tsx:17-21`)

**Antes:** `Cada dato mostrado lleva "Actualizado hace X · {fuente} — fuente oficial ↗". Si el dato tiene más de 48h se marca en amber`.

**Después:** describe el copy REAL (ambos prefijos) y el umbral REAL: *"más de 14 días (umbral por cadence de ingesta, `STALE_THRESHOLD_MS` en `lib/format.ts`)"*. Cero cambio de comportamiento.

**Commit:** `767d39a`

## Contratos entregados a 02/03/04

| Símbolo | Archivo | Semántica |
|---|---|---|
| `fechaHechoCorta(d)` | `lib/format.ts` | F-05. `00:00:00.000Z` ⇒ date-only disfrazada ⇒ formatter UTC; hora real ⇒ calendario chileno. `2023-11-17T00:14:41Z` → `16 nov 2023`. |
| `fechaHechoCortaSegura(raw, fallback?)` | `lib/format.ts` | Guard anti-500 SIN el `slice(0,10)` destructivo de `fechaCortaSegura` (ese corte tiraba la hora que decide el día). |
| `fechaPlausible(d, now?)` | `lib/format.ts` | F-04. `[1990-01-01Z, now+5a]`. PREDICADO, no filtro — prohibido como `where fecha <= current_date` global (mataría las 17 citaciones futuras legítimas de /agenda). |
| `origenFecha?: "fuente" \| "recalculo"` | `provenance-badge.tsx` | F-02. Default `"fuente"` ⇒ ningún call-site existente cambia. |
| `notaAgregacion?: string` | `provenance-badge.tsx` | F-03. Se renderiza ` ({nota})` tras la fecha. |

## Hallazgos

### FECHA-117-OFFENDER-01 — `señal` preexistente en las superficies de cruces

Al sumar `SUPERFICIES_FECHA` (20 rutas) al linter, el escaneo pasó de 0 a **2 offenders**, ambos por el término `señal` (prohibido desde el carril VSIM, 102-01):

| Archivo | Línea | Texto renderizado |
|---|---|---|
| `app/components/cruces-de-parlamentario.tsx` | 94 | `Cada señal es un conteo de hechos públicos fechados: reuniones de lobby registradas bajo la Ley 20.730, agrupadas por sector de la contraparte.` |
| `app/components/cruces-de-proyecto.tsx` | 89 | (idéntico) |

Es copy **preexistente** y **factual**: la frase DEFINE `señal` como un conteo de hechos, es decir niega precisamente la lectura metafórica que el término existe para bloquear ("la cifra es una señal de bancada"). Siguiendo la regla LOCKED del plan, **se detuvo el plan y se escaló**; el orquestador decidió **Opción A**: registrar la frase verbatim en `NEGACIONES_LOCKED`, mismo tratamiento que `LEYENDA_SIMILITUD_VOTO` / `LEYENDA_CROSS_LINK`.

Se registró como literal (precedente: la leyenda VOTO, primera entrada del array) porque el copy vive inline en el JSX de ambos componentes y no en una constante exportada. Esa es la propiedad **auto-correctiva** de la resta: si alguien edita la frase, el literal deja de calzar y el guard vuelve a morder sobre esas superficies, forzando una decisión explícita.

**117-04 debe espejar este hallazgo y la decisión A en `117-DISPOSICION.md` §2.**

Lo que NO se hizo: no se relajó el linter (ninguna superficie se excluyó), no se tocó copy ciudadano publicado, no se agregaron términos a `TERMINOS_PROHIBIDOS`.

## Deviations from Plan

### Deviaciones auto-resueltas

**1. [Rule 3 — Bloqueante] `grep -c 'America/Santiago' app/lib/format.ts` daba 4, no 1**

- **Found during:** Task 2, verificación de acceptance criteria.
- **Issue:** el criterio cuenta LÍNEAS, y el JSDoc que explica *por qué NO* se usa la zona de Chile mencionaba el literal tres veces. El código estaba correcto (una sola ocurrencia real, en `fechaHechoRealFormatter`) pero el guard-as-written fallaba.
- **Fix:** las tres menciones en prosa se reescribieron a "la zona de Chile" / "la zona horaria de Chile" sin perder ni una idea del razonamiento. El criterio queda cumplido y sigue siendo verificable por grep.
- **Files modified:** `app/lib/format.ts`
- **Commit:** `34fac5c`

**2. [Rule 3 — Bloqueante] el JSDoc nuevo de F-11 contenía el literal que su propio test prohíbe**

- **Found during:** Task 3, GREEN.
- **Issue:** el JSDoc explicaba el defecto citando `"Actualizado hace X"` verbatim; el test de F-11 (`not.toContain("Actualizado hace X")`) lo cazó.
- **Fix:** se reformuló a *"antes el rótulo era la RECENCIA de nuestro scraping"* — misma explicación, sin re-introducir la cadena. El test se conserva estricto.
- **Files modified:** `app/components/provenance-badge.tsx`
- **Commit:** `767d39a`

### Desviación escalada (no auto-resuelta)

**3. [Rule 4 — Decisión de régimen] FECHA-117-OFFENDER-01** — ver §Hallazgos. Plan detenido en Task 1, escalado al orquestador, resuelto con Opción A. Cero acción unilateral sobre el vocabulario del régimen anti-insinuación.

## Nota sobre el tooltip (limitación declarada)

El `TooltipContent` de Radix sólo monta su contenido al abrirse (hover/focus) y jsdom no ejerce ese ciclo de forma fiable. La línea `consultado {relativeTimeEs(capturedAt)}` se verifica por **source-scan** del chokepoint (precedente: el source-scan SC7 de 115), no por render. Lo que el test SÍ prueba por render es lo que importa para el hallazgo: `hace X` ya no es texto visible del badge.

## Verificación

| Check | Resultado |
|---|---|
| `pnpm vitest run` (app) | **1495/1495 verde**, 107 archivos (base 1486 tras Task 2 → +9 de Task 3) |
| `pnpm -r exec tsc -b` | **exit 0** |
| linter anti-insinuación | **40/40 verde**, 0 offenders sobre las superficies con FECHA sumado |
| `grep -c "SUPERFICIES_FECHA"` | 4 (declaración + spread + bucle 1c + JSDoc) ≥ 3 |
| test `(1d)` | pasa con los 10 idioms verbatim y `toHaveLength(10)` anclado |
| `grep -c 'timeZone: "UTC"' app/lib/format.ts` | 1 |
| `grep -c 'America/Santiago' app/lib/format.ts` | **1** |
| `grep -v '^\s*\*' provenance-badge.tsx \| grep -c "Actualizado"` | **0** |
| `grep -c "según fuente al"` / `"recalculado por el Observatorio al"` | 4 / 2 |
| `grep -n "Sin fecha de actualización"` | presente (rama null intacta) |
| Flags / `.env` | **NO tocados** (`git diff --stat` no incluye `.env`, `.env.example` ni gate alguno) |
| `TERMINOS_PROHIBIDOS` | sin cambios |
| `NEGACIONES_LOCKED` | +1 entrada (decisión A, documentada arriba) |

## Commits

| Hash | Gate | Mensaje |
|---|---|---|
| `ebf9b8b` | Task 1 | `test(117-01)`: linter extendido al carril FECHA (Wave-0) |
| `77443e2` | Task 2 RED | tests de F-10/F-05/F-04 |
| `34fac5c` | Task 2 GREEN | timeZone UTC + 3 helpers |
| `c7927d6` | Task 3 RED | tests del idiom LOCKED + migración de los 6 asserts |
| `767d39a` | Task 3 GREEN | chokepoint F-01 + props F-02/F-03 + JSDoc F-11 |

## Known Stubs

Ninguno. Los tres helpers nuevos están implementados y probados; `origenFecha="recalculo"` y `notaAgregacion` existen y están probados pero **aún no los pasa ningún call-site** — eso es trabajo declarado de los planes 02/03 (F-02/F-03), no un stub: los defaults dejan el comportamiento de los 17 call-sites byte-compatible salvo por el idiom, que es justamente el fix.

## Threat Flags

Ninguna superficie de red, auth, acceso a archivos ni schema fue tocada. El diff es presentacional + tests.

## Self-Check: PASSED

Los 5 commits existen en el árbol de git y los archivos declarados como creados/modificados existen en disco.
