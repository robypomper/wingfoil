---
id: "task-044-builtin-template-integrity"
type: task
title: "Infrastructure: REQ-SEC-10 — built-in template integrity"
status: approved
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

  > **CORRECTED in the second pass — this bullet is wrong on two counts.** (1) "append real entries
  > here" describes a hand-maintained registry that no longer exists: `BUILTIN_TEMPLATE_SOURCES` was
  > removed and replaced by `builtinTemplateSources(files)`, which derives the checked set from
  > `templateScaffold`'s output. Real content is added to the **scaffold**, not to a registry.
  > (2) "ready for that content with no further change (append-only)" was an overstatement — the
  > module was NOT ready: nothing linked the scaffold to the registry, the ordering hazard below
  > applies, and a valid source can still emit stderr warning noise. See the second-pass section.

---

### Second pass — review-gate `red` fallback (`dev-loop.yaml` v1.2 `review.fallback`)

Rejected at the review gate for two fail-open shapes and one overstated readiness claim
(`rejection_reason`, now cleared per `spec-010`). `main` had already been merged into the branch
before this pass started (`dl-035`, merge `2958d9e`, one keep-both conflict in `src/core/index.ts`'s
barrel); no further sync was run. Scope bounded by **`dl-031-req-sec-10-integrity-depth`** (`ready`),
ratified after the first pass: **option (a) — schema validation IS the REQ-SEC-10 contract.**
REQ-SEC-10 is now titled *"Schema checks on built-in templates"* on `main` with the Description
narrowed to match. **No digest and no manifest were added, deliberately** — dl-031's rationale is on
the record (the threat named is accidental corruption, not post-install tampering; a manifest shipped
in the same package is no control against an adversary who can rewrite a template; a content hash
would add a line-ending/ordering/encoding determinism surface against REQ-SYS-07; distribution-channel
assurance lives in `adr-009`/`spec-015`). The coupling fix below is deliberately structural, not a
hash. A comment in `src/core/builtin-integrity.ts`'s module header records this so a later reader does
not "strengthen" it into a digest.

- **red** — three red-first additions, all confirmed failing before any implementation:
  - `test/core/builtin-integrity.test.ts` — out-of-union `kind`. Observed:
    `TypeError: Cannot read properties of undefined (reading 'isValid')` at
    `src/core/builtin-integrity.ts:108`, and — for an `Object.prototype` key used as a kind
    (`constructor`, `toString`, `__proto__`, `valueOf`, `hasOwnProperty`) — `TypeError: policy.isValid
    is not a function`, i.e. an inherited prototype member was being mistaken for a policy.
  - `test/core/init-project.test.ts` — the same input through `initWingfoilProject`. Observed the
    `TypeError` propagating out of `initWingfoilProject (src/core/init.ts:134)` — confirming the
    escape route: guard 5 sits **outside** the `try`/`catch`, so the throw bypasses the `CoreResult`
    contract entirely instead of becoming a `VALIDATION` error mapped to exit 1.
  - `test/storage/builtin-template-sources.test.ts` (new) — the registry/scaffold coupling. Observed:
    `TypeError: (0, templates_1.builtinTemplateSources) is not a function`.
  - Red run: **15 failed / 17 passed** across the three suites.
- **green** — two changes:
  - *Fail-closed default.* `INTEGRITY_POLICY` is still declared as an EXHAUSTIVE
    `Record<BuiltinTemplateKind, IntegrityPolicy>` (so widening the union stays a compile error), but
    it is now read only through `policyFor(kind)`, which uses `Object.prototype.hasOwnProperty.call`
    — that keeps inherited members out as well as absent keys. `verifyBuiltinTemplates` treats
    `undefined` as a FAILURE, not a skip and not a throw: it returns a `BuiltinIntegrityFailure`
    carrying `built-in template integrity check failed: {name} (unrecognized kind "{kind}")`. That
    string is **not** a BDD contract (the P3.8/P4.17 scenarios only cover the two known kinds) but it
    honours the fit criterion's one requirement of every abort message — it names the failing
    template — and echoes the offending kind. A source that cannot be checked must not be installed.
  - *Registry→scaffold coupling.* **`BUILTIN_TEMPLATE_SOURCES` was removed** and replaced by
    `builtinTemplateSources(files: readonly ScaffoldFile[])` in `src/storage/templates.ts`.
    `initWingfoilProject` now computes `templateScaffold(template)` **before** guard 5 (the function
    is pure and writes nothing, so the "before writing partial assets" ordering is preserved) and
    checks `builtinTemplateSources(files)`. **Deliberate choice of derivation over a coupling test:**
    a test asserts that omission has not happened *yet* and can be deleted or narrowed by the same
    change that introduces the omission; derivation makes "installed but unchecked" *unrepresentable*
    — there is no second list to forget. The weaker option was rejected for exactly the reason dl-031
    recorded the defect (fail-open **by omission**). A coupling test was added **as well**, but as a
    guard on the derivation's only remaining escape hatch, not as the mechanism (below).
    Classification is by **directory, not extension** — every non-dotfile under
    `.wingfoil/directives/built-in/` is checked as a directive and under `.wingfoil/workflows/built-in/`
    as a workflow — so an unexpected file shape fails the check instead of slipping past an extension
    filter. The single exclusion is dotfile placeholders (`.gitkeep`), and
    `test/storage/builtin-template-sources.test.ts`'s "skips ONLY dotfiles" property asserts over the
    real scaffold that the count skipped equals the count of dotfiles — so widening that carve-out
    goes red. `templateScaffold` now builds its two `.gitkeep` paths from the same exported
    `BUILTIN_DIRECTIVES_DIR` / `BUILTIN_WORKFLOWS_DIR` constants the derivation matches on.
  - **What now fails if a scaffolded built-in asset has no entry:** nothing *can* have no entry —
    the derivation is total over the scaffold. What fails instead is the inverse and more useful
    case: a scaffolded built-in asset that does not pass its pillar schema now aborts `init`, and
    every `initWingfoilProject` success test in `test/core/init-project.test.ts` goes red the moment
    such content is added. The failure surfaces in CI, not in users' hands — which is the point of
    the ordering hazard below.
