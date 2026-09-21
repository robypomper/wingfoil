---
id: "bug-030-init-memory-yaml-has-no-state-machine"
type: bug
title: "`wingfoil init` scaffolds a memory.yaml with no state machine, so no transition verb can run in a fresh project"
status: triaged
severity: "high"
release-origin: "v0.2"
release: ""
feature: "P1.13"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

The `memory.yaml` that `wingfoil init` writes (`src/storage/templates.ts`) declares neither a per-type
`states` block nor a `defaults.states` block. `resolveStateMachine` (`src/memory/state-machine.ts:138`,
unchanged since `task-005`, `d65fa91`) throws for any type in that situation, so every transition verb
— `memory submit` (`task-045`), and `approve`/`reject`/`deprecate` after it — fails in every project a
user creates with `wingfoil init`.

## Steps to Reproduce

Reproduced on `main` (`8a6a091`) with the built CLI, for both templates:

1. `npm run build`; in an empty directory: `git init`, set a git identity, one empty commit.
2. `node <repo>/dist/cli.js init --template Scrum` → exit 0.
3. `node <repo>/dist/cli.js memory add --type task --title 'Smoke task'` → exit 0.
4. `grep -c states .wingfoil/memory.yaml` → `1` — the only match is the header comment on line 3; no
   `states:` or `defaults:` key anywhere.
5. Load the scaffolded file with `js-yaml` and call
   `resolveStateMachine(memoryYaml, 'task')` from `dist/memory/state-machine.js` → throws:
   ``type "task" declares no `states` block and `defaults.states` is not set (REQ-STATE-08)``.
   Types present: `adr, bug, decision-log, release, release-line, task, tech-spec`.
6. Repeat 1–5 with `--template Kanban` → identical output.

`memory submit` itself exists only on `task/task-045-memory-submit`; there,
`git grep -n resolveStateMachine 7bfa835 -- src/core/memory-transition.ts` → line 78,
`machine = resolveStateMachine(memoryYaml, type);`, so the verb reaches the throw above.

## Expected Behavior

A freshly initialised project can run every Memory transition verb. Per **REQ-STATE-08** ("A Memory
type that does not declare its own `states` uses the default machine") a type without `states` falls
back to a default machine — and `spec-001` makes `defaults` optional in `memory.yaml`
(`defaults: # optional; applies to any type without its own states block (REQ-STATE-08)`), so the
fallback must exist whether or not the file declares one, or `init` must scaffold one.

## Actual Behavior

Both halves are missing at once: the scaffold declares no machine, and the resolver has no built-in
default to fall back to, so it throws a plain `Error` (not a `CoreError`). `memory add` is unaffected
because it does not transition.

## Notes

- **Why no gate caught it.** `test/memory/state-machine.test.ts` exercises the `defaults.states`
  fallback with fixtures that declare `defaults`, and `test/memory/element-schema.test.ts` resolves
  against this repository's own dogfooded `memory.yaml`; no test feeds the resolver the file `init`
  actually writes (`grep -rln 'resolveStateMachine\|resolveTransitionTarget' test | xargs grep -ln
  'templates\|scaffold\|runInit'` → no output). The dl-023 smoke would catch it the moment
  `memory submit` is added to it (`bug-029`).
- **Two readings of the fix, for triage:**
  1. Scaffold a `defaults.states` block (or a per-type `states` block) in `src/storage/templates.ts` —
     the scaffold's own header already promises "(per type) its state machine"
     (lines 269-270) and then emits none.
  2. Give `resolveStateMachine` a built-in default machine when `defaults` is absent, which is the
     literal reading of REQ-STATE-08 + `spec-001`'s "optional". The two are not exclusive.
- **Severity `high`, proposed:** latent on `main` today only because no transition verb has merged;
  once `task-045` lands, the headline v0.2 verb is broken for every new user, and `release-submit`'s
  dl-023 gate cannot exercise it. Should be fixed before or with `task-045`.

## Triage & Execution Notes

- capture: raised by the implementation and review of `task-045-memory-submit` (Wave 2, 2026-09-17),
  filed under `bug-ingest-rel-v0.2-wave2-review-findings-plan`. Searched for an existing element
  first: `grep -rln 'defaults.states' docs/self/docs/04_memory/bugs docs/self/docs/04_memory/design/dls`
  → no output; no bug or decision-log covers the scaffold.
