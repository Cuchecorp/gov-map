# Observatorio del Congreso 360
### Turning Chile's public legislative data into citizen-actionable accountability

---

## The problem: abundance without access

Chile is, on paper, a data-rich democracy. The Chamber of Deputies, the Senate, the
National Library of Congress (BCN/LeyChile), the Lobby Law registry, asset- and
interest-declaration systems, the electoral service (SERVEL) and public-procurement
platforms all publish primary data. But that data is **fragmented across a dozen portals,
exposed in incompatible formats** (ASP.NET WebForms, raw XML, scanned PDFs, SSR JSON
blobs behind a government WAF), and **structured for the institution, not the citizen**.

The practical result: a journalist or an ordinary person *cannot* answer a basic
accountability question — "what has this legislator done, how did they vote, who did they
meet with, and what do they declare?" — without manually cross-referencing sources that do
not speak to each other. The information exists; **the ability to consume it does not.**

## What it is

**Observatorio del Congreso 360** is a public web platform that **aggregates** Chile's
scattered legislative data into a single, queryable surface and **makes it actionable** for
public accountability. It has two fronts of equal weight:

1. **Bill tracking** — for any bill: what stage it is in, how it has been voted, similar
   bills, and *semantic search by subject matter* ("idea matriz") and cited legal bodies.
2. **Legislator 360** — for any member of Congress: the bills they sponsor, how they vote,
   who they meet with (lobby), what they declare (assets and interests), campaign financing,
   and the state contracts that surround them.

**Core value:** about any bill or any legislator, a citizen can answer *"what happened, when,
and according to which source"* — because **every datapoint carries its source, its date, and
a link to the original**, and the platform **never asserts intent or causality**.

## Methodological framework: Citizen UX

The platform is designed around **citizen user experience (UX)** as its governing theory, not
around data completeness for its own sake. Four principles operationalize this:

- **Source traceability as a first-class citizen.** Every shown fact is a *quotation* of a
  primary source with provenance attached (origin, capture date, original URL). The user is
  never asked to trust the platform — they are handed the receipt.
- **Honest degradation, never fabrication.** When a source is blocked, scanned without a text
  layer, or missing a field, the system shows *null* and says so plainly (e.g. "not available
  as structured data — see the official PDF"). It will not invent a value to fill a gap. This
  protects the citizen's trust and the platform's evidentiary integrity.
- **Aggregation → cross-referencing → actionability.** Value is created by *joining* datasets
  that the State keeps apart: a legislator's votes next to their lobby meetings next to the
  state contracts of the firms around them. The cross-reference is the product.
- **Restraint.** The platform states facts and relationships; it **never insinuates wrongdoing,
  intent, or causality**, and it shields personal data (it shows confirmed, audited identities,
  not hard PII). Accountability is enabled by clarity, not by accusation.

UX-wise this means: plain language, progressive disclosure, timelines that span both chambers,
project "fichas" (fact sheets), and search that meets the citizen where they are — by *idea*
("data protection," "pension reform") via semantic search, or by *keyword* (committee, subject,
guest, bill number) via full-text search.

## How it works

A respectful, two-stage ingestion pipeline feeds a normalized data model:

1. **Stage 1 — Source → raw, immutable storage.** Everything downloaded is first persisted
   verbatim (content-addressed) in object storage, so the platform never has to disturb the
   government servers again to re-process. Ingestion is deliberately polite: rate-limited
   (2–3s/host), identifying User-Agent, robots.txt respected, daily caching.
2. **Stage 2 — Raw → structured database.** Parsers and, where needed, LLM extraction turn the
   raw artifacts into structured rows. For unstructured artifacts (e.g. the Chamber's weekly
   floor agenda, published only as a PDF), a language model extracts the text *literally* under
   a strict "do not invent" prompt, validated by schema; if extraction fails, the system
   degrades honestly to the source link.

**Search** combines two modes by design: **semantic search** (vector embeddings) for
"find bills about *this idea*," and **full-text search** for "find this committee / subject /
person / bill number." Bill numbers everywhere cross-link to the bill's fact sheet, knitting
the datasets together.

## Data sources

Chamber of Deputies (bills, committee citations, floor agenda) · Senate (bill tracking, votes,
floor table) · BCN / LeyChile (full legal texts) · Lobby Law registry · asset & interest
declarations · SERVEL (campaign financing) · public-procurement contracts.

## Technology (single language, low cost)

TypeScript end-to-end (Deno connectors + Next.js frontend) · Supabase Postgres with `pgvector`
for semantic search · Cloudflare for object storage and hosting · pluggable LLM layer (embeddings
+ a low-cost extraction model). The architecture is intentionally lean — it runs on a
~USD 25/month database tier — so the model is **replicable by a small civic-tech team**, not
only by a well-funded institution.

## Why it matters for accountability

Public accountability fails not when data is secret, but when it is **technically public yet
practically unreachable**. By aggregating fragmented sources, attaching provenance to every
fact, refusing to fabricate, and cross-referencing votes, lobbying, declarations, financing and
contracts, the Observatorio converts *latent* transparency into *operative* transparency — the
kind a citizen or a newsroom can actually use.

## Relevance for a Brazilian context

The methodology is **source-agnostic and portable**. Brazil shares the structural condition —
abundant but fragmented official data (Câmara, Senado, TSE, portals of transparency,
procurement). The same framework — respectful two-stage ingestion, provenance-first display,
honest degradation, citizen-UX search, and dataset cross-referencing — transfers directly. We
would welcome exchanging methodology, data models, and the open principles behind this work.

---

*Open data under CC BY 4.0 with visible attribution. Built and reviewed for legal compliance
prior to public launch. The platform states what the sources state — nothing more.*
