# Phase 135 — NEWS-CLASIF · CONTEXT + PLAN CONSOLIDADO

**Fecha:** 2026-08-10 · **Planifica:** Fable (régimen autónomo, enmienda proxy 2026-08-10).
**Goal:** el clasificador entra a producción solo si pasa la vara congelada. **Req:** NEWS-05.

## Hechos de entrada (explorados, no supuestos)

- Golden congelado: `packages/news/src/eval/golden-set.json` sha `47ace935…`, 159 casos;
  thresholds T1..T9 congelados (`thresholds.json` sha `e4285944…`). **T4/T9 no-medidos
  fail-closed** ⇒ 135 mide T1/T2/T3 (+T5 si n≥25: no_legislativa n=72 ✓) y **el enrutamiento
  a fichas queda OFF** — 135 clasifica y persiste etiqueta interna (D-133-G), no publica.
- Veredicto v11.0 full-40 (`107-VEREDICTO-LIVE-FULL-2026-07-27.md`): Granite APPROVED solo
  clasificación, extracción VETADA es-CL, routing incumbent-stays (DeepSeek). **La aprobación
  NO se transfiere de dominio** (D-133-D2/B10) ⇒ re-bench sobre el golden de prensa.
- Patrón de gate existente: llm-bench freeze sha256 + tests `.live.test.ts` que skippean sin
  secrets; CI corre `@obs/news` (no llm-bench). Vía barata SC1: el gate vive en `@obs/news`.
- Idempotencia ya construida (SC4): `carga-run.ts` marca vista `pendiente` ANTES del reject
  (orden LOCKED 132-05); `noticia.estado` check `('pendiente','clasificada','descartada')` —
  nadie promueve a `clasificada` todavía: ese es el hueco de 135.
- Ledger: no existe tabla de costo LLM; `jsonlSink` de telemetry es el único camino
  persistente. Etiqueta: columna vs tabla quedó para 135 (133-READJUDICACION §3).

## Decisiones de diseño (135)

1. **Etiqueta = columnas en `noticia`** (no tabla historial): migración **0087** añade
   `etiqueta text check (las 6)`, `etiqueta_confianza numeric`, `etiqueta_modelo text`,
   `clasificada_en timestamptz`; el historial fino no tiene consumidor todavía (YAGNI
   declarado; re-etiquetados futuros = política explícita de milestone futuro, ya reservado
   en D-133 "no decide" §5). pgTAP 0087.
2. **Ledger = tabla `llm_ledger`** (misma 0087): `run_id, task, modelo, llamadas, tokens_in,
   tokens_out, costo_usd_estimado, created_at`, deny-all. **Cap duro** por corrida en el
   clasificador (constante versionada) — al tope, la corrida PARA con error LOUD y el ledger
   registra lo consumido. "Conteo por corrida consultable" = select por run_id (service).
3. **Clasificador** (`packages/news/src/clasificador/`): prompt DERIVADO de `taxonomia.ts`
   (regla D-133-A2; el prompt de anotación de 133-b NO se reusa — D-133b-4 veta evaluar el
   par (modelo, prompt) de los anotadores; este es otro prompt, construido para producción,
   y los modelos evaluados son DeepSeek/Granite/MiniMax, no Sonnet/Opus). `temperature=0`,
   salida zod estricta `{etiqueta, confianza}`, umbral `UMBRAL_CONFIANZA` de 134, resolver +
   dead-letter de 134 para los `null`.
4. **Eval/gate SC1** (`packages/news/src/eval/gate-clasificador.ts` + test):
   `evaluarClasificador(resultados, golden, thresholds)` puro → veredicto T1/T2/T3(/T5) con
   IC (regla de intervalos D-133-D2, `dentro-del-ruido` marcado). El test de CI corre el gate
   sobre `veredicto-135.json` (artefacto computado y congelado tras la corrida live) y
   BLOQUEA si algún veto falla; **fixture de mutación**: un resultados-degradado sintético
   DEBE hacer fallar el gate (demuestra que muerde). Tests live (`.live.test.ts`-style) solo
   locales.
5. **Benchmark 135-02** (LOCAL, live): candidatos DeepSeek V4 (incumbente) + Granite
   (re-validación de dominio) + MiniMax si hay créditos; 159 casos × candidato; veredicto
   COMPUTADO por el gate (jamás aprobado por silencio); desempate por solapamiento de IC +
   T6 costo. El artefacto y su hash entran a `CONGELADO.md`.

## Unidades

- **135-01** Migración 0087 (columnas etiqueta + `llm_ledger`, pgTAP, apply PROD).
- **135-02** Clasificador + gate puro + fixture de mutación + tests (sin red).
- **135-03** Benchmark live LOCAL sobre el golden + `veredicto-135.json` congelado + elección
  de modelo computada + entrada CONGELADO.md.
- **135-04** Pipeline `clasificar-noticias-cli` (pendiente→clasificada, dead-letter, ledger,
  cap duro, idempotencia re-corrida) + VERIFICATION por Opus.

## Amenazas top

- T-135-01 gate verde vacuo (0 resultados) ⇒ el gate LANZA sobre resultados vacíos y exige
  n=159 exacto contra el golden.
- T-135-02 evaluar sin querer el prompt/modelo de los anotadores ⇒ candidatos restringidos a
  la capa enchufable (DeepSeek/Granite/MiniMax); test que el prompt de producción ≠ prompt de
  anotación (sha distintos).
- T-135-03 re-corrida reprocesa rechazados ⇒ test: dead-letter + estado ya `clasificada` no
  se reprocesan.
- T-135-04 cap de presupuesto no muerde ⇒ test con provider mock que excede el cap.
