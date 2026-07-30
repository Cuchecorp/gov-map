# PROMPT — Construcción autónoma v13.0 (Portada accionable + noticias vinculadas + cierre de deuda)

> **Uso:** pegar la pasada que corresponda en una sesión LIMPIA (tras `/clear`), repo Observatorio.
> Roadmap: fases **126-138** en `.planning/ROADMAP.md` (commit `37a8ed4`). Requirements: 20 REQ-IDs.
> El scaffolding YA está corrido: PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, spikes commiteados.
> **Corre siempre autónomo** dentro de cada pasada; los checkpoints de operador listados abajo son los
> únicos puntos donde se exige respuesta verbatim (cero aprobados por silencio — ausencia = handoff
> documentado, jamás PASS).

---

## Régimen (LOCKED, ya configurado — no re-decidir)

- **Pipeline por fase:** `/gsd:discuss-phase N` GRANULAR (nada de auto-aceptar en bloque) → research →
  `/gsd:plan-phase N` → **PREMORTEM** ("asume que esta fase salió mal — ¿por dónde?") → plan-checker
  (Opus) **y revisor `Agent(model: "fable")` para los temas difíciles** (blockers se cierran ANTES de
  ejecutar) → `/gsd:execute-phase N` → verifier + code-review (Opus) con fixer.
- **Modelos** (`config.json`, `dd27099`): executor=sonnet (único downgrade); todo lo demás Opus.
  **Fable via `Agent(model:"fable")`** al menos en: 127 (forma final del jsonb + migración 0080),
  130 (diseño RPC conteo), 133 (taxonomía a congelar), 134 (resolver/contrato), 137 (carril PII).
- **Worktrees ON** (`use_worktrees: true`, spike 2026-07-30): gotcha #11 reproducido al 100% — jamás
  volver a waves paralelas en un checkout compartido. Precondiciones YA aplicadas: `core.longpaths=true`
  (repo-local, los worktrees la heredan) + `allowBuilds` fixeado (`8f37c7e`). Si un worktree falla con
  "Filename too long", verificar `git config core.longpaths` antes de culpar otra cosa.
- **Decisiones adjudicadas que NO se re-abren:** Opción A (evidencia jsonb en materializador, spike);
  tile materia MUERE (`sector_id` 1,8%); VSIM ON con sign-off legal dado verbatim 2026-07-30 (memoria
  `vsim-signoff-legal-2026-07-30`) — L4 se construye directa, cero flip requerido.
- **Spikes ante toda decisión no obvia** (`.planning/spikes/`); validación visual SIEMPRE BrowserOS
  con fragmento DOM + captura.

## Reglas LOCKED que ninguna fase puede violar (resumen — el detalle vive en `PROMPT-v13.0-preparar-roadmap.md` §4)

Identidad fail-closed (name-match jamás para votos/RUT; RUT jamás a un LLM) · anti-insinuación
(guard ANTES del copy; `señal`/`exprés`/`los más`/`captura` pelado prohibidos; idiom `según fuente al …`)
· fechas date-only sin `at time zone` (`fecha::date >= current_date`); `fecha_captura` jamás el hecho ·
migraciones por `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f`, jamás
`db push`; numeración por `ls supabase/migrations` (0079 última; **0080 reservada a la Phase 127**);
`0073`/`0075` JAMÁS se editan · RPC pública nueva = aguja completa (cero-grant, secdef `search_path=''`,
`statement_timeout`, LIMIT piso 1.000, doble-revoke, `PUBLIC_RPC_ALLOWLIST`, pgTAP contra schema
aplicado) · dos etapas fuente→R2 content-addressed→Supabase, robots.txt + 2-3 s/host + hash-check ·
flags: un agente JAMÁS flipea `*_PUBLIC_ENABLED` (estado verificado 2026-07-30: VSIM/NET/CRUCES ON,
MONEY/NOTIF OFF — se quedan así) · PostgREST capa 1k ⇒ conteos por `psql -tA` · cero PII en artefactos;
jamás ecoar `SUPABASE_DB_URL` · vacío honesto > número inventado; cero necesita denominador; cero
fuerte ≠ cero vacuo · cero aprobados por silencio.

