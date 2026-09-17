---
id: "task-070-license-file"
type: task
title: "Add the MIT LICENSE file the package claims but does not ship"
status: in-progress
rejection_reason: "The LICENSE file is correct (paragraph-identical to SPDX MIT, byte-identical to the choosealicense MIT template, approver-confirmed copyright line), npm packs it without a files edit, and the task-059 allowlist update is correct. The AC1 test "contains the grant, condition and disclaimer paragraphs unmodified" (test/cli/license-file.test.ts:67-72) only asserts containment: a LICENSE with an extra restriction clause appended or inserted between paragraphs still passes (verified by mutation, 8/8 green), so the full-and-unmodified clause of AC1 is not guarded. Replace the three toContain assertions with an equality check on the whole normalised file."
release: "v0.2"
priority: "High"
tags: ["v0.2", "distribution", "governance"]
ref: "REQ-SYS-09"
bug: ""
depends_on: ["task-059-publish-metadata"]
tmpl_version: 260703
---

## Description

`package.json` declares `"license": "MIT"`, `README.md` says *"MIT — open source and free to use"*, and
`dna.yaml` records MIT as the project licence — but **no `LICENSE` file exists in the repository**.
npm ships `LICENSE*` automatically regardless of the `files` array, so the published tarball currently
carries the *claim* of a licence and none of its text.

Found by `task-059`'s review while verifying `spec-015` §1's conditional "add LICENSE to `files` only
if intended" clause: the clause could not be actioned because there was nothing to add.

## Acceptance Criteria

1. A `LICENSE` file exists at the repository root containing the **full MIT licence text**, with the
   copyright holder and year set to values the approver has confirmed — not inferred. This is the part
   of the task that is not mechanical (see Implementation Notes).
2. The licence text, `package.json`'s `license` field, `README.md`'s licence section and `dna.yaml`'s
   licence entry all agree. Any that disagree are reconciled rather than left.
3. `npm pack --dry-run` shows `LICENSE` in the tarball. Confirm whether it appears without editing the
   `files` array — npm is documented to include it always — and only add it to `files` if the pack
   listing proves otherwise.
4. `task-059`'s exhaustive packed-contents allowlist in `test/cli/publish-metadata.test.ts` is updated
   to expect `LICENSE`. That test asserts `toEqual([])` on anything outside its allowlist, so adding the
   file **will** turn it red — that is the guard working, and updating it is part of this task.
5. Full suite, `tsc`, `docs:api` and `eslint` all green.

## Implementation Notes

**Scheduled into `v0.2` under the exception recorded in `dl-034` point 4**, extended by the approver.
The bar that exception set is *argue from blocked work, not convenience*, and it is met: `task-060`
and `task-061` make publishing real, and a package that publishes with a licence claim and no licence
text is a defect that becomes public the moment it ships. This must land before them.

**The one decision this task cannot make for itself:** the copyright line fixes a holder and a year.
`dna.yaml` names Roberto Pompermaier as the sole `team.members` entry and `spec-015` §1 pins the same
identity for `author`, so the obvious value is `Copyright (c) 2026 Roberto Pompermaier` — but a
copyright assertion is the approver's to make, not a value to be derived the way `task-059` had to
derive the GitHub owner. **Confirm it before writing the file**; if the answer is not immediate, stop
and report rather than guessing.

Related: `bug-018`-style structural reasoning does not apply here — this is a missing artefact, not a
missing check. `task-059` correctly declined to author it, both because a copyright decision is not
publish *metadata* and because npm's automatic inclusion means it was never a `files` edit.

## Execution Notes

### design — role: architect

Branch `task/task-070-license-file`, worktree `/home/robypomper/Workspaces/.wf2-wt/task-070-license-file`
(from `main` at `79f9fda`). Task `in-progress` from `start` (`79a3fe2`). `bug:` is empty, so
`bug.sync_state` is a no-op.

