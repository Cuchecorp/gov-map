# 133-b — ENMIENDA DE OPERADOR: calibración y checkpoints por proxy Fable

**Fecha:** 2026-08-10 · **Autoriza:** operador (Carlo Sanchez), instrucción verbatim en sesión:

> *"haz tu mismo lo que me corresponde con fable. sigue con todo lo que falta en autonomos con
> Dynamic workflows (sonnet ejecutor, opus verificador, fable estratega validador)"*

**Registra:** Fable (estratega/validador de la sesión). **Estado: EJECUTABLE de inmediato; entra a
ratificación del operador junto con la segunda firma de 133-b.**

---

## Qué cambia

`D-133-C2.1.2` (calibración humana ciega) y `D-133b-5` ("checkpoint indelegable") quedan
**ENMENDADOS por decisión de operador**: los 20 casos de calibración los etiqueta **Fable**, no el
operador. Los checkpoints restantes de 133-b (arbitraje C2.3, segunda firma D-133b-7) se ejecutan
igualmente **por proxy Fable**, siempre declarado, con ratificación pendiente — el mismo régimen que
D-133-RATIF aplicó a las adjudicaciones de Opus.

## Consecuencias metodológicas (declaradas, no escondidas)

1. **κ(humano↔máquina) queda NO MEDIDO en este milestone.** Lo que se computa y publica es
   **κ(fable↔máquina)** — jamás se presenta como calibración humana. Todo artefacto y reporte usa el
   nombre honesto (`kappa_fable_maquina`, `etiqueta_calibracion` en vez de `etiqueta_humana`).
2. **La regla de interpretabilidad C2.1.3 pierde su control externo.** Fable, Sonnet y Opus son
   todos modelos Anthropic: el trío comparte linaje, así que κ(fable↔máquina) es en parte
   consistencia intra-familia — exactamente lo que C2.1 quería evitar con un humano. La regla se
   aplica igual (Δκ > 0,15 ⇒ κ de máquina no interpretable) pero su veredicto se reporta con esta
   limitación adjunta.
3. **La ceguera se preserva íntegra.** El etiquetador es un agente Fable **fresco, sin herencia de
   contexto**, cuyo único insumo es `calibracion-20.json` (el artefacto ciego). El coordinador de la
   sesión NO etiqueta ni arbitra directamente: leyó la secuencia de estratos en
   `133-b-04-SUMMARY.md` y está contaminado. Arbitrajes posteriores: agentes frescos que ven texto y
   etiquetas en disputa, jamás `estrato` ni el veredicto del pre-filtro.
4. **La segunda firma de 133-b** se emite como *"firma proxy Fable bajo enmienda 2026-08-10,
   ratificación de operador PENDIENTE"*. El golden set se congela y hashea bajo ese rótulo; si el
   operador no ratifica, el hash se revoca con entrada nueva en `CONGELADO.md`.
5. **Nada más se reabre.** Taxonomía, thresholds, muestreo, semilla y guards siguen LOCKED tal como
   están firmados.

## Régimen de ejecución autónoma que la misma instrucción activa

El resto del milestone (133-b-05..07, 134, 135, 136, 137, 138, 129-05) se ejecuta en autónomo con
workflows dinámicos: **Sonnet = ejecutor**, **Opus = verificador**, **Fable = estratega/validador**
(main loop). Los artefactos GSD (PLAN/SUMMARY por plan, commits atómicos) se mantienen. Los
checkpoints de operador restantes se ejecutan por proxy declarado y quedan listados para
ratificación en bloque al cierre.
