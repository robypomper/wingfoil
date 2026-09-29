---
id: "bug-156-repository-memory-yaml-template-paths-carry-the-config-root"
type: bug
title: "This repository's `memory.yaml` gives every `template.file` with a `.wingfoil/` prefix, so `memory add` looks for `.wingfoil/.wingfoil/memory/templates/…` and fails for every type"
status: in-progress
severity: "medium"
release-origin: "v0.2.2"
release: "v0.2.2"            # optional — fix/implementation release, stamped by release-planning/build-backlog (dl-016)
feature: "P1.13"
contributor: ""        # optional — who originated this contribution, if not the git author (dl-020); credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note (dl-020)
tmpl_version: 260703   # Orignal template version
---

## Summary

`spec-001` declares `template.file` as a scaffold path "relative to config root" (line 123), and
the CLI resolves it that way: ``templatePath = `${WINGFOIL_DIR}/${template.file}` ``
(`src/core/memory-add-type.ts:160`). The `memory.yaml` that `init` scaffolds follows the rule
(`file: memory/templates/${type}.md`, `src/storage/templates.ts:275`). This repository's
hand-authored `memory.yaml` does not: its 8 `template.file` entries all start with `.wingfoil/`
(`grep -c 'file: ".wingfoil/memory/templates/' docs/self/.wingfoil/memory.yaml` → 8). So
`memory add` cannot create any element from this configuration.

## Steps to Reproduce

1. Build `main` at `1087c166` (`npm run build`).
2. In a scratch git repository, copy this repository's `.wingfoil/` to `.wingfoil/` and commit it.
3. Run `node <repo>/dist/cli.js memory add --type bug --title "x"`.

## Expected Behavior

The element is created from `.wingfoil/memory/templates/bug.md`, as it is for a project configured
by `init`.

## Actual Behavior

```
Error: cannot read the scaffold for memory type 'bug': '.wingfoil/.wingfoil/memory/templates/bug.md'
is not committed at HEAD. […]
```

Exit 1. The same holds for every type. Run on 2026-09-29 in the session scratchpad.

## Notes

- Found at `task-110`'s review (2026-09-29), whose AC 6 end-to-end run hit it and stripped the
  prefix in the scratch copy only. The approver ruled it a separate bug, to triage.
- `task-111` (configuration moves to the root, `bug-075`) does not fix it: the move keeps the
  prefix, and after it `memory add` still fails on this repository. None of `task-111`'s ACs covers
  `memory add`.
- The fix is configuration only: drop the `.wingfoil/` prefix from the 8 entries. The code follows
  `spec-001`.

## Triage & Execution Notes

<!-- triage (bug-ingest): severity call; fix: pointer to the fix task(s). -->