**Copyright line — confirmed by the approver, not derived (AC1's non-mechanical part).** Roberto
Pompermaier (`approver`) confirmed `Copyright (c) 2026 Roberto Pompermaier` on **2026-09-17**, in chat
with the v0.2 Wave 2 orchestrator, which relayed it in this task's dispatch brief. That is the value
written — verbatim — with the standard full MIT licence text (SPDX `MIT`). The Implementation Notes'
"confirm before writing" gate is therefore satisfied before `green`; nothing was inferred from
`dna.yaml` `team` or `spec-015` §1, even though they name the same person.

**`agent.read_related` (`dl-015`) — `task-059-publish-metadata` acknowledged.** `status: done`
(`grep -n '^status' docs/self/docs/04_memory/v0.2/task-059-publish-metadata.md` → `5:status: done`).
Read its full Execution Notes. What this task takes from them:

- task-059 `design` §`files` review: it left `files` as `["dist", "README.md"]` because `LICENSE` did not
  exist, and recorded that npm ships `LICENSE*` automatically, so the fix is *creating* the file, not
  editing `files`. AC3 below verifies that claim with a real pack rather than repeating it.
- task-059 `red`/`refactor`: `test/cli/publish-metadata.test.ts` holds the **exhaustive** packed-contents
  allowlist (`dist/**`, `README.md`, `package.json`, asserted `toEqual([])`) and runs `npm pack` with
  `--ignore-scripts` (the `bug-022` concern). Adding `LICENSE` turns that case red by design — AC4.
- task-059 `review` finding 3 is this task's origin. Findings 1 (`<owner>` derived) and 2 (`bin` `./`
  auto-correct) are unrelated to the licence and not touched here.
- `bug-022` read: `test/cli/npm-distribution.test.ts:117` packs **without** `--ignore-scripts`. Not this
  task's to fix (brief rule 3); the new test here uses `--ignore-scripts` like its sibling, so it adds no
  new instance of the race.

**`agent.verify_specs` — no gap, pass-through.** `spec-015-packaging-publishing` (`approved`) §1:
`grep -n -i licen docs/self/docs/04_memory/design/specs/spec-015*.md` → line 46 "`files` review: stays
`["dist", "README.md"]`; add `LICENSE` … only if intended", line 60 "Unchanged: … `license: MIT`".
REQ-SYS-09 covers distribution. No BDD feature mentions a licence:
`grep -rli licen docs/02_requirements/02_bdd/features/` → no output. No tech-spec scaffolded, so no
design approval gate.

**AC2 reconciliation — current state, observed (commands run in the worktree before any change):**

```
$ grep -n '"license"' package.json
5:  "license": "MIT",
$ grep -n -A2 '^## License' README.md
368:## License
369-
370-MIT — open source and free to use.
$ grep -n 'license' docs/self/.wingfoil/dna.yaml
21:  license: MIT
$ ls LICENSE* COPYING*
ls: cannot access 'LICENSE*': No such file or directory
ls: cannot access 'COPYING*': No such file or directory
```

All three existing claims already say MIT; none disagrees, so nothing needs reconciling in them — the only
missing party is the `LICENSE` text itself. `README.md` is left unedited (it is owned by the `user-docs`
gate, `dl-013`, and already agrees).

**AC3 baseline — real `npm pack --dry-run` (with scripts, so `prepack` rebuilt `dist/`; 4.6 s), `dist/`
lines filtered out (`npm pack --dry-run 2>&1 | grep -v "dist/"`), before any change:**

```
npm notice Tarball Contents
npm notice 15.9kB README.md
npm notice 1.7kB package.json
npm notice Tarball Details
npm notice total files: 278
```

No `LICENSE` — expected, the file does not exist.

**T1 — acceptance-criteria classification.**

| AC | Class | Evidence / test |
|---|---|---|
| AC1 `LICENSE` with full MIT text + confirmed copyright | **red-first** | file absent (`ls` above). `license-file.test.ts` › AC1: `exists at the repository root`, `is headed "MIT License" and carries the approver-confirmed copyright line`, `contains the grant, condition and disclaimer paragraphs unmodified`; plus the edge case `carries no placeholder left unfilled` |
| AC2 all licence claims agree | **red-first** for the `LICENSE` side (`names the licence package.json declares` compares `pkg.license` to the `LICENSE` heading — fails while absent); **characterization** for `README.md` and `dna.yaml` (already MIT per the grep above): `matches the README §License section`, `matches the dna.yaml project licence entry` pass on first run |
| AC3 `npm pack` ships `LICENSE` without a `files` edit | **red-first** | baseline pack above has no `LICENSE`. `is packed by npm pack without being listed in files` |
| AC4 update task-059's exhaustive allowlist | **red-first, by design** — the guard, not a new test: the unmodified case `packs exactly dist + docs` goes red once `LICENSE` exists; demonstrated at `green` by running `main`'s copy of the file against the new `LICENSE` |
| AC5 suite / tsc / docs:api / eslint green | **characterization** (gates) — `refactor` |

New tests go in a **new file** `test/cli/license-file.test.ts` rather than `publish-metadata.test.ts`,
so the edit to the file `task-060` may also touch is a one-line allowlist change plus its header clause.

### red — role: developer

`npx jest test/cli/license-file.test.ts test/cli/publish-metadata.test.ts`:

```
  ● LICENSE file (task-070) — AC1 full MIT text › exists at the repository root
  ● LICENSE file (task-070) — AC1 full MIT text › is headed "MIT License" and carries the approver-confirmed copyright line
  ● LICENSE file (task-070) — AC1 full MIT text › contains the grant, condition and disclaimer paragraphs unmodified
  ● LICENSE file (task-070) — AC2 every licence claim agrees › names the licence `package.json` declares
  ● LICENSE file (task-070) — AC3 shipped in the tarball › is packed by `npm pack` without being listed in `files`
Test Suites: 1 failed, 1 passed, 2 total
Tests:       5 failed, 14 passed, 19 total
```

Every failure is for the stated reason — `LICENSE` is absent (`Received: false`, `Received: undefined`,
`Received string: ""`, and the packed array lacks `"LICENSE"`). The 3 passing cases in the new file are
the AC2 characterization pair (README, dna.yaml) and the placeholder edge case (vacuous on an absent
file; it bites once the file exists). `publish-metadata.test.ts` stays green (11/11): the allowlist now
tolerates `LICENSE`, which is harmless while it is absent.

### green — role: developer

Commit `d592e74 chore(cli): task-070-license-file — add the MIT LICENSE with the approver-confirmed
copyright line`. Only file: `LICENSE` (21 lines) — heading `MIT License`, `Copyright (c) 2026 Roberto
Pompermaier`, then the standard SPDX `MIT` grant / condition / disclaimer paragraphs. `package.json`,
`README.md`, `dna.yaml` untouched (AC2: already agree).

**AC4 — the task-059 guard went red as designed.** Ran `main`'s unmodified copy of the suite against the
new `LICENSE` (`git show main:test/cli/publish-metadata.test.ts > test/cli/zz-main-allowlist.test.ts &&
npx jest test/cli/zz-main-allowlist.test.ts`, temp file deleted afterwards, never committed):

```
  ● publish metadata (task-059) — shipped file surface › packs exactly `dist` + docs — nothing else reaches the tarball
    +   "LICENSE",
Tests:       1 failed, 10 passed, 11 total
```

With the updated allowlist: `npx jest test/cli/license-file.test.ts test/cli/publish-metadata.test.ts`
→ `Tests: 19 passed, 19 total`.

**AC3 — real `npm pack --dry-run` (prepack rebuild included, 8.5 s; `| grep -v "dist/"`), no `files` edit:**

```
npm notice Tarball Contents
npm notice 1.1kB LICENSE
npm notice 15.9kB README.md
npm notice 1.7kB package.json
npm notice Tarball Details
npm notice package size: 250.8 kB
npm notice total files: 279
```

