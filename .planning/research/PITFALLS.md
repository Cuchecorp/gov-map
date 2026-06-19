# Pitfalls Research — v2.0 "Parlamentarios 360"

**Domain:** Civic-data platform — adding per-legislator analysis (votes, lobby, assets/interests, money, influence graph) on top of a shipped Chilean congress tracker.
**Researched:** 2026-06-18
**Confidence:** HIGH on identity/causality/legal framing (anchored to PROJECT.md guardrails + verified sources); MEDIUM-HIGH on source-fragility (endpoints validated 17/06/2026; SERVEL unvalidated by design).

> Scope note: these are the mistakes specific to **adding VOTE / INT / MONEY / NET to the existing system** — not generic web-app mistakes. Every per-legislator attribution inherits v1.0 existential risk #1 (identity fails silently → false-but-credible claim) and #2 ("máquina de sospechas"). The v1.0 identity guard (`estado_vinculo='confirmado'` → link; otherwise null + raw mention) and the "trazabilidad sobre interpretación" rule are LOCKED inputs; v2.0 must extend them to four new datasets, not re-invent them.

---

## A. Identity-Attribution Pitfalls

Each new dataset is a new way to pin a claim on a named person. A wrong match here is not a cosmetic bug — it manufactures "Diputado X votó / se reunió / cobró / donó" that is false and looks authoritative. The v1.0 vote slice already solved this for Cámara (deterministic by official `Diputado/Id`) and Senado (name → `correrPipeline`, only `determinista` populates the FK). v2.0 must apply the **same confirmed-link guard to every new join**, and the new datasets are harder because most of them join by RUT or by free-text name, not by an official chamber ID.

### Pitfall A1: Treating an external dataset's join as automatically "confirmed"

**What goes wrong:** A lobby meeting, a donation, or a contract is matched to a `parlamentario.id` and rendered as a confirmed fact on the legislator's ficha, bypassing the `estado_vinculo` gate that the vote pipeline enforces. The four new sources do NOT carry the chamber's official `Diputado/Id` — leylobby uses its own actor IDs, SERVEL uses candidate RUT, ChileCompra uses supplier RUT, declarations use the official's own RUT. None of these is the v1.0 deterministic key, so a naive `JOIN ... ON nombre` or `ON rut` silently asserts links that never passed the golden-set gate.

**Why it happens:** The vote pipeline made deterministic linking look "free" because Cámara handed over an official ID. Developers generalize "we link votes, so we link everything" and forget the new keys are weaker.

**How to avoid:** Generalize the guard into a single reusable rule: **no new dataset may write a `parlamentario_id` FK unless the match resolved to `confirmado`/`determinista` through the existing `@obs/identity` pipeline.** Otherwise persist the raw actor string + the source link, FK null, and render with the "identidad no verificada" marker (same UI component as Senado votes). Make this a typed invariant (a writer that refuses to set the FK on a non-confirmed match), not a convention. Add golden-set cases for each new source's name/RUT forms.

**Warning signs:** A ficha shows a meeting/contract with a working link to the legislator but no audit row in `identidad_audit`. A new connector writes FKs directly instead of going through `correrPipeline`. Counts of "linked" rows ≈ counts of "raw" rows on day one (real linking is always partial).

**Phase to address:** First INT/MONEY block (the lobby/declaration ingest) — the guard must exist before any cross-dataset attribution lands. NET block must consume only confirmed links.

---

### Pitfall A2: RUT as a false "strong key" — wrong-person RUT match

**What goes wrong:** PROJECT.md calls RUT "el más fuerte" cross key. But SERVEL/ChileCompra RUTs belong to *candidates / suppliers / natural persons*, not to the chamber roster. A donation RUT or a contract supplier RUT can: (a) be a homonym/relative sharing a surname, (b) be a company RUT whose representative shares the legislator's name, (c) be a transcription error (missing DV, transposed digits), or (d) be a *former* candidate who is not the sitting legislator. Any of these produces "Diputado X recibió $Y" when X never did.

**Why it happens:** RUT *feels* unique, so a match is trusted without validating the check digit (DV módulo-11), without confirming the RUT actually belongs to the roster row, and without distinguishing persona-natural RUT from persona-jurídica RUT.

