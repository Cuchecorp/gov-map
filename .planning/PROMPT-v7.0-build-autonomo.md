# PROMPT — Corrida autónoma v7.0 "Votos, dinero y cierre técnico" (Phases 64–75)

> Pegar en una sesión LIMPIA de Claude Code (repo Observatorio), tras `/clear`. El scaffolding ya existe: PROJECT.md (milestone v7.0), REQUIREMENTS.md (17 reqs), ROADMAP.md (12 fases 64-75, 100% cobertura), y research/ (STACK/FEATURES/ARCHITECTURE/PITFALLS/SUMMARY). NO re-descubrir; ejecutar.

---

## Prompt para pegar

```
/gsd-autonomous --from 64 --to 75
```

Directivas de la corrida (mismas que v6.0/v6.1, que cerraron completas):

- **Fable es el jefe**: planifica, dirime y controla; delega ejecución a agentes Sonnet o menores. Smart-discuss auto-acepta recomendaciones (los CONTEXT.md y el research ya traen las decisiones LOCKED — no re-investigar lo ya medido).
- **Autónomo y ordenado**: sin preguntas al operador salvo decisión genuinamente suya o checkpoint de datos/humano (ver Gates). Checkpoints automated-first.
- **BrowserOS obligatorio** como gate de comprensión de cada superficie nueva (MCP `http://127.0.0.1:9200/mcp`, wrapper `scripts/bros-cli.mjs`, páginas ocultas, capturas desktop+390px, lectura fría → veredicto). Si el MCP está caído, pedir al operador levantarlo — no fingir capturas.
- **Gates que un agente JAMÁS cruza**: flags `*_PUBLIC_ENABLED`, sign-offs legales, DDL destructivo, backfill masivo en GH Actions, evasión de WAF, imprimir secrets, name-match que escriba RUT.

## HALLAZGO RECTOR (research HIGH, convergente 4/4 — LÉELO ANTES DE PLANIFICAR)

El código de AMBOS frentes YA EXISTE desde v2.0: `packages/votos/` (conector `opendata.camara.cl` `getVotacion_Detalle`, reconciliación DIPID fail-closed, migración 0019, RPCs `votos_de_parlamentario`/`rebeldias_de_parlamentario`, superficies) y `packages/dinero/` (ChileCompra `api.mercadopublico.cl`, SERVEL `.xlsx`/exceljs, `harvest-rut.ts`/`backfill-rut.ts`, `reconciliar-contrato.ts` RUT-exacta, migraciones 0023/0024, `money-gate.ts`, materializador con token `lobby_sector_aporte` reservado en 0039).

**v7.0 NO es construcción net-new: es WIRING dos-etapas + validación de endpoint LIVE + BACKFILL de datos + GATING deny-by-default.** Cada fase se ejecuta como EJECUCIÓN / WIRING / COBERTURA / GATING. Si un plan se redacta como "crear tabla/conector/modelo" → está mal: primero `grep` el código existente y cablearlo. Detalle por componente: `.planning/research/ARCHITECTURE.md`; síntesis: `.planning/research/SUMMARY.md`.

## Qué se construye (12 fases, dependencias duras)

