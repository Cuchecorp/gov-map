# PROMPT — arrancar Milestone v5 (legibilidad + análisis)

> Pega esto en una sesión nueva (después de borrar contexto) para seguir en el mismo estilo.

---

Quiero arrancar el **Milestone v5 — "De datos a comprensión (legibilidad + análisis)"**.
Lee primero: `CLAUDE.md`, `.planning/MILESTONE-v5-legibilidad.md`, y la memoria
`camino-a-post-legacy-cutover` + `estado-producto-y-brecha-datos`.

**Contexto rápido (ya hecho, no rehacer):** el cutover de seguridad terminó — el sitio en vivo
(`observatorio-congreso.thevalis.workers.dev`, dominio `gov-map.com`) lee con `service_role`
(`sb_secret_`), la API anon pública está muerta, legacy JWT revocado, `web_reader` dropeado,
Candado B (cruces UI) live. El build de OpenNext se hace en **Docker Linux** (Windows rompe el
worker → 500); deploy con `wrangler` local. browseros MCP está activo.

**Problema a resolver:** la ficha de parlamentario es un muro de info plana, difícil de navegar
(la de un diputado pesa ~900 KB: votaciones, lobby, patrimonio, cruces, financiamiento, contratos
apilados). Falta comprensión: gráficos de **análisis objetivo** (descriptivo, nunca causal) +
**navegación con acordeones/secciones colapsables**.

**Tarea de esta sesión = Phase 44: Auditoría UX + Inventario de datos + Plan.** NO construir
gráficos todavía; producir el diseño y el roadmap fundados en evidencia. Concretamente:

1. **Auditoría UX con browseros** del sitio en vivo. Recorre y captura: ficha de parlamentario
   sobrecargada (`/parlamentario/D1009` y otra de menor cobertura), `/parlamentarios`, `/agenda`,
   `/buscar`, `/proyecto/<boletin>`. Hallazgos priorizados: qué cuesta encontrar, cuánto scroll,
   qué secciones compiten, dónde un gráfico reemplazaría una tabla. Screenshots como evidencia.
2. **Inventario de datos/capacidades** (psql + lectura de `app/`): qué RPCs/tablas/columnas
   tenemos y qué visualización habilita cada una. Mapea CADA gráfico candidato (abajo) →
   fuente de datos → **¿existe o es gap?**. Los comparativos entre parlamentarios casi seguro
   necesitan **RPCs agregadas nuevas** (deny-by-default + PII-safe).
   Gráficos candidatos: votos en el tiempo · evolución de patrimonio · ausencias · ausencias vs
   resto de la cámara · proyectos como autor/coautor · proyectos sustancialmente idénticos
   (embeddings, `match_proyectos`).
3. **Plan**: diseño de la nueva ficha (acordeones + resumen arriba del pliegue + gráficos con
   **visx**/**Recharts**, ambos ya en el stack), lista de RPCs nuevas necesarias, y el desglose
   de fases de construcción (F45 navegación → F46 votos/ausencias → F47 patrimonio → F48 autoría/
   similares → F49 RPCs agregadas). Escríbelo como `UI-SPEC` + actualiza `ROADMAP.md`.

**Estilo de trabajo (seguir así):** swarm de Sonnet para fan-out (auditoría por superficie,
inventario por dominio de datos) + **validación Opus** del plan antes de cerrarlo + **browseros**
para el sitio real. Usa GSD para encuadrar la(s) fase(s) (`/gsd:plan-phase` o el flujo que
corresponda). Tomá decisiones por mí y andá por lo más robusto; preguntame solo si hay un fork
real que no puedas resolver con la evidencia.

**Restricciones:** principio rector intacto — cada dato/gráfico con fuente+fecha+enlace, **nunca
intención ni causalidad** (gráficos descriptivos, etiquetas neutras). Cualquier RPC nueva del
árbol público va al `PUBLIC_RPC_ALLOWLIST` de `app/lib/lockdown-guard.test.ts` y debe ser PII-safe.
Gráficos degradan con honestidad cuando falta cobertura ("sin datos para este período").
Deploy = Docker Linux + wrangler (no build local Windows).

Cuando tengas el `UI-SPEC` + roadmap + inventario con gaps, pará y mostrámelo antes de construir.
