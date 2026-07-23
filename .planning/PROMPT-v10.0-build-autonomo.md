# PROMPT — Corrida autónoma v10.0 "Panel de actualidad + notificaciones + relaciones" (Phases 97–104, TRES PASADAS)

> Pegar en una sesión LIMPIA de Claude Code (repo Observatorio), tras `/clear` — **una pasada por sesión**. El scaffolding ya existe: ROADMAP.md §v10.0 (8 fases 97-104 con success criteria, 25/25 reqs), REQUIREMENTS.md (AUTH/SEN/PANEL/REL/VSIM/NOTIF/E2E), research v10.0 en `.planning/research/` (STACK/FEATURES/ARCHITECTURE/PITFALLS/RELACIONES/SUMMARY). NO re-descubrir; ejecutar.
>
> **Al terminar cada pasada: `/clear` y pegar el prompt de la siguiente.** Al terminar la pasada 3: audit-milestone → complete-milestone v10.0 → cleanup → tag v10.0 → push a Cuchecorp/gov-map.

---

## PASADA 1 — Señales + Panel (pegar tras `/clear`)

```
/gsd-autonomous --from 97 --to 100
```

Contexto rector de la pasada (leer ROADMAP.md §v10.0 + research/SUMMARY.md antes de planificar):

- **MÉTODO LOCKED del operador**: TODO con base empírica — spikes, iteraciones BrowserOS, revisión, diseño, crítica, loop. **QUÉ (datos con evidencia) antes que CÓMO (frontend)**. El panel es para quien va todos los días al Congreso (periodista/tramitador) Y para el ciudadano.
- **97 (paralelo, de-risk)**: SPIKE auth-on-Workers — primer `middleware.ts` del repo (Edge-style, NO Node Middleware 15.2+ — caveat OpenNext verificado), `@supabase/ssr`, sesión sobrevive el deploy real (Set-Cookie + refresh). NO construye UI de usuario; solo prueba que el pipeline la sostiene. Si el spike falla → NOTIF (103) se re-diseña server-side puro; documentar y seguir.
- **98 GATEA 99-100 (LOCKED)**: SPIKE de datos — auditar `tramitacion_evento` (frescura, cobertura por cámara, fiabilidad primer-evento) y clasificar CADA señal candidata como honesta/sesgada/imposible. **`fecha_captura` JAMÁS es "fecha de ingreso"** (backfill masivo la hace mentirosa). Evaluar BCN `portada_ulp`/Cámara `leyes_promulgadas.aspx` para "leyes recién publicadas" (SEN-06, curl-first). Verificar contra DB viva que voto individual sigue 548k/186-186 (insumo de pasada 2).
- **99**: materializador `actualidad_senal` (espejo `cruce_senal`/0039 + `materializar_cruces()`) — cómputo SQL puro → pg_cron; lógica TS → GH Actions YAML nuevo intradía L-V (clona leyes-weekly SIN R2; NO toca fuentes → sin rate-limit). Clustering por tema: `materia` oficial como label primario + k-means determinista seed-fija sobre embeddings existentes — **labels JAMÁS LLM**. RPCs bounded PII-safe + allowlist (aguja de siempre: migración >0044 cero-grant + security-definer + PUBLIC_RPC_ALLOWLIST + statement_timeout 5s).
- **Honestidad de señal (LOCKED, Pitfall #1)**: señal SUPRIMIDA con causa si la fuente está stale — la ausencia de filas jamás se emite como hecho ("sin movimiento"). Sesgo Cámara/Senado declarado por señal. Framing anti-ranking: "N trámites en 7 días", NUNCA "top/los más" (resuelve el lock T-52-13 en diseño, no rodeándolo).
- **100**: landing = panel de actualidad reemplazando el bento producto-céntrico — reusar BentoGrid/tokens, candados de régimen intactos (cero-hex, tipografía, `SUPERFICIES_PANEL` en el linter ANTES del copy). Benchmark empírico BrowserOS de senado.cl y camara.cl (portada/tablas: documentar qué EVITAR — tablas ASP.NET densas — y qué superar) + iteración diseño→crítica→loop. Gate BrowserOS lectura fría sobre el deploy real. NO cambiar la URL de la home ni romper anchors/SEO.

## PASADA 2 — Relaciones (pegar tras `/clear`)

```
/gsd-autonomous --from 101 --to 102
```

Contexto rector de la pasada:

- **HALLAZGO RECTOR (research HIGH)**: "no se muestra nada" es falso en código, VERDADERO en experiencia — los 4 cross-links (0060/0061) viven ENTERRADOS al fondo de la ficha; /red sigue NET OFF (gate F17) con una sola arista (co_lobby). El voto individual YA está en DB (548.642 votos, 186/186) → similitud computable HOY con SQL puro; el gate es LEGAL, no de datos.
- **101**: audit de brecha N/M por relación (dato-disponible vs superficie-mostrada) → bloque "Relaciones con otros parlamentarios" VISIBLE en la ficha (partido, zona, comisiones, co-autoría — conteo honesto total_n, orden alfabético anti-ranking, leyenda factual) + página `/comparar` 1-a-1 con ejes NO-voto (partido/militancia histórica, comisiones compartidas, co-autoría, zona) + relaciones nuevas si el dato sostiene (militancia histórica compartida, lobby con misma contraparte) + coalición EMPÍRICA (fuentes candidatas: pactos Servel, comités Senado — si no hay fuente factual viable, DIFERIDA documentada; jamás inferida de votos).
- **102**: similitud de votación = "coinciden en N de M votaciones compartidas" (denominador honesto: sustantivas donde ambos votaron) con **caveat base-alta OBLIGATORIO** (la mayoría de votaciones son de trámite/casi unánimes — 99,5% es aritmética, no señal; ejemplo real D1170/D1165 = 3.650/3.667). Tras **flag deny-by-default** (`VSIM_PUBLIC_ENABLED`), flip = sign-off legal humano (dossier clase MONEY/NET — 17-LEGAL-DOSSIER §2 la difirió; el operador la re-pidió 2026-07-23: se CONSTRUYE gated). Linter extendido ANTES del copy ("votan juntos", "aliados", "más afín", scores). Anti-modelo: DW-NOMINATE/eje/mapa/ranking (GovTrack RETRACTÓ sus report cards). `co_votacion` JAMÁS a /red (explosión de clique).

## PASADA 3 — Notificaciones + Cierre (pegar tras `/clear`)

```
/gsd-autonomous --from 103 --to 104
```

Contexto rector de la pasada:

- **103 = el cambio ESTRUCTURAL**: primer dato de usuario, primer auth, primer RLS con policies, primer EGRESO (patrón nuevo — no es ingesta dos-etapas; email no tiene crudo que versionar). Orden interno LOCKED: (1) **PRIMER COMMIT = lockdown-guard extendido a `authenticated`** (agujero detectado en research: el guard solo veta anon/public) + allowlist de tablas-de-usuario; (2) migración suscripciones RLS `to authenticated` `auth.uid()=user_id` deny-by-default, AISLADA del plano service_role (JAMÁS reactivar la anon legacy; cliente = publishable nueva o server-side); (3) auth UI (magic-link/OTP, sobre el spike 97); (4) `@obs/notificaciones` egreso: digest DIARIO batcheado (Resend, techo free 100/día DECLARADO; Custom SMTP para auth-emails — el interno da 2/hora), cola en tabla + cursor idempotente (espejo leylobby_cursor 0053), drenada por cron GH Actions; (5) doble opt-in + unsubscribe token opaco sin login + registro de consentimiento.
- **Email de usuario = PII PROPIA bajo 21.719** (primera vez; hasta hoy toda la PII era de terceros públicos): nunca a LLM, nunca a logs de CI (repo público), nunca a R2. **Checkpoint legal humano ANTES de exponer captura de emails al público** (DPA de Resend = gate de operador). Sin respuesta → feature completa queda tras flag OFF con handoff documentado, la corrida CIERRA igual (patrón v7/v9).
- **104 = "asegúrate que TODO funciona" (operador)**: inventario de CADA superficie nueva del milestone × dato real × BrowserOS sobre el deploy: panel con señales vivas y supresión-si-stale demostrada, relaciones con conteos verificados contra SQL directo, /comparar con caveat visible, similitud gated OFF = ausente del DOM, digest end-to-end en modo test (sin emails reales a terceros), linter verde con vocabulario nuevo, suite completa + guards (incl. authenticated) verdes, `pnpm audit` limpio.
- **AL CERRAR LA PASADA (cierre del milestone)**: `/gsd:audit-milestone` → `/gsd:complete-milestone v10.0` → cleanup → tag v10.0 → push a Cuchecorp/gov-map. Deuda de operador viva (sign-off VSIM, checkpoint 21.719, DPA, B26/pgvector de v9, gates v7.0) se documenta como handoff, NO bloquea el cierre.

---

## Directivas comunes a las TRES pasadas (mismas de v6.x-v9, que cerraron completas)

- **Fable es el jefe**: planifica, dirime y controla; delega ejecución a agentes Sonnet o menores (validadores Opus). Smart-discuss auto-acepta recomendaciones; las decisiones del operador (panel de actualidad, relaciones exhaustivas incl. similitud de voto, crons más frecuentes OK, benchmark senado/camara) YA ESTÁN RESUELTAS — no re-preguntar.
- **Ciclo por producto (LOCKED)**: diseño → prueba empírica BrowserOS → crítica → rediseño → validación empírica + de seguridad. Los gates BrowserOS de 100 y 104 son criterios de éxito, no opcionales. Si el MCP BrowserOS está caído, pedir al operador levantarlo — no fingir capturas; los gates interactivos que el subagente no pueda cerrar los cierra el ORQUESTADOR (tiene MCP).
- **Autónomo y ordenado**: sin preguntas al operador. Checkpoint humano sin respuesta = handoff documentado con evidencia lista, la corrida CIERRA igual.
- **Gates que un agente JAMÁS cruza**: flags `*_PUBLIC_ENABLED` (MONEY/NET/VSIM siguen como estén), sign-offs legales, checkpoint 21.719/DPA, rotar credenciales, imprimir secrets, enviar emails a direcciones reales de terceros.
- **Reglas LOCKED de siempre**: dos-etapas fuente→R2→Supabase para toda INGESTA nueva (BCN leyes publicadas si SEN-06 procede); rate-limit 2-3s + curl-first ante WAF (solo aplica a fases que toquen fuentes; el materializador NO las toca); identidad fail-closed; anti-insinuación (leyendas, linter verde, extensión ANTES del copy); migraciones por `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f` (NUNCA `db push`); PostgREST cap 1k (`.order().range()` SIEMPRE); toda RPC pública nueva = aguja completa (>0044 cero-grant, security-definer PII-safe, PUBLIC_RPC_ALLOWLIST, bounded LIMIT+statement_timeout).

## Contexto operativo (gotchas ya pagados)

- **Deploy**: build OpenNext en Docker `node:22-slim` (NUNCA alpine ni Windows); robocopy a `C:/Temp/obs-build`; wrangler GLOBAL (OAuth local); pnpm 11 `dangerouslyAllowAllBuilds true` en contenedor. Runbook: `milestones/v6.0-phases/61-*/61-02-SUMMARY.md`. OJO 97: el middleware nuevo es EL riesgo del build — spike con deploy real, no local.
- **pnpm 11**: al tocar overrides re-inyecta `allowBuilds: <dep>: set this...` — fijar `allowBuilds: <dep>: true` explícito (borrar el placeholder NO basta, vuelve). Overrides viven en pnpm-workspace.yaml.
- **BrowserOS**: MCP `http://127.0.0.1:9200/mcp`, wrapper `scripts/bros-cli.mjs`; screenshots en ráfaga tumban el MCP → sleep 8-10s; `evaluate_script` usa `expression`, `click` usa `element`.
- **Queries DB viva**: SIEMPRE filtro `not exists (pg_depend deptype='e')` sobre pg_proc/grants (sin él, 1201 falsos positivos pgTAP). psql read-only: `set -a; source .env; set +a`, JAMÁS imprimir la URL.
- **Suite al inicio**: app 1243 + packages 1263 verdes + `tsc --noEmit` limpio + `pnpm audit` 0. Cada plan la deja verde. Guards que muerden: lockdown (PUBLIC_RPC_ALLOWLIST + Direction-B + crossLinkReader), PII-guard, anti-insinuación (201+ términos), env-example, cero-hex, tipografía, bento/linter-home.
- **Sitio PROD**: https://observatorio-congreso.thevalis.workers.dev (v9.0 `09f1d5c2`, CSP ENFORCED ambas superficies — si algo nuevo necesita un origen externo en connect-src, ajuste MÍNIMO documentado, jamás quitar frame-ancestors/object-src). Supabase ref `bctyygbmqcvizyplktuw` (sa-east-1, pooler IPv4).
- **Relación con v7.0**: cero dependencia dura; sus gates de operador siguen abiertos (`HANDOFF-v7.0-operator-gates.md`); las fases 64-75 viven en `.planning/phases/` — NO tocarlas ni archivarlas. NOTA: la DB viva YA tiene 548k votos (el backfill corrió) — verificar en 98, no asumir el "pendiente" de memorias viejas.