- **refactor** — folded the two path helpers into one `builtinSourceOf(file)` (basename computed
  once); realigned `src/core/builtin-integrity.ts`'s module header to REQ-SEC-10's **amended** text
  ("schema-checked", new title) and added the dl-031 scope note; corrected the now-stale
  `BUILTIN_TEMPLATE_SOURCES` reference in `test/core/init-project.test.ts`'s describe-block header.
- **checks (all run in this worktree, this pass):** `npx jest --maxWorkers=2` — **772/772 passed, 67
  suites, 0 failed**. `npx jest --coverage --maxWorkers=2` — global **98.1% stmts / 88.32% branch /
  98.12% funcs / 98.69% lines** (all ≥ 80); touched files: `src/core/builtin-integrity.ts`
  **100/100/100/100**, `src/storage/templates.ts` **100 / 95 / 100 / 100** (the one uncovered branch
  is the pre-existing `templateScaffold` sort comparator's equal-path arm, untouched by this task),
  `src/core/init.ts` **92.5 / 93.75 / 100 / 94.73**. `npm run docs:api` exit **0**;
  `npx tsc -p tsconfig.build.json` exit **0**; `npx eslint .` exit **0** (`lint.clean`, ACTIVE
  hard-reject per `dl-034` / `dev-loop.yaml` v1.2). The pre-existing
  `test/cli/program.integration.test.ts` wall-clock flake noted in the first pass did **not**
  reproduce in any run this pass.

**Ordering hazard for `task-057` — VERIFIED, read this before populating built-in content.**

`task-057-builtin-directive-templates` declares `depends_on: [task-043, task-044]`, so `dl-015`'s
`agent.read_related` hard gate makes its author read this note before `red`. Measured, not inferred:
feeding the **real** scaffolded directive content (`directiveMd()` in `src/storage/templates.ts`, all
10 files) through `verifyBuiltinTemplates` as `kind: directive` returns

```
built-in directive template integrity check failed: architecture
```

because `directiveMd()` emits frontmatter `name` / `kind` / `ref` while `DirectiveFrontmatter`
requires `id` / `type` / `title`. **That is `bug-006-init-directive-scaffold-schema-invalid`
(`planned`), whose fix task is `task-064-fix-init-directive-scaffold-schema`.**

Consequence: if `task-057` adds built-in directive files to `templateScaffold` using the current
generator shape **before `task-064` lands**, `wingfoil init` aborts for every user on the first
built-in file, in alphabetical order. Note this is now **automatic** — derivation means no registry
edit is needed to arm it; adding the scaffold file is enough. The failure is loud and lands in CI
(every `initWingfoilProject` success test goes red on the same commit), not silently on users, which
is the intended fail-closed behaviour — but the sequencing constraint is real: **`task-064` must land
before `task-057` populates `directives/built-in/`**, or `task-057` must emit schema-valid
frontmatter itself.

**Out of scope — noted, deliberately not fixed here (cross-task boundary):**

- *stderr warning noise from `.passthrough()` schemas.* Verified: a **valid** built-in source whose
  frontmatter carries a key outside the schema's declared shape emits to stderr during `init`, e.g.
  `Warning: security: unknown field(s) ignored: scope`. (The first-pass framing "any extra
  frontmatter key" is too broad — `name`/`kind`/`ref` are in `DirectiveFrontmatter`'s shape and warn
  nothing; only keys outside the shape do.) This is `runValidation`'s spec-009 §2 behaviour for every
  consumer, not a defect of this check — changing it would change every pillar loader.
- *`filePath`-labelled third argument.* `parseYaml(text, filePath)` and
  `runValidation(schema, raw, filePath)` take a **path** for their diagnostics; this module passes
  `source.name` (a template name). Hence the warning above reads `security:` rather than a path. A
  purely cosmetic mislabel today, but it belongs to whoever owns `src/validation`'s diagnostic
  contract, not to a REQ-SEC-10 pass.
- *Barrel surface change.* `BUILTIN_TEMPLATE_SOURCES` is gone from `src/storage/index.ts`;
  `builtinTemplateSources`, `BUILTIN_DIRECTIVES_DIR` and `BUILTIN_WORKFLOWS_DIR` are exported in its
  place. Nothing outside `src/core/init.ts` and this task's tests consumed it (verified by
  repo-wide grep), and the package is unpublished (`0.1.0`, `v0.1` skipped publishing per `dl-018`),
  so there is no external consumer to migrate.
