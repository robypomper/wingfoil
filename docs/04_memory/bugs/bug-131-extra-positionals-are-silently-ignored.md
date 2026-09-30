---
id: "bug-131-extra-positionals-are-silently-ignored"
type: bug
title: "Extra or unsupported positionals are silently ignored — `dna show a b` acts on `a`, `workflow list <name>` prints every workflow"
status: planned
severity: "low"
release-origin: "v0.2"
release: "v0.3"
feature: "P5.1"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

A command given a positional it does not take, or more positionals than it takes, succeeds as if they
were not there. `dl-082` fixes one positional per command, but nothing enforces it.

## Steps to Reproduce

1. A throwaway repository: `git init`, a git identity, then `wingfoil init --template Scrum`, with
`wingfoil` = `node dist/cli.js` built from branch `docs/user-docs-v0.2` at `79a76d6e`.
2. `wingfoil workflow list sw-life-cycle` → exit `0`, the whole manifest and every workflow.
3. `wingfoil directives list developer` → exit `0`, every directive (the role filter is `--role`).
4. `wingfoil dna show project team` → exit `0`, the `project` section only; `dna show a b` → `error: no DNA key named 'a'`, nothing about `b`.

## Expected Behavior

A usage error, exit `2`: `error: unexpected argument 'sw-life-cycle'` — the same contract task-101/103
applied to unknown commands and options.

## Actual Behavior

Exit `0` with output that answers a different question than the one asked. The case that misleads is
`directives list developer`: it looks like a filtered answer and is not.

## Notes

- Every command registers `[positionals...]` generically (`src/cli/program.ts`), which is why the extra
  arguments reach no check.

## Triage & Execution Notes

- capture (bug-ingest, `bug-ingest-rel-v0.2-user-docs-findings-plan`): found during the v0.2
  `user-docs` phase probe (`user-docs-rel-v0.2-plan`, *Execution Notes → Findings*); proposed severity
  **low**. `release: ""` — scheduling belongs to `release-planning`.
