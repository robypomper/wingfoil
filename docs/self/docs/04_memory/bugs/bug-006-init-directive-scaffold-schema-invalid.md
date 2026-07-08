---
id: "bug-006-init-directive-scaffold-schema-invalid"
type: bug
title: "wingfoil init scaffolds directive .md files that fail the directives schema"
status: triaged
severity: "low"
release-origin: "v0.1"
release: ""
note: release_origin=v0.1, release_assigned=?
feature: "P5.1.1"
tmpl_version: 260703
---

## Summary

`wingfoil init`'s directive template generator (`directiveMd()` in `src/storage/templates.ts`)
emits `directives/**/*.md` files whose frontmatter (`name`, `kind`, optional `ref`) omits the
`id`, `type: directive`, and `title` fields the directives schema requires, so `wingfoil
directives list` errors `E_VALIDATION` (exit 1) on every freshly-initialized project.

## Steps to Reproduce

1. `wingfoil init --template Scrum` in a fresh git repo.
2. `wingfoil directives list`.

## Expected Behavior

`directives list` succeeds and lists the scaffolded directive stand-ins.

## Actual Behavior

`E_VALIDATION` (exit 1): the generated directive `.md` frontmatter is missing required
`id`/`type`/`title` fields (per the directives frontmatter schema, spec-013).

## Notes

- Same defect CLASS as bug-005 (init scaffolds config that fails its own consumers' schema),
  in the same generator file (`src/storage/templates.ts`), surfaced by task-032's real-CLI
  verification of the README and confirmed by task-032's independent review.
- **Deferred, NOT a v0.1 release blocker:** `directives list` is a Directives-pillar (P3)
  command that is out of v0.1's scope (Pillar Focus P1 Memory + P2 DNA only) and is
  deliberately left undocumented in the README — so this blocks no documented v0.1 command.
  bug-005 (the DNA/Memory scaffold half, which DID block documented v0.1 commands) was fixed
  in task-032; this sibling gap is filed for traceability and left for the release that ships
  the Directives CLI.
- Likely fix: extend `directiveMd()` to emit `id`, `type: directive`, and `title` (mirroring
  the bug-005 fix to `dnaYaml()`/`memoryYaml()`), guarded by a test that round-trips each
  generated directive file through the real directives schema (spec-013).

## Triage & Execution Notes

- 2026-07-07 (open): raised from task-032's review as a deferred `low`-severity sibling of
  bug-005. Out of v0.1 documented scope; no fix task scheduled.
- 2026-07-08 (triaged, DEFERRED): assessed **low**. `directives list` is a Directives-pillar (P3)
  command OUT of v0.1 scope (Pillar Focus = P1 Memory + P2 DNA) and deliberately undocumented in the
  README, so it blocks no documented v0.1 command. **Explicitly deferred by the approver from the v0.1
  release** — not a blocker; to be fixed in the release that ships the Directives CLI, alongside a
  directive-scaffold schema round-trip test (mirroring the bug-005 fix).
