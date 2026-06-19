# Feature Research — Parlamentarios 360 (v2.0)

**Domain:** Parliamentary-monitoring / legislator-transparency civic tech (Chile)
**Researched:** 2026-06-18
**Confidence:** MEDIUM-HIGH (comparator products HIGH; Chile-source feasibility lives in STACK/PITFALLS, not here)

> **Scope.** This file covers the **v2.0 "parlamentarios 360"** front. The v1.0 **"proyectos"** front
> feature research lives in `FEATURES.md` (do not overwrite). This document was written as a sibling to
> avoid clobbering valid v1.0 research that is still roadmap context.

---

## Framing

This milestone adds the **legislator-centric** front to a product whose v1.0 already shipped the
bill-centric front and — critically — the **identity master** (186 confirmed legislators with a
golden-gated reconciliation pipeline; three cross keys: boletín, normalized name, RUT-internal-only).
Every feature below is a **profile facet** hanging off that master, governed by the LOCKED rule:
*trazabilidad sobre interpretación, nunca causalidad ni intención.*

The four blocks map to product risk in increasing order:

| Block | What it surfaces | Identity dependency | Causality risk |
|-------|------------------|---------------------|----------------|
| **VOTE** | Individual votes, vote × topic, alignment | Already wired (Cámara by DIPID, Senado by name→pipeline) | Medium |
| **INT** | Lobby meetings, asset & interest declarations | Name/RUT match against declarant lists | Medium-High |
| **MONEY** | Campaign finance (SERVEL), state contracts (ChileCompra by RUT) | RUT-as-bridge (internal); contract subject ≠ legislator | **Highest** |
| **NET** | Influence graph linking all of the above | Consumes the other three; cannot precede them | **Highest** |

Comparators studied: **They Vote For You** / **Public Whip** (votes-by-policy), **Abgeordnetenwatch**
(MP profile + extra-earnings + lobby), **OpenSecrets** (donor/money profiles + "money maps"),
**Transparency International** asset/interest-disclosure guidance (conflict-of-interest framing).

---

## Feature Landscape

### Block VOTE — Cómo vota cada parlamentario

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Individual vote record on a legislator profile (`/parlamentario/[id]`) | The whole point of the front; They Vote For You / Public Whip are built on this | MEDIUM | Inverts v1.0's per-bill votación into a per-legislator view. Data already in `voto` table. **Gated on `opendata.camara.cl` spike** — `doGet.asmx` returns `Votos=null`; individual deputy vote is unvalidated. |
| Per-vote: a favor / en contra / abstención / pareo / ausente + date + boletín + source link | Citizens need "qué votó, cuándo, según qué fuente" verbatim | LOW | Reuse `VotoRow` + `ProvenanceBadge` from v1.0. Map all official vote-type enums faithfully (do not collapse abstención into "no votó"). |
| Identity guard on the profile itself | A profile is a stronger identity claim than a single vote row; a wrong match here is risk #1 | LOW (policy) but LOCKED | Profile page only for `estado='confirmado'`. Senado votes that resolved to `probable`/`revision` show as "identidad no verificada" — never silently attributed. |
| Attendance / participation count (votes cast vs. divisions held) | Standard metric on every comparator ("attendance" column on TVFY) | LOW | Pure aggregate; honest denominator (divisions where the legislator was a member). |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Vote × topic** (votes grouped by policy/theme) | TVFY's core UX: "how did they vote on climate / housing". Makes a vote record *legible* to non-experts | HIGH | Requires a topic taxonomy. Reuse v1.0 semantic infra: cluster/label boletines via embeddings → roll votes up to themes. Each theme card stays *descriptive* ("voted X of Y times on bills tagged Z"), never a conviction score. |
| **Cross-legislator alignment** ("votes most often with…") | Engaging; co-voting matrices draw users | HIGH | **Strong anti-feature pressure** (below). The Australia Institute warns co-voting ≠ shared views (procedural/government votes dominate). If built: descriptive co-occurrence only, with a standing caveat, never "ally/rival" language. |
| Filter votes by chamber / legislature / time window | Press workflow; lets a journalist scope a claim | LOW | Standard faceting over existing rows. |
| "Rebellions" (voted against own bench) | Public Whip / TVFY signature metric | MEDIUM | Requires bench-position-at-time-of-vote. Defensible *if* bench majority is computed from the same division, not inferred. |

