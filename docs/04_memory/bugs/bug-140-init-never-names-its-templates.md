---
id: "bug-140-init-never-names-its-templates"
type: bug
title: "Without a TTY, `wingfoil init` demands `--template` but neither its error nor `--help` names the available template values"
status: planned
severity: "low"
release-origin: "v0.2"
release: "v0.2.2"
feature: "P5.1.1"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

A non-interactive `wingfoil init` run with no `--template` flag fails with
`missing required argument: --template`, and `wingfoil init --help` documents the flag's presence
but not its accepted values — a scripted/agent caller has no way to discover `Scrum`/`Kanban`
without reading source.

## Steps to Reproduce

Reproduced against `wingfoil@0.2.1` in a fresh throw-away project (`git init`, identity via
`GIT_AUTHOR_NAME`/`GIT_AUTHOR_EMAIL` env only):

1. `wingfoil init < /dev/null` (no TTY, no `--template`) →
   ```
   error: missing required argument: --template
   ```
   exit code `2`. The message names the flag but not one legal value for it.
2. `wingfoil init --help` →
   ```
   Usage: wingfoil init [options]

   initialize WingFoil in the current git repository

   Options:
     --template <name>  methodology template to initialize with (non-interactive)
     -h, --help         display help for command
   ```
   Neither the option description nor any other line names `Scrum` or `Kanban`.
3. `grep -n "name: 'Scrum'\|name: 'Kanban'" src/storage/templates.ts` confirms the two names exist
   as `TemplateDefinition`s (`TEMPLATES` registry) that `--template`'s resolver already knows about
   — the CLI has the list in hand and simply never prints it.

## Expected Behavior

The missing-argument error and/or `--help`'s option description name the available templates (e.g.
`missing required argument: --template (one of: Scrum, Kanban)`), so a script or agent can discover
legal values without reading `src/storage/templates.ts`.

## Actual Behavior

Both surfaces are silent about the template registry; `e2e-smoke` always calls `init` with an
explicit, already-known `--template`, so this no-TTY / `--help` path is never exercised by any gate.

## Notes

- Root cause: `src/cli/init-command.ts`'s `emitError('missing required argument: --template', ...)`
  and `program.ts`'s `.option('--template <name>', 'methodology template to initialize with
  (non-interactive)')` both hard-code static text instead of interpolating the `TEMPLATES` registry
  `src/storage/templates.ts` already exports.
- Fix: build both strings from the same `TEMPLATES` list the resolver validates `--template` against,
  so the two can never drift from what is actually accepted.

## Triage & Execution Notes

- capture: filed by the v0.2 retrospective (retro-v0.2), reproduced independently of any external
  report, from the `init` CLI-surface review pass.
