---
id: "task-090-fix-approval-authority-baseline"
type: task
title: "Resolve the approval authority against a committed state, so an `Approver:` line cannot rest on an uncommitted `dna.yaml`"
status: in-review
release: "v0.2"
priority: "high"
tags: ["v0.2", "memory", "security", "audit-trail"]
ref: "bug-079-uncommitted-dna-yaml-grants-approval-authority"
bug: ["bug-079-uncommitted-dna-yaml-grants-approval-authority"]
depends_on: ["task-088-fix-gated-verbs-commit-only-the-status-change"]
tmpl_version: 260703
---

## Description

The approval-authority check reads `dna.yaml` from the working tree, so an **uncommitted** edit
granting the current git identity the `approver` role is enough: `memory approve` proceeds and writes
`Approver: <name> <email> (approver)` into a permanent commit. The commit attests an authority that no
committed state of the repository records.

`task-088` does not close this. Its guard is deliberately *per-path* — it refuses when the **element**
being transitioned is modified — and `dna.yaml` is a different path. The remedy here is not a wider
guard but a different **baseline** for this particular read.

Declared a release blocker for `minor-v0.2`, at `critical`: the release ships the approval verbs, and
**P1.7** requires an approval to record approver identity while `adr-006-git-identity-role-based-authz`
makes that identity the basis of authorisation. An `Approver:` line no committed state supports is the
failure of the guarantee the feature exists to provide.

## Acceptance Criteria

- **AC1** — Reproduce first, on a scratch project, against a build of `main` that already contains
  `task-088` — the point being that its fix does not close this. Record the commands, the resulting
  commit body, and the committed `dna.yaml` at that commit still showing the identity is not an
  approver. A scratch project is required (`bug-075`).
- **AC2** — **Choose the baseline and argue it.** Two shapes, and they are not equivalent:
  - *(a)* resolve authority from the **committed** `dna.yaml` — at `HEAD`, or at the commit being
    produced — so the working tree cannot influence it;
  - *(b)* **refuse** the verb while `dna.yaml` carries uncommitted modifications, following the shape
    `task-088` established for the element.

  Weigh them against what each does to a legitimate flow: a project that has just run `init` and is
  seeding its first approver, a developer editing `dna.yaml` for unrelated reasons mid-review, and a
  CI checkout where nothing is ever dirty. Say what the rejected option would have been better at.
- **AC3** — After the fix, the reproduction from AC1 fails closed: the verb refuses, or resolves the
  authority from the committed state and refuses because the identity is not an approver there. Exit
  code per **`spec-005` §1** — `1` for a well-formed invocation that fails validation; do **not**
  emit `2`, which that spec reserves for a malformed invocation. This was ruled on `bug-076` and
  applies unchanged.
- **AC4** — **The bootstrap case must still work.** A fresh project has `team.members: []` and nobody
  is an approver; whatever you choose must leave a legitimate path to seeding the first approver, and
  a test must pin it. If your choice makes that path awkward, say so plainly rather than declaring it
  out of scope — it is the one flow every new user hits.
- **AC5** — Establish whether any **other** authority or policy read has the same baseline problem —
  `roles.yaml` bindings, and any directive or workflow read that gates behaviour. Report each with the
  command that settles it. Fix only what falls inside this task's argument; file the rest.
- **AC6** — A test pins the defect itself and fails against the current code. State the command
  showing it red before and green after.
- **AC7** — Nothing in this repository's own history is re-verified against the new rule or rewritten.
  Every approval here was made by hand; `dl-035` forbids rewriting merged `wf` commits regardless.
- **AC8** — All six gates green; the full `tsc --noEmit -p tsconfig.json` silent.

## Implementation Notes

- Read `task-088`'s Execution Notes first (`dl-015` read_related): it established the guard shape, the
  committed-tree postcondition, and the reasoning for keeping the guard per-path — which is precisely
  why this defect survived it.
- `requireApprovalAuthority` and `readGitIdentity` are the primitives to start from; find their read
  path rather than assuming which file layer serves them.
- `bug-078` covers the same root cause on the **write** side for the non-transition verbs and is *not*
  in scope. If your fix suggests a general rule about which baseline a command reads, that is a
  decision-log worth proposing — propose it, do not enact it.
- Classify every AC per `dl-014`/T1. AC1, AC3 and AC6 are red-first by construction.

## Execution Notes

<!-- filled in per phase -->

### start — role: developer

`status: backlog → in-progress` (`fce5f0c`). `bug:` is non-empty, so `bug.sync_state` ran as its own
commit: `bug-079` `planned → in-progress` (`23d19b5`).

Worktree `/home/robypomper/Workspaces/.wf2-wt/task-090`, branch
`task/task-090-fix-approval-authority-baseline`, from `main` at `59d4d5a` — which already contains
`task-088`'s merge (`a146f12`), the precondition AC1 rests on.
`npm ci --prefer-offline --no-audit --no-fund` → exit 0.

### design — role: architect

Directives loaded: architecture, determinism, traceability (architect); code-quality, testing,
determinism (developer); doc-versioning, documentation, security-secrets (global).

