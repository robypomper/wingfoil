---
id: "user-docs-rel-v0.2-plan"
type: plan
title: "User-docs — v0.2 (align user-facing documentation to the shipped surface)"
status: done
version: "1.4"
workflow: "user-docs"
phase: "rel-v0.2"
element: "minor-v0.2"
release: "v0.2"
tmpl_version: 260703
---

## Context

`release-cycle.yaml` (v1.1) places a **`user-docs`** phase between `implementation` and `submit`,
`include: user-docs`. This plan is that phase's execution scaffold for `minor-v0.2`, per `dl-019`
(a phase plan is itself a `plan` Memory element) and CLAUDE.md §10 golden rule 7 (no workflow engine
exists, so a workflow start produces a plan first).

The phase contract is `docs/self/.wingfoil/workflows/custom/user-docs.yaml`, **version 1.0**,
`element: release`, two phases:

| Phase | Role | Contract |
|---|---|---|
| `check-implementation-complete` | tech-lead | `checks.pre`: "all tasks where tags=[{release.version}] are status: done" |
| `align-user-docs` | developer | `produces:` `README.md`, `docs/user-guide.md`, `docs/cli-reference.md`, `docs/examples/`, `CHANGELOG.md` · `checks.post`: "user-facing docs aligned with the release's shipped CLI/feature surface" · `approval: { by_role: approver }` |

It exists to implement **`dl-013-documentation-process-gate`** (`ready`), whose Decision adds the
phase so that user-facing documentation is *"a hard release blocker … instead of a convention nobody
checks"*, and whose rule is also written into the global `documentation` custom directive under the
heading **User-facing docs before release (`dl-013`)**.

> **This gate has never run.** `docs/05_plans/rl-v1/rel-v0.1/` contains `release-planning`,
> `dev-loop`, `release-implementation`, `release-submit` and `retrospective-and-config-bootstrap`
> plans — and no `user-docs` plan; `dl-013` was implemented out-of-flow in the v0.1→v0.2 config
> bootstrap, *after* v0.1 shipped. **v0.2 is the first release this phase runs for**, so expect a
> large delta rather than a touch-up, and do not look for a prior run to imitate.

> **Dogfooding note.** `wingfoil` has no workflow engine (`workflow list` is the only workflow
> operation in `CORE_MODULES`, and it is read-only). Every phase step below is performed by hand, and
> every Memory transition is a hand-written commit in the CLAUDE.md §5.1 format. The *Memory
> transition verbs themselves do ship* in this release (`memory submit|approve|reject|deprecate|
> history`) — but they operate on a project's own `.wingfoil/`, and this repository's dogfood config
> lives under `docs/self/.wingfoil/` with no root `.wingfoil/`, so they cannot be pointed at these
> documents. Write the commits by hand.

---

## 1. Preconditions — verify FIRST, stop if unmet

Run each command. Do not start S1 until every row is satisfied or explicitly waived by the approver.

