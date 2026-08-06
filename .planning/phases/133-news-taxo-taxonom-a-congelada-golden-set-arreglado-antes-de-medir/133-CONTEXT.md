# Phase 133: NEWS-TAXO — Context

**Gathered:** 2026-08-06
**Status:** Ready for planning (**alcance: 133-a solamente**)
**Source:** Re-adjudicación firmada — `133-READJUDICACION.md` (D-133-A2/B2/C2/D2/E2/F2/H/I),
firmada por el operador el 2026-08-06 (*"consideralo firmado."*). Toda decisión de ese documento es
**LOCKED**: no se re-abre, no se re-discute, no se "mejora" en el plan.

<domain>
## Phase Boundary

La Phase 133 se ejecuta en **dos actos con firma independiente** (D-133-I). **Este plan cubre
únicamente 133-a.**

### 133-a — EN ALCANCE (todo lo congelable sin muestra)

1. `packages/news/src/eval/taxonomia.ts` — fuente de verdad ejecutable de la taxonomía D-133-A2
   (5 clases sustantivas + `ambiguo`, definición, marca decisoria, frontera, precedencia,
   enrutamiento).
2. Script de canonicalización + `packages/news/src/eval/taxonomia.json` (proyección canónica) y
   `packages/news/src/eval/thresholds.json` (los umbrales de D-133-D2, incluido **T9**).
3. `.gitattributes` (**no existe en el repo**) + `git add --renormalize` + **control positivo de
   estabilidad del hash** (clon limpio → los sha256 coinciden).
4. `packages/news/src/eval/CONGELADO.md` + `congelado.test.ts` (re-calcula los hashes, compara, y
   asserta que la última entrada de `CONGELADO.md` contiene los tres hashes vigentes).
5. Test de sincronía: `taxonomia.json` se regenera desde `taxonomia.ts` y se compara **byte a byte**.
6. **G1** `packages/news/src/eval/taxonomia-guard.test.ts` — términos prohibidos sobre cada string de
   `taxonomia.ts`, con prueba de mutación.
7. **G2** guard de superficie (D-133-G): ningún literal de etiqueta de la taxonomía aparece en una
   superficie renderizada de `app/`, con control positivo apareado.
8. **G3** el skip silencioso de `app/lib/anti-insinuacion-guard.test.ts:943-948` pasa a **fallo duro**.
9. **Esquema del caso golden** (tipo + validación), sin ningún caso etiquetado.
10. `entrada_llm` importa la **misma función de truncado** del pre-filtro (D-133-F2), más el chequeo
    de cobertura de `prefiltro.terminos` que debe correrse **antes** de etiquetar.

### 133-b — FUERA DE ALCANCE (desde el 2026-08-07, necesita la ventana de 3 días hábiles)

Construcción del golden set, calibración humana ciega de 20 casos, doble etiquetado con dos modelos
distintos, arbitraje del operador, cómputo de los dos kappas, y la congelación de `golden-set.json`
con su segunda firma. **Ningún plan de 133-a puede etiquetar un solo caso** — el RSS no da histórico
y hoy solo existe 1 día en R2.

### Fuera de alcance en absoluto

- Cualquier cambio al SC1 LOCKED de la Phase 134 (D-133-H).
- El prompt del clasificador, el schema Supabase de la etiqueta, la elección de modelo — son de 135.
- Flipear cualquier `*_PUBLIC_ENABLED`.
- Cualquier RPC pública nueva. En 133 no debería haber ninguna.
- Re-scrapear "para conseguir muestra".

</domain>

<decisions>
## Implementation Decisions — TODAS LOCKED por firma del operador 2026-08-06

### Taxonomía (D-133-A2)

- **Regla de decidibilidad textual:** una clase es legal si y solo si se decide leyendo únicamente
  titular + bajada. Una clase cuyo hecho decisorio vive en el corpus es ilegal por construcción.
- **5 clases sustantivas + `ambiguo`**, precedencia `1 > 2 > 3 > 4 > 5`:
  `tramitacion_legislativa` > `actividad_parlamentaria` > `ley_vigente` > `politica_no_legislativa`
  > `no_legislativa`; `ambiguo` es escape, no nivel de precedencia.