#### `read_related` (`dl-015`, HARD gate)

- **`task-088-fix-gated-verbs-commit-only-the-status-change` (`done`) — Execution Notes read in
  full**, the only entry in `depends_on`. What I took from it:
  1. **Why this defect survived it, in its own words.** Its review summary lists as weak spot 1: "The
     guard is per-path, deliberately. A dirty `dna.yaml` or an unrelated dirty document does not block
     a transition — only the element being transitioned does." So the survival of `bug-079` is a
     recorded consequence of that task's scope, not an oversight, and AC1 below measures it rather
     than assuming it.
  2. **The primitives to build on.** Its `green` table put the git read primitives in
     `src/storage/commit.ts` — `readPathAtRev(root, rev, path)` (a sha, `HEAD`, or the index stage
     `:0`), `pathPorcelainStatus`, `commitParent`, `changedPathsBetween` — precisely so a caller can
     ask what a *committed* tree holds. `readPathAtRev(root, 'HEAD', …)` is exactly the read this
     task needs; nothing new is invented at the git layer.
  3. **The postcondition that makes `HEAD` and "the commit being produced" the same answer.**
     `verifyCommittedScope` asserts the new commit changes exactly the element path. So the approve
     commit carries `.wingfoil/dna.yaml` byte-identical to its parent's, and "resolve authority at
     `HEAD`" and "resolve it at the commit being produced" — the two shapes `bug-079`'s Expected
     Behavior offers — cannot diverge. That is a dependency in the literal sense: without task-088's
     check, option (a) would have had to choose between them. Pinned as a test (`red` §, the
     corroboration case) rather than left as an argument.
  4. **The exit-code precedent, which AC3 also cites.** task-088 returned `1` where its own AC said
     `2`, on the ground that `spec-005` §1 partitions the codes by *what is wrong* and a repository-
     state precondition is not a malformed invocation. AC3 here instructs the same and says it was
     ruled on `bug-076`; nothing is re-argued.
  5. **A measurement gotcha reused.** Its `red` notes (from task-086) record that `execFileSync` +
     `catch` reads back `stderr: ''` for a command that exits `0` while printing to fd 2, so any
     CLI-level assertion about stderr uses `spawnSync`. Used below.
- **`bug-079-uncommitted-dna-yaml-grants-approval-authority` (source bug, `in-progress`) — read in
  full.** Its "Expected Behavior" offers the same two shapes as AC2 and declines to choose; its
  "Notes" fix the exposure as "the credibility of the trail, not access control", which is the frame
  the decision below is argued in. Its "Steps to Reproduce" are re-derived, not pasted (AC1).

#### `verify_specs`

No new `tech-spec` and no amendment to an approved one. Every rule this task enforces is already
written down; what is missing is that nothing said which *baseline* the authority read uses, and the
answer is derivable from an already-accepted ADR rather than needing a new one:

- **`adr-006-git-identity-role-based-authz`** (`accepted`, read at `59d4d5a`), Decision point 2, fixes
  approval authority as a role held through `dna.yaml`'s `team.members[].roles`. Its Consequences →
  Positive bullet states the property that decides this task: a fresh clone "reproduces the full audit
  trail with zero extra infrastructure". A clone contains committed state and nothing else, so an
  authority that lives only in a working tree is, by that sentence, not reproducible — the trail it
  supports cannot be re-derived from what was cloned. This task makes the code match the ADR rather
  than amending it.
- **REQ-SEC-03** (`docs/02_requirements/03_sard/05_security-compliance.md`) supplies the refusal's fit
  criterion, `user not authorized to approve type '<type>'`, which stays verbatim as the message's
  first sentence (see `green` on the added diagnostic).
- **`spec-005-cli-command-contract`** § "1. Exit-code contract (REQ-INT-04)" — **not** amended: every
  refusal added here is a well-formed invocation failing a repository-state precondition, i.e. exit
  `1`, per AC3 and the `bug-076` ruling.
- **`spec-010-memory-frontmatter-schema`** § "Field-write ownership" — untouched; this task changes no
  field-write scope.

`design` gate state: `frontmatter.required` (`title`, `release`) present; `depends_on.acknowledged`
satisfied above; `tech-spec.approved` — no spec scaffolded, so the approver gate passes through.

#### AC1 — the defect, reproduced end to end before anything was changed

