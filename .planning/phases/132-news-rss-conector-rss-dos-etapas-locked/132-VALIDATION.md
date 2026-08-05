---
phase: 132
slug: news-rss-conector-rss-dos-etapas-locked
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-05
revised: 2026-08-05
revision_round: 3
---

# Phase 132 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (workspace pnpm existente) |
| **Config file** | `packages/news/vitest.config.ts` (propio, analog literal de `packages/tramitacion`) |
| **Quick run command** | `pnpm --filter @obs/news test` (package nuevo) |
| **Full suite command** | `pnpm test` + `pnpm guards` |
| **Estimated runtime** | ~120 s suite completa |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @obs/news test`
- **After every plan wave:** Run `pnpm test` + `pnpm guards`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

> El planner completa esta tabla con los task IDs reales. Regla del milestone:
> para cada test nuevo, MUTAR el código y comprobar que el test cae (anti-vacuo).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD (planner) | — | — | NEWS-01/NEWS-02 | — | — | unit/integration | — | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/news/` scaffold con vitest wired al workspace. El paquete **SÍ lleva su propio
      `packages/news/vitest.config.ts`** (los 18 paquetes del workspace lo tienen; es el analog
      literal de `packages/tramitacion`). El gotcha de la Phase 43 **no** es "tener config propio":
      es que el paquete no sea recorrido por el `pnpm -r --filter "./packages/*" test` de la raíz,
      lo que lo vuelve CI-DARK. Eso se prueba con la falla inducida de abajo, no con el config.
- [ ] Verificar que `pnpm test` desde root RECORRE el package nuevo (correr con un test
      trivial que falla a propósito y ver que la suite raíz cae con exit ≠ 0, luego borrarlo y
      ver que vuelve a 0; registrar ambos exit codes)

---

## Manual-Only Verifications

> Revisión de premortem (2026-08-05): la corrida LIVE dejó de ser un checkpoint humano bloqueante.
> La ejecuta el agente (una sola pasada, serial, rate-limited, robots antes de cada fetch) y el
> resultado va al operador como **artefacto de handoff** `132-REPORTE-OPERADOR.md`, nunca como gate
> dentro de la fase (precedente Phase 129 `AUSENTE-HANDOFF`).

| Behavior | Requirement | Ejecuta | Test Instructions |
|----------|-------------|---------|-------------------|
| Corrida real contra los N feeds vivos (una sola vez, rate-limited) | NEWS-01/NEWS-02 | Agente (132-07 Task 2, `auto`) | CLI local; **sin `--dry-run` previo** (envenena la caché diaria); volcar a `/tmp/132-run1.log` y `/tmp/132-run2.log`; registrar conteos y la re-corrida `[skip]` |
| Verificación WAF: `Fetcher` Node vs curl (riesgo A4 del research) | NEWS-01 | Agente (132-01 Task 3, `auto`) | Si un host bloquea Node fetch: retirarlo de `FEEDS`, documentar, seguir con N-1; piso duro 3 feeds, bajo eso PARAR |
| Decisión de alcance D-132-A (Google News descartado) | NEWS-02 | Operador, **asíncrono** | Lee `132-REPORTE-OPERADOR.md` cuando esté; la fase no espera su respuesta |

---

## N = feeds vivos (parámetro de la fase, NO la constante 5)

> Corregido en la revisión de plan-checker (ronda 1). El plan 132-01 autoriza degradar a **N ≥ 3**
> si el riesgo A4 se materializa. Todo criterio de cierre de la fase se expresa en función de **N**;
> **ningún criterio queda cableado a 5**, porque un criterio inalcanzable por construcción es
> exactamente la presión que produce evidencia maquillada.

| Dónde | Cómo se obtiene N |
|-------|-------------------|
| Fuente de verdad | `FEEDS.length` en `packages/news/src/feeds.ts`, congelado por `feeds.test.ts` |
| Observable en el repo | `ls packages/news/src/__fixtures__/*.xml \| wc -l` |
| Declarado | SUMMARY de 132-01 ("número final de feeds vivos") y SUMMARY de 132-07 |
| Piso duro | `N < 3` ⇒ PARAR la fase (132-01 Task 3) |

