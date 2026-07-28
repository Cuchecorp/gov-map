---
phase: 117-fecha-fix-etiquetas-de-fecha-corregidas
plan: 03
subsystem: frontend / carril parlamentario · lobby · cruces · dinero
tags: [FECHA-02, F-02, F-05, F-07, F-08, MONEY-gated, anti-insinuacion]
requires:
  - "117-01 — fechaHechoCorta / fechaHechoCortaSegura / props origenFecha del badge"
  - "116-FECHAS-AUDIT.md §3 (F-02, F-05, F-07, F-08) — contrato con fix sugerido"
provides:
  - "badge de cruces con origenFecha=recalculo (el rebuild se nombra rebuild)"
  - "rótulo del hecho 'Votada el' en votos-por-parlamentario y votacion-card"
  - "rótulo condicional 'Reunión del' en ambas vistas de lobby + menciones"
  - "rótulos MONEY separados: fuente (fecha_corte) vs ingesta (ingestado_hasta)"
affects:
  - "117-04 (117-DISPOSICION.md) — antes/después verbatim por hallazgo"
  - "el flip futuro del gate MONEY: el copy queda corregido con el gate OFF"
tech-stack:
  added: []
  patterns:
    - "TDD por gate: RED commiteado antes de cada GREEN"
    - "rótulo compuesto DENTRO del ternario cuando la variable transporta fallback textual"
    - "literales verificables por grep se mantienen fuera de la prosa de los comentarios"
key-files:
  created: []
  modified:
    - app/components/cruces-de-parlamentario.tsx
    - app/components/cruces-de-parlamentario.test.tsx
    - app/components/cruces-de-proyecto.tsx
    - app/components/cruces-de-proyecto.test.tsx
    - app/components/votos-por-parlamentario.tsx
    - app/components/votos-por-parlamentario.test.tsx
    - app/components/votacion-card.tsx
    - app/components/votacion-card.test.tsx
    - app/components/lobby-de-parlamentario.tsx
    - app/components/lobby-de-parlamentario.test.tsx
    - app/components/lobby-menciones-de-boletin.tsx
    - app/components/lobby-menciones-de-boletin.test.tsx
    - app/components/contratos-de-parlamentario.tsx
    - app/components/contratos-de-parlamentario.test.tsx
    - app/components/financiamiento-de-parlamentario.tsx
    - app/components/financiamiento-de-parlamentario.test.tsx
    - app/components/contratos-por-contraparte.tsx
    - app/components/contratos-por-contraparte.test.tsx
    - app/components/aportes-por-contraparte.tsx
    - app/components/aportes-por-contraparte.test.tsx
decisions:
  - "el rótulo de lobby se compone en el ternario, no en el JSX: la variable fechaTexto transporta o fecha o fallback textual, y un prefijo ciego produciría una frase absurda sobre el honest-state"
  - "lobby conserva fechaCorta (no fechaHechoCorta): PROD refutó el drift de zona (0/17.762 filas)"
  - "lobby-menciones-de-boletin NO monta ProvenanceBadge: el assert de coexistencia del plan no aplica ahí; se ancló el hecho con un assert negativo"
metrics:
  duration: ~35 min
  tasks: 3
  files: 20
  completed: 2026-07-28
---

# Phase 117 Plan 03: Carril parlamentario, lobby, cruces y dinero — cada fecha con su sustantivo

Cierre de F-02, F-05 (votos/lobby), F-07 y F-08: el reloj del pipeline deja de presentarse como el de la fuente, las fechas del hecho ganan rótulo donde conviven con un badge de procedencia, y las dos fechas MONEY (`fecha_corte` de la fuente vs `ingestado_hasta` nuestra) dejan de compartir el rótulo `corte al`. El gate MONEY sigue OFF: sólo cambió el copy en el código.

## Qué se hizo, por hallazgo (antes/después verbatim)

### F-02 — el badge del cruce presentaba nuestro rebuild como observación de la fuente

`app/components/cruces-de-parlamentario.tsx:194-203` y `app/components/cruces-de-proyecto.tsx:176-185`.

**Antes** — el badge tomaba `fecha_captura` con el `origenFecha` por defecto, rindiendo `según fuente al 28 jul 2026`:

