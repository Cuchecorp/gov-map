# PROMPT — v13.0 Pasada 2 en AUTÓNOMO GRANULAR (desde 133-b hasta el cierre)

> **Uso:** pegar en una sesión LIMPIA (`/clear`), repo Observatorio, raíz del proyecto.
> **Reemplaza** a `PROMPT-133-retomar.md` y a `PROMPT-v13.0-continuar.md`: ambos quedaron obsoletos
> cuando 133-a se ejecutó. **Este manda** donde difieran.
> **Escrito:** 2026-08-06, al cerrar 133-a.

---

## 0. Régimen de modelos (mandato del operador, 2026-08-06)

| Rol | Modelo | Qué hace |
|---|---|---|
| **Decisiones** | **Fable** | Adjudica: taxonomías, umbrales, contratos, trade-offs de producto. Escribe `NNN-ADJUDICACION.md` con razón y con *"qué la refutaría"*. |
| **Ejecución** | **Sonnet** | `gsd-executor` / `gsd-code-fixer`. **Ejecuta y NO decide**: ante una decisión no prevista, **para y escala**. |
| **Validación** | **Opus** | plan-checker, **premortem**, verifier, code-review, y **diseño de spikes** cuando haga falta. **Nunca valida un plan que él mismo escribió.** |

**⚠️ Contingencia de créditos de Fable.** El 2026-08-05 Fable se quedó **sin créditos** y el operador
firmó **D-133-RATIF**: mientras no haya créditos, **Opus adjudica en sustitución**, siempre
**declarado en la cabecera** del documento y siempre entrando a un checkpoint de operador. **Prueba
Fable primero en cada fase.** Si responde, Fable decide. Si no, Opus sustituye y lo dice — jamás en
silencio.

**Pipeline por fase, nada se auto-acepta:**

```
discuss (Fable adjudica) → research (Opus) → plan (Opus) → PREMORTEM (Opus: verifica premisas
EJECUTANDO comandos contra el repo y PROD) → plan-checker (Opus, rondas SIN TECHO hasta PASS)
→ execute (Sonnet) → verifier + code-review (Opus) → gap closure si hace falta
```

**Granular:** un plan por unidad de trabajo, commits atómicos por tarea, SUMMARY por plan con
**números medidos** (no adjetivos). Waves **secuenciales en el árbol principal** cuando el trabajo
sea sensible al orden de git; paralelas solo si los `files_modified` son disjuntos y no hay commits
que compitan por el índice.

---

## 1. La pregunta que va a cada `<acceptance_criteria>`, siempre

> **¿Este comando puede salir 0 sin haber probado nada?**
> **Y su gemela: ¿puede NO salir 0 nunca?**

Y para cada test nuevo: **mutar el código y comprobar que el test CAE.** Si una mutación no muerde,
se arregla **la mutación, jamás el hecho** — salvo que el hecho sea un bug, y entonces se declara
como tal.

**En 133-a la convergencia fue 9 → 5 → 2 → 1 blockers en cuatro rondas, y en dos de ellas el fix de
la ronda anterior ERA el defecto de la siguiente.** No te apures.

---

## 2. Estado real de entrada (verificado 2026-08-06)

### Completo y verificado

- **132 NEWS-RSS** — 4/4. Migraciones `0084`/`0085` en PROD.
- **133-a NEWS-TAXO** — `VERIFICATION` **PASSED 11/11**, `REVIEW` 0 CRITICAL / 3 HIGH cerrados en
  gap closure. 30 commits. Suite `@obs/news` **206 → 268**; guards **17 → 20**; step de CI para
  `@obs/news` añadido.
  - Congelado por hash: `taxonomia.json` `9098188897977…`, `thresholds.json` `e428594463eba…`
    (estables en clon limpio; **no se movieron** tras el fix del canonicalizador).
  - Artefactos en `packages/news/src/eval/`: `taxonomia.ts`, `canonicalizar-json.ts`,
    `entrada-llm.ts`, `caso-golden.ts`, `congelado.test.ts`, `CONGELADO.md`, `taxonomia-guard.test.ts`
    (G1), `taxonomia-superficie-guard.test.ts` (G2).

