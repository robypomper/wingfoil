---
id: "e2e-smoke-rel-v0.2-plan"
type: plan
title: "E2E smoke — v0.2 (fresh-init + CLI black-box release gate, first run)"
status: active
version: "1.0"
workflow: "e2e-smoke"
phase: "rel-v0.2"
element: "minor-v0.2"
release: "v0.2"
tmpl_version: 260703
---

## Context

`release-cycle.yaml` (v1.1) places an **`e2e-smoke`** phase between `user-docs` and `submit`,
`include: e2e-smoke`. This plan is that phase's execution scaffold for `minor-v0.2`, per `dl-019` and
CLAUDE.md §10 golden rule 7 (no workflow engine exists, so a workflow start produces a plan first).

The phase contract is `docs/self/.wingfoil/workflows/custom/e2e-smoke.yaml`, **version 1.0**,
`element: release`, three phases — all `role: qa`:

| Phase | `actions` | `checks.post` |
|---|---|---|
| `fresh-init` | `cli.run("wingfoil init")` (each supported template) | "exit-code-zero"; "scaffolded dna.yaml/memory.yaml/directives round-trip their own loaders (schema-valid)" |
| `drive-cli` | `cli.run("dna show")`, `cli.run("dna set <key> <value>")`, `cli.run("memory add ...; memory submit ...")`, `cli.run("paths <category>")`, `cli.run("directives list")` | "exit-codes match spec-005-cli-command-contract"; "no schema-invalid artifact produced by any command" |
| `gate` | — | "e2e-smoke-passed (staged: warn until green for a release, then hard-reject)" · `approval: { by_role: approver }` |

It exists to implement **`dl-023-init-cli-e2e-smoke-gate`** (`ready`), whose Decision is a standing
black-box gate that *"would have caught `bug-005` at `release-submit`, not at the last task"* —
`bug-005-init-scaffold-fails-schema-validation` (critical) was found by luck, during a manual README
walkthrough in v0.1's final task.

> **Unlike every other phase of this release, the executable already exists.** `scripts/e2e-smoke.cjs`
> was written by `task-060-publish-pipeline`, and its module doc calls itself *"the executable form of
> `docs/self/.wingfoil/workflows/custom/e2e-smoke.yaml`, reused verbatim as spec-015 §3 stage 3"*. So
> this phase is **not** an authoring job: it is a run, a delta audit against the YAML contract, and
> one approver decision. §3 is that delta, and it is the whole point of this plan.

> **Dogfooding note.** `wingfoil` cannot run a workflow (`workflow list` is the only workflow
> operation in `CORE_MODULES`, and it is read-only). Every step below is performed by hand, and any
> Memory transition is a hand-written commit in the CLAUDE.md §5.1 format.

---

## 1. Preconditions — verify FIRST, stop if unmet

| # | Condition | Command | Expected |
|---|---|---|---|
| P1 | **`user-docs` is complete** — the phase immediately before this one in `release-cycle.yaml` | `awk '/^---$/{n++;next} n==1&&/^status:/' docs/05_plans/rl-v1/rel-v0.2/user-docs-rel-v0.2-plan.md` · then `for p in README.md docs/user-guide.md docs/cli-reference.md docs/examples CHANGELOG.md; do [ -e "$p" ] && echo "PRESENT $p" \|\| echo "MISSING $p"; done` | plan `status: done`; every path that survived that phase's scope decision PRESENT — see note |
| P2 | The release is `in-development` | `awk '/^---$/{n++;next} n==1&&/^status:/' docs/self/docs/04_memory/planning/rl-v1/minor-v0.2.md` | `status: in-development` |
| P3 | Every v0.2 task is `done` | `for f in docs/self/docs/04_memory/v0.2/task-*.md; do awk '/^---$/{n++;next} n==1&&/^status:/{print $2; exit}' "$f"; done \| sort \| uniq -c` | one line: `54 done` |
| P4 | Clean tree, deps installed, `dist/` current | `git status --porcelain` (empty) · `npm ci --prefer-offline --no-audit --no-fund` · `npm run build` | clean; build exits 0 |
| P5 | The smoke's own suite is green before you touch anything | `npx jest test/cli/e2e-smoke.test.ts` | all tests pass |

