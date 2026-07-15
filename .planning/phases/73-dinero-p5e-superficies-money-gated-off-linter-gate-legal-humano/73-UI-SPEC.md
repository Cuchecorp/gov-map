---
phase: 73
slug: dinero-p5e-superficies-money-gated-off-linter-gate-legal-humano
status: draft
shadcn_initialized: true
preset: shadcn Default / Slate (crema + petróleo overrides, LOCKED desde Phase 19/21)
created: 2026-07-14
mirrors: 68-UI-SPEC.md (superficies de voto anti-insinuación)
---

# Phase 73 — UI Design Contract (superficies MONEY, gated OFF)

> Contrato visual y de interacción para MONTAR las cuatro superficies de dinero
> (contratos ChileCompra por RUT, aportes SERVEL por nombre, y sus dos carriles
> hermanos en `/contraparte`) DETRÁS del gate deny-by-default
> `moneyPublicEnabled(process.env)`, honrando las reglas anti-insinuación /
> anti-difamación LOCKED. Los componentes YA EXISTEN — esta fase compone + añade
> la leyenda MONEY + extiende el linter + escribe el dossier legal 13. Espejo del
> 68-UI-SPEC (voto). Generado por gsd-ui-researcher; verificado por gsd-ui-checker.

---

## Contexto de fase (leer primero)

Esta es una fase de **MODIFICAR/montar detrás de un gate**, no de crear. Ya existen
en el repo y están cableados a las páginas:

| Componente | Sujeto | Base del enlace | Página de montaje |
|-----------|--------|-----------------|-------------------|
| `contratos-de-parlamentario.tsx` (`ContratosSection`) | entidad proveedora | **RUT-exacto** (ChileCompra) | `/parlamentario/[id]` `<section id="dinero">` |
| `financiamiento-de-parlamentario.tsx` (`FinanciamientoSection`) | donante | **nombre confirmado** (SERVEL, sin RUT) | `/parlamentario/[id]` `<section id="financiamiento">` |
| `contratos-por-contraparte.tsx` (`ContratosPorContraparteSection`) | la empresa (sujeto de página) | RUT-exacto | `/contraparte/[id]` `<section id="contratos">` |
| `aportes-por-contraparte.tsx` (`AportesPorContraparteSection`) | la empresa donante | nombre | `/contraparte/[id]` `<section id="aportes">` |

