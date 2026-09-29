---
id: "bug-129-init-error-names-a-migration-command-that-does-not-exist"
type: bug
title: "`wingfoil init` on an initialised project says \"use a migration command\" — no such command exists"
status: in-review
severity: "low"
release-origin: "v0.2"
release: "v0.2.2"
feature: "P5.1.1"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

The refusal to re-initialise points the user to a command WingFoil does not have.

## Steps to Reproduce

1. A throwaway repository: `git init`, a git identity, then `wingfoil init --template Scrum`, with
`wingfoil` = `node dist/cli.js` built from branch `docs/user-docs-v0.2` at `79a76d6e`.
2. `wingfoil init --template Scrum` again → `error: WingFoil already initialized (use a migration command to change config)`, exit `1`.
3. `wingfoil --help` lists no migration command.

## Expected Behavior

The message names what actually works: edit the files under `.wingfoil/` (or use `dna`/`directive`
commands) and commit.

## Actual Behavior

It sends the user looking for a command that does not exist.

## Notes

- Exit code `1` is correct; only the hint is wrong.

## Triage & Execution Notes

- capture (bug-ingest, `bug-ingest-rel-v0.2-user-docs-findings-plan`): found during the v0.2
  `user-docs` phase probe (`user-docs-rel-v0.2-plan`, *Execution Notes → Findings*); proposed severity
  **low**. `release: ""` — scheduling belongs to `release-planning`.