**On P1.** `user-docs-rel-v0.2-plan.md` records an approver decision (its S3) about how many of the
five `produces:` artifacts v0.2 actually ships — four of them did not exist when that plan was
written. Read that decision before evaluating P1: the condition is *"every path the decision kept
exists"*, not *"all five exist"*. If `user-docs` has not run at all, **stop** — `release-cycle`
orders these two phases, and smoking a release that is not yet assembled proves nothing.

---

## 2. Conventions a fresh session will not know

- **Memory transitions are hand-written commits, in the CLAUDE.md §5.1 format.** Subject
  `wf({type}): {verb} {id1}, {id2}`; `approve`/`reject` additionally carry a `[{old} → {new}]`
  bracket and a body with `Approver: Name <email> (role)` and a `Reason:` block. `submit` commits
  carry **no** bracket (`dl-054`). A `Reason:` may span lines; it may never be blank; no line of it
  may begin `Approver:` or `Reason:`; and it may not end with a paragraph made only of `Key: value`
  lines (`dl-067-reason-trailer-contract`, `ready`). One operation per commit, staging explicit paths
  only — never `git add -A`.
- **Agents hold no approval authority.** The `gate` phase's `approval: { by_role: approver }` routes
  to Roberto, as does any `approve`/`reject` on an element this phase files. Never self-approve.
