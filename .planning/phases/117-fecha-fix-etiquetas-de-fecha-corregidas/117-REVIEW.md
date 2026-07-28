---
phase: 117-fecha-fix-etiquetas-de-fecha-corregidas
reviewed: 2026-07-28T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - app/lib/format.ts
  - app/lib/dia-calendario.ts
  - app/components/provenance-badge.tsx
  - app/components/estado-actual-block.tsx
  - app/components/timeline-event.tsx
  - app/components/timeline-view.tsx
  - app/components/capa1/tramitacion-stepper.tsx
  - app/app/proyecto/[boletin]/page.tsx
  - app/components/votos-por-parlamentario.tsx
  - app/components/votacion-card.tsx
  - app/components/lobby-de-parlamentario.tsx
  - app/components/lobby-menciones-de-boletin.tsx
  - app/components/cruces-de-parlamentario.tsx
  - app/components/cruces-de-proyecto.tsx
  - app/components/contratos-de-parlamentario.tsx
  - app/components/contratos-por-contraparte.tsx
  - app/components/aportes-por-contraparte.tsx
  - app/components/financiamiento-de-parlamentario.tsx
  - app/components/actualidad-module.tsx
  - app/components/panel-actualidad.tsx
  - app/components/search-result-card.tsx
  - app/components/buscar-filtros.tsx
  - app/lib/anti-insinuacion-guard.test.ts
  - app/lib/format.test.ts
findings:
  critical: 2
  warning: 6
  info: 5
  total: 13
status: fixed
fixed_at: 2026-07-28
fixed: 11
skipped: 2
---

# Phase 117: Code Review Report

**Reviewed:** 2026-07-28
**Depth:** standard
**Files Reviewed:** 21 producción + 2 de test
**Status:** fixed (11 corregidos, 2 declarados) — 2026-07-28

## Estado por finding (code-review --fix)

| id | estado | commit | nota |
|---|---|---|---|
| CR-01 | **fixed** | `9e25a8e` | `fechaCivilCorta` (con año) en dia-calendario.ts + las 5 superficies históricas de `estado-actual-block.tsx`, texto y `aria-label` pareados. También la citación vigente, para no mezclar dos convenciones en la misma tarjeta. `badgeFechaCitacion` queda reservado a `/agenda`. Regla date-only intacta (parte fecha UTC, cero conversión de zona). Registrado en `117-DISPOSICION.md` §2(i). |
| CR-02 | **fixed** | `08e22c2` | Guard `NaN` DENTRO de `fechaHechoCorta` (fail-safe del chokepoint, patrón de `fechaCortaSegura`), con `fallback` propagado desde `fechaHechoCortaSegura`. `votacion-card` además comprueba el `Date`, no la truthiness del raw, y omite el rótulo. |
| WR-01 | **fixed** | `2fe7b94` | Rótulo compuesto dentro del ternario (patrón lobby): `fechaVotacion` con fallback vacío ⇒ el `<span>` se omite entero. Test con assert negativo sobre `null` / `""` / `"basura"`. |
| WR-02 | **fixed** | `2983931` | Comparador sin `?? 0`: las implausibles van al FINAL en orden estable, sin posición cronológica fabricada. El hecho sigue visible. 4 tests nuevos (orden, presencia, estabilidad, run de urgencia no partido). |
| WR-03 | **fixed** | `d08a113` | Evidencia PROD consultada 2026-07-28: `tramitacion_evento` min `1995-01-10` (0 filas < 1990 de 48.368) · `votacion` min `2002-12-18` (0 de 4.855). Consulta y condición de re-verificación quedan en el JSDoc. |
| WR-04 | **fixed** | `559613b` | Regex acepta `[T ]` y se normaliza el offset corto de Postgres (`+00` → `+00:00`, que no es ISO válido). La expansión está anclada a un offset real para no morder el día de un date-only puro. |
| WR-05 | **fixed** | `b420263` | `rotuloFecha` usa `fechaCivilCorta` en la rama agenda ⇒ un solo formato con año en las dos ramas del panel. Test de coherencia entre ramas. Registrado en §2(i). |
| WR-06 | **fixed** | `0f01cd6` | JSDoc corregido (fixture MANUAL, ancla de mantención — la cobertura real la da el test (1) sobre `SUPERFICIES_FECHA`) + los 6 idioms faltantes agregados. Assert nuevo fija que los 16 pasan POR `detectarInsinuaciones`, no solo que la lista mide 16. |
| IN-01 | **fixed** | `acb809d` | `fechaCitVigente` / `fechaSala0` hoisted y `fechaSala` una vez por fila del map; texto y `aria-label` comparten el valor. |
| IN-02 | **fixed** | `8fd65f6` | Los 4 `!` eliminados: filtros con chequeo explícito y `semanaIsoChile` → `string \| null`, con `enTablaSala` descartando la fila sin semana derivable. |
| IN-03 | **skipped** | — | Decisión de producto ya declarada: `actualidad-module.tsx` es huérfano por decisión registrada en `117-DISPOSICION.md` §2(c), con su destino (fase de limpieza de huérfanos). El review mismo la califica de "aceptable como decisión declarada". Borrar el archivo excede el alcance de un fix de review. |
| IN-04 | **skipped** | — | Requiere una decisión de producto/operador de alcance sitio completo (si el idiom "según fuente al…" se explica SIEMPRE —también en `ProvenanceBadge`— o NUNCA). Unificar por cuenta propia cambiaría copy ciudadano publicado en superficies fuera de 117. Queda para el operador. |
| IN-05 | **fixed** | `a32bfef` | Borde documentado en el JSDoc en vez de añadir un clamp sin ganancia. |