---

## Presupuesto de red de la fase

> El probe de 132-01 corre **una sola vez**, dentro del `<action>`. Su `<verify><automated>` NO
> re-ejecuta red: comprueba los artefactos (fixtures: existencia, `<rss`, `<item`, tamaño, ausencia
> de `<!DOCTYPE html`). Re-correr el probe en cada re-verificación rompería este presupuesto y
> sobrescribiría los fixtures congelados de los que dependen los planes 02/04/05/06.

| Origen | Requests | Nota |
|--------|----------|------|
| `probe-feeds.ts` (132-01 T3) | N | 1 por host, ≥3 s de separación; NO escribe `source_snapshot`; corre UNA vez |
| Corrida LIVE (132-07 T2 paso 1) | N | 1 por host, ≥2 s de separación; escribe R2 + `source_snapshot` |
| Re-corrida `[skip]`, replay `--from-r2`, idempotencia | 0 | caché diaria / lectura de R2 |
| Re-verificación `news.google.com/robots.txt` (132-07 T3) | 1 | request de infraestructura, contabilizado aparte |
| **Total** | **2N (+1)** | 10 (+1) en el caso nominal N=5. Cualquier request adicional se justifica por escrito en el SUMMARY |

---

## Falsos rojos / falsos verdes cerrados en la revisión (ronda 1)

> Los dos blockers de esta ronda fueron el mismo patrón ya pagado dos veces: **el fix que es él mismo
> un falso verde o un falso rojo**. Para cada `<automated>` nuevo se aplicó la doble pregunta:
> *¿puede salir 0 sin probar nada?* y *¿puede NO salir 0 nunca?*

| Patrón | Dónde estaba | Cómo quedó |
|--------|--------------|------------|
| `set -e` + comando que DEBE fallar ⇒ verify **inalcanzable** (falso rojo) | 132-06 T1 | Captura dentro de `if …; then rc=0; else rc=$?; fi` + `test "$rc" -eq 2` (código exacto, no "≠ 0") |
| `env -u R2_*` revertido por la carga de `.env` ⇒ criterio inalcanzable, y "arreglarlo" degradaría el fallo duro | 132-06 T1 | Se prueba por el **tri-estado** (`r2Store: null`) en `run-news-cli.test.ts`, con mutación obligatoria + control positivo apareado. El `env -u` baja a auxiliar informativo |
| Criterio cableado a 5 feeds vs. degradación autorizada a N≥3 | 132-07 T2 | Todo parametrizado por **N**, con N observable en el repo y piso duro 3 |
| Verify que asserta estado de DB, no la **corrida** (pasa días después sin correr nada) | 132-07 T2 | Los pasos 1 y 2 vuelcan a log; el verify asserta `descargados=N skips=0` en run1 y N líneas `^[skip] rss-` + `descargados=0 skips=N` en run2, **además** del estado de DB |
| `<automated>` que re-ejecuta red y rompe el presupuesto / pisa fixtures | 132-01 T3 | El probe corre una vez en `<action>`; el verify comprueba artefactos sin red |
| Criterios con cláusula de juicio no medible | 132-04 **T3** (`.includes(` == 0, en `prefiltro-lexico.ts`) y 132-05 T1 (interpolación de credenciales) | Umbral numérico duro sobre el **archivo completo**, con la garantía de fondo delegada a las mutaciones ya existentes. *(Ronda 2: la referencia decía “132-04 T2”; el criterio `.includes(` vive en **T3** — T2 es `canonicalizar-url.ts`. Corregido.)* |
| §Open Questions sin marca de resuelto (pedía "adjudicación antes de planificar", decía "4 fuentes") | `132-RESEARCH.md` | Renombrada `## Open Questions (RESOLVED)` con resolución inline por pregunta apuntando a D-132-A..D; el texto original se conserva y la cifra "4 fuentes" queda anotada como obsoleta (son **5**) |

---

## Falsos verdes cerrados en la revisión (ronda 2)