- **Durable citations name a thing, not an offset (`dl-075`, `ready` — option A composed with B).**
  Cite an exported symbol (`smokeSteps` in `scripts/e2e-smoke.cjs`), a heading, a YAML key path
  (`e2e-smoke.yaml`, the `drive-cli` phase's `actions`), or a verbatim quotation — plus the commit
  read at. Bare `path:line` stays legal only in note-like sections (Execution Notes, bug
  Steps-to-Reproduce, triage notes). Everything measured in this plan was read on `main` at
  **`a2e3586`**.
- **Merge `main`, never rebase (`dl-035`, `ready`).** `git merge --no-edit main` from inside the
  worktree; a branch carrying `wf(*)` commits is never rebased.
- **The evidence rule — the top rejection cause of this release.** Never assert the state of a file
  without running the command that settles it, **and put that command in the note**. Here that means:
  never report "the smoke covers X" without the `smokeSteps` output or the run log that shows it.
- **After merging any dependency change, run `npm ci`.** `test/cli/types-node-floor.test.ts` reads
  the installed `@types/node` and fails against a stale `node_modules`.
- **Role and directives (`roles.yaml`, auto-loaded on execution per P3.6).** All three phases run as
  `qa` → `testing`, plus the global `doc-versioning, documentation, security-secrets`.

---

## 3. The delta — what the smoke does versus what `e2e-smoke.yaml` requires

This is the core of the phase. Measured on `main` at `a2e3586`.

### 3.1 What the smoke exercises today

Read it with `sed -n '/^function smokeSteps/,/^}/p' scripts/e2e-smoke.cjs` and
`grep -n "SMOKE_TEMPLATES" scripts/e2e-smoke.cjs`. `runSmoke` performs, in order, stopping at the
first failure:

1. `wingfoil --help` — exit 0 **and** stdout contains `Usage: wingfoil`.
2. `wingfoil --version` — only when `--expect-version X.Y.Z` is passed; must equal it exactly.
3. For each of `SMOKE_TEMPLATES` = `['Scrum', 'Kanban']` — the full set, since `TEMPLATES` in
   `src/storage/templates.ts` exports exactly `[SCRUM, KANBAN]` — in a fresh `mkdtemp` git repo with
   a fixed throwaway identity:
   `init --template <T>` → `dna show --format json` → `dna set project.name "WingFoil smoke"` →
   `memory add --type task --title "Smoke task" --format json` → `paths config --list --format json`
   → `directives list --format json` → `workflow list --format json`.
4. Per template, finally: `git status --porcelain` must be empty — *"working tree clean after every
   mutation"*, i.e. every mutating command committed its own change.

Each step asserts exit 0 and, where marked `json: true`, that stdout parses as JSON.

### 3.2 The four gaps against the YAML contract

| # | `e2e-smoke.yaml` requires | The smoke does | Verdict |
|---|---|---|---|
| G1 | `drive-cli` action `cli.run("memory add ...; memory submit ...")` | `memory add` only | **MISSING** — this is `bug-029` |
| G2 | `drive-cli` post-check "exit-codes match `spec-005-cli-command-contract`" | asserts exit **0** on happy paths only; never asserts 1 or 2 | **PARTIAL** — the contract has three codes; one is exercised |
| G3 | `drive-cli` post-check "no schema-invalid artifact produced by any command" | proxies it via a clean `git status` plus JSON-parseable stdout; never re-loads a written artifact through its own loader | **PARTIAL** — see the note below, which is why it still has real value |
| G4 | `fresh-init` post-check "scaffolded dna.yaml/**memory.yaml**/directives round-trip their own loaders" | `dna show` loads `dna.yaml`, `directives list` loads the directive files, `memory add` loads `memory.yaml`'s `id_pattern`/`template` — but nothing loads its **state machines** | **PARTIAL, and G1 closes it** — see §3.3 |

On G3: the proxy is weaker than the words, but it is not empty. Each command in the list *reads* the
artifact its predecessors wrote, through the real loader, so a schema-invalid write surfaces as a
non-zero exit on the next step rather than as an explicit validation assertion. That is exactly how
the defect class this gate was built for (`bug-005`, `bug-006`) presents.

### 3.3 G1 — `bug-029`, and the finding that changes its disposition

`bug-029-e2e-smoke-omits-memory-submit` (`open`, severity `low`, `release: ""`) says the smoke omits
`memory submit` and that *"no task, dependency or check owns that addition"*. All of that is
verified — and its **stated blocker is gone**:

- **The verb ships.** `grep -n "memorySubmit" src/core/index.ts` shows it in `CORE_MODULES`
  (`memory.memorySubmit`, `mutates: true`, P1.6, `task-045`), and `node dist/cli.js memory --help`
  lists `submit`.
- **The blocker is closed.** `bug-029`'s Notes say *"Blocked by `bug-030`. Adding `memory submit` to
  the smoke today would fail on both templates: the `memory.yaml` that `wingfoil init` scaffolds
  declares no state machine, so a transition verb throws in a fresh project."*
  `grep -H '^status:\|^release:' docs/self/docs/04_memory/bugs/bug-030-*.md` → **`closed`, `v0.2`**.
- **Measured directly, not inferred.** In a throwaway repo, for **both** templates (recipe in §4):
  `memory submit task-001-smoke-task --format json` exits **0** and prints
  `{"id":"task-001-smoke-task","path":"docs/memory/task/task-001-smoke-task.md","from":"draft","to":"pending"}`;
  `git status --porcelain` is empty afterwards. **The addition is unblocked and demonstrably passes.**
- **It also closes G4.** `memory submit` is the first scaffolded-project command that loads
  `memory.yaml`'s **state machine** — precisely the artifact `bug-030` was about. G1 and G4 are one
  change.

Two implementation notes for whoever makes it:

- **The step list is static.** `smokeSteps(template)` returns a frozen array of `{args}`, and
  `memory submit` needs the id from the previous step's JSON stdout
  (`{"id":"task-001-…","path":"…"}`). The step shape has to grow — a step that derives its args from
  prior output, or a two-stage runner. Whatever shape is chosen must keep `smokeSteps` exported:
  `test/cli/e2e-smoke.test.ts` imports it.
- **The test cannot currently see the omission.** `test/cli/e2e-smoke.test.ts` asserts the step list
  with `expect.arrayContaining([...])`, so neither omitting nor adding `memory submit` changes its
  result. `bug-029`'s suggested fix — tighten it to an exact list — is what makes a future omission
  visible. Do it in the same change.

### 3.4 The staging posture — v0.2 is in **warn**

`e2e-smoke.yaml`'s own description: *"STAGED per the dl-014 B-DECISION (Option 2): warn on failure
until the gate runs green for a release, then flip to hard-reject."* Which stage applies to v0.2:

- `ls docs/05_plans/rl-v1/rel-v0.1/` lists `release-planning`, `dev-loop`, `release-implementation`,
  `release-submit` and `retrospective-and-config-bootstrap` plans — **no `e2e-smoke` plan**. The gate
  was built in the v0.1→v0.2 config bootstrap, after v0.1 shipped. **v0.2 is the first release for
  which this phase runs**, so no release has yet run it green.
- Therefore **v0.2 runs in `warn`: a smoke failure does not block `release-submit`.** It is reported,
  and the failure is filed as a bug.
- The flip to hard-reject is a *later* decision, and it is the approver's (S5). Note that
  `retro-v0.1`'s action *"Record the B-DECISION (docs-gate / smoke-gate staging: warn→hard-reject)
  choice here or on `dl-013`/`dl-023` (owner: approver)"* is **still unchecked** — the staging record
  the workflow files refer to has never been formally written down. Closing that is something this
  phase can finally do.
- **A nuance worth stating precisely, because it is easy to get backwards:** the smoke *script* is
  already green and has been for a while — `test/cli/e2e-smoke.test.ts` runs it against `dist/cli.js`
  on every `npx jest`, and the publish workflow runs it against a staging install
  (`.github/workflows/publish.yml`, the step *"Stage on ephemeral Verdaccio + dl-023 smoke (spec-015
  §3 stages 2–3)"*). What has never happened is the **phase**. "Green for a release" means the gate
  ran as a release gate — not that the script has ever passed.

### 3.5 The phase declares no `produces:` — so its completion cannot be deduced

`grep -n "produces" docs/self/.wingfoil/workflows/custom/e2e-smoke.yaml` returns **nothing**.
`dl-023`'s Actions asked for *"`e2e-smoke.yaml` (`kind: sub`, `element: release`, `produces:` a
smoke-test report)"*; the authored file carries no `produces:` on any of its three phases. Completion
of a non-Memory-backed phase is deduced from the existence of its `produces:` artifacts (CLAUDE.md
§6), so as configured **this phase has nothing from which completion can be deduced** except the
approval itself. Raise it in S5; do not amend a workflow file from inside a gate run.