Built this branch at its base (`npm run build`, exit 0 — no `src/` change yet, so the binary contains
`task-088`'s fix and nothing of this task's), then a throwaway project under the session scratchpad
(`bug-075`: the verbs cannot be pointed at this repository's own Memory).

```
$ git init -q . && git config user.name 'Test User' && git config user.email 'test@example.test'
$ node dist/cli.js init --template scrum        # exit 0; commits the scaffold, team.members: []
$ node dist/cli.js memory add --type adr --title 'Repro target'   -> adr-001-repro-target
$ node dist/cli.js memory submit adr-001-repro-target             -> draft → pending
# add the git identity to .wingfoil/dna.yaml's team.members with roles [developer, approver].
# NEVER committed:
$ git status --porcelain
 M .wingfoil/dna.yaml
$ node dist/cli.js memory approve adr-001-repro-target --reason 'authority from an uncommitted file'
{ "id": "adr-001-repro-target", …, "from": "pending", "to": "approved" }     exit 0
$ git log -1 --format='%B'
wf(adr): approve adr-001-repro-target [pending → approved]

Approver: Test User <test@example.test> (approver)
Reason: authority from an uncommitted file

$ git show HEAD:.wingfoil/dna.yaml | grep -n members
23:  members: []
```

Exactly what `bug-079` reports, and **`task-088`'s guard is visibly not the one in play**: the element
was clean (`git status --porcelain` names only `.wingfoil/dna.yaml`), so the per-path guard had
nothing to refuse. The commit attests an approver that `git show HEAD:.wingfoil/dna.yaml` — the
repository's own record, at that very commit — contradicts.

#### M1 — the same defect with no file to be dirty at all

Not in `bug-079`, found while establishing the baseline, and it is the extreme of the same read.
`.wingfoil/dna.yaml` need not be *modified*; it need not be **tracked**:

```
$ git rm --cached -q .wingfoil/dna.yaml && git commit -q -m 'remove dna.yaml from the tree (keep it on disk)'
$ git status --porcelain
?? .wingfoil/dna.yaml
$ git show HEAD:.wingfoil/dna.yaml ; echo $?
128                       # no committed dna.yaml anywhere in the repository
$ node dist/cli.js memory approve adr-003-m3-target --reason 'no committed dna.yaml at all'   -> exit 0
wf(adr): approve adr-003-m3-target [pending → approved]
Approver: Test User <test@example.test> (approver)
```

An `Approver:` line backed by a configuration file that exists in **no commit of the repository**.
Both options close it — `git status` reports `??`, which option (b) treats as modified — but only (a)
diagnoses it correctly, and it is the case that shows the question is "what does the repository
record", not "is the file dirty".

#### M2 — the read is wrong in the other direction too, and (a) changes behaviour there

Measured on the same build, with the approver grant **committed** this time and then withdrawn in the
working tree only:

```
$ git commit -q .wingfoil/dna.yaml -m 'seed approver (committed this time)'   # HEAD: roles [developer, approver]
# working-tree edit, uncommitted: roles [developer]
$ git status --porcelain
 M .wingfoil/dna.yaml
$ node dist/cli.js memory approve adr-002-m2-target --reason 'HEAD says I am an approver'
error: user not authorized to approve type 'adr'          exit 1
```

Today the verb refuses an approver **of record**, on the strength of an edit no one has committed.
That is not a security failure, but it is the same defect: the working tree, not the repository,
decides. Under (a) this case starts succeeding — a real behaviour change, stated here rather than
discovered by a reviewer — and it is correct under the rule the fix adopts: authority is what the
repository records. Under (b) it stays a refusal, but with an accurate message (`dna.yaml` is
modified) instead of a false claim about the user's roles.

#### AC2 — the decision: **(a)**, resolve authority from the committed `dna.yaml` at `HEAD`

**Chosen: (a)**, with the refusal message extended to name the baseline when the working tree
disagrees with it (which is how (a) recovers most of what (b) is better at — see below).

**What (b) would have been better at, stated plainly.**

1. **Telling a confused user the truth about their own screen.** Under (a), a user who has just added
   themselves to `dna.yaml` and not committed is told `user not authorized to approve type 'adr'`
   while the file open in their editor says otherwise. (b)'s message — "`dna.yaml` is modified" —
   describes the world the user is looking at. This is (b)'s real advantage and it is why the
   implementation below appends a second sentence naming the uncommitted grant; but note the recovery
   is one-directional. In M2's direction — the working tree *withdrawing* an authority `HEAD` grants
   — (a) is silently permissive and says nothing, because under its own rule there is nothing to
   report.
2. **One rule, uniformly, for every config read.** "Never act on configuration the repository has not
   recorded" is a single sentence that would also cover `memory.yaml`'s state machines and
   `dna.yaml`'s role catalogue (AC5 below), where (a) has to be argued read by read. That uniformity
   is exactly what `bug-078` and AC5's findings point at, and it is why the general rule is proposed
   as a decision-log rather than enacted here.
3. **Never being wrong about an unreadable committed file.** (a) must decide what to do when `HEAD`
   holds no `dna.yaml` (M1) or holds an invalid one; (b) never reads the committed file and so never
   faces the question. (a) fails closed in both cases, which is one more refusal path to get right.

**Why (a) wins anyway.**

1. **(b) is a guard; the bug asks for a baseline.** `bug-079`'s Expected Behavior opens "Authority is
   a property of the repository, not of a working tree." Under (b) the *read* still takes the working
   tree as its source; the guard merely arranges for the two to coincide at the instant of the call.
   The corroboration property — that `git show <approve-sha>:.wingfoil/dna.yaml` supports the
   `Approver:` line in that same commit — then holds as a *side effect of a precondition*, and any
   later call path that resolves authority without remembering to run the guard reopens the hole. Under
   (a) the property is intrinsic to the read: there is no code path, present or future, that can
   resolve authority from anything but a commit, because the function never opens the working-tree
   file for that purpose. This is the whole difference between the two options, and it is the reason
   the fix is in `requireApprovalAuthority`'s **signature** (it no longer accepts a `DnaYaml` from a
   caller) rather than in a check placed next to it.