> Los 4 blockers de esta ronda son el mismo patrón del milestone: **la compuerta que no muerde**. A cada
> `<automated>` nuevo se le aplicó la doble pregunta — *¿puede salir 0 sin probar nada?* y *¿puede NO salir 0
> nunca?* — y las construcciones se smoke-testearon en bash real antes de escribirlas en los planes.

| Patrón | Dónde estaba | Cómo quedó |
|--------|--------------|------------|
| **`passWithNoTests` — falso verde sistémico.** Los argumentos de `vitest run` son **filtros de nombre, no rutas**: un archivo inexistente da `No test files found` y **exit 0**. `--passWithNoTests=false` no basta: cubre “cero archivos”, no “cero tests dentro del archivo” | 132-01 T2, 132-03 T2, 132-04 T1/T2/T3, 132-05 T2, 132-06 T2 | Gate de **conteo impreso + exit code capturado por separado** en cada `<automated>`: `vitest run … > "$L" 2>&1; rc=$?; cat "$L"; test "$rc" -eq 0; test "$(grep -Eo "Tests +[0-9]+ passed" "$L" \| grep -Eo "[0-9]+" \| head -1)" -ge <MIN>`. MIN declarado por tarea (01-T2:11 · 01-T3:2 · 03-T2:12 · 04-T1:12 · 04-T2:8 · 04-T3:20 · 05-T2:10 · 06-T2:10 · 07-T1:**85** *(ronda 3: era 45, obsoleto; 85 = 11+2+12+12+8+20+10+10, el agregado real)*). Smoke-testeado: verde⇒pasa, `No test files found`⇒falla, `10 passed \| 2 failed`⇒falla |
| **CRLF de `psql -tA`** (gotcha v12.0 ya pagado): `test "$v" = "0084"` compara `0084\r` y **falla siempre**; `test "$s" -eq "$N"` sobre `5\r` aborta con `integer expression expected` | 132-02 T2, 132-07 T2 | `\| tr -d "\r"` en **cada** captura de `psql`, y el valor impreso entre corchetes para que un residuo sea visible. Comprobado que el fix no vuelve el criterio vacuo (valor equivocado sigue fallando) |
| **Control positivo mal apareado**: el par variaba `r2Store` **y** `dryRun` ⇒ no aisla la causa (el positivo podía completar por ser dry-run, no por tener R2) | 132-06 T2 | El par difiere **solo** en `r2Store`: `{r2Store: fake, dryRun: false}` completa vs `{r2Store: null, dryRun: false}` falla duro. Además se asserta el **tipo** de error y que el `message` contiene `R2` (no basta “lanzó”: un `TypeError` pasaría) |
| **Constante 5 cableada** pese a la degradación autorizada N≥3 ⇒ criterio inalcanzable si A4 retira un host, y la única salida sería maquillar | 132-07 (`<name>` T2, `<objective>`, `<threat_model>`, `<success_criteria>` SC4) | Todo reexpresado como **N = `FEEDS.length` ≥ 3**. La cláusula N se añadió además a **ROADMAP §Phase 132 SC4** y a **REQUIREMENTS §NEWS-02**, sin borrar el texto existente |
| `sed -E 's://.*::'` **destruye `https://` antes del grep** ⇒ la alternativa `https?://` nunca puede matchear (media compuerta muerta) | 132-04 T1 | Despojo **por línea** (`grep -v "^[[:space:]]*//"` + `*` + `/*`) que preserva el resto de la línea, y el criterio movido **dentro** del `<automated>`. Verificado en bash: el `sed` contaba 1, el filtro por línea cuenta 2 |
| `grep -q "@obs/news"` **pasa con 0 tests** (`pnpm -r` imprime el nombre igual); y el log de `pnpm -r` trae **un `Tests N passed` por paquete** ⇒ `head -1` tomaría otro paquete | 132-07 T1 | El conteo `≥ 45` se toma de una corrida **filtrada** (`pnpm --filter @obs/news test`) con log propio, donde hay una sola línea de conteo |
| `BASE` vía `git rev-list --grep` **se desplaza** con cualquier commit futuro que cite la cadena ⇒ la ventana del diff se encoge hasta vaciarse | 132-06 T1 | SHA **literal** `90580a2`, verificado que resuelve a `docs(132): 7 planes en 5 waves para NEWS-RSS`, con `git cat-file -e` como guarda de existencia |
| `pnpm` puede **interceptar** el flag inexistente ⇒ el exit 2 mediría el parser de pnpm, no el `parseArgs` del CLI | 132-06 T1 | Separador `--` antes del flag |
| `N` derivado de contar fixtures vs `FEEDS.length`, **sin verificar que coincidan** ⇒ un fixture huérfano (host retirado por A4) desalineaba todos los asserts del plan 07 | 132-07 T2 | Nuevo `packages/news/src/fixtures.test.ts` (creado en 132-01 T3) asserta `FEEDS.length === nº de *.xml` y un fixture por slug; el `<automated>` del plan 07 lo corre como gate de `N` |
| Trade-off **aceptado**, no cerrado: los fixtures se capturan en `<action>` y el `<verify>` no re-corre el probe ⇒ la **corrida** del probe no queda probada por comando | 132-01 T3 | Escrito en el plan (no solo aquí): el verificador de fase **NO** debe tomar ese `<automated>` como prueba de que el probe corrió — debe leer la salida pegada en el SUMMARY. Se acepta para no reventar el presupuesto de red ni pisar los fixtures congelados |