| # | Condition | Command | Expected |
|---|---|---|---|
| P1 | The release is `in-development` | `awk '/^---$/{n++;next} n==1&&/^status:/' docs/self/docs/04_memory/planning/rl-v1/minor-v0.2.md` | `status: in-development` |
| P2 | Every v0.2 task is `done` (the phase's own `checks.pre`) | `for f in docs/self/docs/04_memory/v0.2/task-*.md; do awk '/^---$/{n++;next} n==1&&/^status:/{print $2; exit}' "$f"; done \| sort \| uniq -c` | one line: `54 done` |
| P3 | No v0.2 bug is still open — *informational*: it is `release-submit`'s pre-check, not this phase's, but a failure means the next-but-one phase will block | `for f in docs/self/docs/04_memory/bugs/*.md; do awk -v F="$f" '/^---$/{n++;next} n==1&&/^status:/{s=$2} n==1&&/^release:/{r=$2} n==2{if(r=="\"v0.2\"" && s!="closed" && s!="resolved") print F": "s; exit}' "$f"; done` | no output |
| P4 | Clean tree, on this phase's branch, deps installed | `git status --porcelain` (empty) · `git rev-parse --abbrev-ref HEAD` · `npm ci --prefer-offline --no-audit --no-fund` | see §2 |
| P5 | The `adr-010` cascade above this gate has moved — **satisfied, re-verify rather than assume** | `grep -n "Correction (2026-09-21)" docs/self/docs/04_memory/design/dls/dl-001-typescript-over-python.md` | one hit — see below |

**P5 was recorded as a blocker in this plan's first draft; it is not one.** That draft measured only
whether the string "Node.js 18" still appears in `dl-001-typescript-over-python` and concluded that
`adr-010`'s cascade item 3 had not moved. It has. `dl-001` carries a dated
**Correction (2026-09-21)** stating in full: *"Wherever this document says 'Node.js 18+' — the
Decision sentence above, and the closing `dna.yaml` quotation — read Node.js 22.12+."* That is
precisely the remedy `adr-010`'s item 3 prescribes, in its own words: *"Amend or deprecate; ...
amendment-with-a-dated-note is the established alternative (`dl-047`)."*

The original Decision sentence is deliberately left intact beneath the note, because rewriting a
`ready` decision-log's ruling would edit the record rather than extend it — which is why a grep for
the string is the wrong check and the presence of the Correction is the right one.

So **the whole `adr-010` cascade above this gate is discharged**: item 2 (the product brief's
*Language & Runtime* line) reads `22.12+`, item 3 is corrected as above, item 4 (`dna.yaml`
`stacks.technologies`) reads `22.12+`, item 6 (`CLAUDE.md` §1 and §4) reads `22.12+`. Item 5 —
`README.md`'s install line — is this gate's own work and nothing is ordered ahead of it.

**If P5 fails** — the Correction note is absent, or a later edit has removed it — **stop and report.**
Do not edit `dl-001` yourself: it is a `ready` decision-log and agents hold no approval authority.
Do not edit the README ahead of it either. Ask the approver to settle item 3 before proceeding.

---

## 2. Conventions a fresh session will not know

- **Memory transitions are hand-written commits, in the CLAUDE.md §5.1 format.** Subject
  `wf({type}): {verb} {id1}, {id2}`; `approve`/`reject` additionally carry a `[{old} → {new}]`
  bracket and a body with `Approver: Name <email> (role)` and a `Reason:` block. `submit` commits
  carry **no** bracket (`dl-054`). A `Reason:` may span lines; it may never be blank; no line of it
  may begin `Approver:` or `Reason:`; and it may not end with a paragraph made only of `Key: value`
  lines (`dl-067-reason-trailer-contract`, `ready`). One operation per commit, staging explicit paths
  only — never `git add -A`.
- **Agents hold no approval authority.** Every `approve`/`reject` — including this phase's
  `align-user-docs` approval gate — routes to the `approver` role (Roberto). Never self-approve, and
  never move a `ready`/`accepted` element yourself.
- **Durable citations name a thing, not an offset (`dl-075`, `ready` — option A composed with B).**
  In this plan, in the docs you write, and in Memory documents generally, cite an exported symbol, a
  heading, a YAML key path, or a verbatim quotation — plus the commit you read it at when the claim
  concerns a state that may legitimately move. Bare `path:line` stays legal only in note-like
  sections (Execution Notes, bug Steps-to-Reproduce, triage notes). Everything measured in this plan
  was read on `main` at **`a2e3586`**.
- **Merge `main`, never rebase (`dl-035`, `ready`).** A branch carrying `wf(*)` commits is never
  rebased; sync with `git merge --no-edit main` from inside the worktree.
- **The evidence rule — the top rejection cause of this release.** Never assert the state of a file
  without running the command that settles it, **and put that command in the note**. Several v0.2
  task rejections trace to notes claiming a file was done, undone or covered without opening it. It
  applies to every "the README already says X" sentence you will be tempted to write.
- **After merging any dependency change, run `npm ci`.** `test/cli/types-node-floor.test.ts` reads
  the installed `@types/node` and fails against a stale `node_modules`, with a failure that looks
  unrelated to documentation.
- **Do not bump `package.json`'s `version`.** It is `0.1.0` on `main` at `a2e3586`
  (`grep -n '"version"' package.json`). The bump belongs to `release-publishing` (`adr-009`,
  `spec-015`), not to this gate. Write the CHANGELOG's v0.2 heading; leave the manifest alone.
- **Roles and their directives (`roles.yaml`, auto-loaded on execution per P3.6).**
  `check-implementation-complete` → tech-lead → `architecture, code-review`. `align-user-docs` →
  developer → `code-quality, testing, determinism, command-baseline`. Global for both:
  `doc-versioning, documentation, security-secrets, claim-evidence`. `doc-versioning` means: bump a
  doc's `version` only on its **first** edit after it is committed, and update its date when you
  bump. `command-baseline` and `claim-evidence` were added to `roles.yaml` (v1.1) by `task-094`
  (`dl-080` Action 4) after this plan was written; `claim-evidence` is the one that bites here — a
  user-facing sentence asserting what the tool does names the command that establishes it.

---

## 3. What the shipped surface actually is (measured)

The phase's post-check is *"user-facing docs aligned with the release's shipped CLI/feature
surface"*, so establish the surface before writing a word. `CORE_MODULES` in `src/core/index.ts` is
authoritative; both interface registrars derive from it (`buildCliCommands` in
`src/cli/registrar.ts`, `deriveMcpToolName` in `src/mcp/registrar.ts`).

Re-measure with:

```bash
npm run build
node dist/cli.js --help
for g in directive directives dna memory paths workflow; do
  echo "--- $g ---"; node dist/cli.js "$g" --help | sed -n '/Commands:/,$p'
done
```

Measured on `main` at `a2e3586` — **17 commands**:

```
init              mcp
dna show          dna set
memory add        memory search     memory history
memory submit     memory approve    memory reject      memory deprecate
directive create  directive assign  directive remove
directives list
paths
workflow list
```

`README.md`'s **CLI commands (v0.1)** block lists **7**: `init`, `dna show`, `dna set`, `memory add`,
`memory search`, `paths`, `mcp`. **Ten shipped commands are undocumented** — the five Memory
transition/history verbs (P1.6–P1.10), the whole Directives surface (P3.1–P3.4), and `workflow list`.
The same block asserts *"`directive`/`workflow` CLI verbs beyond config inspection land in
v0.2/v0.3"*, which the measurement above contradicts for `directive`.

Two further surface facts the README states and the code contradicts:

- The README's *For AI Agents (MCP Server)* section describes the MCP surface as Resources only.
  `node dist/cli.js --help` on `a2e3586` describes `mcp` as *"start the WingFoil MCP server
  (read-only Resources and role Prompts) over stdio"* — MCP Prompts (P5.2.2) ship in v0.2 and appear
  in `minor-v0.2`'s `features:` list.
- The README's pillar list marks **Project Directives** *"(planned, v0.2)"*. It is the pillar this
  release delivers, and `wingfoil directives list` in a freshly-initialised project returns the six
  P3.8 **built-in** templates installed by `init` (`task-057`) — verified by the probe recipe
  under §4 (*Throwaway-project probe recipe*) of the sibling plan `e2e-smoke-rel-v0.2-plan.md`.

---

## 4. The three findings that shape this phase

### 4.1 Four of the five `produces:` artifacts do not exist — the phase's central problem

```bash
for p in README.md docs/user-guide.md docs/cli-reference.md docs/examples CHANGELOG.md; do
  [ -e "$p" ] && echo "PRESENT  $p" || echo "MISSING  $p"
done
```

On `main` at `a2e3586`: `README.md` **PRESENT**; `docs/user-guide.md`, `docs/cli-reference.md`,
`docs/examples/` and `CHANGELOG.md` all **MISSING**. `ls docs/` returns `01_vision 02_requirements
03_backlog 05_plans design.md self` — every entry an internal engineering artifact, none of them a
user-facing document.

`dl-013`'s Decision names the same five artifacts, so this is not a drafting slip in the YAML. The
gate as configured asks v0.2 to **create four documents from nothing**, in a phase whose `produces:`
reads as though they existed and merely needed aligning. That is not an agent's call to make
silently: it is either (a) a genuine four-document authoring job inside this gate, or (b) a
`produces:` list written aspirationally that should be narrowed by amending `user-docs.yaml`. **See
S3 — the approver decides, and the phase stops there until they have.**

### 4.2 The README's stale claims (sweep, not guess)

```bash
grep -rnE 'Node(\.js)? ?1[0-9]|18\+' README.md COLLABORATION.md docs/design.md docs/01_vision/
grep -nE 'v0\.1|In Dev|targeting|planned, v0\.' README.md
```

Measured on `main` at `a2e3586`, in `README.md`:

| Where | What it says | Truth |
|---|---|---|
| *Installation*, the sentence after `npm install -g wingfoil` | "This installs the `wingfoil` binary (Node.js 18+ required)." | `package.json` `engines.node` is `">=22.12.0"`; `adr-010` (accepted) sets the floor at 22.12. **Assigned to this gate by name** (`adr-010` Actions item 5). |
| *Key Features* heading | "Five Pillars — v0.1 status" | v0.1 is `released`; v0.2 is the release being assembled |
| *Key Features* bullet | "**Project Directives** — role-scoped rules (planned, v0.2)" | shipped in this release (P3.1–P3.8) |
| *CLI commands (v0.1)* block | 7 commands; "`directive`/`workflow` CLI verbs … land in v0.2/v0.3" | 17 ship (§3) |
| *For AI Agents (MCP Server)* bullets | "read-only Resources" | Resources **and role Prompts** (P5.2.2) |
| *Getting Started* note | "in active development (MVP, targeting v0.1 in July 2026)" | v0.1 is released |
| *Release Roadmap* table, **v0.1** row | `🔄 In Dev` | `released`; v0.2 is the in-development row |
| *What Comes Later* → **v0.2+** | semantic search, automated validation, IDE integrations beyond MCP, notification routing, multi-project | none of these is what v0.2 delivered |

The Node-floor sweep finds **exactly one** occurrence outside Memory: the README's install sentence.
`docs/01_vision/01_product-brief.md`, `docs/self/.wingfoil/dna.yaml` and `CLAUDE.md` already read
`22.12+`. The only other `18+` left anywhere in the cascade is `dl-001`'s — P5, the approver's.

### 4.3 What is *adjacent* and deliberately **out of scope**

Read these before you are tempted to fix them. Each is measured; each falls outside this phase's
`produces:`.

- **`bug-008-claude-md-stale-project-status` — CLOSED.**
  `grep -H '^status:\|^release:' docs/self/docs/04_memory/bugs/bug-008-*.md` → `closed`, `v0.2`;
  `task-068-fix-claude-md-project-status` is `done`. There is nothing here to fix. (If an index or
  summary tells you it is open, believe the file.)
- **`dl-025-agent-facing-docs-ownership` — `ready`, but NOT yet in the config.** Its approve commit
  (`git log --grep="approve dl-025" --format=%B -1`) ratifies **shape (B)**: a sibling
  `align-agent-docs` phase in `user-docs.yaml`, `role: architect`, plus a YES on re-aligning agent
  docs at release-line close. `user-docs.yaml` on `a2e3586` is still `version: 1.0` with two phases
  and no such sibling, because `dl-025`'s own Actions defer the amendment to *"the next
  `release-planning` → `build-backlog`"* — i.e. v0.3. **Therefore `CLAUDE.md` and
  `docs/self/.wingfoil/README.md` are not in this run's `produces:` and are not this phase's work.**
  Do not add them.
- **`bug-040-builtin-directive-docs-stale-after-task-057` — `open`, `release: ""`, and its trigger
  has fired** (`task-057` is `done`, as are all 54 v0.2 tasks). Its targets are
  `spec-011-storage-layout`, `docs/self/.wingfoil/roles.yaml`, the six P3.8 stand-ins under
  `docs/self/.wingfoil/directives/custom/`, and `CLAUDE.md` §3. **None is a user-facing document** —
  no `produces:` in this or any other phase covers them, which is exactly why the bug carries no
  `release`. **Out of scope.** One consequence *is* in scope: whatever you write about directives in
  the user docs must describe the built-in templates as **shipped and installed by `init`**, so this
  phase does not manufacture one more copy of the stale claim.
- **`bug-068-spec-015-names-a-bare-readme-offset-in-durable-prose` — `open`.** It concerns
  `spec-015`'s prose citing the README by line offset, not the README itself; a tech-spec is not
  user-facing. Out of scope — but note that when S4 rewrites the install sentence, `spec-015`'s three
  citations of it go stale in the same change. Report that to the approver rather than editing an
  `approved` spec.

---

## 5. Steps

Each step names its role, its action, what it produces, and the check that settles it.

### S1 — `check-implementation-complete` · role: tech-lead

- **Action:** run P2 (and P3, informationally) from §1 verbatim.
- **Produces:** nothing on disk; the phase's `checks.pre` is satisfied or it is not.
- **Check:** the P2 command prints `54 done` and nothing else.
- **Stop condition:** any task not `done` → this phase has not started; return to `implementation`.

### S2 — Survey · role: developer

- **Action:** re-run every command in §3 and §4 against the current `main` and record the results. Do
  **not** carry §3/§4's numbers forward as fact — they were read at `a2e3586` and this plan may be
  executed later. The evidence rule (§2) applies: each row you record carries the command that
  produced it.
- **Produces:** the survey, written into this plan's `## Execution Notes` (add the section at the end
  of this file — a plan is a Memory element, and that is where its running log belongs).
