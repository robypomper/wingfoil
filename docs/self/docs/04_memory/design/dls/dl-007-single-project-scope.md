---
id: dl-007-single-project-scope
type: decision-log
title: "Single `.wingfoil/` per repository in MVP; multi-project deferred to v1+"
status: in-discussion
context: scope
release: ""
tmpl_version: 260703
---

## Context

As WingFoil's MVP scope was defined, a critical architectural question emerged: should the harness support
multiple projects or workspaces within a single git repository, or should each repository have exactly one
`.wingfoil/` configuration instance?

Tools like Nx, Lerna, and others serve monorepo / multi-project setups. However, WingFoil's MVP is
deliberately constrained by its timeline (v1.0 target: August 7, 2026, ~5 weeks) and its core mission:
*determinism through centralized project memory and directives*. Multi-project support introduces
addressing, isolation, scoping, and configuration complexity that would delay core features (Memory, DNA,
Directives, Workflow) without immediate return.

## Decision

**Each git repository has exactly one `.wingfoil/` directory and one project scope.** Multi-project support
and workspace-level organization are deferred to v1 and beyond.

## Rationale

1. **Alignment with Git's natural unit:** Git's fundamental model is one repository = one logical project.
   Mapping WingFoil's scope 1:1 to this keeps the mental model simple and avoids requiring custom
   addressing schemes or namespace hierarchies.

2. **Simplicity for MVP determinism:** The MVP's North Star is the *Determinism Index* — two independent
   development runs using different AI agents from the same specs + WingFoil config should produce
   substantially equivalent software. Monorepo support would require:
   - Per-project DNA, Memory, and Directives scoping
   - Disambiguation of workflow state across multiple projects
   - Cross-project dependency tracking and validation
   These add substantial implementation and testing burden without delivering core MVP value.

3. **Unblocks core features:** By keeping scope fixed to one project per repo, the team can ship:
   - Deterministic Memory management (P1) with git-backed versioning and simple path resolution
   - Authoritative DNA metadata (P2) without namespace addressing
   - Role-based Directives (P3) without project-level role binding
   - Unified Workflow (P4) without cross-project coordination
   In the aggressive v0.1–v1.0 timeline, this scope constraint is essential.

4. **User journey fit:** The five core user personas (Alex, Sam, Jordan, Morgan, Casey) and their
   journeys are all single-project workflows. Multi-project use cases (e.g., monorepo teams, multi-service
   platforms) are acknowledged in post-MVP roadmap but are not in scope for v0.1–v1.0 validation.

5. **Future-proof design:** The decision is *additive*, not breaking. A team managing multiple projects
   can create separate repositories, each with its own `.wingfoil/` instance, or opt into a v1+ monorepo
   mode. The MVP's single-project design imposes no lock-in.

(Adapted from prior decision dl-003 and grounded in the product brief constraint: "Single Project:
One `.wingfoil/` instance per repo (multi-project in v1+)".)

## Actions

- **DNS02-A1:** Enforce single-project assumption in all path resolution logic and DNA initialization.
  Document this constraint in the CLI help (`wingfoil init --help`) and the README.
- **DNS02-A2:** Add a validation check during `wingfoil init`: if a `.wingfoil/` directory already exists
  in the repository, warn and refuse to re-initialize (preventing accidental multi-config confusion).
