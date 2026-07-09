# Requirements — Milestone v6.0 "Confiabilidad y comprensión"

**Defined:** 2026-07-08
**Milestone goal:** El dato llega solo y se entiende solo — ingesta programada perfecta (fuentes→R2→Supabase), identidad visual propia, visualizaciones comprensibles a la primera.

## v6.0 Requirements

### CRON — Ingesta programada confiable

- [ ] **CRON-01**: El operador puede ver un inventario auditado de los 9 workflows de GitHub Actions (agenda, leyes, lobby×2, probidad, fichas-backfill, backup-parlamentario, backfill, deploy) con veredicto por cron: corre / no corre / por qué (secrets faltantes, billing, triggers), y una gap-list accionable.
- [x] **CRON-02**: Cada conector recurrente cumple las DOS ETAPAS LOCKED re-ejecutables por separado: (a) fuente→R2 crudo content-addressed (`fuente/recurso/fecha/sha256.ext`, If-None-Match), (b) R2→Supabase leyendo SOLO del crudo — re-ingestar a Supabase nunca vuelve a tocar la fuente.
- [x] **CRON-03**: Todos los conectores del cron hacen hash-check/ETag ANTES de descargar: una corrida sin novedades sale temprano sin re-descarga ni escritura (verificable en logs).
- [x] **CRON-04**: Los crons de novedades corren VERDES de punta a punta en su scheduler — GitHub Actions con secrets cargados (DEEPSEEK, R2, SUPABASE), L–V acotados e incrementales; si billing GH sigue bloqueado, existe fallback local documentado y probado (runbook + CLI idempotente).
- [x] **CRON-05**: El operador puede consultar la frescura por fuente (última corrida, último snapshot R2, último upsert a Supabase) y detectar staleness sin bucear logs — reporte CLI o superficie admin, con umbral de alerta por fuente.

### AUTOR — Autoría de proyectos (desbloquea F48)

- [x] **AUTOR-01**: Los autores de cada proyecto del corpus quedan poblados (`proyecto.autores` hoy 0/136) vía pipeline R2→Supabase, con reconciliación de identidad fail-closed: solo un match determinista/confirmado enlaza a la maestra; lo demás queda como mención cruda.
- [ ] **AUTOR-02**: La ficha de proyecto muestra autoría (F48 diferida de v5): autores con guarda de identidad (link solo si confirmado, IdentityMarker si no) + fuente/fecha/enlace, montada sobre el patrón drill-down de F55.

### BRAND — Identidad visual de gov-map

- [ ] **BRAND-01**: gov-map tiene un ícono/logo propio: SVG maestro + variantes (mono, invertido, favicon), simple, serio, interesante, public-policy oriented; explícitamente NO el estilo típico hecho-con-IA (wordmark con palabras en fuentes distintas). Selección entre ≥3 propuestas conceptuales distintas.
- [ ] **BRAND-02**: El ícono queda integrado y verificado en PROD: favicon multi-resolución, imagen OG/social, header del sitio y manifest, coherente con el design system crema/petróleo existente.

### COMP — Comprensión de visualizaciones

- [ ] **COMP-01**: La sección de cruces entre parlamentarios se entiende sin conocimiento previo: qué es una señal, cómo leer los conteos, qué NO afirma (anti-causal explícito), con leyenda "cómo leer esto" — validado por lectura fría vía BrowserOS.
- [ ] **COMP-02**: Barrido BrowserOS de las superficies clave (ficha parlamentario, ficha proyecto, /red, charts de v5) con loop captura→corrección→re-captura; todo hallazgo de comprensión P0/P1 corregido y re-verificado con nueva captura.
- [ ] **COMP-03**: Toda visualización lleva título orientado a la pregunta que responde + leyenda + fuente/fecha visible (extiende el patrón v5 a las superficies donde falte).

## Future Requirements (deferred)

- Alertas push/email de staleness (v6 entrega reporte/superficie; notificación activa después).
- Dashboard público de frescura por fuente (v6 lo entrega como herramienta de operador).
- Rediseño del grafo /red móvil (P1 de F53, sigue diferido).

## Out of Scope

- **Sign-offs legales F13/MONEY, F17/NET, 0042/cruces-flag** — firma humana exclusiva (Phase 39); un agente NUNCA flipea flags `*_PUBLIC_ENABLED`.
- **RUT-01 backfill + ChileCompra/SERVEL** (Phase 40) — bloqueado por prerrequisito de operador.
- **Rotar DB password (B26)** — acción de operador en dashboard.
- **Afirmaciones de causalidad/intención** — regla rectora intacta; COMP mejora la comprensión del hecho, nunca lo interpreta.
- **Backfill masivo en GitHub Actions** — convención LOCKED: masivo = LOCAL; el cron solo novedades acotadas.

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| CRON-01 | Phase 56 | Pending |
| CRON-02 | Phase 57 | Complete |
| CRON-03 | Phase 57 | Complete |
| CRON-04 | Phase 57 | Complete |
| CRON-05 | Phase 58 | Complete |
| AUTOR-01 | Phase 59 | Complete |
| AUTOR-02 | Phase 59 | Pending |
| BRAND-01 | Phase 60 | Pending |
| BRAND-02 | Phase 60 | Pending |
| COMP-01 | Phase 61 | Pending |
| COMP-02 | Phase 61 | Pending |
| COMP-03 | Phase 61 | Pending |

---
*Modo de trabajo v6: Fable (main loop) planifica/dirige/controla; ejecución delegada a agentes Sonnet o menores. Autónomo y ordenado.*
