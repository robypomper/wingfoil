---
id: dl-004-keyword-search-only
type: decision-log
title: "Keyword-only Memory search for rl-v1 MVP"
status: ready
context: scope
release: ""
tmpl_version: 260703
---

## Context

Project Memory (Pillar 1) must allow developers and agents to find decisions, conventions, and artifacts quickly. Two approaches exist:

1. **Keyword search** — String matching against document titles, content, and metadata (simple, deterministic, no external dependencies).
2. **Semantic/embedding-based search** — Natural language understanding via ML models (powerful but adds complexity, non-determinism, and external dependencies).

The question: which search approach should rl-v1 (the MVP, v0.1–v1.0) implement?

## Decision

The MVP implements **keyword-only Memory search** (features P1.5, P1.12). Semantic/embedding-based search is deferred to **v1.1+** (post-MVP).

## Rationale

**Keyword search is the right fit for rl-v1:**

- **Determinism.** String matching is fully deterministic — no randomness, no model versioning concerns. Two independent runs produce identical results. This aligns with WingFoil's North Star, the Determinism Index (REQ-SYS-07).
- **Speed and simplicity.** Keyword queries are fast (<1 sec for large Memory indexes) and require no external API calls or ML infrastructure.
- **Dependency-light.** No need for embedding models, vector databases, or LLM API costs — reducing friction for early adopters and dogfooding.
- **Solves the core need.** "Find a decision by topic" — the primary user journey — works perfectly with keyword search. Developers intuitively search by decision name, feature ID (e.g., P1.5), or decision-log ID.
- **Backwards compatible with post-MVP semantic layer.** Keyword search can coexist with semantic indexing once added; users will choose the best tool per query.

**Trade-offs accepted:**

- Keyword search requires users to be intentional about terminology (e.g., searching for "determinism" may not surface "non-determinism"). This is manageable because WingFoil enforces consistent tagging and metadata (feature P1.13: Memory Element Schema).
- Semantic search would handle fuzzy matching (e.g., "reproducibility" finding "determinism"), but this is a nice-to-have, not critical for v0.1–v1.0.

**Why not delay keyword search entirely?** Deferring *any* search to post-MVP breaks core journeys (Journeys 1, 3, 5 in docs/01_vision/05_journeys.md) and breaks the MVP success criterion: "Solo developer can complete Journey 1 end-to-end" (docs/01_vision/01_product-brief.md, v0.1 Success Criteria).