#### Anti-Features (VOTE)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Ideology / left-right score derived from votes | Looks authoritative, "places" a legislator | Editorializing; invents a model the source doesn't publish → causality machine | Raw vote tallies per topic; reader infers |
| "Voting power" / decisiveness index | Sounds analytical | Pivotality models are contestable and read as judgment | Attendance + raw outcomes |
| Coloring votes "good/bad" or scoring vs. an agenda | AFL-CIO-style scorecards exist | Partisan; destroys neutral-arbiter posture | Neutral descriptive grouping only |

---

### Block INT — Lobby + Patrimonio e Intereses

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Lobby meetings list per legislator (who, when, on whose behalf, subject) | Ley del Lobby publishes this; Abgeordnetenwatch surfaces lobby contact as a headline facet | MEDIUM | Source = InfoLobby / Ley del Lobby registry. Match meetings to the legislator (sujeto pasivo) via name/cargo; the *lobbyist* counterpart is not yet in any master. |
| Asset declaration (patrimonio) summary, with source/date/link | TI: online registries of declarations are the baseline transparency artifact | MEDIUM | Source = InfoProbidad (CC BY 4.0 — **attribution must be visible**). Show declared categories faithfully; link to the original declaration. |
| Interest declaration (intereses): directorships, activities, holdings | TI: interest disclosure is the conflict-of-interest substrate | MEDIUM | Same source. Structured extraction (LLM + zod), literal-fidelity gate like v1.0 fichas. |
| Declaration as-of-date + version history | Declarations are periodic; "qué declaró y cuándo" requires the date | LOW-MEDIUM | Store each declaration version with provenance; show timeline, not just latest. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Lobby meeting **counterpart resolution** (recurring lobbyists / firms) | "Who lobbies this legislator most" — the Abgeordnetenwatch lobby angle | HIGH | Requires a lobbyist/firm identity sub-master (analogous to legislators). Feeds NET. Start minimal: store raw counterpart strings, normalize later. |
| Patrimonio **timeline / side-by-side between declarations** | TI: wealth-evolution tracking is a stated purpose of periodic declarations | HIGH | **Anti-feature boundary** — show declared numbers and dates side-by-side; do NOT compute "unexplained enrichment" or flag deltas as suspicious. |
| Cross-link declaration → bills on the same matter | Conflict-of-interest *context* (descriptive) | HIGH | Highest-value, highest-risk. Factual adjacency only ("declared interest in sector X; voted on bills tagged X") with explicit "no implica conflicto" framing. Strong candidate to **defer**. |

#### Anti-Features (INT)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| "Conflict of interest" flags / badges | Seems like the obvious payoff | Asserts a legal/ethical conclusion the source never makes → causality machine, defamation exposure | Show declaration + related activity adjacently; reader concludes |
| Exposing family-member asset/data | Declarations sometimes include relatives | LOCKED out: minimization; family data internal-only, RUT-only for reconciliation | Show only the legislator's own publicly-published declared items |
| "Enrichment alert" on patrimonio delta | Mimics anti-corruption tooling | Statistical accusation without adjudication; risk #2 | Side-by-side declared figures, no computed verdict |
| Free-text "lobby influence score" | Engagement | Invented metric | Raw meeting count + counterpart list |

---

