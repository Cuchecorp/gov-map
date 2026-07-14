# Feature Research

**Domain:** Observatorio legislativo ciudadano — voto individual (P3) + dimensión dinero (P5)
**Researched:** 2026-07-13
**Confidence:** HIGH (votos: TheyWorkForYou/GovTrack documentan explícitamente su postura anti-insinuación; dinero: OpenSecrets/SERVEL/ChileCompra bien documentados. LOW en cobertura exacta de SERVEL/opendata.camara.cl porque son fuentes frágiles no validadas aún.)

> **Nota:** este archivo reemplaza la versión de research v2.0. Alcance = SOLO las features NUEVAS de v7.0. Lo ya construido (timeline, votaciones AGREGADAS, ficha 360, lobby, patrimonio, `cruce_senal`, `/red`, búsqueda semántica, `/agenda`) NO se re-investiga.
>
> **Regla rectora que gobierna TODO lo de abajo:** cada dato lleva fuente + fecha + enlace original; el sistema describe el HECHO (cómo votó, cuánto recibió, qué contrato existe) y NUNCA infiere motivo, intención, causalidad ni "afinidad". Cada feature está redactada como "el ciudadano puede X" y probada contra la regla anti-causalidad. Los dos riesgos existenciales del proyecto — (#1) identidad que falla en silencio, (#2) "máquina de sospechas" — son el marco de aceptación de cada feature.

---

## FRENTE P3 — Cómo vota el Congreso (voto individual)

### Table Stakes (el ciudadano espera que existan)

| Feature | Por qué se espera | Complejidad | Notas de implementación |
|---------|-------------------|-------------|-------------------------|
| **"Cómo votó X en esta votación"** — por cada votación nominal, lista de a favor / en contra / abstención / pareo / ausente, con nombre de parlamentario | Es la unidad atómica de todo observatorio de votos (GovTrack, TheyWorkForYou, VotaInteligente). Sin esto no hay P3. | MEDIUM | Fuente = `opendata.camara.cl` (SIN VALIDAR — bloqueante histórico). Reconciliar cada nombre contra la maestra de identidad **fail-closed** (riesgo #1). Guarda UI: solo enlazar a la ficha si `confirmado`. Senado ya trae voto por PARLID en `votaciones.php`. |
| **Historial de votos de un parlamentario** — en su ficha 360, "así votó" ordenado por fecha/sesión, cada fila enlaza a la votación y al proyecto | Espejo del anterior desde el eje persona. GovTrack "Voting Record", TheyWorkForYou "Votes" por MP. | MEDIUM | Ya existe VIZ-VOTOS agregado ("cuándo votó por trimestre"); esto es el detalle nominal por debajo. Paginar (PostgREST cap 1k — GOTCHA conocido del proyecto). |
| **Tasa de asistencia / ausencia a votaciones** — "votó en N de M votaciones (X%)" | GovTrack publica "Missed Votes" como report card estándar; es la métrica de rendición de cuentas más pedida. | LOW-MEDIUM | Conteo factual puro. **CAVEAT OBLIGATORIO en UI** (copiar a TheyWorkForYou): las ausencias pueden deberse a licencia médica, maternidad o pareo; NO etiquetar "flojo". Ya hay VIZ-COMP (comparativo de ausencias vs mediana de cámara) — extenderlo con el detalle nominal. |
| **Desglose de una votación** — totales por opción + resultado (aprobado/rechazado) + quórum, con desglose por bancada/cámara | Contexto mínimo para entender el resultado; TheyWorkForYou muestra "party-by-party breakdown" por división. | LOW | El agregado ya existe (votaciones AGREGADAS v1.0); aquí se añade la capa nominal debajo del agregado. |
| **Trazabilidad por voto** — fuente + fecha + enlace a la votación oficial en cada fila | Regla rectora del proyecto; también estándar (TheyWorkForYou enlaza al Hansard/debate). | LOW | Patrón ya establecido en todas las superficies del proyecto. |

### Differentiators (ventaja competitiva)

| Feature | Propuesta de valor | Complejidad | Notas de implementación |
|---------|--------------------|-------------|-------------------------|
| **Alineamiento con la propia bancada — DESCRIPTIVO** — "en estas votaciones, X votó igual que la mayoría de su bancada el N% de las veces" | TheyWorkForYou tiene "party-alignment score" (distancia entre el voto del miembro y la proporción de su partido). Diferenciador real y muy usado por prensa. | MEDIUM-HIGH | **RIESGO ALTO de insinuación.** Solo el HECHO estadístico: "coincidió con el voto mayoritario de su bancada en N/M votaciones". NUNCA "leal/rebelde/disidente" como juicio, NUNCA inferir presión de partido. TheyWorkForYou advierte explícitamente que NO tiene datos de instrucción de voto (whip) y que el score ≠ rebeldía. Requiere linter de texto anti-insinuante (ya existe en el proyecto). Considerar diferir a un flag hasta sign-off legal. |
| **"Se apartó de la mayoría de su bancada" (rebeldías) — como HECHO enumerado** | Prensa lo busca activamente; es señal noticiable. | MEDIUM | Solo enumerar las votaciones donde el voto difirió de la mayoría de su bancada, con enlace. Palabra neutra ("difirió", "votó distinto a la mayoría de su bancada"), NUNCA "traicionó/rebelde/quebró la línea". Es un caso especial del alineamiento; mismo gate. |
| **Voto × tema/sector** — agrupar votaciones por materia (salud, pensiones, etc.) y mostrar cómo votó el parlamentario en ese grupo | GovTrack agrupa por "subject"; VotaInteligente por eje temático. Conecta con la búsqueda semántica y `cruce_senal` (etiquetado de sector por LLM ya existe). | HIGH | Reusa el etiquetado de sector del LLM (con su eval propio, NO el de extracción literal). Riesgo: agregación temática puede insinuar postura ideológica → mantener descriptivo ("en votaciones de materia X votó A a favor, B en contra"). TheyWorkForYou usa "consistently voted for/against" — es la línea roja; nosotros nos quedamos en el conteo, sin la etiqueta cualitativa. |
| **Comparativo entre parlamentarios en la MISMA votación** — "en esta votación, quiénes de tal comisión/bancada votaron cómo" | Herramienta de prensa; ya hay precedente con VIZ-COMP y `/red`. | MEDIUM | Descriptivo, mismo eje temporal. No rankear "el más X". |
| **Cruce voto × proyecto que el parlamentario presentó** — "presentó este proyecto y así votó en sus votaciones" | Diferenciador del producto (frente proyectos + frente parlamentario ya integrados; F48 autoría ya existe). | MEDIUM | Une autoría (763 autores ya poblados) con voto nominal. Puro hecho. |

### Anti-Features (parecen buenas, crean problemas)

| Feature | Por qué se pide | Por qué es problemática | Alternativa |
|---------|-----------------|-------------------------|-------------|
| **Score de "lealtad", "consistencia" o "coherencia" ideológica** (tipo GovTrack ideology/leadership score) | Resume en un número; muy compartible | GovTrack mismo advierte que su score "puede estar midiendo otra cosa", fluctúa por azar del proceso legislativo, y NO garantiza relación con ideología. Un número-juicio ES insinuación de intención → viola la regla rectora y alimenta la "máquina de sospechas". | Conteos factuales sin etiqueta cualitativa ("coincidió con su bancada en N/M"). Nunca colapsar a un rótulo. |
| **Etiquetas cualitativas de postura** ("consistentemente votó a favor de X", "pro-Y") | Legible, así lo hace TheyWorkForYou | Requiere que el sistema AFIRME una postura política del parlamentario → prohibido por la regla rectora (no afirmar intención). Es exactamente la línea que TheyWorkForYou cruza y nosotros no podemos. | Mostrar los votos individuales agrupados por tema y dejar que el ciudadano lea el patrón. El sistema cuenta, no califica. |
| **Ranking "los más ausentes / los más rebeldes"** | Titular fácil | Un ranking implica juicio de valor y descontextualiza (ausencia = licencia/pareo). GOTCHA del proyecto: "ranking implícito en ORDER BY". | Métrica individual con contexto + comparación explícita contra la mediana de cámara (VIZ-COMP ya lo hace bien), sin tabla de "peores". |
| **Inferir presión de partido / "votó así porque el partido lo obligó"** | Explica el comportamiento | El sistema NO tiene datos de whip (TheyWorkForYou lo dice explícitamente) y afirmar la causa es intención pura. | Solo el hecho: "votó igual que la mayoría de su bancada". Sin el "porque". |
| **Marcar ausencias como negativas / "flojo"** | Rendición de cuentas | Sesga; ignora licencia médica/maternidad/pareo (advertencia literal de TheyWorkForYou). | Mostrar asistencia como conteo neutro + caveat de contexto obligatorio + registrar el pareo como categoría propia (no como "ausente"). |

---

## FRENTE P5 — Dimensión dinero (SERVEL + ChileCompra por RUT)

> **Prerrequisito duro REAL (no un flag): RUT-01** — los RUT deben estar backfilleados en la maestra `entidad_tercero` ANTES de que cualquier cruce por RUT sea posible. Es dato, no autorización. Flag `MONEY_PUBLIC_ENABLED` OFF hasta encendido humano (Ley 21.719, plena vigencia 2026-12-01).

### Table Stakes (el ciudadano espera que existan)

| Feature | Por qué se espera | Complejidad | Notas de implementación |
|---------|-------------------|-------------|-------------------------|
| **"Quién financió a X, cuánto y cuándo"** — aportes recibidos por el parlamentario en su campaña (aportante, monto, fecha), desde SERVEL | Es la unidad atómica de todo observatorio de dinero (OpenSecrets, FollowTheMoney). Table stake absoluto de P5. | HIGH | **SERVEL es conector artesanal frágil, NO API REST** (manual por elección/período; PROJECT.md lo marca como riesgo). Aportante persona natural → RUT es dato sensible (uso interno para identidad; publicar solo lo que SERVEL ya publica). Ley 19.884 exige nombre + RUT del aportante; verificar qué es público vs. reservado por tramo. |
| **Gastos declarados de campaña** — total y desglose que el parlamentario declaró a SERVEL | Contraparte del aporte; SERVEL publica "gastos declarados". | MEDIUM | Conteo factual con fuente/fecha/enlace a SERVEL. |
| **Contratos del Estado de empresas ligadas por RUT** — "empresas con este RUT tienen N contratos con el Estado por $X" (ChileCompra) | Diferenciador declarado del producto; ChileCompra es dato abierto. | HIGH | Cruce SOLO por **RUT exacto** de persona jurídica (NUNCA LLM para jurídicas — regla del proyecto). Depende 100% de RUT-01. "Ligada" debe definirse con precisión trazable (¿aportante? ¿proveedor? ¿director declarado en patrimonio?) — la relación tiene que ser un hecho verificable, no una inferencia. |
| **Trazabilidad total por dato de dinero** — fuente (SERVEL/ChileCompra) + fecha + enlace + atribución CC BY 4.0 donde aplique | Regla rectora + marco legal del proyecto. | LOW | Patrón establecido. ChileCompra/InfoProbidad bajo CC BY 4.0 → atribución visible. |
| **Caveat de contexto en TODA superficie de dinero** | Mitigación del riesgo #2, estándar de OpenSecrets | LOW | OpenSecrets: *"is impossible to know the motivation for each individual giver, [but] the patterns of contributions provide critical information."* Nuestro equivalente: leyenda fija "esto son montos y fechas declarados; el sistema no afirma relación entre financiamiento y decisiones". Reusar el patrón "Cómo leer esto" ya existente (v6.0). |

### Differentiators (ventaja competitiva)

| Feature | Propuesta de valor | Complejidad | Notas de implementación |
|---------|--------------------|-------------|-------------------------|
| **Cruce dinero × sector × lobby** — "recibió aportes de entidades del sector X; se reunió (lobby) con entidades del sector X; hay N proyectos/votaciones del sector X" | ES el diferenciador central del producto (los tres carriles conectados). Reusa `cruce_senal` (ya `parlamentario↔sector`, conteos sin score). | HIGH | Extiende `cruce_senal` con la dimensión dinero. **Conteos factuales, NUNCA score de correlación** (decisión LOCKED del proyecto, 17-LEGAL-DOSSIER §2). Deny-by-default detrás de `MONEY_PUBLIC_ENABLED`. Máximo riesgo reputacional → sign-off legal obligatorio. |
| **Ficha de una entidad (aportante/proveedor) 360** — "esta empresa aportó a estos parlamentarios y tiene estos contratos" | OpenSecrets tiene perfiles de industria/organización. Da el eje "entidad" además del eje "parlamentario". | HIGH | Requiere `entidad_tercero` poblada (v4.0) + RUT-01. Solo hechos enumerados. |
| **Línea de tiempo dinero × tramitación** — aportes/contratos ubicados temporalmente junto a la tramitación de proyectos del sector | Contexto temporal (que la regla rectora SÍ permite: "correlaciones con contexto temporal y fuente"). | HIGH | **Máxima tentación de insinuar causalidad** por la yuxtaposición temporal. La proximidad temporal en un timeline PUEDE leerse como "compró el voto". Requiere caveat reforzado y probablemente diferir hasta sign-off. Es el punto donde más fácilmente se convierte en "máquina de sospechas". |

### Anti-Features (parecen buenas, crean problemas)

| Feature | Por qué se pide | Por qué es problemática | Alternativa |
|---------|-----------------|-------------------------|-------------|
| **"Compró su voto" / cualquier afirmación aporte→voto** | Titular explosivo | Afirma causalidad e intención → viola frontalmente la regla rectora, es el riesgo existencial #2, y expone a responsabilidad legal (Ley 21.719, riesgo "máquina de sospechas"). | Mostrar aporte y voto como HECHOS separados con contexto temporal; el ciudadano conecta, el sistema NO. FollowTheMoney/OpenSecrets nunca afirman el vínculo causal. |
| **Score de corrupción / índice de conflicto de interés / "riesgo"** | Resume, rankea, es compartible | Un score de sospecha ES una acusación cuantificada sin sentencia; jurídicamente indefendible; destruye la trazabilidad-sobre-interpretación. | Conteos factuales por parlamentario (N aportes, $X, N contratos ligados por RUT). Sin agregarlo a un índice. |
| **Ranking "los más financiados / más contratos"** | Titular fácil | Ranking = juicio implícito + descontextualiza (monto alto puede ser campaña legítima grande). GOTCHA "ranking implícito en ORDER BY". | Cifra individual + comparación neutra contra mediana si acaso, sin tabla de "peores". |
| **Publicar RUT y datos de familiares** | "Máxima transparencia" | Prohibido por diseño del proyecto (minimización; RUT es uso INTERNO para reconciliar identidad). Ley 21.719: "fuente de acceso público" no exime cumplimiento; el dato DERIVADO del cruce queda protegido. | Publicar solo lo que la fuente ya publica; RUT nunca al LLM ni a la UI pública; guarda RUT-guard LOCKED (ya existe, 478 fichas bloqueadas por él). |
| **Inferir "conflicto de interés" de un cruce dinero×voto** | Parece el propósito del cruce | "Conflicto de interés" es una calificación jurídica que el sistema no puede emitir. | Enumerar los hechos coincidentes (aportó del sector X, votó en materia X) y dejar la calificación al lector/prensa/autoridad. |

---

## Feature Dependencies

```
P3 — VOTO INDIVIDUAL
  opendata.camara.cl VALIDADO (bloqueante histórico)
      └──requires──> conector 2-etapas fuente→R2→Supabase (hash-check, idempotente)
             └──requires──> reconciliación voto↔maestra identidad (FAIL-CLOSED, riesgo #1)
                    ├──enables──> "cómo votó X" + historial por parlamentario (table stakes)
                    ├──enables──> asistencia/ausencia (+ caveat contexto)
                    └──enables──> alineamiento con bancada / rebeldías (DIFF, gate anti-insinuación)
  voto × tema ──requires──> etiquetado de sector LLM (ya existe en cruce_senal)
  voto × proyecto propio ──requires──> F48 autoría (ya poblada, 763 autores)

P5 — DINERO
  RUT-01 backfill a entidad_tercero (PRERREQUISITO DURO REAL, es DATO)
      ├──requires──> entidad_tercero poblada (v4.0, ya existe)
      └──enables──> contratos ChileCompra por RUT (table stakes)
                    └──enables──> cruce dinero × sector × lobby (DIFF, extiende cruce_senal)
  SERVEL aportes/gastos ──requires──> conector artesanal manual por elección (frágil)
      └──enables──> "quién financió a X" (table stakes)

GATE TRANSVERSAL (ambos frentes):
  cualquier superficie sensible ──gated-by──> flag *_PUBLIC_ENABLED OFF
      └──unblocked-by──> sign-off legal humano (Ley 21.719) — NUNCA un agente
  todo texto ──gated-by──> linter anti-insinuación (ya existe)
```

### Dependency Notes

- **P3 entero depende de validar `opendata.camara.cl`:** es el bloqueante histórico literal del milestone. Hasta caracterizar ese endpoint (formato, campos, estabilidad), ninguna feature de voto individual de la Cámara es construible. El Senado (`votaciones.php`) ya trae voto por PARLID → P3 puede empezar por el Senado mientras se valida Cámara.
- **Reconciliación fail-closed es el cuello de botella de calidad de P3:** un voto atribuido al parlamentario equivocado = "afirmación falsa y creíble" (riesgo existencial #1). El voto individual debe pasar por la maestra de identidad con las MISMAS garantías que el resto (golden set, revisión humana, guarda UI `confirmado`).
- **P5 entero depende de RUT-01, que es DATO no flag:** sin RUT en `entidad_tercero` no hay cruce posible por RUT. El roadmap debe secuenciar RUT-01 como fase de datos ANTES de cualquier superficie de dinero.
- **El alineamiento-con-bancada (P3) y el cruce dinero×voto (P5) son los dos puntos de máximo riesgo de insinuación** → ambos detrás de flag + sign-off + caveat reforzado. Son diferenciadores, pero NO table stakes: el producto es válido sin ellos si el sign-off no llega.

---

## MVP Definition (para v7.0)

### Launch With (P3 primero, deny-by-default)

- [ ] **Voto individual nominal (Cámara vía opendata + Senado)** reconciliado fail-closed — sin esto no hay P3.
- [ ] **Historial de votos en la ficha del parlamentario** con enlace a votación y proyecto — es el 360 real.
- [ ] **Asistencia/ausencia con caveat de contexto obligatorio** (pareo como categoría propia, no "ausente").
- [ ] **Desglose nominal bajo el agregado ya existente** — la capa que faltaba.
- [ ] **Leyenda anti-insinuación en cada superficie de voto** (reusar "Cómo leer esto").

### Add After Validation / behind gate (P5, MONEY_PUBLIC_ENABLED OFF hasta sign-off)

- [ ] **RUT-01 backfill** — prerrequisito duro, construir aunque el resto quede gated.
- [ ] **SERVEL aportes/gastos "quién financió a X"** — conector frágil, construir hasta el gate.
- [ ] **ChileCompra contratos por RUT exacto** — jurídicas nunca por LLM.
- [ ] **Alineamiento con bancada (P3) descriptivo** — diferenciador, detrás de gate anti-insinuación.

### Future Consideration / diferir (v7.x+)

- [ ] **Cruce dinero × sector × lobby en `cruce_senal`** — máximo impacto reputacional; solo tras sign-off legal explícito.
- [ ] **Timeline dinero × tramitación** — máxima tentación de causalidad; diferir hasta que el marco legal (21.719 vigente 2026-12-01) y el sign-off estén resueltos.
- [ ] **Ficha de entidad 360 (aportante/proveedor)** — depende de `entidad_tercero` + RUT-01 maduros.

---

## Feature Prioritization Matrix

| Feature | Valor ciudadano | Costo impl. | Riesgo insinuación | Prioridad |
|---------|-----------------|-------------|--------------------|-----------|
| Voto individual nominal (table stake P3) | HIGH | MEDIUM | BAJO | P1 |
| Historial de votos en ficha | HIGH | MEDIUM | BAJO | P1 |
| Asistencia/ausencia + caveat | HIGH | LOW-MED | MEDIO (mitigado con caveat) | P1 |
| Desglose nominal de votación | MEDIUM | LOW | BAJO | P1 |
| Voto × proyecto propio | MEDIUM | MEDIUM | BAJO | P2 |
| Voto × tema/sector | HIGH | HIGH | MEDIO | P2 |
| Alineamiento con bancada (descriptivo) | HIGH | MED-HIGH | ALTO | P2 (gated) |
| RUT-01 backfill | HIGH (habilitador) | HIGH | N/A (dato interno) | P1 (para P5) |
| SERVEL aportes "quién financió a X" | HIGH | HIGH | MEDIO | P2 (gated) |
| ChileCompra contratos por RUT | HIGH | HIGH | MEDIO | P2 (gated) |
| Cruce dinero×sector×lobby | HIGH | HIGH | ALTO | P3 (sign-off) |
| Timeline dinero×tramitación | MEDIUM | HIGH | MUY ALTO | P3 (sign-off) |

**Clave de prioridad:** P1 = table stakes de v7.0, deny-by-default construible ya · P2 = diferenciador o dinero, detrás de flag hasta gate · P3 = máximo riesgo reputacional, solo tras sign-off legal humano.

---

## Competitor Feature Analysis

| Feature | GovTrack (US) | TheyWorkForYou (UK) | OpenSecrets/FollowTheMoney (US $) | Nuestro enfoque |
|---------|---------------|---------------------|-----------------------------------|-----------------|
| Voto individual por votación | Sí, "Voting Record" | Sí, división por MP + breakdown por partido | N/A | Sí (table stake), reconciliado fail-closed |
| Asistencia/ausencia | Sí, "Missed Votes" report cards | NO cuenta ausencias en summaries (no sabe interpretarlas) | N/A | Sí, PERO con caveat literal de TheyWorkForYou (licencia/maternidad/pareo) |
| Alineamiento con partido | "votes with party" | "party-alignment score" (distancia al voto del partido) | N/A | Conteo factual sin etiqueta cualitativa; gated |
| Etiqueta cualitativa de postura | ideology/leadership **score** | "consistently voted for/against" | N/A | **NO lo hacemos** — es la línea roja que ambos cruzan y nosotros no |
| Score ideológico | Sí (con auto-advertencia) | No | N/A | **Anti-feature** (prohibido) |
| Financiamiento por industria/sector | N/A | N/A | Sí, perfil por industria | Sí, como conteo por sector; sin implicar motivo |
| Caveat de no-motivación | — | "no data on whipping…a vote may not represent personal opinion" | "impossible to know the motivation…patterns provide critical information" | Leyenda fija en cada superficie; linter anti-insinuación |
| Score de corrupción/riesgo | No | No | No | **Anti-feature** (prohibido) |

**Lección clave de los tres:** los observatorios más respetados (a) muestran el voto/aporte como hecho enlazado a la fuente, (b) publican explícitamente sus caveats de no-interpretación, y (c) donde agregan (party-alignment, industria) lo hacen como estadística descriptiva declarada, NUNCA como juicio. La línea que TheyWorkForYou SÍ cruza — la etiqueta cualitativa "consistently voted for X" — es precisamente la que nuestra regla rectora nos prohíbe: nosotros contamos, no calificamos.

---

## Sources

- [TheyWorkForYou — Voting information](https://www.theyworkforyou.com/voting-information/) — caveats literales sobre whip, ausencias (licencia/maternidad), pareo, "un voto puede no representar la opinión personal" — HIGH
- [TheyWorkForYou Votes — Help & About](https://votes.theyworkforyou.com/help/about) — party-alignment score (distancia al voto del partido), campos por división, "score ≠ rebeldía", release experimental — HIGH
- [The Constitution Unit — Should we see MPs' voting records?](https://constitution-unit.com/2021/12/20/should-we-be-allowed-to-see-mps-voting-records/) — riesgos de mala interpretación de historiales de voto (ausencias tildadas de pereza, screenshots sin contexto) — MEDIUM
- [GovTrack — Analysis Methodology](https://www.govtrack.us/about/analysis) — ideology/leadership score, auto-advertencias ("puede medir otra cosa", fluctúa por azar, no publicado con <10 proyectos) — HIGH
- [GovTrack — Missed Votes report cards 2024](https://www.govtrack.us/congress/members/report-cards/2024/house/missed-votes) — asistencia/ausencia como métrica estándar — HIGH
- [OpenSecrets — Members of Congress profiles](https://www.opensecrets.org/members-of-congress) / [Industry methodology](https://www.opensecrets.org/industries/methodology) — perfil de financiamiento por industria, caveat "impossible to know motivation…patterns provide critical information" — HIGH
- [Demos — Empirical evidence money in politics](https://www.demos.org/blog/empirical-evidence-money-politics-matters) — "correlation does not imply causality — near impossible to prove dollars sway votes" — MEDIUM
- [SERVEL — Aportes](https://www.servel.cl/aportes/) / [Datos abiertos](https://www.servel.cl/2017/11/24/estadisticas-de-datos-abiertos/) / [Campañas electorales](https://www.servel.cl/campanas-electorales-elecciones-presidencial-y-parlamentarias/) — aportes recibidos, gastos declarados, Ley 19.884 (nombre+RUT del aportante, plazo 3 días); no es API REST — MEDIUM
- [Fundación Ciudadano Inteligente](https://ciudadaniai.org/timeline) / [VotaInteligente](https://votainteligente.cl/) — referencia chilena: monitoreo de cómo legisla cada parlamentario, cumplimiento de compromisos, casos de financiamiento ilegal — MEDIUM
- PROJECT.md / CLAUDE.md (Observatorio del Congreso 360) — regla rectora, riesgos existenciales #1/#2, RUT-01 como dato, cruce_senal sin score, flags *_PUBLIC_ENABLED, Ley 21.719 — HIGH

---
*Feature research for: observatorio legislativo — voto individual (P3) + dimensión dinero (P5)*
*Researched: 2026-07-13*