**Suite al cierre:** `app` 1.560/1.560 · `packages/*` 18 paquetes verdes · `tsc -b` sin errores en
`app` · ESLint limpio en los 7 archivos tocados.

## Summary

El carril de zona horaria está bien resuelto: `fechaCorta` queda anclado a `timeZone:"UTC"` con tests que ningún otro huso satisface (probe + 23:00Z), `America/Santiago` aparece **solo** en la rama hora-real de `fechaHechoCorta`, y el contrato date-only de `dia-calendario.ts` se respeta en agenda/sala. La heurística de medianoche-UTC-exacta está documentada con su falso positivo declarado.

Lo que NO está sano es el borde: (a) el cambio de `fechaCorta` → `badgeFechaCitacion` en fechas HISTÓRICAS borra el **año** de la pantalla, (b) `fechaHechoCorta` no tiene guard `NaN` y sus dos call-sites nuevos le pasan `new Date(raw)` sin validar (RangeError → 500), (c) el guard F-04 de plausibilidad interactúa mal con el sort `?? 0` de `construirItems`, empujando el evento corrupto al TOPE del timeline, y (d) queda un rótulo pegado al fallback ("Votada el fecha no informada") — exactamente el defecto que el propio F-07 documenta haber evitado en lobby.

## Critical Issues

### CR-01: `badgeFechaCitacion` borra el AÑO en fechas históricas (citaciones pasadas y tabla de sala)

