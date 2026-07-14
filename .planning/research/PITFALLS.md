# Pitfalls Research — v7.0 "Votos, dinero y cierre técnico"

**Domain:** Datos públicos del Congreso de Chile — agregar voto individual (P3) y dimensión dinero (P5) a Observatorio del Congreso 360.
**Researched:** 2026-07-13
**Confidence:** HIGH (fundado en el código real del repo: `@obs/votos`, `@obs/dinero`, `@obs/identity`, `parse-camara-votacion.ts`, `money-gate.ts`, `backfill-rut.ts`, `reconciliar-contrato.ts`)

## Contexto crítico que cambia la naturaleza de estos pitfalls

**La mayoría de P3 y P5 ya existe como CÓDIGO** (v2.0 "parlamentarios 360" quedó code-complete; era source-limited/gated, no unbuilt). Existen y ya son fail-closed:

- `packages/votos/` — `runCamaraVotos` cruza DIPID→maestra DETERMINISTA, fail-closed, provenance por fila, idempotente por `(votacion_id, fuente_voter_id)`. Fue corrido source-limited (2 boletines del MVP).
- `parse-camara-votacion.ts` — YA modela las **5 opciones** (`si/no/abstencion/pareo/ausente`) y maneja los **dos namespaces/shapes** de opendata (`getVotaciones_Boletin` vs `retornarVotacionDetalle`).
- `app/lib/voto-presentacion.ts` — `pareo`/`ausente` en slate (color neutro), nunca fundidos con "en contra".
- `packages/dinero/` — connector SERVEL (xlsx Azure Blob) + ChileCompra (por RUT + ticket), `reconciliar-contrato.ts` (jurídica solo por RUT exacto, natural por RUT/nombre con cola humana), `harvest-rut.ts`, `money-gate.ts` (fail-closed, solo literal `"true"`).
- `packages/identity/` — `entidad_tercero`, `backfill-rut.ts` (DV módulo-11, provenance NOT NULL, RUT nunca a LLM ni a tabla pública).

**Implicación para el roadmapper:** El pitfall #1 de v7.0 NO es "construir mal", es **REGRESIONAR patrones fail-closed ya correctos** al escalarlos, y **saltarse los prerrequisitos del mundo real** (validar opendata, RUT-01 físico, sign-off 21.719). Los pitfalls abajo priorizan eso.

---

## Critical Pitfalls

### Pitfall 1: Atribuir un voto a la persona equivocada (riesgo existencial #1 amplificado)

**What goes wrong:**
Un voto individual mal reconciliado imputa a un parlamentario un "sí/no" que no emitió. A diferencia de un lobby o un patrimonio mal cruzado, **un voto mal atribuido es directamente difamatorio y verificable como falso** por la propia fuente. Es el peor caso del riesgo #1.

**Why it happens:**
Al escalar de 2 boletines a toda la Leg-58, la tentación es aflojar el fail-closed: aceptar un DIPID que no está en la maestra "para no perder el voto", o cruzar por nombre cuando el DIPID no matchea. El código actual **no** hace esto (cruza por `Diputado/Id` determinista y deja `no_confirmado` lo que no matchea), pero un ejecutor Sonnet que "mejora cobertura" puede introducir un name-match o un fallback silencioso.

**How to avoid:**
- El cruce de voto es **DIPID→maestra determinista, punto**. NUNCA name-match para votos (el nombre es puente para menciones libres, no para roll-calls que ya traen ID). Un DIPID fuera de la maestra → `no_confirmado`, la fila del voto se guarda con `parlamentario_id=null` y NO se muestra como atribuido.
- El FK del voto sigue siendo `EnlaceConfirmado | null` (branded): un string crudo no compila. Preservar ese tipo.
- Golden set de reconciliación DIPID→maestra ANTES del backfill masivo: verificar que el mapeo DIPID↔id_maestra es correcto para los ~155 diputados vigentes (los DIPID cambian entre legislaturas; un DIPID reciclado de una legislatura anterior es la trampa más peligrosa).
- La UI solo muestra el voto si `confirmado` (mismo guard que el link de identidad en `/proyecto`).

