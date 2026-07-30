# PROMPT — Preparar el milestone v13.0 y construir su ROADMAP

> **Pegar en una sesión LIMPIA de Claude Code (repo Observatorio), tras `/clear`.**
> Este prompt NO construye producto: construye el **scaffolding del milestone** (PROJECT.md →
> REQUIREMENTS.md → ROADMAP.md con sus fases). La construcción viene después, con su propio prompt
> autónomo que tú generarás al final de esta sesión.

---

## 0. Estado del que partes

**v12.0 está SHIPPED y archivada** (tag `v12.0` = `12e1f79`, pusheado a `Cuchecorp/gov-map`).
`.planning/phases/` está **vacío**; las 13 fases viven en `.planning/milestones/v12.0-phases/`.
`REQUIREMENTS.md` fue **borrado** al archivar (el próximo milestone crea uno fresco). `ROADMAP.md`
quedó colapsado a una línea por milestone.

**Suite base:** `app/` **1590** tests + `tsc --noEmit` 0 + **14/14 guards de régimen (172 tests)**.
Última migración en repo: **`0079`**. Deploy vivo: `0ea5d97f-a172-436e-aad0-add95940ee0e`.

**LEE ESTO PRIMERO, en este orden** — es investigación ya pagada, no la repitas:
1. `.planning/research/v13.0-panel-actualidad-hallazgos.md` — **el objetivo 1 ya está diagnosticado
   con SQL contra PROD.** Trae la raíz del problema, los sujetos reales, 7 ideas de señal nueva con
   su query y filas verificadas, el riesgo de 404 medido, y §6 con lo que NO se pudo verificar.
2. `.planning/research/v13.0-is-chile-safe-ingesta.md` — **el objetivo 2 ya está inventariado** con
   archivo:línea: qué copiar, qué desechar, y los **cuatro huecos de régimen** que ese repo tiene y
   nosotros no podemos heredar.
3. `.planning/milestones/v12.0-MILESTONE-AUDIT.md` — §8.2 es el objetivo 3 (deuda técnica), §9 son
   los 11 gotchas de método que el proyecto pagó, §10 lo que v12.0 no logró.
4. `CLAUDE.md` — reglas LOCKED del proyecto.

---

## 1. Régimen de trabajo de este milestone (decisión del operador, LOCKED)

El operador pidió explícitamente **maximizar calidad en cada decisión**. Eso se traduce en:

### 1.1 Pipeline por fase — completo, sin atajos
```
discuss GRANULAR → research → plan → PREMORTEM → revisión de plan → implementación → validación
```
- **Discusión granular**: nada de auto-aceptar en bloque. Cada área gris se discute; si hay dos
  caminos defendibles, se resuelve con **spike**, no con opinión.
- **Premortem obligatorio** antes de ejecutar: *"asume que esta fase salió mal — ¿por dónde?"*.
- **Revisión de plan doble**: `gsd-plan-checker` (Opus) **y**, para los temas difíciles, un
  revisor con `model: "fable"` invocado por `Agent`. Los blockers se cierran **antes** de ejecutar.
- **Verificación**: `gsd-verifier` (Opus) + `gsd-code-review` (Opus) con su fixer.

### 1.2 Política de modelos — YA CONFIGURADA en `.planning/config.json` (commit `dd27099`)
- **`gsd-executor` → `sonnet`.** Es el **único** downgrade: la implementación la hace Sonnet.
- **Todo lo demás → `opus`**: planner, phase-researcher, pattern-mapper, plan-checker, verifier,
  code-reviewer, code-fixer, debugger, security-auditor, advisor-researcher, assumptions-analyzer.
- **Fable** se reserva para la **revisión difícil de plan** y para dirimir. No va en config: se
  invoca con `Agent(model: "fable")` cuando el tema lo amerite (arquitectura de datos, taxonomía,
  decisiones irreversibles, copy en el carril minado del linter).

### 1.3 Énfasis empírico — spikes y BrowserOS
- **Ante cualquier decisión no obvia: SPIKE.** Código que corre, no razonamiento. El proyecto tiene
  precedente (`/gsd:spike`), y la carpeta `.planning/spikes/`.
- **Validación en BrowserOS obligatoria** para todo lo visual. El objetivo 1 es explícitamente un
  **loop de diseño con Opus mirando BrowserOS** hasta que quede bien — no un "lo implementé y pasó
  el test".
- Ningún criterio de éxito visual puede ser subjetivo: se cierra con **fragmento DOM + captura**.

---