**How to avoid:** (1) Validate the RUT check digit before any join; reject malformed RUTs to a review queue, never guess. (2) RUT-based links still pass through the identity gate — a RUT match against the internal master is `determinista` only if the master row's RUT (internal-only field) matches exactly; otherwise it is a candidate, not a fact. (3) Tag every money/contract row as `persona_natural` vs `persona_juridica` and never collapse a company contract into a personal attribution without an explicit, sourced ownership chain. (4) Keep RUT internal-only (already LOCKED) so a wrong RUT match cannot leak as public PII.

**Warning signs:** Links appearing for legislators with very common surnames (González, Muñoz, Rojas) at suspiciously high rates. Contract attributions to a legislator whose RUT digit-validates but whose name doesn't normalize-match. Donation totals that spike from a single high-collision surname.

**Phase to address:** MONEY block (SERVEL + ChileCompra). The DV validator and persona-natural/jurídica tagging are entry criteria for that block.

---

### Pitfall A3: Name-only joins across sources with different name conventions

**What goes wrong:** leylobby, declarations, SERVEL and ChileCompra each render names differently (orden de apellidos, tildes, "ñ", second names dropped, nombre social vs legal, all-caps). The v1.0 `normalizarNombre` was tuned for catálogo↔votación convergence. New sources introduce new variants it has not seen, so legitimate matches fail (under-link → missing data, "looks empty") AND near-collisions pass (over-link → wrong person).

**Why it happens:** Reusing `normalizarNombre` as-is and assuming it generalizes to four new corpora.

**How to avoid:** Extend the golden set with real name strings sampled from each new source BEFORE building the connector; treat the golden gate (≥0.95) as the acceptance test for each new source's normalization. Where a source offers any stronger key (leylobby actor id, declaration RUT), prefer it over name and let name only corroborate.

**Warning signs:** Golden precision drops below 0.95 when new-source name fixtures are added. A legislator's lobby tab is empty while the source clearly lists meetings (under-link). Two legislators with similar names share meetings (over-link).

**Phase to address:** Each ingest block, gated by the golden CI check (already wired in v1.0).

---

### Pitfall A4: Stale roster — attributing to the wrong term's legislator

**What goes wrong:** Money and declarations span years and *campaigns*; a SERVEL donation may belong to a candidacy by someone who is not the current office-holder, or to the same person in a prior term. Matching against today's 186-row master (sembrada v1.0) without a temporal key attributes historical money to the wrong sitting person, or to a "legislator" who lost.

**Why it happens:** The v1.0 master is a snapshot of *vigentes*. Money/declaration data is historical and term-scoped.

**How to avoid:** Carry `periodo`/`fecha` on every attribution and constrain matches to the period in which the person held (or sought) office. Distinguish "candidate" from "elected." Never render a candidacy-era donation as a fact about the current mandate without dating it explicitly.

**Warning signs:** Donations dated before a legislator's first term showing on their current ficha. Attributions to names not in the current 186 but rendered as if current.

**Phase to address:** MONEY block; the temporal constraint is a schema requirement (period column on attribution tables).

---

## B. Causality / Insinuation Pitfalls ("máquina de sospechas")

This is existential risk #2, and v2.0 is where it gets dangerous: v1.0 only crossed projects×votes (factual, intra-congress). v2.0 crosses **money × votes × meetings** — exactly the juxtaposition that *reads as* "he was paid, then he voted, because of the payment," even when the system says nothing of the sort. The legal defense of the whole product rests on never asserting motive.

### Pitfall B1: Temporal adjacency rendered as implication

**What goes wrong:** Placing "received donation from sector S" next to "voted FOR bill affecting S" on a timeline, or auto-surfacing "lobby meeting 3 days before vote," lets the UI *imply* causality the data cannot support. Even with no sentence asserting motive, the layout is the claim.

**Why it happens:** Timelines and "related" panels are the natural UI for cross-dataset data, and proximity is visually persuasive. Engagement-oriented design rewards the "smoking gun" framing.

**How to avoid:** (1) Never auto-generate a cross that pairs a money/lobby event with a vote as a *single highlighted unit*. (2) Show each dataset in its own sourced lane; require the *user* to navigate between them rather than pre-composing the juxtaposition. (3) Ban affinity/score/ranking language ("alineado con", "favorable a", "vinculado a") — same discipline already applied to "proyectos similares" (no score, no affinity language) in v1.0. (4) Every cross carries the standing disclaimer: correlación temporal con fuente, sin afirmación de causa.