Todas ya honran: gate `moneyPublicEnabled()` (fail-closed `=== "true"`), tres/dos
estados honestos, monto verbatim, `ProvenanceBadge` por fila, `mt-12` de frontera,
error que se lanza (#34), CERO cómputo. `money-gate.ts` es el chokepoint único
(`import "server-only"`, sin prefijo `NEXT_PUBLIC_`).

### HALLAZGO RECTOR (lo que ESTA fase agrega — divergencia código vs. CONTEXT LOCKED)

El 68-UI-SPEC introdujo una **leyenda anti-insinuación verbatim 1× por superficie**
+ un **linter anti-vocabulario** (`anti-insinuacion-guard.test.ts`). Las superficies
MONEY hoy tienen buenos `Intro()` honestos por-superficie, pero **NO tienen la
leyenda MONEY equivalente** y el **linter NO las escanea**. El contrato de esta fase:

1. **Añadir la leyenda anti-insinuación MONEY (verbatim, §Leyenda)** como primer hijo
   de cada una de las cuatro superficies, encima del `Intro()`.
2. **Extender `anti-insinuacion-guard.test.ts`** para que su `SUPERFICIES` incluya los
   cuatro componentes MONEY + las secciones MONEY de ambas páginas, con la lista de
   términos causales/insinuantes de dinero añadida.
3. **Escribir el dossier legal 13** (`docs/legal/13-LEGAL-DOSSIER.md`) para sign-off
   humano 21.719 — el agente NO lo firma ni flipea.
4. **Guard CI anti-flip:** un commit de agente no puede cambiar el default a `"true"`.

Ningún cambio toca el gate, la RLS, ni convierte un no-monto en monto. Es aditivo.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (`components.json` presente; preset Default/Slate con overrides crema/petróleo LOCKED) |
| Preset | shadcn Default / Slate + tokens Phase 19 (`--background` crema `40 33% 97%`, `--accent-product` petróleo `183 38% 26%`) |
| Component library | Radix (shadcn: Badge, Tooltip vía `ProvenanceBadge`, Skeleton, Accordion vía `DetalleColapsable`) |
| Icon library | ninguna dependencia nueva; flechas por carácter (`↗` en `ProvenanceBadge`) |
| Font | Geist Sans (`--font-geist-sans`); `font-mono` (Geist Mono) para montos, fechas, códigos de orden, corte |

Sin registries de terceros. Sin bloques nuevos. Registry safety: no aplica.

---

## Composición en las fichas (gated-render contract)

### Regla rector del gate (LOCKED — deny-by-default)

TODA superficie MONEY se renderiza SOLO a través de `moneyPublicEnabled(process.env)`
(`=== "true"`, OFF por defecto). El contrato de render:

| Env | Ficha parlamentario | Página contraparte |
|-----|---------------------|--------------------|
| **OFF** (default, o cualquier valor ≠ `"true"`) | `<section id="dinero">` y `<section id="financiamiento">` **AUSENTES del HTML**. En su lugar, el carril honesto `<section id="financiamiento-pendiente">` (opacity-60): "Pendiente de revisión legal (Ley 21.719) antes de publicarse." El ciudadano ve que la sección EXISTE y por qué no hay datos — NUNCA silencio que se lea como "sin dinero". | `notFound()` es la **PRIMERA sentencia** de la page: la ruta entera 404, cero HTML de contraparte. |
| **ON** (solo preview local/operador hasta el flip humano) | Las dos `<section>` MONEY se montan; cada una es su propia `<section className="mt-12 scroll-mt-6">` HERMANA (nunca anidada con voto/lobby/patrimonio). | Los dos carriles `#contratos` / `#aportes` se montan, separados por `mt-12`. |

- **Doble candado:** el gate de presentación (`moneyPublicEnabled`) + la RLS
  deny-by-default de la DB. Ninguna ruta lee `MONEY_PUBLIC_ENABLED` crudo — SIEMPRE
  vía la función. Defensa en profundidad: cada `Section` re-chequea el gate y
  devuelve `null` aunque la página ya lo haya chequeado.
- **Frontera anti-insinuación `mt-12` (LOCKED):** un dato de dinero JAMÁS comparte
  `<section>`/`<article>`/`<Card>`/`<li>`/`<tr>` con un voto, lobby o patrimonio. En
  `/contraparte` NO se renderiza NINGÚN dato de voto en ninguna parte. No se mueve ni
  colapsa esa frontera.
- **Sin capa-1 preatentiva:** a diferencia del voto, MONEY no tiene resumen
  preatentivo; el `CarrilHeader` (`<h2>` + conteo neutro) va SIEMPRE visible, y el
  detalle se colapsa (`DetalleColapsable`) sólo cuando hay dato.
- **Leyenda MONEY (§Leyenda):** primer hijo de cada `Section`, ENCIMA del `Intro()`,
  para que el marco honesto preceda a cualquier dato.

---

## Spacing Scale

Escala 8-point vigente (Tailwind default). Sin tokens nuevos.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | `gap-1` líneas de la fila, `mb-1` bajo header de grupo de elección |
| sm | 8px | `gap-2` filas, `mb-2` bajo caveat ámbar, `space-y-1` intro |
| md | 16px | `mt-4` bajo header/detalle, `mb-4` bajo conteo neutro, `py-4` por fila |
| lg | 24px | `mt-6` entre grupos de elección |
| 2xl | 48px | `mt-12` frontera de carril anti-insinuación (LOCKED, no se toca) |

Exceptions: touch targets a **44px** (`min-h-[44px]`) en los enlaces de paginación
(Anteriores/Siguientes) y en `fuente oficial ↗` — ya presente, se conserva.

---

## Typography

Sin roles nuevos; se reusan los de la ficha.

| Role | Size | Weight | Line Height | Uso |
|------|------|--------|-------------|-----|
| Heading carril (`<h2>`) | 20px (`text-xl`) | 600 (`font-semibold`) | 1.2 | "Contratos del Estado asociados al RUT", "Aportes de campaña registrados en SERVEL" |
| Header grupo elección (`<h3>`) | 14px (`text-sm`) | 600 (`font-semibold`) `font-mono` | ~1.4 | "Elección 2021" |
| Sujeto de fila | 16px (`text-base`) | 400 | 1.5 | "Proveedor: {nombre}", "Aporta: {donante}", `<dd>` de campos |
| Body / nota / leyenda / intro | 14px (`text-sm`) | 400 | 1.5 | leyenda MONEY, intro honesto, enlace muted, `<dt>` labels |
| Cifras verbatim (monto/fecha/código/corte) | 16px (`text-base` `font-mono`) | 400 | 1.5 | **monto VERBATIM**, fecha de orden/aporte, código de orden, fecha de corte |
| Micro-nota fuente | 14px (`text-sm`) dentro de `ProvenanceBadge` | 400 | — | "Actualizado hace X · {fuente} — fuente oficial ↗" |

**Regla dura de verbatim:** el **monto** se renderiza en `font-mono` como el string
LITERAL de la fuente (`c.monto ?? "No publicado"`). NUNCA se reformatea, se agrupa en
miles, se convierte de moneda, ni se suma. Un no-monto (`null`) es "No publicado",
NUNCA "$0" ni celda vacía.

---

## Color

60/30/10 heredado (LOCKED Phase 19/21). Ningún color nuevo. **No hay escala semántica
de sentido en MONEY** (a diferencia del voto): un contrato/aporte no tiene "positivo/
negativo".

| Role | Value | Usage en MONEY |
|------|-------|----------------|
| Dominante (60%) | crema `hsl(40 33% 97%)` (`--background`) | fondo de página/carril |
| Secundario (30%) | `hsl(40 30% 99%)` (`--card`), `--muted` | intro, notas atenuadas (`text-muted-foreground`), labels `<dt>` |
| Acento producto (10%) | petróleo `hsl(183 38% 26%)` (`--primary`) | enlaces de paginación, `fuente oficial ↗`, focus-visible |
| Ámbar frescura | `text-amber-700` / borde `amber-400` | **SOLO frescura** (`ProvenanceBadge` stale >48h) **y el caveat "candidatura anterior"**. NUNCA severidad/juicio. |
| Destructive (rojo) | `hsl(0 72% 42%)` | **PROHIBIDO** en MONEY. Un rojo/verde sobre un contrato o aporte sería una insinuación de severidad ("mal"/"limpio"). No se usa. |

**Regla neutral MONEY (LOCKED, hard-fail del checker):** cero rojo/verde de
severidad sobre un dato de dinero. El ámbar existe SOLO para frescura y el caveat de
periodo anterior — ambos son temporales, no morales. Un vacío se pinta neutro
(`text-muted-foreground`), NUNCA verde de "sin contratos ✓".

---

## Leyenda anti-insinuación MONEY (copy EXACTO — MONEY-04)

Toda superficie MONEY lleva la leyenda, 1× al tope (encima del `Intro()`). Es el
análogo de la leyenda de voto (68-UI-SPEC §Leyenda), adaptada a dinero. Texto
**verbatim LOCKED**:

> **Un contrato o un aporte registrado es un hecho público observable. Un vínculo por RUT es una coincidencia exacta de identificador, no una afirmación de irregularidad. No medimos influencia ni intención, ni afirmamos que un aporte compre una decisión.**

Colocación:
- **Ficha parlamentario:** 1× al tope de `ContratosSection` (contratos) y 1× al tope
  de `FinanciamientoSection` (aportes). No se repite por fila ni por grupo.
- **Página contraparte:** 1× al tope de cada carril (`#contratos`, `#aportes`).

Tratamiento visual (reusa el patrón del rail de voto): texto
`text-sm text-muted-foreground`, borde-izquierdo petróleo
`border-l-[3px] border-[--primary] pl-2.5`, `mb-4` de sección. Nunca un banner
alarmista ni un disclaimer legal grande — es una nota sobria que precede el dato.

**Distinción por base del enlace (LOCKED, se refleja en la leyenda por superficie):**

| Superficie | Base | Frase LOCKED del intro (ya presente) — se CONSERVA |
|-----------|------|----------------------------------------------------|
| Contratos (ChileCompra) | **RUT-exacto** | "la asociación es por RUT exacto y no implica que el contrato sea del parlamentario." + línea muted "Enlazado por RUT al parlamentario." |
| Aportes (SERVEL) | **nombre confirmado** | "asociados a este candidato por su nombre, con identidad confirmada contra la maestra." + línea muted "Asociado por nombre confirmado al candidato." **NUNCA "por RUT".** |

La leyenda MONEY habla de "vínculo por RUT" porque el término "empresa ligada" SOLO
se afirma sobre base RUT-exacta. En la superficie SERVEL (por nombre), el enlace se
rotula "por nombre confirmado" y **jamás** se etiqueta como "ligada por RUT". Las dos
bases NUNCA se conflacionan.

Provenance INLINE acompaña la leyenda a nivel de dato (no la reemplaza):
`ProvenanceBadge` con **fuente + fecha de captura + enlace oficial** por fila (ya
presente vía `sourceLabel(origen)` / `fecha_captura` / `enlace`), más la línea de
**fecha de corte por fila** ("Consultado por RUT, corte al …" / "corte al …").

---

## RUT-exacto vs. nombre — distinción en la UI (LOCKED, anti-difamación)

La confianza del enlace se comunica con lenguaje distinto y NO se conflaciona:

| Dimensión | Contratos ChileCompra | Aportes SERVEL |
|-----------|-----------------------|----------------|
| Base del match | **RUT exacto** (identificador tributario coincide) | **nombre confirmado** (adjudicado/auditado contra la maestra; la fuente NO trae RUT) |
| Frase de enlace | "Enlazado por RUT al parlamentario." | "Asociado por nombre confirmado al candidato." |
| Estado vacío con marcador | "consultado sin contratos" (corte por RUT) | "verificado sin aportes" (corte por nombre) |
| "empresa ligada" permitido | SÍ (solo RUT-exacto) — pero como HECHO factual + conteo, NUNCA "ligada a [irregularidad]" | **NO** — SERVEL por nombre NUNCA se etiqueta "ligada por RUT" |
| RUT del donante/proveedor renderizado | NO (nunca se muestra RUT de terceros) | NO (Ley 21.719; el RPC no lo proyecta) |

**Nunca** una superficie SERVEL (por nombre) hereda el lenguaje "por RUT exacto".
**Nunca** un name-match ni un LLM produce el vínculo "empresa ligada" — solo el
identificador tributario. El checker valida que el copy de aportes no contenga "por
RUT" y que el copy de contratos no afirme causalidad.

---

## Frescura declarada por dato (LOCKED — nunca viejo como actual)

Cada dato lleva su frescura, en tres capas, todas conservadas:

1. **`ProvenanceBadge` por fila:** "Actualizado hace X · {fuente}"; si el dato tiene
   >48h se marca ámbar (no se oculta).
2. **Fecha de corte por fila:** "Consultado por RUT, corte al {fecha}" (contratos) /
   "corte al {fecha}" (aportes) / "Consolidado, corte al {fecha}" (contraparte). La
   fecha de corte es distinta de la fecha de captura y siempre `font-mono`.
3. **Elección/periodo por fila (aportes):** `Elección:` es load-bearing y SIEMPRE
   presente (defensa en profundidad). Un aporte de una candidatura anterior lleva el
   caveat ámbar de grupo ("Aporte de una candidatura anterior ({eleccion}). No
   corresponde al mandato actual.") — nunca se atribuye al mandato actual sin su
   periodo. La heurística es CONSERVADORA: si el periodo actual no es derivable, NO
   se etiqueta "anterior".

Un dato sin frescura conocida muestra "Sin fecha de actualización" / "No publicado",
NUNCA se presenta como actual.

---

## Linter anti-vocabulario-insinuante MONEY (MONEY-04)

Extender `app/lib/anti-insinuacion-guard.test.ts` (el guard de voto de Phase 68) para
cubrir las superficies MONEY. Mismo molde (`stripTsComments` + `buildTermRegex` +
mutation self-check + no-falsos-positivos). El contrato es el comportamiento:

**Añadir al alcance escaneado** (`SUPERFICIES`, rutas relativas a `app/`):
- `components/contratos-de-parlamentario.tsx`
- `components/financiamiento-de-parlamentario.tsx`
- `components/contratos-por-contraparte.tsx`
- `components/aportes-por-contraparte.tsx`
- `app/contraparte/[id]/page.tsx`
- (la sección MONEY de `app/parlamentario/[id]/page.tsx` ya está en el alcance del guard)

**Añadir términos prohibidos MONEY** (lista dura, hard-fail, en copy RENDERIZADO):
`financió`, `financió su voto`, `a cambio de`, `a cambio del voto`, `compró`,
`compró su voto`, `pagó por`, `soborno`, `coima`, `corrupción`, `favor`, `favoreció`,
`empresa ligada a` (como insinuación de vínculo indebido; el HECHO "ligada por RUT"
sí se permite), `conflicto de interés` (como veredicto afirmado), `influencia`,
`captura`, `lobby a cambio`, `contrato a dedo`, `direccionado`. Más los términos de
voto ya vigentes (para el caso de que una superficie MONEY intente cruzar a voto).

**Restar de la negación (`NEGACIONES_LOCKED`):** añadir la leyenda MONEY verbatim,
porque contiene "influencia"/"intención"/"irregularidad" en un contexto que las
NIEGA ("No medimos influencia ni intención…"). Se resta antes del negative-match,
igual que la leyenda de voto.

**Mutation self-check MONEY:** el guard debe FALLAR ante un fixture en memoria como
`<p>esta empresa financió su voto a cambio de un contrato</p>` — para que no sea un
no-op verde. No-falsos-positivos: `empresa_ligada_por_rut` (identificador snake_case)
NO dispara; la frase factual "Enlazado por RUT al parlamentario." NO dispara.

---

## Guard CI anti-flip (MONEY-05 — acto humano exclusivo)

Un guard ejecutable (mismo lugar que el lockdown-guard / anti-insinuacion-guard: un
`*.test.ts` que la suite recoge) que FALLA si un commit de agente:
- cambia el default de `moneyPublicEnabled` de `=== "true"` a truthiness laxa, o
- introduce en el repo (`.env`, config committeada, workflow) `MONEY_PUBLIC_ENABLED=true`, o
- añade una ruta MONEY que lea `MONEY_PUBLIC_ENABLED` crudo en vez de vía la función.

El flip a `"true"` es un ACTO HUMANO EXCLUSIVO del operador, condicionado a
`signoff: approved` en `docs/legal/13-LEGAL-DOSSIER.md` (21.719). El agente ESCRIBE
el dossier para revisión; NO lo firma ni flipea.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Leyenda anti-insinuación MONEY (LOCKED) | "Un contrato o un aporte registrado es un hecho público observable. Un vínculo por RUT es una coincidencia exacta de identificador, no una afirmación de irregularidad. No medimos influencia ni intención, ni afirmamos que un aporte compre una decisión." |
| Heading contratos (LOCKED, no-posesivo) | "Contratos del Estado asociados al RUT" |
| Heading aportes (LOCKED, no-posesivo) | "Aportes de campaña registrados en SERVEL" |
| Enlace muted contratos (RUT) | "Enlazado por RUT al parlamentario." |
| Enlace muted aportes (nombre) | "Asociado por nombre confirmado al candidato." |
| Conteo neutro contratos | "{N} contrato(s) registrado(s)." (único agregado; sin suma de montos, sin ranking) |
| Conteo neutro aportes | "{N} aporte(s) registrado(s)." |
| Monto (verbatim) | `{c.monto}` literal en `font-mono`, o "No publicado" si `null`. NUNCA reformateado. |
| Empty contratos — no consultado | "Aún no hemos consultado ChileCompra para el RUT de este parlamentario. Esto no significa que no existan contratos asociados — la consulta por RUT se está incorporando." |
| Empty contratos — consultado sin contratos | "Consultamos ChileCompra por el RUT de este parlamentario (corte al {fecha}) y no se registran contratos asociados a ese RUT a esa fecha." |
| Empty aportes — no ingestado | "Aún no hemos ingerido los aportes de campaña de este candidato desde SERVEL. Esto no significa que no existan aportes — los datos de SERVEL se están incorporando." |
| Empty aportes — verificado sin aportes | "Consultamos SERVEL por este candidato (corte al {fecha}) y no se registran aportes asociados a ese candidato a esa fecha." |
| Empty contraparte (vacío honesto débil) | "Aún no hemos consolidado los contratos/aportes … para esta empresa. Esto no significa que no existan." |
| Caveat candidatura anterior (ámbar) | "Aporte de una candidatura anterior ({eleccion}). No corresponde al mandato actual." |
| Gate OFF (ficha, pendiente) | "Financiamiento y contratos del Estado — Pendiente de revisión legal (Ley 21.719) antes de publicarse." |
| Enlace a fuente oficial | "fuente oficial ↗" (en `ProvenanceBadge`) |
| Error state | Se LANZA (route boundary `error.tsx`), nunca se degrada a "sin contratos"/"sin aportes". Un fallo de RPC sube a la UI de error honesta. |
| Destructive | Ninguna acción destructiva; los carriles son read-only. |

Ninguna acción destructiva. Prohibido cualquier verbo causal dinero→decisión
("financió", "a cambio de", "compró su voto") — enforzado por el linter.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Badge, Tooltip (vía `ProvenanceBadge`), Skeleton, Accordion (vía `DetalleColapsable`) — ya instalados | not required |
| terceros | ninguno | no aplica |

---

## Gate de comprensión BrowserOS ("comprensible", gated-preview)

Esta fase cierra con un veredicto de lectura fría ciudadana sobre las superficies
MONEY en **modo gated-preview** (flag ON solo en preview local/operador, nunca en
prod hasta el flip humano). La superficie MONEY DEBE pasar como **legible + honesta +
no-insinuante** ante un lector no experto:

- El lector entiende que un **contrato/aporte registrado es un hecho público**, no una
  acusación — la leyenda MONEY precede a cualquier dato.
- El lector distingue **"por RUT exacto" (contratos)** de **"por nombre confirmado"
  (aportes)** y no lee el segundo como si fuera identidad tributaria.
- El lector percibe el **monto como verbatim de la fuente**, no como un cálculo del
  observatorio; un "No publicado" no se lee como "$0".
- El lector NO encuentra ningún **verbo causal** (dinero→voto/decisión), ningún
  veredicto de "empresa ligada a irregularidad", ningún rojo/verde de severidad.
- El lector ve la **frescura por dato** (corte + captura + elección) y no confunde un
  aporte de campaña anterior con el mandato actual.
- El lector puede **llegar a la fuente oficial** (ChileCompra / SERVEL) desde cada fila.
- Con el gate **OFF**, el lector ve el carril "Pendiente de revisión legal" — nunca
  silencio que se lea como "sin dinero".

---

## Acceptance — 6 pilares que valida ui-checker / ui-review

1. **Copywriting honesto (MONEY-04):** leyenda anti-insinuación MONEY verbatim
   presente 1× por superficie (las 4), encima del intro; headings no-posesivos;
   enlace "por RUT" en contratos y "por nombre confirmado" en aportes (nunca
   conflados); CERO verbos causales/insinuantes de la lista prohibida en copy
   renderizado; empty/error states honestos (error se lanza, no se disfraza de 0;
   vacío nunca se lee "limpio").
2. **Visuals sin insinuación:** cero cómputo (sin suma de montos, sin ranking, sin %);
   conteo neutro como único agregado; monto VERBATIM `font-mono` (nunca reformateado);
   "No publicado" nunca es "$0"; NINGÚN dato de voto en `/contraparte`; las superficies
   MONEY nunca comparten unidad de UI con voto/lobby/patrimonio.
3. **Color (regla neutral MONEY, hard-fail):** cero rojo/verde de severidad sobre un
   dato de dinero; ámbar SOLO para frescura (>48h) y caveat de periodo anterior;
   petróleo reservado a enlaces/navegación/focus; vacío en neutro, nunca "verde limpio".
4. **Typography + a11y:** monto/fecha/código/corte en `font-mono` verbatim; jerarquía
   `h2`→`h3` sin re-nivelar; touch targets 44px en paginación y enlace de fuente;
   `ProvenanceBadge` con `aria-label` de fuente oficial.
5. **Spacing + gate:** frontera de carril `mt-12` intacta (dinero nunca comparte
   contenedor con otro dominio); escala 8-point; **gate deny-by-default verificado:
   OFF ⇒ secciones AUSENTES del HTML en la ficha (carril "pendiente" en su lugar) y
   `notFound()` en `/contraparte`; ON solo vía `moneyPublicEnabled()`, nunca env cruda;
   guard CI anti-flip presente**; linter MONEY extendido con mutation self-check.
6. **Procedencia + frescura + RUT-vs-nombre (MONEY-04):** `ProvenanceBadge`
   (fuente/fecha/enlace) + fecha de corte por fila; elección por fila en aportes;
   "empresa ligada" SOLO sobre base RUT-exacta (nunca name-match/LLM); SERVEL por
   nombre nunca etiquetado "ligada por RUT"; RUT de terceros nunca renderizado
   (21.719); frescura declarada por dato, nunca viejo como actual.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing + Gate: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

---

## Legal Gate (acto humano, NO del agente)

- [ ] `docs/legal/13-LEGAL-DOSSIER.md` escrito por el agente para revisión 21.719.
- [ ] `signoff: approved` — provisto por el humano (operador) tras asesoría legal.
- [ ] Flip `MONEY_PUBLIC_ENABLED=true` — acto humano exclusivo, POST sign-off. NO esta corrida.
