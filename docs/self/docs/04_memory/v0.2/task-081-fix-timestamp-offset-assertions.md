---
id: "task-081-fix-timestamp-offset-assertions"
type: task
title: "Accept git's `Z` zero-offset in the two `%aI` timestamp assertions so `prepublishOnly` passes on a UTC runner"
status: in-progress
release: "v0.2"
priority: "high"
tags: ["v0.2", "release", "testing"]
ref: "task-077-first-real-staging-run"
bug: ["bug-057-timestamp-assertions-reject-zulu-offset"]
depends_on: []
tmpl_version: 260703
---

## Description

`bug-057-timestamp-assertions-reject-zulu-offset` (`open`, high, **release blocker**):
`test/core/memory-approve.test.ts:168` and `test/memory/versioning-audit-trail.test.ts:61` both assert
`/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/` against git's `%aI` author date. Git >= 2.55
renders a zero offset as `Z`, which is valid ISO-8601/RFC-3339, so on a UTC runner both fail — and with
them `prepublishOnly`, which `spec-015` §2 requires to be passable in the release gate. GitHub's
`ubuntu-24.04` image ships **Git 2.55.0** (`actions/runner-images` readme) and its runners are UTC, so
this fires on GitHub, not only under `act`.

**The assertions are wrong, not git**, and the fix shape is already in this repository:
`test/cli/program.integration.test.ts:471` asserts the same kind of value as
`/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/`. Adopt that alternation in both failing
assertions.

P1.2 requires the audit trail to carry an ISO-8601 timestamp; it does not require one spelling of a
zero offset, so widening these regexes weakens no specified behaviour.

## Acceptance Criteria

1. **AC1 — both assertions accept `Z`.** `test/core/memory-approve.test.ts:168` and
   `test/memory/versioning-audit-trail.test.ts:61` use `(?:Z|[+-]\d{2}:\d{2})` in place of
   `[+-]\d{2}:\d{2}`, matching `test/cli/program.integration.test.ts:471` verbatim.
2. **AC2 — the suite passes under `TZ=UTC` with a git that emits `Z`.** Run
   `TZ=UTC npx jest test/core/memory-approve.test.ts test/memory/versioning-audit-trail.test.ts` in an
   environment whose `git --version` is **>= 2.55** — e.g. inside `catthehacker/ubuntu:act-24.04`,
   which ships 2.55.0 — and record both the git version and the exit code in the Execution Notes. A run
   under the developer machine's git 2.43.0 does **not** satisfy this AC: 2.43.0 writes `+00:00` even
   under `TZ=UTC` (measured in `bug-057`), so it passes with or without the fix.
3. **AC3 — red before green, in that same environment.** The two assertions fail before the change and
   pass after it, shown by two runs of the identical command.
4. **AC4 — no other assertion carries the same literal.** Sweep the tree —
   `grep -rn '\[+-\]\\d{2}:\\d{2}' test/ src/` — and either fix every hit or record in the Execution
   Notes why a hit is legitimately offset-only. `bug-057` deliberately asserts nothing about other
   suites; this AC settles it by running the command.
5. **AC5 — `+HH:MM` still passes.** Both widened assertions still accept a non-zero offset (the
   developer-machine case, `TZ=Europe/Rome`), so this is a widening and not a swap.
6. **AC6 — the existing gates stay green**: `npx jest`, `npx jest --coverage` (non-regressing, >80%),
   `npx tsc -p tsconfig.build.json --noEmit`, `npm run lint`, `npm run docs:api` all exit 0.
7. **AC7 — `bug-057` is carried to `resolved`** by `bug.sync_state` off this task's `bug:` field.

## Implementation Notes

- **The environment is the hard part, not the regex.** The change is two characters of alternation; the
  work is producing a git >= 2.55 to prove it. Cheapest route recorded by `task-077`:
  `docker run --rm catthehacker/ubuntu:act-24.04 bash -lc '…'` — it needs no `act`, no workflow and no
  artifact server. Running the whole Jest suite inside that image is heavier but is what AC2 asks for;
  running only the two named suites is sufficient.