**Warning signs:** A component that takes both a vote and a donation as props. Copy containing "porque", "a cambio de", "favoreció", "alineado". A feature framed as "detect conflicts of interest" rather than "show declared interests."

**Phase to address:** NET block (graph) is the highest-risk surface; but the framing rules must be set in the FIRST block that renders two datasets together. Make "no composed money-vote unit" a UI success criterion.

---

### Pitfall B2: The influence graph as an automatic "corruption map"

**What goes wrong:** A graph cross-linking legislators ↔ lobbyists ↔ donors ↔ contractors invites readers (and headline-writers) to treat an *edge* as an *accusation*. A path "donor → legislator → contractor" looks like a kickback even when each edge is an independently-sourced public fact with no connection in reality.

**Why it happens:** Graphs visually assert relationship and flow; a path between two nodes reads as a story.

**How to avoid:** (1) Edges are typed and sourced as discrete facts ("declaró reunión", "aparece como donante", "adjudicó contrato"), never as "influence." (2) No edge weighting that ranks "suspicion." (3) Path-finding between a donor and a contractor through a legislator must NOT be a headline feature; if shown at all, each hop shows its source/date and an explicit "estas relaciones son hechos públicos independientes; el sistema no afirma conexión entre ellas." (4) Defer NET to last (already planned) so the framing is mature before the most insinuating surface ships.

**Warning signs:** Graph copy or node sizing that implies importance/suspicion. A "find connections between X and Y" search. Press using the graph to assert wrongdoing the data doesn't show.

**Phase to address:** NET block, last. Legal review (already mandated pre-launch) must specifically sign off on the graph framing.

---

### Pitfall B3: Declarations of interest framed as proof of conflict

**What goes wrong:** Patrimony/interest declarations exist *to be public*; rendering them as "conflictos detectados" converts a transparency record into an accusation, and inverts the legal posture (the legislator complied with the law; the platform implies guilt).

**Why it happens:** "Conflict of interest" is the compelling story; "declared interest" is the accurate one.

**How to avoid:** Label strictly as "intereses declarados" / "patrimonio declarado" with source and date. Never compute or display a "conflict" verdict. Let the user see the declaration alongside the legislator's committee/votes and draw their own conclusion — the system describes, never adjudicates.

**Warning signs:** Any "conflicto" / "incompatibilidad" verdict field. Auto-flagging of "interest in a sector this person legislates."

**Phase to address:** INT block (declarations).

---

## C. Source-Fragility Pitfalls

The v1.0 ingest framework (rate-limit 2–3s serial, robots, UA, R2 content-addressed cache, drift-non-blocking) is the right substrate — but v2.0's new sources are markedly more fragile than the XML/JSON gov endpoints v1.0 consumed.

### Pitfall C1: Assuming `opendata.camara.cl` won't deliver the individual vote (and over-/under-planning around it)

**What goes wrong:** The whole VOTE block was treated as blocked pending a never-validated endpoint. Two opposite mistakes: (a) building elaborate fallbacks/scraping for a problem that doesn't exist, or (b) committing the block's scope before validating and then discovering a gap mid-build.

**Verified finding (2026-06-18, MEDIUM-HIGH):** `opendata.camara.cl/wscamaradiputados.asmx` exposes `getVotaciones_Boletin`, whose response contains a `Votos` container of `Voto` elements, each with `Diputado` and `Opcion`, plus totals (`TotalAfirmativos/Negativos/Abstenciones/Dispensados`) and `Pareos`. **The per-deputy individual vote does appear to be available there** — contrary to the "never validated, may not exist" framing. This still needs a live spike (the project requires it) but the spike is now expected to *confirm*, not to *discover a blocker*.

**How to avoid:** Keep the validation spike as Fase 1 of v2.0 (as planned) but scope it tightly: confirm (1) per-deputy `Diputado`+`Opcion` is present and complete vs totals, (2) the `Diputado` identifier maps to the v1.0 official `Diputado/Id` (enabling deterministic linking — the good path), (3) coverage/history depth, (4) rate behavior behind the WAF. Only branch to a fallback if the spike fails. Do NOT freeze downstream scope until the spike returns.

**Warning signs:** Spike returns totals but empty/partial `Votos`. `Diputado` carries only a name, not the official id (forces name-pipeline linking like the Senado, weaker). History truncated to recent legislatura only.

**Phase to address:** VOTE block, Fase 1 spike (already the plan). Treat as confirm-or-replan gate.

---

