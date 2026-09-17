---
id: "bug-041-frontmatter-edit-yaml-edge-cases"
type: bug
title: "frontmatter-edit: unspaced `#` after a value written over an empty value; column-0 comment inside a column-0 sequence; append after a trailing keep-chomped block scalar"
status: in-progress
severity: "medium"
release-origin: "v0.2"
release: "v0.2"
feature: "P1.6"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`src/memory/frontmatter-edit.ts`, the line-based frontmatter editor `task-045-memory-submit` introduces
for every transition verb, mishandles three YAML shapes. The code exists only on
`task/task-045-memory-submit` (`72de85b`), not on `main`. All three were reproduced there, read-only: the
branch file was transpiled with the repository's `typescript` (imports pointed at `main`'s `dist/`) and
each output was parsed with both installed YAML parsers (`js-yaml`, which the project uses, and eemeli
`yaml`) and passed to the module's own post-condition, `verifyFrontmatterEdit`.

## Steps to Reproduce

**G1 — a value written over an empty value keeps the comment with no separating space.**

- `setFrontmatterField("---\nid: x\nstatus: draft\nrejection_reason:   # set by memory.reject\n---\n", "rejection_reason", "needs tests")`
  → `rejection_reason: "needs tests"# set by memory.reject`.
  `js-yaml` accepts it (`rejection_reason` = `needs tests`), so `verifyFrontmatterEdit` returns `[]` and
  the edit **passes**; eemeli `yaml` rejects the same text: "Comments must be separated from other tokens
  by white space characters".
- `setFrontmatterField("---\nid: x\nstatus:  # todo\n---\n", "status", "pending")` →
  `status: pending# todo`, which parses as the string `pending# todo`; `verifyFrontmatterEdit` refuses it
  (`field 'status' is "pending# todo", expected "pending"`).
- Cause: `scanHeaderValue` ends an empty value at the `#`, and `setFrontmatterField` re-attaches
  `header.slice(valueEnd)` — the tail starting at `#` — directly after the new value.

**G2 — removing a key whose value is a column-0 sequence containing a column-0 comment.**

- `removeFrontmatterField("---\nid: x\nrejection_reason:\n- a\n# note\n- b\nstatus: draft\n---\n", "rejection_reason")`
  → frontmatter `id: x\n# note\n- b\nstatus: draft` — invalid YAML (`js-yaml`: "end of the stream or a
  document separator is expected"); `verifyFrontmatterEdit` refuses it.
- Cause: `entryEnd`'s nested-value loop skips only comments with indentation > 0, so a column-0 `# note`
  ends the entry early and `- b` is left behind.

**G3 — appending a missing key after a trailing keep-chomped block scalar.**

- `setFrontmatterField("---\nid: x\nnotes: |+\n  a\n\n---\n", "status", "pending")` →
  `notes: |+\n  a\n\nstatus: pending`; the trailing blank lines that belonged to `notes`' value no longer
  do, so `notes` changes; `verifyFrontmatterEdit` refuses it
  (`field 'notes' changed although this operation does not own it`).
- Cause: an absent key is appended as the last frontmatter line, after trailing blank lines; it should go
  after the last non-blank frontmatter line.

## Expected Behavior

Each edit produces valid YAML under any conforming parser, leaves every non-owned field's value
unchanged, and keeps a trailing comment separated by whitespace.

## Actual Behavior

G1 (first form) writes a document that `js-yaml` accepts and a stricter YAML parser rejects, and the
post-condition does not notice. G1 (second form), G2 and G3 are caught by the post-condition, so the
verb fails safely instead of writing — but it fails on documents that are valid.

## Notes

- **Reachability.** No `memory submit` on a document these tools produce reaches these shapes: submit sets
  an existing, valued `status` and removes `rejection_reason`, which only `memory reject` writes, as a
  string scalar; no Memory template carries `rejection_reason` (`grep -rn rejection_reason
  docs/self/.wingfoil/memory/templates src/storage/templates.ts` → no output). They are reachable through
  hand-edited documents or customised templates. **`memory reject` (`task-047`) is the first verb that can
  hit G1**: it sets `rejection_reason`, and a template or hand edit declaring `rejection_reason:` with an
  empty value and an inline comment produces the first form above, silently.
- **Why `medium`:** the silent G1 case writes a non-portable document into the git-backed store, which
  other YAML tooling may refuse; the other cases turn valid documents into failed transitions.
- **Recommendation, for the approver:** the `task-045` reviewer recommends that `task-047` absorb this bug
  under `dl-045` (the task's `bug:` list), since it is the first consumer that can reach G1. That is the
  approver's scheduling decision; it has not been done.
- Suggested fixes: G1 — when re-attaching a tail that starts with `#`, prefix a space; G2 — treat a
  column-0 comment inside a column-0 sequence as part of the nested value while more `- ` items follow;
  G3 — insert an absent key after the last non-blank frontmatter line. Each with a regression test that
  also parses the output with a strict YAML parser.

## Triage & Execution Notes

- capture: raised by the second-pass review of `task-045-memory-submit` (Wave 2, 2026-09-17), filed
  under `bug-ingest-rel-v0.2-wave2-review-findings-plan`.
