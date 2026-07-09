---
id: "task-044-builtin-template-integrity"
type: task
title: "Infrastructure: REQ-SEC-10 — built-in template integrity"
status: in-review
release: "v0.2"
priority: "High"
tags: ["v0.2", "security"]
ref: "REQ-SEC-10"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

Implement the Security constraint **REQ-SEC-10** (built-in template integrity check on load).

## Acceptance Criteria

Satisfies the Fit Criterion for **REQ-SEC-10** in `docs/02_requirements/03_sard/05_security-compliance.md`.

## Implementation Notes

Guards the P3.8 built-in directive templates against tampering.

## Execution Notes

Worked on branch `task/task-044-builtin-template-integrity` (dedicated worktree). Plan:
`docs/05_plans/rl-v1/rel-v0.2/dev-loop-rel-v0.2-plan.md` §3.

- **design (architect):**
  - *AC classification (T1):* REQ-SEC-10 has one Fit Criterion — "A corrupted or schema-invalid
    built-in template aborts `init` before writing partial assets, with a message naming the failing
    template." Classified **red-first (new behavior)**: no built-in integrity check exists on `main`
    (`initWingfoilProject` in `src/core/init.ts` had guards 1–4 only: git-repo, already-initialized,
    known-template, git-identity — no integrity gate). Split into two red-first sub-ACs by pillar: the
    P3.8 directive path (message `built-in directive template integrity check failed: <name>`) and the
    P4.17 workflow path (message `built-in workflow template invalid: <name>`), each with its own BDD
    "Error -" scenario. No characterization ACs.
  - *`read_related` (dl-015):* `depends_on: []` — nothing to read/acknowledge.
  - *`verify_specs`:* `ref: REQ-SEC-10` exists in `docs/02_requirements/03_sard/05_security-compliance.md`;
    both BDD contracts exist (`p3-directives/P3.8-builtin-directive-templates.feature` "Error - a
    built-in template fails its integrity check" and `p4-workflow/P4.17-builtin-workflow-templates.feature`
    "Error - a built-in workflow template is structurally invalid"). Both messages are transcribed
    verbatim. **No `tech-spec` gap — `design` passes straight through, no new spec scaffolded, no
    approver gate triggered.**
- **red:** added `test/core/builtin-integrity.test.ts` (unit: pass/empty, corrupted directive —
  no-frontmatter / missing-required-field / unparsable-YAML; invalid workflow — missing-`phases` /
  bad-`kind`-enum; deterministic first-failure order) and extended `test/core/init-project.test.ts`
  with the REQ-SEC-10 wiring cases (corrupted directive + invalid workflow each abort before ANY
  write, exit 1, exact message; default empty registry still succeeds). Confirmed failing (module
  absent; `initWingfoilProject` had no 3rd param).
- **green:** implemented `src/core/builtin-integrity.ts` — `verifyBuiltinTemplates(sources)`, a pure,
  deterministic first-failure check that reuses the shared `parseYaml`/`runValidation` pipeline every
  pillar loader uses (directive → `DirectiveFrontmatter`, workflow → `Workflow` schema), so a built-in
  source is validated against exactly the schema its custom counterpart would load with — no bespoke
  parsing. Added the raw `BuiltinTemplateSource` shape + the `BUILTIN_TEMPLATE_SOURCES` registry
  (empty today — no real built-in content ships until task-057/a P4.17 task; this task delivers the
  MECHANISM + wiring) to `src/storage/templates.ts` (kept in `storage` so the check imports the shape
  without `core`↔pillar cycles; `storage` never imports a pillar schema — REQ-SYS-02). Wired it into
  `initWingfoilProject` as **guard 5** (after git-identity, before the scaffold write) via an optional
  3rd `builtinTemplates` param defaulting to the registry — so a corrupted source aborts before
  `initStorage` runs (the "before writing partial assets" ordering the fit criterion demands; the
  no-write is asserted by `existsSync('.wingfoil') === false`). Tests injecting a fixture list exercise
  the abort path without needing on-disk built-in content.
- **refactor:** collapsed the two standalone message builders + the duplicated `kind === 'directive'`
  ternaries into a single `INTEGRITY_POLICY` record keyed by `BuiltinTemplateKind` (validator + exact
  message per kind); the loop now branches on `kind` once and a future kind is a one-entry change.
- **checks (review gate):** full `npm test` **561/561 green** (run when not saturated); `tsc -p
  tsconfig.build.json` exit 0; coverage (excl. the load-flaky integration suite) **97.96% stmts /
  88.1% branch / 97.63% funcs / 98.38% lines**, all ≥80, with `builtin-integrity.ts` at **100%**;
  `npm run docs:api` exit 0 (ACTIVE hard-reject — every new export in `builtin-integrity.ts` +
  `templates.ts` carries TSDoc). BDD: the P3.8/P4.17 "Error -" scenarios are the two `.feature`
  contracts driving `init-project.test.ts`'s wiring cases.
  - *Known pre-existing flake (not a regression):* `test/cli/program.integration.test.ts`'s
    `memory search api ... under 1 second` is a wall-clock assertion that reports ~3.5s and fails
    under heavy parallel load (10 concurrent dev-loops). Re-run in isolation it passes **28/28**. Out
    of this task's scope — not touched.

**Scope / follow-ups (traced):**
- `BUILTIN_TEMPLATE_SOURCES` is intentionally **empty** — no real built-in directive/workflow content
  exists yet. `task-057-builtin-directive-templates` (P3.8, `depends_on: [task-043, task-044]`) and a
  future P4.17 workflow-template task append real entries here; the integrity check + `init` wiring are
  ready for that content with no further change (append-only). `task-042` (REQ-SEC-07) is the
  immutability angle on the same asset set; this task is the integrity/verification angle.
