# PROMPT — Continuación autónoma v13.0 (Pasadas 2 y 3 + Phase 139)

> **Uso:** pegar UNA pasada por sesión LIMPIA (tras `/clear`), repo Observatorio.
> Reemplaza a `PROMPT-v13.0-build-autonomo.md` para todo lo que queda: ese documento sigue siendo
> válido como referencia de régimen, pero **este manda** donde difieran (fue escrito antes de la
> Pasada 1 y varias de sus premisas resultaron falsas en ejecución — ver §Correcciones).

---

## Régimen de modelos (LOCKED por el operador, 2026-08-05)

| Rol | Modelo | Cómo se invoca |
|---|---|---|
| **Decisiones** — discuss-phase, adjudicación de gray areas, forma de un contrato/schema, taxonomías, elección de diseño | **Fable** | `Agent(model: "fable")`, o `subagent_type` GSD con `model: "fable"` |
| **Ejecución** — escribir código, correr comandos, aplicar fixes | **Sonnet** | `gsd-executor` / `gsd-code-fixer` con `model: "sonnet"` (ya es el default de `config.json`) |
| **Validación** — plan-checker, premortem, verifier, code-review, diseño de spikes | **Opus** | `gsd-plan-checker`, `gsd-verifier`, `gsd-code-reviewer` con `model: "opus"` |

**Reglas del reparto:**
- Fable **decide**, no ejecuta ni se valida a sí mismo. Su salida entra al plan como decisión LOCKED
  con su razón escrita.
- Sonnet **ejecuta**, no decide. Si durante la ejecución aparece una decisión no prevista, **para y
  escala** — no improvisa. Un ejecutor que adjudica es la vía más corta a deuda silenciosa.
- Opus **valida y desconfía**. Nunca valida un plan que él mismo escribió.
- **Spikes**: si una decisión no es obvia, Opus **diseña** el spike (qué se mide, cuál es el
  resultado que refutaría la hipótesis), Sonnet lo **corre**, Fable **adjudica** con el resultado.
  Un spike sin criterio de refutación escrito de antemano no es un spike, es una demo.

## Pipeline por fase (granular — nada se auto-acepta en bloque)

```
/gsd:discuss-phase N   (Fable adjudica las gray areas, una por una)
   → research
   → /gsd:plan-phase N
   → PREMORTEM (Opus): "son 3 h después, esta fase fracasó — ¿por dónde?"
      · verificar contra el repo y contra PROD que las premisas del plan son CIERTAS
   → plan-checker (Opus) — rondas hasta PASS, sin techo de rondas
      · en la Pasada 1 hicieron falta CUATRO, y cada ronda encontró que el fix de
        la anterior era él mismo un falso verde. No te apures acá.
   → /gsd:execute-phase N   (Sonnet ejecuta; olas secuenciales salvo independencia probada)
   → verifier (Opus) + code-review (Opus) + fixer (Sonnet)
   → si el code-review encuentra blockers: fix → RE-DEPLOY → RE-CAPTURA. Las capturas
     que le muestres al operador tienen que ser POSTERIORES al último deploy.
```

**La pregunta que hay que hacerle a cada `<acceptance_criteria>`, siempre:**
> *¿este comando puede salir 0 sin haber probado nada?*

Si la respuesta no es un no rotundo con la razón escrita, el criterio no sirve. Y para cada test
nuevo: **mutar el código y comprobar que el test cae.** Es el único modo de saber que no es vacuo.

---

## Estado real de entrada (verificado 2026-08-04)

- **Pasada 1 (126-131) CERRADA.** Migraciones 0080-0083 en PROD, **INTOCABLES**.
- **PROD**: `8e0f403e-5806-411c-8289-ec416924058c` en `observatorio-congreso.thevalis.workers.dev`.
  Es el primer deploy del milestone. Suite **1799** verde, `pnpm guards` 0.
- **Phase 129 cerrada SIN cumplir su SC1** (veredicto de operador negativo). Su deuda de diseño vive
  en la **Phase 139 (PANEL-DASH)**, con los criterios ya escritos en `ROADMAP.md`.
- Pendiente: **Pasada 2** = fases 132-136 · **Pasada 3** = 137-138 · **Phase 139** después.

## Correcciones a `PROMPT-v13.0-build-autonomo.md` (premisas que resultaron FALSAS)

