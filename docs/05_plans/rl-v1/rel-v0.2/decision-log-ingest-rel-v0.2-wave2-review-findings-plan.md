---
id: "decision-log-ingest-rel-v0.2-wave2-review-findings-plan"
type: plan
title: "Decision-log ingest — v0.2 Wave 2 review findings (spec-level conflicts)"
status: active
version: "1.0"
workflow: "decision-log-ingest"
phase: "rel-v0.2-wave2-review-findings"
element: ""
release: "v0.2"
tmpl_version: 260703
---

## Context

The Wave 2 implementation passes and independent reviews — the `dl-041` implementation (`ebfb1e3`),
`task-045-memory-submit`, `task-051-directive-assign`, `task-055-auto-load-directives-by-role`,
`task-057-builtin-directive-templates`, `task-058-mcp-prompts-role-based`, `task-060-publish-pipeline`
(merged `117e95f`) and `task-061-publish-secrets` — surfaced findings **no task can resolve on its own**:
two authoritative documents contradicting each other, a contract the specs leave undefined, or an
implementation choice that has to be ratified before downstream tasks build on it. Capturing them as
`decision-log` elements is what makes them schedulable; in a task's Execution Notes they are re-read only
by a downstream task's `agent.read_related` (`dl-015`), which mandates reading, not acting.

Per the interim no-workflow-engine rule and `dl-019`, starting the `decision-log-ingest` main requires a
coherent plan first; this `plan` element is it. It covers **one batch run of the `capture` phase**
producing fifteen DLs (`dl-046`..`dl-060`), plus a body-only review addendum to two DLs already
`in-discussion` (`dl-039`, `dl-040`). `bug`-shaped findings from the same reviews are out of scope here —
see `bug-ingest-rel-v0.2-wave2-review-findings-plan`.

**Preconditions:** next free DL number is `dl-046` (`ls docs/self/docs/04_memory/design/dls` → the last
numbered entry is `dl-045-absorbed-bug-back-reference`).

**Produces:** `docs/04_memory/design/dls/dl-046-*.md` .. `dl-060-*.md`, all at `status: in-discussion`;
an appended `## Review addendum (2026-09-17)` section in `dl-039` and `dl-040`.

## Phases / Steps

Mirrors `decision-log-ingest.yaml` v1.0 exactly. Started standalone (no active `element` context), so the
created DLs are top-level and inherit nothing.

### `capture` — role: product-owner

- `memory.add(type: decision-log)` — one commit, all skeletons, frontmatter `id` + `status: draft` only.
- `memory.submit` — one commit, full body content, `draft → in-discussion`;
  `context: "dev-loop-review"`, `release: ""`.
- **Checks (post):** `frontmatter.required: [title]`; every file's frontmatter parses with `js-yaml`;
  every file scans clean under the `spec-007` patterns.

Every DL states the conflict with both sides cited from source, lists the options and records a
recommendation — it does **not** pre-decide (`dl-051` records a decision the approver already took in
chat). Each claim was verified against `main` (`8a6a091`; `9c83ca2` where `task-055`'s merge matters), or
read-only on the named task branch and sha, not transcribed from the review reports. Where a batch claim
turned out wrong, the element carries the corrected fact (notably `dl-047`: no tech-spec carries a
`version:` — the three hits are YAML examples).

| DL | Source | Question |
|---|---|---|
| `dl-046-bootstrap-commands-in-spec-006-section-3` | D1 | How §3 represents `init`/`audit`: the MCP column implies a `project` module no code has; REQ-SYS-05 vs `init` |
| `dl-047-tech-specs-carry-no-version-field` | D2 | The doc-versioning directive assumes a `version:` no tech-spec carries |
| `dl-048-spec-004-undefined-role-refusal` | D3 | `spec-004` §3 does not define the undefined-role refusal P5.2.2 requires |
| `dl-049-mcp-prompt-role-set-read-time` | D4 | `spec-014` §2 vs `spec-004` §3.1 on when the role set is read; whether Prompts advertise `listChanged` |
| `dl-050-execution-context-warnings-reach-no-operator` | D5 | Nothing surfaces `ExecutionContext.warnings` to a human |
| `dl-051-dangling-directive-binding-warning` | D6 | Ratify `task-055`'s dangling-binding warning (approver accepted in chat) |
| `dl-052-verdaccio-started-by-staging-script-in-ci` | D7 | `spec-015` §3 stage 2's CI service container vs `adr-009` §3 |
| `dl-053-illegal-transition-target-for-verbless-edges` | D8 | The `<to>` printed for an illegal transition — before `task-046`/`task-047` |
| `dl-054-submit-commit-subject-bracket` | D9 | Is `[from → to]` part of the canonical `submit` subject? |
| `dl-055-core-error-details-never-reach-operators` | D10 | `CoreError.details` (dl-032's `detail`, file paths) is dropped by every surface |
| `dl-056-first-real-publishing-run` | D11 | Who owns a first real staging run; `bug-022` inside the release gate |
| `dl-057-publish-pipeline-hardening` | D12 | SHA pins, timeouts, SIGKILL fallback, annotated tag, trusted publishing, tracing, explicit userconfig |
| `dl-058-directive-create-with-builtin-id` | D13 | May `directive create` take a built-in id? |
| `dl-059-builtin-security-directive-bound-to-no-role` | D14 | The built-in `security` directive is bound to no role |
| `dl-060-roles-yaml-binds-by-directive-id` | task-051 review | `spec-011` says `roles.yaml` binds by name; all code binds by id |

Addenda (one `docs(self)` commit, body-only append, no frontmatter change):

- **A1 → `dl-040`**: its `memory/search/{query}` premise is wrong; a further, untracked URI divergence
  (`pathsQuery` → `wingfoil://paths` vs §3's `wingfoil://dna/paths`).
- **A2 → `dl-039`**: heading-level inversion — each directive body's own H1 nests under the prompt's
  `## Directive: {id}` H2.

### `approve` — role: approver

- `memory.approve` — `in-discussion → ready`, per DL, on Roberto's explicit instruction only.
- **Approval:** `by_role: approver`. **Fallback:** reject → `capture`.

Not part of this plan's execution: the agent stops at `in-discussion`.

## Handoff

**Agent:** the whole `capture` phase (two commits) and the addenda commit.

**Approver (Roberto):** every `approve`/`reject`. The ones that gate queued work:

- **`dl-051`** was accepted in chat on 2026-09-17; the approve commit is the orchestrator's. `task-055`
  is already merged (`9c83ca2`), so its `spec-012` §5 amendment is now overdue rather than upcoming.
- **`dl-053`** before `task-046`/`task-047` reach `design`.
- **`dl-054`** before `task-045` is `done` — it emits the subject.
- **`dl-049`** (with `dl-048` and `dl-039`, same section) before `task-058`'s next review.
- **`dl-058`** before `task-057` is approved — it introduces the behaviour.
- **`dl-056`** before the v0.2 `release-publishing` phase; `dl-057`'s (d)/(e) follow from it.

**Completion:** the plan reaches `done` when all fifteen DLs are `ready` (or rejected/deprecated) — i.e.
after the approver gate, not at the end of `capture`.
