# Milestone v5.0 — De datos a comprensión (legibilidad + análisis)

**Fecha:** 2026-06-26
**Estado:** 📋 PLANIFICADO (arranca con una fase de auditoría+plan, ver abajo)
**Predecesor:** v4.0 (cruces) shipped; cutover Camino A completo (ver memoria `camino-a-post-legacy-cutover`)

---

## Por qué (problema)

Hoy la **ficha de parlamentario** acumula mucha información en una página plana y larga
(la de un diputado activo pesa ~900 KB de HTML: votaciones, lobby, patrimonio, cruces,
financiamiento, contratos, todo apilado). **Es mucha info difícil de navegar y de leer.**
La data está — falta **comprensión**: que un ciudadano o periodista entienda de un vistazo
"qué pasó, cómo evolucionó, cómo se compara" sin scrollear un muro de tablas.

## Qué (objetivo)

Transformar la presentación de datos de **plana y exhaustiva** a **navegable y analítica**:

1. **Análisis objetivo (descriptivo, no editorial)** vía visualizaciones que respondan
   preguntas concretas con la data que ya tenemos (o que generemos):
   - **Votos en el tiempo** — serie temporal sí/no/abstención/ausente por sesión.
   - **Evolución de patrimonio** — declaraciones año a año (bienes/deudas).
   - **Ausencias** — tasa de ausencia/pareo del parlamentario en el tiempo.
   - **Ausencias en relación a otros** — su tasa vs promedio/ranking de la cámara *(probable
     gap de datos → requiere RPC agregada nueva)*.
   - **Proyectos de los que es autor/coautor** — listado + métricas (cuántos, en qué etapa).
   - **Proyectos sustancialmente idénticos/similares** — usando los embeddings ya existentes
     (`match_proyectos`) para agrupar refundidos/duplicados.
   - (candidatos extra: distribución de votos por materia, lobby por sector, cruces destacados)
2. **Navegación**: agrupación en **acordeones / ventanas desplegables** y secciones colapsables,
   con un resumen "arriba del pliegue" y el detalle bajo demanda. Reducir el muro de scroll.

## Principio rector (no negociable)

Se mantiene el principio del proyecto: **trazabilidad a la fuente** (cada dato/gráfico lleva
fuente, fecha y enlace) y **nunca afirmar intención ni causalidad**. Los gráficos son
**descriptivos** ("cómo votó", "cómo evolucionó"), jamás interpretativos ("por qué", "a favor de").
Etiquetas neutras; el lector saca conclusiones.

## Cómo (enfoque: análisis-primero)

Este milestone **arranca con una fase de auditoría + inventario + plan** (no se salta directo a
construir gráficos). La fase produce el diseño y el roadmap de las fases siguientes.

### Phase 44 (propuesta) — Auditoría UX + Inventario de datos + Plan de legibilidad
**Deliverable:** un `UI-SPEC` + un roadmap de fases de construcción, fundado en evidencia real.
1. **Auditoría UX con browseros** del sitio en vivo (`observatorio-congreso.thevalis.workers.dev`),
   con foco en la ficha de parlamentario sobrecargada (p.ej. `/parlamentario/D1009`): qué se ve,
   qué cuesta encontrar, cuánto scroll, qué secciones compiten. Capturas + hallazgos priorizados.
2. **Inventario de datos/capacidades**: qué RPCs/tablas/columnas tenemos y qué visualización
   habilita cada una (votos con fecha, declaraciones por año, autores en `proyecto.autores`,
   embeddings para similares, etc.). Mapear cada gráfico candidato → fuente de datos →
   **¿existe la data o es un gap?** (los comparativos entre parlamentarios casi seguro requieren
   **RPCs agregadas nuevas**, deny-by-default y PII-safe como el resto).
3. **Plan**: diseño de la nueva ficha (acordeones + resúmenes + gráficos), librería de charts
   (el stack ya trae **visx** para lo a medida y **Recharts** para gráficos estándar — ver CLAUDE.md),
   y el desglose de fases de construcción (probablemente: layout/navegación → charts de votos/
   ausencias → patrimonio → autoría/similares → RPCs agregadas de comparación).

### Fases siguientes (tentativas — las confirma Phase 44)
- **F45** Navegación: acordeones/secciones colapsables + resumen superior (re-layout ficha).
- **F46** Charts de actividad: votos en el tiempo + ausencias (+ comparativo vs cámara).
- **F47** Charts de patrimonio: evolución de declaraciones.
- **F48** Autoría + similares: proyectos como autor/coautor + agrupación de sustancialmente idénticos.
- **F49** RPCs agregadas nuevas (comparativos PII-safe, deny-by-default) — puede adelantarse si F46/F48 las necesitan.

## Restricciones y notas

- **Tech**: charts server-friendly (SSR) — **visx** (a medida, p.ej. timeline) / **Recharts**
  (estándar). Todo server-side; el browser no toca Supabase (el sitio lee con `service_role`
  vía `sb_secret_`, ver Camino A). Nuevos RPCs siguen el patrón **deny-by-default + PII-safe**
  y se exponen vía el guard CI (`lockdown-guard.test.ts` allowlist de `.rpc()`).
- **Seguridad**: cualquier RPC nueva que el árbol público invoque DEBE agregarse al
  `PUBLIC_RPC_ALLOWLIST` del guard y ser PII-safe (jamás proyectar rut/donante crudo).
- **Datos**: cobertura actual desigual (patrimonio parcial, votaciones de pocos boletines, RUT
  ausente en varios) — los gráficos deben degradar con honestidad ("sin datos para este período")
  en vez de mentir. La cobertura es un eje paralelo (ver memoria `estado-producto-y-brecha-datos`).
- **Estilo de trabajo**: el del cutover — swarm Sonnet + validación Opus, browseros para auditar
  el sitio real, GSD para las fases.

## Arranque
Prompt listo para pegar en sesión nueva: `.planning/PROMPT-v5-legibilidad.md`.