1. **El deploy NO se hace desde el host.** No hay `CLOUDFLARE_API_TOKEN` en `.env` ni `~/.wrangler`.
   El OAuth vive en `C:/Users/Carlo/AppData/Roaming/xdg.config/.wrangler/`. El deploy que funciona
   ocurre **DENTRO del contenedor**, montando ese directorio:
   `-v "…\xdg.config\.wrangler:/root/.config/.wrangler"`, con `XDG_CONFIG_HOME=/root/.config`,
   `WRANGLER_HOME=/root/.config/.wrangler`, y `cd /work/app && CI=true pnpm run deploy`.
   Cualquier `wrangler` corrido desde el host necesita `XDG_CONFIG_HOME=…/xdg.config MSYS_NO_PATHCONV=1`.
2. **`robocopy /MIR` con `/XD` NO purga lo excluido** — lo ignora. El mirror `C:/Temp/obs-build` hay
   que purgarlo explícitamente **en PowerShell** (`node_modules`, `.pnpm-store`, `app/.open-next`)
   antes de cada build, o se deploya un bundle viejo con éxito aparente.
3. **`.open-next/worker.js` es un shim de ~2 KB.** El código de la app vive en
   `.open-next/server-functions/default/`. Cualquier grep de verificación contra `worker.js` da 0
   siempre. **Y los nombres de chunk de Turbopack NO son hashes de contenido fiables**: un chunk
   puede conservar su nombre exacto y haber cambiado por dentro. Para probar que un deploy llevó
   código nuevo: `BUILD_ID` servido == `BUILD_ID` recién construido, más un literal nuevo presente
   en `server-functions/` que **no estaba antes** (medido y registrado ANTES de purgar el mirror).
4. **El truco del iframe a 390px está MUERTO.** La CSP (`frame-ancestors 'none'` + `X-Frame-Options:
   DENY`, lockdown SEC-02) lo bloquea, y `save_screenshot` **sale bien igual** produciendo un PNG en
   blanco que pasa `test -s`. **BrowserOS no tiene control de viewport** — cinco vías medidas y
   descartadas (`create_window` nace maximizada, `resizeTo` no-op, `window.open` bloqueado, sin
   puerto CDP, Chromium topa en 770px de ancho mínimo). **La CSP no se toca** (decisión del
   operador). Deuda abierta: conseguir otro instrumento (Playwright/CDP). Mientras tanto, toda
   captura móvil lleva la salvedad **"NO es del deploy real"** y el `href` es el discriminador, no
   la narración del agente.
5. **`evaluate_script` usa el parámetro `expression`, no `script`.** Y pasar JSON con comillas por
   Git Bash a `bros-cli call` rompe (`Unterminated string in JSON`) ⇒ escribir el JSON a un archivo
   del scratchpad y usar `"$(cat args.json)"`.
6. **El DPR de este entorno es 1,25**, no 1. Verificar el ancho real de todo PNG con
   `file X.png | grep -oE '[0-9]+ x [0-9]+'` — nunca confiar en el rótulo.

## Decisiones de operador vigentes (no re-abrir)

- **#34 — enmienda AUTORIZADA (2026-08-04).** Un eje de `/comparar` que falla debe declarar estado
  `fallo` (**distinto de `vacío`**) en vez de tumbar la página entera, e incluir un `error.tsx`
  propio de la ruta (hoy el usuario lee *"No pudimos cargar la portada"* estando en `/comparar`).
  Al implementarlo, **actualizar el comentario del contrato en `app/app/comparar/page.tsx:74-76`**
  citando esta autorización, para que no se lea como una violación. El espíritu de #34 se conserva:
  un fallo DECLARADO no es una afirmación de ausencia.
- **Sin foto y sin partido es decisión LEGAL, no técnica** (`DIAGNOSTICO-govmap-2026-07-02.md:89`,
  repetida como criterio de aceptación en todos los ROADMAP v5→v11). Ningún rediseño puede usar
  retratos de parlamentarios. En la Phase 139, "imágenes" significa **datos hechos visual**
  (barras de votación, distribución por cámara, secuencia de tramitación), nunca decoración.
- **Rotación B26 diferida** por el operador. El project-ref sigue en 49 archivos tracked; no
  barrerlos salvo que el operador lo pida. **Ojo de método:** en la Pasada 1 el secreto se
  reintrodujo **dos veces al documentar su propia redacción**, en archivos que el criterio de cierre
  no miraba. Parametrizar siempre, jamás transcribir.
