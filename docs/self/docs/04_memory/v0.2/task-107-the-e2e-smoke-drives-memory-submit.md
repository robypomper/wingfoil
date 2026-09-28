---
id: "task-107-the-e2e-smoke-drives-memory-submit"
type: task
title: "The dl-023 e2e smoke drives `memory submit` on the task it just added, and its test pins the exact step list so a future omission is visible"
status: in-progress
release: "v0.2"
priority: "high"
tags: ["v0.2", "e2e-smoke", "memory", "testing"]
ref: "bug-029-e2e-smoke-omits-memory-submit"
bug: ["bug-029-e2e-smoke-omits-memory-submit"]
depends_on: ["task-060-publish-pipeline", "task-045-memory-submit"]
tmpl_version: 260703
---

## Description

`e2e-smoke.yaml` requires its `drive-cli` phase to run `cli.run("memory add ...; memory submit ...")`
through a freshly initialised project. `scripts/e2e-smoke.cjs` runs `memory add` and stops there: its
module doc says the submit step *"is added here when it ships"*. `memory submit` shipped with
`task-045`, and nothing added it. That is `bug-029`.

The bug's own blocker has gone. `bug-029` says a transition verb would throw in a fresh project because
the scaffolded `memory.yaml` declared no state machine (`bug-030`), and `bug-030` is `closed`. The
`e2e-smoke-rel-v0.2-plan` re-probed it on `ed835f95`, on both templates, in a throwaway repository:
`memory submit task-001-smoke-task --format json` exits 0, prints `"from":"draft","to":"pending"`, and
leaves `git status --porcelain` empty.

The approver put this gap in v0.2 on 2026-09-22 (`e2e-smoke-rel-v0.2-plan`, *Approver decisions of
2026-09-22*). **This closes `bug-029`.** It is also expected to close the plan's gap **G4**: until now,
no step of the smoke loads the scaffolded `memory.yaml`'s state machine, and `memory submit` is the
first that does.

## Acceptance Criteria

**AC1 — the smoke submits the task it added, on both templates.** After the `memory add` step, each
per-template run executes `memory submit <id> --format json`. `<id>` is read from the `id` field of the
`memory add` step's JSON stdout. Do not hard-code `task-001-smoke-task`: the id comes from the tool, and
a hard-coded id would hide an id-generation change. The step asserts exit 0 and JSON stdout, as its
neighbours do. The report line reads
`[<T>] wingfoil memory submit <id> --format json — exit 0`.

**AC2 — the transition is asserted, not only the exit code.** The submit step's JSON stdout reports
`from: "draft"` and `to: "pending"`. If it reports anything else, the step fails with a `detail` that
names what came back. This assertion is what makes G4 real, because it proves the scaffolded state
machine was loaded and applied rather than merely parsed.

**AC3 — the clean-tree check still follows every mutation, submit included.** The existing
`working tree clean after every mutation` check stays last in each per-template run.

**AC4 — the test pins the exact step list.** `test/cli/e2e-smoke.test.ts` replaces
`expect.arrayContaining([...])` with an exact, ordered assertion over the per-template commands, so
omitting or reordering a step fails the test. That test currently passes both with and without
`memory submit`, which is why `bug-029` went unnoticed.

**AC5 — `smokeSteps` stays exported, and the publish pipeline keeps working.**
`scripts/publish-staging.cjs` imports `runSmoke`, and the test imports `SMOKE_TEMPLATES`, `smokeSteps`
and `runSmoke`. Their callers must keep working unchanged. `publish-staging`'s own tests must stay
green (`npx jest test/cli/publish-staging.test.ts test/cli/publish-pipeline.test.ts test/cli/e2e-smoke.test.ts`), and `.github/workflows/publish.yml`'s step *"Stage on
ephemeral Verdaccio + dl-023 smoke (spec-015 §3 stages 2–3)"* needs no edit.

**AC6 — the stale module doc is corrected.** The sentence in `scripts/e2e-smoke.cjs` saying that
`memory submit` does not exist yet and will be added when it ships is now false. Replace it with a
description of what the smoke does.

**AC7 — a failing submit is reported like any other failing step.** A test drives the runner against a
command that exits 0 for `memory add` (with a valid id) but non-zero for `memory submit`. It asserts
that `report.ok` is false and that the failing check is the submit line. The runner must not crash on
the dependency between the two steps. It is enough to show this once, with a stub command.

**AC8 — the run itself.** On the task branch, rebuild `dist/` and run
`node scripts/e2e-smoke.cjs --expect-version "$(node -p "require('./package.json').version")" -- node "$PWD/dist/cli.js"`.
It exits 0 with a submit line on both templates. Paste that log into the Execution Notes.

## Implementation Notes

- **Classify each AC before you write code (`dl-014`/T1).** AC1, AC2, AC4 and AC7 are **red-first**:
  the behaviour is new, and a tightened AC4 test goes red on the current step list. AC3 and AC5 are
  **characterization**: pin them before touching the runner. AC6 is documentation. AC8 is measurement.
