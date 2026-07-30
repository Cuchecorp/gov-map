---
phase: 122-cruce-sql-cruces-visibles-sql-de-prod
reviewed: 2026-07-29T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - app/app/parlamentario/[id]/page.tsx
  - app/components/capa1/lobby-capa1.tsx
  - app/components/capa1/lobby-capa1.test.tsx
  - app/components/lobby-menciones-de-boletin.tsx
  - app/components/lobby-menciones-de-boletin.test.tsx
  - app/lib/anti-insinuacion-guard.test.ts
findings:
  critical: 1
  warning: 3
  info: 4
  total: 8
status: issues_found
---

# Phase 122: Code Review Report

**Reviewed:** 2026-07-29
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Los dos fixes hacen lo que la bitácora declara, y lo verifiqué contra el código, no contra la prosa:

- **5.11 (cero honesto preservado): SÍ.** `lobby-capa1.tsx:51` gatea la línea de conteo con `estado.tipo === "dato"` — la condición es sobre el DISCRIMINANTE, no sobre `n`, así que `{tipo:"dato", n:0}` entra a la rama e imprime `0 reuniones` (`:53-54` + test `:89-94`). Ningún cero real se esconde. El call-site (`page.tsx:622-625`) pasa `estado={conteos.lobby}` sin colapsar; el rename `total`→`estado` hace que un call-site olvidado sea error de compilación, no un fallo silencioso.
- **5.12 (tres caminos): SÍ, los tres.** `LobbyMencionesView` sólo tiene DOS returns (`:234` empty, `:266` con filas) y el nodo `cobertura` está en ambos (`:238`, `:270`); el caso "truncado" es una rama interna de `conteo` (`:252`) posterior a `cobertura` en el mismo return, así que no puede quedar fuera. El orden leyenda→cobertura→conteo está anclado por `indexOf` (test `:194-199`).
- **Acotamiento del assert a `<li>`: NO debilita la regla que protegía.** La regla era "la FILA no lleva fecha de badge"; `container.querySelector("li")` (test `:162`) devuelve la primera `FilaMencion`, y `FilaMencion` (`:148-201`) es el único emisor de `<li>` en esta vista, así que el alcance nuevo es exactamente el objeto de la regla. Además el assert añadido (`:166`, `captura` pelada sobre todo el contenedor) es ESTRICTAMENTE más fuerte que lo que el `not.toContain("según fuente al")` cubría "de más": prohíbe el término, no un idiom aprobado.
- **PII:** la vista no renderiza `contraparte_id` (ni existe en `LobbyMencionRow`), ni RUT, ni email. Limpio.
- **Wave-0 del guard:** el spread `...TERMINOS_COBERTURA` (`:733`) sí entra a `TERMINOS_PROHIBIDOS`, y el mutation self-check exige los 6 términos → no es un no-op.

Lo que NO está limpio: el fix 5.11 quitó el dígito fabricado y dejó en pie, en la MISMA sección y para el MISMO estado `no_ingerido`, una afirmación de ausencia atribuida a la fuente (CR-01). Eso es la misma clase de defecto que la fila 5.11 existía para cerrar.

## Critical Issues

### CR-01: `no_ingerido` sigue afirmando una ausencia EN LA FUENTE ("en las fuentes consultadas")

**File:** `app/components/capa1/lobby-capa1.tsx:83-88`
**Issue:** El fallback `top.length === 0` renderiza **incondicionalmente**, sin mirar `estado.tipo`:

> «Aún no hay materias publicadas en las fuentes consultadas.»

Con `estado.tipo === "no_ingerido"` (el caso exacto de `/parlamentario/S1338`: 0 audiencias **y** 0 filas en `lobby_ingesta_estado`) ese texto es ahora **el único contenido de la capa-1**, y afirma un hecho sobre la FUENTE que nunca se observó: no consultamos la fuente. Es la definición literal del riesgo #1 del proyecto ("ausencia falsa con atribución de fuente") y viola la misma regla LOCKED que la fila 5.11 invoca (`lobby-de-parlamentario.tsx:47`: *"'no ingestado' ≠ 'ingestado, cero'"*).

El fix de 5.11 eliminó el dígito fabricado (`0 reuniones`) y dejó intacta la afirmación fabricada en prosa. Después del deploy 125, `S1338` leerá: encabezado `—` (honesto) + «Aún no hay materias publicadas en las fuentes consultadas» (falso). La contradicción no se cerró, cambió de forma.