2. **(b) refuses flows that are not defective.** `dna.yaml` is the project map — modules, stacks,
   paths, team. The mid-review developer who has added a module to it, or renamed a path, has changed
   nothing about who may approve, and (b) stops the approval anyway; at a release gate, a batch of
   approvals is blocked by an edit that is provably irrelevant to authority. (a) never refuses a case
   the repository actually supports. (The CI checkout, where nothing is ever dirty, cannot tell the
   options apart and is evidence for neither.)
3. **(a) answers the question that was asked.** "Is this identity an approver?" has an answer in the
   repository. (b) declines to answer it and reports a different fact — "the file is dirty" — which
   the user must translate. For the *authority* read specifically, refusing to answer a question the
   repository can answer is a worse trade than it is for the `bug-076` element case, where there was
   genuinely no well-defined answer to give (task-088 M1: two candidate baselines on disk that can
   disagree). Here there is exactly one candidate — the commit — and it is the one the audit trail is
   made of.
4. **The asymmetry with task-088 is real, not a stylistic break.** task-088 chose (b) for the
   *element being transitioned*, because the verb must **write** that file and there is no defensible
   way to write a file "as committed" while the user's edits sit on top of it. `dna.yaml` is only
   **read** here, and a read has a baseline available to it that a write does not. Same shape of
   defect, two different verbs of contact with the file, two different remedies — which is also why
   the general rule (AC5, `bug-078`) is worth stating once for all commands, and why it is proposed
   rather than enacted: read-vs-write is likely to be its hinge, and that is the approver's call.

**The deciding principle.** An approval commit is evidence. Evidence is worth what an independent
reader can re-derive from the artefact of record — a fresh clone, months later, with the working tree
gone. `adr-006`'s own Positive consequence ("a fresh clone reproduces the full audit trail with zero
extra infrastructure") states the standard; (a) is the option that makes the authority half of every
approval satisfy it by construction.

#### AC4 — the bootstrap case, and the one thing about it that is genuinely awkward

A fresh project scaffolds `team.members: []` (`git show HEAD:.wingfoil/dna.yaml` after `init`, AC1
transcript). The legitimate path to the first approver is unchanged by this task and **is not gated**:

```
$ grep -rn "requireApprovalAuthority(" src/
src/core/index.ts:799   (memoryApproveFn)
src/core/index.ts:890   (memoryRejectFn)
```

Nothing else in the system asks for approval authority, so writing `dna.yaml` and committing it needs
none — there is no chicken-and-egg. Under (a) the bootstrap is: `init` → add the member to
`.wingfoil/dna.yaml` → **commit it** → `memory approve` works. That is exactly what this repository's
own end-to-end suite already does (`grantApproverRole` in `test/cli/fresh-init-transitions.test.ts`
writes the member and then runs `git add`/`git commit`), which is why that suite stays green — the
flow was already correct; only the tolerance for skipping the commit is removed. It is pinned
explicitly as a paired test (`red` §, AC4).

**The awkwardness, stated rather than waved away.** The seeding step is a **hand edit plus a manual
`git commit`**, because no CLI verb can add a team member:

```
$ node dist/cli.js dna set 'team.members' '[{name: Test User, email: test@example.test, roles: [approver]}]'
error: E_VALIDATION team.members (…/.wingfoil/dna.yaml): Invalid input: expected array, received string
exit=1
```

`dna set` takes a scalar `<value>` and a dotted key path with no index syntax, so it cannot write a
`team.members[]` entry at all. That gap pre-exists this task — it is why every scratch recipe in
task-086/088 and the fixture above hand-edit the file — but this task makes its second half
*load-bearing*: before, committing the edit was a convention; now it is the difference between an
approval working and not. The remedy is a CLI path for seeding a team member (and, with it, a commit
the user did not have to write by hand); it is out of scope here and proposed as an element in the
final report.

#### AC5 — the same baseline question elsewhere: what I found, and what settles each

Sweep command (every pillar loader call site in `src/`):

```
$ grep -rn "loadDnaYaml(root)\|loadMemoryYaml(root)\|loadRolesYaml(root)\|loadWorkflowsYaml(root)\|loadDirectives(root)" src/
```

Every one of them reads the working tree. Classified by whether the read **gates** a mutation whose
committed result then depends on it:

| Read | Gates what | Same defect? | Command that settles it |
|---|---|---|---|
| `dna.yaml` → `requireApprovalAuthority` (`index.ts:797`, `:888`) | `memory approve` / `memory reject` | **Yes — this task** | AC1 transcript above |
| `memory.yaml` → `prepareMemoryTransition` (`index.ts:703`, `:793`, `:885`, `:987`) | which transition is legal, and the `[from → to]` bracket every transition commit records | **Yes, unfixed** — an uncommitted edit to a state machine changes the target a transition resolves to, and the commit subject attests it | measured — see `refactor` § "AC5 — the two findings, settled by running them" |
| `dna.yaml` → `checkAssignable` (`index.ts:1143`, `directive assign`) | whether `--role` exists in `team.roles` before `roles.yaml` is written | **Yes, unfixed** — a binding to a role that exists in no committed `dna.yaml` can be committed | `grep -n "checkAssignable" src/core/index.ts src/core/directive-assign.ts` |
| `roles.yaml` → `directives list` (`directives-list.ts:191`), `assembleExecutionContext`, `mcp/prompt.ts:135` | nothing — read-only output | No gate. Still a *determinism* question about context building (the live tree is the source), already noted in `src/memory/relevance.ts`'s own comment | `grep -rn "loadRolesYaml(root)" src/` → three sites, none `mutates: true` |
| `requireCustomAsset` (REQ-SEC-07) | `directive remove` / workflow remove | No — pure path predicate, reads no config | `grep -n "readDocument\|loadDnaYaml\|loadRolesYaml" src/core/builtin-asset.ts` → no match |
| `requireGitIdentity` (REQ-SEC-01) | every mutating op | No — git config is local by nature and cannot be committed; it is the "who is asking", which (a) deliberately keeps reading live (see `green`) | `grep -n "readGitIdentity" src/core/git-identity.ts` |

Both unfixed findings were **measured, not argued** — the transcripts are in `refactor` § "AC5",
run against the fixed build (which changes neither read). Both of these fall
**outside** this task's argument: mine is about *who authorised*, and these are about *what was
allowed* and *what a binding may reference*. They are filed as proposed elements, together with the
general-rule decision-log the Implementation Notes ask for — which read takes which baseline, with
read-vs-write as its likely hinge (`bug-078` is its write-side half).

#### T1 — AC classification (`dl-014`, `testing` directive)

| AC | Class | Evidence for the class |
|---|---|---|
| **AC1** — reproduce first | **process gate, not testable** | Satisfied by the AC1 section above, run against the base build before any `src/` edit. AC6's test is its durable form. |
| **AC2** — choose the baseline and argue it | **not testable** — a decision | Recorded above; its *consequences* are pinned by the AC3/AC6 tests. |
| **AC3** — the reproduction fails closed, exit `1` | **red-first** | Measured red: AC1 exits `0` and produces the commit. `grep -rn "readPathAtRev" src/core/approval-authority.ts src/core/loaders.ts` → no match; nothing in the authority path reads a revision today. |
| **AC4** — the bootstrap path still works, pinned | **split** — **characterization** for "seed + commit → approve succeeds" (it already works: `test/cli/fresh-init-transitions.test.ts` drives it on `main` and its `grantApproverRole` already commits), **red-first** for its pair "seed without committing → refused", which is AC1 itself. |
| **AC5** — sweep for other baseline reads | **process gate / investigation** | Table above; each row carries the command. Nothing is fixed here, so nothing is tested here. |
| **AC6** — a test pins the defect, red before / green after | **red-first** | Same evidence as AC3; command recorded under `red`. |
| **AC7** — this repository's history is not re-verified or rewritten | **process gate** | Negative obligation. `git log --oneline main..HEAD` touches no historical commit; no test reads this repository's Memory, and `bug-075` means the verbs cannot be pointed at it. |
| **AC8** — six gates green | **process** | Run at `refactor`/`review`. |

### red — role: developer

Commit `1aa2208`. Two new suites, no change to any existing one at this step:

- **`test/core/approval-authority-baseline.test.ts`** — the baseline at the `CoreFn` seam, driving the
  REAL registered `memory.memoryApprove` / `memoryReject` / `memorySubmit` / `memoryDeprecate`
  operations in throwaway repos: the uncommitted grant (AC3/AC6), the same refusal for `reject`, M1's
  never-committed `dna.yaml`, an invalid committed `dna.yaml`, M2's uncommitted withdrawal, the
  corroboration property, AC4's bootstrap pair, and the two cases that pin the fix as a *baseline*
  rather than a `task-088`-style guard (`submit` and `deprecate` are untouched by a dirty `dna.yaml`).