**P3 — VOTO (voto individual):**
- **64 (SPIKE bloqueante)** — validar/caracterizar `opendata.camara.cl` LIVE contra el WAF: ¿UP a escala hoy? fijar con test los códigos `Valor` (1=sí, 0=no, 4=ausente) + confirmar Abstención/Pareo (nunca vistos live, "A1"); fixture a R2; fallback honesto a agregados si cae. **VOTO-05 enabler.**
- **65** — golden set DIPID→maestra ANTES del backfill (identidad fail-closed; un voto mal atribuido es difamatorio, riesgo #1). Nunca name-match para votos de Cámara. **VOTO-03.**
- **66** — wire dos-etapas fuente→R2→Supabase en votos + backfill Cámara a escala (funde **DEBT-01** source_snapshot/`--from-r2` — votos es uno de los conectores hoy sin R2). **VOTO-01 (Cámara).**
- **67** — paridad Senado (voto individual ya se ingesta vía `wspublico/votaciones.php` por PARLID/nombre → reconciliación por nombre = probable/no_confirmado, no fabrica FK). **VOTO-01 (Senado).**
- **68** — superficies de voto (ficha parlamentario) + linter anti-insinuación extendido a voto + cobertura N/M declarada + gate BrowserOS. **VOTO-02, VOTO-04, VOTO-05.**

**P5 — RUT + DINERO (deny-by-default):**
- **69 (CHECKPOINT OPERADOR — bloqueante DURO de todo P5)** — RUT-01 backfill a la maestra `entidad_tercero`. Es DATO, no flag: sin RUT no hay cruce. La fase caracteriza la fuente del RUT (canal de corroboración vía ChileCompra `BuscarProveedor`, DV-gate módulo-11) y deja el backfill listo; el WRITE remoto a la maestra es acción del operador. RUT nunca al LLM ni a ruta pública; name-match NUNCA escribe `rut` (guard CI). Cobertura N/M declarada. **RUT-01.**
- **70 (SPIKE cuota)** — wire dos-etapas ChileCompra por RUT (`api.mercadopublico.cl`, ticket 10k/día del operador, redacción del ticket; 2 pasos `BuscarProveedor?rut` → `ordenesdecompra`). Funde **DEBT-01**. **MONEY-01.**
- **71** — SERVEL LOCAL (`.xlsx` en Azure Blob anónimo, exceljs; toil del operador = bajar el workbook por elección; frescura declarada). Funde **DEBT-01**. **MONEY-02.**
- **72** — extender el materializador `cruces.materializar_cruces()` con el token `lobby_sector_aporte` ya reservado en 0039 (conteos factuales, nunca score). **MONEY-03.**
- **73 (GATE LEGAL humano)** — superficies de dinero detrás de `moneyPublicEnabled` fail-closed OFF + linter anti-insinuación + procedencia inline. El flip de `MONEY_PUBLIC_ENABLED` es acto humano (sign-off dossier legal 21.719); el operador lo PRE-APROBÓ pero el guard CI bloquea que un agente lo commitee → el agente construye TODO hasta el gate y deja el flip documentado como acción del operador. **MONEY-04, MONEY-05.**

**DEUDA (paralelizable, no bloquea P3/P5):**
- **74** — cursor incremental leylobby (**DEBT-02**) + `CLOUDFLARE_API_TOKEN` en CI para crons verdes sin fallback local (**DEBT-03**) + rotación round-robin del cron `leyes-weekly` sobre el corpus 3.657 (**DEBT-04**).
- **75** — typography island `.net-*` alineada al design system (**DEBT-05**) + rotar DB password B26 (**DEBT-06**, acción operador documentada).

```
P3:  64►65►66►67►68
P5:  69(RUT-01, operador)►70►71►72►73(gate legal)
DEUDA: 74 · 75   (paralelizables)
```

## Dos checkpoints que la corrida NO puede saltarse sola (el operador los provee)

1. **Phase 69 — RUT-01**: el WRITE remoto de RUT a la maestra es acción del operador (y la fuente del RUT puede necesitar cosecha). Si al llegar a 69 el dato no está, la corrida **pausa P5**, sigue con DEUDA (74-75), y deja en el checkpoint las instrucciones exactas para desbloquear. P5 (70-73) no puede correr sin RUT-01.
2. **Phase 73 — flip legal**: el agente construye deny-by-default; el flip de `MONEY_PUBLIC_ENABLED` en PROD lo hace el operador tras el sign-off del dossier legal 21.719. Pre-aprobado ≠ el agente lo commitea.

Todo lo demás (64-68, 70-72 build, 74-75) es autónomo de punta a punta.

## Contexto operativo (gotchas ya pagados)

- **Deploy**: build OpenNext en Docker `node:22-slim` (NUNCA alpine ni build Windows); copiar fuente a `C:/Temp/obs-build` con robocopy antes de montar (OneDrive lentísimo); `docker run -w /app` SOLO vía PowerShell (git-bash convierte `/app`); wrangler GLOBAL vía operador de llamada `& node.exe "...wrangler.js" deploy --config wrangler.jsonc` (OAuth local; CI Cloudflare sigue sin `CLOUDFLARE_API_TOKEN` hasta DEBT-03). **NUEVO (quick 260713-izo): pnpm 11 convierte `ERR_PNPM_IGNORED_BUILDS` en error duro dentro del `runDepsStatusCheck` de OpenNext → correr `pnpm config set dangerouslyAllowAllBuilds true` ANTES del `pnpm install` en el contenedor.** Runbook: `milestones/v6.0-phases/61-*/61-02-SUMMARY.md`.
- **BrowserOS**: `save_screenshot` en ráfaga puede tumbar el MCP con "CDP request timeout" y matar la página oculta → reintentar con sleep 8-10s, reabrir con `open`, re-aplicar estado. `evaluate_script` usa arg `expression` (no `code`); `click` usa `element` (no `id`). El 390px se fuerza con CSS inyectado (BrowserOS no expone resize de viewport).
- **Verificar contra el entrypoint del YAML del cron**, no contra el paquete (gap 57-05: dos CLIs).
- **psql/migraciones**: `PGCLIENTENCODING=UTF8`, BOM U+FEFF en `.env`; migraciones >0044 SIN grants a anon (Camino A service_role); pgTAP `col_is_null`/`proargnames`. PostgREST cap 1k → paginar `.order().range()` SIEMPRE a escala.
- **fast-xml-parser**: verificar shape real con `node -e` antes de confiar en claves (`#text` vs clave nombrada — el bug de autores de v6.0 y la forma de `getVotacion_Detalle`).
- **Suite al inicio**: 751 verde + `tsc --noEmit` limpio. Cada plan la deja verde. @xyflow/react ya NO está en el repo (eliminado en quick 260713-izo).
- **Sitio PROD**: https://observatorio-congreso.thevalis.workers.dev (última versión `6534fe9f`, /red layout B aprobado).

## Al cerrar

audit-milestone → complete-milestone v7.0 → cleanup → tag → push a Cuchecorp/gov-map. Deja como deuda de operador (no de la corrida): RUT-01 write remoto si quedó pendiente, flip `MONEY_PUBLIC_ENABLED` tras sign-off legal, rotar DB password B26, cargar `CLOUDFLARE_API_TOKEN` en CI si DEBT-03 lo dejó listo pero sin secret.
```
