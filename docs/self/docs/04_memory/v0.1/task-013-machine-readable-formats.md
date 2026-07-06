---
id: "task-013-machine-readable-formats"
type: task
title: "Infrastructure: REQ-INT-05 — Machine-readable output formats"
status: done
release: "v0.1"
priority: "Blocker"
tags: ["v0.1", "architecture"]
ref: "REQ-INT-05"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

Implement the global `--format console|json|yaml` option (`console` default) across every `wingfoil`
command, backed by a shared `src/cli/output.ts` module, so query/status commands can be consumed by
scripts, CI pipelines, and dashboards, not only by a human reading a terminal. `console` targets
humans (colour-capable, free-form); `json`/`yaml` write a single, parseable structured value to
stdout with no banners or progress lines interleaved — diagnostics go to stderr regardless of format.
As Casey (integrating WingFoil into a CI pipeline), I want `wingfoil paths --format json` and
`wingfoil workflow status --format json` to emit valid, parseable JSON so that I can feed the output
directly into other tooling without screen-scraping console text.

## Acceptance Criteria

Per REQ-INT-05's fit criterion: "`--format json` and `--format yaml` produce output that parses as
valid JSON/YAML respectively for `wingfoil paths` and `wingfoil workflow status`."

Testable breakdown:
- `wingfoil paths --format json` output parses with a standard JSON parser (`JSON.parse`) into a
  single top-level value.
- `wingfoil paths --format yaml` output parses with a standard YAML parser into the same logical
  structure as the JSON case.
- `wingfoil workflow status --format json`/`--format yaml` satisfy the same two parse checks.
- `console` remains the default when `--format` is omitted, for every command.
- An invalid `--format` value is a usage error: exit `2`, `error: invalid --format value "<value>",
  expected one of: console, json, yaml`.
- For `json`/`yaml`, stdout carries only the structured payload — no colour codes or progress lines
  mixed in; diagnostic/progress output goes to stderr regardless of `--format`.
- Error payloads under `--format json`/`--format yaml` follow the structured `{"error": "...",
  "hint": "..."}` shape (shared with REQ-INT-08), written to stderr, not stdout.
- See BDD `p2-dna/P2.5-paths.feature`, `p4-workflow/P4.5-workflow-status.feature`.

## Implementation Notes

- Full contract: `docs/self/docs/04_memory/design/specs/spec-005-cli-command-contract.md` §2
  (machine-readable output formats) — the envelope rules (stdout-only, single top-level value); the
  payload *shape* per command is owned by that command's own spec.
- Grammar-level restatement (global flag registration, negatable-boolean interplay with `--color`):
  `docs/self/docs/04_memory/design/specs/spec-008-cli-grammar.md` §2.
- Register `--format` exactly once on the root Commander.js `Command` (per `dna.yaml` `tech_stack.cli`)
  so every command inherits it uniformly (REQ-SYS-05 parity) rather than re-declaring it per command.
- Related feature tasks that depend on this contract in this release: `task-028-implement-paths-category`
  (backlog `TASK-026`, `wingfoil paths` category command).

## Execution Notes

Worked on branch `task/task-013-machine-readable-formats` (dedicated worktree), parallel to the
task-agent (task-011 landed on `main` mid-work). Plan: `docs/05_plans/X_task-013-plan.md`.

- **design (scope finding):** the REQ-INT-05 `--format` infrastructure already exists on `main` from
  task-006 — `src/cli/output.ts` (`OutputFormat`, `isValidFormat`, `renderSuccess` json/yaml/console),
  `--format` registered once on the root `Command` in `src/cli/program.ts` (default `console`,
  inherited by every command), invalid-`--format` → exit `2` in the registrar, structured errors to
  stderr under json/yaml (`emitError`). The AC's literal fit criterion targets `wingfoil paths` and
  `wingfoil workflow status`, which do not exist yet (`CORE_MODULES` has only
  `dnaShow`/`directivesList`/`workflowList`; `paths` is task-028). Approver (Roberto) chose
  **"verify + defer"**.
- **deliverable (no production code):** since the infrastructure is complete, this task delivers the
  REQ-INT-05 **verification suite** (characterization, not red-first — the code under test already
  passes):
  - `test/cli/output.test.ts` — `isValidFormat` accept/reject; `renderSuccess` json parses via
    `JSON.parse` to a single top-level value; yaml parses via `js-yaml` `load` to the **same**
    structure as json; console = pretty-printed same structure.
  - `test/cli/program.integration.test.ts` — end-to-end fit criterion against `dna show` (stand-in for
    `paths`/`workflow status`): `--format json` ≡ `--format yaml` when both are parsed, `stderr` empty
    (envelope rule: only the structured payload on stdout).
- **checks:** full suite green (315 tests), `output.ts` 100% covered, overall 99% (> 80%), `tsc -p
  tsconfig.build.json` clean, eslint clean. Touched only `src/cli` tests — not `src/mcp`/`src/core`.

**Deferred (out of scope, traced):**
- `wingfoil paths --format json|yaml` parse checks → task-028 (`paths` command).
- `wingfoil workflow status --format json|yaml` parse checks → the `workflow status` command task.
  Both inherit the shared `--format` envelope verified here; each owning task only adds its own payload
  shape.