### Pitfall C2: SERVEL artisanal connector — brittle, non-REST, will break silently

**What goes wrong:** SERVEL campaign-finance data is not a clean REST API (PROJECT.md: "conector artesanal frágil"). Such connectors break on layout changes, paginate oddly, hide data behind forms/exports, and degrade into *partial* scrapes that look complete. A half-scraped donation set understates a legislator's money — a false-by-omission claim.

**Why it happens:** Treating SERVEL like the Senado XML; assuming a successful HTTP 200 means complete data.

**How to avoid:** (1) Build SERVEL last among MONEY sources and behind an explicit completeness check (expected counts / totals reconciliation), not just "200 OK." (2) Snapshot raw to R2 (already the pattern) so a future format break is recoverable from history. (3) Drift detection must be *loud* for SERVEL specifically — non-blocking drift (v1.0 default) is wrong here; a structure change should quarantine the run, not silently emit fewer rows. (4) Render honest emptiness/staleness (the v1.0 "estados vacíos honestos" posture) rather than partial totals presented as full.

**Warning signs:** Donation counts dropping run-over-run without an obvious cause. A SERVEL run completing far faster than usual. Totals that don't reconcile to any SERVEL-published aggregate.

**Phase to address:** MONEY block; SERVEL gets its own completeness-gate sub-task and an opt-in blocking-drift mode.

---

### Pitfall C3: ChileCompra rate/quota and RUT-query volume

**What goes wrong:** Querying ChileCompra by RUT for ~186 legislators (× related RUTs) is a high request count against a public API with quotas/rate limits; bursts trip the gov WAF (the same 2–3s constraint) and/or exhaust a daily quota, yielding partial contract sets that read as "this legislator has no state contracts" when the run was just throttled.

**Why it happens:** Fan-out queries (one per RUT) multiply request volume; the 2–3s serial constraint makes a full sweep slow, tempting parallelization that the WAF punishes.

**How to avoid:** Keep serial 2–3s per host (LOCKED), queue the RUT sweep through pgmq (v1.0 pattern), checkpoint progress, and use the GitHub Actions escape hatch for the full historical backfill (>400s Edge limit). Distinguish "queried, no contracts found" from "not yet queried" in the data model so the UI never shows a throttled gap as a confirmed zero.

**Warning signs:** 429s in the ChileCompra connector logs. A sweep that never finishes within Edge limits. Fichas showing "sin contratos" for legislators a manual check shows have contracts.

**Phase to address:** MONEY block; reuse pgmq + GH Actions backfill from v1.0.

---

### Pitfall C4: HTML that changes (leylobby, declarations, SERVEL) breaking parsers silently

**What goes wrong:** leylobby/InfoProbidad/SERVEL surfaces are HTML/portal-based and change without notice (cf. the v1.0 Senado Next.js `buildId` lesson). A changed table/selector makes a cheerio parser emit zero or garbage rows; drift-non-blocking lets the run "succeed" with bad/empty data.

**Why it happens:** v1.0's drift posture is non-blocking by design (good for tramitación), but for these fragile public-PII sources, silent degradation is worse than failing.

**How to avoid:** Per-source drift policy: for high-stakes PII sources (declarations) and fragile ones (SERVEL), drift quarantines the run and alerts; for stable XML, keep non-blocking. Pin parsers to fixtures captured from live, golden-test them, and re-capture on a schedule. Never hardcode portal build artifacts (the `buildId` lesson is LOCKED in CLAUDE.md).

**Warning signs:** Row counts collapse to zero after a source redeploy. Drift alerts firing repeatedly on the same source. Parsed fields shifting columns.

**Phase to address:** Each HTML-source block; per-source drift policy decided at block start.

---

## D. Legal Pitfalls — Ley 21.719 (full force 2026-12-01)

Verified (2026-06-18): Ley 21.719 was published 13/12/2024 and enters full force **01/12/2026**; it creates a sanctioning Agencia de Protección de Datos with meaningful fines; and crucially it establishes that **"el carácter público no exime del cumplimiento"** — data from a public source must still be processed lawfully, proportionally and for a legitimate purpose. The new milestone ships into this regime; v1.0's mandated pre-launch legal review now has hard substance to check against.

### Pitfall D1: Treating "fuente de acceso público" as a blanket exemption

**What goes wrong:** Assuming that because votes/lobby/declarations/SERVEL/ChileCompra are public, anything can be published and cross-referenced freely. Verified: público ≠ exento. Republishing and especially *deriving new datasets by crossing* sources imposes obligations (legitimacy, proportionality, purpose).

