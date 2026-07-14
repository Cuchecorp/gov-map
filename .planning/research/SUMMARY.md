# Project Research Summary

**Project:** Observatorio del Congreso 360 - Milestone v7.0 "Votos, dinero y cierre tecnico"
**Domain:** Plataforma civica de datos legislativos - dos frentes ADITIVOS sobre stack existente (TS/Deno + Supabase + R2 + Next.js 16)
**Researched:** 2026-07-13
**Confidence:** HIGH (los 4 investigadores verificaron contra el CODIGO REAL del monorepo, no contra training data)

## Executive Summary

**El hallazgo rector, sobre el que convergieron los 4 investigadores, cambia la naturaleza entera del milestone: el codigo de AMBOS frentes de v7.0 YA EXISTE.** P3 (voto individual) vive en `packages/votos/` + `packages/tramitacion/` (parsers, reconciliacion DIPID determinista fail-closed, modelo `voto` con las 5 opciones, migracion `0019`, RPCs, superficies en `app/components/`). P5 (dinero) vive COMPLETO en `packages/dinero/` (conectores ChileCompra + SERVEL, `harvest-rut.ts`, reconciliacion RUT-exacta, `money-gate.ts`, superficies). Fue construido code-complete durante v2.0 y quedo *source-limited / data-pending / gated* - **no unbuilt**. Por eso v7.0 NO es construccion net-new: es **WIRING + validacion de endpoint LIVE + backfill de datos + GATING deny-by-default**. Cualquier plan que proponga "crear tabla `voto_individual`", "escribir conector ChileCompra" o "modelar aporte" es redundante y debe rechazarse - forkearia el modelo y romperia la idempotencia por clave natural.

**El trabajo real, en cambio, es de cinco tipos por frente: (1) caracterizar/re-validar el endpoint fuente contra respuestas LIVE, (2) cablear la ingesta de dos etapas fuente->R2->Supabase (los runners de votos/dinero HOY bypasean el `BaseConnector` y no escriben R2 - esta es simultaneamente la deuda tecnica de dos-etapas Y el requisito de datos), (3) correr a escala con rate-limit 2-3s, (4) verificar cobertura HONESTA (declarar N/M como techo, patron v6.1), y (5) montar/gate superficies detras de flags OFF.** No hace falta ni una sola libreria nueva: la unica no-base es `exceljs@4.4.0` (SERVEL `.xlsx`) y ya esta instalada. La unica dependencia operacional genuinamente nueva es un **ticket de ChileCompra** (10.000 req/dia), que el operador solicita una vez via Clave Unica.

**Los dos riesgos son EXISTENCIALES y amplificados por la naturaleza del dato.** Riesgo #1 (identidad que falla en silencio): un voto mal atribuido es **directamente difamatorio y verificable como falso** por la propia fuente - el peor caso posible. Mitigacion: golden set DIPID->maestra ANTES del backfill masivo; NUNCA name-match para votos (los roll-calls traen ID); FK sigue siendo `EnlaceConfirmado | null` branded. Riesgo #2 (la "maquina de sospechas"): el voto invita a inferir "alineamiento/rebeldia" y el dinero invita a insinuar "compro el voto". Mitigacion: linter anti-insinuacion extendido a las superficies de voto Y dinero; co-votacion EXCLUIDA del MVP; conteos factuales nunca scores; caveat "Como leer esto" en cada superficie. Dos gates que ningun agente inventa ni flipea: **RUT-01** (dato fisico, no flag) y el **sign-off legal 21.719** (acto humano; plena vigencia 2026-12-01).

## Key Findings

### Recommended Stack

**v7.0 necesita CERO stack nuevo.** El framework base (`@obs/ingest`, `fast-xml-parser@5`, `zod@4`, `@supabase/supabase-js@2`, R2 via `@obs/ingest`) ya cubre ambos frentes, y los conectores/parsers/modelos ya estan en el repo. Detalle en [STACK.md](./STACK.md).

