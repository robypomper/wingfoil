---
id: "rl-v1"
type: release-line
title: "WingFoil v1 — MVP"
status: active
version: "v1"
tmpl_version: 260703   # Orignal template version
---

## Scope

WingFoil's MVP arc, delivered as five weekly minor releases (v0.1 → v1.0), each centered on one
pillar per `docs/01_vision/07_sequencer.md`:

- **v0.1 — Project Memory + DNA**: git-backed storage, Memory CRUD, DNA config.
- **v0.2 — Project Directives**: custom/built-in directives, role-based auto-load.
- **v0.3 — Project Workflow**: workflow config, command surface, agent execution.
- **v0.4 — Polish & Documentation**: MCP full endpoints, `dna infer`, CLI UX.
- **v1.0 — MVP Complete**: atomic step execution, workflow checks, built-in templates hardened.

By the end of this release-line, all 5 pillars (Memory, DNA, Directives, Workflow, MCP/Agent
integration) are integrated and stable, and WingFoil is dogfooding itself
(`docs/self/.wingfoil/` → repository-root `.wingfoil/`).

## Success Criteria

From `docs/01_vision/08_mvp-canvas.md` ("MVP Success Criteria (v1.0)"):

- All 8 user journeys executable and tested (0a, 0b, 1–6).
- Data integrity preserved (git versioning + audit trail work).
- CLI is intuitive and documented (help text, examples).
- MCP server is stable (<1 sec queries).
- All 5 pillars integrated and stable.
- Published to npm with documentation.
- North Star: **Determinism Index** — two independent development runs from the same base
  (specs + WingFoil config) using different AI agents produce substantially equivalent software.

## Execution Notes

<!-- Running log of what actually happened across this release-line's workflow — filled in
     incrementally, not written after the fact. Raw material for future planning of the next
     release-line, not a retrospective itself (each release still has its own). -->

### Initial Design (seed-adrs / seed-dls / seed-specs)

<!-- Decisions/specs formalized up front for this release-line; anything discovered late that
     should have been seeded here instead of during a release's identify-specs. -->

### Delivery (per release)

<!-- Cross-release patterns: recurring blockers, releases that slipped and why, whether the
     release roadmap seeded here needed revision mid-line. -->
