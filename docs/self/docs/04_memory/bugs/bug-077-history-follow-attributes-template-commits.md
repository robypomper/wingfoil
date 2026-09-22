---
id: "bug-077-history-follow-attributes-template-commits"
type: bug
title: "`memory history` walks with `git log --follow`, which follows the element back to the template it was copied from and reports a commit that never contained it as a history entry"
status: triaged
severity: "high"
release-origin: "v0.2"
release: ""
feature: "P1.10"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`memory history` walks an element's commits with `git log --follow`. `--follow` chases content across
renames and copies, and every element is created by copying its type's template — which is already
committed. So the walk continues past the element's own first commit into the commit that added the
**template**, and reports it as an entry in the element's history.

The entry is not a formatting artefact. It appears in the output with a real `sha`, author and
timestamp, and `operation`, `from`, `to`, `approver` and `reason` all `null`.

## Steps to Reproduce

Reproduced on a throwaway project on 2026-09-22 against the CLI built from `main` at `2715b7a`
(a scratch project is required — `bug-075`).

1. `git init`, `wingfoil init --template scrum` — this commits the scaffold, templates included.
2. `wingfoil memory add --type adr --title "…"`, `memory submit <id>`, `memory approve <id> --reason …`
   — three commits that genuinely touch the element.
3. `wingfoil memory history <id>`.

Output: **four** entries. The first is the scaffold commit, with `"operation": null`, `"from": null`,
`"to": null`, and the subject `chore(wingfoil): initialize .wingfoil/ with the Scrum template`. The
walk itself:

```
$ git log --follow --format='%h %s' -- docs/memory/adr/adr-001-….md
45aa775 wf(adr): approve …
77c7f9d wf(adr): submit …
5ec0b07 wf(adr): add …
5eec514 chore(wingfoil): initialize .wingfoil/ with the Scrum template

$ git log --format='%h %s' -- docs/memory/adr/adr-001-….md      # without --follow
45aa775 wf(adr): approve …
77c7f9d wf(adr): submit …
5ec0b07 wf(adr): add …
```

and the scaffold commit demonstrably does not contain the element:

```
$ git show --stat 5eec514 | grep -c 'adr-001'
0
```

## Expected Behavior

The history of an element contains the commits that touched that element. A plain `git log -- <path>`
returns exactly those three.

## Actual Behavior

A fourth entry, sourced from a commit that never contained the document, and a `fatal:` on stderr as a
side effect — `readStatusAt` asks `git show <that sha>:<path>` for a path that does not exist there.

## Notes

**This corrects `bug-071`, filed earlier today, which described the wrong defect.** That bug framed
the `fatal:` as noise from "an expected, handled condition" and proposed suppressing the child's
stderr. Suppressing it would have hidden the only visible symptom of this: the phantom entry would
have stayed, silently. `bug-071`'s stated remedy is therefore withdrawn as a fix and survives only as
a cosmetic improvement to apply *after* this is repaired. A correction note has been added there.

**Why this matters more than a stray row.** `P1.10` is the audit trail's reader, and this is the
second way this release has found to make it report something that did not happen — `bug-050` forged
an entry from caller-supplied text, and this one manufactures one from a template copy. The two share
a shape: the reader trusts an input it did not establish. `bug-050` is closed; this one is the same
lesson arriving through `git`'s own cleverness rather than through user input.

Note the entry is *plausible* in a way that makes it worse than noise: it carries a real sha, a real
author and a real timestamp from a real commit. Only `operation: null` marks it out, and a reader
scanning a history for "when did this element first appear" would reasonably take the earliest entry.

`--follow` was presumably chosen so an element renamed on disk keeps its history. That requirement is
real and any fix must not silently drop it: renames within Memory do happen. The likely shape is a
walk that stops at the commit that *introduced the path*, or that discards entries whose tree does not
contain it — the latter being cheap, since `readStatusAt` already discovers exactly that and currently
throws the information away as stderr.

How it was found: by using the v0.2 verbs on a project other than this one, and reproduced here from
scratch. It cannot surface in this repository, because `bug-075` means `memory history` cannot be
pointed at our own Memory at all.

## Triage & Execution Notes

- triage (2026-09-22): **high**. `memory history` is the whole of `P1.10`, this fires for *every*
  element in *every* project that uses a committed scaffold — which is every project created by
  `wingfoil init` — and the fabricated entry is indistinguishable from a real one except by a null
  field. Whether it blocks the release is the approver's call.
- No fix task filed pending that call. `bug-071` is now downstream of this and should not be worked
  independently.
