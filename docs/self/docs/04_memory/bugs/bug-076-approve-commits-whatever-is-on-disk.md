---
id: "bug-076-approve-commits-whatever-is-on-disk"
type: bug
title: "`memory approve` commits the element file as it stands on disk, so uncommitted body and frontmatter edits ride into the audit trail under a subject that declares only a state change"
status: open
severity: "high"
release-origin: "v0.2"
release: ""
feature: "P1.7"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`memory approve` stages and commits the whole element file as it stands in the working tree. If the
file carries uncommitted edits — to the body, or to frontmatter fields other than `status` — those
edits are committed too, under a subject that says only `approve {id} [from → to]` and a body whose
`Approver:` line attests to a state transition.

The rule this breaks is explicit: an approval "Change **only** the `status` field... Do **not** modify
any other frontmatter field or the body." The shipped verb does not enforce it, and its postcondition
compares against the file on disk rather than against `HEAD`, so it cannot detect the difference.

## Steps to Reproduce

Reproduced on a throwaway project on 2026-09-22, against the CLI built from `main` at `2715b7a`.
A scratch project is required because the verbs cannot be pointed at this repository's own Memory
(`bug-075`).

1. `git init`, set a git identity, `wingfoil init --template scrum` (it commits the scaffold itself),
   then seed that identity into `dna.yaml`'s `team.members` with the `approver` role.
2. `wingfoil memory add --type adr --title "…"`, then `wingfoil memory submit <id>`.
3. **Without committing**, edit the file: append a paragraph to the body and add a frontmatter field
   that is not `status`.
4. `git status --porcelain` → the file is modified.
5. `wingfoil memory approve <id> --reason "state change only, allegedly"` → exits 0.

The resulting commit:

```
wf(adr): approve adr-001-… [pending → approved]

Approver: Test User <test@example.test> (approver)
Reason: state change only, allegedly
```

and its diff:

```
-status: pending
+status: approved
+tags: ["INJECTED-BY-A-DIRTY-TREE"]
+
+INJECTED BODY PARAGRAPH — never mentioned by any commit subject.
```

Four insertions where one was declared.

## Expected Behavior

An approval commits the status change and nothing else. Either the verb stages only that hunk, or it
refuses to run against an element file with unrelated modifications and says which — an explicit
error at exit `2`, never a silent inclusion.

## Actual Behavior

Whatever is in the working tree at that moment is absorbed into an approval, attributed to the
approver by name, and described by a subject that mentions only a state transition.

## Notes

**This is the same class as `bug-050`, reached without any trick.** That bug needed a control
character in a `--reason` to forge a history entry; this one needs only an unsaved edit. In both
cases the audit trail asserts something the commit does not do — and `P1.7`'s three recorded facts
(approver identity, timestamp, reason) are all present and all true, which is what makes it hard to
see: nothing in the commit is false, the commit is simply larger than what it claims.

The reach is not limited to `approve`. The same write path serves `reject` and `deprecate`, which
carry the same "only the status field" rule. For `submit` the behaviour is closer to correct by
design, since `memory.submit` is defined as filling content *and* moving state — but that makes the
asymmetry worth stating rather than assuming: `submit` may legitimately carry a body, the gated verbs
may not.

**The postcondition is the deeper half.** Checking the file on disk answers "does the document now
say `approved`?" — which is true no matter what else rode along. A check that compared the committed
tree against `HEAD` would have caught this, and is the same shape as the guard `task-080` added for
the lockfile: assert the *diff*, not the end state.

How it was found: by using the v0.2 verbs on a project other than this one. It could not have been
found here, because `bug-075` means the verbs cannot operate on WingFoil's own Memory — so every
transition in this repository is hand-made and this write path has never run against our documents.

## Triage & Execution Notes

- triage (2026-09-22): **high**. It is an integrity defect in the feature `minor-v0.2` exists to
  deliver, it requires no adversarial input, and a dirty working tree during a review cycle is
  ordinary rather than exceptional. Whether it blocks the release is the approver's call and is not
  assumed here: nothing in *this* repository's history is affected, because none of it was produced
  by the verb.
- No fix task filed pending that call. If it is fixed, the fix is two parts — stage only the status
  hunk (or refuse a dirty file), and change the postcondition to compare against `HEAD`.
