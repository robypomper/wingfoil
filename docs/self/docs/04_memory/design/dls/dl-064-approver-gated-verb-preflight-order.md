---
id: "dl-064-approver-gated-verb-preflight-order"
type: decision-log
title: "Two unspecified choices every approver-gated verb makes alone: transition legality is checked before approval authority, and the git identity is read three times per operation"
status: in-discussion
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`task-046-memory-approve` (branch `task/task-046-memory-approve`, HEAD `62c7459`, `in-review`, **not
merged** — read read-only with `git show`) and `task-047-memory-reject` (**merged to `main` while this
element was being written**: `c03cca9` approve, `57c412f` finalize, `e890cf9` merge; `main` is now
`9147d84`) are the first two approver-gated verbs. They made the same two choices independently, no
specification covers either, and `task-048-memory-deprecate` — `in-progress` as of `b6175b7`, no longer
`backlog` — inherits both through the same helpers. Each is small on its own, which is why one
decision-log covers both rather than two.

### (i) Transition legality is checked before approval authority

Both `memoryApproveFn` and `memoryRejectFn` run the same pre-flight order:

1. `requireGitIdentity` (REQ-SEC-01) — exit `1`
2. `<id>` absent → `UsageError`, exit `2`
3. `requireReason` (REQ-SEC-04) → `missing required argument: --reason`, exit `2`
4. load `memory.yaml`
5. **`prepareMemoryTransition`** — not found / unknown type / no machine / invalid state / illegal
   transition, each a `CoreResult.error` at exit `1`
6. **`requireApprovalAuthority`** (REQ-SEC-03) — exit `1`,
   `user not authorized to approve type '<type>'`
7. edit + one commit

(`memoryRejectFn` on `main`: `src/core/index.ts:776` `requireGitIdentity`, `:781` `requireReason`,
`:786` `prepareMemoryTransition`, `:792` `requireApprovalAuthority`, `:795` `readGitIdentity`.
`memoryApproveFn` on `62c7459`, read with `git show`, is identical in order.)

The reason is mechanical: REQ-SEC-03's message interpolates the document's **type**, which is a fact of
the document, so the document must be located first. Locating it is `findMemoryDocumentById`
(`src/memory/query.ts:173`), a linear scan over every registered type's content root; checking authority
"first" would mean scanning twice on the happy path, or hoisting that scan out of
`prepareMemoryTransition` and reshaping the shared helper both verbs and `task-048` build on. `task-046`
records the trade-off itself, under "Ordering decision (5 before 6), recorded deliberately"
(`git show 62c7459:docs/self/docs/04_memory/v0.2/task-046-memory-approve.md:182-192`).

**The one observable consequence:** an unauthorized caller attempting an *already illegal* transition
sees the illegal-transition message, not the authority one. Nothing is written on either path —
`prepareMemoryTransition`'s refusals all precede any write, and `requireApprovalAuthority` is a pure
predicate over the live git identity — and both exit `1`, since every `CoreError.code` maps to `1`
(`src/core/exit-code.ts:24-30`). No BDD scenario pins the combination: P1.7's authority scenario starts
from a `pending` document, i.e. from a legal transition.

### (ii) `requireGitIdentity` discards the identity, so each verb reads the git config three times

`requireGitIdentity(root)` returns `CoreResult<void>` (`src/core/git-identity.ts:71-77`): it calls
`readGitIdentity`, tests `isConfiguredIdentity`, and throws the pair away. The identity is then needed
twice more in the same operation:

- `requireApprovalAuthority(root, dna, type)` calls `readGitIdentity(root)` again
  (`src/core/approval-authority.ts:67`);
- the verb itself calls `readGitIdentity(root)` a third time to build the `Approver:` line
  (`src/core/index.ts:795` on `main` — `const { name, email } = readGitIdentity(root);`; identically in
  `memoryApproveFn` on `62c7459`).

Each `readGitIdentity` runs `readGitConfig` twice — once for `user.name`, once for `user.email`
(`git-identity.ts:61-63`) — and each of those is one `execFileSync('git', ['-C', root, 'config', key])`
(`:29`). So **three reads = six `git config` subprocesses per approver-gated operation**, all returning
the same values.

