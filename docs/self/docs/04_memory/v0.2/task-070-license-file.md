---
id: "task-070-license-file"
type: task
title: "Add the MIT LICENSE file the package claims but does not ship"
status: pending
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