`LICENSE` is packed and total files went 278 → 279 with `files` still `["dist", "README.md"]`
(`grep -n '"files"' -A3 package.json`). npm's automatic inclusion is confirmed, so `files` is **not**
edited — which also keeps task-059's `keeps files as the reviewed allowlist` case and `spec-015` §1's
"stays `["dist", "README.md"]`" intact. (278 on this branch vs task-059's 266: `dist/` grew with later
v0.2 merges; not this task's change.)

### refactor — role: developer

No refactor commit: the production change is a static text file with nothing to restructure, and the new
test file already follows its sibling's conventions (`--ignore-scripts`, sorted/normalised comparisons).
Not fabricating one.

**Gates (run in the worktree at `d592e74`):**

| Check | Command | Result |
|---|---|---|
| `tests.passing` | `npx jest` | `Test Suites: 81 passed, 81 total` · `Tests: 1096 passed, 1096 total` |
| `tests.coverage(min: 80)` | `npx jest --coverage --maxWorkers=4` | exit 0 · All files **98.29 % stmts · 90.18 % branches · 98.44 % funcs · 98.93 % lines** |
| build types | `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| full types | `npx tsc --noEmit -p tsconfig.json` | exit 2 — only the pre-existing `bug-026` error `test/core/directive-create.test.ts(159,19): error TS2339` |
| `lint.clean` | `npm run lint` | exit 0 |
| `docs.api.*` | `npm run docs:api` | exit 0 |

Coverage non-regression: this task adds no `src/` code — `git diff --stat main...HEAD -- src jest.config.js
package.json` prints nothing — so the covered-line set is unchanged by construction.

### review-ready summary

- **BDD:** no feature file covers licensing (`grep -rli licen docs/02_requirements/02_bdd/features/` → no
  output); REQ-SYS-09 is verified by the packaging suites. Acceptance tests: `test/cli/license-file.test.ts`
  (8 cases) + `test/cli/publish-metadata.test.ts` (11) + `test/cli/npm-distribution.test.ts` — all green.
- **AC1** met — `LICENSE` with full MIT text and the copyright line the approver confirmed on 2026-09-17
  (via the orchestrator); 4 AC1 cases, red → green.
- **AC2** met — `package.json` `license`, `README.md` §License, `dna.yaml` `project.license` and `LICENSE`
  all MIT; nothing needed reconciling (grep evidence under `design`); 3 cases.
- **AC3** met — real pack lists `LICENSE`, `files` unchanged; 1 case.
- **AC4** met — allowlist updated (one filter term + header clause); guard shown red against `main`'s copy.
- **AC5** met — gates table above.
- Files touched outside this task file: `LICENSE` (new), `test/cli/license-file.test.ts` (new),
  `test/cli/publish-metadata.test.ts` (2 hunks, +3/−3).
- Left alone deliberately: `bug-022` (`npm-distribution.test.ts` packs without `--ignore-scripts`) and
  task-059's other two findings; `README.md` (owned by the `user-docs` gate, already agrees).

### second pass (after reject `a651335`) — role: developer

**Rejection reason (approver, `git show a651335`):** the LICENSE, its packing and the task-059 allowlist
change are correct, but the AC1 case "contains the grant, condition and disclaimer paragraphs unmodified"
only asserted containment, so a LICENSE with an extra restriction clause (appended, or inserted between
paragraphs) stayed 8/8 green and the "full, unmodified MIT text" clause of AC1 was not guarded. Replace
the three `toContain` checks with an equality check on the whole normalised file.

**Defect reproduced first, against the unchanged test** (backup copy in the session scratchpad,
restored afterwards):

```
$ printf '\nThe Software may not be used for commercial purposes.\n' >> LICENSE
$ npx jest test/cli/license-file.test.ts
Tests:       8 passed, 8 total
$ cp <scratchpad>/LICENSE.orig LICENSE
```

**red** — commit `daf7057 test(cli): task-070-license-file — failing test for a LICENSE with an added
clause (whole-file equality)`. The three `toContain` checks became one case,
`is exactly the MIT text — nothing added, removed or reordered`:
`expect(normalise(licenseText())).toBe(normalise(['MIT License', COPYRIGHT_LINE, MIT_GRANT, MIT_CONDITION, MIT_DISCLAIMER].join(' ')))`.
Classification unchanged (AC1 red-first). Mutation evidence with the new assertion:

```
== appended clause   (printf '\nThe Software may not be used for commercial purposes.\n' >> LICENSE)
  ● LICENSE file (task-070) — AC1 full MIT text › is exactly the MIT text — nothing added, removed or reordered
Tests:       1 failed, 7 passed, 8 total
== inserted clause   (same sentence inserted after "copies or substantial portions of the Software.", before the disclaimer)
  ● LICENSE file (task-070) — AC1 full MIT text › is exactly the MIT text — nothing added, removed or reordered
Tests:       1 failed, 7 passed, 8 total
$ cp <scratchpad>/LICENSE.orig LICENSE && git diff --quiet -- LICENSE && echo restored
LICENSE restored (git diff --quiet exit 0)
== restored
Tests:       8 passed, 8 total
```

**green** — no production change: `LICENSE` was already correct (approver-verified), so the unmutated file
passes. `LICENSE`, packing behaviour and `test/cli/publish-metadata.test.ts` untouched in this pass
(`git diff --stat febfff1 daf7057` → only `test/cli/license-file.test.ts`).

**Optional item (second `npm pack`) — not done.** The two suites run in separate jest module registries,
so reusing `publish-metadata.test.ts`'s memoized manifest would need a new shared helper or a
cross-suite cache; not trivial, and it would widen the edit into the file `task-060` may touch.

**main sync (`dl-035`):** `git merge main` (main at `f4b3613`) → merge commit `76febe6`, no conflicts
(brought in `spec-006`, `spec-008` only); `npm ci` re-run.

**Gates after the merge:**

| Check | Command | Result |
|---|---|---|
| `tests.passing` | `npx jest` | `Test Suites: 81 passed, 81 total` · `Tests: 1096 passed, 1096 total` |
| `tests.coverage(min: 80)` | `npx jest --coverage --maxWorkers=4` | exit 0 · **98.29 / 90.18 / 98.44 / 98.93** (stmts/branches/funcs/lines) — unchanged |
| build types | `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| full types | `npx tsc --noEmit -p tsconfig.json` | exit 2 — only `bug-026` `test/core/directive-create.test.ts(159,19) TS2339` |
| `lint.clean` | `npm run lint` | exit 0 |
| `docs.api.*` | `npm run docs:api` | exit 0 |

### review-ready summary (second pass)

- Rejection addressed: AC1's text check is whole-file equality; both mutation shapes named in the reason
  (appended, inserted between paragraphs) now fail, and the real LICENSE passes.
- AC2–AC5 verdicts from the first pass stand; nothing they cover was touched.
- `memory.submit` clears `rejection_reason` (CLAUDE.md §5.1).
