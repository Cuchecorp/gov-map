# Pitfalls Research — v9.0 "Robustez de productos estrella + seguridad final"

**Domain:** Civic-transparency web app (Chile Congress) — adding hybrid search, client-side filters, official deep-links, official bios, lobby→bill linking, committee calendars, and final security validation to an existing production system (Observatorio del Congreso 360).
**Researched:** 2026-07-21
**Confidence:** HIGH (FTS/RRF/deep-link mechanics verified against Supabase docs + Postgres docs; project-specific rules from PROJECT.md/CLAUDE.md/MEMORY.md)

**Scope note:** These are pitfalls specific to ADDING v9.0's six features + final hardening to THIS system, not generic advice. Each maps to a Pass (P1 búsqueda/PL · P2 personas/agenda · P3 seguridad) and phase (numbering continues from 86). The system already has LOCKED rules — most pitfalls below are about *violating a LOCKED rule while chasing a new feature*.

---

## Critical Pitfalls

### Pitfall 1: Swapping in hybrid search without golden queries → silent regression of what already works

**What goes wrong:**
Today's search "falla con palabras LITERALES del título" (PROJECT.md) — that's the whole reason for the feature. But the current semantic search *does* work for paraphrase/NL queries and "proyectos similares" (kNN). Bolting on FTS and swapping the RPC without a frozen baseline means you fix the literal-title case and silently break the NL case (or the boletín-number case, or "similares"), and nobody notices until a journalist does.

**Why it happens:**
Hybrid search is tuned by feel ("this query looks better now"). Without a fixed golden set scored BEFORE the swap, "better" is anecdote. RRF weights, `rrf_k`, FTS config, and candidate `limit` all interact; each tweak that helps one query class can hurt another.

**How to avoid:**
Freeze a golden query set (≥30 queries spanning: literal title words, idea-matriz paraphrase, norma afectada, boletín number in all formats, plain NL, and "proyectos similares" seeds) with expected top-K hits BEFORE writing any hybrid code. The SPIKE (PROJECT.md P1a: retrieval design "elegido por SPIKE empírico con golden queries") scores candidates against this set. No swap ships unless it dominates the baseline on literal-title AND does not regress the other classes. Keep the old RPC live behind a flag until the golden gate passes.

**Warning signs:**
"It feels better." No numeric before/after per query class. A single blended score tuned by hand.

**Phase to address:** Pass 1, first phase (SPIKE + golden gate) — BEFORE the hybrid RPC is written.

---

### Pitfall 2: Spanish FTS config mismatch between index and query (accents, ñ, unaccent immutability)

**What goes wrong:**
Three compounding failures unique to Spanish civic text:
1. The `'spanish'` stemmer stems unpredictably — searching "política" succeeds on `poli`/`polit`/`politica` but *fails* on `politi`/`politic` (verified Postgres bug threads). Users typing partial words get empty results on the flagship product.
2. `unaccent()` is **STABLE, not IMMUTABLE**, so it cannot appear in an index expression. If the generated `tsvector` applies `unaccent` but query-time `websearch_to_tsquery` does not (or vice-versa), the index is bypassed or returns nothing — "medioambiente" vs "medio ambiente", "Ñuñoa", "Aysén" break asymmetrically.
3. If the index uses `to_tsvector('spanish', ...)` but a query uses `to_tsvector(col)` (no config), Postgres **won't use the index** — silently slow or empty (verified Postgres docs).

**Why it happens:**
Copy-paste of the Supabase hybrid-search example, which uses `'english'` and no unaccent. Spanish + Chilean proper nouns (Ñuñoa, Aysén, Bío-Bío) are exactly where accent/ñ handling matters, and it's invisible until someone searches a specific place/name.

