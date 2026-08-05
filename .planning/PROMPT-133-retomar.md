# PROMPT — Retomar v13.0 desde la Phase 133 (post-`/clear`)

> **Uso:** pegar en una sesión LIMPIA, repo Observatorio. Reemplaza a
> `PROMPT-v13.0-continuar.md` para todo lo que queda de la Pasada 2 (ese sigue válido como referencia
> de régimen, pero **este manda** donde difieran: fue escrito antes de que la 132 se ejecutara y de
> que la adjudicación de la 133 fuera refutada).

---

## Régimen de modelos (LOCKED, con la enmienda del 2026-08-05)

| Rol | Modelo | Nota |
|---|---|---|
| **Decisiones** | **Opus** | ⚠️ **Fable se quedó SIN CRÉDITOS.** El operador **RATIFICÓ** la sustitución: mientras no haya créditos, **Opus adjudica**. Si Fable vuelve a estar disponible, vuelve a ser el decisor. |
| **Ejecución** | **Sonnet** | `gsd-executor` / `gsd-code-fixer`. Ejecuta y **no decide**: ante una decisión no prevista, **para y escala**. |
| **Validación** | **Opus** | plan-checker, premortem, verifier, code-review. Nunca valida un plan que él mismo escribió. |

**Pipeline por fase (nada se auto-acepta):**
`discuss (Opus adjudica) → research → plan → PREMORTEM (Opus, verifica premisas contra repo y PROD)
→ plan-checker (Opus, rondas SIN techo hasta PASS) → execute (Sonnet) → verifier + code-review (Opus)
→ gap closure si hace falta`.

**La pregunta a cada `<acceptance_criteria>`, siempre:** *¿este comando puede salir 0 sin haber
probado nada?* Y su gemela, que en la 132 costó una ronda entera: *¿puede NO salir 0 nunca?*
Para cada test nuevo: **mutar el código y comprobar que el test cae.**

---

## Estado real de entrada (verificado 2026-08-05)

- **Phase 132 NEWS-RSS: COMPLETA y VERIFICADA 4/4.** 11 planes (7 + 4 de gap closure).
  - Migraciones **0084** (`noticia`, `noticia_url_vista`, RLS deny-all) y **0085** (estado
    `pendiente` en el ledger) **aplicadas a PROD**, pgTAP 16/16 y 9/9 contra el schema aplicado.
  - `packages/news` con **206 tests**; suite raíz verde; `pnpm guards` 0.
  - PROD: `noticia` **25** · `noticia_url_vista` **245** (220 `descarta/prefiltro_lexico` + 25 `pasa`)
    · `source_snapshot(source='news')` **5**. Las 25 vienen de **solo 2 outlets**: latercera 18,
    lacuarta 7.
  - Crudos en R2: `news/rss-<slug>/2026-08-05/<sha256>.xml` (5 feeds, 245 ítems re-parseables sin red).
- **Phase 133: NO iniciada.** Existe `133-ADJUDICACION.md` (Opus) **REFUTADA por `133-PREMORTEM.md`
  con 8 blockers**. Nada congelado, nada hasheado, ningún caso etiquetado.
- **134-136: no iniciadas.**

---

## Decisiones de operador vigentes (verbatim, NO re-abrir)

- **D-133-RATIF (2026-08-05):** sustitución Opus-por-Fable **RATIFICADA**. Las decisiones de
  `133-ADJUDICACION.md` **no** quedan ratificadas — se re-adjudican las refutadas.
- **D-133-G (2026-08-05):** **la etiqueta de la taxonomía es INTERNA y JAMÁS se muestra al
  ciudadano.** Solo enruta (de qué ficha cuelga la noticia). El ciudadano ve **titular + medio +
  fecha + enlace original**. `no_legislativa` / `politica_no_legislativa` jamás se renderizan.
  El cumplimiento va por **guard con control positivo apareado**, no por promesa. Sigue siendo
  obligatorio **publicar la metodología** (taxonomía, vara, tasa de error, fecha del eval).
- **D-132-A (2026-08-05):** **Google News RSS Search DESCARTADO** — `news.google.com/robots.txt`
  prohíbe `/rss/` para todo UA (verificado con `robots-parser@3.0.1`, la librería del propio guard).
  Operan **5 medios directos**: biobiochile, cooperativa, latercera, lacuarta, exante. Cláusula
  **N ≥ 3** si el WAF baja alguno; bajo 3, la fase PARA.