**File:** `app/components/estado-actual-block.tsx:514`, `:535`, `:540`, `:555`, `:560`; `app/components/panel-actualidad.tsx:112`
**Issue:** F-09 reemplazó `fechaCorta` (→ "20 jul 2026") por `badgeFechaCitacion` (`app/lib/dia-calendario.ts:91-98`), que emite **"DD-mmm" sin año**. En `citacionVigente` (futuro próximo) es tolerable, pero se aplicó también a `citacionesPasadas` —definidas como sesiones históricas para prensa que revisa un proyecto viejo— y a `enTablaSala`, que no tiene cota temporal alguna. Una citación de 2021 se rinde "20-jul" junto a texto de ficha actual: el lector la lee como del año en curso. Esto contradice el core value del proyecto ("qué pasó, **cuándo** y según qué fuente") y es una regresión respecto del render previo. Agrava: el mismo string sin año viaja al `aria-label` (`:540`, `:555`), así que el usuario de lector de pantalla tampoco tiene el año en ningún canal.
**Fix:** agregar una variante con año en `dia-calendario.ts` y usarla en toda superficie histórica; reservar `badgeFechaCitacion` para el badge compacto de /agenda (su caso de origen).
```ts
// lib/dia-calendario.ts
export function fechaCivilCorta(f: string | Date | null | undefined): string | null {
  const dia = diaCalendarioCitacion(f);
  if (dia === null) return null;
  const [y, m, d] = dia.split("-");
  return `${d} ${MESES_ES_CORTO[Number(m) - 1]} ${y}`; // "20 jul 2021"
}
```
Y en `estado-actual-block.tsx` sustituir `badgeFechaCitacion(...)` por `fechaCivilCorta(...)` en las líneas 514, 535, 540, 555, 560 (texto visible **y** aria-label, pareados).

### CR-02: `fechaHechoCorta` lanza `RangeError` con `Date` inválido y hay call-sites sin validar → 500 en la ficha

**File:** `app/lib/format.ts:76-83`; call-sites `app/components/votacion-card.tsx:22,39` y `app/components/actualidad-module.tsx:208-209,324`
**Issue:** con `new Date(NaN)`, los `getUTC*()` devuelven `NaN` ⇒ `sinHora === false` ⇒ se ejecuta `fechaHechoRealFormatter.format(d)`, y `Intl.DateTimeFormat.prototype.format` **lanza** `RangeError: Invalid time value`. `fechaHechoCorta` es la única de las tres helpers nuevas sin guard (`fechaHechoCortaSegura` valida, `fechaPlausible` devuelve `false`). `votacion-card.tsx:22` construye `new Date(votacion.fecha)` y sólo comprueba truthiness del *raw*, no del `Date`: un `votacion.fecha` malformado revienta el Server Component completo de la ficha de proyecto. `actualidad-module` hace lo mismo sobre `it.fecha`/`it.desde`. `timeline-event.tsx:100` sí está protegido porque `fechaPlausible` filtra `NaN` antes — la protección es accidental de un call-site, no del helper.
**Fix:** guard en el helper (defensa en el chokepoint) y saneo en el call-site:
```ts
export function fechaHechoCorta(d: Date, fallback = "fecha no informada"): string {
  if (Number.isNaN(d.getTime())) return fallback;
  // ...resto igual
}
```
```tsx
// votacion-card.tsx
const fechaRaw = votacion.fecha ? new Date(votacion.fecha) : null;
const fecha = fechaRaw && !Number.isNaN(fechaRaw.getTime()) ? fechaRaw : null;
```

## Warnings

### WR-01: "Votada el fecha no informada" — rótulo pegado al honest-state

**File:** `app/components/votos-por-parlamentario.tsx:527-535`
**Issue:** el rótulo F-07 se antepone en el JSX, fuera del ternario, mientras `fechaHechoCortaSegura(e.fecha)` degrada a `"fecha no informada"`. Resultado renderizado: **"Votada el fecha no informada"**. Es literalmente la frase absurda que `lobby-de-parlamentario.tsx:152-157` y `search-result-card.tsx:38-42` documentan haber evitado componiendo el rótulo **dentro** de la rama con dato. Aquí el patrón no se aplicó.
**Fix:** componer el string completo en la rama con dato y dejar el fallback verbatim:
```tsx
const fechaTexto = e.fecha ? `Votada el ${fechaHechoCortaSegura(e.fecha)}` : null;
{fechaTexto && <span className="text-muted-foreground">{fechaTexto}</span>}
```
(o pasar `fallback=""` y omitir el `<span>` cuando esté vacío).

### WR-02: el evento con fecha implausible se reordena al TOPE del timeline

