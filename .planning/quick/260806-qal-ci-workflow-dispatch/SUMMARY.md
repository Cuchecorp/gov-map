---
quick_id: 260806-qal
slug: ci-workflow-dispatch
date: 2026-08-06
status: complete
commit: 987d55f
---

# SUMMARY — `workflow_dispatch` en `ci.yml`

## Lo que NO se cumplió, primero

**El push-trigger de `ci.yml` sigue roto y este quick no lo arregla.** Tras el commit `987d55f` se
hizo el **quinto** push a master desde el 2026-07-30 y `ci` **volvió a no generar run**. La vía de
escape funciona; la causa raíz no está en el repo y sigue abierta.

También queda abierto: los tres pushes de hoy y el del 08-03 **nunca fueron verificados por el
gate** — el código de 133-a llegó a master sin pasar por CI, y solo ahora se sabe que habría pasado.

## Lo que sí se logró, con números

`gh workflow run ci.yml` → run **31129413140**, `workflow_dispatch`, **success en 2 m 16 s**, los
9 steps verdes. Conteos impresos (ANSI strippeado, no exit code):

| Step | Test Files | Tests |
|---|---|---|
| Test (guard PII + bento-guards + anti-insinuación) | 121 passed | **1803 passed** |
| TypeScript (`tsc --noEmit`) | — | — |
| Test `@obs/llm` | 17 passed | 158 passed \| 3 skipped (161) |
| Test `@obs/cruces` | 7 passed \| 1 skipped | 42 passed \| 3 skipped (45) |
| **Test `@obs/news`** | **19 passed (19)** | **268 passed (268)** |

**El 268 cuadra exacto con el 268 congelado al cerrar 133-a** (suite `@obs/news` 206 → 268). Es la
primera ejecución del step en Linux: confirma que los 5 caminos hardcodeados de los guards G1/G2
resisten el filesystem case-sensitive, que era el riesgo concreto que 133-a mitigó a ciegas.

⇒ **Pendiente #1 de 133-b (“nadie ha visto un run verde de CI”) queda CERRADO**, con la salvedad de
que el verde vino por dispatch, no por push.

## Verificación del cambio

1. YAML válido y trigger presente — `yaml.safe_load` OK, `on` = `{pull_request, push, workflow_dispatch}`.
2. Los 9 steps del job `test` intactos (aserción sobre la lista, `len == 9`).
3. Diff: **1 archivo, 1 inserción, 0 borrados** (`git diff --numstat`).
4. **Control negativo:** la misma aserción corrida contra `origin/master:.github/workflows/ci.yml`
   (versión previa) imprime `False`. La aserción distingue las dos versiones — no es vacua.
5. El dispatch fue **aceptado y corrió verde**; antes del cambio no existía el trigger.

## Descartes del diagnóstico (por si vuelve)

Todo esto se midió y **no** explica el push-trigger muerto:

- Workflow deshabilitado → `gh workflow list`: `ci active`.
- YAML inválido → `yaml.safe_load` parsea 9 steps.
- BOM/CRLF en el archivo → `od -c`: `n a m e :   c i \n`, sin BOM, LF.
- Política de Actions → `enabled: true`, `allowed_actions: all`.
- Minutos agotados → `probidad-weekly` corrió **3 h 18 m** el mismo día.
- Ruta/case del archivo → `git ls-tree -r origin/master -- .github` lo lista exacto.
- `[skip ci]` en los mensajes → ninguno lo lleva.
- Los eventos de push **sí** llegan: CodeQL corrió en los tres pushes de hoy; el check-suite
  `github-actions` del head cerró `success` conteniendo **solo** CodeQL.

Que el dispatch corra verde sobre el mismo sha prueba que **no es el workflow ni el repo**: es el
enrutamiento del evento `push` hacia este workflow, del lado de GitHub.

## Deuda que este quick deja escrita

- **Push-trigger de `ci.yml`**: abierto. Mientras dure, **cada push a master exige
  `gh workflow run ci.yml` a mano**, o el gate no corre. Es la única red de PII del proyecto
  (service_role bypassea RLS) — un gate que no dispara es un gate que no existe.
- Anotación del run: `actions/checkout`, `setup-node` y `pnpm/action-setup` **targetean Node.js 20,
  deprecado**, y se fuerzan a Node 24. No rompe hoy; romperá.