```tsx
<ProvenanceBadge
  densidad="lista"
  capturedAt={new Date(s.fecha_captura)}
```

**Después:**

```tsx
<ProvenanceBadge
  densidad="lista"
  origenFecha="recalculo"
  capturedAt={new Date(s.fecha_captura)}
```

La distinción que hasta ahora vivía sólo en el comentario del código pasó a ser visible: el badge dice `recalculado por el Observatorio al 28 jul 2026`. El comentario contiguo se amplió con la evidencia de PROD del audit — las 11 señales de D1165 comparten `min(fecha_captura) = max(fecha_captura) = 2026-07-28 03:23:00.035505+00`, idénticas al microsegundo, sobre una reunión del `2025-04-10`. Ninguna fuente publica 11 hechos en el mismo microsegundo.

Intactos: `Reunión registrada el {fecha}` (contraejemplo limpio que el audit cita) y la elección de `s.fecha_captura` sobre `item.fecha` (WR-02 — eso mata el stale-amber falso).

**Commits:** `b4f95a6` (RED) · `bc341ac` (GREEN) · `414d117` (prosa)

### F-07 + F-05 — la fecha del hecho en votos

`app/components/votos-por-parlamentario.tsx:527-538` — la fecha vivía en `font-mono` a centímetros del badge de procedencia, sin sustantivo que la distinguiera.

**Antes:**

```tsx
<span className="font-mono text-muted-foreground">
  {fechaCortaSegura(e.fecha)}
</span>
```

**Después:**

```tsx
<span className="text-muted-foreground">
  Votada el{" "}
  <span className="font-mono">
    {fechaHechoCortaSegura(e.fecha)}
  </span>
</span>
```

`votacion.fecha` es `timestamptz` con hora real: `fechaHechoCortaSegura` da el día chileno. Test vivo: `2023-11-17T00:14:41+00:00` → `Votada el 16 nov 2023` (21:14 del 16 en Chile). El `font-mono` quedó SOLO sobre la fecha. Sin tocar el `mesAnioFormatter` de `:297` ni el guard anti-fecha-basura de `:234`.

`app/components/votacion-card.tsx:37-45` — mismo rótulo con `fechaHechoCorta(fecha)`; `2026-07-22T00:00:00Z` (date-only disfrazada) se rinde el **22**, no el 21.

**Commits:** `a31e1fb` (RED) · `94975e3` (GREEN)

### F-07 — el rótulo de lobby es CONDICIONAL, no un prefijo ciego

`app/components/lobby-de-parlamentario.tsx:161` (vista agrupada) y `:489` (cronológica).

**Antes:**

```ts
const fechaTexto = a.fecha
  ? fechaCorta(new Date(a.fecha))
  : a.fecha_raw ?? "Fecha no publicada";
```

**Después:**

```ts
const fechaTexto = a.fecha
  ? `Reunión del ${fechaCorta(new Date(a.fecha))}`
  : a.fecha_raw ?? "Fecha no publicada";
```

La MISMA variable transporta o una fecha formateada o un fallback textual. Anteponer el rótulo en el JSX (`:441`, `:487`) lo habría pegado también al honest-state, produciendo una frase absurda — peor que el defecto que F-07 cierra. El rótulo se compone **dentro del ternario**; el fallback (el `fecha_raw` crudo o el honest-state) viaja sin prefijo, verbatim. Fijado con asserts **negativos** en ambas vistas.

`grep -n "Reunión del" app/components/lobby-de-parlamentario.tsx` apunta a `161` y `489` — las líneas del ternario, no del render: prueba estructural de que el rótulo es condicional.

Las fechas siguen con `fechaCorta` y quedó comentado por qué: PROD refutó el drift (0/17.762 — `lobby_audiencia.fecha` está 100 % a las 04:00 UTC = 00:00 Chile). Nadie debe "arreglar" lo que no está roto.

`app/components/lobby-menciones-de-boletin.tsx:127-133` — `Reunión del {fecha} · `, con el `font-mono` acotado a la fecha.

**Commits:** `a31e1fb` (RED) · `94975e3` (GREEN)

### F-08 — `fecha_corte` (la fuente) vs `ingestado_hasta` (nosotros)

