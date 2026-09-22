---
id: "dl-074-tag-must-be-on-pushed-main"
type: decision-log
title: "The release gate asserts the tag is on the *pushed* `main`, while spec-015 §4 and dl-024 say only \"on `main`\" — a release precondition no document states"
status: ready
context: "release-governance"
release: "v0.2"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`.github/workflows/publish.yml`'s first gate step is:

```
$ sed -n '120,123p' .github/workflows/publish.yml
      - name: Tag commit is on main (dl-024)
        run: |
          git fetch --no-tags origin main
          git merge-base --is-ancestor "$GITHUB_SHA" origin/main
```

The assertion is against **`origin/main`** — the remote-tracking ref the job has just fetched, i.e. the
*pushed* `main`. The two documents that specify the rule say something weaker:

```
$ sed -n '106,108p' docs/.../specs/spec-015-packaging-publishing.md
- The publish trigger is an annotated git tag `vX.Y.Z` created **on `main`** after the release branch
  merges (`dl-024`; never on a `design/*` branch). Tag ↔ `package.json` `version` must match (CI
  asserts this before promote).
```

and `dl-024-git-branch-tag-conventions` decision 2: "Version tag on `main`, never on a phase branch …
the tag always points at a commit reachable from `main`'s permanent history". Neither says *pushed*.
A developer who satisfies both documents to the letter — merge the release branch into local `main`,
tag it, push the tag — gets a release rejected by its own gate.

### Measured evidence

**E1 — the gap is real, and much wider than when it was found.** Measured in this ingest's worktree of
`main` at `b505473`, after `git fetch origin`:

```
$ git rev-list --count origin/main..main
83
$ git rev-parse origin/main main
7bb95d6eb92acfc7a358de07cb5137ca308b210c        # origin/main
b505473988d4ff9ccea24b56d67d457e8bca3d41        # local main
```

Eighty-three commits on local `main` have never been pushed, and `origin/main` has not moved since
`task-077` measured it. A `vX.Y.Z` tag cut from today's local `main` would fail this gate.

**E2 — the gap has grown monotonically across three measurements**, which is the argument against
treating it as a transient state of the repository:

| When | Measured by | `origin/main..main` |
|---|---|---|
| during `task-077`'s run | `task-077-first-real-staging-run` | **4** |
| at review | reviewer, `ac10060` | **9** |
| this ingest, at `b505473` | here, `git rev-list --count` | **83** |

**E3 — the check itself is sound and passes for a pushed commit.** `task-077` ran the *unmodified*
workflow from a clone checked out at `a7d783a`, a commit that is on `origin/main`:

```
[publish/gate] ✅  Success - Main Tag commit is on main (dl-024) [793.559894ms]
[publish/gate] ✅  Success - Main Tag matches package.json version (spec-015 §4) [292.090899ms]
$ git merge-base --is-ancestor a7d783a origin/main ; echo EXIT=$?    # EXIT=0  — passes
$ git merge-base --is-ancestor <local main> origin/main ; echo EXIT=$?  # EXIT=1 — fails
```

So this is not a defect in the check. The check is the strictly correct one: it is the only version of
"on `main`" a CI job *can* evaluate, since the job has no access to anyone's local repository, and the
weaker readings would all be unenforceable. The gap is in the documents, and in the release procedure
they describe.

**E4 — nothing else states the precondition either.** The workflow header comes closest, and says it
about `act`, not about releasing:

```
$ sed -n '88,90p' .github/workflows/publish.yml
#   The gate's "tag is on main" check needs a local `main` pushed to `origin`; for a dry iteration on a
#   branch, run `npm run prepublishOnly` and `npm run publish:staging` directly instead — they are the
#   same commands the gate and stage jobs run.
```

`dl-068`'s Action 3 ("push the local history to `origin` before the first publish") is the nearest
governance statement, but it is about the remote being *empty* — a one-off bootstrap, now done — not
about `main` being *current* at every tag.

## Decision

The gate stays as written; what changes is where the precondition is recorded. Three options are open;
the approver's choice is recorded in this document's approve commit `Reason:`.

### (a) State the precondition in `spec-015` §4 — recommended

Amend §4's tag bullet to read that the tag is created on `main` **and that `main` must be pushed to
`origin` before the tag is pushed**, because the gate asserts ancestry of `origin/main`. Mirror one
sentence into `dl-024`'s decision 2, or leave `dl-024` as the branch-convention decision and let
`spec-015` own the release-procedure detail.

*Cost:* `spec-015` is `approved`, so this is a dated revision note plus re-ratification — the route
`dl-068` Action 1 takes, and the one `dl-047-tech-specs-carry-no-version-field` is still settling
(`in-discussion` at `b505473`, so the mechanism itself is not yet ratified). `dl-024` is `ready`, same
route. It changes no code and cannot regress anything. It also does nothing
to *prevent* the mistake — it only makes it a documented one, discovered at tag-push time rather than
after a public failure.

### (b) Have the release procedure make the state true, rather than documenting it

Add a step that pushes `main` immediately before the tag — in the `release-publishing` phase's plan, in
the approver runbook in `publish.yml`'s header, or as a `release-submit`/`release-publishing` workflow
check that fails when `git rev-list --count origin/main..main` is non-zero.

*Cost:* the honest version of this is the workflow check, and there is no workflow engine to run it
(CLAUDE.md §6) — so today it would be a line in a phase plan, which is exactly as enforceable as (a).
A pre-push git hook is not an option: hooks are not versioned with the repository and `REQ-SEC-07`'s
removability discriminator says nothing about them.

### (c) Weaken the gate to match the documents

Compare against something other than `origin/main` — e.g. accept any commit reachable from the tag's
own merge history, or fetch and compare against the default branch by name without requiring ancestry.

*Not recommended, stated so it is on the record as considered.* Every weaker check either passes a tag
cut on a `design/*` branch — the exact failure `dl-024` decision 2 exists to prevent — or cannot be
evaluated from CI at all. `adr-009` clause 1 ("no publish ever runs from a `design/*` phase branch")
leans on this assertion. Weakening it trades a documented precondition for a silent hole.

## Rationale

- **The check is the only enforceable reading.** E3: from inside the job, "on `main`" can only mean
  "on the `main` the server has". Any other reading is a statement about a machine the gate cannot see.
- **The documents, not the code, are what is wrong.** `spec-015` §4 and `dl-024` both describe a
  developer-side action (where you cut the tag) and are silent about a server-side precondition (what
  the server must already have). A reader following them exactly is led into a failing release.
- **The gap is not self-correcting.** E2: 4 → 9 → 83 unpushed commits over the life of this wave. The
  repository's normal working mode leaves `main` ahead of `origin/main` by a large margin, so "it will
  be pushed by then" is not a safe assumption to leave unwritten.
- **The failure mode is benign but badly timed.** A rejected gate publishes nothing — this is a
  fail-closed check — but it fails during a release, which is the one moment `dl-056` exists to keep
  free of surprises, and the remedy (`git push origin main`) is invisible from the error message
  `git merge-base --is-ancestor` produces, which is a bare exit 1 with no output.

## Actions

1. **Choose (a), (b), or both.** Owner: approver; the choice belongs in this document's approve commit
   `Reason:`.
2. **On (a): amend `spec-015` §4** with a dated revision note and re-ratify. Candidate
   carrier: `task-079-spec-015-staging-and-node-floor-corrections` (`backlog`, `v0.2`), which already
   opens `spec-015` for amendment this release — if it has not landed, otherwise a new task.
3. **Mirror the sentence into `dl-024`** or record explicitly that `spec-015` owns it. Owner: approver.
4. **Re-measure E1 before tagging, not from this document.** The number here is pinned to `b505473` on
   2026-09-21 and will be wrong by the time anyone acts on it; the command is
   `git rev-list --count origin/main..main`, and the precondition is that it reads `0`.

## Relations

- **Derives from:** `task-077-first-real-staging-run` (`done`) finding **F6**, and its approve commit
  `ac10060`, which confirmed it and widened it ("a tag cut from today's local main would be rejected by
  its own gate").
- **Constrains / amends:** `spec-015-packaging-publishing` (`approved`) §4;
  `dl-024-git-branch-tag-conventions` (`ready`) decision 2.
- **Adjacent:** `dl-068-publishing-requires-public-repository` (`in-discussion`) Action 3 — the same
  remote, but the bootstrap case; `adr-009-npm-publishing-pipeline` (`accepted`) clause 1, which this
  assertion enforces; `dl-056-first-real-publishing-run` (`ready`), whose checklist is where a
  precondition like this would naturally be read.
- **Traceability:** REQ-SYS-09 (distribution as an npm package, the pipeline this gates).
