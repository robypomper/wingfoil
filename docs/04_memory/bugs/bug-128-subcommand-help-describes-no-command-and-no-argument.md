---
id: "bug-128-subcommand-help-describes-no-command-and-no-argument"
type: bug
title: "Subcommand `--help` describes nothing: no command has a description and every argument and option reads as a placeholder"
status: in-review
severity: "low"
release-origin: "v0.2"
release: "v0.2.2"
feature: "P5.1"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`wingfoil <noun> --help` lists its verbs with no description, and `wingfoil <noun> <verb> --help`
describes every command's positional with the same generic sentence and its options as `type value`,
`reason value`, `name value`. A user cannot learn the surface from the CLI itself.

## Steps to Reproduce

1. `wingfoil memory --help` → `add [options] [positionals...]`, `approve [options] [positionals...]`, … — no descriptions.
2. `wingfoil memory approve --help` → `positionals  optional positional arguments (the command target — e.g. a section/category name, a document id, or a dna field path)` and `--reason <value>  reason value`.
3. Same shape for every verb: `memory add` (`--type <value>  type value`), `directive create` (`--name <value>  name value`), `directives list` (`--role <value>  role value`).

## Expected Behavior

Each verb has a one-line description; its target is named for what it is (`<id>`, `<path>`, `<name>`)
and marked required where it is; each option says what it means — the information `docs/cli-reference.md`
now carries.

## Actual Behavior

The positional is documented as optional even where it is required (`memory approve` without it
exits `2`), and only `init`, `mcp` and the `dna` value/entry options carry real descriptions.

## Notes

- Help text is derived from `CORE_MODULES` (`src/cli/program.ts` registers every positional generically),
  so a fix is a registry-level description seam rather than per-command strings.
- The user guide and `docs/agents.md` list this under their known limitations.

## Triage & Execution Notes

- capture (bug-ingest, `bug-ingest-rel-v0.2-user-docs-findings-plan`): found during the v0.2
  `user-docs` phase probe (`user-docs-rel-v0.2-plan`, *Execution Notes → Findings*); proposed severity
  **low**. `release: ""` — scheduling belongs to `release-planning`.
