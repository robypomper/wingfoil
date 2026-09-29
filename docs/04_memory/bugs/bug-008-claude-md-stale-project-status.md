---
id: "bug-008-claude-md-stale-project-status"
type: bug
title: "CLAUDE.md §1 declares the project pre-implementation (\"no source code yet\"), misleading every agent that reads the entry point"
status: closed
severity: "medium"
release-origin: "v0.2"
release: "v0.2"
tmpl_version: 260703
---

## Summary

`CLAUDE.md` §1 carries a *"Project status: specification & design phase"* callout asserting that there is
**no source code yet**, that the `wingfoil` CLI/MCP tool is **not implemented**, and instructing agents to
*"not assume runtime behaviour exists"*. All three claims have been false since `minor-v0.1` reached
`released`: the implementation exists, is packaged, and is under active extension in `minor-v0.2`.

## Steps to Reproduce

1. Read `CLAUDE.md` §1 (the blockquote immediately under the North Star / License bullets) as a fresh
   agent starting a session — it is the first status statement in the repository's entry point.
2. `ls src/` → `cli/ core/ directives/ dna/ mcp/ memory/ storage/ validation/ workflow/ cli.ts` (nine
   modules plus the CLI entry), with the matching suites under `test/`.
3. `grep -E '"version"|"bin"' -A2 package.json` → `version: 0.1.0`, `bin: { "wingfoil": "./dist/cli.js" }`.
4. `grep -h '^status:' docs/self/docs/04_memory/planning/rl-v1/*.md` → `minor-v0.1: released`,
   `minor-v0.2: in-development`, and 32 task documents under `docs/self/docs/04_memory/v0.2/`.

Steps 2–4 contradict step 1.

## Expected Behavior

§1 states the real project status — implementation underway, `v0.1` released, `v0.2` in development —
and points agents at the shipped CLI/MCP surface, while keeping the accurate part of the original intent:
the specs in `docs/01_vision/` and `docs/02_requirements/` remain authoritative, and features not yet
delivered by a released version must not be assumed to work.

## Actual Behavior

An agent reading the entry point concludes that no runtime exists and that only specification/authoring
work is possible. Golden rule #6 in §10 repeats the same instruction (*"The tool isn't built yet —
describe/author configuration and specs; don't assume runtime features"*), so the error is reinforced at
both ends of the document. The practical effect is an agent that will not run, test, or reason about
`src/` — in a project whose North Star is the Determinism Index, the entry point misdirecting every
session is a determinism defect, not a cosmetic one.

## Notes

- **Fix scope to confirm at triage/fix time.** The stale text is §1's status blockquote and §10 golden
  rule #6. Two nearby claims were checked and are **still accurate**, so they must not be swept into the
  fix: §3's *"it will move to the repository-root `.wingfoil/` once the tool can manage it"* (no
  root-level `.wingfoil/` exists), and §3's note that the P3.8 **built-in** directive templates are not
  implemented (`task-057-builtin-directive-templates` is still `backlog`).
- **Severity rationale (medium).** No product-code defect and no data loss; an agent can discover `src/`
  on its own. But it misdirects the highest-traffic document in the repository at session start, and it
  survived an entire release cycle unnoticed.
- **First bug filed against a governance document** rather than product code — `bug-001`…`bug-007` are
  all CLI/runtime defects. The `bug` type description ("A defect report") accommodates it; flagged here
  so triage can confirm the type is the right vehicle rather than inheriting the precedent silently.
- **Root cause is ownership, not wording.** No workflow phase owns `CLAUDE.md`: the `user-docs` gate
  (`dl-013`) produces `README.md`, `docs/user-guide.md`, `docs/cli-reference.md`, `docs/examples/` and
  `CHANGELOG.md` — the agent-facing entry point appears in no `produces:` and no `checks:` anywhere in
  `.wingfoil/workflows/`. That is why the text survived `v0.1`'s `user-docs` and `release-submit` gates.
  Captured separately as **`dl-025-agent-facing-docs-ownership`**; fixing this bug without `dl-025`
  guarantees the same drift recurs at `v0.2` close.

## Triage & Execution Notes

- Raised 2026-09-14 during a session-start question about the WingFoil MCP server, which surfaced the
  contradiction between §1's status claim and the presence of `src/mcp/` + a packaged `wingfoil` bin.
- Severity `medium` confirmed by the approver (Roberto) at capture time, before triage.
- `release` intentionally left empty so the `dl-016` selection filter re-offers this bug at the next
  `release-planning` (`triage-bugs` → `build-backlog`), rather than pinning it to a release out of flow.
