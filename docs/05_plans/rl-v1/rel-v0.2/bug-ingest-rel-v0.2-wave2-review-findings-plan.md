---
id: "bug-ingest-rel-v0.2-wave2-review-findings-plan"
type: plan
title: "Bug ingest — v0.2 Wave 2 review findings (defects on main)"
status: active
version: "1.0"
workflow: "bug-ingest"
phase: "rel-v0.2-wave2-review-findings"
element: ""
release: "v0.2"
tmpl_version: 260703
---

## Context

Companion to `decision-log-ingest-rel-v0.2-wave2-review-findings-plan`, same trigger: the Wave 2
implementation passes and independent reviews of the `dl-041` implementation (`ebfb1e3`),
`task-045-memory-submit`, `task-051-directive-assign`, `task-055-auto-load-directives-by-role`,
`task-057-builtin-directive-templates`, `task-058-mcp-prompts-role-based`, `task-060-publish-pipeline`
(merged `117e95f`) and `task-061-publish-secrets`. They produced a consolidated batch of eighteen bug
candidates (`B1`..`B18`). Findings that are **defects** — not spec conflicts, and not the reviewed task's
own defects, which its gate's `fallback: { step: red }` already covers — are `bug` elements. Left in
Execution Notes they are unreachable, because nothing reschedules a `done` task's notes.

Every candidate was re-verified before being written up — by running the command, not by transcribing
the review — against `main` at `8a6a091`. Evidence that exists only on an unmerged task branch was read
there with `git show <sha>:<path>` (or transpiled from it without checking it out) and is labelled with
branch and sha. `task-055` merged to `main` (`9c83ca2`) while this batch was being written; the elements
that depend on it say so. Four candidates did not survive verification and are **not** filed (below).

Per the interim no-workflow-engine rule and `dl-019`, starting the `bug-ingest` main requires a coherent
plan first; this `plan` element is it. It covers **one batch run of the `capture` phase**.

**Preconditions:** next free bug number is `bug-028` (`ls docs/self/docs/04_memory/bugs` → the last
entry is `bug-027-commit-paths-commits-whole-index`).

**Produces:** `docs/04_memory/bugs/bug-028-*.md` .. `bug-041-*.md`, all at `status: open`.

## Phases / Steps

Mirrors `bug-ingest.yaml` v1.0 exactly. Started standalone (no active `element` context), so every bug
is top-level and inherits nothing — in particular none is attributed to the task whose review raised
it.

### `capture` — role: developer

- `memory.add(type: bug)` — one commit, all skeletons, frontmatter `id` + `status: draft` only.
- `memory.submit` — one commit, full body content, `draft → open`; `release-origin: "v0.2"`,
  `release: ""` (scheduling belongs to `release-planning`).
- **Checks (post):** `frontmatter.required: [title, severity]`; every file's frontmatter parses with
  `js-yaml`; every file scans clean under the `spec-007` patterns (`scanText`), since the files land on
  the scan surface.

| Bug | Source | Defect | Proposed severity |
|---|---|---|---|
| `bug-028-mcp-command-missing-from-cli-specs` | B1 | `wingfoil mcp` is absent from `spec-005`, `spec-006` §3 and `spec-008` §1 | low |
| `bug-029-e2e-smoke-omits-memory-submit` | B3 | the dl-023 smoke omits `memory submit`, and nothing re-adds it when the verb ships | low |
| `bug-030-init-memory-yaml-has-no-state-machine` | B6 | a freshly initialised project declares no state machine, so every transition verb throws | high |
| `bug-031-one-invalid-memory-doc-breaks-lookups` | B7 | one unparseable Memory document breaks search/history repo-wide, unnamed in the error | low |
| `bug-032-spec-004-stale-illegal-transition-example` | B8 | `spec-004` §4.3 still shows the pre-dl-032 illegal-transition message | low |
| `bug-033-memory-add-frontmatter-edit-matches-nested-keys` | B9 | `memory add`'s private field setter edits nested keys and drops inline comments | low |
| `bug-034-mcp-error-prefix-doubled` | B10 | SDK-raised MCP errors reach clients as `MCP error -32602: MCP error -32602: …` | low |
| `bug-035-missing-wingfoil-dir-leaks-enoent` | B11 | in a git root with no `.wingfoil/`, `wingfoil mcp` starts anyway; DNA reads fail with a raw `ENOENT` and an absolute path | low |
| `bug-036-channel-enumeration-misses-created-files-and-commits` | B12 | the REQ-SEC-05 no-persistence helper misses created files and commits | medium |
| `bug-037-dotenv-secret-pattern-misses-prefixed-lines` | B13 | `dotenv-style-secret-line` is column-0 anchored; prefixed short-value lines go undetected | medium |
| `bug-038-init-skips-secret-scan-of-builtin-templates` | B15 | `init` does not secret-scan built-in templates before writing (spec-007 §4 step 5), and no task owns it | medium |
| `bug-039-p3-8-scenario-names-unregistered-trunk-based-template` | B16 | BDD P3.8 Sc.2 selects a "Trunk-Based" init template that does not exist | low |
| `bug-040-builtin-directive-docs-stale-after-task-057` | B17 | "not yet implemented" built-in directive docs become stale when `task-057` merges | low |
| `bug-041-frontmatter-edit-yaml-edge-cases` | B18 | `task-045`'s frontmatter editor mishandles three YAML shapes | medium |