- **Check:** every `produces:` path has a PRESENT/MISSING verdict, and the CLI-surface diff (shipped
  vs documented) is enumerated command by command.

### S3 — **APPROVER DECISION** — the scope of `produces:` · role: approver

The finding in §4.1 is a decision, not a task. Put it to the approver and **stop**:

> Four of the five artifacts `user-docs.yaml` `produces:` do not exist. Does v0.2's `user-docs` gate
> (a) author `docs/user-guide.md`, `docs/cli-reference.md`, `docs/examples/` and `CHANGELOG.md` now;
> (b) author a subset now and amend `user-docs.yaml`'s `produces:` for the rest; or (c) narrow
> `produces:` to what v0.2 will actually ship and carry the remainder as v0.3 scope?

Cost the choice for them: (c) amends a workflow file and therefore touches the `dl-013` contract, and
`dl-025` has **already** queued an amendment to that same file for v0.3 — the two edits can share one
task. (a) is the only option under which this release's post-check can be read literally.

- **Produces:** the decision, in writing. If it amends `user-docs.yaml`, that is a config change with
  its own owner and its own `version:` bump citing the DL — not something this phase does in passing.
- **Check:** the decision exists before S6 runs. S4 and S5 do not depend on it.

### S4 — Align `README.md` · role: developer

