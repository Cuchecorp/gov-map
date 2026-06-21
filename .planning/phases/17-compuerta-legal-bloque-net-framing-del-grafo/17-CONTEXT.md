# Phase 17: Compuerta Legal — Bloque NET (framing del grafo) - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning
**Mode:** Gate de proceso (sign-off legal humano). Construible: el DOSSIER de preparación + el mecanismo de gate. El sign-off real queda como deuda de operador (F17). Decisión macro del operador (2026-06-21): "todo gated-OFF" — preparar el dossier y construir Phase 18 (grafo NET) COMPLETO pero detrás de un feature-gate apagado, como MONEY 14-16.

<domain>
## Phase Boundary

Gate de proceso (no de construcción) sobre la **superficie más insinuante del producto**: el grafo de influencia (NET, Phase 18). Antes de exponerlo públicamente se requiere sign-off legal (Ley 21.719) sobre el **framing del grafo** — específicamente el riesgo de que una **arista o un camino se lea como acusación**. Esta fase entrega (1) un **dossier legal NET** (`17-LEGAL-DOSSIER.md`) que estructura la superficie de riesgo del grafo para revisión de un abogado externo, y (2) la especificación del **gate de exposición** `NET_PUBLIC_ENABLED` (doble candado RLS + flag server-side, default OFF) que Phase 18 introducirá.

El sign-off humano real es **deuda de operador (F17)**; su estado verificable vive en el front-matter YAML del dossier (`signoff: pending`). Encender `NET_PUBLIC_ENABLED` **depende de `signoff: approved`**. Phase 18 se construye bajo el gate apagado; la **exposición** no se enciende sin sign-off.

**Fuera de alcance:** el sign-off legal en sí (humano); MONEY (cubierto por Phase 13, gate propio); cambios al diseño cerrado de Phase 19.
</domain>

<decisions>
## Implementation Decisions

### Dossier legal NET — contenido y forma
- Ubicación/formato: `17-LEGAL-DOSSIER.md` en el directorio de la fase + copia en `docs/legal/`. Front-matter YAML con `signoff: pending | approved | rejected`, `asesor`, `fecha_signoff`, `observaciones`, y nota "Encender NET_PUBLIC_ENABLED requiere signoff: approved".
- Espeja la estructura de `13-LEGAL-DOSSIER.md` (precedente), pero centrado en el GRAFO:
  - **§0 Propósito y descargo:** material de PREPARACIÓN, no dictamen; no afirma licitud. Reusa el marco temporal de Ley 21.719 del dossier MONEY (13) por referencia, sin re-litigarlo.
  - **§1 La superficie NET = relaciones derivadas.** El grafo NO añade datos nuevos: deriva aristas de los tres bloques ya poblados (VOTE, INT lobby/patrimonio, MONEY). El riesgo no es el dato, es la **composición** (juntar voto + dinero + reunión en una arista/camino puede leerse como acusación aunque cada hecho sea público y con fuente).
  - **§2 Riesgo NUCLEAR: arista/camino como acusación.** El sign-off debe cubrir que el framing es DESCRIPTIVO: aristas tipadas, con fuente y ventana temporal; SIN score de sospecha; SIN path-finding como feature destacada; SIN lenguaje causal. Pregunta nuclear: ¿el grafo, por componer hechos públicos, crea un dato derivado que insinúa conducta? (PENDIENTE asesor.)
  - **§3 Datos sensibles en nodos/aristas:** afiliación política (party) + sentido de voto + terceros privados (donantes/lobistas) como nodos. Hereda la postura deny-by-default de lobby/probidad (0021/0022) y el piso PII (0018): el partido NUNCA llega a anon; ambos extremos de toda arista deben tener identidad `confirmado`.
  - **§4 Minimización por diseño:** ninguna arista inferida por LLM (solo aristas con fuente verificable); ningún camino presentado como acusación; copy sobrio sin causalidad ni score de persona; doble candado (RLS deny-by-default sobre `entidad`/`arista` + flag `NET_PUBLIC_ENABLED` server-only default OFF).
  - **§5 Propósito acotado:** transparencia/control ciudadano, "qué pasó, cuándo y según qué fuente"; NUNCA intención ni causalidad. Refuerza interés legítimo.
  - **§6 CC BY 4.0 propagación:** los nodos/aristas derivados de **InfoProbidad** deben propagar la atribución CC BY 4.0 (en nodo/tooltip). Otros datasets llevan su propia atribución por fila (ChileCompra = mención de fuente; SERVEL = por verificar; votos/tramitación = Cámara/Senado). NO etiquetar todo como CC BY 4.0.
  - **§7 Base de licitud:** interés legítimo + test de ponderación (referencia al borrador de 13, con el factor adicional del riesgo de composición). PENDIENTE asesor.
  - **§8 Trazabilidad y consumo por el gate:** sign-off como prerrequisito duro (ROADMAP Phase 17 SC3); `NET_PUBLIC_ENABLED` depende de `signoff: approved`; reversibilidad (Phase 18 se construye bajo gate apagado).
  - **§9 Checklist de sign-off** para el asesor (campos + checklist por sección).
  - **Anexo:** supuestos a verificar (reusa los A1-A8 de Ley 21.719 del dossier MONEY por referencia + supuestos específicos del framing del grafo).