- **The step shape has to grow.** `smokeSteps(template)` returns a static array of `{args, json?}`,
  and `smokeTemplate` iterates it blindly. Submit's args depend on the previous step's stdout. Pick the
  smallest shape that keeps `smokeSteps` exported and meaningful for AC4's exact-list assertion. One
  option is an optional `args` function over the prior steps' parsed JSON. Another is a named capture
  on the add step that a later step references. Say which one you chose and why.
- **H1 of `e2e-smoke-rel-v0.2-plan`: this script is a publish-pipeline gate.** `spec-015` §3 stage 3
  reuses it verbatim through `scripts/publish-staging.cjs`, and a failing staging smoke blocks
  promotion. Read the publish workflow's smoke step before and after the change.
- **Do not widen the scope into G2 or G3.** Exit-1/exit-2 coverage and explicit schema re-validation
  are gaps of the same plan, but the approver authorised them to the next release, not to this task.
  `memory approve`/`reject` cannot be exit-0 steps in a scaffolded project (plan H2: no approver
  identity is bound), so do not add them.
- **Do not bump `package.json`** (plan H6). The release bump belongs to `release-publishing`.
- Read `task-060`'s Execution Notes (`dl-015`) before designing: it wrote the runner and its tests.

## Execution Notes

### design — 2026-09-28 (role architect)

Branch `task/task-107-the-e2e-smoke-drives-memory-submit`, worktree `.wf2-wt/task-107`, cut from
`qa/e2e-smoke-v0.2` at `7a4e4e89`, because that is the only branch that carries this task's file.

**Governance read, per the `dl-015` gate.**
- **`task-060-publish-pipeline` (Execution Notes).** It wrote `scripts/e2e-smoke.cjs` with its `.d.cts`
  and `test/cli/e2e-smoke.test.ts`. Its deliverables list records the gap this task closes: *"Gap vs
  dl-023: `memory submit` is listed there but has no CLI verb yet (task-045)"*. Its design decision 1
  explains why the script is plain CommonJS with no build step, and why the `.d.cts` exists: the Jest
  suites type-check under `tsc --noEmit`. The step-shape change therefore has to land in the `.d.cts` as
  well. It also records that a relative `dist/cli.js` fails, because steps run in a temp dir.
- **`task-045-memory-submit` (Execution Notes).** `memory submit` emits `{id, path, from, to}` with
  `--format json`, and an illegal edge exits 1 under the `dl-032` contract. The AC2 assertion is built
  on those two keys.
- **Tech-specs.** `grep -rln "e2e-smoke\|smokeSteps" docs/self/docs/04_memory/design/specs/` finds
  nothing. `spec-015` mentions the smoke only as *reused verbatim* at §3 stage 3, and its line reads
  *"a change to that smoke propagates here"*. No spec pins the step list or the script's API; the
  contract is `e2e-smoke.yaml` plus `dl-023`. The script is outside `package.json` `files`, so it is not
  a shipped module API. **No tech-spec is missing, and none is scaffolded.**

**AC classification (`dl-014`/T1).**

| AC | Class | Why |
|---|---|---|
| AC1 submit step on both templates, id from `memory add`'s JSON | red-first | no such step: `grep -n "'submit'" scripts/e2e-smoke.cjs` finds nothing |
| AC2 `from: draft` / `to: pending` asserted, and a mismatch named | red-first | `commandCheck` checks only exit code and JSON parse |
| AC3 clean-tree check stays last per template | characterization | already true in `smokeTemplate`; pinned before the change |
| AC4 exact ordered step list in the test | red-first | the tightened assertion goes red on today's list, which has no submit |
| AC5 callers unchanged, publish suites green | characterization | `runSmoke`'s signature and `publish-staging.cjs`'s import do not change |
| AC6 module doc corrected | documentation | — |
| AC7 a failing submit is reported, and the runner does not crash | red-first | the dependency between steps is new |
| AC8 the real run | measurement | — |

**Shape chosen: a named capture plus a placeholder argument.** A step may declare `capture: '<name>'`,
and its parsed JSON stdout is then kept under that name. A later step's args may contain
`'{<name>.<field>}'`, which is substituted before spawning. The report label shows the resolved argv,
for example `memory submit task-001-smoke-task --format json`. A step may also declare
`expect: {field: value}`, which is compared against its parsed JSON; the detail names each mismatch as
`got <field>=<value>`. If a placeholder is unresolvable (no capture, or a missing field), the step fails
**before** spawning, with a detail that says so.

Reasons for this shape over the alternative, an `args` function over prior output:
1. `SmokeStep.args` stays `readonly string[]`, so the `.d.cts` only gains two optional fields.
2. `smokeSteps()` stays a static, frozen, printable list. The AC4 test asserts on literal strings,
   `memory submit {task.id} --format json` among them, and a function would make that list opaque.
3. The step list stays data rather than code, which keeps the module doc's determinism claim ("fixed
   step list") true.