Unambiguous regardless of S3: the README exists and is wrong. Work the §4.2 table row by row.

- **Action:** correct the Node floor (P5 must be clear first); restate the pillar list so Project
  Directives reads as shipped; replace the *CLI commands (v0.1)* block with the full 17-command
  surface measured in §3; correct the MCP bullets to Resources **and role Prompts**; retire the
  "targeting v0.1 in July 2026" note; update the *Release Roadmap* table's v0.1 and v0.2 rows; and
  rewrite *What Comes Later* → **v0.2+** so it no longer promises as future what this release shipped.
- **Produces:** `README.md`.
- **Check — and it must be a real one:** every command the README shows is executed against a
  freshly-initialised throwaway project and its output pasted from a real run. The README's Quick
  Start is a transcript, and `task-032`'s manual verification of exactly that walkthrough is how
  `bug-005` was found at all — that history is the whole reason `dl-023` exists. Reuse the
  throwaway-project harness under §4 (*Throwaway-project probe recipe*) of
  `e2e-smoke-rel-v0.2-plan.md`. Two commands will **not** exit 0
  in a fresh project — see hazard H3.
- **Check:** `grep -nE 'Node(\.js)? ?1[0-9]|18\+' README.md` → empty; the README's command block and
  `node dist/cli.js --help` agree command for command.

### S5 — Author `CHANGELOG.md` · role: developer

The cheapest of the four missing artifacts and the one with the clearest source of truth, so it
proceeds independently of S3.

- **Action:** a Keep-a-Changelog-shaped file with a `v0.2` section derived from the 54 task documents
  (`for f in docs/self/docs/04_memory/v0.2/task-*.md; do awk '/^---$/{n++;next} n==1&&/^title:/' "$f"; done`)
  grouped by pillar/feature, plus a `v0.1` section for the already-released line. Do **not** date the
  v0.2 entry from a wall clock — determinism, REQ-SYS-07 — either use the date `release-publishing`
  sets or leave the heading unreleased.
- **Produces:** `CHANGELOG.md`.
- **Check:** every v0.2 entry traces to a `done` task id or a closed bug id, and no entry describes
  something `node dist/cli.js --help` cannot do.

### S6 — `docs/user-guide.md`, `docs/cli-reference.md`, `docs/examples/` · role: developer

- **Gated on S3.** If the approver chose (a), or a subset under (b), author them: the CLI reference's
  sources of truth are `CORE_MODULES`, `spec-008-cli-grammar` (argument shapes — the bare-`<id>`
  positional rule, `--reason` requiredness) and `spec-005-cli-command-contract` (exit codes 0/1/2).
  If the approver chose (c), record the narrowing and skip.
- **Produces:** whichever of the three the decision keeps.
- **Check:** every documented exit code is demonstrated by a real invocation, not asserted.

### S7 — Gates · role: developer

Run all six (§6). A documentation-only change is not exempt: `npm run lint` and `npm run docs:api`
both walk the tree, and a README code fence is not exempt from being true.

### S8 — Approval · role: approver

`align-user-docs` carries `approval: { by_role: approver }`. Assemble the evidence (the S2 survey,
the S4/S5/S6 diffs, six green gates), request approval, and **stop**. Agents never self-approve.

---

## 6. Gates — the six this repository runs

From the repository root, all of them, before requesting approval in S8:

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

---

## 7. Known hazards

- **H1 — P5 is a real block, not a formality.** The one remaining `Node.js 18+` in the `adr-010`
  cascade is in `dl-001`, a `ready` decision-log the approver owns. An agent that "just fixes the
  README" has inverted the ordering `adr-010` states in prose. Stop and report.
