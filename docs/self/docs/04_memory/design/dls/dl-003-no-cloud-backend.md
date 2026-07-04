---
id: dl-003-no-cloud-backend
type: decision-log
title: "Local-first, no cloud backend — keep state in git only"
status: ready
context: "architecture"
release: ""
tmpl_version: 260703
---

## Context

As WingFoil's architectural foundation took shape, the team considered where to persist project state — Memory, DNA, Directives, and Workflow — across all five pillars. A natural question arose: should this state live in a hosted cloud service or database (e.g., a SaaS backend, PostgreSQL in the cloud, a real-time collaboration platform) that would offer transactional writes, built-in querying, and multi-user locking out of the box?

This was attractive in the abstract — cloud services simplify concurrency and infrastructure setup — but it contradicted WingFoil's core identity: an **open-source, self-hosted harness with zero infrastructure overhead**.

## Decision

WingFoil will **not include a cloud backend or hosted database**. All project state remains local-first and git-only:
- State is persisted as plain files (YAML + Markdown) under `.wingfoil/`, fully versioned in the project's own git repository.
- There is no SaaS backend, managed database, or external state service.
- Collaboration happens asynchronously through git (`push`/`pull`), not through real-time server updates.
- Real-time collaboration and auto-sync are deferred to v1.0+.

## Rationale

### Why Not Cloud?

1. **Single Source of Truth:** A cloud backend would create a second source of truth alongside the git history. This violates the "clone and go" philosophy — an agent or team member should be able to reconstruct 100% of project state from a fresh `git clone` with zero external dependencies.

2. **Infrastructure Overhead:** Hosting a database or SaaS service introduces operational burden (credentials, hosting bills, uptime dependencies, network reliability) that contradicts WingFoil's identity as an open-source, self-hosted tool. The point is to give teams a harness they control entirely.

3. **Sync and Drift Problems:** Once state lives in two places (cloud + git), you must solve the sync protocol, conflict resolution, and offline-availability problems. A developer who pulls stale code and works offline would have outdated state if the backend is unavailable or out of sync. Git handles this naturally; a cloud backend requires additional machinery.

4. **Determinism and Auditability:** Git provides a free, complete audit trail — every state change is a commit with author and timestamp. A separate database requires building equivalent audit logging, versioning, and branching semantics from scratch.

### What We Accept

- **No Row-Level Locking:** Concurrent edits to the same file resolve as git merges (or conflicts) rather than atomic database transactions. This is acceptable for WingFoil's asynchronous, git-based workflow; real-time concurrency is not an MVP requirement.

- **Manual Queries:** Cross-cutting lookups (e.g., "all tasks in backlog") require scanning frontmatter across files rather than issuing a SQL query. This is mitigated by keeping scans targeted and by selective document loading; v1.0+ may add a local index if this becomes a bottleneck.

- **Scale Challenges:** Very large project histories may eventually require git-level pruning or large-file handling, but this is out of scope for the current design.

### Trade-off Summary

| Aspect | Cloud Backend | Git-Only (Chosen) |
|--------|---|---|
| **Infrastructure** | Managed (but costs, credentials, uptime) | None (local only) |
| **Offline Use** | Requires caching/sync | Works instantly |
| **Audit Trail** | Must be built | Free (git history) |
| **Determinism** | Requires multi-version logic | Inherent (one source of truth) |
| **Concurrency** | Transactional, but adds complexity | Eventual consistency via git merge |
| **Query Performance** | Fast (database index) | Slower (file scan), acceptable for scope |

The chosen trade-off — no transactional concurrency, no free querying — is acceptable because WingFoil's target workflows are asynchronous (developers work between `push`/`pull` cycles) and queries are scoped and infrequent.

(Rationale synthesized from `docs/01_vision/01_product-brief.md` § Known Constraints & Assumptions, and aligned with companion ADR `adr-001-git-backed-storage`.)

## Actions

- Document this decision in the architectural record so future contributors understand why multi-cloud support or hybrid storage (e.g., cloud index + git as fallback) was not pursued in the MVP.
- If a real team reports query performance or locking as a bottleneck post-v0.1, revisit and consider a local SQLite index or similar.
