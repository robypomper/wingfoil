---
id: "bug-029-e2e-smoke-omits-memory-submit"
type: bug
title: "The dl-023 e2e smoke omits `memory submit`, and nothing adds it back when the verb ships"
status: open
severity: "low"
release-origin: "v0.2"
release: ""
feature: "P1.6"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`dl-023` and its workflow `e2e-smoke.yaml` require the smoke to drive `memory add ...; memory submit ...`
through a freshly initialised project. `scripts/e2e-smoke.cjs` (from `task-060`, merged `117e95f`)
omits `memory submit` because the verb did not exist yet, and records that it "is added here when it
ships" — but no task, dependency or check owns that addition.

## Steps to Reproduce

1. On `main` (`8a6a091`): `sed -n 36,46p scripts/e2e-smoke.cjs` — `smokeSteps` runs `init`,
   `dna show`, `dna set`, `memory add`, `paths config`, `directives list`, `workflow list`. No
   `memory submit`.
2. `sed -n 9,11p scripts/e2e-smoke.cjs` — the module doc says `dl-023` also lists `memory submit`, that
   the verb does not exist yet (`task-045`), and that it is added "when it ships".
3. `grep -n "memory submit" docs/self/.wingfoil/workflows/custom/e2e-smoke.yaml` → the `drive-cli`
   phase action `cli.run("memory add ...; memory submit ...")`.
4. `sed -n 1,12p docs/self/docs/04_memory/v0.2/task-045-memory-submit.md` →
   `depends_on: ["task-036-frontmatter-lifecycle-validation"]`; `grep -n -i smoke` on the same file →
   no hit. On `task/task-045-memory-submit` (`7bfa835`),
   `git show 7bfa835:scripts/e2e-smoke.cjs | grep -n submit` → only the comment on line 10; no step.
5. `test/cli/e2e-smoke.test.ts:25-28` asserts the step list with `expect.arrayContaining([...])` over
   the current commands, so neither adding nor continuing to omit `memory submit` changes its result.

## Expected Behavior

When `memory submit` ships, the smoke drives it — the gate `dl-023` specifies covers the verb.

## Actual Behavior

The deferred step lives only in a source comment. `task-045` does not depend on `task-060`, and its
Acceptance Criteria do not mention the smoke, so it can reach `done` with the gate still skipping the
verb.

## Notes

- **Blocked by `bug-030`.** Adding `memory submit` to the smoke today would fail on both templates: the
  `memory.yaml` that `wingfoil init` scaffolds declares no state machine, so a transition verb throws
  in a fresh project. Fix `bug-030` first, ideally in the same task.
- Suggested fix: add the step (`memory submit <id>` on the task `memory add` just created, reading the
  id from its JSON output), and tighten `e2e-smoke.test.ts` to an exact list so a future omission is
  visible.
- Owner candidates: `task-045` itself (a one-step addition to its Acceptance Criteria), or the task
  that fixes `bug-030`.

## Triage & Execution Notes

- capture: raised by the implementation and review of `task-060-publish-pipeline` (Wave 2,
  2026-09-17), filed under `bug-ingest-rel-v0.2-wave2-review-findings-plan`. Severity `low`: the gate
  is staged (warn until green, per `e2e-smoke.yaml`) and the omission is recorded in the source.
