---
phase: 133-news-taxo
plan: b-03
subsystem: news-eval
tags: [golden-set, cobertura, truncado, gate]
dependency-graph:
  requires: [133-b-01, 133-b-02]
  provides: [cobertura.ts, verificarCobertura, cobertura-cli.ts]
  affects: [133-b-04]
tech-stack:
  added: []
  patterns: ["truncador inyectable para control negativo", "gate fail-closed pre-registrado"]
key-files:
  created:
    - packages/news/src/eval/cobertura.ts
    - packages/news/src/eval/cobertura.test.ts
    - packages/news/src/eval/cobertura-cli.ts
  modified: []
decisions: []
metrics:
  duration: "~35 min"
  completed: "2026-08-07"
---

# Phase 133 Plan b-03: cobertura.ts + cobertura-cli.ts — confirmación de cobertura del 95%, no remediación

Confirmación automatizada y reproducible de que `prefiltro.terminos` está 100 % cubierto
dentro de `entrada_llm` sobre el censo P (74 casos), con el 100 % atornillado a un control de
mutación: el gradiente 65/40/30/0 (200/80/0 chars/entrada vacía) demuestra que la métrica
puede caer, y el gate del 95 % es fail-closed.

## Inversión de olas 02→03 (declaración obligatoria, no insinuada)

D-133b-3 fija la secuencia **cobertura (paso 1) → congelar la muestra (paso 2) → etiquetar
(paso 3)**. Este plan corrió en la **wave 3**, es decir **después** del congelado de la
muestra (133-b-02, wave 2) — **es una inversión respecto al texto de D-133b-3**, y es inocua
**solo porque P-02 ya midió 100,00 %**: al no haber remediación, el límite de truncado no
cambió y la composición congelada en 133-b-02 sigue siendo válida. **Si este plan hubiera
salido < 95 %, la muestra congelada habría quedado inválida** y habría que re-congelarla antes
de etiquetar. Lo que la secuencia protege de verdad —que nadie etiquete antes de que la
cobertura pase— se mantiene intacto: el primer plan que etiqueta es el 133-b-05, y el 133-b-04
declara `gate=PASA` de este plan como precondición dura.

## Qué NO se cumplió

Nada. Los 10 tests, los 6 mutaciones y todas las cifras del CLI salieron exactas en la primera
corrida — coincidiendo con `133-b-PREMORTEM.md` §P-02 sin necesidad de ajustar ningún literal.

## Números medidos

**`SHA_BASE`**: `8fb51ef1edf8d5b12d86e95f49951711ed8ecee5`

**Conteos de tests:**

| Momento | Tests | Delta |
|---|---|---|
| `N_ANTES` | 293 | — |
| `N_T1` (medición + gradiente) | 303* | — |
| `N_T2` (gate + CLI) | 303 | +10 total |

*Task 1 y Task 2 se implementaron en una sola pasada de `cobertura.ts` (medición y gate en el
mismo archivo, como especifica `files_modified`); el delta total exigido y verificado es
**+10** sobre 293 (`303 - 293 = 10`), exactamente los 7+3 `it` declarados.

**Línea `cobertura: ...` de la corrida real** (`pnpm --filter @obs/news exec tsx src/eval/cobertura-cli.ts`):

```
cobertura: total=74 cubiertos=74 sinTerminos=0 pct=1.0000 t200=65 t80=40 t0=30 tvacio=0
umbral=0.95 gate=PASA
```

**Los cuatro enteros del gradiente, literales, no porcentajes:** `t200=65`, `t80=40`, `t0=30`,
`tvacio=0` — exactos a `133-b-PREMORTEM.md` §P-02 (87,84 %/54,05 %/40,54 %/0,00 % sobre 74).

**`t200=65 ≤ 70` (95 % × 74 = 70,3):** a 200 chars la cobertura **cruza el umbral hacia
abajo** (87,84 % < 95 %). El margen del 100 % actual no es cómodo por casualidad — lo sostiene
el límite de truncado vigente. **Nadie puede "optimizar" el truncado en las fases 134/135 sin
invalidar el golden.**

**Identidad del censo confirmada:** los 74 `caso_id` con `estado='pasa'` de `pool-133b.json` y
los 74 `caso_id` del estrato `P` de `muestra-133b.json` son el **mismo conjunto exacto**
(diferencia simétrica vacía, comprobada por el CLI antes de medir — sin diferencia no hubo
necesidad de lanzar la escalada correspondiente).