---

## 4. Steps

### S1 — `fresh-init` · role: qa

- **Action:** `cli.run("wingfoil init")` for each supported template. In practice, run the smoke —
  its first per-template step is exactly this, for both members of `SMOKE_TEMPLATES`:

  ```bash
  npm run build
  node scripts/e2e-smoke.cjs --expect-version "$(node -p "require('./package.json').version")" \
    -- node "$PWD/dist/cli.js"
  ```

  Pass `--expect-version` with whatever `package.json` actually says — `0.1.0` on `a2e3586`, because
  the release bump belongs to `release-publishing`, not to this phase (H6).
- **Produces:** the run log — one `ok  `/`FAIL` line per check on stdout.
- **Check:** every `[Scrum]`/`[Kanban] wingfoil init --template …` line reads `ok`, and the process
  exits 0. Confirm the template set is complete:
  `grep -n "export const TEMPLATES" -A2 src/storage/templates.ts` must name the same two the smoke
  iterates.

### S2 — `drive-cli` · role: qa

- **Action:** the same run — steps 2..7 per template, plus the final clean-tree check.
- **Produces:** the same run log.
- **Check:** all `ok`, exit 0, and `[<T>] working tree clean after every mutation — clean` for both
  templates.
- **And then the part that is not just "run it":** audit the run against §3.2 and record G1–G4 in
  this plan's `## Execution Notes`, each with the command that settles it. A green run is **not** the
  same as a satisfied contract, and reporting the green without the delta is how this gate would
  quietly stop meaning anything.

### S3 — **APPROVER DECISION** — close G1 now, or file it · role: approver

`bug-029` is unblocked and its fix is verified to pass (§3.3). But the change is production code plus
a test tightening, and all 54 v0.2 tasks are `done` — adding it means re-opening `implementation` for
one fix task. Put the choice to the approver and **stop**:

> `bug-029` (`open`, `release: ""`) is no longer blocked: `bug-030` is `closed`, and `memory submit`
> exits 0 on both templates in a freshly-initialised project. Adding the step also closes G4 —
> nothing currently loads the scaffolded `memory.yaml`'s state machine. Do we (a) triage `bug-029`
> into v0.2, file a fix task and run one more dev-loop before `release-submit`; or (b) leave the gate
> as it is for v0.2 — legitimate, since the gate is in `warn` — schedule `bug-029` for v0.3, and
> record that v0.2's smoke ran with a known, measured gap against its own `drive-cli` contract?