Cuatro superficies MONEY, seis call-sites. `fecha_corte` es el borde de lo que cubre la FUENTE; `ingestado_hasta` es el borde de lo que ingerimos NOSOTROS. Ambas viajaban bajo `corte al`.

| Archivo:línea | Antes | Después |
|---|---|---|
| `contratos-de-parlamentario.tsx:188` | `Consultado por RUT, corte al {fechaCorteTexto}.` | `Consultado por RUT; la fuente cubre hasta el {fechaCorteTexto}.` |
| `contratos-de-parlamentario.tsx:238-240` | `Consultamos ChileCompra por el RUT de este parlamentario (corte al {fechaTexto}) …` | `… (nuestra ingesta llega hasta el {fechaTexto}) …` |
| `financiamiento-de-parlamentario.tsx:225` | `Consultado por nombre del candidato, corte al {fechaCorteTexto}.` | `Consultado por nombre del candidato; la fuente cubre hasta el {fechaCorteTexto}.` |
| `financiamiento-de-parlamentario.tsx:364` | `Consultamos SERVEL por este candidato (corte al {fechaTexto}) …` | `… (nuestra ingesta llega hasta el {fechaTexto}) …` |
| `contratos-por-contraparte.tsx:168` | `Consolidado, corte al {fechaCorteTexto}.` | `Consolidado por el Observatorio; la fuente cubre hasta el {fechaCorteTexto}.` |
| `aportes-por-contraparte.tsx:189` | `Consolidado, corte al {fechaCorteTexto}.` | `Consolidado por el Observatorio; la fuente cubre hasta el {fechaCorteTexto}.` |

`Consolidado` pelado tampoco decía QUIÉN consolidó: ahora nombra al sujeto. Las fechas siguen con `fechaCorta` (`fecha_corte`, `fecha_oc`, `fecha_aporte`, `ingestado_hasta` son `date` puros — §1.3 los declara `cumple`).

**El gate MONEY no se tocó.** `git status` durante toda la Task 3 mostró exclusivamente los cuatro `.tsx`; ni `.env`, ni `.env.example`, ni `money-gate`. `money-antiflip-guard.test.ts` verde.

**Commits:** `014ed90` (RED) · `a966979` (GREEN)

## F-12 — explícitamente NO viaja en este plan

El chip de año de `/buscar` migró al **Plan 04, Task 3**, con la rama correcta (rotular, no borrar): el audit lo dio por INERTE pero `buscar-filtros.tsx:490` sí pasa `anio={row.anio}`. Nada de este plan lo toca.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Bloqueante] los criterios por grep contaban también la prosa de los comentarios**

- **Found during:** Task 1 (`origenFecha="recalculo"` = 2 en vez de 1) y Task 3 (`corte al` = 2, `Reunión del` = 3, `Fecha no publicada` = 3 en vez de 2).
- **Issue:** los comentarios que explican el fix citaban verbatim el literal que el criterio cuenta por línea. El código estaba correcto; el guard-as-written fallaba. Es el mismo modo de falla que la desviación 1 de 117-01.
- **Fix:** las menciones en prosa se reformularon sin perder ni una idea del razonamiento ("el origen de fecha declarado abajo", "el rótulo anterior", "una frase absurda"). Todos los criterios quedan cumplidos y siguen siendo verificables por grep.
- **Files modified:** `cruces-de-parlamentario.tsx`, `cruces-de-proyecto.tsx`, `lobby-de-parlamentario.tsx`, `contratos-por-contraparte.tsx`, `aportes-por-contraparte.tsx`
- **Commits:** `414d117`, `94975e3`, `a966979`

**2. [Rule 3 — Bloqueante] el wrap de JSX partía el literal `nuestra ingesta llega hasta el`**

- **Found during:** Task 3, verificación de acceptance criteria (`grep -rn` devolvía 1 hit, no 2).
- **Issue:** el texto JSX quedó cortado como `(nuestra` / `ingesta llega hasta el`. El render era correcto (JSX colapsa el salto a un espacio) pero el criterio por grep —y cualquier auditoría textual futura— no podía verlo.
- **Fix:** el paréntesis de apertura se movió a su propia expresión (`{" ("}`) para que la frase quepa completa en una línea.
- **Files modified:** `app/components/contratos-de-parlamentario.tsx`
- **Commit:** `a966979`