**Anti-poda del vocabulario, verificado (no duplicado):**
- `packages/news/src/prefiltro-lexico.test.ts:20-21` — `VOCABULARIO_LEGISLATIVO` congelado
  (`Object.isFrozen`).
- `packages/news/src/prefiltro-lexico.test.ts:24-25` — `VOCABULARIO_LEGISLATIVO.length` es
  literal `30` (regresión).
- `packages/news/src/prefiltro-lexico.test.ts:205-206` — `length >= 30` (anti-poda).

## Mutaciones (las 6, todas rojas nombrando su `it`, todas revertidas)

| Task | Mutación | Resultado |
|---|---|---|
| T1 | A — truncador inyectado ignorado (siempre usa el real) | rc≠0, nombra **los cuatro** `(b)`, `(c)`, `(d)`, `(e)` |
| T1 | B — cero vacuo (quitar el `throw` de lista vacía) | rc≠0, nombra `(f)` |
| T1 | C — gradiente invertido (t80 devuelve texto completo) | rc≠0, nombra `(g)` |
| T2 | A — gate degradado a `console.warn` | rc≠0, nombra `(a)` |
| T2 | B — frontera del umbral (`<=` en vez de `<`) | rc≠0, nombra `(b)` |
| T2 | C — gate ignora `opts.truncador` | rc≠0, nombra `(c)` |

**Nota sobre la mutación B (T2) y el `it` (b):** la primera versión del test (b) usaba una
población sintética donde el término vivía en el **título** (nunca truncado), así que la
cobertura resultante era siempre 100 %, no 95 % exacto — la mutación de frontera no la ponía
roja porque el test nunca tocaba realmente el umbral. Se corrigió el fixture para que el
término viva **solo en la descripción** y se pierda tras un truncador `slice(0,10)` inyectado
en exactamente 5 de 100 casos sintéticos, logrando `cobertura === 0.95` exacto — verificado
antes de confiar en la mutación (dos intentos, resuelto en el segundo, como exige la escalada
del propio plan).

## Deviations from Plan

**1. [Rule 1 — bug de test, corregido durante la ejecución] El fixture sintético del `it` (b)
no ejercitaba la frontera del 95 %.**

- **Encontrado durante:** verificación de la mutación B (T2, frontera del umbral).
- **Síntoma:** con el fixture original (término solo en el título, que nunca se trunca), la
  mutación `< → <=` no ponía nada rojo: la cobertura siempre daba 1.0, nunca 0.95.
- **Fix:** rediseño del fixture (95 casos con el término al inicio de la descripción,
  sobreviviendo un truncador `slice(0,10)`; 5 casos con el término tras un relleno que el
  mismo truncador corta) para lograr `cobertura === 0.95` exacto, verificado con
  `expect(r.cobertura).toBe(0.95)` antes de confiar en la mutación.
- **Archivos:** `packages/news/src/eval/cobertura.test.ts`.
- **Commit:** incluido en `07d3039` (corregido antes de cualquier commit; no hubo versión
  incorrecta committeada).

## Lo que sí se cumplió

- Cobertura del censo P confirmada en **74/74 = 100,00 %**, reproducible, sin red.
- El 100 % muerde: gradiente 65/40/30/0 congelado como literal, con mutación que pone rojos
  los cuatro `it`.
- Truncador aplicado en el mismo punto del pipeline que producción (paridad byte a byte
  probada contra `construirEntradaLlm`).
- Gate del 95 % fail-closed, con control positivo apareado en la frontera exacta (0,95).
- `prefiltro-lexico.ts` **intacto**: `git diff --name-only` no lo lista. El límite de truncado
  no sube — este plan es confirmación, **no remediación**: nada hay que re-etiquetar.
- `pnpm --filter @obs/news exec tsc --noEmit` sin errores.
- Cero `pnpm add`.

## Known Stubs

Ninguno.

## Threat Flags

Ninguno — superficie coincide con `<threat_model>` de `133-b-03-PLAN.md` (T-133-45 a T-133-51,
T-133-63, T-133-64, T-133-SC), todas mitigadas.

## Self-Check: PASSED

- `packages/news/src/eval/cobertura.ts` — FOUND
- `packages/news/src/eval/cobertura.test.ts` — FOUND
- `packages/news/src/eval/cobertura-cli.ts` — FOUND
- commit `07d3039` — FOUND en `git log --oneline`
- commit `2465352` — FOUND en `git log --oneline`