### Datos en PROD (tras el día 2)

`noticia` **58** · `noticia_url_vista` **467** (409 descarta / 58 pasa) · `source_snapshot(news)` **10**
(2 días × 5 feeds en R2).
Outlets: latercera **40**, lacuarta **11**, exante **4**, biobiochile **2**, cooperativa **1** —
**los cinco aportan** (el día 1 tenía solo dos).

### Lo que falta

| Fase | Estado |
|---|---|
| **133-b NEWS-TAXO (golden)** | ⬜ **siguiente**. Necesita día 3 (2026-08-07) + **checkpoint de operador indelegable** |
| **134 NEWS-RESOLVER** | ⬜ depende de 133 |
| **135 NEWS-CLASIF** | ⬜ depende de 134 |
| **136 NEWS-CRON** | ⬜ el cron que hoy NO existe |
| **137 NEWS-FICHAS** | ⬜ incluye la página pública "Cómo clasificamos las noticias" |
| **138 E2E** | ⬜ deploy agrupado + BrowserOS sobre el deploy real |
| **129 PANEL-DISEÑO** | ⚠️ **estado ambiguo**: el ROADMAP la tiene sin marcar, pero la pasada 1 la cerró **sin cumplir su SC** (veredicto negativo del operador) y difirió la deuda a una **Phase 139 PANEL-DASH** que no existe en el ROADMAP. **Resolver esa contradicción con el operador antes de tocarla** — no la incluyas en el barrido autónomo. |

---

## 3. Decisiones LOCKED que NO se re-abren

Están en `.planning/phases/133-*/`: **`133-READJUDICACION.md`** (D-133-A2..I, firmada por el operador
el 2026-08-06: *"consideralo firmado"*) y **`133-ADDENDUM-IMPLEMENTACION.md`** (D-133-J1..K4).
Lo esencial que gobierna 134-137:

- **Taxonomía:** 5 clases + `ambiguo`, precedencia **en el orden del array**. `agenda_ejecutivo`
  **no existe** (fusionada). **Regla de decidibilidad textual:** una clase cuyo hecho decisorio vive
  en el corpus es **ilegal** — el clasificador no consulta el corpus.
- **Enrutamiento:** `tramitacion_legislativa` y `ley_vigente` → ficha de **proyecto**;
  `actividad_parlamentaria` → ficha de **persona**; el resto → **ninguna**.
- **D-133-G:** la etiqueta es **interna y JAMÁS se renderiza** al ciudadano. El ciudadano ve
  **titular + medio + fecha + enlace**. Se cumple por **guard** (G2), no por promesa.
- **Umbrales (D-133-D2):** 9 en orden `T1..T5,T9,T6,T7,T8`. **T9
  `precision_actividad_parlamentaria ≥ 0,90`** protege la única clase que toca la ficha de una
  persona. **T3 es macro-promedio**, no accuracy global. **Cada veto con n mínimo 25**: bajo eso
  `no-medido` y **la clase no enruta** (fail-closed). Intervalos: vetos sobre la puntual, marcados
  `dentro-del-ruido` si el IC cruza; desempate por **solapamiento de IC**, no por 6 pp.
- **Refutación pre-registrada:** si ningún modelo alcanza T3 o T4, **NEWS-05 no entra a producción**.
  **Bajar el umbral tras ver el número NO es salida válida.**
