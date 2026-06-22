# Requirements — Milestone v3.0 Cobertura de datos

**Core Value:** La ciudadanía puede responder, sobre cualquier proyecto o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato con fuente, fecha y enlace, sin afirmar nunca intención ni causalidad.

**Premisa del milestone (LOCKED):** El shell de producto (frontend v1.0+v2.0) está terminado y en vivo. La brecha para "ser útil" es DATOS + COBERTURA + ADJUDICACIÓN DE IDENTIDAD, no pantallas. v3.0 NO construye UI nueva: puebla la nube con datos reales, adjudica identidad, arregla provenance y abre los gates (operador + legal) que hacen la data visible. Toda capacidad de código de v2.0 ya existe; lo que falta es ejercerla LIVE a escala y escribir el resultado en producción.

**Data posture (LOCKED):** minimización + trazabilidad estricta. Solo se muestra lo que la fuente pública ya publica, con fuente/fecha/enlace. RUT y datos de familiares quedan en uso interno para reconciliar identidad; NUNCA fabricar un RUT. Ley 21.719 (plena vigencia 2026-12-01) → pasada legal antes de exposición pública amplia.

---

## v3.0 Requirements

### LOBBY — Cobertura y adjudicación de reuniones de lobby

> Hoy la sección lobby está 100% vacía en TODAS las fichas: las audiencias en `lobby_audiencia` están `estado_vinculo='no_confirmado'` → no enlazan, y la fuente actual (`leylobby.gob.cl`) NO cubre Cámara/Senado. Doble causa raíz: fuente + identidad.

- [ ] **LOBBY-01**: El conector `@obs/lobby` amplía su fuente a `camara.cl/transparencia/ley_de_lobby.aspx` (allowlisted) — la fuente real de las audiencias de parlamentarios, ausentes de `leylobby.gob.cl` — con un spike previo que valida la estructura de la página antes de cablear el crawl (rate-limit 2–3s LOCKED, drift bloqueante, R2 crudo primero).
- [ ] **LOBBY-02**: Una corrida LIVE acotada ingiere las audiencias de lobby a escala (todos los parlamentarios elegibles) y escribe a la nube desde el crudo en R2 (Etapa 2), idempotente y reanudable.
- [ ] **LOBBY-03**: El operador adjudica la identidad de las audiencias ingeridas (pipeline de confirmación por nombre, auditado en `identidad_audit`): solo un match `determinista`/`confirmado` puebla el FK del sujeto pasivo; el resto queda `no_confirmado` + texto crudo. El RPC `lobby_de_parlamentario` deja de devolver vacío para los parlamentarios con audiencias confirmadas.
- [ ] **LOBBY-04**: El ciudadano ve, en la ficha de un parlamentario con audiencias confirmadas, sus reuniones de lobby reales (contraparte como texto crudo + provenance por fila), en lugar del honest-state vacío.

### PAT — Cobertura de patrimonio e intereses

> El conector `@obs/probidad` existe (Phase 12) pero no se pobló en la nube por parlamentario; la sección muestra honest-state vacío.

- [ ] **PAT-01**: Una corrida LIVE `@obs/probidad` (InfoProbidad) ingiere las declaraciones de patrimonio e intereses por parlamentario y las escribe a la nube versionadas por `(fuente_id, fecha_presentacion)`, idempotente, con atribución CC BY 4.0 y crudo en R2 primero.
- [ ] **PAT-02**: El ciudadano ve las declaraciones reales de patrimonio/intereses de un parlamentario con su historial de versiones y fecha de presentación prominente, en lugar del honest-state vacío.

### VOT — Cobertura de votaciones

> Hoy solo 2 boletines / 10 votaciones. El código (`@obs/votos`, RPC `votos_de_parlamentario`) está validado; falta ejercerlo a escala.

- [ ] **VOT-01**: Una corrida masiva (escape hatch GitHub Actions o pgmq por lotes) ingiere votaciones desde `opendata.camara.cl` (`getVotaciones`/`getVotacion_Detalle`) a escala de legislatura, con cruce determinista DIPID→`id_diputado_camara`, idempotente, rate-limit LOCKED, crudo en R2 primero. (Senado por nombre vía pipeline donde aplique.)
- [ ] **VOT-02**: El ciudadano ve, en las fichas, cobertura real de votaciones (muchos proyectos, no 2), con desenlace factual de cada votación y la guarda de identidad aplicada; la línea de cobertura honesta refleja el conjunto ampliado.

### PROV — Provenance de la maestra

- [ ] **PROV-01**: El header de la ficha del parlamentario muestra la provenance real de la maestra (fuente/fecha/enlace) en lugar de "fuente desconocida": el campo `origen` de cada fila de `parlamentario` se puebla con su fuente oficial (catálogo Cámara/Senado) y fecha de snapshot.

### RUT — Backfill del RUT interno (operador)

> Sin RUT no hay cruce de contratos ChileCompra (MONEY). Ninguna fuente oficial cruzable expone los 186 RUTs; el backfill es acción de operador con adjudicación humana.