### Block MONEY — Financiamiento + Contratos del Estado

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Campaign finance per legislator: donors, amounts, dates, source link | OpenSecrets' core: "where the campaign warchest came from" | HIGH | Source = SERVEL. **Connector is artisanal/fragile, not a REST API** (PROJECT.md) — highest ingestion risk of the milestone. Show declared contributions verbatim. |
| State contracts *surrounding* the legislator, by RUT | Stated milestone goal; OpenSecrets links money→contracts conceptually | HIGH | Source = ChileCompra, keyed on RUT (**internal**). Legislator is rarely the direct contractor — usually a related person/firm. **Wording is everything**: "contratos asociados al RUT", never "contratos del parlamentario". |
| Strict provenance + as-of-date on every money row | Money claims are the most defamatory if wrong | LOW (policy) | Non-negotiable: source/date/link on each figure. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Donor aggregation ("top donors", by sector/firm) | OpenSecrets "money maps" — the legible payoff | HIGH | Requires donor-identity normalization (a sub-master). Descriptive aggregation only. |
| Contract aggregation by counterparty / agency | "Which agencies, which suppliers" | HIGH | Same normalization need; feeds NET. |
| Money **timeline** aligned to electoral cycle | Context for "when" | MEDIUM | Honest dating; no inference of motive relative to votes. |

#### Anti-Features (MONEY)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Donation → vote correlation ("voted for donors") | The single most-requested, most-clickable cross | The textbook causality machine; risk #1 (wrong RUT match) + risk #2 (implied bribery). Defamation + Ley 21.719 exposure | Money and votes on the same profile, separately, with no joined claim |
| Labeling contracts as "del parlamentario" | Shorthand | RUT proximity ≠ ownership/benefit; false attribution is libel | "Contratos asociados al RUT [internal] — relación: [declarada]" |
| "Influence-for-sale" / ROI metrics | Engagement | Invents intent | Raw aggregates with caveats |
| Exposing RUT publicly to "prove" the match | Seems like traceability | LOCKED: RUT is internal-only | Show source link; keep RUT server-side |

---

### Block NET — Grafo de influencia

#### Table Stakes (only once the others are populated)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Relationship graph: legislator ↔ lobbyist ↔ donor ↔ contractor | The synthesis the product promises ("observatorio de redes") | HIGH | **Pure consumer** of VOTE/INT/MONEY data + the sub-masters they create. Cannot exist before they are populated. |
| Every edge carries provenance (source/date/link of the underlying datum) | A graph is the easiest place to launder unsourced claims | HIGH | Edge = a *published fact* (a meeting, a donation, a contract), never an inferred tie. No edge without a row behind it. |
| Node = confirmed identity only | Risk #1 amplified: a graph multiplies one bad match across many edges | MEDIUM | Reuse golden-gated identity for legislators; lobbyist/donor/contractor sub-masters need their own confidence gates. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Shared-counterparty discovery ("two legislators, same donor/lobbyist") | The genuinely novel cross only this product can do | HIGH | Descriptive co-occurrence of *published facts*. Frame as "comparten contraparte", never "aliados". |
| Interactive exploration (filter by edge type, time) | Press research tool | HIGH | Frontend graph lib (react-flow / sigma.js — deferred decision per stack). |

#### Anti-Features (NET)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Inferred / weighted "influence score" per node | The seductive endpoint of any graph | Manufactures a verdict from correlation; maximal causality-machine risk | Edges are facts; let the reader trace paths |
| Auto-detected "suspicious clusters" / anomaly flags | Looks like investigative AI | Algorithmic accusation; indefensible legally | No automated flags; neutral exploration only |
| Edges from semantic/LLM inference ("likely connected") | Fills gaps | Fabricated relationships; violates "no edge without a sourced row" | Only edges with a published-fact provenance |

---

## Feature Dependencies

