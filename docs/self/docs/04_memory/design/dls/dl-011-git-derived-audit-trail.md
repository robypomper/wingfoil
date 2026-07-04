---
id: dl-011-git-derived-audit-trail
type: decision-log
title: "Derive the audit trail from git history (no separate log store)"
status: ready
context: design
release: ""
tmpl_version: 260703
---

## Context

Every state change in WingFoil must be auditable: who approved/rejected/submitted a document, when, and
why. The audit trail is critical for traceability (P1.2, P1.10) and compliance. This can be implemented
as a dedicated audit-log store (database table, separate `.wingfoil/audit/` directory, or similar) or
derived entirely from the version control history that already exists.

## Decision

Derive the audit trail from **git commit history** (author, timestamp, commit message). There is no
separate audit-log store, table, or `.wingfoil/audit/` artifact. The `wingfoil memory history` command
is a thin view over `git log`, filtered and presented for human readability.

## Rationale

**Git already records the required data immutably.** Every state change in WingFoil — whether a Memory
element is added, submitted, approved, rejected, or deprecated — triggers a git commit as part of the
workflow (per adr-001: git-backed storage). Each commit carries the author (git user), timestamp
(ISO-8601), and message (the reason for the change, required by REQ-SEC-02 / REQ-SEC-04 / P1.7).
Reusing this existing history avoids maintaining a second source of truth alongside Memory
documents.

**Consistency with architectural decisions.** adr-001 (git-backed storage) establishes that all project
state — Memory, DNA, Directives, Workflow — lives in the repository; there is no external database.
adr-007 (stateless state derivation) forbids a separate `.wingfoil/state/` index because it would drift
from the source-of-truth (the Memory document frontmatter). The same principle applies to the audit
trail: a separate audit store would need reconciliation logic to stay in sync with git, multiplying
the risk of stale or missing entries. Git itself is the audit trail; deriving views from it is both
simpler and consistent with REQ-SYS-01.

**Determinism and reproducibility.** The Determinism Index (North Star) requires that identical inputs
produce equivalent execution contexts. A derived audit trail from immutable git history is bit-for-bit
reproducible across runs; a separate log store introduces the risk of insertion order, clock skew, or
merge conflicts leading to different views of "what happened" between two independent runs.

**Operational simplicity.** `wingfoil memory history <id>` can be implemented as a filtered `git log`
over the path containing that element's file, supplemented by frontmatter parsing to surface state
transitions. No separate query engine, schema, or consistency machinery is needed. Human readability
(formatting, filtering by action type) is handled by the presentation layer, not the storage layer.

## Actions

- **Clarify commit-message requirements:** Document that the `Approver:` and `Reason:` body lines
  (`memory.approve`/`memory.reject`/`memory.deprecate`) are required precisely because they are
  captured by `git log` and surfaced by `wingfoil memory history`.
- **BDD Scenario (P5.1.3, `wingfoil audit`):** Verify that the audit view (sourced from git log) shows
  approvals, rejections, and state transitions with full author/timestamp/reason detail.
- **Implementation note for MCP Tools (P5.2.3):** State-mutating tools (`memory.submit`, `memory.approve`,
  etc.) must generate git commits with the required frontmatter (P1.2, P1.7); the tool itself does not
  record audit entries separately.