**How to avoid:**
- Build a custom text-search config chaining `unaccent` + `spanish_stem` into one dictionary, and store a **generated `tsvector` column** (`GENERATED ALWAYS AS (to_tsvector('config_es_unaccent', coalesce(titulo,'')||' '||coalesce(idea_matriz,''))) STORED`). This bakes unaccent into the stored expression (immutable at write time) — the STABLE trap disappears.
- Query with the **exact same config**: `col_fts @@ websearch_to_tsquery('config_es_unaccent', $1)`.
- Use `websearch_to_tsquery` (never raw `to_tsquery`) so input like `presupuesto OR "medio ambiente"` doesn't throw (see Pitfall 3).
- Put accent/ñ/place-name cases (Ñuñoa, Aysén, "medio ambiente") IN the golden set from Pitfall 1.

**Warning signs:**
Search works for one accented term, empty for another. `EXPLAIN` shows a seq scan on the FTS column. Query works in psql with explicit config but not from the app.

**Phase to address:** Pass 1, hybrid-search build phase.

---

### Pitfall 3: Raw user input into `to_tsquery` → syntax errors; and naive score-mixing instead of RRF

**What goes wrong:**
- `to_tsquery` requires operator syntax; feeding it a user string with a stray `&`, `:`, `!`, unbalanced quote, or bare hyphen (very common in Spanish: "sub-secretaría", boletín "16733-07") throws `syntax error in tsquery` — a 500 on the search box.
- Separately: mixing pgvector cosine distance (`<=>`, ~0–2) and `ts_rank_cd` (unbounded, corpus-dependent) by adding/averaging requires arbitrary scaling that shifts as the 3.657-project corpus grows. One runaway `ts_rank` compresses everything else.

**Why it happens:**
`to_tsquery` looks like the obvious function. "Just add the two scores" looks reasonable until you realize they're on incompatible, moving scales.

**How to avoid:**
- Always `websearch_to_tsquery('config_es_unaccent', $userInput)` — sanitizes operators/quotes.
- Combine rankings with **Reciprocal Rank Fusion (RRF)**, not weighted score sum. RRF fuses on rank position (`1/(k+rank)`), needs no normalization, and is robust to moving BM25/cosine scales. Use the Supabase `hybrid_search` RRF pattern (`rrf_k` ~50–60, `full_text_weight`/`semantic_weight` as knobs scored on the golden set). Boletín exact match should be a *pre-filter/short-circuit*, not left to RRF (Pitfall 4).

**Warning signs:**
Intermittent 500s on odd search strings. A single float being sorted. Ranking quality drifting after a corpus re-ingest.

**Phase to address:** Pass 1, hybrid-search build phase.

---

### Pitfall 4: Boletín format chaos ("16733-07" vs "16733" vs dígito)

**What goes wrong:**
A boletín is the primary cross-key of the whole system. Users type it many ways: `16733-07`, `16733`, `16.733-07`. If search routes the boletín through FTS/embeddings, an exact boletín query ranks *below* fuzzy title matches — the one query type that should be a guaranteed bullseye becomes lossy. The `-07` suffix is a chamber/materia code, not a check digit; stripping/keeping it inconsistently between ingest and query splits one project into "two."

**Why it happens:**
Treating the boletín as just another token in the hybrid pipeline; not normalizing format at both write and read time.

**How to avoid:**
Detect boletín patterns with a strict regex at query time; if the input *is* a boletín, **short-circuit to an exact/normalized lookup** and return that project first, bypassing RRF. Store a canonical normalized boletín (decide once: keep full `NNNNN-NN`, strip dots) and normalize identically on ingest and query. Include all format variants in the golden set. This is a fail-obvious case — the flagship must never miss a correctly-typed boletín.

**Warning signs:**
"16733-07" returns the right project but "16733" doesn't (or ranks 4th). Two ficha rows for one project. Golden set has no boletín-format cases.

**Phase to address:** Pass 1, hybrid-search build phase.

---

### Pitfall 5: Client-side filters presenting facet counts / results from a TRUNCATED server set as if global