- **H2 — the `documentation` directive you load is itself stale.** `align-user-docs` runs as
  `developer`, which auto-loads the global `documentation` directive
  (`docs/self/.wingfoil/directives/custom/documentation.md`), whose stand-in note opens *"WingFoil's
  official built-in P3.8 templates are not yet implemented"*. That sentence is false since `task-057`
  merged, and it is `bug-040`'s item 2 — **out of scope to fix here** (§4.3), but do not copy it into
  the docs you write.
- **H3 — two shipped commands do not exit 0 in a freshly-initialised project.** Verified against
  `dist/cli.js` built at `a2e3586`, in a throwaway repo after `wingfoil init --template Scrum`:
  `memory approve <id> --reason "…"` and `memory reject <id> --reason "…"` both exit **1** with
  `user not authorized to approve type 'task'` — the scaffolded `dna.yaml` binds no approver identity
  (REQ-SEC-03, working as designed). If the README or CLI reference shows a transcript for either, it
  must show the authorization setup or the real error; never a fabricated success.
- **H4 — `memory history` prints `fatal:` on a *successful* run.** Same probe: `memory history <id>`
  exits 0 and returns correct JSON while git writes `fatal: path '…' exists on disk, but not in
  '<sha>'` to stderr. That is `bug-071-read-status-at-leaks-git-stderr` (`open`, `release: ""`). A
  documented transcript must not hide it, and no example may claim clean output. Do not fix the bug
  from this phase.
- **H5 — `directive remove` refuses while the directive is assigned.** The same probe returns exit 1,
  `cannot remove 'probe-rule': still assigned to role 'developer'` — correct REQ-SEC-07 behaviour, not
  a defect. A removal example must unassign first or document the refusal.
- **H6 — do not touch `package.json`'s version.** §2. A `wingfoil --version` transcript will show
  `0.1.0` until `release-publishing` runs; say so rather than pre-writing `0.2.0`.
- **H7 — `docs/` is not a user-facing directory today.** Adding `docs/user-guide.md` and
  `docs/cli-reference.md` places user documentation alongside `docs/01_vision/`,
  `docs/02_requirements/`, `docs/03_backlog/` and `docs/05_plans/` — four internal trees. Whether
  that placement is right is part of the S3 decision, and `spec-011-storage-layout` is the document
  that would have to say so.
- **H8 — `npm ci` after any dependency change.** §2.

---

## 8. Handoff — who decides what, and when this phase is complete

**The approver (Roberto) decides:**

1. ~~P5 — whether `dl-001`'s runtime clause moves first~~ — **settled: already done.** The cascade
   item was discharged by a dated Correction on 2026-09-21; see §1. Nothing is ordered ahead of the
   README edit.
2. ~~S3 — the scope of `produces:`~~ — **decided 2026-09-22: author all four missing artifacts.**
   `docs/user-guide.md`, `docs/cli-reference.md`, `docs/examples/` and `CHANGELOG.md` are written in
   this phase; the gate is not narrowed. See §9.
3. S8 — the `align-user-docs` approval itself. **Still the approver's.**
4. Whether the `spec-015` citation fallout of S4 (§4.3, `bug-068`) is handled now or left filed.
   **Still open.**

**The agent does:** S1, S2, S4, S5, S7 — and S6 once S3 is decided — writing the running log into
this plan's `## Execution Notes`.

**Completion criteria.** Phase completion is *deduced*, not stored — there is no `status:` on a
workflow phase:

- `check-implementation-complete`'s `checks.pre` is satisfied (P2 prints `54 done`).
- Every path in `user-docs.yaml`'s `produces:` that survives the S3 decision exists on disk, and each
  agrees command-for-command with `node dist/cli.js --help` and the group-level `--help` output.
- `grep -rnE 'Node(\.js)? ?1[0-9]|18\+' README.md` returns nothing.
- The six gates in §6 are green.
- The approver has approved `align-user-docs`.
- This plan moves `active → done`. `plan`'s `active` is a `waiting:` state in `memory.yaml` — it
  advances when the phase's `produces:`/`checks` are satisfied and there is no CLI verb for it, so
  write the transition by hand, following the v0.2 precedent
  (`wf(plan): finalize user-docs-rel-v0.2-plan [active → done]`).

On completion, `release-cycle` advances to **`e2e-smoke`** (`e2e-smoke-rel-v0.2-plan.md`), which
names this phase's completion as one of its own preconditions.

---

## 9. Approver decisions of 2026-09-22 — recorded here because this plan is executed by a later session

Given in chat and binding on this phase:

- **Scope of `produces:` — author all four missing artifacts.** `docs/user-guide.md`,
  `docs/cli-reference.md`, `docs/examples/` and `CHANGELOG.md` are created in this phase, alongside
  the `README.md` corrections. The gate is **not** narrowed and `user-docs.yaml`'s `produces:` list
  stands as written. This is the single largest piece of work in the phase and it should be planned
  as such rather than treated as a tail of the README edit.
- **`CLAUDE.md` comes into scope.** `dl-025-agent-facing-docs-ownership` (`ready`) decided that the
  `dl-013` gate owns agent-facing documentation; its amendment to `user-docs.yaml` is being made now
  rather than deferred, so this phase also owns `CLAUDE.md`. That brings
  `bug-074-claude-md-declares-memory-verbs-unimplemented` — three passages declaring the Memory
  transition verbs unbuilt when all seven ship — inside this phase's work.
- **The release version is `0.2.0`**, which the `CHANGELOG.md` written here must use. Note the
  version bump in `package.json` itself belongs to `release-publishing`, not to this phase.
- **Open bugs carrying no `release` are authorised to the next release.** They are not this phase's
  concern; do not schedule or fix them here.