- [ ] **RUT-01**: El operador puebla `parlamentario-rut.seed.json` con RUTs DV-válidos (módulo-11) + provenance por fila y corre el backfill (`updateRut` por id), de modo que la maestra tenga el `rut` interno de los parlamentarios enlazables. Un nombre único NO prueba propiedad del RUT → solo CORROBORACIÓN cuando hay match confirmado, o CANDIDATO a revisión; NUNCA fabricar. (Habilita el cruce MONEY una vez aplicado el gate legal.)

### OPS — Gates de operador (aplicar al remoto + verificar en producción)

> La data de v3.0 solo es visible tras aplicar las migraciones remotas pendientes. Aplicar SIEMPRE por `psql "$SUPABASE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 -f`, NUNCA `supabase db push` (drift `schema_migrations` ≤0025). Última aplicada: 0030 (código), pero los RPC 0026/0028 siguen sin aplicar al remoto.

- [ ] **OPS-01**: El operador aplica al Supabase remoto las migraciones/RPC pendientes (0026 `parlamentarios_publico`, 0028 `votos_instructivos`, 0030 `net` si no está) por `psql --db-url`, con pgTAP verde (0027/0029/0030 + sin regresión de 0019/0020/0023/0026) y probes de las RPC, antes de considerar poblada cualquier sección dependiente.
- [ ] **OPS-02**: Tras poblar y aplicar, un redeploy + barrido de verificación en producción confirma que las secciones (lobby, patrimonio, votaciones, provenance) muestran datos reales y que los invariantes (noindex, sin foto, sin partido, provenance por dato, MONEY/NET gated-OFF) siguen intactos.

### SIGNOFF — Compuertas legales (acción humana, mantiene los gates)

> Acción humana, no código. Los gates `MONEY_PUBLIC_ENABLED` / `NET_PUBLIC_ENABLED` siguen en OFF hasta firma. Los dossiers de preparación ya existen.

- [ ] **SIGNOFF-01**: El sign-off legal F13 (MONEY, `13-LEGAL-DOSSIER.md`, Ley 21.719) se obtiene y queda registrado → habilita encender `MONEY_PUBLIC_ENABLED` (depende de RUT-01 para que el cruce tenga datos).
- [ ] **SIGNOFF-02**: El sign-off legal F17 (NET, `17-LEGAL-DOSSIER.md`) se obtiene y queda registrado → habilita encender `NET_PUBLIC_ENABLED` (depende de LOBBY-03 confirmado para que el grafo no esté vacío).

---

## Future Requirements (diferidos a v3.1+)

- **IDEA — Completar ideas matrices faltantes** (OCR de ~8 PDFs escaneados nulos + 1 schema-fail; las 8 bloqueadas por guarda PII/RUT quedan correctamente nulas). Diferido: cobertura marginal frente a los 5 frentes principales.
- **Pulido UI menor**: distrito para diputados en el directorio (paridad con senadores); enlace "fuente oficial ↗" en `/buscar` correcto por cámara (hoy siempre apunta a `tramitacion.senado.cl`). Diferido: el milestone es de datos, no de UI; barato cuando toque frontend.
- **Cron de novedades a régimen**: confirmar/documentar la cadencia diaria L–V de ingesta incremental una vez que el snapshot base esté poblado.

## Out of Scope (exclusiones explícitas — heredadas, siguen vigentes)

- **Scores de ideología/influencia/poder** — inventan un veredicto a partir de correlación. Viola la regla rectora.
- **Flags de "conflicto de interés"** — el sistema muestra hechos, no concluye conflictos.
- **Correlación donación→voto** — la más pedida y la más difamatoria; prohibida.
- **Aristas inferidas por LLM en el grafo** — solo aristas con fuente verificable.
- **Alertas de "enriquecimiento"** sobre deltas de patrimonio — muestra, no concluye.
- **Exposición pública de RUT y datos de familiares** — uso interno para reconciliar identidad; minimización por diseño.
- **Conclusiones de causalidad/intención** — el sistema nunca afirma motivo; solo correlaciones con contexto temporal y fuente.
- **UI nueva** — el shell está cerrado; v3.0 no agrega pantallas (salvo lo que el poblamiento de datos requiera mínimamente, sin re-abrir el diseño Phase 19).

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| LOBBY-01 | TBD | Pending |
| LOBBY-02 | TBD | Pending |
| LOBBY-03 | TBD | Pending |
| LOBBY-04 | TBD | Pending |
| PAT-01 | TBD | Pending |
| PAT-02 | TBD | Pending |
| VOT-01 | TBD | Pending |
| VOT-02 | TBD | Pending |
| PROV-01 | TBD | Pending |
| RUT-01 | TBD | Pending |
| OPS-01 | TBD | Pending |
| OPS-02 | TBD | Pending |
| SIGNOFF-01 | TBD | Pending |
| SIGNOFF-02 | TBD | Pending |

**Coverage:** 14 v3.0 requirements · phases asignadas por el roadmapper · No orphans · No duplicates