## 2. Los tres objetivos del milestone

### OBJETIVO 1 — El panel de la landing, accionable y atractivo

**El problema, verbatim del operador:** *"actualmente dice x citaciones, x urgencias, no dice cuáles,
no entrega información útil accionable"*.

**Diagnóstico ya hecho** (ver el research; no lo re-descubras):
- `TileSenal` **no importa `Link`, no tiene ningún `href`**. Es la única zona de la home sin salida.
- **`evidencia` jsonb está VACÍA en la DB** para las 6 señales temporales: el proc
  `materializar_senales()` nunca la puebla, pese a que `0065:47-49` lo promete. ⇒ **Hacerlo
  accionable NO es un cambio de UI: exige tocar el materializador.**
- La clave `unique (tipo_senal, cobertura_camara, ventana, cluster_id)` **impide emitir una fila por
  sujeto** sin DDL. Hay dos caminos (Opción A poblar `evidencia`, sin cambio de allowlist; Opción B
  RPC de detalle nueva, con aguja completa) — **esa elección es una decisión de arquitectura y
  merece su spike y su revisión Fable.**

**La riqueza latente está medida y verificada** (§4 del research): las 95 urgencias esconden que
**5 proyectos están en discusión inmediata**; la sesión de Cámara del lunes tiene **20+ proyectos con
boletín, título, quórum y urgencia** y hoy se muestra como "1 sesiones de sala próximas"; hay **166
votaciones en 30 días completamente ausentes** del panel; y el cruce urgencia↔citación da **6
proyectos con urgencia del Ejecutivo agendados esta semana**, con sujetos reales verificados.

**Tres defectos de presentación ya identificados que hay que cerrar:** el tile `agrupacion_materia`
renderiza **10 ítems idénticos que dicen `(sin materia)`** (`proyecto.materia` = 0/3.675 filas);
**dos grafías de cámara** visibles al ciudadano en el mismo panel (= fila `4-15` / defecto D2 de la
deuda de v12.0, fix en el materializador **no** en el cliente); y el footer dice `"datos al {fecha}"`
también para fechas **futuras**, mezclando semánticas opuestas.

**El operador pidió "análisis detallado de qué podría ser interesante".** El research trae 7 ideas
(L1-L7) con su query y filas reales, y dice explícitamente qué **NO** es construible hoy. Ese
análisis hay que **profundizarlo con criterio editorial**: ¿qué querría saber un ciudadano o un
periodista al llegar? Considera involucrar un agente con perspectiva de producto/periodismo, y
**cierra la decisión con el operador** — el diseño de qué se muestra en la portada es su llamada.

**Restricciones duras:** el riesgo de 404 está **medido** (10 de 49 boletines de agenda futura no
existen en `proyecto`; los 148 de tramitación están 148/148) ⇒ **todo link de agenda necesita guard
de existencia**. El linter anti-insinuación tiene un carril PANEL propio con términos prohibidos
(`exprés`, `revivido`, `los más`, `la cámara más activa`, …) y **`señal` está prohibida en copy**;
todo archivo nuevo del rediseño **se registra en `SUPERFICIES_PANEL` en Wave-0, ANTES de escribir el
copy**. Tres idioms que el panel necesita **ya están aprobados**: `Citado el 20 jul 2026`,
`Urgencia Suma vigente desde el 10 mar 2026`, `En tabla de sala de la Cámara del 15 jul 2026`.

### OBJETIVO 2 — Crons de noticias vinculadas a proyectos y parlamentarios

Replicar el enfoque de `Is Chile Safe` **reimplementado en TS/Deno + Supabase** (ese repo es Python
+ JSON en git: **no es un port**).

**Lo que se copia es el contrato anti-alucinación de tres piezas**: el LLM emite un **nombre de una
lista cerrada inyectada en el prompt** (jamás un id) → un **resolver determinista offline** lo mapea
a la fila y devuelve `null` ante ambigüedad → **`null` en cualquier eslabón descarta el registro a
dead-letter con su `rejection_stage`**. Para nosotros: boletín (3.675 en `proyecto`) y parlamentario
(186). Más: `temperature=0`, umbral de confianza, fail-loud si la allow-list está vacía, gate de
validación all-or-nothing que preserva el último estado bueno, y **threshold pre-registrado y
CONGELADO antes de medir** (para no caer en la circularidad que el golden set existe para prevenir).

**Fuentes: 100% RSS**, sin scraping de HTML — 4 medios directos + Google News RSS Search con queries
`hl=es-419&gl=CL&ceid=CL:es-419` y `when:Nd`. El outlet real sale del tag `<source>`.