What is still the approver's, and must not be assumed: the `align-user-docs` approval, and whether
`bug-068`'s `spec-015` citation fallout is handled now.

---

## 10. Approver decisions of 2026-09-25 — `docs/agents.md`

Given in chat and binding on this phase:

- **A new user-facing document for agents, `docs/agents.md`, is written in this phase.** Its reader
  is an AI agent operating inside a *user's* project that has been handed the GitHub link: it must
  learn from it what WingFoil is for, how it is configured and how to operate it. It is an
  alternative, backup and reinforcement to the MCP server shipped with WingFoil.
- **It is in no phase's `produces:`.** `user-docs.yaml` is **not** amended for it (it stays v1.1),
  and neither `align-user-docs`' nor `align-agent-docs`' post-checks cover it. It is written here
  because this is when the surface it describes is final, not because a gate owns it.
- **Its path is `docs/agents.md`, not a root `AGENTS.md`.** A root `AGENTS.md` is auto-loaded by
  several coding agents working *on* this repository, which would hand contributor agents
  user-facing instructions; `CLAUDE.md` remains the contributor-agent entry point.
- **It is not shipped in the npm package.** `package.json` `files` is left as it is
  (`dist`, `README.md`).
- **Future, not scheduled:** including `docs/agents.md` by default in the prompts that start agents.
  Nothing in this phase acts on it.

---

## 11. Content definition of the documents (agreed 2026-09-25)

What each document contains. S2's survey re-measures the surface these outlines rest on; note that
the shipped surface is already **20 commands**, not §3's 17 — `task-093` added `dna add`,
`dna remove` and `dna update` (`node dist/cli.js dna --help`).

### 11.1 `README.md` — align and slim