## Gotchas de instrumento (pagados — te muerden si no los sabes)

Los 11 de v12.0 (`milestones/v12.0-MILESTONE-AUDIT.md` §9, memoria `v12-gotchas-metodo`) más los
nuevos pagados en los spikes de preparación:

- `vitest run lib/*guard*.test.ts` sale 0 SIN correr nada (glob) ⇒ guards por nombre explícito.
- HTML del Worker = 1 línea (1,2-7,8 MB) ⇒ `grep -o … | wc -l`; `grep -i`+`-F`=0 siempre;
  `pipefail`+`grep -q`=141; `psql -tA` emite CRLF ⇒ `tr -d '\r'`.
- React intercala `<!-- -->` entre texto y dígitos ⇒ literales con números no matchean (offset +
  extracción numérica). Suspense esconde en `<div hidden id="S:N">` ⇒ `textContent`, jamás `innerText`.
- 🆕 Los conteos "2" en grep del HTML del Worker = HTML + payload RSC serializado — no es duplicación
  de UI; cuadrar por contexto.
- 🆕 Un patrón grep con `.` por byte NO matchea `ó` multibyte — cuidado con tildes en marcadores DOM.
- `bros-cli` imprime `CDP request timeout` y sale 0 ⇒ verificar que la captura EXISTE y pesa >0;
  sleep 8-10 s entre screenshots. 🆕 `save_screenshot` resuelve paths relativos contra el cwd de
  BrowserOS (pasar SIEMPRE path absoluto); el tool `scroll` puede no mover la página ⇒ scrollear vía
  `evaluate_script`.
- Todo control de ausencia necesita control positivo apareado; un control que ya daba 0 antes es inerte.
- Clamp de seguridad ≠ fix de exactitud (B-01 existe por esto).
- Deploy: build OpenNext en Docker `node:22-slim`, robocopy a `C:/Temp/obs-build` purgando
  `.pnpm-store` y re-escribiendo helper scripts tras `/MIR`; wrangler global AppData (el real está
  sombreado por un paquete Python); `MSYS_NO_PATHCONV=1`; 500s en ventana de propagación 10-30 s no
  son fallo.

## Checkpoints de operador previstos (los ÚNICOS bloqueos aceptados)

| Fase | Qué se le pregunta | Forma |
|---|---|---|
| 128 (discuss) | Ratificación VERBATIM de O-1..O-7 (`spikes/v13.0-editorial-portada.md`) — el diseño de portada es su llamada; hay recomendación por decisión | respuesta verbatim; ausencia ⇒ handoff |
| 129 (cierre loop) | Veredicto "queda bien" del panel sobre capturas del deploy real | verbatim |
| 133 | Spot-check de etiquetas del golden set (muestra aleatoria) antes de congelar por hash | verbatim |
| 137/138 | Nada nuevo — MONEY/NOTIF siguen OFF; VSIM ya autorizado | — |

Deuda de operador viva (NO tocar, solo no romper): `OP-1`..`OP-4`, `OFF-01`, `OFF-6-03`, CF secrets +
GEMINI, identidad local, RUT-01, flip MONEY, provisión NOTIF, rotación B26.

---

## PASADA 1 — Panel accionable + deuda de ficha (Phases 126-131)

Pegar tras `/clear`:

> Retoma v13.0 (Observatorio). Lee `.planning/STATE.md`, `.planning/ROADMAP.md`,
> `.planning/REQUIREMENTS.md`, y los spikes `v13.0-spike-panel-arquitectura.md` +
> `v13.0-editorial-portada.md` + `v13.0-spike-flags-y-datos.md`. Ejecuta las fases **126 → 131** con
> el pipeline completo por fase (discuss granular → research → plan → premortem → plan-checker Opus +
> revisor Fable donde el roadmap lo pide → execute (sonnet) → verify + code-review Opus). **Orden:**
> 126 primero (Wave-0, rector). Después 127→128→129 en serie; **130 y 131 en paralelo** con el carril
> panel vía worktrees (dependen solo de 126). La decisión Opción A NO se re-abre. Checkpoints de
> operador: ratificación O-1..O-7 en la discusión de 128 y veredicto de cierre del loop en 129 —
> respuesta verbatim o handoff. El loop de 129 deploya lo necesario para mirar el sitio real por
> BrowserOS. Siempre autónomo fuera de esos dos checkpoints.

**Contexto rector de la pasada:** el panel hoy no emite ni un `href` y `evidencia` está vacía — el
trabajo empieza en la DB (0080), no en la UI. El "queda bien" visual se arbitra con Opus mirando
BrowserOS contra el baseline `spikes/assets/v13-baseline-*.png`. `agenda_citacion` = 23/23 Senado
(asimetría se declara); la "sesión" de Cámara es fila sintética semanal (`camara:sesion:2026-W31`);
urgencias se cuentan por boletín y grado, jamás "95" pelado; votos confirmados = 283.550.

## PASADA 2 — Pipeline de noticias (Phases 132-136)

Pegar tras `/clear`:

> Retoma v13.0 (Observatorio). Lee `.planning/STATE.md`, `.planning/ROADMAP.md`,
> `.planning/REQUIREMENTS.md` y `.planning/research/v13.0-is-chile-safe-ingesta.md` (inventario
> completo con archivo:línea — no re-leas el repo Python salvo duda puntual). Ejecuta las fases
> **132 → 136 en serie** (cada una depende de la anterior) con el pipeline completo por fase y
> revisor Fable en 133 (taxonomía) y 134 (contrato anti-alucinación). Checkpoint de operador: 
> spot-check de etiquetas del golden set en 133 antes de congelar. Siempre autónomo fuera de eso.

**Contexto rector de la pasada:** se copia el DISEÑO de Is Chile Safe, jamás sus 4 huecos (robots.txt
no consultado, ráfagas, RSS crudo no guardado, key por URL-id). El golden set se arregla ANTES de
medir (su techo 65,9% era de labels). Thresholds pre-registrados y CONGELADOS antes de la primera
medición. `extraerBoletines` SE REUSA (context-gated fail-closed, Phase 92) — diff cero. Modelo por
benchmark sobre TieredProvider respetando v11.0: Granite APPROVED solo clasificación, extracción
VETADA es-CL. El texto completo de artículos va SOLO al bucket privado del operador. Dead-letter y
seen-ledger = tablas Supabase, jamás JSON en el repo. URL vista ANTES de todo reject path.

## PASADA 3 — Fichas + cierre E2E (Phases 137-138 + audit)

Pegar tras `/clear`:

> Retoma v13.0 (Observatorio). Lee `.planning/STATE.md`, `.planning/ROADMAP.md`,
> `.planning/REQUIREMENTS.md`. Ejecuta **137 → 138** con el pipeline completo (revisor Fable en 137
> por el carril PII de `parlamentario`). 138 = deploy agrupado + pasada BrowserOS final con fragmento
> DOM + captura por superficie, flags no autorizados verificados intactos con control positivo
> apareado, y conteos cuadrados por `psql -tA`. Al terminar, corre `/gsd:audit-milestone`; presenta
> el resultado al operador y NO archives sin su respuesta verbatim (`/gsd:complete-milestone` solo
> tras su OK). Siempre autónomo hasta ese punto.

**Contexto rector de la pasada:** NEWS-07 es el punto del objetivo 2 — noticias enlazando a NUESTRAS
fichas de forma útil. PII: lectura solo por chokepoint/RPC sancionado; el guard CI escanea `app/` por
`.from` de tablas PII. Recordar el gotcha de `complete-milestone`: archiva los archivos ACTUALES
(solo el milestone en curso) y merge-no-rebase para preservar el tag.