- **D-133-H:** 133 **no** redefine el SC1 LOCKED de la 134 (*"el LLM emite boletín/nombre de la lista
  cerrada inyectada"*). Si se quiere la arquitectura más estricta, es **enmienda explícita al SC1 de
  la 134**, firmada aparte.
- **D-132-A:** Google News **descartado** por robots.txt. Operan 5 medios directos. **Cláusula N ≥ 3**:
  bajo tres feeds vivos, la fase PARA.
- **Flags:** un agente **JAMÁS** flipea `*_PUBLIC_ENABLED`. VSIM/NET/CRUCES ON, MONEY/NOTIF OFF.
- **"Sin foto y sin partido" es decisión LEGAL**, no técnica.
- **Jamás transcribir el project-ref de Supabase**: parametrizar siempre. En la pasada 1 el secreto
  se reintrodujo **dos veces al documentar su propia redacción**.

---

## 4. ▶ 133-b — la fase siguiente, y su checkpoint INDELEGABLE

Lee primero: **`.planning/phases/133-*/133-b-ESTADO-VENTANA.md`** (estado medido de la ventana),
luego `133-READJUDICACION.md` (D-133-B2 golden, D-133-C2 protocolo) y `133-CONTEXT.md`.

### 4.1 🔴 El conector NO tiene cron: la ventana no se acumula sola

Verificado: **13 workflows y ninguno corre el conector de news** (el cron es la **Phase 136**, aún no
construida). **Hasta que exista la 136, la corrida diaria es MANUAL y LOCAL:**

```bash
pnpm --filter @obs/news ingest
```

Idempotente, hash-check primero, 5 requests con rate-limit. **Córrela al empezar cada día hábil** o
la ventana no avanza. Día 1 = 2026-08-05, día 2 = 2026-08-06 (hechos). **Día 3 = 2026-08-07.**

### 4.2 El golden

Censo de P + **50 `N-alea`** (aleatorio con **semilla fija documentada** sobre `url_hash` ordenado) +
**30 `N-sonda`** (descartados con tokens institucionales fuera del vocabulario) + **`P-dirigido`**
hasta **n ≥ 25** en `tramitacion_legislativa` y `actividad_parlamentaria`, declarando el
sobre-muestreo. **Piso duro 100 casos** — el 140 dejó de ser objetivo firmado.

**Antes de etiquetar un solo caso:** correr el chequeo de cobertura de `prefiltro.terminos`
(D-133-F2.2). Si <95 %, **el límite sube antes**, no después: cambiarlo luego mueve el hash de
`golden-set.json` y obliga a re-etiquetar todo.

**Nunca ablandar el pre-filtro para conseguir muestra** (`prefiltro-lexico.ts:6-9`, prohibición LOCKED).

### 4.3 ⛔ El checkpoint que NINGÚN agente puede hacer

**El operador etiqueta 20 casos estratificados A CIEGAS, antes de ver cualquier etiqueta de máquina**
(~30 min), y **arbitra los desacuerdos** (≤25, presupuesto de sesión, no puerta de calidad).

**Si lo hiciera un agente, κ(humano↔máquina) sería κ(máquina↔máquina)** — el falso verde estructural
exacto que D-133-C2 existe para evitar, y que costó tres rondas detectar. **PARA y pide al operador.**
No lo simules, no lo aproximes, no lo declares "equivalente".

Anotadores: **modelos DISTINTOS** (Sonnet + Opus, o Fable cuando tenga créditos) — dos Sonnet miden
auto-consistencia. Se publican **dos kappas**; si κ(humano↔máquina) < κ(máquina↔máquina) − 0,15, el
κ de máquina se declara **no interpretable**.

**Puerta de calidad:** acuerdo bruto **≥ 0,80** y **κ ≥ 0,65**. **Condición de refutación escrita:**
tras **dos rondas** de re-definición sin pasar, la taxonomía se declara **no etiquetable sobre
titular+bajada** y 133 **reporta fracaso**.

Cierra con la **segunda firma del operador**, ya con κ, n por clase e IC a la vista.

---

## 5. Pendientes heredados (resolver en su fase, no olvidar)

1. **⏳ Nadie ha visto un run verde de CI.** `ci.yml` **no generó run** pese al push del 2026-08-06 y
   a tener `on: push: branches: [master]`; su última corrida es del **2026-07-30**. CodeQL quedó
   encolado. **No tiene `workflow_dispatch`** ⇒ no se puede forzar. Mitigación ya aplicada: los 5
   caminos hardcodeados de G1/G2 coinciden exacto con el índice de git. **Confirmar el primer run
   verde del step de `@obs/news`** en cuanto Actions responda.
2. **🟡 El cron `actualidad-refresh` lleva todo el día fallando** — 3 fallos el 2026-08-06 (13:00,
   16:09, 18:35), los dos últimos colgando **15 min**. **Cloudflare 522 del REST de Supabase**; el
   **Postgres directo SÍ responde**. Es producción rota **hoy** y merece diagnóstico propio
   (`/gsd:debug`), no un parche dentro de otra fase.
3. **Deuda de CI de raíz:** `ci.yml` corre **3 de ~17 workspaces**. 133-a añadió el de `@obs/news`;
   el resto sigue **CI-dark**. Candidato a fase propia — **no ampliar alcance dentro de otra fase**.
4. **Estampa de versión del pre-filtro:** ya **NO es bloqueante** (se midió: replay del día 1 desde
   R2 con el filtro arreglado da **25 = 25**, idéntico por outlet ⇒ el bug no cambió ningún
   veredicto). Queda como **higiene** para el futuro.
5. **Deuda arquitectónica para la 134:** `extraerBoletines` vive en `app/lib/boletin-en-materia.ts:58`,
   no en `packages/`, y su fail-closed usa la RPC `lobby_menciones_de_boletin`. Reusarlo desde
   `packages/news` **invertiría la dirección de dependencia del monorepo**. El plan de la 134 debe
   resolverlo **explícitamente** (mover con diff-cero, o invocar desde `app/`), no descubrirlo a
   mitad de camino.
6. **Entregable público de la 137:** página **"Cómo clasificamos las noticias"** — taxonomía,
   umbrales, `exactitud_medida`, `n`, IC, `fecha_del_eval`, modelo y las **seis limitaciones**
   declaradas, ligada al hash de `CONGELADO.md`. Es obligación LOCKED (D-133-B2/E2): un observatorio
   de transparencia publica su propia vara **aunque no muestre la etiqueta**.

---

## 6. Gotchas pagados — no re-pagarlos

**De método (los más caros):**

- **`passWithNoTests: true` está activo** y los args de `vitest run` son **filtros de nombre, no
  rutas** ⇒ todo `<automated>` puede salir 0 **sin correr nada**. Asserta el **conteo impreso**
  (`Tests N passed`), **jamás el exit code solo**.
- **`NO_COLOR=1` es obligatorio** en toda invocación de vitest: los códigos ANSI meten dígitos
  (`^[[22m`) y `grep -oE 'Tests[^0-9]+[0-9]+ passed'` devuelve **vacío con rc=1**. Estaba roto en los
  5 planes de 133-a.
- **`-t` de vitest es un REGEX, no un literal.** `-t "(1b) WR-03"` trata `(1b)` como grupo de
  captura, **selecciona 0 tests y sale rc=0** ⇒ las dos direcciones de una mutación salen verdes.
  **Escapa los paréntesis y asserta el conteo (`-eq 1`) en toda corrida con `-t`.**
- **Cuando un fix cambia CÓMO se mide algo, toda cifra derivada de la medición anterior queda
  invalidada.** El piso de términos venía de una extracción sin strippear comentarios (104); con
  strip el real es **92**. El `it` nacía rojo y detenía la fase.
- **`.sort()` sin comparador sobre un array de objetos es un NO-OP** (todo coerciona a
  `"[object Object]"`, el sort es estable). Mutación decorativa.
- **`set -e` + un comando que DEBE fallar = verify inalcanzable** (falso rojo): usa
  `if CMD > log 2>&1; then rc=0; else rc=$?; fi`.
- **Un control positivo que varía DOS variables no aísla la causa** — el par debe diferir en UNA.
- **`git diff --name-only` sin base fija siempre pasa** con commits atómicos: usa **SHA literal**.
- **Anti-cero-vacuo:** todo walk/scan con piso de conteo realista **más** sanity de un archivo
  concreto conocido. Un `try/catch` que devuelve `[]` sale verde habiendo escaneado nada.
- **Verifica cada `ruta:línea` antes de escribirla.** Tres rondas seguidas fallaron por citas
  corridas; el ejecutor lee por línea.
- **Un criterio de `git status --short` limpio debe llevar pathspec** (`-- . ':(exclude).planning'`):
  `.planning/` tiene artefactos vivos que se escriben durante la propia ejecución.

**De repo:**

- **`.gitattributes` ya existe** (lo creó 133-a) con `packages/news/src/eval/**/*.json text eol=lf`.
  **`--renormalize` NO añade untracked** y falla **rc=128** si el directorio no existe.
- Migraciones: `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f`, **jamás
  `db push`**; numerar por `ls supabase/migrations` (**0085** es la última aplicada).
  **`0073`/`0075` escritas y NO aplicadas: JAMÁS editarlas.**
- Conteos por `psql -tA` **con `| tr -d '\r'`** — el CRLF revienta cualquier `test` numérico.
- **PostgREST capa en 1k**: paginar `.order().range()` siempre.
- **RPC pública nueva = aguja completa** (migración + pgTAP + guard).
- **Ingesta en DOS etapas**: fuente → R2 content-addressed → Supabase. Re-ingestar se hace
  **SIEMPRE desde R2**, nunca re-scrapeando. (Validado end-to-end el 2026-08-06.)
- **Backfill masivo = LOCAL**, jamás GitHub Actions.
- Si creas un `app/lib/*guard*.test.ts` nuevo, `create-view-guard.test.ts` se pone rojo hasta
  añadirlo al script `guards` de `app/package.json:11` **en el mismo commit**.
- **Jamás globs en el script `guards`** (D-13). Hoy son **20**, por nombre.
- **Flake conocido:** `vsim-antiflip-guard.test.ts` da timeout ocasional por contención de recursos
  (verde en aislamiento). Re-corre y **documenta**; jamás lo uses para justificar un verde.

---

## 7. Cómo trabajar en autónomo, y dónde PARAR

**Avanza sin preguntar** en: research, planes, premortems, rondas de checker, ejecución, verificación,
code-review, gap closure, corridas diarias del conector, y commits.

**PARA y escala al operador** en:

1. **Los checkpoints indelegables de 133-b** (los 20 casos a ciegas, el arbitraje, la segunda firma).
2. **Cualquier decisión que cambie un SC LOCKED** de otra fase (p. ej. el SC1 de la 134).
3. **Flipear cualquier flag** `*_PUBLIC_ENABLED`.
4. **Cualquier cosa que publique al ciudadano** algo nuevo, o que toque el carril PII.
5. **Una refutación pre-registrada que se cumple** (p. ej. ningún modelo alcanza T3/T4 en la 135):
   la salida honesta está escrita — **no negocies el umbral**.
6. **Un premortem con blockers de fondo** que exija re-adjudicar una decisión firmada.
7. **Créditos de Fable agotados**: sustituye con Opus **declarándolo**, y marca el documento como
   pendiente de ratificación.

**Reporta como se reportó en 133-a:** con **números medidos**, diciendo **qué no se cumplió** antes
que lo que sí. *Un verde dudoso se reporta, no se redacta bonito.* El ejecutor de la 132 reportó
`cache.hasToday` como no-op en producción en vez de maquillarlo; el de 133-a corrigió una mutación
decorativa y encontró un **bug de producción real**. Ese es el estándar.

---

## 8. Arranque sugerido

```
1. pnpm --filter @obs/news ingest        # día 3 — sin esto no hay ventana
2. Lee 133-b-ESTADO-VENTANA.md y 133-READJUDICACION.md
3. Fable adjudica lo que 133-b necesite (o Opus en sustitución, declarándolo)
4. /gsd:plan-phase 133 --gaps  (o plan nuevo para 133-b) → premortem Opus → checker hasta PASS
5. Ejecuta con Sonnet, para en el checkpoint de los 20 casos a ciegas
6. Tras la segunda firma: 134 → 135 → 136 → 137 → 138, cada una con el pipeline completo
```

*Escrito 2026-08-06 al cerrar 133-a, con 133-b lista para arrancar en cuanto exista el día 3.*