**File:** `app/components/timeline-view.tsx:149-153` (interacción con `:64-69`)
**Issue:** F-04 hizo que `fechaValida` devuelva `null` para el typo real de PROD (`2626-05-25`). Pero `construirItems` ordena con `fechaValida(a.fecha)?.getTime() ?? 0`: la fila corrupta pasa de estar al **final** (año 2626) a valer epoch 0 y aparecer **primera**, presentada como el evento más antiguo de la tramitación. El hecho sigue visible (correcto), pero en una posición cronológica fabricada — un tipo distinto del mismo defecto que F-04 quería cerrar. Además, al moverse de lugar puede partir o unir runs contiguos de urgencia (`:170-177`), alterando el colapso.
**Fix:** ordenar con las inválidas al final y estables:
```ts
const ordenados = [...eventos].sort((a, b) => {
  const da = fechaValida(a.fecha)?.getTime();
  const db = fechaValida(b.fecha)?.getTime();
  if (da === undefined && db === undefined) return 0;
  if (da === undefined) return 1;   // sin fecha plausible → al final
  if (db === undefined) return -1;
  return da - db;
});
```

### WR-03: el piso 1990 de `fechaPlausible` descarta tramitación legítima pre-1990 sin evidencia declarada

**File:** `app/lib/format.ts:123-130`
**Issue:** el JSDoc justifica el TECHO (+5 años, con evidencia de /agenda y urgencias) pero el PISO `1990-01-01` no trae ninguna verificación contra PROD (`min(tramitacion_evento.fecha)`). Hay boletines ingresados antes de 1990 que siguen en tramitación/archivo; cualquier evento anterior queda **silenciosamente omitido** del timeline, del stepper y del cálculo de "Último hito" (`estado-actual-block.tsx:100-105`), y encima se reordena al tope (WR-02). El JSDoc además prohíbe explícitamente convertir esto en filtro global — pero en la práctica ya opera como filtro de render sobre todas las superficies de tramitación.
**Fix:** verificar `select min(fecha) from tramitacion_evento` en PROD y, o bien bajar el piso al mínimo real observado, o documentar en el JSDoc la consulta y su resultado como evidencia (`0 filas < 1990-01-01, verificado YYYY-MM-DD`).

### WR-04: `fechaHechoCortaSegura` es más estricta que su hermana y puede degradar fechas válidas

**File:** `app/lib/format.ts:102`
**Issue:** la regex `^\d{4}-\d{2}-\d{2}(T.*)?$` exige el separador `T`. `fechaCortaSegura` (`:232`) hacía `slice(0,10)` y aceptaba cualquier sufijo, incluido el formato con **espacio** (`"2026-07-07 00:00:00+00"`) que Postgres/`to_char`/algunas RPC devuelven. Los call-sites migrados (`votos-por-parlamentario`) mostrarían "fecha no informada" sobre un dato que sí existe — degradación honesta pero pérdida de información, y difícil de diagnosticar porque no falla ruidosamente.
**Fix:** aceptar espacio como separador, conservando el parseo COMPLETO:
```ts
if (!/^\d{4}-\d{2}-\d{2}([T ].*)?$/.test(s)) return fallback;
const d = new Date(s.replace(" ", "T"));
```

### WR-05: `panel-actualidad` mezcla dos formatos de fecha en el mismo panel

**File:** `app/components/panel-actualidad.tsx:106-116`
**Issue:** tras F-14, la rama `agenda_*` rinde `badgeFechaCitacion` → `"10-ago"` (sin año) y la otra rama rinde `fechaCorta` → `"10 ago 2026"` (con año). Ambas señales se listan en el MISMO panel, una junto a otra: el ciudadano ve dos convenciones distintas y una de ellas sin año. El propio JSDoc reconoce que *todas* las señales llegan a medianoche UTC, o sea que el ruteo por tipo ya no distingue semántica sino sólo formato.
**Fix:** usar un único formato con año en ambas ramas (`fechaCivilCorta` de CR-01 para la rama agenda, `fechaCorta` para el resto).