**How to avoid:** Lock the purpose ("transparencia legislativa / control ciudadano") into the data-policy and surface it. Keep the minimization posture (already LOCKED: only show what the source already shows, with source/date/link; RUT and family data internal-only). Do not publish anything the source does not already publish. Run the mandated legal review specifically against republication + derived-data obligations, not just "it's public."

**Warning signs:** Any plan to expose RUT or family data publicly. A cross that creates a *new* public fact not present in any single source (e.g., a computed "wealth change") without legal sign-off.

**Phase to address:** Cross-cutting; gate before any public exposure (legal review, already mandated). Encode minimization as RLS/column rules (v1.0 already keeps `parlamentario.rut` out of `anon` reads — extend that to all new PII columns).

---

### Pitfall D2: Vote pattern + party = *dato sensible* (afiliación política / convicción ideológica)

**What goes wrong:** Verified: afiliación política and convicciones ideológicas/filosóficas are explicitly *datos sensibles* under Ley 21.719. A legislator's votes and party are public by function — but a *derived* analysis ("this legislator's ideological pattern", clustering legislators by inferred ideology, or attaching sensitive inferences to private individuals who appear as donors/lobbyists/family) can constitute sensitive-data processing with a higher bar — especially for the **non-legislator natural persons** (donors, lobby counterparts, relatives) who have no public-function justification.

**Why it happens:** Conflating the legislator's reduced privacy expectation (public office) with that of private third parties who appear in lobby/donation records.

**How to avoid:** (1) Sharp line between *office-holders* (public function → broader transparency) and *private third parties* (donors, lobbyists, relatives → minimization, no sensitive inference, RUT internal-only). (2) Do not compute or publish ideological/affinity inferences about anyone — this also satisfies the B-series anti-insinuation rules. (3) Keep family data internal-only (LOCKED). (4) Have legal review address the sensitive-data classification of party/vote derivations explicitly.

**Warning signs:** Any feature inferring ideology/affinity. Sensitive attributes attached to private third parties. Public exposure of relatives.

**Phase to address:** INT block (declarations, where third-party relatives appear) and NET block (where third parties become nodes). Legal review before NET ships.

---

### Pitfall D3: LLM provider as sub-encargado / training on PII

**What goes wrong:** Sending declaration/lobby/finance PII to an LLM endpoint that trains on inputs (e.g., the Gemini free tier — flagged in v1.0 as `trainsOnInputs=true`) leaks protected data into a third party and breaches the sub-encargado/DPA expectation.

**Why it happens:** Reusing the volume-extraction LLM path (DeepSeek/Gemini) for the new PII-bearing documents without re-checking the data-routing gate.

**How to avoid:** The v1.0 `data-routing` policy already exists in code: `assertNoRutInLlmInput` blocks RUT before any LLM call, and `assertSensitivityAllowed` aborts PII toward a training tier (`SensitiveRoutingError`). v2.0 must route ALL new PII extraction through this gate and classify each new document's sensitivity. Use only no-training / DPA tiers for sensitive PII. Never send RUT to any LLM.

**Warning signs:** A new connector calling an LLM without going through the routing gate. PII document extraction defaulting to the free Gemini tier. RUT appearing in an LLM prompt.

**Phase to address:** Any block that uses an LLM to extract from PII documents (declarations especially). Reuse and extend v1.0 data-routing; no new bypass paths.

---

### Pitfall D4: CC BY 4.0 attribution dropped on derived views

**What goes wrong:** InfoProbidad is CC BY 4.0 (visible attribution required). When declaration data is reshaped into a ficha or a graph node, the attribution can get lost, breaching the license.

**How to avoid:** Carry source attribution as first-class provenance (v1.0 already has a first-class `Provenance` type and an always-visible `ProvenanceBadge`). Render CC BY 4.0 attribution wherever InfoProbidad-derived data appears, including inside graph nodes/tooltips.

**Warning signs:** A declaration-derived figure with no visible source/attribution. Graph nodes without provenance.

**Phase to address:** INT block; NET block must propagate attribution into nodes.

---

## E. Data-Quality Pitfalls

### Pitfall E1: Donations/contracts matched by RUT to the wrong person (homonyms, DV errors)