- **#34 enmienda AUTORIZADA:** un eje de `/comparar` que falla declara estado `fallo`
  (≠ `vacío`) en vez de tumbar la página, con `error.tsx` propio de la ruta.
- **"Sin foto y sin partido" es decisión LEGAL, no técnica.** Ningún rediseño usa retratos.
- **Rotación B26 diferida** por el operador. Jamás transcribir el project-ref: **parametrizar
  siempre**. En la Pasada 1 el secreto se reintrodujo **dos veces al documentar su propia redacción**.
- **Flags:** un agente JAMÁS flipea `*_PUBLIC_ENABLED`. VSIM/NET/CRUCES ON, MONEY/NOTIF OFF.

---

# ▶ TAREA — Phase 133 partida en dos

Lee primero, en este orden:
`.planning/phases/133-*/.continue-here.md` → `133-PREMORTEM.md` → `133-ADJUDICACION.md`.

## 133-a — HOY (no depende de datos nuevos)

**Re-adjudicar con Opus** lo que el premortem refutó, y construir lo que no depende del golden:
taxonomía corregida, umbrales re-derivados, formato de congelación, y el cierre del agujero del
linter. **Esta es la firma que de verdad debe preceder a cualquier medición.**

Los **6 blockers vivos** que la re-adjudicación DEBE resolver (BL-1 lo resolvió D-133-G; BL-4 quedó
reducido a "publicar metodología"):

| # | Blocker | Qué hay que cambiar |
|---|---|---|
| **BL-2** | `actividad_parlamentaria` es la única clase que aterriza en la ficha de una **persona** y la única **sin umbral**. El argumento "el FP lo mata el resolver ⇒ boletín `null`" **no aplica** (no hay boletín que resolver). Con D-133-G sube de prioridad: sin etiqueta visible, no hay salvedad a la vista. | Umbral propio para esa clase, y regla explícita de qué noticia puede colgar de la ficha de una persona. |
| **BL-3** | Poner el copy de la taxonomía en `packages/news` **bypassea el linter anti-insinuación**: el guard ancla `APP_ROOT` en `app/` (`app/lib/anti-insinuacion-guard.test.ts:68`) y **salta en silencio los archivos que no encuentra** (`:943-948`); su propio comentario (`:421-423`) ya documenta el agujero para `packages/notificaciones`. | Extender el carril del guard, **o** el guard nuevo de D-133-G que asegura que ningún literal de taxonomía llega a una superficie renderizada. Con control positivo apareado. |
| **BL-5** | `ley_vigente` y `agenda_ejecutivo` son **indecidibles** desde titular+bajada (sus fronteras exigen saber si algo está en trámite), y el protocolo exige **citar un fragmento literal** ⇒ esos casos se auto-rechazan. Contradicción A↔C. | Fusionar clases, o cambiar la regla de evidencia, o ambas. |
| **BL-6** | El κ entre **dos pases de Sonnet** es **auto-consistencia** disfrazada de acuerdo inter-anotador. Es un falso verde estructural sobre la métrica que la fase existe para producir. | Anotadores de familias distintas, o arbitraje humano sobre muestra, o declarar que no hay κ real. |
| **BL-7** | El cap de **25 arbitrajes** contradice el criterio de acuerdo **≥0,80**, que a n=140 admite **28** desacuerdos. Y "vuelve a D-133-A" es un bucle **sin condición de salida**. | Aritmética coherente + condición de salida escrita. |
| **BL-8** | **n(`tramitacion_legislativa`) ≈ 12** ⇒ el veto T4 ≥0,85 se resuelve **por un solo ítem** (valores alcanzables: 0,833 y 0,917). `ley_vigente` y `agenda_ejecutivo` nacen bajo el piso n=8 de la propia adjudicación. Y T3 **es** una accuracy global, que D-133-B:140 prohíbe explícitamente. | Umbrales medibles al n real, o n mayor, o umbrales por intervalo en vez de estimación puntual. |

**Además, la contradicción con lo LOCKED:** `133-ADJUDICACION.md:268-269` dice *"el LLM jamás emite
el número de boletín"*, pero el **SC1 LOCKED de la Phase 134** (`ROADMAP.md:232`) dice *"El LLM emite
boletín/nombre de la lista cerrada inyectada… jamás un id"*. Reconciliar explícitamente antes de
planificar la 134.

