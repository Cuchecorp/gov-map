# Requirements — Milestone v2.0 Parlamentarios 360

**Core Value:** La ciudadanía puede responder, sobre cualquier parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato con fuente, fecha y enlace, sin afirmar nunca intención ni causalidad.

**Data posture (LOCKED):** minimización + trazabilidad estricta. Solo se muestra lo que la fuente pública ya publica, con fuente/fecha/enlace. RUT y datos de familiares quedan en uso interno para reconciliar identidad. Ley 21.719 (plena vigencia 2026-12-01) → pasada legal antes de exposición pública amplia.

---

## v2.0 Requirements

### IDENT — Completitud de identidad (transversal, prerrequisito)

> Toda atribución por parlamentario (voto, reunión, contrato, aporte) hereda el riesgo existencial #1. Estos requisitos generalizan la guarda de v1.0 a las nuevas fuentes.

- [ ] **IDENT-10**: El sistema completa (backfill) el `rut` de la maestra de parlamentarios server-side, de uso interno (nunca expuesto a `anon`), para habilitar el cruce por RUT de las fuentes de dinero/probidad.
- [ ] **IDENT-11**: El golden set de reconciliación se extiende con casos de homónimos y colisión de RUT (persona natural vs jurídica, DV inválido) propios de SERVEL/ChileCompra; el gate CI ≥0.95 sigue bloqueando.
- [ ] **IDENT-12**: La guarda de enlace-confirmado se generaliza a un invariante tipado a nivel de writer: ningún `*Writer` puede fijar un FK `parlamentario_id` salvo match `determinista`/`confirmado`; en caso contrario, NULL + mención cruda + marca de identidad no verificada.

### VOTE — Voto individual

- [ ] **VOTE-01**: Un spike valida en vivo `opendata.camara.cl` (`getVotaciones_Boletin`/`getVotacion_Detalle`): alcanzabilidad tras el WAF, que `Diputado/Id` y `Opcion` vengan poblados (no null), cobertura histórica y comportamiento de rate. Resultado: confirmar y construir, o replanificar el bloque VOTE.
- [ ] **VOTE-02**: El conector `@obs/votos` ingiere el voto individual por diputado y lo cruza determinísticamente por `DIPID` → `id_diputado_camara`, enriqueciendo el modelo de voto existente con provenance por fila (sin LLM).
- [ ] **VOTE-03**: El ciudadano ve, en la ficha del parlamentario, la lista de sus votos (A favor / En contra / Abstención / Pareo / Ausente) y su asistencia, con la guarda de identidad aplicada.
- [ ] **VOTE-04**: El ciudadano puede ver cómo vota un parlamentario por tema/materia del proyecto (reusa los embeddings de v1.0).
- [ ] **VOTE-05**: El ciudadano ve una métrica observable de "rebeldías" (cuántas veces votó distinto a su bancada), presentada como dato, sin juicio ni etiqueta.

### INT — Lobby + Patrimonio/Intereses

- [ ] **INT-01**: El conector `@obs/lobby` ingiere las reuniones de la Ley del Lobby (`leylobby.gob.cl`) y crea una sub-maestra de contrapartes (lobistas/gestores de interés).
- [ ] **INT-02**: El ciudadano ve la lista de reuniones de lobby de un parlamentario, con la contraparte como texto crudo (sin enlazar a una identidad salvo que esté confirmada) y provenance por fila.
- [ ] **INT-03**: El conector `@obs/probidad` ingiere las declaraciones de patrimonio e intereses (InfoProbidad, CSV/SPARQL) de forma literal, con fecha de presentación y atribución CC BY 4.0 visible.
- [ ] **INT-04**: El ciudadano ve las declaraciones de patrimonio e intereses de un parlamentario con su historial de versiones (qué declaró y cuándo).
- [ ] **INT-05**: El ciudadano puede comparar las declaraciones de patrimonio de un parlamentario en el tiempo (lado a lado), sin ningún veredicto de "enriquecimiento" — solo muestra los datos.

### MONEY — Dinero (financiamiento + contratos)