**What goes wrong:**
PROJECT.md P1b is explicit: filters "reordenan/filtran resultados YA obtenidos sin re-buscar." The trap: the server returns top-K (say 30 via RRF `limit`). The UI shows "Partido: UDI (4), RN (2)…" as if global — but those are counts within the 30 shown. Users read "only 4 UDI projects match" when there are 40. Worse: a filter silently triggers a re-query (breaking the "no re-buscar" contract) and counts change under the user.

**Why it happens:**
Faceting is normally a server aggregate. Reusing the truncated result array for facet counts is the path of least resistance and looks correct in a demo where K > total matches.

**How to avoid:**
- Be honest about scope: facet counts describe **the loaded result set**, labeled as such ("de estos N resultados"), never implied-global. Matches the system's existing honesty pattern (freshness N/M, "Busca sobre 3.100 proyectos").
- Filters operate purely on the already-fetched array — pure client transform, zero network. If a filter needs data outside the fetched set, that's a search change, not a filter, and must be surfaced.
- NULL facet values (an author with no `partido`) must render as an explicit "Sin partido / no informado" bucket, NEVER folded into a zero or an arbitrary party. Some authors legitimately lack `partido` (independientes, missing data) — showing "0 for RN" when it's "unknown" is a factual misstatement in a transparency product.

**Warning signs:**
Facet count sum ≠ visible results. A filter click shows a network request. A "0" for a party that has projects. Independents vanishing from buckets.

**Phase to address:** Pass 1, ranking+filters phase.

---

### Pitfall 6: Deep-links to government sites that rot (buildId/session URLs) or point to search results, not canonical pages

**What goes wrong:**
PROJECT.md P1c wants a deep-link "a la parte precisa de la página oficial" per boletín. Three rot modes specific to these sources:
1. Senado's portal is Next.js with a `buildId` that **changes every deploy** (CLAUDE.md, MEMORY.md) — any URL containing `/_next/data/<buildId>/…` breaks silently on the next senado.cl deploy.
2. Linking to a *search-results* URL ("buscar boletín X") instead of the canonical tramitación page — search UIs change params and rot.
3. Session/`__VIEWSTATE`-based Cámara URLs are not stable, shareable, or bookmarkable.

**Why it happens:**
The URL that works in the browser *right now* gets hardcoded. buildId-bearing data routes look canonical but aren't.

**How to avoid:**
- Link only to **canonical, parameter-stable public pages**: Senado tramitación by `?boletin=`, Cámara project detail by its stable id, BCN/LeyChile by `idNorma`. Never a data route with a buildId; never a session URL.
- **Verify empirically, don't assume:** for a sample of boletines, fetch the target link server-side and assert HTTP 200 AND that the page content actually mentions that boletín (content match, not just status). This is the BrowserOS/empirical gate the milestone already mandates ("validación empírica"). A 200 rendering "proyecto no encontrado" is a dead link that passed a naive check.
- Store the link-construction rule (a template per source), not the resolved URL, and re-derive at render time.

**Warning signs:**
Links contain a hash/buildId segment. Link verification checks status only, not content. Links tested once at build, never re-probed.

**Phase to address:** Pass 1, deep-link phase (+ periodic link-health probe thereafter).

---

### Pitfall 7: Scraping official bios that carry PII beyond what we may republish (Ley 21.719 minimización)

**What goes wrong:**
Official Congress bio pages include birth date, family, education, address-adjacent data. Scraping wholesale and republishing pulls in PII the product has no basis to publish. Ley 21.719 (plena vigencia 2026-12-01) applies even to "fuente de acceso público" (PROJECT.md) — "the source published it" is NOT a defense. This directly contradicts the LOCKED minimización rule and "RUT/PII never public."

**Why it happens:**
Scrapers grab the whole page; whitelisting fields is extra work; "it's already public" feels like cover.