- **`test/cli/approval-authority-baseline.integration.test.ts`** — the two things only the process
  boundary shows: the exit code a script keys on and the stderr a human reads, through the compiled
  `dist/cli.js` in a real `wingfoil init` project. `spawnSync`, per `task-086`'s measurement gotcha
  (recorded in the file's TSDoc so the next reader does not "simplify" it back).

Observed red — AC6's command, before any `src/` change:

```
$ npx jest test/core/approval-authority-baseline.test.ts test/cli/approval-authority-baseline.integration.test.ts
Test Suites: 2 failed, 2 total
Tests:       7 failed, 4 passed, 11 total
```

The 7 failures are the defect: every one reads `expect(result.ok).toBe(false)` / `expect(run.status)
.toBe(1)` receiving the success the current code returns (plus M2's mirror image, which fails the
other way — `ok` where today's code refuses). The 4 passes are exactly the cases the T1 table
classifies as characterization: the corroboration property on a clean tree, `submit` and `deprecate`
being unaffected, and AC4's *positive* half (seed + commit → approve succeeds), which already worked.

One fixture bug was fixed inside this step rather than papered over: the first run asserted
`git status --porcelain` as `" M .wingfoil/dna.yaml"` against a helper that `.trim()`s its output.
The assertion was wrong, not the code.

### green — role: developer

Commit `a647c22`. Three source files, one existing test suite migrated.

| Change | Where |
|---|---|
| `DNA_YAML_PATH` (the root-relative POSIX path git wants) and `parseDnaYaml(raw, filePath)` — the DNA two-pass parse lifted out of `loadDnaYaml` so the same schema and the same error shapes serve bytes from any source; `filePath` becomes a **label** (`HEAD:.wingfoil/dna.yaml`), so an error names the baseline it came from | `src/core/loaders.ts` |
| `loadDnaYamlAtHead(root): DnaYaml \| null` — `readPathAtRev(root, 'HEAD', DNA_YAML_PATH)` (task-088's primitive) + that parse; `null` means "no commit of this repository contains that path" | same |
| `requireApprovalAuthority(root, typeName)` — **the signature changed**: it no longer accepts a `DnaYaml` and resolves the committed one itself. Three fail-closed refusals (no authority at `HEAD`; nothing committed; committed file unreadable), plus `workingTreeWouldGrant`, a diagnostic that never decides anything | `src/core/approval-authority.ts` |
| the two call sites lose their `loadDnaYaml` pre-load and pass `type` alone; both TSDoc step lists say which baseline is read and why | `src/core/index.ts` |
| the existing unit suite migrated to the new signature: every case now **commits** its fixture `dna.yaml`, and three new cases pin the baseline at that seam | `test/core/approval-authority.test.ts` |

Design points worth naming:

- **The fix is in the signature, not next to the call.** A caller cannot hand this function a
  working-tree `DnaYaml` even by accident. That is the whole of AC2's argument expressed in code: the
  committed baseline is a property of the read, not of a precondition someone must remember to run.
  It is also why the change is small — two call sites got *shorter*.
- **REQ-SEC-03's fit criterion is preserved verbatim** as the message's first sentence. The
  `— the working tree's '…' grants it, but that change is not committed …` clause is appended **only**
  when the working tree would have granted the role, i.e. exactly when the user's screen and the
  repository disagree. Every existing assertion on the exact message (`test/core/memory-approve.test.ts`
  P1.7 sc.3, `test/core/memory-reject.test.ts`) commits its reviewer-only `dna.yaml` and so still
  matches byte for byte — they were left untouched and are green.
- **The diagnostic can never decide.** `workingTreeWouldGrant` returns `false` on any failure to read
  or parse the working-tree file; pinned by a test that deletes it and then corrupts it.
- **Exit `1` for all three refusals** (`CoreResult.error`, code `VALIDATION`), per `spec-005` §1 and
  AC3 — a repository-state precondition is not a malformed invocation. Not re-argued; `bug-076` ruled it.
- **`loadDnaYamlAtHead` is NOT exported from `src/core`'s public surface.** It is an internal read of
  one pillar's file under one argued exception; making it public would advertise "read the committed
  version" as a general facility before the general rule (the proposed decision-log) has been decided.
- **What deliberately keeps reading the live working tree**: `dna show`, `dna set`, `paths`,
  `directives list`, the MCP resources — they exist to report or edit what the user has now — and
  `readGitIdentity`, which answers "who is asking" from git config, a local setting git never commits.

Full suite after green: `npx jest` → **116 suites, 1828 tests passed**, exit 0.

### refactor — role: developer

Commit `a5fff86`. No behaviour added; the coverage the green step owed, plus the one property the
green step asserted in prose and nowhere else.

- **`loadDnaYamlAtHead` is tested directly** (`test/core/loaders.test.ts`): `null` while the file is
  untracked; `HEAD`'s copy returned while the working tree says something else (the same call
  compared against `loadDnaYaml` in one assertion); `ValidationError` for a committed file that does
  not validate while the working-tree copy is fine.
- **The gate's propagation rule is pinned** (`test/core/approval-authority.test.ts`): a failure that
  is *not* a `ValidationError` propagates instead of being converted into an authorization answer.
  Reachable only by making the read fail in a way nothing in the code can produce, so it uses a
  `jest.spyOn` on the loaders module — the one mock in either new suite, and it buys a real property:
  a defect in the read path must never be reported as "not authorized" (or as "authorized").
- **An unreadable working-tree `dna.yaml` leaves the refusal exactly as REQ-SEC-03 words it** — the
  deleted-file and corrupt-file cases, which is the `workingTreeWouldGrant` catch.

#### AC3/AC4 — the AC1 reproduction re-run against the fixed build

```
$ node dist/cli.js memory approve adr-001-repro-target --reason 'authority from an uncommitted file'
error: user not authorized to approve type 'adr' — the working tree's '.wingfoil/dna.yaml' grants it,
but that change is not committed, and approval authority is read from the committed configuration
(adr-006); commit '.wingfoil/dna.yaml' first, then retry
$ echo $?
1
$ git log --oneline -1
9a633d7 wf(adr): submit adr-001-repro-target          # unchanged — nothing was written

$ git add .wingfoil/dna.yaml && git commit -q -m 'chore: seed the first approver'
$ node dist/cli.js memory approve adr-001-repro-target --reason 'seeded and committed'    # exit 0
wf(adr): approve adr-001-repro-target [pending → approved]

Approver: Test User <test@example.test> (approver)
Reason: seeded and committed
$ git show HEAD:.wingfoil/dna.yaml | sed -n '23,26p'
  members:
    - name: Test User
      email: test@example.test
      roles: [developer, approver]
```

The `Approver:` line and the `dna.yaml` that supports it are now in the **same commit** — the
corroboration a fresh clone can re-derive (`adr-006`), and the exact thing `bug-079`'s AC1 transcript
showed to be absent.

#### AC5 — the two findings, settled by running them

Both on the same fixed build, in the same scratch project, and **neither is fixed here**: this task's
argument is about *who authorised*, and these are about *what was allowed* and *what a binding may
reference*. Filed as proposed elements in the final report.

**1. `memory.yaml`: an uncommitted state machine drives the transition the commit attests.**

```
$ git show HEAD:.wingfoil/memory.yaml | sed -n '13p'
    sequence: [ draft, pending, approved ]
# uncommitted edit: sequence: [ draft, pending, INVENTED-BY-A-DIRTY-TREE, approved ]
$ git status --porcelain -- .wingfoil/memory.yaml
 M .wingfoil/memory.yaml
$ node dist/cli.js memory approve adr-002-ac5-probe --reason '…'          # exit 0
wf(adr): approve adr-002-ac5-probe [pending → INVENTED-BY-A-DIRTY-TREE]
$ git show HEAD:.wingfoil/memory.yaml | sed -n '13p'
    sequence: [ draft, pending, approved ]
```

The subject attests a transition to a state that exists in no committed machine, and `memory history`
(P1.10) reads that bracket back. Closest sibling of this task's defect; graded the more serious of
the two findings.

**2. `directive assign`: a binding to a role no committed `dna.yaml` defines.**

```
# uncommitted edit adding `- name: FABRICATED-ROLE` to team.roles
$ node dist/cli.js directive assign --directive sample --role FABRICATED-ROLE      # exit 0
wf(directive): assign sample to FABRICATED-ROLE
$ git show HEAD:.wingfoil/roles.yaml | grep -A1 FABRICATED
  FABRICATED-ROLE:
    - sample
$ git show HEAD:.wingfoil/dna.yaml | grep -c FABRICATED-ROLE
0
```

`checkAssignable` (`src/core/index.ts:1145`) validates `--role` against the working tree's role
catalogue, so the committed `roles.yaml` ends up referencing a role the committed `dna.yaml` does not
define — REQ-SYS-08's referential integrity, broken through the same baseline.

The rest of the sweep is unchanged from the design table; re-run post-fix for accuracy:

```
$ grep -rn "requireApprovalAuthority(" src/
src/core/index.ts:800   (memoryApproveFn)
src/core/index.ts:892   (memoryRejectFn)
src/core/approval-authority.ts:112  (the definition)
```

#### Coverage — measured on both sides, not quoted

Baseline taken by running `npx jest --coverage` in a detached worktree at this branch's base
(`59d4d5a`), since removed:

| | Stmts | Branch | Funcs | Lines | Tests |
|---|---|---|---|---|---|
| base `59d4d5a` | 98.64 | 93.21 | 98.86 | 99.21 | 1812 |
| this branch | **98.65** | **93.25** | **98.86** | **99.22** | 1833 |

No metric regressed; `src/core/approval-authority.ts` is at **100 / 100 / 100 / 100**. The one
uncovered line in a file this task touched is `src/core/loaders.ts:102` — the pre-existing
`throw err` rethrow of a non-`E_YAML_PARSE_ERROR` failure from `parseYaml`, which `parseYaml` cannot
produce (`src/validation/yaml.ts` wraps every throw). It was uncovered at the base too (reported
there as line 88) and is moved, not written, by this task.

#### Sync with `main` before submit (`dl-035` — merge, never rebase)

```
$ git merge main            # main at 59d4d5a
Already up to date.
```

`main` did not move while this task ran, so no document cited above can have gone stale and every
gate below is current.

#### Gates (run in this worktree)

| Gate | Command | Result |
|---|---|---|
| Full suite | `npx jest` | **116 suites, 1833 tests passed**, exit 0 |
| Coverage ≥ 80, non-regressing | `npx jest --coverage` | **98.65 / 93.25 / 98.86 / 99.22** — no metric below base |
| Build typecheck | `npx tsc -p tsconfig.build.json --noEmit` | exit **0**, no output |
| Full typecheck | `npx tsc --noEmit -p tsconfig.json` | exit **0**, no output (`bug-026` stays closed) |
| Lint | `npm run lint` | exit **0**, no output |
| API docs | `npm run docs:api` | exit **0** |

BDD acceptance suites for the two gated verbs, run unchanged:
`npx jest test/core/memory-approve.test.ts test/core/memory-reject.test.ts` → green as part of the
full run above.

| BDD scenario | Test that covers it |
|---|---|
| P1.7 sc.3 *Error — approver lacks authority for the type* | `test/core/memory-approve.test.ts` "P1.7 sc.3: a caller holding no `approver` role exits 1 with the REQ-SEC-03 message, state unchanged" (unchanged — its reviewer-only `dna.yaml` is committed) — and, for the **baseline**, `approval-authority-baseline.test.ts` "AC3/AC6: an UNCOMMITTED grant of `approver` does not authorize `approve`" |
| P1.7 sc.1 *Approve a pending document with a reason* | `test/core/memory-approve.test.ts` (unchanged) + `approval-authority-baseline.test.ts` "AC2: a successful approval is corroborated by the `dna.yaml` committed AT that very commit" |
| P1.8 sc.1 / sc.3 *Reject; approver lacks authority* | `test/core/memory-reject.test.ts` (unchanged) + `approval-authority-baseline.test.ts` "AC3: `reject` refuses on the same uncommitted grant" |
| P1.6 sc.1 *Submit a draft document for approval* | `test/core/memory-submit.test.ts` (unchanged) + "AC2: a dirty `dna.yaml` does not by itself block a transition" |
| P1.9 sc.1 *Deprecate an approved document* | `test/core/memory-deprecate.test.ts` (unchanged) + "AC2: `deprecate` needs no approval authority" |
| P5.1.1 *fresh init runs every transition verb* | `test/cli/fresh-init-transitions.test.ts` — untouched and green: its `grantApproverRole` already committed the seed, which is AC4's flow |

### review-ready summary — role: reviewer

**What changed, in one sentence.** Approval authority was read from the `dna.yaml` on disk, so an
uncommitted edit could put an `Approver:` line into a permanent commit that the repository's own
record at that commit contradicted; `requireApprovalAuthority` now resolves the roles from the
`.wingfoil/dna.yaml` committed at `HEAD` — and no longer accepts a `DnaYaml` from its caller, so
there is no call path that can reach the decision with a working-tree file.

**AC coverage**

| AC | Status | Where |
|---|---|---|
| AC1 reproduce first, on a scratch project, against a build containing task-088 | done | `design` § AC1 — commands, commit body, and `git show HEAD:.wingfoil/dna.yaml` at that commit; plus M1 (never-committed file) and M2 (the read is wrong in the other direction too) |
| AC2 choose the baseline and argue it | done — **option (a)** | `design` § AC2: three reasons it wins, three things (b) would have been better at, and the deciding principle (`adr-006`'s fresh-clone consequence) |
| AC3 the reproduction fails closed at exit `1` | done | `refactor` § AC3/AC4 transcript; `approval-authority-baseline` suites at both seams |
| AC4 bootstrap still works, pinned by a test | done, with the awkwardness stated | `design` § AC4 (`dna set` provably cannot seed a member) + the paired tests at both seams |
| AC5 sweep for other baseline reads | done | `design` § AC5 table (every row with its command) + `refactor` § AC5, where the two live findings are *measured* |
| AC6 a test pins the defect, red before / green after | done | `red` § — 7 failed / 4 passed before, 11 passed after; command recorded |
| AC7 nothing in this repository is re-verified or rewritten | done | `git log --oneline main..HEAD` touches no historical commit; no test reads this repository's Memory; `bug-075` means the verbs cannot be pointed at it |
| AC8 six gates green | done | `refactor` § Gates |

**What the approver must decide** — nothing is forced by this task, but two things wait on a ruling:

1. **The general rule** — which baseline each command reads, with read-vs-write as its likely hinge
   (this task fixed a *read*; `task-088` chose refusal for a *write*; `bug-078` is the write-side half).
   Proposed as a decision-log, not enacted (Implementation Notes ask exactly this).
2. **The two measured findings above** (`memory.yaml`'s machine, `directive assign`'s role catalogue).
   Both are the same class on different artefacts, both are demonstrated, neither is touched here.

**Weak spots a reviewer should check**

1. **M2 is a behaviour change, in the permissive direction.** An uncommitted *withdrawal* of the
   `approver` role no longer stops an approval. It is correct under the rule adopted — authority is
   what the repository records — and it is pinned by a test, but it is the one case where the new
   behaviour grants where the old refused.
2. **The refusal message grew a second sentence.** Only when the working tree would have granted the
   role; REQ-SEC-03's fit criterion stays the exact first sentence. Any consumer matching the message
   with `===` rather than a prefix would see the difference — in this repository nothing does
   (the existing suites commit their fixtures and still match exactly).
3. **An invalid committed `dna.yaml` now blocks approvals even when the working-tree copy is fine.**
   Fail-closed by choice, exit `1`, message names the file and the baseline; the fix is to commit the
   fix.
4. **One `jest.spyOn` on an internal module** (`refactor` §), used to reach a defensive rethrow that
   nothing in the code can produce. It pins a real property, but module spying is new in this suite.
5. **`loadDnaYamlAtHead` is deliberately not on `src/core`'s public surface** — a reviewer may take
   the opposite view, as task-088's reviewer did about `verifyCommittedScope`.