**Warning signs:**
- Cobertura de votos "sube" pero el % `confirmado` baja → se está imputando ruido.
- Aparece `correrPipeline`/LLM o `normalizarNombre` en el camino de votos (no debe existir ahí).
- Un DIPID con dos nombres distintos entre boletines, o un voto atribuido a un parlamentario de otra cámara.

**Phase to address:**
Fase de **modelo de voto reconciliado** (P3c). Golden set DIPID→maestra como gate ANTES del backfill masivo (P3b).

---

### Pitfall 2: opendata.camara.cl sin validar/caracterizar → rompe en silencio o cambia semántica

**What goes wrong:**
opendata.camara.cl es el **bloqueante histórico declarado** de P3 (por eso P3 estuvo out-of-scope hasta v7). Es un WS ASP.NET (.asmx) con **dos endpoints, dos namespaces y dos shapes** (`getVotaciones_Boletin` bajo `tempuri.org`; `retornarVotacionDetalle` bajo `camaradiputados/v1`), con códigos de opción numéricos (`Valor 1=Afirmativo`, `0=En Contra`) que si se invierten producen el voto opuesto — silenciosamente correcto en forma, falso en fondo.

**Why it happens:**
Se asume que el endpoint es estable y bien documentado como el `doGet.asmx`. No lo es: fue explícitamente marcado "SIN VALIDAR" en PROJECT.md. Escribir el conector antes de caracterizar el endpoint contra respuestas reales lleva a un parser que funciona con el fixture y falla (o miente) en producción.

**How to avoid:**
- **Fase 1 de P3 = validar/caracterizar el endpoint contra respuestas LIVE reales** ANTES de escribir el conector de producción. Guardar respuestas crudas en R2 como fixtures autoritativos. Ya existe `run-camara-votos.live.test.ts` (gated por `VOTOS_LIVE=1`) — usarlo como gate de caracterización.
- Bloquear el mapeo `OpcionVoto Valor → Seleccion` con un test que fije 1→si, 0→no, y verifique explícitamente pareo/abstención/dispensado contra la fuente (no asumir el orden).
- Validar cada `Votacion`/`Voto` con `VotacionSchema` (zod) antes de escribir — el gate de contrato ya existe; que un cambio de shape del WS falle RUIDOSO, no que se cargue basura.
- Cross-check de totales: el detalle voto-a-voto debe sumar a los `TotalSi/TotalNo/…` del boletín estructurado. Si no cuadra, la votación está incompleta → no publicar como total.

**Warning signs:**
- El parser depende de un solo fixture; no hay respuesta LIVE guardada en R2.
- Sumas de votos individuales ≠ totales reportados por la fuente.
- 404/500/HTML de error del WS parseado como "0 votos" en vez de como fallo.

**Phase to address:**
**Fase 1 de P3 (validación de endpoint)** — bloqueante duro, antes del conector. El mapeo de opción y el cross-check de totales, en la fase de parseo/modelo.

---

### Pitfall 3: Inferir "alineamiento", "rebeldía" o "disciplina de voto" (riesgo existencial #2)

**What goes wrong:**
El voto individual es el dato que MÁS invita a la "máquina de sospechas": comparar votos entre parlamentarios sugiere afinidad; señalar un voto contra el bloque sugiere "rebeldía"; agrupar votos sugiere causalidad política. Cualquiera de estos cruza de descriptivo a interpretativo/causal.

**Why it happens:**
Es la visualización "obvia" y periodísticamente atractiva. Pero co-votación fue EXPLÍCITAMENTE excluida del MVP (`17-LEGAL-DOSSIER §2`, señales de voto OFF hasta sign-off). La tentación de "solo mostrar quién votó igual que quién" reintroduce co_votacion por la puerta de atrás.

**How to avoid:**
- Superficies de voto **descriptivas por parlamentario × tema/sesión**, NUNCA comparativas entre parlamentarios como señal de afinidad. Ya hay precedente correcto: "Cuándo votó por trimestre" (VIZ-VOTOS) y comparativo de ausencias **vs mediana de cámara** (VIZ-COMP) — comparar contra una mediana agregada es factual; comparar par-a-par insinúa.
- El **linter anti-insinuación debe cubrir las superficies de voto** (mismo linter que cruces): prohibir vocabulario "alineado con", "se rebeló", "leal a", "en contra de su bloque", "díscolo".
- Leyenda "Cómo leer esto" anti-causal en toda superficie de voto (patrón ya establecido en cruces/charts v6.0).
- co_votación / clustering de votos permanece OFF y detrás de sign-off legal — no es un flag que un agente inventa ni enciende.

