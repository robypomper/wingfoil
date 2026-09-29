---
id: "dl-119-a-git-conventions-directive"
type: decision-log
title: "Three ratified decision-logs are permanent git conventions that no directive carries — a `git-conventions` directive states them, with the rule that no one writes a git identity into the repository"
status: ready
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed by the v0.2 retrospective (`retro-v0.2`). Its dispositions record that three `ready`
decision-logs are standing git conventions rather than one-off decisions. The approver ruled on
2026-09-28 that they become a new directive, `git-conventions`, bound to `developer`. The three
decision-logs stay `ready` and are cited, following the `task-094` precedent.

**The three rules, and where they live today.**

- `dl-024-git-branch-tag-conventions` (`ready`). One branch per phase, named
  `design/<phase>_<version>`, merged with `--no-ff`. The version tag is made on `main`, never on a
  phase branch. Since its 2026-09-28 amendment (`dl-074` Action 3), the tag is made only after `main`
  has been pushed to `origin`.
- `dl-035-task-branch-sync-with-main` (`ready`, approved at `82149a2a`). A branch that has fallen
  behind merges `main`. It is never rebased while it carries `wf()` commits. The sync happens when a
  task resumes after a reject, and again before re-submitting if `main` has moved.
- `dl-054-submit-commit-subject-bracket` (`ready`, approved at `194ff913`). The `[from → to]` bracket
  belongs to the approver-gated verbs (`approve`, `reject`, `deprecate`), never to `add` or `submit`.
  `spec-004` §4.3 writes it with `→`, and `BRACKET_RE` in `src/memory/audit.ts` reads only that
  arrow.

Only `dl-024` reached any configuration file:
`git grep -l dl-024 a20b346c -- docs/self/.wingfoil` lists `sw-life-cycle.yaml`,
`release-cycle.yaml` and `release-publishing.yaml`, each as a comment or an action. The same command
for `dl-035` or `dl-054` prints nothing (exit 1). None of the three is in a directive. So an agent
executing as `developer` loads no git rule at all.

**What practice did instead.** Measured at `a20b346c`, the first-parent merge commits into `main`,
counted by branch prefix, are: `task` 108, `design` 21, `ingest` 9, `docs` 8, `fix` 3, `backlog` 3 and `qa` 1. The
command is
`git log --merges --first-parent a20b346c --format=%s | sed -nE "s/^Merge branch '([^']+)'.*/\1/p" | sed -E 's#/.*##' | sort | uniq -c`.
A branch merged several times counts once per merge. Phase branches such as `qa/e2e-smoke-v0.2` and
`docs/user-docs-v0.2` do not follow `dl-024`'s `design/<phase>_<version>` pattern. The same kind of
work also appears under two prefixes: ingest mains ran on `ingest/dl-075-line-offsets` and on
`design/bug_ingest_publish_run_v0.2`. The rule was never in front of whoever named them.

**A fourth rule, from the same retrospective.** The retrospective found an identity outside
`team.members` written into the repository's shared git configuration.
`dl-094-one-author-identity-per-act` decides which identity each act carries. The approver ruled on
2026-09-28 that one half of the remedy is a standing convention for this directive: reproductions
pass identity per command, never through `git config`. The reason is mechanical. `git config` run
inside a worktree writes to the configuration shared by every worktree of the repository. The
retrospective's own plan records that hazard (`retrospective-rel-v0.2-plan` §7.9).

## Decision

A new directive, `docs/self/.wingfoil/directives/custom/git-conventions.md` (`kind: custom`), states
the following. Each clause cites the decision-log that argued it, and those decision-logs stay
`ready`.

1. **Branches.** A `dev-loop` task runs on `task/<task-id>`, cut from `main`. A workflow phase runs on
   its own branch. Both merge into `main` with `--no-ff`. The phase-branch naming follows Q1 below
   (`dl-024`).
2. **Staying current.** Bring a branch up to date with `git merge --no-edit main`. Never rebase a
   branch that carries `wf()` commits. Sync when work resumes after a reject, and again before
   re-submitting if `main` has moved (`dl-035`).
3. **Tags.** A version tag is created on `main`, after the release's last phase branch has merged and
   after `main` has been pushed to `origin`. It is never created on a phase branch (`dl-024`, as
   amended by `dl-074`).
4. **Memory-operation subjects.** Use the `wf({type}): {verb} {ids}` form. `approve`, `reject` and
   `deprecate` end in a `[{from} → {to}]` bracket, written with `→` as in `spec-004` §4.3. `add` and
   `submit` carry none (`dl-054`). Which verbs beyond the declared five are legal is not decided here;
   `dl-079-wf-commit-verbs-outside-the-declared-grammar` owns that question.
5. **Identity.** Never write `user.name` or `user.email` with `git config` inside the repository or
   any of its worktrees. A command that needs a throw-away identity passes it for that command only,
   through `GIT_AUTHOR_NAME` / `GIT_AUTHOR_EMAIL` / `GIT_COMMITTER_NAME` / `GIT_COMMITTER_EMAIL` or
   `git -c user.email=… commit`, and runs in a throw-away repository. Which identity a real act
   carries is `dl-094`'s rule; this clause only keeps a test identity from leaking into it.

**Q1 — phase-branch prefixes.**

- **(a) Hold `dl-024` as written.** Every phase branch is `design/<phase>_<version>`, and the
  practised `qa/`, `docs/`, `backlog/`, `ingest/` and `fix/` prefixes are deviations to stop.
