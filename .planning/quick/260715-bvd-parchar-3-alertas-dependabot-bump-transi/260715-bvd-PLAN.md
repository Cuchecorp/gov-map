---
phase: quick-260715-bvd
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - pnpm-lock.yaml
autonomous: false
requirements: [DEPABOT-POSTCSS, DEPABOT-UUID, DEPABOT-ESBUILD]

must_haves:
  truths:
    - "pnpm-lock.yaml no contiene postcss@8.4.31 (ni ninguna <8.5.10)"
    - "pnpm-lock.yaml no contiene esbuild@0.27.7 (rango vulnerable >=0.27.3 <0.28.1)"
    - "pnpm-lock.yaml no contiene uuid@8.3.2 (queda >=11.1.1)"
    - "La suite completa del monorepo (~820 tests) sigue en verde"
  artifacts:
    - path: "package.json"
      provides: "bloque pnpm.overrides que fija las 3 transitivas a versiones parchadas"
      contains: "overrides"
    - path: "pnpm-lock.yaml"
      provides: "lockfile regenerado sin versiones vulnerables"
  key_links:
    - from: "package.json pnpm.overrides"
      to: "pnpm-lock.yaml"
      via: "pnpm install regenera el lock aplicando los overrides"
      pattern: "postcss|uuid|esbuild"
---

<objective>
Cerrar las 3 alertas Dependabot abiertas, todas dependencias TRANSITIVAS en el
`pnpm-lock.yaml` del workspace pnpm raíz:

1. **postcss** `<8.5.10` (medium) — XSS por `</style>` sin escapar en el stringify de CSS. Parcheado: 8.5.10. Vulnerable en el lock: `postcss@8.4.31` (vía la cadena browserslist/autoprefixer). Ya coexiste `postcss@8.5.15` parchado.
2. **uuid** `<11.1.1` (medium) — falta bounds-check del buffer en v3/v5/v6 cuando se pasa `buf`. Parcheado: 11.1.1. Vulnerable en el lock: `uuid@8.3.2`, consumido SOLO por `exceljs@4.4.0`. NOTA: exceljs usa `uuid.v4()` sin `buf` → el path explotable no se ejerce, pero Dependabot marca todo el rango `<11.1.1`.
3. **esbuild** `>=0.27.3 <0.28.1` (low) — lectura arbitraria de archivos vía dev server en Windows. Parcheado: 0.28.1. Vulnerable en el lock: `esbuild@0.27.7` (vía `vite@7.3.5`). OJO: también existe `esbuild@0.25.4` (vía otra herramienta dev) que NO está en el rango vulnerable.

Enfoque: como son transitivas, usar `pnpm.overrides` en el `package.json` raíz,
regenerar el lock con `pnpm install`, verificar que no quedan versiones
vulnerables, y correr la suite completa. Repo Windows + PowerShell, workspace pnpm 11.

Purpose: eliminar las 3 alertas de seguridad abiertas sin romper la build ni la suite.
Output: `package.json` con `pnpm.overrides`, `pnpm-lock.yaml` regenerado, commit atómico.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@package.json
@pnpm-workspace.yaml

<interfaces>
Versiones actuales en pnpm-lock.yaml (lockfileVersion 9.0), confirmadas por inspección:

- postcss@8.4.31   (VULNERABLE) — dependiente: cadena browserslist/caniuse-lite/baseline-browser-mapping
- postcss@8.5.15   (ya parchado, coexiste)
- esbuild@0.25.4   (NO vulnerable, fuera de rango) — dependiente: herramienta dev (chalk/cookie context)
- esbuild@0.27.7   (VULNERABLE) — dependiente: vite@7.3.5
- esbuild@0.28.1   (ya presente/parchado, coexiste)
- uuid@8.3.2       (VULNERABLE por rango) — dependiente ÚNICO: exceljs@4.4.0 (usa uuid.v4() sin buf)

Overrides propuestos (rango que garantiza parche y consolida versiones):
  "postcss": "^8.5.10"
  "esbuild": "^0.28.1"
  "uuid": "^11.1.1"

RIESGO PRINCIPAL — uuid 8→11 es un salto MAYOR (v11 es ESM-first, cambió exports
CommonJS). exceljs@4.4.0 hace `require('uuid')` internamente. El override fuerza a
exceljs a resolver uuid@11.1.1. Los packages @obs/dinero y @obs/servel dependen de
exceljs para leer/escribir .xlsx → la suite completa DEBE ejercer ese path. Si algún
test de exceljs/xlsx se rompe, el override de uuid no es seguro tal cual y hay que
acotarlo (ver Task 2, rama de contingencia).