```
v1.0 Identity Master (186 confirmed, golden-gated)   [EXISTS]
      │
      ├──enables──> VOTE (per-legislator view)         [Cámara wired; Senado partial]
      │                 └─ vote × topic ──reuses──> v1.0 semantic/embedding infra
      │
      ├──enables──> INT  (lobby + patrimonio/intereses)
      │                 └─ lobby counterpart ──creates──> Lobbyist/Firm sub-master
      │
      ├──enables──> MONEY (SERVEL + ChileCompra by RUT)
      │                 ├─ donors ──creates──> Donor sub-master
      │                 └─ contracts ──creates──> Contractor sub-master (RUT bridge, internal)
      │
      └──────────────────────────────┐
                                      ▼
   VOTE + INT + MONEY ──all populate──> NET (influence graph)   [LAST]
                                      └─ consumes the 3 sub-masters above

opendata.camara.cl spike ──gates──> VOTE (individual deputy vote)   [BLOCKER, Phase 1]
```

### Dependency Notes

- **All four blocks require the v1.0 identity master.** Each is a profile facet keyed on a confirmed
  legislator. No block attributes a datum without passing the same identity guard shipped in v1.0
  (confirmed → link; otherwise "identidad no verificada" + raw mention).
- **VOTE is gated by the `opendata.camara.cl` spike.** `doGet.asmx` returns `Votos=null`; individual
  deputy votes were never validated live. If the spike fails, the VOTE block is replanned. This is the
  declared Phase-1 validation and the milestone's first build step.
- **VOTE × topic reuses v1.0 semantic infrastructure** (embeddings, boletín clustering) — cheap to add
  *after* the raw per-legislator vote view exists; not a from-scratch build.
- **INT and MONEY each spawn a new sub-master** (lobbyists/firms; donors; contractors). These are the
  *real* cost of those blocks and the prerequisite NET silently depends on. Treat sub-master creation
  as part of each block, not deferred to NET.
- **NET strictly depends on VOTE + INT + MONEY being populated** and on their sub-masters existing.
  Building NET earlier yields an empty or fabricated graph. NET adds almost no new ingestion — it is a
  read/visualization layer over already-sourced edges. Schedule it last, as PROJECT.md states.
- **MONEY's ChileCompra cross depends on RUT** (strongest, internal-only key, already in the master).
  The risk is not the join but the *subject mismatch* (contract party ≠ legislator) — a wording and
  data-model problem.

---

## MVP Definition (per block — actual selection happens in requirements)

### Launch With (the defensible core of each block)

- [ ] **VOTE** — per-legislator vote list (after spike passes) with full provenance + identity guard + attendance.
- [ ] **INT** — lobby meetings list + asset/interest declaration (latest, with date + InfoProbidad attribution).
- [ ] **MONEY** — campaign finance list (SERVEL) with verbatim donors/amounts/dates. *Contracts may lag if SERVEL proves fragile.*

### Add After Validation

- [ ] **VOTE × topic** — once raw votes render and the topic taxonomy is trusted.
- [ ] **INT** counterpart resolution + patrimonio side-by-side (no delta verdict).
- [ ] **MONEY** ChileCompra contracts-by-RUT — once subject-attribution wording is legally reviewed.
- [ ] Sub-masters (lobbyist, donor, contractor) hardened with confidence gates.

### Future Consideration

- [ ] **NET** — entire block; only when VOTE/INT/MONEY + sub-masters are populated.
- [ ] Cross-block adjacency context (declaration↔bill, money↔vote *shown separately*) — only post legal review.
- [ ] Co-voting alignment view — only if the descriptive-caveat framing survives legal review.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| opendata.camara.cl spike (VOTE unblock) | HIGH (gates VOTE) | LOW | **P1** |
| Per-legislator vote list + profile + identity guard | HIGH | MEDIUM | **P1** |
| Attendance metric | MEDIUM | LOW | P1 |
| Lobby meetings list (INT) | HIGH | MEDIUM | P1 |
| Asset/interest declaration (INT) | HIGH | MEDIUM | P1 |
| Campaign finance list (MONEY/SERVEL) | HIGH | HIGH (fragile connector) | P1/P2 |
| Vote × topic | HIGH | HIGH | P2 |
| ChileCompra contracts-by-RUT | HIGH | HIGH | P2 |
| Lobby/donor/contractor sub-masters | MEDIUM (enabling) | HIGH | P2 |
| Patrimonio side-by-side timeline | MEDIUM | HIGH | P3 |
| Co-voting alignment | MEDIUM | HIGH | P3 |
| NET influence graph | HIGH | HIGH | P3 (last) |
| Any score / flag / correlation (any block) | — | — | **NEVER** (anti-feature) |