**How to avoid:**
- **Field allowlist, not blocklist:** ingest ONLY the bio fields the product will show (name, current party/comité, cámara, región/circunscripción, official bio prose vetted for PII, links). Everything else is dropped at the parser, never stored. Birth date / family / personal contact = excluded by default; keep raw bio in R2 crudo (immutable source of truth) but do not surface or load PII columns into Supabase-served tables.
- Keep the two-stage rule: raw bio → R2, then a *minimizing* R2→Supabase load projecting only allowlisted fields.
- Flag as a legal-review item (human sign-off), consistent with the milestone's legal gates.

**Warning signs:**
Bio ingest schema has `fecha_nacimiento`/`conyuge`/`hijos`. "We'll filter in the UI" (data already stored = already a risk). No allowlist in the parser.

**Phase to address:** Pass 2, bio phase — allowlist at parser + legal sign-off.

---

### Pitfall 8: Asserting CURRENT party from STALE/historical militancia; conflating comité with partido (Senado)

**What goes wrong:**
Party affiliation changes over time (renuncias, cambios de bancada). Scraping a bio once and asserting "Partido: X" as present-tense, when the person switched months ago, is a false statement about a hostile-capable subject — defamation-adjacent and a correctness failure. In the Senado, senators sit in **comités** (parliamentary groups) that are NOT the same as **partido**; showing comité as partido (or vice-versa) is wrong. Cross-links grouping parlamentarios by shared party can imply political alignment — anti-insinuación risk (existential risk #2).

**Why it happens:**
Bio pages show current affiliation without a timestamp; the scraper snapshots it and the UI renders it tenseless. comité and partido look interchangeable at a glance.

**How to avoid:**
- Always attach **fecha de captura + fuente + enlace** to party data (rector principle) and phrase as "según [fuente] al [fecha]", never bare present tense.
- Model party as time-stamped, ideally a history if the source supports it; if only a snapshot exists, say so.
- Keep **partido and comité as distinct fields** with distinct labels; never map one to the other. For the Senado, show comité as comité.
- Any "relaciones entre parlamentarios" cross-link (PROJECT.md P2d) must be factual co-occurrence with the anti-causal/anti-insinuación legend already used across the product — never framed as "aligned/allied."

**Warning signs:**
Party rendered without a date. Same field for partido and comité. A cross-link labeled "misma línea"/"aliados." A senator's comité shown as "Partido."

**Phase to address:** Pass 2, bio/ficha phase.

---

### Pitfall 9: Lobby→bill linking by regex over free-text materia → false links + insinuación

**What goes wrong:**
PROJECT.md P2e wants lobby audiencias linked "con PLs en movimiento con links específicos." The trap: regex-matching the free-text `materia` of an audiencia to a boletín. A materia that *mentions* a law ("modernización del Código de Aguas") is not the specific bill; matching by keyword produces false links. Worse, asserting a **meeting was ABOUT a bill** when the link is wrong is exactly the insinuación the product is legally built to avoid ("la reunión fue sobre el proyecto X" → implied influence). This fuses existential risk #1 (false-but-credible claim) with risk #2 (insinuación).

**Why it happens:**
Free-text materia often contains law-ish words; regex "works" on the demo cases; the linkage feels valuable so the evidence bar drops.

**How to avoid:**
- **Fail-closed linking, explicit-pattern only:** link an audiencia to a boletín ONLY when the materia (or a structured field) contains an explicit boletín number pattern. No boletín number → no link. Mirrors the identity fail-closed rule (never name-match to an FK).
- Never render the relationship as causal/topical ("sobre el proyecto"); render it as "esta audiencia menciona el boletín NNNNN-NN" with the source text, letting the reader judge.
- Run the anti-insinuación text linter (already in the codebase) over any generated link copy.

**Warning signs:**
Lobby links generated from keyword/fuzzy materia matching. Copy says "reunión sobre el proyecto." Link count suspiciously high. No explicit boletín pattern gate.

**Phase to address:** Pass 2, lobby-legible phase.

---

### Pitfall 10: Committee-calendar completeness gaps shown as certainty; cancelled/rescheduled shown as upcoming; timezone drift

**What goes wrong:**
PROJECT.md P2f mandates a **coverage audit of scraping BEFORE touching UI** (sala + comisiones, both chambers). Pitfalls:
- Sources publish comisión citaciones incompletely or late; showing the scraped set as "the complete agenda" misleads journalists who trust it. comisiones unidas / especiales are edge cases the scraper often misses.
- A session cancelled or rescheduled at the source, still shown as "próxima," sends a journalist to a meeting that isn't happening.
- Grouping "por día" (P2f) in UTC instead of **America/Santiago** buckets a 21:00 Santiago session into the next day (Chile is UTC−3/−4 with DST) — the daily agenda is silently wrong at the edges.

**Why it happens:**
Coverage is assumed, not measured. Postgres/JS default to UTC. Cancelled-state isn't modeled; only "scheduled" rows exist.

**How to avoid:**
- Do the coverage audit first and **declare coverage honestly** (the system's N/M pattern): which chambers/commissions/date-range are covered, and what's known-missing. comisiones unidas/especiales explicitly checked.
- Model session status (programada/modificada/cancelada); never render a cancelled/rescheduled session as a plain upcoming item — show the change with source+date.
- Group and display all dates in `America/Santiago` (store timestamptz, convert at the day-bucketing boundary). Verify with a session near midnight Santiago.
- **Probe any new endpoint with curl first** — the WAF blocks Node/bot UAs on camara.cl (MEMORY.md: "WAF camara.cl bloquea Node fetch → curl OK"). Don't assume a new comisiones endpoint is reachable like the existing ones.

**Warning signs:**
Agenda presented as complete with no coverage statement. A day boundary that shifts sessions. No cancelled state in the schema. New endpoint tested only from Node.

**Phase to address:** Pass 2, citaciones phase (coverage audit gates the UI work).

---

### Pitfall 11: Identity fail-closed silently loosened while wiring bios/lobby/committees (existential risk #1)

**What goes wrong:**
Every new P2 feature wants to attach data to a parlamentario. The pressure to "link more" tempts name-matching (bio → maestra, lobby contraparte → parlamentario, comité member → maestra) instead of the confirmed identity pipeline. A single wrong match = a false, credible claim attributed to a real, possibly-hostile person. This is documented existential risk #1.

**Why it happens:**
The identity pipeline is stricter (fail-closed) and yields fewer links; a feature "looks more complete" with loose matching. Temptation is highest when the new source uses a full name that "obviously" matches.

**How to avoid:**
- Re-verify fail-closed at every new join: bio, lobby, and committee data attach to the maestra ONLY via confirmed identity (golden set ≥0.95 gate), never a fresh name-match to an FK. If unconfirmed, show the datum unlinked (the system already does "link solo si confirmado" in UI).
- Treat every new person-linking edge as subject to the existing identity audit trail.

**Warning signs:**
A new `.rpc`/join that resolves a person by name string. Link coverage jumping without new confirmed identities. Bio/lobby rows FK'd to parlamentario without an adjudication record.

**Phase to address:** Pass 2, all person-linking phases (verification gate).

---

### Pitfall 12: Final security pass treats the PUBLIC repo + hostile subjects as ordinary web security

**What goes wrong:**
PROJECT.md P3 is "validación final de seguridad." The threat model is unusual: the repo is **public on GitHub** and the *subjects* (parlamentarios) may be motivated to find leaks or defame-back. Ordinary "we have RLS, we're fine" misses: secrets committed in git *history* (not just current tree), `.env.example` shipping real-looking values, error messages leaking schema/table names, RPC allowlist drift (a new RPC added in P1/P2 not in the allowlist — under the service_role model anon is dead but service_role bypasses RLS), CSP stuck in Report-Only forever (MEMORY.md: "CSP solo Report-Only"), dependency alerts (Dependabot), and expensive unbounded RPCs (the new hybrid_search / faceting) as a cheap DoS.

**Why it happens:**
Security is treated as a generic OWASP checklist. The public-repo + service_role-bypass + hostile-subject combination is specific to this project and easy to under-scope. New RPCs from P1/P2 silently expand attack surface after the earlier lockdown (Camino A).

**How to avoid:**
- **Git history scan** (gitleaks/trufflehog over full history), not just current files. Rotate anything ever committed (the DB password was already flagged as exposed — confirm rotation, B26).
- Assert `.env.example` contains only placeholders; add a CI check.
- Ensure error responses never echo Postgres error text/schema to the client (generic message + server-side log).
- **Re-derive the RPC allowlist** including every RPC added in P1/P2; the guard CI (already scans `app/` for `.from` PII + non-allowlisted `.rpc`) must cover the new hybrid_search / bio / lobby / agenda RPCs. Under service_role (RLS bypassed by design), each new RPC is the security boundary — verify each is PII-safe.
- **Bound the new expensive RPCs:** hybrid_search and faceting must have a hard `LIMIT` + `statement_timeout` and cap `match_count` so a crafted query can't pin the Pro-plan DB. Supabase RPCs can time out; an unbounded RRF over 3.657 rows + HNSW is cheap, but a pathological `websearch_to_tsquery` or huge `match_count` is not.
- **Flip CSP from Report-Only to enforced** (with a tested policy) — Report-Only forever = no protection.
- Correctness-as-defamation-defense: re-run the identity golden gate and confirm every publicly-shown person-linked datum traces to a confirmed identity + source + date. Data correctness IS the legal defense here.

**Warning signs:**
Secret scan runs on HEAD only. `.env.example` has real hostnames/keys. 500s show `relation "x" does not exist`. A new RPC not in the allowlist. CSP still Report-Only at ship. hybrid_search has no LIMIT/timeout.

**Phase to address:** Pass 3, security phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Facet counts from truncated top-K set | No server aggregate to build | Misleading counts in a transparency product; credibility hit | Never — label "de estos N resultados" if truly client-only |
| Weighted score sum instead of RRF | One less concept | Re-tuning as corpus grows; scale-mismatch bugs | Only after golden set shows it beats RRF for this corpus |
| Hardcode a government URL that "works now" | Ships the deep-link fast | Rots on next senado.cl deploy (buildId) | Never — store the template, re-derive |
| Scrape whole bio, filter in UI | Faster ingest | PII stored = Ley 21.719 exposure even before display | Never — allowlist at parser |
| Keyword-match lobby materia → boletín | More links, "richer" ficha | False links = false influence claims (insinuación) | Never — explicit boletín pattern only |
| Group agenda by day in UTC | No tz code | Edge sessions on wrong day | Never — America/Santiago at bucketing |
| Ship hybrid search without golden gate | Feels done | Silent regression of NL/similares | Never — golden gate is the SPIKE's whole point |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Postgres Spanish FTS | Reuse `'english'` example; unaccent in index expr (STABLE → fails) | Custom `unaccent+spanish` config in a STORED generated tsvector; same config at query |
| pgvector + FTS fusion | Add cosine + ts_rank scores | RRF on rank position (`rrf_k` ~50–60); tune weights on golden set |
| User input → tsquery | Raw `to_tsquery` → syntax errors | `websearch_to_tsquery` always |
| senado.cl Next.js portal | Link to `/_next/data/<buildId>/…` | Canonical `?boletin=` page; read buildId dynamically only for scraping, never for public links |
| camara.cl new endpoint | Probe with Node fetch | Probe with curl first (WAF blocks bot UAs); rate-limit 2–3s |
| Bio/lobby/committee → maestra | Name-match to FK | Confirmed-identity pipeline only (fail-closed) |
| Supabase RPC under service_role | Assume RLS protects | RLS bypassed by service_role → each RPC is the boundary; allowlist + PII-safe |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unbounded hybrid_search / faceting RPC | Slow queries, DB CPU spikes | Hard `LIMIT` + `statement_timeout`; cap `match_count` | Crafted large `match_count` / pathological tsquery (DoS on Pro plan) |
| `ts_rank_cd` over large WHERE set | Slow ranking | Rank only rows matching the FTS `WHERE` (small set), per Supabase RRF pattern | If FTS predicate is too broad |
| PostgREST 1k row cap on facet source | Facets computed on 1000 rows silently | Paginate `.order().range()` (MEMORY.md LOCKED lesson) | Result set > 1000 (already bit this project) |
| HNSW recall vs candidate limit too low | Good query, missing obvious hit | Fetch `limit * 2` candidates per arm before RRF (Supabase pattern) | Sparse embedding coverage (84.6% today) |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Secret scan on HEAD only, not git history | Leaked key in public repo history | gitleaks/trufflehog full history; rotate ever-committed secrets |
| `.env.example` with real-ish values | Copy-paste leaks / recon | CI asserts placeholders only |
| Postgres error text to client | Schema/table disclosure to hostile subject | Generic error + server-side log |
| New P1/P2 RPC not in allowlist | PII/expensive endpoint exposed under service_role | Re-derive allowlist; guard CI covers new RPCs |
| CSP Report-Only forever | No injection protection despite appearance | Flip to enforced with tested policy |
| Expensive RPC without limits | Cheap DoS on Pro-plan DB | LIMIT + statement_timeout + match_count cap |
| Publishing an unconfirmed identity link | False, defamatory claim about hostile subject | Identity golden gate re-verified; unlinked if unconfirmed |
| Bio PII stored "for later" | Ley 21.719 breach even pre-display | Parser allowlist; PII stays in R2 crudo only |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Facet counts implied global | User under/over-counts matches | Label "de estos N resultados"; honest scope |
| NULL partido shown as 0 for a party | Misreads independents/missing as absence | Explicit "Sin partido / no informado" bucket |
| Party shown tenseless | Reads stale affiliation as current | "según [fuente] al [fecha]" |
| Cancelled session shown as upcoming | Journalist attends non-event | Model status; show change with source+date |
| Dead deep-link (200 but "no encontrado") | Loss of trust in traceability | Content-match verification, not status-only |
| Lobby link framed "reunión sobre X" | Implies influence (insinuación) | "menciona el boletín N"; reader judges |

## "Looks Done But Isn't" Checklist

- [ ] **Hybrid search:** Often missing golden-set regression proof — verify literal-title AND NL AND boletín AND "similares" all scored before/after swap
- [ ] **Spanish FTS:** Often missing unaccent parity — verify Ñuñoa/Aysén/"medio ambiente" return correctly via the STORED generated tsvector
- [ ] **Boletín search:** Often missing format normalization — verify "16733", "16733-07", "16.733-07" all bullseye the same project
- [ ] **Filters:** Often missing NULL-partido bucket and truthful facet scope — verify counts sum to loaded set and independents appear
- [ ] **Deep-links:** Often missing content match — verify HTTP 200 AND page mentions the boletín, on a sample, and no URL carries a buildId
- [ ] **Bios:** Often missing PII allowlist — verify no birth/family/contact columns exist in Supabase-served tables
- [ ] **Party data:** Often missing timestamp + comité/partido separation — verify "según fuente al fecha" and comité rendered as comité
- [ ] **Lobby links:** Often missing explicit-boletín gate — verify zero links from keyword-only materia matches
- [ ] **Agenda:** Often missing coverage statement + tz — verify N/M coverage declared, America/Santiago bucketing, cancelled state modeled
- [ ] **Security:** Often missing history scan + RPC allowlist drift + CSP enforcement — verify full-history secret scan, new RPCs allowlisted+bounded, CSP enforced

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Hybrid swap regressed NL search | LOW | Flag-flip back to old RPC (kept live); re-score golden set; re-tune RRF |
| unaccent/config mismatch | MEDIUM | Rebuild STORED generated tsvector + reindex; align query config |
| Rotted deep-links (buildId) | LOW | Re-derive from canonical template; add periodic link-health probe |
| Bio PII already stored | HIGH | Drop PII columns; purge R2-derived Supabase rows; re-run minimizing load; legal note |
| False lobby→bill links published | HIGH (reputational/legal) | Take down links; restrict to explicit-boletín; audit all issued links; correction |
| Secret in git history | HIGH | Rotate credential immediately; document; (history rewrite optional — rotation is the real fix) |
| Wrong identity link shipped | HIGH (defamation) | Unpublish; re-adjudicate via golden pipeline; audit-trail entry; correction |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Golden-set regression | P1 SPIKE (first phase) | Before/after scores per query class; old RPC behind flag |
| 2 Spanish FTS config/unaccent | P1 hybrid build | Ñuñoa/Aysén/"medio ambiente" golden cases pass; EXPLAIN uses index |
| 3 tsquery input + score mixing | P1 hybrid build | `websearch_to_tsquery` used; RRF (not sum) in RPC |
| 4 Boletín formats | P1 hybrid build | All formats bullseye; short-circuit exact match |
| 5 Facet/filter honesty + NULLs | P1 ranking+filters | Facet sum = loaded set; NULL-partido bucket; no re-query on filter |
| 6 Deep-link rot | P1 deep-link + probe | Content-match 200; no buildId in URL; periodic probe |
| 7 Bio PII minimización | P2 bio (parser allowlist) | No PII columns; legal sign-off |
| 8 Stale party / comité conflation | P2 bio/ficha | Timestamped party; comité≠partido; anti-insinuación cross-links |
| 9 Lobby→bill false links | P2 lobby | Explicit-boletín-only links; linter passes copy |
| 10 Agenda coverage/tz/cancelled | P2 citaciones (audit gates UI) | Coverage N/M declared; Santiago tz; status modeled; curl-probed |
| 11 Identity fail-closed loosening | P2 (all person joins) | Every new join via confirmed identity ≥0.95; unlinked if not |
| 12 Public-repo/hostile security | P3 security | History scan; allowlist re-derived+bounded; CSP enforced; identity re-verified |

## Sources

- [Supabase — Hybrid search (RRF pattern, websearch_to_tsquery, ts_rank_cd)](https://supabase.com/docs/guides/ai/hybrid-search) — Context7 `/websites/supabase` — HIGH
- [Supabase — Full text search (websearch_to_tsquery)](https://supabase.com/docs/guides/database/full-text-search) — HIGH
- [PostgreSQL — Controlling Text Search / index-query config match](https://www.postgresql.org/docs/current/textsearch-controls.html) — HIGH
- [PostgreSQL bug thread — Spanish dictionary stemming misses (politi/politic)](https://postgresql.org/message-id/20151020110857.3017.63066%40wrigleys.postgresql.org) — MEDIUM
- [PostgreSQL — Full text index without accents / unaccent STABLE not IMMUTABLE](https://www.postgresql.org/message-id/1216889206.5112.11.camel%40tambre) — HIGH
- [Reciprocal Rank Fusion vs weighted sum — scale mismatch (cosine vs BM25)](https://www.paradedb.com/learn/search-concepts/reciprocal-rank-fusion) — MEDIUM
- [OpenSearch — Introducing RRF for hybrid search](https://opensearch.org/blog/introducing-reciprocal-rank-fusion-hybrid-search/) — MEDIUM
- PROJECT.md / CLAUDE.md / MEMORY.md (Observatorio) — LOCKED rules: identity fail-closed, anti-insinuación, two-stage R2, WAF/curl, service_role+RPC allowlist, buildId volatility, Ley 21.719, PostgREST 1k cap, CSP Report-Only — HIGH (project ground truth)

---
*Pitfalls research for: civic-transparency app — v9.0 robustez + security hardening*
*Researched: 2026-07-21*
