# Roadmap: Observatorio del Congreso 360

**Core Value:** La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato lleva fuente, fecha y enlace original, sin afirmar intención ni causalidad.

## Milestones

- ✅ **v1.0 MVP — Proyectos de Ley + Fundaciones de Identidad** — Phases 1-7 (shipped 2026-06-18)
- ✅ **v2.0 — Parlamentarios 360** — Phases 8-18 (voto individual, lobby/patrimonio, dinero, grafo de influencia) — shipped (gates F13/F17 = sign-off humano)
- ✅ **v3.0 — Cobertura de datos** — Phases 23-32 (lobby con identidad adjudicada, patrimonio LIVE, votaciones masivas, provenance) — shipped
- ✅ **v4.0 — De datos a cruces verificables** — Phases 33-43 — cruces ENCENDIDOS; lockdown API resuelto vía Camino A (sitio en service_role, anon muerta, web_reader dropeado; cutover a PROD 2026-06-26)
- ✅ **v5.0 — De datos a comprensión (legibilidad + análisis)** — Phases 44-55 — shipped 2026-07-08 (`74e3ad0f`). Audit: milestones/v5.0-MILESTONE-AUDIT.md
- ✅ **v6.0 — Confiabilidad y comprensión** — Phases 56-61 (ingesta E2E confiable, autores F48, ícono, comprensión BrowserOS) — shipped 2026-07-09
- ✅ **v6.1 — Entendible y completo** — Phases 62-63 (/red ego-network radial + búsqueda corpus completo declarado) — shipped 2026-07-11
- ✅ **v7.0 — Votos, dinero y cierre técnico** — Phases 64-75 — CODE-COMPLETE 2026-07-15; **ARCHIVADO 2026-07-27** (fases → milestones/v7.0-phases/). Deuda de operador documentada (RUT-01, backfills LIVE, CF secrets/B26, MONEY OFF honesto)
- ✅ **v8.0 — Rediseño Bento** — Phases 76-81 — shipped 2026-07-15 (`fb88c8a4`); archivo: milestones/v8.0-ROADMAP.md
- ✅ **v8.1 — Demo perfecto** — Phases 82-85 — shipped 2026-07-15 (`3563ecc9`); archivo: milestones/v8.1-ROADMAP.md
- ✅ **v9.0 — Robustez de productos estrella + seguridad final** — Phases 86-96 — shipped 2026-07-23 (deploy `09f1d5c2`, CSP enforced, audit PASSED 29/29); archivo: milestones/v9.0-ROADMAP.md
- ✅ **v10.0 — Panel de actualidad + notificaciones + relaciones** — Phases 97-104 — shipped 2026-07-26 (deploy `e89b79af`, audit PASSED 25/25, VSIM ON, NOTIF inerte); archivo: milestones/v10.0-ROADMAP.md
- ✅ **v11.0 — Capa LLM escalonada + cierre de deuda viva** — Phases 105-112 — shipped 2026-07-27 (audit 20/24, 4 deferred operator-debt); archivo: milestones/v11.0-ROADMAP.md
- ✅ **v12.0 — Validación general producto-a-producto** — Phases 113-125 — shipped 2026-07-29 (deploy `0ea5d97f`; audit `tech_debt`: 11/13 reqs cerrados literalmente, 2 por declaración; **archivado CON la deuda** por decisión del operador); archivo: milestones/v12.0-ROADMAP.md

> El cuerpo detallado de los roadmaps anteriores vive en `milestones/` (incluye `PRE-v12.0-ROADMAP-archive.md` con el detalle histórico de v7.0/v11.0).

<details>
<summary>✅ v12.0 — Validación general producto-a-producto (Phases 113-125) — SHIPPED 2026-07-29</summary>

- [x] Phase 113: INV — Inventario rector de superficies (6/6 plans) — 2026-07-28
- [x] Phase 114: LINK-INT — Links internos exhaustivos (3/3) — 2026-07-28
- [x] Phase 115: LINK-EXT — Patrones de link a fuente oficial (3/3) — 2026-07-28
- [x] Phase 116: FECHA-AUDIT — Semántica de cada fecha visible (4/4) — 2026-07-28
- [x] Phase 117: FECHA-FIX — Etiquetas de fecha corregidas (4/4) — 2026-07-28
- [x] Phase 118: CRON-AUDIT — Veredicto por cron con evidencia (3/3) — 2026-07-28
- [x] Phase 119: CRON-FIX — Robustez de ingesta (7/7) — 2026-07-28
- [x] Phase 120: ESCALERA-ON — Flip `CLASIFICACION_ESCALERA=1` (2/2) — 2026-07-28
- [x] Phase 121: ESCALERA-DOC — Extensión solo con benchmark (1/1) — 2026-07-28
- [x] Phase 122: CRUCE-SQL — Cruces visibles × SQL de PROD (6/6) — 2026-07-29
- [x] Phase 123: SUPA-AUDIT — Auditoría de estructura Supabase (6/6) — 2026-07-29
- [x] Phase 124: SUPA-FIX — Migraciones aditivas a PROD (7/7) — 2026-07-29
- [x] Phase 125: E2E — Pasada final producto-a-producto sobre el deploy real (7/7) — 2026-07-29

**13 fases · 59 planes · 13/13 con VERIFICATION.md · 360 commits · 355 archivos (+81.158/−3.580) · 2026-07-27 → 2026-07-29.**
Suite `app/` 1577→1590 · guard lockdown 22→35 · guards de régimen 14/14 (172 tests). 7 migraciones escritas (`0073`–`0079`), **5 aplicadas** (`0074`, `0076`, `0077`, `0078`, `0079`).

**Deuda que viaja (aceptada por el operador, no oculta):** 🔴 `B-01` — el sitio muestra `Ver detalle (1000)` donde son **3.752** votos (71 de 186 fichas, composición distorsionada); 🔴 `OFF-6-03` cadena **SSRF** `net`→`anon`/`PUBLIC` viva; 🔴 `OP-4` `pgtap` en `public` con **1.201** funciones exec-`anon`; `OP-1` (probe REST, 3 requests) **gatea la severidad**. `0073`/`0075` **escritas y NO aplicadas** — jamás se editan, un fix futuro va como `0080`. Detalle completo: milestones/v12.0-ROADMAP.md · Audit: milestones/v12.0-MILESTONE-AUDIT.md · Requirements: milestones/v12.0-REQUIREMENTS.md

</details>

---
*v12.0 archivado: 2026-07-29 (con su deuda). Milestones anteriores archivados en `.planning/milestones/`. El próximo milestone añade su sección aquí.*
