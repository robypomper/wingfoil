---
id: "task-070-license-file"
type: task
title: "Add the MIT LICENSE file the package claims but does not ship"
status: in-progress
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
