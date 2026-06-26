# PROMPT — construir v5 (legibilidad) de modo AUTÓNOMO

> Pegá esto en una sesión nueva (después de borrar contexto). Todo el milestone ya está
> configurado y verificado con el SDK de GSD; este prompt solo dispara la ejecución.

---

Quiero que construyas, **de modo autónomo y con máxima calidad**, la pista de **legibilidad**
del Milestone v5 — "De datos a comprensión". Está todo configurado y verificado; arrancá a ejecutar.

## Estado (ya hecho — no rehacer)

- **v5 está abierto como milestone GSD** (`STATE.md` → `milestone: v5.0`; v4.0 cerrado, cutover Camino A aplicado a PROD 2026-06-26). Verificado: `gsd-sdk query init.plan-phase 45` devuelve `phase_found: true`, `has_context: true`, `phase_req_ids: LEG-01..03`.
- **Phase 44 (auditoría+plan) COMPLETE.** Diseño LOCKED en `.planning/phases/44-legibilidad-auditoria-plan/UI-SPEC.md` (+ `44-AUDIT-UX.md`, `44-DATA-INVENTORY.md`). Decisión del usuario = **A+B** (legibilidad ya + ingesta en paralelo).
- **Hallazgo clave:** la mayoría de los charts están bloqueados por gaps de DATOS, no de UI (votos=10 votaciones, `proyecto.autores`=0/74, montos=URIs). Por eso la pista autónoma es solo **F45 + F46**.
- **F45 y F46 están GSD-ready:** `### Phase 45/46` en ROADMAP (formato detalle), requisitos `LEG-01..03` / `VIZ-01..03` en `REQUIREMENTS.md`, y `45-CONTEXT.md` / `46-CONTEXT.md` ya sembrados con el diseño LOCKED.
- **Config ya seteada** (`.planning/config.json`): `model_profile: quality`, `granularity: fine`, `mode: yolo`, todos los gates ON (research, plan_check, verifier, nyquist, security, ui_phase, pattern_mapper, post_planning_gaps), `code_review_depth: thorough`, y overrides **Opus** en plan-checker / verifier / nyquist-auditor / ui-checker. **No hace falta tocar la config.**

## Tu tarea = ejecutar F45 → F46 autónomo

Corré:

```
/gsd:autonomous --from 45 --to 46
```

⚠️ **Los flags `--from 45 --to 46` son obligatorios.** Hay fases viejas de v3.0/v4.0 nunca completadas (p.ej. Phase 29 RUT, 34 INGEST, 38/39/40) que NO son de esta pista; un `/gsd:autonomous` pelado arrancaría en la 29. `--from 45 --to 46` acota la corrida a la pista de legibilidad.

Esto hace, por cada fase, **discuss → plan → execute** con todos los gates de calidad. Como el
`CONTEXT.md` de cada fase ya está sembrado, no debería pedirte decisiones de diseño; respondé solo
si aparece un **fork real** que el UI-SPEC / CONTEXT no resuelva. Pará tras verificar F46.

- **F45 (navegación):** acordeones por carril (Radix) + resumen/índice above-fold con conteo/estado honesto + anclas. Data-independiente, mayor ROI.
- **F46 (chart patrimonio):** Recharts (instalar + validar build) → gráfico del **conteo de ítems por año** (no montos: son URIs → caveat honesto), dentro del acordeón de patrimonio de F45.

## Calidad — innegociable (validación Opus en cada paso)

- En CADA fase: el **plan-checker (Opus)** valida el PLAN antes de ejecutar; el **gsd-verifier (Opus)** valida el goal al cerrar; **nyquist-auditor (Opus)** la cobertura de validación; **ui-checker (Opus)** el contrato visual; **code-review thorough** sobre el diff. No saltes ningún gate. Si un gate falla, iterá hasta que pase (no lo deshabilites).
- Granularidad **fine**: tareas chicas, atómicas, con `read_first` + `acceptance_criteria` concretos.

## Restricciones (LOCKED — el diseño ya las fija, respetálas al construir)

- **Frontera de carril `mt-12` NUNCA se colapsa** (DESIGN-SYSTEM §3/§8). Un acordeón por dominio; JAMÁS dos dominios en una misma unidad (anti-insinuación). Header (`<h2>`) siempre visible.
- **Descriptivo, nunca causal.** Cada dato/gráfico con **fuente + fecha + enlace**. Etiquetas neutras; el negative-match del vocabulario prohibido debe quedar verde.
- **Seguridad (Camino A):** el árbol público corre con `service_role` (bypassa RLS) → la PII la protege el **guard CI** (`app/lib/lockdown-guard.test.ts`). Prohibido `.from('parlamentario')` directo; ninguna RPC fuera del `PUBLIC_RPC_ALLOWLIST`. F45/F46 NO necesitan RPC nueva.
- **SSR intacto:** la ficha sigue server-rendered; solo el toggle del acordeón (F45) y el chart (F46) son islas `"use client"`.
- **Honestidad de cobertura:** los gráficos degradan con honestidad ("datos insuficientes para una tendencia"), nunca aparentan densidad.

## Límites de autonomía (dónde parar)

- **Deploy a Cloudflare = checkpoint OPERADOR** (build OpenNext en **Docker Linux** — Windows rompe el worker → 500; deploy `wrangler` local, creds no en CI). Construí + testeá + commiteá autónomo; **NO deployes** — dejámelo listo y avisá.
- **F47 / F48 / F49 NO están en scope** (gated por datos: ingesta de votaciones masiva + autores/identidad). No las planees ni ejecutes en esta corrida.
- Pará ante cualquier checkpoint operador, blocker real, o fork que el diseño no resuelva.

## Al terminar

Mostrame: qué se construyó por fase, resultado de cada gate Opus, suite `app/` + `tsc -b`, y el
estado del checkpoint de deploy (operador). Actualizá `STATE.md` / `ROADMAP.md` / memoria como de costumbre.