Note for the approver: under (b), the gate runs green against a step list that omits a step its own
YAML requires. If the flip to hard-reject (S5.1) is then made on the strength of that run, the gate
is promoted to blocking on a run that did not test what it claims.

- **Check:** the decision is recorded in writing before S5.

### S4 — File what the audit found · role: qa

- **Action:** for each gap not already carried by an element, run the `bug-ingest` workflow — a
  **main** workflow, so it needs its own plan under `docs/05_plans/` per golden rule 7; the two
  `bug-ingest-*-plan.md` files already in this directory are the model. G1 is already `bug-029`; G2,
  G3 and the §3.5 `produces:` omission appear to be carried by no element — check before filing:
  `grep -rln "exit-codes match spec-005\|e2e-smoke" docs/self/docs/04_memory/bugs/`.
- **Produces:** bug and/or decision-log elements at `draft → …`, per the §5.1 commit format.
- **Check:** every gap in §3.2 is fixed, filed, or explicitly waived in writing. Per the standing rule
  of this release, **a finding left only in Execution Notes is not filed** — nothing reschedules a
  completed phase's notes.

### S5 — `gate` · role: qa, then approver

- **Action:** report the smoke result together with the §3 delta. Per §3.4, v0.2 runs in **warn**: a
  failure is reported and filed, and does **not** block `release-submit`. Say that explicitly in the
  report rather than leaving the reader to infer the posture.
- **The approver then decides three things**, and an agent decides none of them:
  1. Whether v0.2's run counts as "green for a release", flipping the gate to **hard-reject** for
     v0.3 — bearing in mind S3's note if option (b) was taken.
  2. Whether to finally write the `retro-v0.1` B-DECISION staging record (§3.4), and where —
     `dl-013`, `dl-023`, or `retro-v0.1` itself.
  3. Whether `e2e-smoke.yaml` gains a `produces:` so the phase's completion becomes deducible (§3.5),
     and whether that edit rides with the `dl-025` amendment already queued for the same directory in
     v0.3.
- **Check:** `approval: { by_role: approver }` is satisfied. Agents never self-approve.

### Throwaway-project probe recipe

Useful for S3's verification, for `user-docs`' transcript checks, and for reproducing anything in §3
by hand. Same shape as `smokeTemplate`, minus the assertions:

```bash
WT=$PWD                      # the repo/worktree root, with dist/ built
R=$(mktemp -d /tmp/wf-probe-XXXX); cd "$R"
git init --quiet --initial-branch=main
git config user.name "Probe"; git config user.email "probe@wingfoil.invalid"
git config commit.gpgsign false
node "$WT/dist/cli.js" init --template Scrum          # or Kanban
node "$WT/dist/cli.js" memory add --type task --title "Smoke task" --format json
node "$WT/dist/cli.js" memory submit task-001-smoke-task --format json
git status --porcelain                                 # must be empty
cd "$WT"; rm -rf "$R"
```

Ids restart per type in a fresh project, so the first `task` added is always `task-001-<slug>`.

---

## 5. Gates — the six this repository runs

```bash
npx jest                                   # 109 suites / 1754 tests green on main at a2e3586
npx jest --coverage                        # >=80% — enforced by jest.config.js coverageThreshold.global
npx tsc -p tsconfig.build.json --noEmit    # 0 errors
npx tsc --noEmit -p tsconfig.json          # 0 errors — NO EXCEPTION (bug-026, closed)
npm run lint                               # eslint . — 0 errors
npm run docs:api                           # typedoc: treatWarningsAsErrors + validation.notDocumented
```

All six measured green on `main` at `a2e3586`. The coverage threshold is enforced *by* jest
(`coverageThreshold.global` = 80 for branches/functions/lines/statements), so `npx jest --coverage`
exiting 0 **is** the ≥80% gate — there is no separate number to read off. `npm run docs:api` has
`emit: "none"` in `typedoc.json`, so it writes nothing and leaves the tree clean.

If S3 takes option (a), the six run as the fix task's own `refactor`/`review` gates; under option (b)
run them anyway, to confirm this phase changed nothing.

---

## 6. Known hazards