- **Flags:** un agente JAMÁS flipea `*_PUBLIC_ENABLED`. Estado: VSIM/NET/CRUCES ON, MONEY/NOTIF OFF.

## Checkpoints de operador (los ÚNICOS bloqueos aceptados)

Cero aprobados por silencio. Ausencia de verbatim = **handoff documentado, jamás PASS**. Un "ok" a
otra pregunta no es aprobación. Si el operador da un veredicto **negativo**, eso NO es una fase
fallida: es una decisión de alcance — regístrala como tal y no la maquilles como PASS.

- **Pasada 2:** golden set de la Phase 133 (la vara se congela ANTES de medir).
- **Pasada 3:** pasada BrowserOS final de la Phase 138.
- **Phase 139:** veredicto visual sobre capturas del deploy real.

---

# ▶ PASADA 2 — Fases 132-136 (carril NEWS)

Retoma v13.0. La Pasada 1 (126-131) está cerrada; lee primero
`.planning/phases/129-*/.continue-here.md` para el estado exacto y la deuda viva.

Ejecuta las fases **132, 133, 134, 135 y 136** con el pipeline completo y el reparto de modelos de
arriba: **Fable decide, Sonnet ejecuta, Opus valida / hace premortem / diseña los spikes.**

Fable adjudica al menos: la **taxonomía a congelar (133)** y el **contrato del resolver
anti-alucinación (134)** — son las dos decisiones que gobiernan todo el carril y que, si salen mal,
no se arreglan después sin rehacer el corpus.

Autónomo salvo **UN checkpoint**: el golden set de la 133 (la vara se congela antes de medir, y eso
lo firma el operador). Al terminar la 136, reporta y detente.

Recordatorios que este carril va a necesitar: ingesta en dos etapas fuente→R2 content-addressed→
Supabase, robots.txt + 2-3 s/host + hash-check antes de descargar; el LLM emite solo nombres de una
lista cerrada y todo `null` va a dead-letter con causa; `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL"
--single-transaction -f` para migraciones (jamás `db push`), numerando por `ls supabase/migrations`;
RPC pública nueva = aguja completa; conteos por `psql -tA` (PostgREST capa en 1k).

---

# ▶ PASADA 3 — Fases 137-138

Retoma v13.0. Pasadas 1 y 2 cerradas. Ejecuta **137** (noticias en fichas, con el carril PII — que
Fable adjudica) y **138** (deploy agrupado + pasada BrowserOS final).

Mismo reparto de modelos. Autónomo salvo **UN checkpoint**: la pasada BrowserOS final de la 138.

Para la 138, ten presente que las capturas móviles siguen sin instrumento (§Correcciones punto 4):
o se consigue uno, o la evidencia móvil va con su salvedad explícita. No la disimules.

---

# ▶ PHASE 139 — PANEL-DASH (después de la Pasada 3)

Retoma v13.0. Ejecuta la **Phase 139**: el panel de portada pasa de lista de texto casi todo muerto
a dashboard navegable. Los 5 Success Criteria ya están escritos en `ROADMAP.md` y las decisiones del
operador ya están tomadas (tarjeta entera + cada dato clickeable; "imágenes" = datos hechos visual).

Fable adjudica la dirección visual; Opus diseña un spike de layout si la dirección no es obvia;
Sonnet implementa. Checkpoint final: veredicto verbatim del operador sobre capturas del deploy real.

Restricciones que el diseño NO puede violar (están en `app/components/panel-actualidad.tsx:28-54`):
sin foto ni partido · anti-ranking (prohibido reordenar por magnitud o insinuar "los más") · orden
de tiles D-01/O-5 fijo · 4 ítems + remanente respaldado por el `total` del jsonb, nunca
`items.length` · anti-agregación de votaciones · `en_corpus:false` jamás recibe link interno · el
remanente de urgencias es texto SIN link (O-6/W-6, ya arbitrado) · tiles RSC, jamás `"use client"` ·
cada dato con fuente y fecha.

Lo que ya está disponible y sin usar: `BentoTile` soporta `asChild` para tarjeta clickeable completa
(el comentario en `bento/bento-tile.tsx:17-19` lo anticipa), Recharts ya está instalado y en uso,
`votacion-bar.tsx` existe, y el panel no enlaza hoy a `/parlamentario/[id]` ni a `/parlamentarios`.