- **`agenda_ejecutivo` NO existe** — fusionada en `politica_no_legislativa`.
- **`ley_vigente` se define por marca textual** ("ley N.º…", "entra en vigencia", "publicada en el
  Diario Oficial", "el reglamento de la ley", "desde hoy rige"). **Sin** la cláusula "si hay una
  modificación en trámite".
- Mono-etiqueta. La taxonomía **no nombra sujetos**.
- **Enrutamiento:** 1 y 3 → ficha de proyecto; 2 → ficha de persona; 4, 5, `ambiguo` → ninguna ficha.
- **Qué cuelga de la ficha de una persona** (las tres condiciones, acumulativas): etiqueta
  `actividad_parlamentaria` **y** titular/bajada nombran a la persona **y** el resolver de 134 la
  mapea contra los 186 sin ambigüedad. Homónimo o coincidencia parcial ⇒ `null` ⇒ dead-letter.
- **Single source of truth:** `packages/news/src/eval/taxonomia.ts`. El prompt de 135 se **construye**
  desde ese módulo. Prohibido re-escribir las etiquetas a mano en ningún otro lugar.

### Guards de copy (D-133-A2.4)

- **G1** corre `TERMINOS_PROHIBIDOS` / `NEGACIONES_LOCKED` sobre **cada string** de `taxonomia.ts`.
- **G2** falla si cualquier literal de etiqueta aparece en una superficie renderizada de `app/`.
- **G3** el `try/catch continue` de `app/lib/anti-insinuacion-guard.test.ts:943-948` pasa a **fallo
  duro**: un archivo del allowlist que no existe es un guard ciego que sale verde.
- Los tres llevan **control positivo apareado que difiere en UNA sola variable**, y **prueba de
  mutación**: inyectar la violación y demostrar que el test cae.

### Umbrales (D-133-D2) — van a `thresholds.json` en 133-a

| # | Métrica | Umbral | n mínimo | Efecto |
|---|---|---|---|---|
| T1 | `tasa_etiqueta_fuera_de_lista` | = 0,00 | — | VETO |
| T2 | `tasa_parse_fallido` | ≤ 0,02 | — | VETO |
| T3 | `exactitud_macro` (media por clase sobre clases con n≥8) | ≥ 0,80 | ≥3 clases con n≥8 | VETO |
| T4 | `recall_tramitacion_legislativa` | ≥ 0,85 | n ≥ 25 | VETO si n≥25; si n<25 `no-medido` y la clase no enruta |
| T5 | `precision_no_legislativa` | ≥ 0,90 | n ≥ 25 | ídem |
| **T9** | `precision_actividad_parlamentaria` | ≥ 0,90 | n ≥ 25 | ídem — **veto nuevo** |
| T6 | `costo_usd_por_100_items` | ≤ 0,05 | — | informativo, desempata |
| T7 | `latencia_p50_ms` | ≤ 5.000 | — | informativo, desempata |
| T8 | `tasa_ambiguo_modelo` vs `tasa_ambiguo_humano` | — | — | informativo |

- **Regla de intervalos, uniforme:** toda cifra con `n` e IC95; los vetos se evalúan sobre la
  **estimación puntual**; si el IC95 **cruza** el umbral, el veredicto se marca `dentro-del-ruido`
  con ambos números; el desempate entre modelos usa **solapamiento de IC95**, no la constante de 6 pp.
- **Refutación pre-registrada** (se conserva de D-133-D) + **refutación parcial**: si T9 falla o queda
  `no-medido`, el enrutamiento a fichas de persona no entra a producción aunque el resto apruebe.
- **Granite:** candidato legítimo, pero su aprobación de v11.0 **no se transfiere de dominio**.

### Congelación (D-133-E2)

- Se hashean **3 JSON canonicalizados**; **jamás el `.ts`** (drift falso por formateo).
- Canonicalización: claves ordenadas ascendentemente por code unit UTF-16, **recursiva**; **arrays
  NO se reordenan** (su orden es semántico — la precedencia vive en el orden del array); indentación
  2 espacios; **LF**; UTF-8 **sin BOM**; newline final. Hash = sha256 sobre los bytes así serializados.
- `.gitattributes` es la **primera tarea**: patrón `packages/news/src/eval/**/*.json text eol=lf`,
  `git add --renormalize`, y control positivo (clon limpio → los tres sha256 coinciden).
- `congelado.test.ts` re-calcula los hashes **y** asserta que la última entrada de `CONGELADO.md`
  contiene exactamente los tres hashes vigentes.
- Cambio legítimo = **un commit con las tres cosas** (artefacto + hash en el test + entrada nueva en
  `CONGELADO.md` con `hash_anterior → hash_nuevo`, fecha, razón, firma). Cualquier otra combinación
  es drift.
- Limitación declarada, no disimulada: la **firma** sigue siendo un string en un markdown; el control
  real es el commit en git.

### Re-runnabilidad (D-133-F2) — en 133-a solo el esquema y el límite

- Cada caso golden guarda **puntero Y payload**: `caso_id`, `procedencia` (`r2_path`, `url_hash`,
  `url_canonica`, `outlet`, `fecha_captura`, `fecha_pub`), `entrada` (`titulo`, `descripcion`),
  `entrada_llm`, `estrato` (`P` | `N-alea` | `N-sonda` | **`P-dirigido`**), `prefiltro`
  (`paso`, `terminos`), `etiqueta`, `revision` (`etiqueta_a`, `etiqueta_b`, `justificacion_a`,
  `justificacion_b`, `acuerdo`, `resuelto_por` ∈ {`acuerdo`,`operador`,`no_arbitrado`}, **`modelo_a`**,
  **`modelo_b`**, **`en_calibracion_humana`**, **`etiqueta_humana`**, `revisado_en`).
- **`entrada_llm` importa la MISMA función de truncado de `prefiltro-lexico.ts`** — no una constante
  replicada. Una constante copiada es la deuda de ICS en miniatura.
- Chequeo de cobertura **antes de etiquetar**: fracción de casos P cuyos `prefiltro.terminos` están
  todos dentro de `entrada_llm`; **< 95 % ⇒ el límite sube antes de etiquetar un solo caso**.
- Copyright/PII: solo titular + descripción del RSS, cero full-text, cero PII añadida, cero cruce con
  `parlamentario`, cero causalidad ni intención.

### Claude's Discretion

- Nombres de archivo internos de `packages/news/src/eval/` más allá de los cinco congelados.
- Forma exacta del script de canonicalización (CLI, función exportada, o ambos) y cómo se invoca.
- Cómo se tipa el caso golden (zod, type + validador, o ambos) — mientras el esquema sea el de arriba.
- Estructura interna de `taxonomia.ts` (array de objetos congelado con `Object.freeze`, tipos
  derivados) — mientras la precedencia viva en el **orden del array** y la proyección sea determinista.
- Cómo G2 enumera las superficies renderizadas de `app/` — mientras no herede el skip silencioso.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decisiones que gobiernan esta fase (LOCKED)
- `.planning/phases/133-*/133-READJUDICACION.md` — **manda sobre todo lo demás**; D-133-A2..I firmadas.
- `.planning/phases/133-*/133-PREMORTEM.md` — los 8 blockers y su evidencia contra el repo.
- `.planning/phases/133-*/133-ADJUDICACION.md` — **insumo histórico**; vigente solo donde la
  re-adjudicación no lo tocó. Ante conflicto, manda la re-adjudicación.
- `.planning/phases/133-*/.continue-here.md` — handoff con D-133-RATIF y D-133-G verbatim.
- `.planning/ROADMAP.md:229-236` — SC1 LOCKED de la Phase 134 (D-133-H: 133 **no** lo cambia).

### Código que esta fase toca o del que depende
- `packages/news/src/prefiltro-lexico.ts` — `VOCABULARIO_LEGISLATIVO`, `LIMITE_DESCRIPCION = 600`
  (`:50`), `MARGEN_TRUNCADO`, y la prohibición LOCKED de podar el vocabulario (`:6-9`).
- `app/lib/anti-insinuacion-guard.test.ts` — `APP_ROOT` (`:68`), `TERMINOS_PROHIBIDOS` /
  `NEGACIONES_LOCKED` (`:623-757`), `TODAS_LAS_SUPERFICIES` (`:864-881`), el **skip silencioso**
  (`:943-948`) y el comentario que ya documenta el agujero (`:421-423`).
- `packages/news/` — 206 tests existentes; el paquete y su config de vitest son el patrón a seguir.

### Régimen del repo
- `CLAUDE.md` — ingesta en dos etapas, migraciones por `psql`, backfill LOCAL.
- `.planning/PROJECT.md:9` — el core value: fuente, fecha y enlace por cada dato; **sin afirmar
  nunca intención ni causalidad**.

</canonical_refs>

<specifics>
## Specific Ideas — gotchas pagados que este plan NO puede re-pagar

- **`passWithNoTests: true` está activo** ⇒ todo `<automated>` de vitest puede salir 0 **sin correr
  nada**, y los args de `vitest run` son **filtros de nombre, no rutas**. Todo criterio asserta el
  **conteo impreso** (`Tests N passed`), jamás el exit code solo.
- **La pregunta a cada `<acceptance_criteria>`:** *¿puede salir 0 sin haber probado nada?* Y su
  gemela: *¿puede NO salir 0 nunca?* Para cada test nuevo: **mutar el código y comprobar que cae**.
- **`set -e` + un comando que DEBE fallar = verify inalcanzable** (falso rojo). Usar
  `if CMD > log 2>&1; then rc=0; else rc=$?; fi`.
- **Proyecto `composite` sin ningún `.ts` = TS18003** (`tsc -b` sale 1): un paquete/directorio nuevo
  necesita su `index.ts` desde la primera tarea.
- **Un control positivo que varía DOS variables no aísla la causa** — el par debe diferir en una.
- **`git diff --name-only` sin base fija siempre pasa** con commits atómicos: usar SHA literal.
- **Windows/CRLF:** `.gitattributes` **no existe**; crearlo después de commitear los JSON exige
  `git add --renormalize` o el hash se mueve solo. Es el gotcha del `psql -tA` con CRLF de v12.0.
- Conteos por `psql -tA` siempre con `| tr -d '\r'`.
- **Cinco rondas de checker costó la 132**, y cada ronda descubrió que el fix de la anterior era él
  mismo un falso verde o un falso rojo. No apurarse.
- **Un verde dudoso se reporta, no se redacta bonito.**

</specifics>

<deferred>
## Deferred Ideas

- **Todo 133-b** (golden set, etiquetado, kappas, arbitraje, congelación de `golden-set.json`) —
  desde el 2026-08-07, con su propia firma.
- **Página pública "Cómo clasificamos las noticias"** (taxonomía + umbrales + `exactitud_medida` +
  `n` + IC + `fecha_del_eval` + modelo + las seis limitaciones), ligada al hash de `CONGELADO.md` —
  **entregable de la Phase 137**. En 133-a solo queda congelado **que existe y qué debe contener**.
- **Deuda arquitectónica para la Phase 134:** `extraerBoletines` vive en
  `app/lib/boletin-en-materia.ts:58`, no en `packages/`; reusarlo desde `packages/news` invertiría la
  dirección de dependencia del monorepo. Es problema de 134 y su plan debe resolverlo explícitamente.
- **Enmienda al SC1 de la Phase 134** (si el operador quiere la arquitectura más estricta): se
  tramita aparte, con su texto y su firma. No se propone aquí.
- **Ampliar `VOCABULARIO_LEGISLATIVO`** si el estrato N-sonda caza falsos negativos — 133-b/plan, con
  test. La regla (solo se AMPLÍA, nunca se poda) ya es LOCKED.

</deferred>

---

*Phase: 133-news-taxo · Context derivado de la re-adjudicación firmada, 2026-08-06*