- **Do not "fix" this by pinning a TZ in the test setup.** Forcing `TZ=Europe/Rome` (or any non-zero
  offset) in Jest config would make the assertion pass by preventing the input it rejects. That hides
  the defect, and would also mask the next assertion that makes the same mistake.
- **Do not change production code.** Nothing in `src/` is wrong here: `%aI` is git's output and P1.2 is
  satisfied by either spelling. If a production path is found to *parse* `%aI` with the same narrow
  regex, that is a separate finding — file it, do not absorb it silently.

**Must be re-verified at execution time, not read from this task:**

1. The two line numbers — `test/core/memory-approve.test.ts:168`,
   `test/memory/versioning-audit-trail.test.ts:61` — and the reference line
   `test/cli/program.integration.test.ts:471`. All three are pinned to `main` at `b505473` and any merge
   can move them; re-locate by content (`grep -n '\[+-\]\\d{2}:\\d{2}' test/`), not by line.
2. `git --version` inside whatever image is used for AC2, printed alongside the run.
3. That GitHub's `ubuntu-24.04` image still ships a git that emits `Z`, if the fix is deferred long
   enough for the image to move:
   `curl -sS https://raw.githubusercontent.com/actions/runner-images/main/images/ubuntu/Ubuntu2404-Readme.md | grep -i '^- Git '`.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass.
     AC classification (dl-014/T1, `testing` directive): AC2/AC3 are red-first — the failure is
     reproducible today in a git >= 2.55 environment and must be shown red first; AC4/AC5/AC6 are
     characterization. -->

### design — role: architect

Branch `task/task-081-fix-timestamp-offset-assertions`, worktree
`/home/robypomper/Workspaces/.wf2-wt/task-081`, forked from `main` at `0cf643f`
(`wf(decision-log): approve dl-075-no-bare-line-offsets-in-memory`). Install:
`npm ci --prefer-offline --no-audit --no-fund` → `added 500 packages in 9s`, exit 0.

#### `agent.read_related` (`dl-015`, HARD gate)

`depends_on: []`, so the gate is satisfied vacuously — there is no upstream task whose Execution Notes
must be acknowledged. The elements this task's instructions name were read in full on `main` at
`0cf643f`:

| Element | State read | What it changes here |
|---|---|---|
| `bug-057-timestamp-assertions-reject-zulu-offset` | `planned`, `release: "v0.2"`, severity high | The source bug. Its claims (the two literals, the reference literal, the git-2.43 local rendering, the 2.55.0 image) are each **re-measured** below rather than trusted; all held. |
| `task-077-first-real-staging-run` (this task's `ref`) | `done` | Origin of the finding (its **F3**). Two facts taken from it and re-measured here: the `catthehacker/ubuntu:act-24.04` route to a git ≥ 2.55, and that its **F4** (`bug-058`, an `ENOTEMPTY` fixture-teardown race in `removeTempDir`) is *independent* of F3 — relevant because F4 can surface in a full-suite container run and must not be absorbed here. |
| `dl-075-no-bare-line-offsets-in-memory` | `ready` (`0cf643f`) | Binds the citations below: durable positions cite a symbol / heading / verbatim quotation + the sha read at; bare `path:line` stays legal in these Execution Notes, where a stale offset is an honest record. |
| `dl-045-absorbed-bug-back-reference` | `ready` | Why `bug: ["bug-057-…"]` is a list and why `bug.sync_state` drives bug-057 from this task. |

#### `agent.verify_specs`

No new `tech-spec` is needed and none was scaffolded; the design gate is **pass-through** (no approver
decision at `design`). The contract under test is unchanged: P1.2 (`docs/02_requirements/02_bdd/
features/p1-memory/P1.2-audit-trail.feature`) and P1.7 require the audit trail to carry an **ISO-8601**
timestamp; neither names a spelling for a zero offset. `spec-015` §2 requires `prepublishOnly` to be
passable in the release gate, which is the property these two assertions currently break on CI. The
change is confined to two test sources; **no `src/` file is touched** (AC in Implementation Notes).

#### The environment — the bug IS reproducible here, contrary to the plan's assumption

The task and the bug both assume the defect can only be *argued* locally. That is true of the host
toolchain and false of the machine as a whole: the runner image is already in the local docker cache,
so a real red/green in a git ≥ 2.55, UTC environment was available and was used. Measured, not assumed:

```
$ git --version                                     # host
git version 2.43.0
$ git log -1 --format=%aI                           # host, repo HEAD
2026-09-21T21:57:15+02:00
$ docker images --format '{{.Repository}}:{{.Tag}}' | grep catthehacker
catthehacker/ubuntu:act-24.04
$ docker run --rm catthehacker/ubuntu:act-24.04 bash -lc 'git --version; cd /tmp && git init -q r && cd r && git -c user.name=t -c user.email=t@t.t commit -q --allow-empty -m x && git log -1 --format=%aI; TZ=UTC git log -1 --format=%aI; node --version'
git version 2.55.0
2026-09-21T19:58:45Z
2026-09-21T19:58:45Z      # TZ=UTC — same Z rendering
v24.19.0
```

So the two halves of the failing condition — "git ≥ 2.55" and "UTC" — are both obtainable, and AC2/AC3
can be satisfied as written instead of by argument. The host remains unable to produce the input
(2.43.0 writes `+00:00` even under `TZ=UTC`), which is why every red/green run below is a **container**
run and every run labelled "host" is only evidence for AC5.

#### T1 — AC classification (`dl-014` / testing directive)

The task's template comment pre-classified AC2/AC3 red-first and AC4/AC5/AC6 characterization; that
holds, and is now backed by a real red rather than by the prediction.

| AC | Class | Evidence / what settles it |
|---|---|---|
| AC1 — both assertions use `(?:Z\|[+-]\d{2}:\d{2})` | red-first (same edit as AC2/AC3) | The edit itself; verified by the sweep command re-run after the change (`### refactor`). |
| AC2 — suite passes under `TZ=UTC` with git ≥ 2.55 | **red-first** | Container run of the two named suites, `git --version` printed alongside, exit code recorded — red in `### red`, green in `### green`. |
| AC3 — red before green, identical command | **red-first** | The same command string run twice, on the pre-fix and post-fix trees; both runs quoted. |
| AC4 — no other assertion carries the literal | characterization | The sweep command and its full output, recorded in `### design` below and re-run in `### refactor`. Settled by running it, not by reading the bug. |
| AC5 — `+HH:MM` still passes | characterization | Host run (git 2.43.0, `TZ=Europe/Rome`) of the same two suites: they passed before the change and must still pass after. This is the one thing the host *can* measure that the container cannot. |
| AC6 — gates stay green | characterization | Gate table in `### refactor`. |
| AC7 — `bug-057` carried to `resolved` | characterization (process) | `bug.sync_state` commits; this dev-loop stops at `in-review`, so `resolved`/`closed` belong to the approver's `done` phase, not to this agent. |

No red was fabricated and no dead code was added: the failing tests already exist — they *are* the
artefact under repair — so `red` writes no new test and its commit is absent by construction (see
`### red`).

#### AC4 — the sweep, run rather than assumed

```
$ grep -rn '\[+-\]\\d{2}:\\d{2}' test/ src/
test/core/memory-approve.test.ts:168:    expect(gitOut(repo, ['log', '-1', '--format=%aI'])).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
test/core/memory-history.test.ts:77:const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/;
test/memory/versioning-audit-trail.test.ts:61:      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
test/cli/program.integration.test.ts:471:        expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/);
```

Four hits, **two** of them defective. The other two already carry the alternation: the `ISO_8601`
constant in `test/core/memory-history.test.ts` (declared `/** %aI — strict ISO-8601 with a numeric UTC
offset (or Z) … */`) and the `entry.timestamp` assertion in `test/cli/program.integration.test.ts`. The
latter is the shape AC1 names, and it is the shape adopted verbatim.

The literal in the sweep only catches one spelling of the mistake, so the sweep was widened rather than
stopped there:

```
$ grep -rnE 'T.d\{2\}.*\\d\{2\}:\\d\{2\}' test/ src/      # any regex over a T hh:mm:ss + zone
test/core/memory-approve.test.ts:168          # defective (above)
test/memory/history.test.ts:56:      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
test/memory/versioning-audit-trail.test.ts:61 # defective (above)
test/memory/audit.test.ts:294:      expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
$ grep -rnE '\\\+\\d\{2\}|\[\+-\]\\d\{4\}|[+-]\\d\{4\}' test/ src/    # other zone spellings, e.g. +HHMM
(no output)
```

`test/memory/history.test.ts:56` and `test/memory/audit.test.ts:294` are **legitimately unaffected**:
both are unanchored (no `$`) and assert nothing at all about the zone, so `Z` and `+02:00` match
equally. That is the AC4 "legitimately offset-only" record — except that neither is offset-only; they
are zone-agnostic, which is why they were never in the failure set. Both were confirmed passing in the
container run below.

#### No production path parses `%aI` (Implementation Notes' third bullet)

Checked rather than assumed, so that the "separate finding" branch of that bullet can be closed:

```
$ grep -rnE '/\^?\\d\{4\}|new RegExp' src/
src/validation/id.ts:87, src/memory/add.ts:103, src/validation/secret-scan.ts:216,415  # ids, YAML keys, secret patterns
```

None of them reads a date. `%aI` appears in `src/memory/audit.ts` and `src/memory/history.ts` only as a
`git log` **format field** (`AUDIT_LOG_FIELDS` / `LOG_FIELDS`), and the value is passed through
untouched: `auditAttribution`'s `valid` flag comes from `isValidAttribution(authorName, authorEmail)`,
which never looks at the date. So nothing in `src/` narrows the zone, and there is no second finding to
file from this bullet.

### red — role: developer

**No `test(...)` commit exists for this phase, by construction.** The red-first ACs (AC2/AC3) are about
two assertions that are already written and already fail; the failing test is the artefact under
repair, so writing a *new* failing test would either duplicate it or be the fabricated red the
`testing` directive forbids. `red` is therefore a recorded run of the existing suites on the pre-fix
tree, at `c5a6643` (`wf(bug): sync bug-057 …`, i.e. before any test source was touched).

#### AC2/AC3 — the red run, in a git ≥ 2.55 UTC environment

Command (the *identical* string is re-run after the fix in `### green`; only the tree differs):

```
$ docker run --rm \
    -v /home/robypomper/Workspaces/.wf2-wt/task-081:/home/robypomper/Workspaces/.wf2-wt/task-081 \
    -v /home/robypomper/Workspaces/WingFoil2/.git:/home/robypomper/Workspaces/WingFoil2/.git \
    -w /home/robypomper/Workspaces/.wf2-wt/task-081 \
    --user "$(id -u):$(id -g)" -e HOME=/tmp -e TZ=UTC \
    catthehacker/ubuntu:act-24.04 \
    bash -lc 'git --version; node --version; npx jest test/core/memory-approve.test.ts test/memory/versioning-audit-trail.test.ts; echo "EXIT=$?"'
```

(The second mount is the real `.git` directory this worktree's `.git` file points at; without it git
commands inside the container cannot resolve the worktree. `--user` keeps every file jest writes —
`dist/` from `test/global-setup.cjs` — owned by the developer, not root.)

Result on the pre-fix tree:

```
git version 2.55.0
v24.19.0
  ● P1.2 — Every state change records author and timestamp (BDD scenario 1) › a draft -> pending change committed via commitPaths is fully attributable and references the doc id + new state
    expect(received).toMatch(expected)
    Expected pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/
    Received string:  "2026-09-21T20:00:09Z"
      at Object.<anonymous> (test/memory/versioning-audit-trail.test.ts:61:26)

FAIL test/core/memory-approve.test.ts
  ● CORE_MODULES memory.memoryApprove — P1.7 fit criteria › P1.7 sc.1: approves a pending document with a reason — one commit recording approver, timestamp and reason, exit 0
    expect(received).toMatch(expected)
    Expected pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/
    Received string:  "2026-09-21T20:00:09Z"
      at Object.<anonymous> (test/core/memory-approve.test.ts:168:57)

Test Suites: 2 failed, 2 total
Tests:       2 failed, 17 passed, 19 total
EXIT=1
```

Exactly the two assertions `bug-057` names, failing on exactly the string it predicts, with the git
version printed in the same run. The other 17 tests in those two suites pass, including the two
zone-agnostic assertions the AC4 sweep cleared.

#### AC5 — the host baseline, so the fix can be shown to be a widening

Same two suites on the same pre-fix tree, on the host (git 2.43.0) under a non-zero offset:

```
$ TZ=Europe/Rome npx jest test/core/memory-approve.test.ts test/memory/versioning-audit-trail.test.ts
Test Suites: 2 passed, 2 total
Tests:       19 passed, 19 total
EXIT=0
```

Green before the change; it must still be green after, or the change would be a swap rather than a
widening. Re-run in `### green`.

#### The literals themselves, for the record

```
$ node -e 'const cur=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/, fix=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/; …'
2026-09-21T19:58:45Z         current: false  fixed: true
2026-09-21T21:57:15+02:00    current: true   fixed: true
2026-09-21T19:58:45          current: false  fixed: false
2026-09-21T19:58:45 UTC      current: false  fixed: false
```

The last two rows are the point of the exercise: the replacement still **requires** an explicit zone,
so this widens the accepted set by exactly one legal ISO-8601 spelling and does not degrade the
assertion into "any string".

### green — role: developer

**The change (AC1).** `git diff a03696d^ a03696d -- test/` is two assertion lines plus the comment that
explains them; no other byte of either suite moved, and `src/` is untouched:

```
-    expect(gitOut(repo, ['log', '-1', '--format=%aI'])).toMatch(/^\d{4}-…:\d{2}[+-]\d{2}:\d{2}$/);
+    expect(gitOut(repo, ['log', '-1', '--format=%aI'])).toMatch(/^\d{4}-…:\d{2}(?:Z|[+-]\d{2}:\d{2})$/);
-      expect(entry.date).toMatch(/^\d{4}-…:\d{2}[+-]\d{2}:\d{2}$/);
+      expect(entry.date).toMatch(/^\d{4}-…:\d{2}(?:Z|[+-]\d{2}:\d{2})$/);
```

The alternation is `(?:Z|[+-]\d{2}:\d{2})` — character-for-character the one already in
`test/cli/program.integration.test.ts`'s `entry.timestamp` assertion and in
`test/core/memory-history.test.ts`'s `ISO_8601` constant, as AC1 requires. A three-line comment was
added above each so the next reader does not re-narrow it; both name `bug-057` and neither carries a
line offset (`dl-075`).

**AC2/AC3 — the identical command, same tree, post-fix:**

```
$ docker run --rm -v … -e TZ=UTC catthehacker/ubuntu:act-24.04 bash -lc 'git --version; npx jest test/core/memory-approve.test.ts test/memory/versioning-audit-trail.test.ts; echo "EXIT=$?"'
git version 2.55.0
v24.19.0
PASS test/core/memory-approve.test.ts (5.757 s)
Test Suites: 2 passed, 2 total
Tests:       19 passed, 19 total
EXIT=0
```

Red `EXIT=1` / 2 failed at `c5a6643` → green `EXIT=0` / 19 passed at `a03696d`, same command, same git
2.55.0, same `TZ=UTC`. AC3 is satisfied literally, not by argument.

**AC2, in its strongest available form — the whole suite, and the actual release gate, in the image:**

```
$ docker run --rm … -e TZ=UTC catthehacker/ubuntu:act-24.04 bash -lc 'git --version; npx jest; echo "EXIT=$?"'
git version 2.55.0
Test Suites: 104 passed, 104 total
Tests:       1697 passed, 1697 total
EXIT=0

$ docker run --rm … -e TZ=UTC catthehacker/ubuntu:act-24.04 bash -lc 'npm run prepublishOnly; echo "EXIT=$?"'
EXIT=0
```

`prepublishOnly` — `npm run build && npm test && npm run lint`, the gate `spec-015` §2 requires to be
passable — now **exits 0 on a UTC machine with git 2.55.0**, which is the property `bug-057` says is
broken. That is the closest measurement to "it works on GitHub" obtainable without GitHub.

**AC5 — still a widening, not a swap.** Same two suites, host (git 2.43.0), non-zero offset:

```
$ TZ=Europe/Rome npx jest test/core/memory-approve.test.ts test/memory/versioning-audit-trail.test.ts
Test Suites: 2 passed, 2 total
Tests:       19 passed, 19 total
EXIT=0
```

Green before the change (recorded in `### red`) and green after — the `+02:00` rendering the developer
machine produces is still accepted. Together with the literal probe in `### red` (a zone-less string and
a ` UTC` suffix are both still rejected by the replacement), the assertion still pins "ISO-8601 with an
explicit zone"; only the spelling of a zero zone was widened.

#### BDD acceptance scenarios covered by the two repaired suites

| Feature file | Scenario | Test that covers it (passing) |
|---|---|---|
| `P1.2-versioning-audit-trail.feature` | `Every state change records author and timestamp` | `test/memory/versioning-audit-trail.test.ts` → `P1.2 — Every state change records author and timestamp (BDD scenario 1) › a draft -> pending change committed via commitPaths is fully attributable and references the doc id + new state` (the repaired assertion) |
| `P1.2-versioning-audit-trail.feature` | `Audit trail completeness across pillars` | same file → `P1.2 — Audit trail completeness across pillars (BDD scenario 2) › changes to a DNA, a directive, and a workflow file are all 100% attributable — no "unknown author"` |
| `P1.7-memory-approve.feature` | `Approve a pending document with a reason` | `test/core/memory-approve.test.ts` → `CORE_MODULES memory.memoryApprove — P1.7 fit criteria › P1.7 sc.1: approves a pending document with a reason — one commit recording approver, timestamp and reason, exit 0` (the repaired assertion) |

Both scenarios' other assertions are untouched; the repair only changes which *spelling* of a zero zone
the ISO-8601 check accepts, so no scenario's coverage is weakened.

### refactor — role: developer

Nothing to refactor: the change is two assertion literals and two comments, already in their final
shape, and there is no production code in the diff. The phase is therefore only its gates. All run in
this worktree at `a03696d`, after `git merge main` reported `Already up to date.` (`main` is still
`0cf643f`, so the gates were run against the merged state):

| Gate | Command | Result |
|---|---|---|
| full suite | `npx jest` | **exit 0** — `Test Suites: 104 passed, 104 total`, `Tests: 1697 passed, 1697 total` |
| coverage | `npx jest --coverage` | **exit 0** — `All files | 98.58 | 92.58 | 98.81 | 99.18` (stmt/branch/func/line), threshold 80; non-regressing (the diff adds no `src/` line, so the denominator is unchanged) |
| build typecheck | `npx tsc -p tsconfig.build.json --noEmit` | **exit 0** |
| root typecheck | `npx tsc --noEmit -p tsconfig.json` | **exit 0** — `bug-026` stays closed; `test/**` is not typechecked by jest, so this is the gate that covers the two edited test sources |
| lint | `npm run lint` | **exit 0** (`lint.clean`, hard-reject) |
| API docs | `npm run docs:api` | **exit 0** (`docs.api.*`, hard-reject) |
| worktree clean | `git status --porcelain` | empty — `dist/` and `coverage/` are gitignored and (thanks to `--user` on every docker run) owned by the developer, not root |

AC4 re-run after the change, to close it on the final tree rather than on the pre-fix one:

```
$ grep -rn '\[+-\]\\d{2}:\\d{2}' test/ src/
test/core/memory-approve.test.ts:168          (?:Z|[+-]\d{2}:\d{2})   ← fixed
test/core/memory-history.test.ts:77           (?:Z|[+-]\d{2}:\d{2})   ← already correct
test/cli/program.integration.test.ts:471      (?:Z|[+-]\d{2}:\d{2})   ← already correct
test/memory/versioning-audit-trail.test.ts:61 (?:Z|[+-]\d{2}:\d{2})   ← fixed
```

Four hits, four alternations: no occurrence of the narrow literal remains anywhere in `test/` or `src/`.
