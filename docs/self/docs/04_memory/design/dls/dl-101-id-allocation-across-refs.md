---
id: "dl-101-id-allocation-across-refs"
type: decision-log
title: "Memory ids are allocated per branch, so parallel sessions collide; allocation checks every ref and remote, an id is cited only once its element exists, and a tool-side allocator follows"
status: ready
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed by the v0.2 retrospective (`retro-v0.2`), from its finding that one sequential id was taken
more than once. The approver ruled on 2026-09-28 that allocation follows a rule across all refs
and remotes now, with a tool-side allocator later.

### Three collisions, two causes

Every sequential Memory id (`dl-NNN`, `bug-NNN`, `task-NNN`) is the next number after what the
allocating session can see. The v0.2 era produced three collisions:

1. **`dl-080`, allocated on two branches.** `main` holds `dl-080-which-baseline-each-command-reads`.
   A parallel session filed a different proposal under the same number, on a branch that was never
   merged. The approver ruled on 2026-09-28 that the proposal is not merged and the branch is removed
   at this retrospective's close-out. While the branch existed, this all-refs scan found the pair:

   ```sh
   for r in $(git branch -a --format='%(refname:short)'); do
     git ls-tree -r --name-only "$r" -- docs/self/docs/04_memory/; done \
     | sed -nE 's#.*/((dl|bug|task|adr|spec)-[0-9]+)-.*\.md#\1 &#p' | sort -u | awk '{print $1}' | uniq -d
   ```

   It printed `dl-080` and nothing else. So the command works, and the absence of other duplicates
   at that moment is meaningful.
2. **`dl-088`, allocated by this retrospective and by a parallel session.** This retrospective filed
   its release-health decision-log as `dl-088` (`1c586896` add, `d4c8f220` submit), after the
   all-refs scan gave 088 as the next free number. A parallel session then pushed its own `dl-088`,
   for an external-state Memory type, on a branch since withdrawn. The unpushed element yielded: it
   was renumbered to `dl-089` at `5e6703e5`, and the external-state decision is re-filed by this
   retrospective as `dl-088-a-memory-type-for-state-that-lives-outside-the-repository`. The scan was
   run correctly and still lost, because an allocation nobody has pushed is invisible to it.
3. **An id cited by a document before its element existed.** A release-health data document,
   supplied to this retrospective from outside the repository, called itself the baseline of
   `dl-087-release-health-analyses-before-retrospective`. No element with that id was created on any
   branch. The scan's file list grepped for `dl-087-release-health` prints nothing, and the same list
   grepped for `dl-087` finds `dl-087-publish-through-npm-staged-publishing`. The number was free at
   the document's measurement point: `git ls-tree -r --name-only 5269223d --
   docs/self/docs/04_memory/design/dls/ | grep -c dl-087` gives `0`, while `grep -c dl-086` on the
   same list gives `1`. `main` then assigned it to the publishing decision at `a567a987`. A file scan
   cannot see this kind of collision at all, because the id lived only inside a document's text.

The first two have one cause: an id is claimed by creating a file on a branch, and other sessions
see it only after a push. The third has another: an id was used as a name before anything claimed
it.

### What the tool does today

`memory add` numbers an element with `nextSequenceNumber` (`src/memory/add.ts`). That function
counts the files matching the type's `id_pattern` in the type's directory of the *checkout*, and
adds one. Two checkouts that have not exchanged commits compute the same number. The tool therefore
has the same per-branch property as the hand procedure, and BDD P1.3 (*a generated unique id*)
holds only within one branch.

## Decision

### 1. The allocation rule, followed by hand and by every agent, from now on

1. **Fetch, then scan every ref.** Run `git fetch --all --prune`, then run the all-refs scan above
   restricted to the type's directory, and take the highest number plus one. The fetch matters:
   `git branch -a` lists only the remote-tracking refs already fetched.
2. **Push the `add` commit at once**, on its branch, so the next session's scan sees it. Until it
   is pushed, the id is only a local proposal.
3. **Re-scan immediately before merging.** On a collision the element that was pushed later yields
   and is renumbered on its own branch, with a commit that names both ids. Its `add`/`submit`
   history is kept.
4. **Cite no id before its element exists.** A draft, a data file or a plan refers to "the
   decision-log this proposes", never to a number, until `memory add` has created the file. An id
   cited in text and never created is a collision waiting to happen, and no file scan can see it.
5. **Agents do not allocate in parallel worktrees.** They report proposed elements, and a single
   orchestrating session files them. This is the practice that kept v0.2's parallel task
   worktrees collision-free.

### 2. A tool-side allocator, later

The approver chooses the direction. The build is scheduled separately.

- **(a) Scan every ref in `nextSequenceNumber`.** Take the highest number across local and
  remote-tracking refs, not the count of files in the checkout. Using the highest number also
  removes the risk of re-issuing a number after a deletion, which the count has. This is
  deterministic for a given set of refs, but it reads committed refs rather than the working tree,
  so it needs a declared baseline under `command-baseline` (`dl-080`). It closes collision 1, and
  also 2 when the other session has pushed.
- **(b) Reserve through the remote.** `memory add` pushes a reservation ref, such as
  `refs/wingfoil/ids/dl-090`. A push that finds the ref already present fails, so allocation is
  atomic across every session sharing the remote. This closes 1 and 2 outright. It needs network
  access at `add` time and a rule for offline work.
- **(c) Non-sequential ids** (slug only, or a hash suffix). Collision-free by construction, but it
  gives up the ordered, citable `NNN` the whole corpus uses. Not recommended.

**Recommendation: (a) in v0.3, with (b) evaluated when the workflow engine runs parallel sessions
itself.** Neither closes collision 3. Only the rule in §1.4 does.

## Rationale

- Three collisions in one release, one of them hit by a session that followed the scan procedure
  exactly, show that the hand procedure lowers the risk without removing it. The rule states what
  the procedure cannot cover, which is unpushed work and cited-but-uncreated ids, so that the
  remedy for each is explicit.
- The citation rule costs nothing and is the only defence against the third kind.
- Moving the scan into `memory add` makes the verb do what the BDD scenario already promises. The
  remote reservation is the only complete answer, and it is heavier, so it waits for the case that
  needs it.

## Actions

1. **Ratify, choosing the direction in §2.** Owner: approver. The choice goes in the approve
   commit's `Reason:`.
2. **Write §1 into a directive.** It belongs in the `git-conventions` directive proposed by
   `dl-119-a-git-conventions-directive`, or in `traceability` if that one is not ratified.
3. **Under (a) or (b):** amend `nextSequenceNumber` and `memory add`, with a scenario in
   `P1.3-memory-add.feature` for a number already taken on another ref, and record the baseline
   under `command-baseline`.
4. **Add the duplicate-id scan to `dl-089`'s release-health catalogue**, whose G15 metric already
   names ids allocated twice across branches.
5. **Tasks are derived by v0.3 `release-planning` (`build-backlog`)**, not created here.

## Relations

- **Origin:** `retro-v0.2`, the finding on id collisions; `retrospective-rel-v0.2-plan` §2.4 (the
  all-refs scan) and §6.4 (the `dl-080` disposition).
- **Related:** `dl-119-a-git-conventions-directive`; `dl-080-which-baseline-each-command-reads` (the
  baseline an all-refs allocator reads); `dl-089-release-health-analyses-before-retrospective`
  (G15); `dl-035-task-branch-sync-with-main`.
- **Traceability:** P1.3 (`memory add` generates a unique id), REQ-SYS-01 (git as the single
  source of truth).