**Core technologies (TODAS ya en repo - reusar, no re-agregar):**
- **`@obs/ingest` BaseConnector** - rate-limit 2-3s serial/host, robots, UA, R2 dos-etapas, hash-check - es el UNICO sitio con la politica de red; los runners de votos/dinero deben ENRUTAR por aqui (hoy lo bypasean = la deuda).
- **fast-xml-parser `^5.9.2`** - parsea Camara `getVotacion_Detalle` (XML voto-a-voto) y Senado `votaciones.php`; ya maneja las formas `#text`/`@_Codigo`/nil.
- **zod `^4.4.3`** - gate de contrato de XML de voto + JSON ChileCompra + filas xlsx SERVEL; que un cambio de shape falle RUIDOSO.
- **`@supabase/supabase-js@2.108.2`** - escribe `voto`/`contrato`/`aporte`; recordar cap PostgREST 1k -> paginar `.order().range()` SIEMPRE (gotcha v6.1).
- **exceljs `4.4.0`** (ya instalada) - unica libreria no-base; parsea el `.xlsx` de SERVEL desde Azure Blob.

**Dependencia operacional nueva (NO codigo):** ticket ChileCompra (`CHILECOMPRA_TICKET` en `.env`, 10k req/dia, RUT con puntos+guion+DV en la query, redactado en logs). SERVEL no necesita secreto (GET anonimo).

### Expected Features

Detalle en [FEATURES.md](./FEATURES.md). Regla rectora sobre TODO: cada dato lleva fuente+fecha+enlace; el sistema describe el HECHO, nunca infiere motivo/intencion/causalidad.

**Must have (table stakes v7.0, deny-by-default construible ya):**
- **Voto individual nominal** (Camara via opendata + Senado) reconciliado fail-closed - sin esto no hay P3.
- **Historial de votos en la ficha del parlamentario** con enlace a votacion y proyecto - el 360 real.
- **Asistencia/ausencia con caveat de contexto obligatorio** (pareo como categoria propia, nunca "ausente" ni "flojo").
- **Desglose nominal bajo el agregado ya existente** + leyenda anti-insinuacion en cada superficie de voto.

**Should have (diferenciadores, detras de flag/gate):**
- **RUT-01 backfill** - prerrequisito duro de datos; construir aunque el resto quede gated.
- **SERVEL "quien financio a X"** + **ChileCompra contratos por RUT exacto** (juridicas nunca por LLM), detras de `MONEY_PUBLIC_ENABLED` OFF.
- **Alineamiento con bancada DESCRIPTIVO** (coincidio con la mayoria de su bancada en N/M) - alto riesgo de insinuacion, gated.

**Defer (v7.x+, solo tras sign-off legal):**
- **Cruce dinero x sector x lobby** en `cruce_senal` - maximo impacto reputacional.
- **Timeline dinero x tramitacion** - maxima tentacion de causalidad por yuxtaposicion temporal.
- **Ficha de entidad 360** (aportante/proveedor) - depende de `entidad_tercero` + RUT-01 maduros.

**Anti-features (PROHIBIDOS por la regla rectora):** score de "lealtad/consistencia/ideologia", etiquetas cualitativas de postura ("consistentemente voto a favor de X" - la linea que TheyWorkForYou cruza y nosotros no), rankings "los mas ausentes/rebeldes/financiados", inferir presion de partido, marcar ausencias como negativas, "compro su voto", score de corrupcion/conflicto, publicar RUT/familiares.

### Architecture Approach

Detalle en [ARCHITECTURE.md](./ARCHITECTURE.md). **v7.0 se integra a arquitectura EXISTENTE: caracterizar-endpoint -> wire dos-etapas (R2) -> correr a escala -> verificar cobertura honesta -> montar/gate.** Casi todo componente es MODIFICADO / CABLEADO / EJECUCION, rara vez NUEVO.