- **(b) Ratify a closed list of prefixes**, each with its meaning: `task/` for a dev-loop task,
  `design/` for a lifecycle phase, `ingest/` for an ingest main, `fix/` for an out-of-band fix,
  `docs/` for a documentation-only change, `qa/` for a quality gate, and `backlog/` for scheduling
  work. This amends `dl-024` rule 1 by citation, and `dl-024` stays `ready`.
- **(c) Free prefix, fixed suffix.** Only `<name>_<version>` or `<id>` after the slash is
  prescribed.

**Q2 — which roles load it.**

- **(a) `developer`,** as the retrospective disposed.
- **(b) Global,** in `roles.yaml` `global:`, alongside `doc-versioning` and `claim-evidence`.

**Recommendation: Q1 (b), Q2 (b).**

- **Q1 (b)** describes every prefix in use on `main`, where (a) describes 21 of the 45 non-task
  merge commits. A closed list still makes an unknown prefix a visible deviation, which is all the
  naming rule is for. It must also say which prefix an ingest main uses, since practice used two.
- **Q2 (b):** clauses 4 and 5 bind whoever commits, not only `developer`. `approve` commits are
  written for the `approver`, retrospective captures by the `facilitator`, and decision-log captures
  by `product-owner`. None of those roles loads a `developer` directive. (b) widens the disposition,
  which is why it is put as a question rather than assumed. Declare it global in `roles.yaml` only,
  not also as a `scope: global` frontmatter field, until `bug-148` settles which of the two
  declarations wins.

## Rationale

- **A ratified rule nobody loads is not a rule.** `dl-035` and `dl-054` are cited in no
  configuration file at all, so each new session learns them from a brief or not at all. The
  branch-prefix measurement shows what that costs: a ratified naming rule followed by 21 of the 45
  non-task merge commits.
- **The directive states and the decision-log argues.** This is the split `command-baseline` and
  `dl-080` already use. It keeps the argument (alternatives, measurements, the approver's `Reason:`)
  where it was ratified, and puts a short, loadable rule where the role meets it. So the three
  decision-logs are cited and not deprecated.
- **The identity clause belongs with git rules, not with `dl-094`'s policy.** `dl-094` decides whose
  identity an act carries. This clause is the mechanical habit that keeps a reproduction from
  changing it. It applies to every repository WingFoil develops, which is what a directive is for.

**Enforcement caveat.** A directive has no enforcement point today. Nothing loads one into an agent's
context, because P3.6 (auto-load by role) is not built:
`git show a20b346c:src/core/index.ts | grep -c agentExecute` prints `0`, while the same command with
`memoryApprove` prints `7`. No hook or CI job reads a commit or a branch name:
`git ls-tree -r --name-only a20b346c | grep -ciE 'husky|pre-commit|lefthook|commitlint'` prints `0`,
while the same pipe with `publish.yml` prints `1`. Clauses 4 and 5 are exactly the kind of check a
`wf()` commit hook could run. That enforcement point is `dl-103-governance-enforced-outside-the-agent`
(with `dl-097-claim-evidence-needs-an-enforcement-point`), not this decision.

## Actions

1. **Ratify, choosing Q1 and Q2.** Owner: approver. The choice goes in the approve commit's `Reason:`.
2. **On ratification, create `docs/self/.wingfoil/directives/custom/git-conventions.md`**, with
   clauses 1–5 and a header naming `dl-024`, `dl-035`, `dl-054` and `dl-094` as where each rule is
   argued, in the form `command-baseline.md` uses for `dl-080`.
3. **Change `docs/self/.wingfoil/roles.yaml`** to bind it per Q2, and bump its `version`.
4. **Replace the `dl-024` comments** in `sw-life-cycle.yaml` and `release-cycle.yaml` with a pointer
   to the directive, if Q1 changes the naming they describe, and bump each file's `version`.
5. `dl-024`, `dl-035` and `dl-054` are **not** transitioned: they stay `ready` and are cited.
6. Tasks are derived by v0.3 `release-planning` (`build-backlog`), not created here.

## Relations

- **Origin:** `retro-v0.2`.
- **Absorbs, by citation:** `dl-024-git-branch-tag-conventions`, `dl-035-task-branch-sync-with-main`,
  `dl-054-submit-commit-subject-bracket`; the identity-per-command half of
  `dl-094-one-author-identity-per-act`.
- **Filed under:** `dl-118-choosing-between-decision-log-bug-and-directive`, rule 3.
- **Precedent:** `task-094` / `dl-080` (`command-baseline`).
- **Overlaps:** `code-quality.md` already carries one git bullet at `a20b346c` ("Use conventional
  commit messages; every state change is a single git commit carrying author + timestamp"). The
  directive task decides whether that bullet moves here or is cited from here; it is not duplicated.
- **Related:** `dl-079` (the `wf()` verb grammar); `bug-137-bracket-regex-skips-ascii-arrow-transitions`
  (the read side of clause 4); `dl-092-tracking-a-patch-after-its-minor-is-released`, whose
  parallel-release rule is a candidate later clause; `dl-101-id-allocation-across-refs`;
  `bug-148-directive-global-scope-declared-twice`.
- **Enforcement:** `dl-103-governance-enforced-outside-the-agent`,
  `dl-097-claim-evidence-needs-an-enforcement-point`.
- **Traceability:** P3.5, P3.7; REQ-SYS-08; REQ-SEC-01 (git identity on every state change).