---

## Falsos verdes cerrados en la revisión (ronda 3)

> El blocker de esta ronda es la variante más barata del patrón del milestone: **el `bash -c` sin
> `set -e`**. Todas las aserciones estaban escritas, ninguna se ejecutaba como compuerta. A cada fix
> se le aplicó la doble pregunta en bash real — *¿puede salir 0 sin probar nada?* / *¿puede NO salir
> 0 nunca?* — antes de escribirlo en el plan.

| Patrón | Dónde estaba | Cómo quedó |
|--------|--------------|------------|
| **BLOCKER — `bash -c` SIN `set -e`**: el exit del script es el de la **última** orden, así que los `test "$rc" -eq 0` de `pnpm test`/`typecheck`/`guards`, el gate de conteo y los greps `== 0` eran **no-ops**. La suite podía estar ROJA y el gate salía **0** | 132-07 T1 | `set -e` + patrón `if CMD > log 2>&1; then rc=0; else rc=$?; fi` para los **4** comandos (el mismo ya validado en 132-06 T1). El `if` es obligatorio: a pelo, bajo `set -e`, el script abortaría antes de imprimir qué comando cayó. **Smoke-test:** suite roja ⇒ exit **1** (antes 0) · suite verde pero con 40 tests ⇒ exit **1** · todo verde con 85 ⇒ exit **0** |
| **Umbral agregado obsoleto**: 45 con MIN reales que suman **85** ⇒ 40 tests de holgura muerta; una suite que perdiera media fase pasaba el gate | 132-07 T1 | Piso **85** = 01-T2 11 + 01-T3 2 + 03-T2 12 + 04-T1 12 + 04-T2 8 + 04-T3 20 + 05-T2 10 + 06-T2 10. Se mantiene la instrucción de ajustar al agregado real de los SUMMARY, con 85 como piso que nunca baja. **Smoke-test:** 40 passed ⇒ falla; 85 passed ⇒ pasa |
| **Criterios de seguridad FUERA del `<automated>`**: los 4 greps (interpolación de credencial, B26, `onConflict`, `dedupePorClave`/`CHUNK`) eran prosa; el comando era solo `tsc -b` ⇒ una service key interpolada o un project-ref transcrito pasaban sin ser mirados | 132-05 T1 | Los 4 movidos **dentro** del `<automated>`, tras el `tsc -b`, bajo `set -e`. **Smoke-test:** writer limpio ⇒ 0 · con `` `${serviceKey}` `` + project-ref ⇒ 1 · con project-ref en `writer.ts` (el otro archivo del par) ⇒ 1 · con `tsc -b` rojo ⇒ 2 |
| **Test que golpea la red viva en cada `pnpm test`**: el par apareado de `run-news-cli.test.ts` corre `main()` con `dryRun: false` (camino de Etapa 1); sin conector doble inyectado, construiría las deps reales y scrapearía los N feeds en cada corrida de la suite | 132-06 T2 | `<behavior>` exige **conector doble en AMBOS casos** (la única variable que difiere sigue siendo `r2Store`) + `vi.stubGlobal("fetch", () => { throw new Error("red prohibida en tests") })` a nivel de archivo, y el gate de cero-red **dentro** del `<automated>` (patrón 132-03 T2 **invertido**: allá se exige la ausencia del stub, acá su presencia). **Smoke-test:** archivo con stub + doble ⇒ `stub=1 msg=1 realfetcher=0` pasa; archivo con `new Fetcher(...)` ⇒ `stub=0 msg=0 realfetcher=1`, los tres gates muerden |
| **`<automated>` sobre un paquete con 0 tests**: al terminar 132-01 T1 no existe ningún `*.test.ts` y `passWithNoTests: true` ⇒ `pnpm --filter @obs/news test` sale **0 sin probar nada** (falso verde estructural) | 132-01 T1 | Reemplazado por un **gate de artefactos** que no depende de tests: `vitest.config.ts`, `package.json` con script `test`, `pnpm-workspace.yaml` recorriendo `packages/*`, reference `./packages/news` en el tsconfig raíz (== 1), `"paths"` == 0, symlink `@obs/ingest`, y `pnpm typecheck` con exit propio. El **anti-CI-DARK lo prueba la falla inducida** registrada en el SUMMARY — declarado explícitamente en el plan, mismo régimen ya aceptado en 01-T3. **Smoke-test:** el gate sale **1** contra el repo actual (no existe `packages/news`) ⇒ no es vacuo; sus análogos sobre `packages/tramitacion` dan `test-script=1 paths=0 reference=1` ⇒ alcanzable |