- **H1 — `scripts/e2e-smoke.cjs` is load-bearing for publishing.** Its module doc: *"reused verbatim
  as spec-015 §3 stage 3"*, and `.github/workflows/publish.yml` runs it against a Verdaccio staging
  install; `spec-015` states that a failed staging smoke blocks promotion. **Any** edit to this
  script changes the publish pipeline's gate — verify with `npx jest test/cli/e2e-smoke.test.ts`
  **and** by reading the publish workflow's smoke step before and after.
- **H2 — `memory approve` and `memory reject` cannot be added to the smoke as exit-0 steps.**
  Verified with the §4 recipe against `dist/cli.js` at `a2e3586`: both exit **1** with
  `user not authorized to approve type 'task'`, because a scaffolded `dna.yaml` binds no approver
  identity (REQ-SEC-03, working as designed). If G2's exit-code coverage is ever widened, these are
  the natural exit-1 cases — as *expected* failures, never as happy paths.
- **H3 — `memory history` writes `fatal:` to stderr on a *successful* run.** Same probe: exit 0,
  correct JSON, and git writes `fatal: path '…' exists on disk, but not in '<sha>'` to stderr. That
  is `bug-071-read-status-at-leaks-git-stderr` (`open`). `commandCheck` reads stderr only on a
  non-zero exit, so the smoke is unaffected today — but any future "no stderr on success" assertion
  breaks on it. Do not fix `bug-071` from this phase.
- **H4 — `directive remove` refuses while the directive is assigned**
  (`cannot remove 'probe-rule': still assigned to role 'developer'`, exit 1 — correct REQ-SEC-07
  behaviour, not a defect). A smoke step for it would have to unassign first.
- **H5 — the smoke stops at the first failure.** `runSmoke` returns as soon as a check fails, so a
  failing run reports **one** problem, not all of them. Re-run after each fix; never read a short log
  as "only one thing is wrong".
- **H6 — do not bump `package.json`'s version to make `--expect-version` read `0.2.0`.** The bump is
  `release-publishing`'s (`adr-009`, `spec-015`). Pass whatever the manifest actually says.
- **H7 — `npm ci` after any dependency change**, or `test/cli/types-node-floor.test.ts` fails on a
  stale `node_modules` with a failure that looks unrelated to the smoke.
- **H8 — this phase is a gate, not a workshop.** Changing `scripts/e2e-smoke.cjs`, `e2e-smoke.yaml`
  or `test/cli/e2e-smoke.test.ts` is `dev-loop` work behind a task, not something a qa gate run does
  inline. S3 exists so that choice is made deliberately.

---

## 7. Handoff — who decides what, and when this phase is complete

**The approver (Roberto) decides:**

1. S3 — whether `bug-029`/G1 is triaged into v0.2 and fixed before `release-submit`, or scheduled for
   v0.3 with the gap recorded.
2. S5.1 — whether v0.2's run counts as "green for a release" and the gate flips to hard-reject.
3. S5.2 — where the `retro-v0.1` warn→reject staging record is finally written.
4. S5.3 — whether `e2e-smoke.yaml` gains a `produces:` (§3.5).
5. The `gate` phase approval itself.

**The agent does:** S1, S2 (including the §3.2 delta audit), S4, and the §5 gates — writing the run
log and the audit into this plan's `## Execution Notes`.

**Completion criteria.** Phase completion is *deduced*, not stored:

- `node scripts/e2e-smoke.cjs … -- node "$PWD/dist/cli.js"` exits 0, with an `ok` line for every
  check on both templates, the clean-tree check included.
- The §3.2 delta (G1–G4) is audited and recorded, and each gap is fixed, filed as an element, or
  waived in writing — not left in a note.
- The staging posture for v0.2 is stated explicitly in the report: **warn**, not blocking.
- The six gates in §5 are green.
- The approver has approved the `gate` phase.
- This plan moves `active → done`. `plan`'s `active` is a `waiting:` state in `memory.yaml`, with no
  CLI verb, so write the transition by hand
  (`wf(plan): finalize e2e-smoke-rel-v0.2-plan [active → done]`).

On completion, `release-cycle` advances to **`submit`** (`release-submit`), whose own `checks.pre`
re-verifies that every v0.2 task is `done`, every v0.2 bug is `resolved`/`closed`, and the suite is
green at ≥80% coverage.