**What goes wrong:** Same root cause as A2, but as a *data-quality* failure at scale: a single wrong RUT match pollutes a legislator's money total; common surnames amplify it. Output: a credible wrong number.

**How to avoid:** DV (módulo-11) validation gate; persona-natural vs jurídica tagging; RUT match counts as `determinista` only against the internal master's own RUT; everything else is a candidate to the review queue, never an auto-fact. Reconcile totals to any source-published aggregate.

**Warning signs:** Money totals dominated by common-surname collisions; totals not reconciling; review queue empty (means everything auto-linked — suspicious).

**Phase to address:** MONEY block.

---

### Pitfall E2: Stale declarations presented as current

**What goes wrong:** Patrimony/interest declarations are filed periodically and go stale; rendering an old declaration without a prominent date implies it's the current state. A 2021 declaration shown as today's patrimony is misleading.

**How to avoid:** Every declaration carries and prominently shows its filing date (reuse the `ProvenanceBadge` freshness pattern — amber when stale). Never aggregate declarations across periods into a single "patrimony" figure without showing the as-of date. Honest staleness over false currency.

**Warning signs:** Declarations without a visible filing date; a single patrimony number with no as-of; freshness badge missing on declaration data.

**Phase to address:** INT block; reuse v1.0 freshness/provenance UI.

---

### Pitfall E3: Company contracts collapsed into personal attribution

**What goes wrong:** A ChileCompra contract awarded to a *company* in which a legislator (or relative) has an interest gets rendered as "Diputado X recibió $Y del Estado," asserting a personal payment and an ownership chain that isn't sourced.

**How to avoid:** Keep contract subject = the supplier entity (persona jurídica), distinct from any legislator link. Only connect a contract to a legislator through an *explicit, sourced* declared interest (from the declaration), and render it as "empresa Z, en la que X declara interés, adjudicó contrato" — describing two sourced facts, never asserting personal income or motive. This is both a data-quality and a B-series insinuation guard.

**Warning signs:** Personal money totals that include company contracts; a contract→legislator edge with no declared-interest source backing it.

**Phase to address:** MONEY + NET blocks.

---

### Pitfall E4: Under-linking presented as "this legislator has nothing"

**What goes wrong:** Because the confirmed-link guard (correctly) drops unconfirmed matches to null+raw, a legislator's lobby/money tab can look empty when data exists but didn't confirm. Users read empty as "clean," which is a different false claim.

**How to avoid:** Distinguish three states in UI: confirmed-and-linked, present-but-unverified (raw mention + "identidad no verificada"), and not-yet-ingested. Never let "unverified" or "not ingested" render as a confident empty/zero. (Mirrors the v1.0 "estados vacíos honestos" posture and the Senado null+raw-mention pattern.)

**Warning signs:** Empty tabs with no "verified vs unverified vs pending" distinction; users interpreting gaps as exoneration.

**Phase to address:** Each ingest block + the parlamentario ficha UI.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Auto-link new datasets by name/RUT without the identity gate | Fast, full-looking fichas | False attributions = existential risk #1 realized | Never |
| Non-blocking drift on SERVEL/declarations | Runs never fail | Silent partial/empty data = false-by-omission | Never (use blocking drift for these) |
| Skip RUT DV validation | Less code | Wrong-person money attributions | Never |
| Compose money+vote into one UI unit | Compelling story | "Máquina de sospechas" / legal exposure | Never |
| Reuse free Gemini tier for PII extraction | Free | Ley 21.719 breach (training on PII) | Never |
| Single patrimony figure across periods, no as-of date | Cleaner UI | Stale presented as current | Never |
| Defer NET graph to last | — | None — this is correct | Always (already planned) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| opendata.camara.cl vote WS | Assuming individual vote absent / building fallbacks | `getVotaciones_Boletin` returns `Voto{Diputado,Opcion}` — validate in Fase-1 spike, prefer official `Diputado/Id` for deterministic link |
| SERVEL | Treating 200 OK as complete | Completeness/total reconciliation + blocking drift + R2 raw snapshot |
| ChileCompra (by RUT) | Parallel fan-out → WAF/quota | Serial 2–3s via pgmq + GH Actions backfill; "queried-zero" ≠ "not-queried" |
| leylobby / InfoProbidad HTML | Hardcode selectors/build artifacts | Fixture-pinned golden parsers; per-source drift policy; never hardcode portal build ids |
| Any LLM on PII docs | Reuse volume LLM path | Route through `data-routing` gate; no-training tier; never send RUT |