> **Comprobación transversal (ronda 3):** los **17** bloques `<automated>` de los 7 planes se extrajeron
> y pasaron `bash -n` — los 17 son sintácticamente válidos. B26 se mantiene intacto en 05, 06 y 07.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] Ningún criterio de aceptación puede cortocircuitar (comandos encadenados con `&&` cuyo exit
      code se reusa, `git diff` sin commit base, greps sin umbral numérico) — premortem F-5
- [ ] Ningún `<automated>` es **inalcanzable** (comando que debe fallar bajo `set -e`, condición de
      entorno que el propio proceso revierte, constante cableada que la degradación autorizada
      vuelve imposible) — revisión ronda 1
- [ ] Ningún `<automated>` de una corrida asserta **solo** estado de DB: debe asertar también la
      evidencia de la corrida (log) — revisión ronda 1
- [ ] Todo `<automated>` de vitest lleva **gate de conteo** (`Tests N passed` ≥ MIN) **y** exit code
      capturado por separado — el exit code solo no distingue “verde” de “no corrió nada” — ronda 2
- [ ] Toda captura de `psql -tA` pasa por `| tr -d "\r"` — ronda 2
- [ ] Todo control positivo apareado varía **una sola variable** respecto de su negativo — ronda 2
- [ ] Ningún criterio cableado a la constante 5: la fase se cierra contra **N = `FEEDS.length` ≥ 3** — ronda 2
- [ ] **Todo `bash -c` de un `<automated>` empieza por `set -e`** — sin él el exit es el de la última
      orden y las aserciones intermedias no verifican nada — ronda 3
- [ ] Todo comando que puede fallar legítimamente se captura como `if CMD > log 2>&1; then rc=0; else
      rc=$?; fi` (nunca a pelo bajo `set -e`, nunca encadenado con `&&`) — ronda 3
- [ ] Ningún criterio de seguridad (greps de credenciales / B26) queda **fuera** del `<automated>` — ronda 3
- [ ] El umbral agregado de tests de 132-07 T1 es **≥ 85** (agregado real de los MIN por tarea) — ronda 3
- [ ] Ningún test de la suite puede tocar la red viva: `run-news-cli.test.ts` lleva conector doble en
      AMBOS casos del par y `vi.stubGlobal("fetch")` que lanza, verificado por grep — ronda 3
- [ ] Ningún `<automated>` corre una suite vacía como prueba (132-01 T1 es gate de artefactos; el
      anti-CI-DARK va por falla inducida registrada en el SUMMARY) — ronda 3
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