**Warning signs:**
- Aparece una vista "parlamentarios que votan como X" o una matriz de similitud de votos.
- Texto generado (labels, tooltips) que atribuye motivo o postura política.
- El linter anti-insinuación NO corre sobre los componentes de voto nuevos.

**Phase to address:**
Fase de **superficies de análisis de voto** (P3d). El linter debe extenderse a esas superficies en esa misma fase; verificación por loop BrowserOS (gate de comprensión) como en v6.0.

---

### Pitfall 4: Cruzar dinero por RUT antes de que RUT-01 exista físicamente

**What goes wrong:**
Cruzar SERVEL/ChileCompra por RUT contra una maestra donde `parlamentario.rut` está mayormente NULL produce: (a) cero matches (cruce vacío presentado como "sin vínculos") o, peor, (b) matches falsos si se rellena el gap con name-match. RUT-01 es un **prerrequisito de DATOS, no un flag** — el gate PROJECT.md es explícito: "RUT-01 debe existir físicamente antes de cruzar".

**Why it happens:**
El flag `MONEY_PUBLIC_ENABLED` y el gate legal enmascaran que la precondición real es DATO: la maestra necesita RUTs backfilleados. Un agente puede "completar P5" construyendo todo el pipeline y encolando el cruce, sin notar que la maestra tiene RUTs vacíos → el cruce corre pero cuenta mal. HALLAZGO decisivo del research (verificado LIVE 2026-06-18): **ningún catálogo oficial expone el RUT** (Senado no lo trae; Cámara `WSDiputado` lo trae vacío) → RUT entra solo por Track A (SERVEL, frágil) o Track B (seed curado `parlamentario-rut.seed.json`).

**How to avoid:**
- **RUT-01 como fase BLOQUEANTE explícita y secuenciada ANTES de cualquier cruce de dinero.** No es una casilla; es backfill real a `parlamentario.rut` vía `runBackfillRut` (Track B seed curado como default garantizado; Track A SERVEL como corroboración).
- Medir cobertura de RUT en la maestra (N/M con RUT DV-válido) y DECLARARLA como techo honesto — igual que la cobertura de embeddings en v6.1. Un cruce de dinero solo cubre los parlamentarios con RUT presente; el resto se muestra como "sin dato de RUT", no como "sin vínculos".
- El `reconciliar-contrato.ts` ya es correcto aquí: un name-match NUNCA escribe el `rut` de la maestra (name-uniqueness ≠ RUT-ownership); solo corrobora un RUT ya presente, o encola a revisión humana. Preservar esa separación de canales.

**Warning signs:**
- Cruce de dinero corre pero `parlamentario.rut` está NULL para la mayoría.
- Cobertura de RUT no está medida ni declarada.
- Un RUT nuevo se escribe a la maestra derivado de un match por nombre.

**Phase to address:**
**Fase RUT-01 (backfill)** — bloqueante, secuenciada como prerrequisito duro ANTES de la fase de cruce de dinero. Verificación: cobertura de RUT medida y declarada; gate CI que impide que un name-match escriba `parlamentario.rut`.

---

### Pitfall 5: Encender MONEY_PUBLIC_ENABLED sin sign-off legal 21.719 (o que un agente lo flipee)

**What goes wrong:**
El cruce dinero↔parlamentario es "el de mayor impacto reputacional" (PROJECT.md). Exponerlo sin la pasada de asesoría legal 21.719 (plena vigencia 2026-12-01) es el riesgo jurídico-existencial del producto. "Fuente de acceso público" NO exime cumplimiento; el dato DERIVADO del cruce queda protegido por la ley.

**Why it happens:**
El operador PRE-APROBÓ encender flags "cuando cada fase llegue a su gate con la suite verde" (2026-07-13). Un agente autónomo puede malinterpretar esto como autorización para flipear el flag él mismo. NO lo es: el sign-off legal es un **acto humano real** que el operador provee; su aprobación autoriza el flip, no lo reemplaza.

