---
id: "dl-013-documentation-process-gate"
type: decision-log
title: "Adopt documentation-process gate: TSDoc/TypeDoc code docs + release-end user-facing docs"
status: ready
context: "process"
release: "v0.2"
tmpl_version: 260703   # Orignal template version
---

## Context

Reviewing the current documentation-process config (`directives/custom/documentation.md` and
`workflows/custom/release-cycle.yaml`) surfaces two gaps:

1. **No enforceable rule for code-level API docs.** The custom `documentation` directive
   (`docs/self/.wingfoil/directives/custom/documentation.md`, P3.8 stand-in) requires "every
   command/feature is documented" but says nothing about public API surface inside the code itself
   (TSDoc comments, `TypeDoc` build health).
2. **No workflow gate for user-facing docs at release end.** `release-cycle.yaml` goes straight from
   `implementation` to `submit` — nothing in the workflow itself forces README/user-guide/CLI
   reference/examples/CHANGELOG to be written or aligned before a release is assembled; it relies on
   informal diligence.

## Decision

**Adopt both documentation-process changes into the current config:**

1. Extend `docs/self/.wingfoil/directives/custom/documentation.md` with two concrete, checkable rules:
   - Every public/exported symbol carries a TSDoc comment; `TypeDoc` must build clean; the `dev-loop`
     review gate rejects any undocumented public element.
   - User-facing docs — `README.md`, user guide, CLI reference, working examples, `CHANGELOG` — are
     written/aligned before `release-submit`.
2. Add a `user-docs` phase to `docs/self/.wingfoil/workflows/custom/release-cycle.yaml`, positioned
   between `implementation` and `submit`: pre-check that every task tagged for the release is `done`;
   `produces:` `README.md`, user guide, CLI reference, examples, `CHANGELOG`.

## Rationale

- **A directive alone is aspirational; a workflow phase makes it enforceable.** Rule 1 (code docs) is
  caught by the existing `dev-loop` review gate once stated. Rule 2 (user-facing docs) has no such
  gate today — pairing the directive text with an actual `release-cycle` phase is what makes it a
  hard release blocker instead of a convention nobody checks.
- **Traceability.** Cites the existing `documentation` custom directive (`ref: [P3.8]`) and the
  workflow phase-step/deliverable features (P4.10/P4.11) already used elsewhere in `release-cycle`'s
  sibling phases (e.g. `release-submit`'s `checks.pre` / `produces` pattern).
- **Alternative considered — leave documentation as an unenforced convention (status quo).** Rejected:
  a directive with no matching workflow gate has no way to actually block a release, so the gap would
  persist indefinitely.

## Actions

- [ ] Update `docs/self/.wingfoil/directives/custom/documentation.md` — add the TSDoc/TypeDoc rule and
  the user-facing-docs release-end rule — owner: tech-lead.
- [ ] Add a `user-docs.yaml` sub-workflow (`kind: sub`, `element: release`) with a pre-check phase
  (`all tasks where tags=[{release.version}] are status: done`) and a `produces:` phase (`README.md`,
  user guide, CLI reference, examples, `CHANGELOG`), then include it in
  `docs/self/.wingfoil/workflows/custom/release-cycle.yaml` between `implementation` and `submit` —
  owner: architect.
- [ ] Once `release-cycle.yaml` is updated, align any execution plan under `docs/05_plans/rl-v1/rel-v0.1/`
  that models `release-cycle` phases past `planning` to include the new `user-docs` phase — owner:
  tech-lead.
- [ ] This DL advances `ready → in-develop` when `release-planning` derives the task(s) implementing
  the two Actions above, and `in-develop → done` once those tasks are `done` — per `decision-log`'s own
  state machine (`dl-012-decision-log-state-machine`).

> **Implemented out-of-flow in the v0.1→v0.2 config-bootstrap** (branch `design/config_bootstrap_v0.2`; see `docs/05_plans/rl-v1/rel-v0.1/retrospective-and-config-bootstrap-plan.md`). `release: v0.2` — already delivered; no further task derivation by v0.2 `build-backlog`.