RIESGO SECUNDARIO — el override `esbuild: ^0.28.1` también bumpea esbuild@0.25.4→0.28.1.
esbuild es muy retrocompatible dentro de 0.2x; consolidar a una sola versión es deseable.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Añadir pnpm.overrides y regenerar el lockfile</name>
  <files>package.json, pnpm-lock.yaml</files>
  <action>
Editar el `package.json` raíz para añadir un bloque `pnpm.overrides` que fije las
tres transitivas vulnerables a versiones parchadas. El repo hoy NO tiene bloque
`pnpm` en package.json — crearlo. Resultado esperado (añadir como top-level key,
después de `engines`):

  "pnpm": {
    "overrides": {
      "postcss": "^8.5.10",
      "esbuild": "^0.28.1",
      "uuid": "^11.1.1"
    }
  }

Preservar el resto del package.json intacto (scripts, devDependencies, engines,
packageManager). No tocar pnpm-workspace.yaml.

Regenerar el lockfile aplicando los overrides. En PowerShell desde la raíz del repo:

  pnpm install --lockfile-only

Usar `--lockfile-only` para actualizar SOLO el pnpm-lock.yaml sin ejecutar
build-scripts ni escribir node_modules en esta pasada (evita el gate de builds y es
más rápido). Si `--lockfile-only` deja node_modules inconsistente para la suite,
Task 3 corre un `pnpm install` normal antes de testear. NO usar `pnpm up`/`pnpm dedupe`
como mecanismo primario: los overrides son el mecanismo determinista para transitivas.
  </action>
  <verify>
    <automated>pnpm why postcss; pnpm why esbuild; pnpm why uuid</automated>
  </verify>
  <done>package.json tiene pnpm.overrides con las 3 entradas; pnpm install --lockfile-only completa sin error; pnpm-lock.yaml modificado.</done>
</task>

<task type="auto">
  <name>Task 2: Verificar que no quedan versiones vulnerables en el lock</name>
  <files>pnpm-lock.yaml</files>
  <action>
Confirmar por inspección directa del lockfile regenerado que NINGUNA versión
vulnerable persiste. En PowerShell desde la raíz:

  Select-String -Path pnpm-lock.yaml -Pattern 'postcss@8\.4\.31|postcss@8\.[0-4]\.|esbuild@0\.27\.7|esbuild@0\.2[0-7]\.|uuid@([0-9]|10)\.'

El comando anterior debe devolver CERO líneas de coincidencias que representen una
versión vulnerable/pre-parche. Interpretación de resultados aceptables:
- postcss: SOLO >=8.5.10 (esperado 8.5.15+). CERO ocurrencias de 8.4.31.
- esbuild: SOLO >=0.28.1. CERO ocurrencias de 0.27.7 Y de 0.25.4 (el override las
  consolida a 0.28.1). Si aún aparece 0.25.4 sin resolver, es aceptable (no vulnerable)
  pero lo ideal es que el override la haya bumpeado.
- uuid: SOLO >=11.1.1. CERO ocurrencias de uuid@8.3.2 (ni cualquier <11.1.1).

Verificación por `pnpm why` (más legible que grep para confirmar el árbol):

  pnpm why -r postcss
  pnpm why -r uuid
  pnpm why -r esbuild

RAMA DE CONTINGENCIA (uuid): si el override a uuid@^11.1.1 provoca un fallo de
resolución (peer/engine) o Task 3 revela ruptura de exceljs, acotar el override
usando la sintaxis de override con selector de dependiente para dejar exceljs en su
uuid original y forzar solo el resto, o subir uuid a la última 8.x parchada si
existiera. Documentar la decisión en el commit. NO dejar uuid@8.3.2 en verde silencioso.
  </action>
  <verify>
    <automated>if (Select-String -Path pnpm-lock.yaml -Pattern 'postcss@8\.4\.31|esbuild@0\.27\.7|uuid@8\.3\.2' -Quiet) { throw 'VULNERABLE VERSION STILL PRESENT' } else { 'clean' }</automated>
  </verify>
  <done>Select-String no encuentra postcss@8.4.31, esbuild@0.27.7 ni uuid@8.3.2 en pnpm-lock.yaml; pnpm why confirma versiones parchadas.</done>
</task>