Agravante de test: `lobby-capa1.test.tsx:66-72` sólo asserta `not.toMatch(/\d/)` y `not.toMatch(/reuni[óo]n/i)` — pasa verde CON la frase falsa presente, es decir que el test HORNEA el defecto como comportamiento esperado.

**Fix:** gatear el fallback por estado, igual que el conteo, y emitir copy distinto por 3-estado (o nada, dejando que `conteoLabel` sea el único emisor):

```tsx
) : estado.tipo === "dato" ? (
  // Ingestado y con reuniones, pero la fuente no publicó materias.
  <p className="text-xs text-muted-foreground">
    Aún no hay materias publicadas en las fuentes consultadas.
  </p>
) : estado.tipo === "vacio" ? (
  // Ingestado, cero registros: la ausencia SÍ se observó.
  <p className="text-xs text-muted-foreground">
    No hay reuniones registradas en las fuentes consultadas.
  </p>
) : null /* no_ingerido / pendiente: no consultamos → no afirmamos nada */}
```

y añadir el test que hoy falta:

```tsx
it("`no_ingerido`: NO afirma ausencia en la fuente", () => {
  const { container } = render(
    <LobbyCapa1 topMaterias={[]} estado={{ tipo: "no_ingerido" }} />,
  );
  expect(container.textContent ?? "").not.toMatch(/fuentes consultadas/i);
});
```

## Warnings

### WR-01: el guard `(1e)` re-tipea el literal en vez de importar la constante REAL — regresión del propio WR-02 del archivo

**File:** `app/lib/anti-insinuacion-guard.test.ts:1061-1064`
**Issue:** El test declara una COPIA por concatenación de `COBERTURA_MENCIONES_LOBBY` en vez de importarla de `@/components/lobby-menciones-de-boletin`. Hoy los strings coinciden byte a byte (lo verifiqué), pero eso es coincidencia con fecha de vencimiento: la bitácora ordena "re-verificar `Q-L07` cada milestone y actualizar cifra Y fecha juntas" — el operador editará la constante real y esta copia quedará verde asertando sobre un texto que ya nadie renderiza.

Este archivo **ya documenta esta lección** en `:514-524` (`LEYENDA_RECURSO_NO_HUMANO_FIXTURE`, WR-02: *"antes era una COPIA literal, de modo que el test verificaba la copia y no el copy renderido… la copia era el drift silencioso que el propio test decía prevenir"*). La justificación del comentario (`:1051-1057`: "Wave-0, ANTES de que el copy exista") era válida en el commit `45cdac4`; en `HEAD` el copy ya existe y exporta la constante, así que la copia es deuda pura.

**Fix:**
```ts
import { COBERTURA_MENCIONES_LOBBY } from "@/components/lobby-menciones-de-boletin";
// …
const IDIOMS_COBERTURA_122 = [COBERTURA_MENCIONES_LOBBY, "195 de 5.106 audiencias (3,8 %), según fuente al 29 jul 2026"];
```
(el import ya se hace en `:52-55` para `LEYENDA_MENCIONES_LOBBY`/`EMPTY_MENCIONES_LOBBY` — añadir el tercer nombre).

### WR-02: el denominador del copy horneado es MÁS ANCHO que el que se midió

**File:** `app/components/lobby-menciones-de-boletin.tsx:120`
**Issue:** El literal dice «195 de las 5.106 **audiencias registradas con parlamentario identificado**». El comentario de procedencia justo arriba (`:105-106`) y la bitácora `122-CRUCES-SQL-04-FIXES.md` §1 definen el denominador como «5.106 **confirmadas con parlamentario y materia**». El copy omite la restricción "y materia": presenta el 3,8 % contra un universo (todas las audiencias con parlamentario identificado) que **no es** el que se contó. Si existieran audiencias confirmadas sin materia, el porcentaje publicado sería falso por construcción — y el proyecto no puede publicar un ratio cuyo denominador no coincide con la query citada. Régimen del proyecto: trazabilidad exacta a la fuente.

**Fix:** cerrar la brecha en el copy (o en el comentario, si el denominador realmente no filtra por materia — pero entonces hay que corregir §1 de la bitácora, no el copy):
```ts
export const COBERTURA_MENCIONES_LOBBY = "195 de las 5.106 audiencias registradas con parlamentario identificado y materia publicada citan el número de un boletín en su materia (3,8 %), según fuente al 29 jul 2026. Este recuento cubre solo esa parte del registro.";
```

### WR-03: la cifra horneada no tiene guard que la ligue a `Q-L07` — envejece en silencio

