---
quick_id: 260806-qal
slug: ci-workflow-dispatch
date: 2026-08-06
model_profile: inline (tarea trivial, 1 bloque YAML)
---

# Quick — `workflow_dispatch` en `ci.yml`

## Problema medido (no supuesto)

`ci.yml` está `active`, su YAML es válido y el archivo existe en `origin/master`, pero **no genera
run desde el 2026-07-30** pese a **4 pushes a master** posteriores:

| push | sha | ¿run de `ci`? |
|---|---|---|
| 2026-08-03T10:01:25Z | `60b17450` | ❌ |
| 2026-08-06T20:33:45Z | `cd0e03cc` | ❌ |
| 2026-08-06T20:41:34Z | `1f471f29` | ❌ |
| 2026-08-06T22:49:25Z | `1e37e873` | ❌ |

Los eventos de push **sí** llegan (CodeQL corrió en los tres de hoy y el check-suite
`github-actions` del head cerró `success` — pero solo con CodeQL dentro).
Descartado en esta sesión: workflow deshabilitado (`state: active`), YAML inválido
(`yaml.safe_load` OK, 9 steps parseados), BOM/CRLF (`od -c`: `n a m e :   c i \n`, sin BOM),
política de Actions (`enabled: true`, `allowed_actions: all`), minutos agotados
(`probidad-weekly` corrió 3 h 18 m hoy), ruta/case del archivo (`git ls-tree` en origin).

**La causa queda del lado de GitHub, no del repo.** Lo que sí es un defecto propio: `ci.yml`
**no tiene `workflow_dispatch`**, así que no hay forma de forzarlo ni de confirmar el primer run
verde del step de `@obs/news` que añadió 133-a. Eso es lo que este quick arregla.

## Alcance

Añadir `workflow_dispatch:` al bloque `on:` de `.github/workflows/ci.yml`. **Nada más**: ni jobs,
ni steps, ni permisos, ni concurrency.

## Tarea única

- [ ] `.github/workflows/ci.yml` — añadir `workflow_dispatch:` bajo `on:`, tras `pull_request`.

## Criterio de aceptación

Se verifica con conteos, no con exit codes:

1. `python -c "import yaml; d=yaml.safe_load(open('.github/workflows/ci.yml',encoding='utf-8')); assert 'workflow_dispatch' in d[True]"` → el YAML sigue válido **y** el trigger existe.
2. Los 9 steps del job `test` siguen siendo los mismos 9 (comparación de lista, no de largo).
3. `git diff` toca **un solo archivo** y añade **una sola línea**.
4. Tras el push: `gh workflow run ci.yml` acepta el dispatch (antes devolvía error por falta del
   trigger) y el run resultante se observa hasta su conclusión — **el step de `@obs/news` debe
   aparecer y salir verde**. Sin ese run observado, la tarea NO se declara completa.

## Lo que este quick NO resuelve

El push-trigger seguirá roto si la causa es de GitHub; `workflow_dispatch` es una **vía de escape**,
no el arreglo. Queda registrado como pendiente abierto de 133-b.