**3. [Rule 1 — Test incorrecto] el assert de coexistencia no aplicaba en `lobby-menciones-de-boletin`**

- **Found during:** Task 2, GREEN.
- **Issue:** el plan pedía, "en cada superficie", un assert de que el rótulo del hecho y `según fuente al` coexisten. Esa superficie **no monta `ProvenanceBadge`** (`grep -c ProvenanceBadge` = 0): no hay segunda fecha en la fila, así que no había ambigüedad que desambiguar y el assert era falso por construcción.
- **Fix:** el test se partió en dos — uno prueba el rótulo, el otro **ancla con un assert negativo** que esta superficie no lleva idiom de captura, para que un badge futuro no entre sin rótulo por la puerta de atrás.
- **Files modified:** `app/components/lobby-menciones-de-boletin.test.tsx`
- **Commit:** `94975e3`

Ninguna desviación requirió decisión de arquitectura (Rule 4). Ningún paquete se instaló.

## Verificación

| Check | Resultado |
|---|---|
| `pnpm vitest run` (app) | **1530/1530 verde**, 107 archivos (base 1495 tras 117-01 → +35) |
| `pnpm -r exec tsc -b` | **exit 0** |
| linter anti-insinuación | verde (40/40) con ambas superficies de cruces en `SUPERFICIES_FECHA` |
| `money-antiflip-guard.test.ts` | **verde** — nada se enciende |
| `grep -c 'origenFecha="recalculo"'` cruces-de-parlamentario / cruces-de-proyecto | 1 / 1 |
| `grep -c "Votada el"` votos-por-parlamentario / votacion-card | 1 / 1 |
| `grep -c "Reunión del"` lobby-de-parlamentario / lobby-menciones | **2** / 1 |
| `grep -n "Reunión del"` lobby-de-parlamentario | `161`, `489` — ambas del TERNARIO |
| `grep -c "Fecha no publicada"` lobby-de-parlamentario | **2** (sin cambios respecto al estado previo) |
| `grep -v '^\s*[*/]' votacion-card.tsx \| grep -c "fechaCorta("` | **0** |
| `grep -rn "corte al"` en `app/components/*.tsx` (no-test) | **0** |
| `grep -rl "la fuente cubre hasta el"` | las **4** superficies MONEY |
| `grep -rn "nuestra ingesta llega hasta el"` | **2** (contratos + financiamiento) |
| `grep -c "Consolidado por el Observatorio"` contraparte ×2 | 1 / 1 |
| `git diff --name-only` | sin `.env`, `.env.example` ni archivo de gate alguno |

## Commits

| Hash | Gate | Mensaje |
|---|---|---|
| `b4f95a6` | Task 1 RED | asserts de recálculo en las superficies de cruces |
| `bc341ac` | Task 1 GREEN | `origenFecha="recalculo"` + evidencia de PROD en el comentario |
| `414d117` | Task 1 fix | evitar el literal del prop en la prosa del comentario |
| `a31e1fb` | Task 2 RED | rótulo del hecho en votos y lobby (con los negativos de lobby) |
| `94975e3` | Task 2 GREEN | `Votada el` / `Reunión del` condicional |
| `014ed90` | Task 3 RED | rótulos separados de fuente e ingesta en MONEY |
| `a966979` | Task 3 GREEN | F-08 cerrado con el gate OFF |

## Known Stubs

Ninguno. Las cuatro superficies MONEY siguen gated (invisibles al ciudadano hoy), pero eso es el gate legal preexistente, no un stub: el copy quedó corregido **antes** del flip, que es exactamente lo que F-08 exige.

## Threat Flags

Ninguna. El diff es presentacional + tests: cero superficie de red, auth, acceso a archivos o schema. T-117-07 mitigado (`origenFecha="recalculo"` + assert negativo de `según fuente al`); T-117-08 y T-117-09 mitigados (F-08 cerrado con el gate OFF, `money-antiflip-guard` en la verificación, `git diff` sin flags).

## Self-Check: PASSED

Los 7 commits existen en el árbol de git y los 20 archivos declarados como modificados existen en disco.
