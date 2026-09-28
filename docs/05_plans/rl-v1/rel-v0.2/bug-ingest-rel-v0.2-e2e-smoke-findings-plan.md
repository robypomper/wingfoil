---
id: "bug-ingest-rel-v0.2-e2e-smoke-findings-plan"
type: plan
title: "Bug ingest — v0.2 e2e-smoke delta-audit findings (G2, G3, missing produces:)"
status: active
version: "1.0"
workflow: "bug-ingest"
phase: "rel-v0.2-e2e-smoke-findings"
element: ""
release: "v0.2"
tmpl_version: 260703
---

## Context

The v0.2 `e2e-smoke` phase (`e2e-smoke-rel-v0.2-plan`) audited `scripts/e2e-smoke.cjs` against its own
contract, `e2e-smoke.yaml` (§3.2 of that plan). The audit found four gaps and one configuration
omission:

- **G1** was fixed and **G4** closed as a consequence. `task-107` closed `bug-029` (merged `77263fa1`).
- **G2**, **G3** and the missing `produces:` (§3.5) are carried by no element. The duplicate search is
  recorded below.

That plan's S4 requires each gap to be fixed, filed or waived in writing: a finding left only in
Execution Notes is not filed. The approver's decision of 2026-09-22 authorises gaps other than G1 to
the **next** release, so these bugs are filed with `release: ""` and scheduled by `release-planning`.

Per the interim no-workflow-engine rule and `dl-019`, starting the `bug-ingest` main requires a
coherent plan first; this `plan` element is that plan. It covers **one batch run of the `capture`
phase**. `triage` is the approver's.

**Preconditions:** the next free bug number is `bug-132`. The last existing file is
`bug-131-extra-positionals-are-silently-ignored.md` (`ls docs/self/docs/04_memory/bugs | sort -V | tail -1`).

**Produces:** `docs/04_memory/bugs/bug-132-*.md` .. `bug-134-*.md`, all at `status: open`.

## Phases / Steps

Mirrors `bug-ingest.yaml`. The capture is started during the `e2e-smoke` sub-workflow, whose element is
the release `minor-v0.2`, not a task. There is no task to inherit, so the bugs record the release
through `release-origin: "v0.2"`.

### `capture` — role: developer

- `memory.add(type: bug)` — one commit for all three skeletons. The frontmatter holds only `id` and
  `status: draft`.
- `memory.submit` — one commit with the full body content, `draft → open`. Frontmatter:
  `release-origin: "v0.2"` and `release: ""`.
- **Checks (post):**
  - `frontmatter.required: [title, severity]`;
  - every file's frontmatter parses with `js-yaml`;
  - every file scans clean under the `spec-007` patterns (`scanText`).

| Bug | Gap | Defect | Proposed severity |
|---|---|---|---|
| `bug-132-e2e-smoke-asserts-only-exit-0` | G2 | `drive-cli`'s post-check "exit-codes match spec-005" is exercised only for exit 0; nothing asserts exit 1 or 2 | low |
| `bug-133-e2e-smoke-never-revalidates-what-a-command-wrote` | G3 | "no schema-invalid artifact produced by any command" is proxied by next-command loading and a clean tree; no written artifact is re-loaded by its own loader | low |
| `bug-134-e2e-smoke-yaml-declares-no-produces` | §3.5 | `e2e-smoke.yaml` declares no `produces:`, although `dl-023` asked for a smoke-test report, so the phase's completion cannot be deduced | low |

**Duplicate search**, run on `qa/e2e-smoke-v0.2` at `9ca7211d`:
- `grep -rli "exit.code" bugs/ dls/ | xargs grep -li smoke` finds `dl-023` (the originating DL) and
  `dl-069`. `dl-069` mentions the smoke only as inheriting the lockfile gate's first step.
- `grep -rli "schema-invalid\|round-trip" … | xargs grep -li smoke` finds `dl-023` and `retro-v0.1`.
  `retro-v0.1`'s T5 is the `bug-005` finding that motivated the gate, not this gap.
- `grep -rli produces … | xargs grep -li e2e-smoke` finds `dl-023` (its Actions list the `produces:`),
  `bug-043`, `dl-026`, `dl-069` and `dl-076`. None of the last four concerns this workflow's `produces:`.

None carries these three.

## Handoff

- **Agent:** the `capture` phase: two commits, plus the checks recorded in Execution Notes.
- **Approver:** `triage` for each bug (`open → triaged` or `open → closed`). `bug-134` in particular
  overlaps with S5.3 of `e2e-smoke-rel-v0.2-plan`, which asks whether the workflow gains a
  `produces:`. The ruling there may triage `bug-134` or close it as a won't-fix.
- **Completion:** three bugs at `open` with valid frontmatter. The plan moves `active → done` once
  triage has run.

## Execution Notes
