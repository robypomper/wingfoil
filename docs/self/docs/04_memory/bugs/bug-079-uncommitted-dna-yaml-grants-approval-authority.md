---
id: "bug-079-uncommitted-dna-yaml-grants-approval-authority"
type: bug
title: "An uncommitted `dna.yaml` edit grants the approval authority, and the resulting commit attests an `Approver:` the repository never recorded"
status: planned
severity: "critical"
release-origin: "v0.2"
release: "v0.2"
feature: "P1.7"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

The approval-authority check reads `dna.yaml` from the **working tree**. An uncommitted edit granting
the current git identity the `approver` role is therefore sufficient: `memory approve` proceeds and
writes `Approver: <name> <email> (approver)` into a permanent commit body.

The commit attests an authority that exists in no committed state of the repository. Nothing in the
history — before, at, or after that commit — records that the identity was ever an approver.

## Steps to Reproduce

Reproduced on a throwaway project on 2026-09-22 against the CLI built from `main` **after**
`task-088`'s fix, so this is not closed by it. A scratch project is required — `bug-075` means the
verbs cannot be pointed at this repository's own Memory.

1. `git init`, set a git identity, `wingfoil init --template scrum`, commit. The scaffold's
   `dna.yaml` has `team.members: []` — nobody is an approver.
2. `memory add` and `memory submit` an element.
3. Edit `.wingfoil/dna.yaml` to add the current identity with the `approver` role. **Do not commit it.**
4. `memory approve <id> --reason "…"` → exits 0.

The element's approve commit carries `Approver: Test User <test@example.test> (approver)`. `git show`
on the committed `dna.yaml` at that commit still reads `members: []`.

## Expected Behavior

Authority is a property of the repository, not of a working tree. The check reads the **committed**
`dna.yaml` — at `HEAD`, or at the commit being produced — or the verb refuses while the file carries
uncommitted modifications, the way `task-088` made the gated verbs refuse a modified element.

## Actual Behavior

Whoever can write the file can grant themselves the role for the duration of one command, and the
audit trail records the grant as if it had been real.

## Notes

**This is the same root cause as `bug-076` — the working tree used as the baseline — on a different
artefact, and it is the more serious of the two.** `bug-076` let a commit carry content it did not
declare; this one lets a commit fabricate **authority**. `P1.7` requires an approval to record
approver identity, and `adr-006-git-identity-role-based-authz` makes that identity the basis of
authorisation. An `Approver:` line that no committed state supports is the failure of exactly the
thing the feature exists to provide.

**`task-088`'s fix does not reach it, by design.** That guard is *per-path*: it refuses when the
**element** being transitioned is modified, which is the narrowest rule that closes `bug-076`.
`dna.yaml` is a different path, so a dirty `dna.yaml` does not block a transition — and widening the
guard to every file would block transitions for no integrity gain in the ordinary case. The right fix
is not a wider guard but a different **baseline** for this particular read.

**Note what is and is not being claimed.** This is not a privilege escalation against someone without
repository access: the actor must already be able to write the file, and could simply commit the
change instead. The defect is that committing it would leave a record and not committing it leaves
none, so the audit trail can attest an authority the repository cannot corroborate — including by
accident, when a developer has `dna.yaml` open mid-review. The exposure is the credibility of the
trail, not access control.

Related: `bug-078` covers the same root cause on the *write* side for the non-transition verbs.
Together they suggest the general question — which baseline a command reads, and whether the answer
should be stated once for all of them — but neither bug settles it, and a decision-log has not been
filed for it here.

## Triage & Execution Notes

- triage (2026-09-22): **critical**, and declared a **release blocker** for `minor-v0.2` by the
  approver on the same day. `minor-v0.2` ships the approval verbs; an approval that can attest an
  unrecorded authority undermines the one guarantee `P1.7` makes. It is graded above `bug-076` and
  `bug-077`, which were also blockers, because those corrupt *what* was recorded while this one
  corrupts *who authorised it*.
- No fix task filed yet; the remedy is a baseline decision (read the committed `dna.yaml`, or refuse
  while it is modified) and the approver has not chosen between them.