The entry point, not the manual. Keep: problem, solution, the five pillars with their **v0.2**
status (Directives shipped), installation with **Node.js 22.12+**. Replace the Quick Start with a
~5-minute path — `init` → `dna show` → `memory add` / `submit` → `approve` (including the approver
identity setup, H3) → `mcp` — every step a real transcript (S4's check). Add a pointer table to
`docs/user-guide.md`, `docs/cli-reference.md`, `docs/examples/`, `docs/agents.md`, `CHANGELOG.md`.
Update the roadmap (§4.2). Move the full command block and the *Machine-readable output & the
exit-code contract* section out to the CLI reference.

### 11.2 `docs/user-guide.md` — step by step: configure, then use

0. **Concepts** — element, type, state machine, state derived from frontmatter, one operation = one
   commit, roles, the approver.
1. **Prerequisites** — Node.js 22.12+, a git repository, a configured git identity (REQ-SEC-01).
2. **Install** — `npm install -g` / `npx`.
3. **`wingfoil init --template …`** — what it creates under `.wingfoil/`, file by file.
4. **Configure DNA** — modules, stacks, team & roles, paths; `dna show|set|add|remove|update`; the
   grammar (positional = target, option = attribute; quoted segments for dotted names).
5. **Configure Memory** — types, `sequence` / `gates` / `waiting`, templates, `id_pattern`;
   customising a type.
6. **Configure Directives** — the built-in P3.8 templates installed by `init`, `directive create`,
   `assign`, `remove` (unassign first, H5), `roles.yaml`.
7. **Workflows** — `workflow list`; state plainly that no workflow engine ships, and how to follow a
   workflow by hand.
8. **Daily use** — `add → submit → approve / reject → deprecate`, `history`, `search`; the commit
   format and the `Reason:` block rules; approver authorisation setup.
9. **Connecting an AI agent** — registering the MCP server (`.mcp.json` for Claude Code and other
   clients), what its Resources and role Prompts expose, `docs/agents.md` as the alternative; agents
   never approve.
10. **CI and scripting** — `--format json`, exit codes 0 / 1 / 2.
11. **Known limitations** — whatever is still open at release time (e.g. H4 / `bug-071`), measured,
    not remembered.

### 11.3 `docs/cli-reference.md` — one entry per command

For each of the 20 commands: synopsis, positionals, options, output (text and `--format json`),
exit codes, the git commit it produces (subject shape), one example, the typical errors. A common
preamble covers grammar, `--format` and the exit-code contract. Sources of truth: `CORE_MODULES`
(`src/core/index.ts`), `spec-008-cli-grammar`, `spec-005-cli-command-contract`.
**Decided (approver, 2026-09-25):** a test fails when a `CORE_MODULES` command is missing from the
reference — the same mechanism as the API-docs gate. It lives under `test/docs/` and runs in the
`npx jest` gate (§6).

### 11.4 `docs/examples/` — runnable, each a script plus its expected transcript

`01-first-project` (init → first approved task) · `02-custom-memory-type` ·
`03-directives-per-role` · `04-mcp-with-claude-code` · `05-ci-json-exit-codes`.
**Decided (approver, 2026-09-25):** `e2e-smoke` runs them, so they cannot go stale. The
`e2e-smoke-rel-v0.2-plan` must gain that step when this phase hands off to it.

### 11.5 `CHANGELOG.md` — Keep a Changelog

`[0.2.0]` (dated by `release-publishing`, else `Unreleased` — never a wall clock) with
Added / Changed / Fixed grouped by pillar, each entry citing its `done` task or `closed` bug id;
then `[0.1.0]`.

### 11.6 `docs/agents.md` — for an agent working in a user's project

Written for a model more than a person: tables and exact commands, little prose.

- **Opening lines** — who the file is for; agents developing WingFoil itself read `CLAUDE.md`; it
  describes `main`, so compare with `wingfoil --version` and follow the tag link for that version.
- **What WingFoil is** in ~10 lines; how to recognise a WingFoil project (`.wingfoil/` at the root)
  and the map of its files.
- **Mental model** — elements, state in frontmatter, one operation = one commit.
- **Operating rules** — use the verbs, never hand-edit `status`; never approve; load the directives
  of your role; obey the `Reason:` rules; read before writing.
- **MCP ↔ CLI equivalence table** — every `wingfoil://…` Resource and role Prompt with its
  `--format json` CLI equivalent; this is what makes the file a backup to the MCP server.
- **Write path** — exact verb syntax, exit codes, how to react to exit 1 and 2.
- **Workflows without an engine**, setup recipes, known limits, links to the CLI reference and the
  user guide.

---

## Execution Notes

Run on branch `docs/user-docs-v0.2` (worktree `../.wf2-wt/user-docs-v0.2`), cut from `main` at
`825f7827`. Every measurement below was taken there, with the command that produced it.

### S1 — `check-implementation-complete` (tech-lead) — PASSED

| # | Command | Result |
|---|---|---|
| P1 | `awk '/^---$/{n++;next} n==1&&/^status:/' docs/self/docs/04_memory/planning/rl-v1/minor-v0.2.md` | `status: in-development` |
| P2 | the §1 P2 loop | `73 done` — the release grew from 54 to 73 tasks after this plan was written; all are `done` |
| P3 | the §1 P3 loop | no output — no open v0.2 bug |
| P4 | `git status --porcelain` · `git rev-parse --abbrev-ref HEAD` | empty · `docs/user-docs-v0.2`; `npm ci` done |
| P5 | `grep -n "Correction (2026-09-21)" …/dl-001-typescript-over-python.md` | one hit, line 37 |

### S2 — Survey (developer)

- **Surface — 20 commands, not §3's 17.** `npm run build && node dist/cli.js --help` plus each group's
  `--help`: `init, mcp, paths, workflow list, directives list, dna show|set|add|remove|update,
  memory add|submit|approve|reject|deprecate|history|search, directive create|assign|remove`.
  `task-093` added `dna add|remove|update`.
- **`produces:`** (the §4.1 loop, plus `docs/agents.md`): `README.md` PRESENT; `docs/user-guide.md`,
  `docs/cli-reference.md`, `docs/examples`, `CHANGELOG.md`, `docs/agents.md` MISSING.
- **README stale claims** (`grep -nE 'Node(\.js)? ?1[0-9]|18\+'` and `grep -nE 'v0\.1|In Dev|targeting|planned, v0\.'`
  on `README.md`): the §4.2 table re-measured and still accurate, row for row.
- **Gates at the base** (§6, all six): 148 suites / 2410 tests green, both `tsc` clean, lint clean,
  `docs:api` clean.
- **Hazards re-checked.** H3 still holds: `memory approve` without an approver member → exit 1,
  `user not authorized to approve type 'task'`. **H4 no longer applies**: `bug-071` is `closed`
  (`grep -H '^status:' docs/self/docs/04_memory/bugs/bug-071-*.md`), and `memory history` in the probe
  wrote nothing to stderr. H5 holds: `directive remove` of an assigned directive → exit 1.

The survey probe: a throwaway repository exercising every command (the e2e-smoke §4 recipe, extended).
Every transcript in the new documents was pasted from it.

### S4–S6 — what was written

| Artifact | Content | Check |
|---|---|---|
| `README.md` | §11.1: v0.2 pillar status, Node.js 22.12+, a 5-step Quick Start (init → approver → add/submit → approve → MCP), a documentation table, a rewritten roadmap; the long command block and the exit-code section moved to the reference | the Quick Start sequence re-run verbatim in a fresh repository: every output identical, tree clean; `grep -nE 'Node(\.js)? ?1[0-9]|18\+' README.md` → empty |
| `docs/cli-reference.md` | §11.3: conventions (root, grammar, global options, exit codes, git side effects, identity) + one entry per command | `test/docs/cli-reference.test.ts` (new, §11.3 decision) — see below |
| `docs/user-guide.md` | §11.2, sections 0–11 as defined | every command in it was run in the probe |
| `docs/examples/` | §11.4: `lib.sh`, `README.md`, five `run.sh` scripts | all five exit 0 against `dist/` (`WINGFOIL="node $PWD/dist/cli.js" bash docs/examples/0N-*/run.sh`) |
| `CHANGELOG.md` | §11.5: `[0.2.0] - Unreleased`, `[0.1.0]` undated (no Memory document records a date) | drafted from the task/bug documents, then reviewed: one false line fixed — 0.1.0's `dna set` took a second positional (`git show 5b16ab61:README.md \| grep -n "dna set"`), so the switch to `--value` is listed as **Breaking** under 0.2.0 |
| `docs/agents.md` | §11.6 / §10 | the MCP ↔ CLI table was checked against a live `resources/list`, `resources/templates/list`, `prompts/list` |

**Deviation from §11.4, recorded for the approver.** The examples do not ship a separate expected
transcript per script. Their output carries commit hashes and timestamps, which differ on every run, so
a transcript cannot be diffed. Instead each script prints the transcript as it runs and **asserts**
the parts that must hold (exit codes, states, audit-trail operations, approver line), exiting non-zero
on a mismatch. That is also what makes them runnable by `e2e-smoke`.

**The coverage test was red first.** `npx jest test/docs/cli-reference.test.ts` before the reference
existed → `ENOENT … docs/cli-reference.md`. After → passing. Checked in reverse too: with the
`memory history` heading temporarily removed, the test fails and names `"memory history"`.

**Behaviour the documents rely on, measured in the probe rather than assumed:**
- `memory submit` commits the document's uncommitted edits with the state change; `approve`, `reject`
  and `deprecate` refuse a document with uncommitted edits (`error: refusing to commit …`).
- A hand commit that touches a document shows up in `memory history` with `"operation": null`.
- A missing required frontmatter field stops a submit: `error: missing required field on submit: title`.
- An uncommitted `memory.yaml` type is refused, with a message naming the cause; an uncommitted
  `roles.yaml` unassignment is invisible to `directive remove`.
- `memory search` and the `wingfoil://memory/{type}` Resource both leave out deprecated documents.
- The built-in `security` directive is bound to no role by `init` (`roles.yaml` of the probe).

### `align-agent-docs` (architect)

- `CLAUDE.md` §1 command list: gained `dna add|update|remove`, now 20 (measured above).
- `CLAUDE.md` §2: `README.md`'s row no longer says CLAUDE.md "is owned by nothing yet" (dl-025 landed
  as `align-agent-docs`); rows added for the user docs and for `docs/agents.md`.