**Componentes mayores (todos existen; v7.0 los reusa):**
1. **`@obs/ingest` BaseConnector** - Etapa 1 LOCKED (cache->robots->rate->fetch->drift->R2->snapshot). Reusar VERBATIM; los runners de votos/dinero deben enrutar por aqui.
2. **`@obs/votos` / `@obs/tramitacion`** - parsers de voto Camara (DIPID) + Senado (nombre->`seq:<n>`); MODIFICAR para dos etapas + correr a escala.
3. **`@obs/identity` `matchDeterminista` / `EnlaceConfirmado`** - reconciliacion fail-closed, unico mint site, RUT nunca al LLM. Reusar VERBATIM.
4. **`@obs/dinero` (completo)** - conectores + harvest-rut + reconciliacion RUT-exacta + writers. Wire real + correr; SERVEL manual LOCAL por eleccion.
5. **`cruces.materializar_cruces()` (0039)** - MODIFICAR: extender token `lobby_sector_aporte` (ya RESERVADO en la migracion para esta fase, gated por RUT-01). FULL REBUILD transaccional.
6. **`app/lib/money-gate.ts`** - chokepoint `moneyPublicEnabled` fail-closed; wire de superficies por aqui, nunca leyendo env cruda.

**Patrones LOCKED a respetar en cada fase:** dos etapas fuente->R2->Supabase; reconciliacion fail-closed con branded `EnlaceConfirmado`; doble candado deny-by-default (RLS + gate presentacion); materializador FULL REBUILD security-definer.

### Critical Pitfalls

Detalle en [PITFALLS.md](./PITFALLS.md). El pitfall #1 de v7.0 NO es "construir mal" - es **REGRESIONAR patrones fail-closed ya correctos al escalarlos** y **saltarse los prerrequisitos del mundo real**.