**Y la inconsistencia de intervalos:** D-133-B declara que una diferencia <6 pp "no es una
diferencia" (cae en el IC95 a n≈140), pero D-133-D aplica el veto sobre la **estimación puntual**.
O el intervalo importa para ambas cosas, o no importa para ninguna.

Lo que la adjudicación **acierta y conviene conservar**: el rechazo de la taxonomía temática
(`sector_id` murió al 1,8 % acá y fue el error exacto de Is Chile Safe); incluir descartados en el
golden para poder ver el fallo **permanente e invisible** del pre-filtro recall-first; la refutación
pre-registrada; la honestidad estadística de "lo que este golden NO permite afirmar"; y hashear la
**proyección canónica** en vez del `.ts` (hashear el `.ts` daría drift falso por formateo).

## 133-b — DESDE EL 2026-08-07 (necesita la ventana)

El golden set exige **3 días hábiles** de RSS y hoy solo existe **1 día** en R2. Es tiempo de
calendario, no trabajo pendiente: **el RSS no da histórico**. La corrida diaria del conector (5
requests, idempotente, hash-check primero, `[skip]` si no hay novedades) es la que acumula la ventana.

Cuenta real que el premortem corrigió: el día 1 fue **arranque en frío** (la ventana completa de los
5 feeds); con el dedup de D-13, los días 2-3 solo aportan **delta**. Proyección honesta:
**P ∈ [40,75]**, total **∈ [120,155]**. El **piso de 100 sobrevive siempre** (los 80 casos negativos
no dependen de la rotación); el objetivo de 140 es **moneda al aire**. Planificar con el piso.

Ojo con **600 vs 300 chars**: el pre-filtro decide sobre `LIMITE_DESCRIPCION=600` pero la
`entrada_llm` se trunca a 300 ⇒ la justificación puede citar un término **ausente** del input del
clasificador. Resolver el límite **antes** de etiquetar; subirlo después obliga a re-etiquetar todo.

Y `.gitattributes` **NO EXISTE** en el repo: crearlo después de commitear JSON exige
`git add --renormalize`, o el hash se mueve solo en Windows.

---

## Recordatorios de régimen que este carril va a necesitar

- Ingesta en **dos etapas** fuente→R2 content-addressed→Supabase; robots.txt + 2-3 s/host +
  hash-check **antes** de descargar. Nada de re-scrapear "para conseguir muestra".
- Migraciones: `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f`, **jamás**
  `db push`; numerar por `ls supabase/migrations` (0085 es la última aplicada). **0073/0075 escritas
  y NO aplicadas: JAMÁS editarlas.**
- Conteos de verificación por `psql -tA` (PostgREST capa en 1k) **con `| tr -d '\r'`** — el CRLF
  revienta cualquier `test` numérico.
- RPC pública nueva = **aguja completa**. En 133 no debería haber ninguna.
- Backfill masivo = **LOCAL**, jamás GitHub Actions.

## Gotchas pagados en la 132 (no re-pagarlos)

- **`passWithNoTests: true` está activo** ⇒ todo `<automated>` de vitest puede salir 0 **sin correr
  nada**. Los args de `vitest run` son **filtros de nombre, no rutas**. Hay que assertar el
  **conteo impreso** (`Tests N passed`), nunca el exit code solo.
- **`set -e` + un comando que DEBE fallar = verify inalcanzable** (falso rojo). Usar
  `if CMD > log 2>&1; then rc=0; else rc=$?; fi` cuando el fallo es esperado.
- **Proyecto `composite` sin ningún `.ts` = TS18003** (`tsc -b` sale 1). Un paquete nuevo necesita
  su `index.ts` desde la primera tarea.
- **Un control positivo que varía DOS variables no aísla la causa** — el par debe diferir en una.
- **`git diff --name-only` sin base fija siempre pasa** con commits atómicos: usar SHA literal.
- **Cada ronda del checker encontró que el fix de la anterior era él mismo un falso verde o un falso
  rojo. Hicieron falta CINCO rondas. No te apures.**
- El ejecutor de la 132 reportó un criterio incumplido **sin maquillarlo** (`cache.hasToday` quedó
  no-op en producción ⇒ SC2 era falso). Ese es el estándar: **un verde dudoso se reporta, no se
  redacta bonito**.