Having `requireGitIdentity` return the validated identity instead of `void` would collapse it to one
read (two subprocesses), and the return type already exists (`GitIdentity`, `:49-52`). But
`requireGitIdentity` is the shared REQ-SEC-01 pre-flight of **every** mutating operation — six call
sites in `src/core/index.ts` on `main` (`:282`, `:374`, `:692`, `:776`, `:864`, `:920`), plus
`memoryApproveFn`'s on `62c7459` — so changing its signature touches all of them. That is why neither
verb made the change on its own: `task-047` was in review alongside `task-046` when it landed, and
`task-046` and `task-048` are both in flight on branches off the same `main` now.

Neither choice contradicts a specification. Both are the kind of undeclared behaviour REQ-SYS-07
("prefer explicit declared config over inferred behaviour") is meant to keep out of a determinism-first
tool, arriving here through three tasks that each answer it in private.

## Decision

*Approver to choose. Two questions, each with its options and a recommendation.*

### A — is "legality before authority" the declared order?

1. **Ratify today's order and write it into `spec-006-core-domain-api` as the approver-gated verb
   pre-flight sequence** *(recommended)*. The sequence above becomes the declared contract every such
   verb follows, with the consequence stated explicitly: on a combined failure the transition message
   wins. `task-048` then inherits a written rule instead of reading two branches. No code changes — the
   order is already what both verbs do and what `task-046` documented.
2. **Authority first.** The authority refusal would take precedence on a combined failure. It requires
   either scanning for the document twice or restructuring `prepareMemoryTransition` so the lookup is
   hoisted and shared — a change to the one helper `task-045` (merged), `task-046`, `task-047` and
   `task-048` all build on. It buys a message ordering no requirement asks for.
3. **Leave it undeclared.** Rejected on its face: it is the state that produced this decision-log, and
   `task-048` is the third task that would have to re-derive it.

A note for whichever option wins: "exit `1` either way, nothing written" is worth stating in the spec
text, because it is what makes A.1 safe. If a future `CoreErrorCode` ever mapped to something other than
`1`, the order would become observable in the exit code too — and `src/core/exit-code.ts`'s exhaustive
`Record` is the place that would force the question.

### B — does `requireGitIdentity` return the identity?

1. **Yes — change its signature to carry the validated identity, in whichever of `task-046` and
   `task-048` lands last** *(recommended)*. One read per operation instead of three, and the `Approver:`
   line provably comes from the same read the authority check used — today the three reads are separate
   `git config` invocations, so nothing structurally pins them together. Assigning the change to the
   *last* to land is what keeps two in-flight branches from colliding on a signature every mutating op
   calls; which task that is, is the approver's scheduling call. `requireApprovalAuthority` would then
   take the identity as a parameter rather than re-reading it, making it a pure predicate. Note
   `task-047` is no longer a candidate — it merged (`e890cf9`) with the triple read in place, so
   whichever task carries this now also cleans up `memoryRejectFn` on `main`.
2. **Leave it as `CoreResult<void>`.** Costs four redundant `git config` subprocesses per approver-gated
   operation and keeps the three reads structurally independent, but touches nothing and leaves both
   in-flight branches alone. Defensible while the verbs are still landing — it should then be recorded
   as a known cost rather than left silent.

B is not a correctness question today: `readGitConfig` is deterministic for a fixed config, and all
three reads use the same `root` and the same `process.env`. It is a cost-and-clarity call, which is why
it is filed with A rather than as a bug.

## Rationale

- **Both are inherited, not local.** `task-048-memory-deprecate` is `in-progress` right now and will call
  the same helpers; a third independent answer to either question is exactly the determinism drift
  REQ-SYS-07 names — and with `task-047` already merged, two of the three answers are no longer
  hypothetical.
- **A is about which of two true statements the user is told.** Neither refusal is wrong and neither
  writes anything; all that is at stake is which message an unauthorized caller sees on an
  already-illegal transition. Cheap to declare, expensive to rediscover — so it belongs in the spec
  rather than in two task documents.