1. **Atribuir un voto a la persona equivocada (riesgo #1 amplificado)** - un voto mal reconciliado es difamatorio y verificable como falso. Evitar: cruce DIPID->maestra determinista, PUNTO; nunca name-match para votos; golden set DIPID->maestra ANTES del backfill (los DIPID se reciclan entre legislaturas = la trampa); UI solo muestra `confirmado`.
2. **opendata.camara.cl sin validar -> rompe en silencio o cambia semantica** - dos endpoints, dos namespaces, codigos `Valor 1=si/0=no` que si se invierten producen el voto opuesto silenciosamente. Evitar: **Fase 1 de P3 = validar/caracterizar contra respuestas LIVE** antes del conector de produccion; fijar el mapeo de opcion con test; cross-check totales voto-a-voto vs totales del boletin.
3. **Inferir "alineamiento/rebeldia/disciplina" (riesgo #2)** - el voto es el dato que MAS invita a la maquina de sospechas. Evitar: superficies descriptivas por parlamentario x tema (comparar contra mediana de camara, nunca par-a-par); linter anti-insinuacion sobre las superficies de voto; co-votacion permanece OFF tras sign-off.
4. **Cruzar dinero por RUT antes de que RUT-01 exista fisicamente** - sin RUT en la maestra el cruce da cero matches (presentado como "sin vinculos") o, peor, matches falsos por name-match. Evitar: **RUT-01 como fase BLOQUEANTE secuenciada ANTES de cualquier cruce**; medir/declarar cobertura N/M; name-match NUNCA escribe `rut` (name-uniqueness != RUT-ownership); guard CI.
5. **Encender MONEY_PUBLIC_ENABLED sin sign-off legal 21.719 (o que un agente lo flipee)** - riesgo juridico-existencial. Evitar: construir TODO hasta el gate deny-by-default; el flip requiere `signoff: approved` en el dossier legal = acto exclusivamente humano; guard CI anti-flip; chokepoint unico.
6. **Afirmar "empresa ligada al parlamentario" sin base solida (difamacion)** - Evitar: persona juridica SOLO por RUT exacto fail-closed, nunca LLM/name-match; presentar como conteos factuales con provenance, nunca "empresa ligada a".

## Implications for Roadmap

**Marco rector para el roadmapper:** redactar cada fase como EJECUCION/WIRING/COBERTURA marcando cada componente **YA-EXISTE / MODIFICADO / EJECUCION**, NO como construccion net-new. Fases MUY granulares (directiva del operador). La secuencia de los 4 investigadores CONVERGIO; abajo esta transcrita.

### Fase 1: P3a - Validar/caracterizar opendata.camara.cl LIVE
**Rationale:** Bloqueante historico DECLARADO de P3 (WAF gubernamental). Ningun voto de Camara es construible hasta caracterizar la forma viva del endpoint. El Senado ya trae voto por nombre -> P3 puede paralelizar por Senado mientras se valida Camara.
**Delivers:** Respuestas LIVE crudas guardadas en R2 como fixtures autoritativos; confirmacion de que `parse-camara-votacion` matchea la forma viva; mapeo `Valor->Seleccion` fijado con test; codes Abstencion/Pareo confirmados (Assumption A1 nunca confirmada live).
**Addresses:** Voto individual nominal (habilitador).
**Avoids:** Pitfall #2 (endpoint sin validar rompe en silencio).
**Componentes:** EJECUCION (probe LIVE), `connector-camara.ts` ya existe.

### Fase 2: P3b - Wire dos etapas + golden set DIPID + backfill Camara a escala
**Rationale:** El runner `run-camara-votos.ts` HOY no escribe R2 (0 snapshots) -> cablear la Etapa 1 mata la deuda de dos-etapas Y cumple el requisito de P3 a la vez. El golden set DIPID->maestra es el gate de calidad ANTES del backfill masivo.
**Delivers:** Ingesta fuente->R2->Supabase re-ejecutable con `--from-r2`; golden set DIPID validado (~155 diputados vigentes); `voto` individual poblado a escala; cobertura HONESTA declarada (% confirmado vs no_confirmado).
**Uses:** `@obs/ingest` BaseConnector, fast-xml-parser, `EnlaceConfirmado` branded.
**Implements:** dos-etapas LOCKED + reconciliacion fail-closed.
**Avoids:** Pitfall #1 (voto mal atribuido).
**Componentes:** MODIFICADO (wiring net-new), modelo `voto` YA-EXISTE.

### Fase 3: P3c - Paridad Senado + superficies de analisis de voto
**Rationale:** Senado trae voto por nombre -> `probable/no_confirmado` (nunca fabrica FK). Las superficies cierran el 360; los componentes existen, falta el corte por tema/sesion + leyenda + gate BrowserOS.
**Delivers:** Voto Senado a escala; historial en ficha; asistencia/ausencia con caveat; desglose nominal bajo el agregado; leyenda anti-insinuacion.
**Addresses:** Historial de votos, asistencia/ausencia, desglose nominal (table stakes).
**Avoids:** Pitfall #3 (alineamiento/rebeldia) - linter extendido a voto + gate BrowserOS.
**Componentes:** MODIFICADO (montaje + gate), RPCs YA-EXISTEN.

### Fase 4: P5a - RUT-01 backfill (BLOQUEANTE de todo P5)
**Rationale:** DATO, no flag. Sin RUT fisico en la maestra, todo cruce de dinero rinde `null` - construir superficies antes seria vacio honesto. Es un checkpoint de OPERADOR (write remoto via db-url).
**Delivers:** RUT backfilleado a la maestra (Track B seed curado como default + Track A SERVEL como corroboracion, DV-gate modulo-11); cobertura N/M de RUT DV-valido MEDIDA y DECLARADA.
**Avoids:** Pitfall #4 (cruzar dinero sin RUT-01).
**Componentes:** EJECUCION (checkpoint operador), `harvest-rut.ts`/`runBackfillRut` YA-EXISTEN.

### Fase 5: P5b - Wire dos etapas ChileCompra + SERVEL LOCAL
**Rationale:** Ambos conectores existen; falta el wire R2 (`ingest-run.ts` marca "R2 BLOQUEADO"). ChileCompra por RUT (2 pasos, ticket 10k/dia); SERVEL manual por eleccion (fragil, LOCAL, no cron).
**Delivers:** Contratos ChileCompra por RUT exacto + aportes/gastos SERVEL, ambos con dos etapas re-ejecutables; fecha de corte visible; freshness extendido.
**Uses:** `connector-chilecompra.ts`, `connector-servel.ts`, exceljs, ticket operador.
**Avoids:** Pitfall #6 (empresa ligada), Pitfall #7 (SERVEL desactualizado como live).
**Componentes:** MODIFICADO (wire R2), conectores YA-EXISTEN.

### Fase 6: P5c - Extender materializador + montar superficies MONEY (gated OFF)
**Rationale:** El token `lobby_sector_aporte` ya esta RESERVADO en `0039` para esta fase. Superficies detras de `moneyPublicEnabled` OFF. El agente construye hasta el gate, NUNCA flipea.
**Delivers:** `cruce_senal` extendido con senal de aporte por sector (conteos factuales, nunca score); superficies MONEY montadas OFF + leyenda anti-insinuacion + gate BrowserOS.
**Avoids:** Pitfall #5 (flag sin sign-off) - construido deny-by-default; guard CI anti-flip.
**Componentes:** MODIFICADO (migracion aditiva + montaje), superficies YA-EXISTEN.

### Fase 7: Deuda tecnica / hardening (paralelizable)
**Rationale:** Independiente de P3/P5. `source_snapshot` + `--from-r2` SE FUNDEN con P3/P5 (votos/dinero son los conectores sin R2). Lo demas es paralelizable en cualquier momento.
**Delivers:** cursor leylobby, `CLOUDFLARE_API_TOKEN` en CI, rotacion round-robin del cron leyes-weekly (dilucion corpus 3.657), typography island `.net-*`. Rotar DB password (B26) = accion operador.
**Componentes:** Independientes/frontend/operador.

### Gate legal humano (fuera del alcance del agente)
Sign-off 21.719 en el dossier legal -> autoriza el flip de `MONEY_PUBLIC_ENABLED`. Acto humano real que el operador provee; el operador PRE-APROBO encender cuando cada fase llegue a su gate con suite verde, pero la aprobacion NO reemplaza la revision.

### Phase Ordering Rationale

- **P3 antes de P5** (directiva PROJECT.md): el voto es construible ya (deny-by-default sin flag legal duro); el dinero esta gated por RUT-01 + 21.719.
- **Dentro de P3: validar endpoint -> wire dos-etapas -> correr -> paridad Senado -> superficies** - el orden respeta la dependencia real (no se puede parsear sin caracterizar; no se escala sin golden set).
- **Dentro de P5: RUT-01 SIEMPRE primero** - es DATO bloqueante; cualquier otra secuencia produce cruces vacios o falsos.
- **Deuda tecnica se FUNDE con P3/P5 donde toca los mismos conectores** (source_snapshot/`--from-r2`) y se paraleliza donde es independiente.

### Research Flags

**Fases que necesitan investigacion mas profunda durante planning:**
- **Fase 1 (P3a validacion endpoint):** el endpoint opendata fue caracterizado LIVE 2026-06-18/2026-07-10 pero la confianza en que esta UP HOY a escala es MEDIUM hasta el spike. Los codes Abstencion/Pareo (Assumption A1) nunca se confirmaron live. Spike obligatorio de caracterizacion.
- **Fase 5 (P5b ChileCompra/SERVEL):** el host Azure Blob de SERVEL es MEDIUM-HIGH (verificado como target del conector, no como feed estable); SERVEL no expone indice machine-readable -> toil de operador por eleccion. El bulk OCDS de ChileCompra (`datos-abiertos.chilecompra.cl`) es MEDIUM (mecanica de descarga no documentada) - validar en spike si se necesita.

**Fases con patrones establecidos (skip research-phase):**
- **Fases 2, 3, 6:** wiring de dos-etapas, reconciliacion fail-closed, materializador FULL REBUILD y gate deny-by-default son patrones YA establecidos y probados en el repo (v4.0-v6.1). Copiar el patron, no reinventar.
- **Fase 7:** deuda/hardening sobre patrones conocidos.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verificado contra codigo en repo; cero librerias nuevas (exceljs ya instalada). Dos spikes flaggeados: opendata UP-hoy, SERVEL Azure Blob. |
| Features | HIGH | TheyWorkForYou/GovTrack/OpenSecrets documentan explicitamente su postura anti-insinuacion (lineas rojas claras). LOW solo en cobertura exacta de SERVEL/opendata (fuentes fragiles no validadas aun a escala). |
| Architecture | HIGH | Verificado contra el codigo real del monorepo (migraciones aplicadas, componentes, gates), no contra training data. |
| Pitfalls | HIGH | Fundado en el codigo real (`@obs/votos`, `@obs/dinero`, `@obs/identity`, parsers, gates). Los patrones fail-closed a preservar son verificables en el repo. |

**Overall confidence:** HIGH - el hallazgo rector (codigo ya existe -> v7.0 es wiring/datos/gating) es CONVERGENTE entre los 4 investigadores y verificado contra el repo.

### Gaps to Address

- **opendata.camara.cl UP a escala HOY:** confianza en la SHAPE es HIGH; en la disponibilidad viva a escala es MEDIUM. -> Spike de caracterizacion LIVE como Fase 1 (bloqueante duro); si falla, fallback a `getVotaciones_Boletin` agregados + re-plan del bloque VOTE (contingencia ya prevista en PROJECT.md). No cambiar de stack - el fallo seria de fuente, no de tooling.
- **Codes Abstencion/Pareo (Assumption A1):** hoy resueltos por `#text`, nunca confirmados live. -> Fijar con test en la fase de caracterizacion; que un mismatch falle RUIDOSO (zod gate).
- **Cobertura RUT en la maestra:** ningun catalogo oficial expone RUT (Senado no lo trae; Camara `WSDiputado` lo trae vacio) -> RUT entra solo por Track A (SERVEL fragil) o Track B (seed curado). -> Medir/declarar N/M como techo honesto; el cruce de dinero solo cubre parlamentarios con RUT presente.
- **SERVEL sin feed estable:** toil de operador por eleccion (descubrir/descargar el workbook correcto). -> Una vez el operador deja el `.xlsx` en R2, el pipeline re-corre sin tocar la fuente.
- **Ticket ChileCompra:** dependencia operacional (10k req/dia). -> Si el universo de diputados excede la cuota, split del crawl en varios dias (backfill LOCAL reanudable) o tickets adicionales.

## Sources

### Primary (HIGH confidence)
- Codigo del monorepo (verificacion directa): `packages/votos/*`, `packages/tramitacion/src/{model,connector-camara,connector-senado,parse-camara-votacion,parse-senado-votacion}.ts`, `packages/dinero/*`, `packages/identity/src/{backfill-rut,harvest-rut}.ts`, `packages/ingest/src/base-connector.ts`, `app/lib/{money-gate,voto-presentacion}.ts`, `app/components/*`
- Migraciones aplicadas: `0008` (voto), `0019` (voto_asistencia_y_ficha), `0023` (dinero), `0024` (servel), `0039` (cruce_senal, token `lobby_sector_aporte` reservado)
- `opendata.camara.cl` WSDL + `getVotacion_Detalle` - schema Diputado/DIPID/Opcion Codigo, codes 1/0/4 confirmados live 2026-06-18
- `api.mercadopublico.cl` - ticket flow, 10k/dia, `BuscarProveedor`->`ordenesdecompra` 2 pasos, RUT dotted+DV
- TheyWorkForYou / GovTrack / OpenSecrets - caveats anti-interpretacion explicitos (whip, ausencias, party-alignment != rebeldia, "impossible to know motivation")
- `.planning/PROJECT.md` / `CLAUDE.md` - riesgos existenciales #1/#2, milestone v7.0, gates, RUT-01 como dato, 21.719, dos etapas LOCKED

### Secondary (MEDIUM confidence)
- `datos-abiertos.chilecompra.cl` - OCDS/CSV bulk existe; mecanica de descarga no documentada en la pagina
- `repodocgastoelectoral.blob.core.windows.net` (SERVEL Azure Blob) - target del conector, verificado como host, no como feed estable
- SERVEL portales (`aportes.servel.cl`, centro-de-datos) - NO REST API, incorporacion gradual; Ley 19.884 (nombre+RUT aportante)
- VotaInteligente / Fundacion Ciudadano Inteligente - referencia chilena

### Tertiary (LOW confidence - needs validation)
- opendata.camara.cl UP a escala HOY - validar en spike Fase 1
- Codes Abstencion/Pareo (Assumption A1) - confirmar live con test

---
*Research completed: 2026-07-13*
*Ready for roadmap: yes*