- [ ] **MONEY-01**: El conector `@obs/dinero` ingiere contratos del Estado por RUT desde ChileCompra (`api.mercadopublico.cl`), valida el DV del RUT (módulo-11), etiqueta persona natural vs jurídica, y crea una sub-maestra de contratistas.
- [ ] **MONEY-02**: El ciudadano ve los contratos del Estado asociados al RUT de un parlamentario, redactados estrictamente como "contratos asociados al RUT" (nunca "del parlamentario"), con provenance y fecha de corte por fila.
- [ ] **MONEY-03**: El conector SERVEL de `@obs/dinero` ingiere los aportes de campaña verbatim, con drift bloqueante y reconciliación de completitud (una corrida parcial se pone en cuarentena, no emite filas silenciosamente), y crea una sub-maestra de donantes.
- [ ] **MONEY-04**: El ciudadano ve el financiamiento de campaña de un parlamentario verbatim, con fuente/fecha/enlace.
- [ ] **MONEY-05**: El ciudadano puede ver contratos/aportes agregados por contraparte (donante o empresa), usando las sub-maestras de donantes/contratistas.

### NET — Grafo de influencia

- [ ] **NET-01**: El sistema materializa un modelo de aristas `entidad`/`arista` (vía proc `pg_cron` + RPC con CTE recursiva), donde cada arista lleva provenance y ventana temporal, y ambos extremos tienen identidad `confirmado`.
- [ ] **NET-02**: El ciudadano explora un grafo de relaciones (UI `@xyflow/react`, client island) con filtros por tipo de arista y tiempo, sin lenguaje causal y con la fuente de cada arista trazable.

### LEGAL — Compuertas legales (transversal)

- [ ] **LEGAL-01**: Pasada de asesoría legal (Ley 21.719) que cubra republicación, datos sensibles (afiliación política) y terceros privados (donantes/lobistas), aprobada ANTES de exponer públicamente el bloque MONEY.
- [ ] **LEGAL-02**: Sign-off legal sobre el framing del grafo aprobado ANTES de exponer públicamente el bloque NET.
- [ ] **LEGAL-03**: Toda columna PII nueva queda oculta a `anon` por RLS (igual que `parlamentario.rut`) y la compuerta `data-routing` del LLM se extiende a los nuevos datos sensibles (ningún RUT/PII llega al LLM).

---

## Future Requirements (diferidos a v2.1+)

- **NET-D — Descubrimiento de contraparte compartida**: ver "comparten contratista/donante X" entre parlamentarios. Diferido: mayor riesgo de lectura causal; esperar madurez de framing + legal.
- **Cruces inter-bloque** (declaración↔proyecto, dinero↔voto mostrados juntos): diferidos hasta después de la revisión legal — alto riesgo "máquina de sospechas".

## Out of Scope (exclusiones explícitas)

- **Scores de ideología/influencia/poder** — inventan un veredicto a partir de correlación. Viola la regla rectora.
- **Flags de "conflicto de interés"** — el sistema muestra hechos, no concluye conflictos.
- **Correlación donación→voto** — la más pedida y la más difamatoria; prohibida.
- **Aristas inferidas por LLM en el grafo** — solo aristas con fuente verificable.
- **Alertas de "enriquecimiento"** sobre deltas de patrimonio — muestra, no concluye.
- **Exposición pública de RUT y datos de familiares** — uso interno para reconciliar identidad; minimización por diseño.
- **Conclusiones de causalidad/intención** — el sistema nunca afirma motivo; solo correlaciones con contexto temporal y fuente.

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| IDENT-10 | Phase 9 | Pending |
| IDENT-11 | Phase 9 | Pending |
| IDENT-12 | Phase 9 | Pending |
| VOTE-01 | Phase 8 | Pending |
| VOTE-02 | Phase 10 | Pending |
| VOTE-03 | Phase 10 | Pending |
| VOTE-04 | Phase 10 | Pending |
| VOTE-05 | Phase 10 | Pending |
| INT-01 | Phase 11 | Pending |
| INT-02 | Phase 11 | Pending |
| INT-03 | Phase 12 | Pending |
| INT-04 | Phase 12 | Pending |
| INT-05 | Phase 12 | Pending |
| MONEY-01 | Phase 14 | Pending |
| MONEY-02 | Phase 14 | Pending |
| MONEY-03 | Phase 15 | Pending |
| MONEY-04 | Phase 15 | Pending |
| MONEY-05 | Phase 16 | Pending |
| NET-01 | Phase 18 | Pending |
| NET-02 | Phase 18 | Pending |
| LEGAL-01 | Phase 13 | Pending |
| LEGAL-02 | Phase 17 | Pending |
| LEGAL-03 | Phase 9 | Pending |

**Coverage:** 24/24 v2.0 requirements mapped ✓ · No orphans · No duplicates