### WR-06: el test `(1d)` del guard asserta menos de lo que su JSDoc afirma

**File:** `app/lib/anti-insinuacion-guard.test.ts` (bloque `(1d) FECHA-02`)
**Issue:** el JSDoc dice *"La cuenta está ANCLADA (`toHaveLength(10)`): si un plan de la fase añade un idiom de fecha sin registrarlo aquí, el test muerde"*. Es falso: el test recorre una lista **hardcodeada en el propio test**; agregar copy nuevo a un componente no toca esa lista y por tanto no muerde nada. De hecho la fase introdujo idioms que NO están en la lista de 10 y nunca pasaron por `detectarInsinuaciones`: `"Citado el …"`, `"Urgencia … vigente desde el …"`, `"En tabla de sala de la … del …"`, `"Consultado por nombre del candidato; la fuente cubre hasta el …"`, `"Año del primer trámite"`, `"desde {fecha}"`. La cobertura real es parcial y la prosa la vende como total.
**Fix:** o (a) corregir el JSDoc para que declare que es un fixture manual sin propiedad de detección, o (b) hacerlo real escaneando el copy renderizado de `SUPERFICIES_FECHA` — que es lo que ya hace el test (1) — y completar la lista con los 6 idioms faltantes.

## Info

### IN-01: `badgeFechaCitacion` se invoca 2-3 veces por render del mismo valor
**File:** `app/components/estado-actual-block.tsx:492-497`, `:533-540`
**Issue:** el guard y el render llaman al helper con el mismo argumento (y el aria-label una tercera vez). Duplicación evitable y riesgo de divergencia si alguien edita sólo una.
**Fix:** `const fechaCit = badgeFechaCitacion(citacionVigente.fecha);` y reusar.

### IN-02: aserciones no-nulas `!` sobre `diaCalendarioCitacion`
**File:** `app/components/estado-actual-block.tsx:202`, `:234`, `:250`, `:283`
**Issue:** cuatro `!` que hoy son seguros sólo porque `fechaValida` corrió antes. Si alguien reordena, el `!` esconde el `null` y produce comparaciones de string contra `"null"`.
**Fix:** early-return sobre el resultado del helper en vez de `!`.

### IN-03: copy nuevo aterrizado en un componente declarado HUÉRFANO
**File:** `app/components/actualidad-module.tsx:20-27, 431-471`
**Issue:** el componente se documenta como no montado por ninguna ruta, y aun así recibe copy nuevo y un párrafo explicativo. Ese texto no puede validarse en pantalla ni en UAT; es deuda que crece.
**Fix:** aceptable como decisión declarada, pero conviene registrar el borrado en la fase de limpieza de huérfanos con referencia explícita a este archivo.

### IN-04: la explicación bajo el strip contradice la lectura literal del idiom
**File:** `app/components/actualidad-module.tsx:467-470`
**Issue:** se rinde *"según fuente al {fecha}"* y a continuación *"Esta fecha indica cuándo consultamos cada fuente, no cuándo la fuente publicó o modificó el dato"*. Si el idiom necesitara desambiguación en prosa cada vez, el idiom no está diciendo lo que debería. Vale la pena decidirlo una vez para todo el sitio (el mismo idiom se usa sin aclaración en el `ProvenanceBadge`).
**Fix:** unificar: o el idiom se explica siempre (también en el badge), o nunca.

### IN-05: `fechaPlausible` — borde de 29 de febrero y mutación local
**File:** `app/lib/format.ts:127-128`
**Issue:** `techo.setUTCFullYear(y+5)` sobre un 29-feb produce el 1-mar (un día menos que "now + 5 años"). Irrelevante para el propósito (atajar typos de siglo), pero el JSDoc promete el rango exacto.
**Fix:** documentar el borde, o usar `Date.UTC(y+5, m, d)` con clamp explícito.

---

_Reviewed: 2026-07-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