---

## Competitor Feature Analysis

| Feature | They Vote For You / Public Whip | Abgeordnetenwatch | OpenSecrets | Our Approach |
|---------|--------------------------------|-------------------|-------------|--------------|
| Per-legislator votes | Core; grouped by policy | Voting record on profile | n/a | VOTE block; vote × topic via v1.0 embeddings |
| Vote framing | Descriptive + cautions on co-voting | Descriptive | n/a | Descriptive only; explicit no-causality caveats |
| Lobby | n/a | Headline facet + blog | Lobbying spend | INT lobby list, counterpart sub-master |
| Asset/interest | n/a | Extra-earnings shown | n/a | INT declarations, literal extraction, InfoProbidad CC BY |
| Money | n/a | Extra earnings | Donors, "money maps", contracts | MONEY block, SERVEL + ChileCompra-by-RUT, no money→vote join |
| Network/graph | n/a | n/a | Org profiles cross-link | NET, last; edges = published facts only |
| Stated caution | "co-voting ≠ shared views" | Neutral Q&A | Neutral data | "trazabilidad sobre interpretación, nunca causalidad" (LOCKED) |

The recurring lesson across all comparators: the credible ones **surface published facts and refuse to
editorialize**. The Australia Institute's own warning about misuse of They Vote For You's data, and
Transparency International's careful conflict-of-interest framing, are the exact failure modes the
LOCKED no-causality rule pre-empts. Our differentiator is not a flashier score — it is being the
neutral arbiter whose every datum is traceable.

## Sources

- [They Vote For You — How does your MP vote?](https://theyvoteforyou.org.au/) — votes-by-policy, profiles, attendance/rebellions — HIGH
- [They Vote For You — FAQ](https://theyvoteforyou.org.au/help/faq) — divisions from Hansard, policy grouping — HIGH
- [Who votes with whom? Beware claims… — The Australia Institute](https://australiainstitute.org.au/post/who-votes-with-whom-beware-claims-that-use-voting-records-to-argue-politicians-have-similar-views/) — co-voting ≠ shared views (anti-feature basis) — HIGH
- [Public Whip — Wikipedia](https://en.wikipedia.org/wiki/Public_Whip) — rebellions/attendance metrics — MEDIUM
- [Abgeordnetenwatch — Wikipedia / Parliamentwatch](https://en.wikipedia.org/wiki/Abgeordnetenwatch) — MP profile, voting record, extra earnings, lobby focus — HIGH
- [OpenSecrets — Organization Profiles](https://www.opensecrets.org/orgs/all-profiles) / [Donor Lookup](https://www.opensecrets.org/donor-lookup) — donor/contribution display, money maps — HIGH
- [Transparency International — Topic Guide: Interest and Asset Disclosure](https://knowledgehub.transparency.org/guide/topic-guide-on-interest-and-asset-disclosure/5874) — asset/interest registry baseline, conflict-of-interest framing — HIGH
- [Open Government Partnership — Asset and Interest Disclosure](https://www.opengovpartnership.org/open-gov-guide/anti-corruption-asset-and-interest-disclosure/) — minimization vs. family data, public-access norms — MEDIUM
- `.planning/PROJECT.md` — LOCKED rule, Ley 21.719, existential risks #1 (identity) and #2 (suspicion machine), three cross keys, source endpoints — HIGH (authoritative)

---
*Feature research for: Parlamentarios 360 (legislator-transparency civic tech, Chile)*
*Researched: 2026-06-18*