**Los cuatro huecos de régimen que ese repo tiene y NOSOTROS NO PODEMOS HEREDAR:**
1. **`robots.txt` NO se consulta ahí** (0 hits en el grep) pese a que su CLAUDE.md lo declara.
   Nuestro CLAUDE.md lo **exige** ⇒ implementarlo, primero.
2. **Sin delay entre feeds** (9 requests en ráfaga). Nuestro régimen: **2-3 s/host**.
3. **El RSS crudo no se guarda** (se parsea en memoria y se descarta). Nuestra regla LOCKED es
   **dos etapas fuente→R2 crudo content-addressed→Supabase**.
4. Content-addressing incompleto (la key es por id de URL, no por hash).

**Dos lecciones que ese repo pagó y hay que heredar:** su **golden set tiene etiquetas malas** — el
techo de 65,9 % en *family accuracy* es "parcialmente un problema de labels, no de modelo" ⇒ **si
copiamos la metodología, el golden set se arregla PRIMERO**. Y *"production incidents store only
processed output … can't serve as re-runnable golden inputs"* ⇒ **guardar el input crudo que el LLM
vio**, no solo lo que emitió.

**Nuestro `extraerBoletines` ya existe y es context-gated fail-closed** (regla LOCKED de la Phase 92,
riesgo #1): sufijo `-NN` inequívoco, o base pelada **solo** tras gatillo `boletín`/`bol.` a ≤3
tokens; jamás keywords ⇒ `"Ley 20.730"`, `"año 2024"`, `"$14.309"` devuelven `[]`. **Reusarlo, no
reescribirlo.**

**Restricción legal a replicar:** el texto completo de artículos vive **solo** en el bucket privado
del operador; público, solo la cita. Y el vínculo noticia↔proyecto/parlamentario debe **enlazar a
nuestras fichas** de forma útil, que es el punto del objetivo.

**Decisiones abiertas que merecen spike:** qué taxonomía legislativa congelar (no existe hoy); qué
modelo y proveedor (el proyecto ya tiene `TieredProvider` y el veredicto full-40 de v11.0: **solo
clasificación fue APPROVED para Granite**, extracción **VETADA** por es-CL); si el vínculo
noticia→parlamentario cruza el carril PII (`parlamentario` está en `PII_TABLES`).

### OBJETIVO 3 — Cerrar la deuda técnica de v12.0

De `.planning/milestones/v12.0-MILESTONE-AUDIT.md` §8.2. Prioridad por daño al lector:

| ítem | qué | nota |
|---|---|---|
| **`B-01`** 🔴 | **el sitio muestra un número falso**: `Ver detalle (1000)` donde son **3.752** votos, en **71 de 186 fichas**, y la RPC ordena `fecha desc` ⇒ además **distorsiona la composición** del desglose | RPC de conteo dedicada **aditiva** con aguja completa + cambio **simultáneo** de chip y `VotosSection`. **Un clamp de seguridad NO es un fix de exactitud** |
| `4-15` | dos grafías de cámara en la landing (defecto D2 de `0065:233,261`) | **converge con el objetivo 1** |
| `B-02` | tile *Por materia* agrupa 3.100/3.675 (84,4 %) sin declarar denominador | **converge con el objetivo 1**. Firma **v2 paralela** (precedente `0060`), jamás alterar la viva (`42P13`) |
| `B-03` | falta aserción de guard para `create view` en `public` sin `security_invoker` | hoy **cero vacuo** (0 vistas) ⇒ **debe existir ANTES de la primera vista** |
| `H-01` | error boundary transitorio en `/comparar` tras hidratación | exige re-deploy para verificar |
| `H-06` | 85 `Hito del` vs 99 eventos en `14309-04` | escribir la query que gobierna la **regla de selección** del timeline |
| `3.3` | co-autoría de `/comparar` truncada a 20 | rediseñar la RPC para emitir membresía de par |

**Fuera de alcance de agente** (deuda de operador, ver §8.1 del audit): `OFF-01` y `OFF-6-03`
(exigen identidad `supabase_admin`; `0073`/`0075` están **escritas y NO aplicadas** y **jamás se
editan** — un futuro fix va como `0080`), `OP-1` (probe REST con anon key, 3 requests, **gatea la
severidad de `OFF-6-01`**), `OP-4` (destino de `pgtap` en `public`, destructivo).

---

## 3. Lo que tienes que producir en ESTA sesión

1. **Actualizar `PROJECT.md`** con los objetivos de v13.0 (la sección "Next Milestone Goals" ya
   quedó preparada al archivar).
2. **Correr `/gsd:new-milestone`** para v13.0 — pasa por su discusión, su research (apóyate en lo ya
   pagado: **no repitas** el análisis del panel ni el de Is Chile Safe) y su generación de
   `REQUIREMENTS.md`.
3. **Construir el `ROADMAP.md` de v13.0**, con fases numeradas desde **126**. Sugerencia de
   secuenciación, a validar en la discusión:
   - **Carril rector primero**: análisis editorial de qué mostrar en el panel + la decisión de
     arquitectura Opción A vs B (spike + revisión Fable). Es load-bearing para todo el objetivo 1.
   - **Wave-0 de guards** antes de cualquier copy nuevo (`SUPERFICIES_PANEL`, `NEGACIONES_LOCKED`,
     y `B-03` que debe existir antes de la primera vista).
   - **Objetivo 1** en fases de: materializador (poblar sujetos) → RPC/contrato → UI con links →
     **loop de diseño BrowserOS** → verificación DOM.
   - **Objetivo 2** en fases de: spike de fuentes+robots → taxonomía congelada + golden set
     (arreglado **antes** de medir) → conector dos-etapas → resolver anti-alucinación → clasificador
     con evals → cron → vínculo a fichas.
   - **Objetivo 3** intercalado donde converge (`4-15` y `B-02` con el objetivo 1; `B-01` como fase
     propia por su tamaño).
   - **E2E de cierre** con deploy agrupado y pasada BrowserOS.
4. **Decidir explícitamente y dejar escrito**: si se activan **worktrees**
   (`workflow.use_worktrees` en `.planning/config.json` está en `false`). El gotcha #11 de v12.0 dice que en waves paralelas sobre un mismo
   checkout **`git commit --amend` es inseguro y los commits atómicos por plan no están
   garantizados** — dos executors se pisaron el índice. Pero v8.0 documentó problemas de `rmdir` de
   worktrees en Windows. ⇒ **Es exactamente el tipo de decisión que merece un spike.**
5. **Generar `.planning/PROMPT-v13.0-build-autonomo.md`** — el prompt de construcción, en pasadas
   con `/clear` entre ellas (patrón que cerró v6.x-v12.0), con: contexto rector por pasada, gotchas
   ya pagados, checkpoints de operador previstos, y el régimen de modelos de §1.2.

---

## 4. Reglas LOCKED que ninguna fase puede violar

- **Identidad fail-closed**: name-match JAMÁS para votos ni RUT. **RUT jamás cruza a un LLM.**
- **Anti-insinuación**: linter verde; **extender el guard ANTES del copy** (patrón Wave-0). Copy sin
  causalidad ni intención. `"captura"` pelado PROHIBIDO; idiom `"según fuente al …"`. **`"señal"`
  prohibida en copy ciudadano.** Anti-ranking (`"los más"`, `"la cámara más activa"` prohibidos).
- **Fechas**: `fecha_captura` JAMÁS es el hecho (44.847 eventos comparten `2026-07-10` por backfill).
  `citacion.fecha`/`sesion_sala.fecha` son **date-only medianoche UTC = día chileno**: comparar
  `fecha::date >= current_date` **sin** `at time zone`; convertir correría el día hacia atrás.
- **Migraciones** por `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f`,
  **JAMÁS `supabase db push`**. Numeración por `ls supabase/migrations` (**no** por
  `schema_migrations`, que tiene un hueco de 15). Pre-checks **y post-checks** fail-closed: un
  `REVOKE` sobre objetos ajenos **no falla, no-opea con `WARNING 01006`**.
- **RPC pública nueva = aguja completa**: cero-grant (`>0044`), secdef PII-safe con `search_path=''`,
  `statement_timeout`, `LIMIT` explícito (**piso 1.000**), doble-revoke, alta en
  `PUBLIC_RPC_ALLOWLIST`, pgTAP contra el **schema aplicado**.
- **Dos etapas** fuente→R2 content-addressed→Supabase. **Rate-limit 2-3 s/host, UA identificatorio,
  robots.txt.** Hash-check antes de descargar. **Jamás ráfagas.**
- **Flags `*_PUBLIC_ENABLED`**: un agente **NUNCA** los flipea (MONEY/NOTIF/VSIM/NET/CRUCES).
  Encender `VSIM` exige **sign-off legal humano**.
- **PostgREST capa a 1.000 filas** ⇒ conteos por `psql -tA`, **jamás por REST**.
- **Cero PII** en artefactos. Jamás ecoar ni escribir el valor de `SUPABASE_DB_URL`.
- **Un vacío honesto vale más que un número inventado.** Cero filas se presenta como cero con su
  causa, **nunca** se rellena ni se oculta. Un cero necesita denominador, y **cero fuerte ≠ cero
  vacuo**.
- **Cero aprobados por silencio**: un ítem de juicio humano solo se aprueba con respuesta **verbatim**
  del operador; la ausencia produce handoff documentado, jamás PASS.

---

## 5. Gotchas de instrumento — te van a morder si no los sabes

Están completos en `.planning/milestones/v12.0-MILESTONE-AUDIT.md` §9 y en la memoria
`v12-gotchas-metodo`. Los que más importan aquí:

- **`vitest run lib/*guard*.test.ts` sale con exit 0 SIN correr nada** (bash no expande el glob).
  Los guards se corren **por nombre explícito**.
- **`grep -c` topa en 1** sobre el HTML del Worker (una sola línea de 1,24 MB) ⇒ `grep -o … | wc -l`.
  **`grep -i` + `-F` devuelve 0 SIEMPRE** en GNU grep 3.0 (Git Bash). **`pipefail` + `grep -q` da
  exit 141** por SIGPIPE.
- **`psql -tA` emite CRLF** ⇒ todo pipe `psql | comm` da resultados silenciosamente falsos y
  `sort -c` **no** protege. Usar `tr -d '\r'`.
- **React intercala `<!-- -->`** entre texto y dígitos: un literal pelado como `Ver detalle (1000)`
  **nunca matchea**. Medir por offset + extracción numérica. Igual `Votada el{" "}`.
- **Suspense esconde el contenido real** en `<div hidden id="S:N">`; `get_page_content`/`innerText`
  son **ciegos** a él (645 B vs 914.556 en `textContent`).
- **`bros-cli` imprime `CDP request timeout` y sale con 0** ⇒ un retry `cmd || …` nunca dispara y se
  pierden capturas en silencio. Screenshots en ráfaga tumban el MCP (sleep 8-10 s).
- **Todo control de ausencia necesita un control positivo apareado** que demuestre que el instrumento
  sabría dar positivo. Un control que ya daba 0 antes del cambio es **inerte**.

---

## 6. Contexto operativo

- **Sitio PROD**: https://observatorio-congreso.thevalis.workers.dev — deploy vivo
  `0ea5d97f-a172-436e-aad0-add95940ee0e`. Supabase ref `bctyygbmqcvizyplktuw` (sa-east-1, pooler IPv4).
- **Deploy**: build OpenNext en **Docker `node:22-slim`** (en Windows el worker sale roto); robocopy
  a `C:/Temp/obs-build` purgando `.pnpm-store` **y re-escribiendo los helper scripts tras el mirror**
  (`/MIR` los borra); **wrangler global de AppData con OAuth** (el real está **sombreado por un
  paquete Python**); `MSYS_NO_PATHCONV=1`; propagación 10-30 s (500 intermitentes en la ventana **no**
  son fallo).
- **BrowserOS**: MCP `http://127.0.0.1:9200/mcp`, wrapper `scripts/bros-cli.mjs`. Gates interactivos
  que un subagente no pueda cerrar **los cierra el orquestador**.
- **Queries a PROD**: `set -a; source .env; set +a` + `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "…"`.
- **Emisores huérfanos confirmados** (sin call-site; no los busques en el DOM, se registran):
  `E-029 ResumenView`, `E-003`, `E-008 actualidad-module.tsx`, empty-state de `E-053`.
- **Estado de flags en PROD: NO verificado** (no están en `.env` ni en `wrangler.jsonc`; se inyectan
  en el entorno Cloudflare). Por semántica `=== "true"`, ausente ⇒ OFF. **Pregúntalo, no lo infieras.**
- **Deuda de operador viva** de milestones anteriores: CF secrets + `GEMINI`, identidad local,
  RUT-01 + backfills, flip MONEY (legal), provisión NOTIF, rotación B26. Más `OP-1`..`OP-4` de v12.0.

---

## 7. Cómo arrancar

```
/gsd:new-milestone
```

Y si prefieres empezar por la discusión editorial del panel antes de fijar requisitos —que es
defendible, porque el objetivo 1 es el que más depende de criterio— dilo y arranca por ahí, pero
**deja el `new-milestone` corrido antes de escribir el ROADMAP**.
