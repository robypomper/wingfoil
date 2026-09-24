---
id: "bug-085-memory-add-reads-the-type-registry-from-the-worktree"
type: bug
title: "`memory add` resolves the type registry, `path` and `template` from the working tree, so an element created against an uncommitted type answers `document not found` to every verb"
status: closed
severity: "critical"
release-origin: "v0.2"
release: "v0.2"
feature: "P1.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`memory add` reads `memory.yaml` from the **working tree** to resolve whether the requested type
exists, where its files land (`path`) and which scaffold to copy (`template`). An uncommitted type is
therefore enough: the element is created and committed against a type no commit defines.

Restoring the working tree does not strand the element — it makes it **invisible**. `memory submit`
and `memory deprecate` both answer `document not found`, and `memory search --type <that type>`
returns nothing.

## Steps to Reproduce

Reproduced by `task-091` and independently by its reviewer, on scratch projects (`bug-075` — the
verbs cannot be pointed at this repository's own Memory):

1. `git init`, `wingfoil init --template scrum` (commits the scaffold).
2. Add a type — say `fabricated-type` — to `.wingfoil/memory.yaml`'s `types:`. **Do not commit it.**
3. `wingfoil memory add --type fabricated-type --title "Probe"` → **exit 0**, commits
   `wf(fabricated-type): add fab-001-probe`.
4. `git show HEAD:.wingfoil/memory.yaml | grep -c fabricated-type` → **0**.
5. `git checkout .wingfoil/memory.yaml`, then `memory submit fab-001-probe` → `document not found`;
   `memory deprecate` likewise; `memory search --type fabricated-type` → no match.

## Expected Behavior

`dl-080-which-baseline-each-command-reads` is `ready` and ratified as option (B): a read that gates an
operation resolves against the repository as committed at `HEAD`. Whether a type exists, where its
files go and which template to copy are all such reads.

## Actual Behavior

A commit exists for an element whose type does not, and no verb can reach the element afterwards.

## Notes

**Strictly worse than `bug-081`, which is a declared blocker.** That one leaves an element *immovable*
— every verb refuses it with `invalid state`, which at least tells a reader something is wrong. This
one leaves it *unreachable*: `document not found` is what the tool says about a document that does not
exist, so the failure is indistinguishable from the element never having been created. The commit,
meanwhile, is in the history.

**It is outside `bug-081`'s wording and was not closed by `task-091`**, deliberately: `memory add`
consults no state machine — it writes the scaffold's literal `status: draft` — so it sits on a
different read than the four transition verbs, which `task-091` moved to `HEAD`. After that task lands
it is the *only* Memory verb still reading its governing document from the working tree, which makes
the asymmetry worse rather than better.

Found by `task-091`'s AC5 sweep and confirmed by its reviewer, who recommended it block the release.
Declared a blocker by the approver on 2026-09-23.

Related but distinct: `bug-087` is about how `memory add` derives an element's **id** from the working
tree, which is a different read in the same verb; `task-092` guards the same verb's **write**. All
three are instances of `dl-080`'s class and should be read together.

## Triage & Execution Notes

- triage (2026-09-23): **critical**, and a **release blocker**. Reachable with no authority, produces
  a committed element that no verb can find, and `minor-v0.2` is the release that ships these verbs.
- No fix task filed yet; it should be fixed under `dl-080`(B) and the natural carrier is a successor
  to `task-091`, which established the shape (`loadMemoryYamlAtHead`, parameter removed so the
  decision is unreachable from a working-tree copy).