**How to avoid:**
- Construir TODO hasta el gate **deny-by-default**. `money-gate.ts` ya es fail-closed (solo el literal `"true"`; ausencia = OFF, no error). NO tocar esa semántica.
- El flip de `MONEY_PUBLIC_ENABLED` requiere `signoff: approved` en `docs/legal/13-LEGAL-DOSSIER.md` (deuda F13) — es acción exclusivamente humana. **Un agente NUNCA flipea `MONEY/NET/cruces`.**
- Guard CI: que ningún commit de agente cambie `MONEY_PUBLIC_ENABLED` a `"true"` ni añada un default distinto de OFF.
- Chokepoint único: toda ruta pública MONEY pasa por `moneyPublicEnabled(process.env)`, nunca leyendo la env cruda.

**Warning signs:**
- Un PR/commit de agente toca el flag o el default del gate.
- Rutas MONEY que leen `process.env.MONEY_PUBLIC_ENABLED` directo en vez del gate.
- El dossier legal 13 no tiene `signoff: approved` pero las rutas MONEY renderizan.

**Phase to address:**
Fase de **superficies de dinero (deny-by-default)** construye todo detrás del gate OFF. El encendido es una fase-gate humana separada (sign-off F13), fuera del alcance del agente.

---

### Pitfall 6: Afirmar "empresa ligada al parlamentario" sin base sólida de vínculo (difamación)

**What goes wrong:**
Decir "empresa X, ligada al diputado Y, recibió contratos del Estado" cuando el vínculo es débil (homonimia, coincidencia de nombre, inferencia) es difamatorio. Persona jurídica name-linkeada a un parlamentario es el error más grave: **la empresa no es el parlamentario**.

**Why it happens:**
El impulso de "conectar los carriles" empuja a afirmar vínculos que la fuente no establece. Un LLM que clasifica "empresa relacionada" inventa una relación que no existe en el dato.

**How to avoid:**
- **LOCKED: persona jurídica SOLO por RUT exacto, fail-closed. Nunca LLM, nunca name-match.** `reconciliar-contrato.ts` ya lo enforça: jurídica → `matchDeterministaEntidad` por RUT exacto, nunca `correrPipeline`. Preservar esta rama intacta.
- Persona natural puede cruzar por nombre determinista (finalidad del dato: enlazar un funcionario público es el pipeline confirmado/auditado), pero un confirmado-por-nombre prueba que el contrato está asociado a alguien confirmado como ese parlamentario — NO que el RUT del proveedor SEA el del parlamentario. La UI no debe colapsar ese matiz.
- Presentar como **conteos factuales con provenance** ("N contratos con proveedores cuyo RUT/nombre coincide con el parlamentario, según ChileCompra, fecha, enlace"), NUNCA como "empresa ligada a" ni score de correlación.
- El linter anti-insinuación cubre las superficies de dinero.

**Warning signs:**
- Aparece `correrPipeline`/LLM en la rama de persona jurídica.
- Texto "empresa vinculada/ligada/asociada al parlamentario" sin RUT exacto.
- Un score de correlación dinero↔parlamentario en vez de un conteo.

**Phase to address:**
Fase de **cruce de dinero** (preservar la rama jurídica RUT-only) + fase de **superficies de dinero** (linter + provenance inline + fraseo factual).

---

### Pitfall 7: SERVEL manual/desactualizado presentado como live

**What goes wrong:**
SERVEL es "conector artesanal frágil, no API REST" (xlsx en Azure Blob, por elección/manual). Presentar datos de financiamiento de una elección pasada como si fueran actuales, sin fecha de corte visible, engaña sobre la vigencia del dato.

**Why it happens:**
El conector SERVEL degrada honestamente ante 403/503/429 (`ServelBloqueadaError`) pero la UI puede no reflejar CUÁNDO se capturó el dato ni que la elección es antigua.