### Mecanismo de gate de exposición NET (especificación; lo implementa Phase 18)
- **Doble candado:** (a) tablas `entidad`/`arista` nacen deny-by-default a `anon` por RLS (mismo patrón 0018/0021/0022); el RPC público del grafo es PII-safe (nunca emite partido/rut; ambos extremos confirmados). (b) flag server-only `NET_PUBLIC_ENABLED` (default `false`, fail-closed) en `app/lib/net-gate.ts`, espejo de `money-gate.ts`, que oculta la ruta `/red` (o equivalente) y el RPC del grafo.
- Verificación: pgTAP que afirma `anon` no lee `entidad`/`arista` directamente; test que afirma `NET_PUBLIC_ENABLED` default `false`; test que afirma el RPC del grafo solo devuelve aristas con ambos extremos `confirmado` y sin partido.

### Sign-off como prerrequisito verificable
- El estado vive en el YAML del dossier. Mientras `signoff != approved`, el operador NO enciende `NET_PUBLIC_ENABLED`. La dependencia es verificable por inspección.

### Claude's Discretion
- Redacción fina del dossier (respetando el tono "preparación, no dictamen" de 13); qué supuestos de 13 se reusan por referencia vs se re-enuncian; nombre exacto de la ruta NET y del flag.
</decisions>

<code_context>
## Precedente y artefactos a reusar
- **`13-LEGAL-DOSSIER.md`** — plantilla estructural exacta (front-matter de sign-off, §0 descargo, superficies, minimización, base de licitud, checklist, anexo de supuestos). El dossier NET lo espeja.
- **`13-RESEARCH.md`** — research de Ley 21.719 (idNorma, datos sensibles, interés legítimo, atribución por dataset). Reusable por referencia; NO re-litigar el marco temporal.
- **`app/lib/money-gate.ts`** — patrón del flag server-only `MONEY_PUBLIC_ENABLED` (default false, fail-closed). `net-gate.ts` lo espeja.
- **`supabase/migrations/0018_piso_pii.sql`, `0021_lobby.sql`, `0022_probidad.sql`** — patrón RLS deny-by-default + revoke a anon. Las tablas `entidad`/`arista` lo heredan.
- **REQUIREMENTS.md LEGAL-02** — "Sign-off legal sobre el framing del grafo aprobado ANTES de exponer públicamente NET."
</code_context>

<specifics>
## Gate de verificación de la fase
- `17-LEGAL-DOSSIER.md` existe, con front-matter `signoff: pending`, cubre las 3 superficies de riesgo del grafo (composición/acusación, datos sensibles en nodos, terceros privados), minimización (no-LLM, no-path-as-accusation, doble candado), base de licitud y CC BY 4.0, y checklist de sign-off.
- Copia en `docs/legal/`.
- REQUIREMENTS.md LEGAL-02 enlazado al dossier; estado del sign-off = pending (deuda de operador F17).
- La especificación del gate `NET_PUBLIC_ENABLED` queda documentada para que Phase 18 la implemente.
</specifics>

<deferred>
## Deferred Ideas
- **Sign-off legal humano real** — deuda de operador F17 (un abogado externo revisa, completa y firma el dossier; setea `signoff: approved`).
- **Exposición pública de NET** — no se enciende hasta `signoff: approved` (gate apagado).
</deferred>