- **A.2 would reshape a helper four tasks share** for a message ordering no requirement asks for. The
  scan cost is real (`findMemoryDocumentById` is linear over every registered type's content root) and
  the gain is presentational.
- **B.1 is small but has a correctness edge.** Three independent reads of the same config is not merely
  wasteful: the identity that gates the operation and the identity written into the `Approver:` line are,
  structurally, two different reads. Collapsing them makes "the `Approver:` line records the principal
  that was authorized" true by construction rather than by coincidence — which matters for
  P1.7/REQ-SEC-02, where the commit body *is* the audit record.
- **B belongs to the last task to land, not to a new one.** A separate task for a signature change would
  conflict with whichever verb is still in flight. The discipline that works here is `dl-053`'s: name the
  inheritors and hand them the rule.

## Actions

- Owner **approver**: choose A and B. If B.1, name which of `task-046`/`task-047`/`task-048` carries it.
- If **A.1**: add the approver-gated pre-flight sequence to `spec-006-core-domain-api` as a dated
  Revision note (`dl-047`: tech-specs carry no `version:` field), including the combined-failure
  consequence and the "exit 1 either way, nothing written" property.
- If **B.1**: the change is `src/core/git-identity.ts` (`requireGitIdentity`'s return type),
  `src/core/approval-authority.ts` (take the identity instead of re-reading it), and every current caller
  of `requireGitIdentity` in `src/core/index.ts` (six on `main`). `memoryRejectFn`'s own
  `readGitIdentity` call at `:795`, and `memoryApproveFn`'s equivalent, then disappear.
- ~~Hand the outcome explicitly to `task-046-memory-approve` (`in-review` at `62c7459`, so before its
  review pass) and to `task-048-memory-deprecate` (`in-progress` at `b6175b7`, so **now** — it is past
  its design step).~~ *(Both are now `done` and merged — see the Scheduling addendum (2026-09-21)
  below.)* `dl-015`'s `read_related` covers `depends_on` tasks and **not** decision-logs, so neither read
  this on its own. `task-047-memory-reject` is `done` too, so the whole outcome is now a follow-up on
  `main`, not a rework of anything.
- Either way, `task-046`'s "Ordering decision (5 before 6)" section should end up pointing at this
  decision rather than standing as the only record of it.

## Review addendum (2026-09-21) — scope correction before ratification

Raised by `task-048-memory-deprecate`'s implementer and its independent review, and re-verified against
`main` at `7bac856` before being written here. Four statements above are now wrong, and one of them
would make an already-merged verb read as non-conformant if this element were ratified as drafted.

**1. `memory deprecate` is NOT an approver-gated verb, so question A has two inheritors, not three.**
`dl-027-req-sec-04-deprecate-reason-scope` (`ready`) settles that deprecate is not an approval gate:
no `Approver:` line, no authority check. The shipped verb matches — `memoryDeprecateFn` on `main` calls
`requireGitIdentity` and `prepareMemoryTransition` and **never** `requireApprovalAuthority`:

```
$ awk '/^const memoryDeprecateFn/,/^};/' src/core/index.ts \
    | grep -n "requireGitIdentity\|requireApprovalAuthority\|readGitIdentity"
4:  const identity = requireGitIdentity(root);
```

against `memoryApproveFn`'s four hits (`requireGitIdentity`, `requireReason`,
`requireApprovalAuthority`, `readGitIdentity`). Question A — *which refusal wins when a caller is both
unauthorized and attempting an illegal transition* — is therefore unanswerable for deprecate: it has no
authority refusal to order. The Context's "`task-048` inherits both through the same helpers" is false
for A.

**Consequence for A.1, which is the point of this addendum:** if the pre-flight sequence is written into
`spec-006` as "the approver-gated verb pre-flight sequence" with step 6 in it, the spec describes a
contract `memory deprecate` deliberately does not satisfy. The ratified text must either scope itself to
`approve` and `reject` by name, or state that step 6 is present only for verbs `dl-027` classifies as
approval gates. Without that, the first reader to check `memoryDeprecateFn` against the spec finds a
non-conformance that is really a drafting error here.

**2. Deprecate reads the git identity once, not three times.** B's cost figure is right for approve and
reject (three `readGitIdentity` calls = six `git config` subprocesses) and wrong for deprecate, which
calls `requireGitIdentity` alone — one read, two subprocesses — because it has neither an authority
check nor an `Approver:` line to build. So B's inheritors are also two, not three. The signature change
B.1 proposes would still touch `memoryDeprecateFn` as a caller of `requireGitIdentity`, but it buys
nothing there.

**3. Every task this element hands its outcome to is now `done` and merged**, so B.1's assignment rule
is void. `task-045`, `task-046`, `task-047`, `task-048` and `task-052` are all `status: done`
(`grep -h '^status:' docs/self/docs/04_memory/v0.2/task-04[5-8]*.md task-052*.md` → five `done`), and
the Wave-2 dev-loop is closed apart from `task-056`. "Whichever of `task-046`/`task-048` lands last
carries it" no longer names a live task: if B.1 is chosen it needs its **own task**, scheduled at
`v0.3` release-planning, touching `git-identity.ts`, `approval-authority.ts` and every
`requireGitIdentity` caller. The Actions' "hand the outcome to task-046 / task-048 **now**" is likewise
spent — for A the remaining work is the `spec-006` edit alone, and `task-046`'s "Ordering decision
(5 before 6)" section is now the record on `main`, not on a branch.

**4. The call-site count has moved.** `grep -c "requireGitIdentity(" src/core/index.ts` → **9** on
`main`, not the six the Decision cites; `directive assign`, `directive remove` and `memory deprecate`
landed after this element was drafted. B.1's blast radius is correspondingly larger.

Nothing in A's or B's substance changes: the order is still what the two approver-gated verbs do, and
the triple read is still real where it applies. What changes is who inherits, who could carry B.1, and
the wording A.1 must use so the spec does not describe `memory deprecate` as something it is not.

Related: `task-046-memory-approve`, `task-047-memory-reject`, `task-048-memory-deprecate`,
`task-045-memory-submit` (owner of `prepareMemoryTransition`), `task-040-role-based-approval-authority`,
`task-041-mandatory-reason-on-verbs`, `task-014-git-identity-required`,
`dl-053-illegal-transition-target-for-verbless-edges` (the same hand-it-to-the-inheritors pattern),
`dl-032-illegal-transition-message-contract`, `spec-006-core-domain-api`, REQ-SEC-01, REQ-SEC-02,
REQ-SEC-03, REQ-SEC-04, REQ-SYS-07, REQ-STATE-01, `src/core/git-identity.ts:29,61-63,71-77`,
`src/core/approval-authority.ts:67`, `src/core/memory-transition.ts`, `src/memory/query.ts:173`,
`src/core/exit-code.ts:24-30`, P1.7, P1.8, P1.9.

## Scheduling addendum (2026-09-21) — unscheduled obligation for v0.3

All three tasks this decision-log names are now `done` and merged: `task-046-memory-approve`
(`1914195`), `task-047-memory-reject` (`57c412f`) and `task-048-memory-deprecate` (`d9867dc`), the last
two on 2026-09-18. The Actions above describe `task-046` as "`in-review` at `62c7459`" and `task-048` as
"`in-progress` at `b6175b7`, so **now** — it is past its design step"; both are stale, and `task-048`
was in fact the third verb to re-derive the pre-flight order unaided, which is what this document
predicted.

That retires the assignment rule clause B.1 carried — *"in whichever of `task-046` and `task-048` lands
last"*. Both landed. If B.1 is ratified, the signature change to `requireGitIdentity`
(`src/core/git-identity.ts`) and its six callers in `src/core/index.ts` is a follow-up on `main` with its
own task, not a change inside a task in flight. Clause A.1 was always a `spec-006` amendment and never
needed a task at all.

This document is therefore left `in-discussion` with `release: ""` on purpose. That pair is exactly what
`release-planning`'s `reconcile-governance` selection filter picks up
(`where: { type: [decision-log, adr], status: [in-discussion, pending], release: ["", "{release.version}"] }`,
`release-planning.yaml:45`), so the next run sweeps it, approves it, and `build-backlog` places the work
it implies. It is an **unscheduled obligation** in the shape `dl-030` established for REQ-SEC-07's P4.9
half: recorded here, placed by the next `release-planning`, never added to a release already
`in-development` (`dl-034` point 4 bounds that exception to bugs blocking work in flight, which this is
not).

**Consequence for whoever ratifies it:** the hand-it-to-the-inheritor instruction in Actions above can no
longer be executed — there is no task left to hand it to. The outcome needs **its own task** out of
`build-backlog`. This addendum exists because nothing else would have said so: `dl-015`'s `read_related`
covers `depends_on` tasks and not decision-logs, and nothing re-opens a `done` task's notes.