<task type="auto">
  <name>Task 3: Instalación completa + suite verde del monorepo</name>
  <files>pnpm-lock.yaml</files>
  <action>
Materializar el árbol completo y correr la suite entera para probar que el bump de
transitivas (en particular uuid 8→11 bajo exceljs) NO rompe nada en runtime.

En PowerShell desde la raíz:

  pnpm install
  pnpm test

`pnpm test` ejecuta el script raíz: `pnpm -r --filter "./packages/*" test && pnpm --filter ./app test` — cubre ~820 tests incluyendo packages/dinero y packages/servel (que ejercen exceljs → uuid). Debe quedar TODO EN VERDE.

Si la suite falla por algo tocado por los overrides (típicamente exceljs/xlsx si el
salto de uuid rompió `require('uuid')`), volver a Task 2 rama de contingencia y acotar
el override de uuid. Re-correr `pnpm install` + `pnpm test` hasta verde.

Opcional adicional (no bloqueante): `pnpm typecheck` (tsc -b) para confirmar que el
bump de esbuild/vite no alteró tipos consumidos.
  </action>
  <verify>
    <automated>pnpm test</automated>
  </verify>
  <done>pnpm install completa sin error; pnpm test pasa la suite completa (~820 tests) en verde.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
Se añadió `pnpm.overrides` (postcss ^8.5.10, esbuild ^0.28.1, uuid ^11.1.1) al
package.json raíz, se regeneró pnpm-lock.yaml, se verificó por inspección que no
quedan las 3 versiones vulnerables, y la suite completa (~820 tests) quedó verde.
  </what-built>
  <how-to-verify>
1. Revisar el diff de package.json: bloque pnpm.overrides con las 3 entradas, resto intacto.
2. Confirmar la salida de `pnpm test` en verde (o el log de la última corrida).
3. Confirmar que Select-String sobre pnpm-lock.yaml de postcss@8.4.31 / esbuild@0.27.7 / uuid@8.3.2 devuelve vacío.
4. Decidir si además de mergear localmente quieres que las alertas Dependabot se cierren solas (se cierran al pushear el lock parchado a la rama que Dependabot observa).
  </how-to-verify>
  <resume-signal>Escribe "aprobado" para commitear, o describe qué ajustar (p.ej. acotar el override de uuid).</resume-signal>
</task>

<task type="auto">
  <name>Task 4: Commit atómico</name>
  <files>package.json, pnpm-lock.yaml</files>
  <action>
Solo tras aprobación del checkpoint. Commit atómico con SOLO los 2 archivos tocados.
No pushear salvo que el operador lo pida (ver reglas de commit/push del proyecto).

  git add package.json pnpm-lock.yaml
  git commit -m "fix(deps): parchar 3 alertas Dependabot vía pnpm.overrides (postcss/uuid/esbuild)"

Cuerpo del mensaje: enumerar las 3 (postcss 8.4.31->^8.5.10 XSS medium; uuid
8.3.2->^11.1.1 bounds-check medium, exceljs usa v4 sin buf; esbuild 0.27.7->^0.28.1
dev-server file-read low) y anotar cualquier acotamiento de override si se aplicó la
rama de contingencia.
  </action>
  <verify>
    <automated>git show --stat HEAD | Select-String 'package.json|pnpm-lock.yaml'</automated>
  </verify>
  <done>Commit HEAD contiene exactamente package.json y pnpm-lock.yaml con el mensaje fix(deps).</done>
</task>

</tasks>

<verification>
- `pnpm-lock.yaml` sin postcss@8.4.31, esbuild@0.27.7, uuid@8.3.2 (Select-String vacío).
- `pnpm why` confirma postcss>=8.5.10, esbuild>=0.28.1, uuid>=11.1.1.
- `pnpm test` verde (~820 tests), incluidos packages/dinero + packages/servel (exceljs→uuid).
- package.json con bloque pnpm.overrides; resto intacto.
- Commit atómico de 2 archivos.
</verification>

<success_criteria>
Las 3 alertas Dependabot quedan resueltas: el lockfile ya no referencia ninguna
versión en los rangos vulnerables, y la suite completa del monorepo sigue en verde
tras el bump de transitivas. Un push del lock parchado cerrará las alertas en GitHub.
</success_criteria>

<output>
Crear `.planning/quick/260715-bvd-parchar-3-alertas-dependabot-bump-transi/260715-bvd-SUMMARY.md` al terminar.
</output>