## "Looks Done But Isn't" Checklist

- [ ] **VOTE:** spike confirms per-deputy completeness AND `Diputado/Id` mapping (not just totals present)
- [ ] **Every new attribution:** has an `identidad_audit` row; FK null+raw when not `confirmado`
- [ ] **Money:** RUT DV-validated; persona-natural vs jurídica tagged; company contracts not collapsed into personal totals
- [ ] **Declarations:** filing date prominent; staleness badge present; CC BY 4.0 attribution visible
- [ ] **Crosses:** no single UI unit pairs money/lobby with a vote; no affinity/score/causal language
- [ ] **NET:** edges typed+sourced; no path = accusation; legal sign-off on framing
- [ ] **UI states:** confirmed vs unverified vs not-ingested distinguished — empty never reads as "clean"
- [ ] **PII routing:** no LLM call on PII bypasses the data-routing gate; no RUT in any prompt
- [ ] **Legal review:** covers republication, derived-data, sensitive-data (party/vote), third-party private persons — before public exposure

## Pitfall-to-Phase (block) Mapping

| Pitfall | Owning block | Verification |
|---------|-------------|--------------|
| A1 confirmed-link guard not generalized | First INT block (before any cross) | New writers refuse FK unless `confirmado`/`determinista`; audit row exists |
| A2/E1 wrong-RUT person | MONEY | DV validator + golden RUT cases; review-queue non-empty |
| A3 name conventions | Each ingest block | Golden ≥0.95 with new-source name fixtures |
| A4/E2 stale/term mismatch | MONEY + INT | Period column constrains matches; as-of date shown |
| B1 temporal-adjacency implication | First two-dataset UI block | UI criterion: no composed money-vote unit; no causal copy |
| B2 graph-as-corruption-map | NET (last) | Edges typed/sourced; legal sign-off on graph |
| B3 conflict-verdict framing | INT (declarations) | No "conflicto" verdict field exists |
| C1 opendata vote validation | VOTE Fase-1 spike | Confirm-or-replan gate |
| C2 SERVEL fragility | MONEY | Completeness gate + blocking drift |
| C3 ChileCompra quota | MONEY | Serial pgmq sweep; queried-zero distinguished |
| C4 HTML drift | Each HTML block | Per-source drift policy; fixture goldens |
| D1 público≠exento | Cross-cutting, pre-launch | Legal review on republication/derived data |
| D2 vote/party = sensible | INT + NET | No ideology/affinity inference; third-party minimization |
| D3 LLM sub-encargado | Any PII-LLM block | data-routing gate enforced; no-training tier |
| D4 CC BY 4.0 attribution | INT + NET | Attribution visible incl. graph nodes |
| E3 company→personal | MONEY + NET | Supplier entity distinct; interest-sourced edges only |
| E4 under-link reads as "clean" | Each block + ficha UI | Three-state UI verified |

## Sources

- `.planning/PROJECT.md`, `.planning/MILESTONES.md`, `CLAUDE.md` — v1.0 guardrails, identity guard, data-routing gate, provenance/freshness UI, "What NOT to Use" (project canon) — HIGH
- [WSCamaraDiputados — getVotaciones_Boletin (opendata.camara.cl)](https://opendata.camara.cl/wscamaradiputados.asmx?op=getVotaciones_Boletin) — confirms per-deputy `Voto{Diputado,Opcion}` + totals + `Pareos` available — MEDIUM-HIGH (page schema; needs live spike for completeness/id-mapping)
- [Ley 21.719 — RSM Chile](https://www.rsm.global/chile/es/news/ley-21719-proteccion-de-datos-personales) — entry into force, sanctioning agency — HIGH
- [Ley 21.719 — DOE Actualidad Jurídica](https://actualidadjuridica.doe.cl/ley-n-21-719-conoce-mas-sobre-la-nueva-ley-de-datos-personales/) — datos sensibles incl. afiliación política/ideología; "el carácter público no exime del cumplimiento"; fuentes de acceso público definition — HIGH
- [Ley 21.719 guía 2026 — Prey](https://preyproject.com/es/blog/ley-de-proteccion-de-datos-en-chile) — full force 2026-12-01, ARCO+, breach notice, fines — MEDIUM

---
*Pitfalls research for: v2.0 "Parlamentarios 360" (VOTE/INT/MONEY/NET)*
*Researched: 2026-06-18*
</content>