**How to avoid:**
- Fecha de corte / fecha de captura VISIBLE en toda superficie de financiamiento (principio rector: fuente + fecha + enlace por dato).
- `pnpm freshness` debe cubrir SERVEL y ChileCompra con señal de staleness (patrón v6.0).
- Declarar explícitamente qué elección/período cubre el dato de financiamiento.

**Warning signs:**
- Superficie de financiamiento sin fecha de corte.
- Freshness no cubre SERVEL/ChileCompra.

**Phase to address:**
Fase de **superficies de dinero** (fecha de corte visible) + extender `freshness` a las fuentes de dinero (fase de hardening/deuda).

---

## Technical Debt Patterns

Shortcuts que parecen razonables pero crean problemas al tocar los conectores existentes.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Escribir el conector de votos contra un fixture sin caracterizar opendata LIVE | Avanza rápido | Parser que miente en prod (namespaces/códigos de opción); rompe silencioso | **Nunca** — validar endpoint es fase 1 de P3 |
| Name-match para llenar votos sin DIPID en la maestra | +cobertura aparente | Voto difamatorio (riesgo #1) | **Nunca** para votos (roll-calls traen ID) |
| Correr cruce de dinero antes de RUT-01 físico | "P5 completo" | Cruce vacío o falso; cuenta mal | **Nunca** — RUT-01 es prerreq de datos |
| Escribir `rut` a la maestra desde un name-match | RUT "cosechado" | name-uniqueness ≠ RUT-ownership → RUT falso | **Nunca** — solo corroborar RUT presente o cola humana |
| Editar el allowlist SSRF para agregar un host de dinero al default | Menos fricción | Amplía SSRF a todo el tenant (Azure/ChileCompra) | **Nunca** — usar `extraHosts` scoped al conector |
| Tocar `runIngest`/`SnapshotWriter` compartido para "mejorar" votos | Reuso | Regresiona la ingesta que ya funciona (leyes/lobby/probidad) | Solo con suite verde de TODOS los consumidores + snapshot dos-etapas intacto |
| Saltarse el paso R2 (fuente→R2) al agregar votos/dinero | Menos código | Rompe la regla LOCKED de dos etapas; no re-ingestable sin molestar la fuente | **Nunca** — dos etapas es LOCKED |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| opendata.camara.cl (votos) | Asumir un solo shape/namespace | DOS endpoints, DOS namespaces (`tempuri.org` vs `camaradiputados/v1`), códigos `Valor 1=si/0=no` — fijar el mapeo con test |
| opendata.camara.cl DIPID | Reusar DIPID entre legislaturas | DIPID puede reciclarse; golden set DIPID→maestra por legislatura vigente |
| Cámara vs Senado (votos) | Un solo esquema para ambas cámaras | Esquemas distintos: Cámara (opendata XML voto-a-voto) vs Senado (`votaciones.php` XML). `runIngest` degrada fail-closed sin provider Senado — no fabricar votos del Senado |
| ChileCompra | Asumir GET anónimo como SERVEL | ChileCompra requiere ticket/secreto por request; SERVEL es GET anónimo — no confundir el patrón de auth |
| SERVEL (Azure Blob) | Agregar el host a `DEFAULT_ALLOWED_SUFFIXES` | `extraHosts` EXACTO scoped al conector + assert `protocol==="https:"` (extraHosts admite http) |
| SERVEL bloqueo (403/503/429) | Abortar la corrida completa | `ServelBloqueadaError` degrada ESA elección, la corrida sigue (espejo `ChileCompraBloqueadaError`) |
| RUT → LLM | Incrustar RUT en prompt/jsonb de revisión | `assertNoRutInLlmInput` dentro de `correrPipeline`; RUT viaja solo por canal de auditoría interno, nunca a `revision_*` |
| PostgREST al backfill masivo | Leer >1000 filas sin paginar | Cap 1k de PostgREST: paginar `.order().range()` SIEMPRE (gotcha ya cazado en v6.1) |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exponer RUT en tabla/ruta pública | Violación 21.719 + PII; minimización rota | RUT es PII interna (`parlamentario.rut`, RLS deny-by-default); nunca a tabla pública ni LLM |
| Encender flag MONEY sin sign-off | Riesgo jurídico-existencial | `money-gate.ts` fail-closed; flip = acto humano con dossier `signoff: approved`; guard CI |
| RUT crudo al pipeline LLM (subencargado) | RUT sale del perímetro interno | `assertNoRutInLlmInput`; data-routing: solo el nombre al LLM, RUT solo al matcher determinista en memoria |
| Ampliar allowlist SSRF por un host de dinero | SSRF a todo tenant Azure/gob | `extraHosts` exacto scoped, nunca al default; assert https |
| Filtrar ticket ChileCompra en errores/logs | Secreto expuesto | Errores de bloqueo NUNCA incluyen el ticket (patrón `ServelBloqueadaError` que declara "sin secretos") |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Mostrar "ausente" como "en contra" | Afirmación falsa sobre el voto | 5 opciones separadas; pareo/ausente en slate neutro (`voto-presentacion.ts` ya lo hace) — no fundir |
| Comparar votos par-a-par | Insinúa afinidad política (riesgo #2) | Comparar contra mediana de cámara (agregado factual), como VIZ-COMP |
| Financiamiento sin fecha de corte | Dato viejo parece actual | Fecha de captura + período electoral visible por dato |
| "Empresa ligada a X" | Difamación por vínculo débil | Conteo factual con provenance; jurídica solo por RUT exacto |
| Cruce de dinero sin declarar cobertura de RUT | "Sin vínculos" confundido con "sin datos" | Declarar N/M con RUT; "sin dato de RUT" ≠ "sin vínculos" |

## "Looks Done But Isn't" Checklist

- [ ] **Conector de votos:** Corre contra el fixture — verifica que hay respuesta LIVE de opendata guardada en R2 y que los totales voto-a-voto cuadran con los totales del boletín.
- [ ] **Reconciliación de voto:** % `confirmado` no bajó al escalar — verifica que ningún name-match entró al camino de votos.
- [ ] **Mapeo de opción:** `Valor 1→si, 0→no` — verifica con test explícito, no asumido; pareo/abstención/dispensado mapeados.
- [ ] **RUT-01:** El backfill "corrió" — verifica cobertura N/M de RUT DV-válido en la maestra ANTES de habilitar cruce de dinero.
- [ ] **Cruce jurídica:** "cruza empresas" — verifica que la rama jurídica NUNCA llama `correrPipeline` (solo RUT exacto).
- [ ] **money-gate:** "gated OFF" — verifica que ningún commit cambió el default ni añadió lectura cruda de la env.
- [ ] **Linter anti-insinuación:** "cubre cruces" — verifica que corre TAMBIÉN sobre superficies de voto y de dinero nuevas.
- [ ] **Dos etapas:** conector nuevo "ingesta" — verifica fuente→R2 (crudo content-addressed) Y R2→Supabase, re-ejecutables por separado.
- [ ] **Freshness:** "monitoreado" — verifica que SERVEL/ChileCompra/votos aparecen en `pnpm freshness` con staleness.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Voto mal atribuido publicado | HIGH (reputacional/legal) | Re-reconciliar desde R2 (no re-scrapear); corregir DIPID→maestra; audit inmutable de la corrección; el crudo en R2 permite reconstruir sin tocar la fuente |
| Cruce de dinero corrido antes de RUT-01 | MEDIUM | Los datos son derivados reconstruibles: backfillar RUT-01, re-correr `reconciliar-contrato` desde R2, re-materializar; el crudo no se re-descarga |
| Flag MONEY encendido por error | HIGH | Revertir a OFF de inmediato (fail-closed); el gate hace que ausencia=OFF; auditar qué se expuso |
| RUT falso escrito a la maestra por name-match | MEDIUM | La maestra tiene respaldo externo (snapshot git autoritativo); revertir; el canal de revisión humana debió interceptarlo |
| opendata cambió shape y cargó basura | LOW-MEDIUM | El gate zod debió fallar ruidoso; si pasó, re-parsear desde R2 con el parser corregido (fuente no se toca) |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| #2 opendata sin validar | **Fase 1 P3 — validar/caracterizar endpoint** (bloqueante, antes del conector) | Respuesta LIVE en R2; totales cuadran; mapeo de opción con test |
| #1 voto mal atribuido (riesgo #1) | Fase P3 — modelo de voto reconciliado + golden set DIPID→maestra | % confirmado estable al escalar; cero name-match en votos |
| #3 alineamiento/rebeldía (riesgo #2) | Fase P3 — superficies de análisis de voto | Linter anti-insinuación corre sobre voto; BrowserOS gate; sin co_votación |
| #4 cruzar dinero sin RUT-01 | **Fase RUT-01 (backfill)** — bloqueante, ANTES del cruce de dinero | Cobertura RUT N/M declarada; guard CI anti name-match→rut |
| #6 empresa ligada / jurídica name-match | Fase P5 — cruce de dinero (rama jurídica RUT-only intacta) | Jurídica nunca llama `correrPipeline`; provenance inline |
| #7 SERVEL desactualizado | Fase P5 — superficies de dinero + freshness | Fecha de corte visible; SERVEL/ChileCompra en freshness |
| #5 flag MONEY sin sign-off (legal) | Fase-gate humana separada (F13) — fuera del agente | `signoff: approved` en dossier 13; guard CI anti-flip; chokepoint `moneyPublicEnabled()` |

## Deuda técnica / operacional al tocar conectores existentes

**Regla rectora:** los conectores de leyes/lobby/probidad YA funcionan end-to-end (v6.0). Agregar votos/dinero NO debe regresionarlos.

- **`source_snapshot` / dos etapas LOCKED:** todo conector nuevo (votos, ChileCompra si falta) escribe PRIMERO crudo content-addressed a R2 (`fuente/recurso/fecha/sha256.ext`, PUT `If-None-Match: *`, 412=ya-existía=éxito) y LUEGO R2→Supabase. Reusar `SnapshotWriter`/`base-connector`, no forkar. Verificar que las dos etapas son re-ejecutables por separado.
- **`--from-r2` (replay):** el backfill de votos/dinero debe poder re-correr DESDE R2 sin molestar la fuente (regla LOCKED: re-ingestar a Supabase se hace SIEMPRE desde R2). Patrón ya presente en lobby/probidad — extenderlo, no reinventar.
- **Hash-check ANTES de descargar:** votos y dinero comprueban sha256/ETag/If-Modified-Since antes de re-bajar; salir temprano sin novedades.
- **Rotación del cron sin perder frescura:** agregar votos/dinero al scheduling round-robin (dilución ya identificada en el cron leyes-weekly sobre corpus 3.657). No sobrecargar un solo día; lotes acotados incrementales L–V; MONEY/SERVEL FUERA del cron mientras estén gated.
- **Backfill masivo = LOCAL (operador), NO GitHub Actions** (minimizar minutos), idempotente/reanudable — patrón v6.1.
- **PostgREST cap 1k:** paginar `.order().range()` SIEMPRE en el backfill masivo (gotcha recurrente v6.1).

## Sources

- Código del repo (verificación directa, HIGH): `packages/votos/src/run-camara-votos.ts`, `run-votos-masivo-cli.ts`, `run-camara-votos.live.test.ts`; `packages/tramitacion/src/parse-camara-votacion.ts`; `app/lib/voto-presentacion.ts`; `app/lib/money-gate.ts`; `packages/dinero/src/reconciliar-contrato.ts`, `connector-servel.ts`; `packages/identity/src/backfill-rut.ts`.
- `.planning/PROJECT.md` (HIGH) — riesgos existenciales #1/#2, milestone v7.0, gates, RUT-01 como prereq de datos, 21.719, opendata "sin validar".
- `CLAUDE.md` (HIGH) — dos etapas LOCKED, WAF/rate-limit, jurídica RUT-only fail-closed, "qué NO usar", allowlist SSRF, PostgREST cap 1k.
- `docs/legal/13-LEGAL-DOSSIER.md` / `17-LEGAL-DOSSIER-NET.md` (referenciados) — sign-off MONEY/NET, co_votación excluida del MVP §2.
- MEMORY (contexto de corridas previas, HIGH) — gotchas v6.1 (paginación PostgREST, backfill local, linter/cascada).

---
*Pitfalls research for: agregar voto individual (P3) + dimensión dinero (P5) a Observatorio del Congreso 360 — milestone v7.0*
*Researched: 2026-07-13*