**Not filed — did not survive verification:**

- **B2** (README describes the MCP server as Resources-only). True only of
  `task/task-058-mcp-prompts-role-based`: on `main` the production server registers Resources only
  (`src/mcp/server.ts:56`), so `README.md:91,99` is accurate today. The README going stale when Prompts
  land is precisely what `user-docs.yaml`'s `align-user-docs` phase exists for (`produces: README.md`;
  post-check "user-facing docs aligned with the release's shipped CLI/feature surface"). Hand it to that
  phase; no element. (Contrast `bug-040`: the specs and directive notes it lists have no such gate.)
- **B4** (nothing runs `scripts/e2e-smoke.cjs`). False: `test/cli/e2e-smoke.test.ts` runs `runSmoke`
  against `dist/cli.js` on every `npm test`, and `scripts/publish-staging.cjs:32,241-242` runs it at
  staging.
- **B5** (the `wingfoil://directives/list` payload is untested on the MCP side). False in substance:
  that Resource is derived by `registerCoreModules`, which the production server does not call
  (`src/mcp/server.ts:56` registers only `registerReadOnlyResources`); the payload is the registered
  operation's return value, pinned directly by `test/core/directives-list.test.ts` (at `749e0e9`, now
  merged, it asserts `{ entries, warnings }`); the registrar's serialisation is a generic
  `JSON.stringify(result.value)` (`src/mcp/registrar.ts:27`) covered by `test/mcp/registrar.test.ts`.
- **B14** (the `spec-007` §3 ignore list is unusable here, so the scanner's own fixture suite cannot be
  registered). The premise does not hold: `test/validation/secret-scan.test.ts` is **outside** the scan
  surface — `SCAN_SURFACE_ROOTS` is `.wingfoil`, `docs/self/.wingfoil`, `docs/self/docs/04_memory`
  (`src/validation/secret-scan.ts:304`) — so nothing needs registering; `scanProjectSurface` on this
  repository → 239 files, 0 blocking, 0 warnings, 0 info. `task-061`'s own notes
  (`git show 986e613:…/task-061-publish-secrets.md`, lines 259-264) say the same ("It is outside the scan
  surface"). The residual — `DEFAULT_IGNORE_FILE` is `.wingfoil/security-ignore` (`:307`) with no
  `docs/self/` analogue, unlike §1's surface — has no observable effect today; worth a line in the
  `spec-007` amendment `bug-037` already requires, not an element of its own.

### `triage` — role: tech-lead, approval gate

- `memory.approve` — `open → triaged`, per bug, on Roberto's explicit instruction only.
- **Approval:** `by_role: approver`. **Fallback:** reject → `capture` (`open → closed` for
  wontfix/duplicate, per `memory.yaml`'s `gates.open.reject`).

Not part of this plan's execution: the agent stops at `open`.

## Handoff

**Agent:** the whole `capture` phase (two commits).

**Approver (Roberto):** every triage decision. Order of urgency:

- **`bug-030` first.** Latent on `main` only because no transition verb has merged; once `task-045`
  lands, `memory submit` fails in every project `wingfoil init` creates — and `bug-029` cannot be fixed
  until it is.
- **`bug-036`** before `task-058` is approved: its REQ-SEC-05 no-persistence evidence rests on the same
  helper.
- **`bug-041`** before `task-047` (`memory reject`), the first verb that can hit its silent case; the
  reviewer recommends `task-047` absorb it under `dl-045` — an approver scheduling call.
- **`bug-037`** and **`bug-038`** before the first real publish (`dl-056`): both concern the secret gate.
- **`bug-035`** contradicts `spec-014` §1 and bears on `dl-026`; `task-058`'s Prompts inherit it.
- **`bug-040`** is cheapest fixed inside `task-057` before its approval.

**Completion:** the plan reaches `done` when every bug is `triaged` (or `closed` as wontfix) — i.e.
after the approver gate, not at the end of `capture`.