**File:** `app/components/lobby-menciones-de-boletin.tsx:97-120`
**Issue:** La única defensa contra que "195 / 5.106 / 29 jul 2026" quede obsoleto es un comentario que pide re-verificar cada milestone. El test `:216-224` asserta que el literal contiene esos números — es decir, **congela** la cifra vieja: cuando el operador la actualice, el test fallará por la razón equivocada (números duros en el assert) y la tentación será editar el test para que calce, no re-correr `Q-L07`. El resultado neto es un número con atribución de fuente y fecha que puede afirmar algo que la fuente ya no dice.

**Fix:** desacoplar el test de los dígitos concretos y asertar la FORMA (que es la regla real), dejando los números como responsabilidad de `Q-L07`:
```ts
// Forma LOCKED: "<n> de las <N> … (<pct> %), según fuente al <fecha>."
expect(COBERTURA_MENCIONES_LOBBY).toMatch(
  /^[\d.]+ de las [\d.]+ .+\([\d,]+ %\), según fuente al \d{1,2} \w{3} \d{4}\./,
);
```
y añadir la fecha de observación como constante nombrada (`COBERTURA_OBSERVADA_EL = "2026-07-29"`) para que un guard de milestone pueda comparar antigüedad.

## Info

### IN-01: `{tipo:"dato", n:0}` es inalcanzable desde el productor — el "cero honesto" que el test protege no existe en runtime

**File:** `app/lib/parlamentario-resumen-conteos.ts:235-237`
**Issue:** `derivarEstado` sólo emite `dato` con `total > 0`; `total === 0` cae en `vacio`/`no_ingerido`. Es decir, la rama que `lobby-capa1.test.tsx:89-94` celebra ("cero honesto") es defensiva y hoy inalcanzable, y el cero honesto REAL lo emite `conteoLabel` como `"sin registros"` (`page.tsx:93-94`), no como un dígito. No es un bug — pero la bitácora (§1.1 "Cero honesto preservado: un carril con `tipo:"dato", n:0` **sigue** imprimiendo `0 reuniones`") describe una garantía sobre un estado que ninguna ruta produce. Vale dejarlo escrito para que 125 no verifique un caso que no puede observar.

### IN-02: con `estado` no-`dato` y `topMaterias` no vacío, las barras SÍ emiten dígitos

**File:** `app/components/capa1/lobby-capa1.tsx:77-79`
**Issue:** El gate de omisión honesta (`:51`) cubre la línea de total, pero las barras por materia imprimen `{m.n}` sin mirar `estado`. Hoy es inalcanzable (si hay materias hay filas, y con filas el estado es `dato`), y los tests de 5.11 pasan `topMaterias={[]}` así que el invariante `not.toMatch(/\d/)` nunca se ejercita con materias presentes. Si un futuro productor derivara `lobbyTopMaterias` de otra fuente, la fila 5.11 se reabriría por esta puerta. Barato de blindar: envolver el bloque completo en `estado.tipo === "dato" && …` o añadir un test que pase materias con estado `no_ingerido` y documente la expectativa.

### IN-03: `TERMINOS_COBERTURA` mete dos frases genéricas del español a la denylist GLOBAL

**File:** `app/lib/anti-insinuacion-guard.test.ts:582-589`
**Issue:** `"en realidad son"` y `"muy por debajo"` se escanean sobre las ~50 superficies de TODOS los carriles, no sólo sobre lobby. Son construcciones perfectamente factuales en copy futuro ajeno ("los montos declarados están muy por debajo del umbral legal" es un HECHO citable). El propio archivo rechazó el token `top` por exactamente este motivo (`:691-696`). No hay hit hoy (verificado por el test `(1)`), así que no bloquea; el coste aparecerá como fricción en una fase no relacionada. Considerar acotar a la frase insinuante completa (p.ej. `"en realidad son muchas más"`) o replicar el patrón `(1b)` de verificación por carril para `TERMINOS_COBERTURA` (hoy `(1b)` sólo cubre `TERMINOS_LINK_EXT`).

### IN-04: el call-site corregido (`page.tsx:622`) no tiene test propio

**File:** `app/app/parlamentario/[id]/page.tsx:622-625`
**Issue:** Los 5 tests de 5.11 son de componente; ninguno prueba que la PÁGINA pasa el estado sin colapsar — que era el sitio del bug. La protección real es el rename de prop `total`→`estado` (un colapso a `number` ahora no compila), lo cual es defensa suficiente y probablemente la correcta; se registra sólo para que la verificación de 125 sepa que ese eslabón lo cubre `tsc`, no la suite.

---

_Reviewed: 2026-07-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