- `CLAUDE.md` §3: the note calling the built-in directives "not implemented yet (`task-057`, still
  `backlog`)" rewritten — `task-057` is `done`; this repo's config still carries the stand-ins, and
  reconciling them stays `bug-040` (`open`).
- `docs/self/.wingfoil/README.md`: dropped "the CLI/MCP tooling is not yet implemented"; the
  directives note matches §3; the workflow tree gained `release-planning`'s seven phases,
  `user-docs` and `e2e-smoke`.
- Post-checks: the §5 element/state table was compared with `memory.yaml` (`sequence`, `gates`,
  `waiting` per type, read with `python3 -c 'import yaml; …'`): matches. §6 against `workflows.yaml`
  and `sw-life-cycle` / `release-line-cycle` / `release-cycle` / `release-planning` phases: matches.
  §7 against `roles.yaml` v1.1: matches.

### S7 — Gates on the branch

149 suites / 2412 tests green (one new suite, `test/docs/cli-reference.test.ts`); both `tsc` clean
after two fixes to the new test (the `resolution-mode` import the other tests use; a possibly-undefined
match group); lint clean; `docs:api` clean; the five examples exit 0.

### Findings — not fixed here, to become elements

Found while probing. None is a documentation defect, so none is fixed in this phase; each needs a bug
or DL (`feedback`: review findings must not stay only in notes).

1. **`dna add` on a collection that does not exist yet rewrites `dna.yaml` without its comments.** In
   the probe `dna add team.agents --value claude --entry-executes_as developer,reviewer --entry-approval_authority false` dropped all 8 comment
   lines; every earlier `dna set|add|update|remove` on existing paths kept them. `bug-004`'s fix does
   not cover the new-key path. (Bisected with
   `for s in $(git log --reverse --format=%h -- .wingfoil/dna.yaml); do git show $s:.wingfoil/dna.yaml | grep -c '#'; done`.)
2. **`illegal transition` names the wrong target.** On the custom `story` type, `memory submit` on the
   gated `ready` state reports `illegal transition ready -> done`, and at the end of the sequence
   `illegal transition done -> ready`. Neither is the move attempted.
3. **Subcommand `--help` is uninformative.** Subcommands carry no description; every positional is
   described generically; options read `type value`, `reason value`. The reference now compensates, but
   a user reading `--help` cannot learn the surface from it.
4. **`init`'s "already initialized" error points to a command that does not exist**: *"use a migration
   command to change config"*.
5. **No command unassigns a directive**, while `directive remove` requires it to be unassigned. The
   guide documents the hand edit to `roles.yaml`. This is a gap, not a defect, so it is a DL candidate.
6. **Extra positionals are silently ignored**: `dna show a b` acts on `a`; `workflow list <name>` and
   `directives list <role>` ignore the argument and print everything.

### Open for the approver

- **S8** — the `align-user-docs` and `align-agent-docs` approvals.
- **`bug-068` fallout, now real.** `spec-015` (`approved`) states in its §1 and its *What remains
  open* paragraph that `README.md:115` still reads "Node.js 18+ required". The README no longer does
  (the sweep above is empty) and the sentence moved. Per §4.3 this is reported rather than edited.
- **Handoff to `e2e-smoke`** (§11.4 decision): `e2e-smoke-rel-v0.2-plan` must gain the step that runs
  `docs/examples/0*/run.sh` against the built CLI.

### Approver decisions of 2026-09-25 (second round) — S8 and the open items

Given in chat: *approve everything, except that `README.md` still saying Node.js 18+ must be
corrected.* On the branch the README carries no such claim
(`grep -nE 'Node(\.js)? ?1[0-9]|18\+' README.md` → no output). The sentence that still asserted it
was `spec-015`'s: three passages stating that `README.md:115` still read "Node.js 18+ required". So
the correction was applied there:

- **`spec-015` corrected** (`9fec695c`). The three false passages were rewritten in place with a dated
  *Revision (2026-09-25)* note, following the spec's own revision precedent. The three
  `README.md:115` offsets now cite the README's *Installation* heading, which is the content of
  `bug-068`. `bug-068` stays `open`: its lifecycle is `release-planning`'s to move, and its content is
  now fixed.
- **Findings filed** as `bug-126` … `bug-131`, all `open`, through
  `bug-ingest-rel-v0.2-user-docs-findings-plan` (`3ac3491a` add, `29d44e9c` submit).
- **`e2e-smoke-rel-v0.2-plan` gained step S2b**, which runs `docs/examples/0*/run.sh` against the
  built CLI (§11.4 decision).
- **S8 approved**: `align-user-docs` and `align-agent-docs`, including the §11.4 deviation (the
  examples check themselves instead of shipping expected transcripts). With every completion
  criterion of §8 met, this plan moves `active → done`.
