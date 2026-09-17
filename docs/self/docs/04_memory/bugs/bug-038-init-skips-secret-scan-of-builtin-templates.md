---
id: "bug-038-init-skips-secret-scan-of-builtin-templates"
type: bug
title: "`init` does not secret-scan the built-in templates before writing them, as spec-007 §4 step 5 requires, and no task owns it"
status: open
severity: "medium"
release-origin: "v0.2"
release: ""
feature: "P3.8"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`spec-007-secret-hygiene-patterns` §4 step 5 assigns the secret scan a caller inside `init`: "run the
scan over the built-in directive/workflow templates about to be installed *before* writing any file.
Any `blocking` finding aborts `init` before writing partial assets, with a message naming the failing
template path and `pattern_id`". `init`'s pre-write integrity pass (`verifyBuiltinTemplates`, from
`task-044`) performs schema validation only. Nothing in `src/` outside `src/validation` calls the
scanner, and neither the task that built the scanner nor the task that built the integrity pass took
this call site.

## Steps to Reproduce

1. On `main` (`8a6a091`): `grep -rn 'scanText\|scanProjectSurface\|secret-scan' src/core src/storage` →
   no output. `src/core/init.ts:40` imports `verifyBuiltinTemplates` from `./builtin-integrity`, whose
   TSDoc (`src/core/builtin-integrity.ts:1-12`) scopes it to schema validation per `dl-031`.
2. On `task/task-057-builtin-directive-templates` (`9b77243`), which ships the real built-in templates:
   `git grep -n 'scanText\|secret-scan' 9b77243 -- src | grep -v src/validation` → no output. The
   templates are proven clean only by tests
   (`test/storage/builtin-directives.test.ts:16-17`: the text "trips ZERO spec-007 secret-scan
   findings"; `test/core/builtin-directive-templates.test.ts:89` runs `scanProjectSurface` after init).
3. Ownership: `docs/self/docs/04_memory/v0.2/task-043-secret-credential-hygiene.md:72-73` names the
   scanner as "the seam spec-007 §4 step 5 describes future callers (a commit-time gate, `task-044`'s
   init integrity check) consuming"; `grep -n -i scan docs/self/docs/04_memory/v0.2/task-044-builtin-template-integrity.md`
   → no output. `task-043` and `task-044` are both `done`.

## Expected Behavior

`init` scans the built-in template contents it is about to write, in the same pre-write pass as the
schema check, and aborts with the template path and `pattern_id` on any `blocking` finding.

## Actual Behavior

`init` writes the built-in templates without scanning them. A secret that reached a shipped template
would be installed into every new project and caught, at best, only by this repository's test suite.

## Notes

- **Why `medium` and not lower:** the shipped templates are clean today and tested, so there is no live
  leak. But `spec-007` §4 step 5 is an explicit requirement with no owner, `task-043`'s hand-off pointed
  at a `done` task that did not take it, and REQ-SEC-08 is the requirement it protects
  (`docs/02_requirements/03_sard/05_security-compliance.md:79-85`). Tests of this repository's template
  text do not cover templates built from a modified or forked package.
- **Scope interaction with `dl-031`:** `dl-031` (`ready`) settled REQ-SEC-10's integrity depth as schema
  validation, with no digest or manifest; it did not remove `spec-007`'s separate secret-scan gate,
  which `spec-007` §4 step 5 describes as "an additional integrity gate run in the same pre-write pass".
- **Suggested fix:** in `verifyBuiltinTemplates` (or next to it in `init`), run `scanText` over each
  template's content before `initStorage`, reusing `SECRET_PATTERNS`; add an abort test with a planted
  fake secret in a template source override (the `builtinTemplates` test hook already exists).
  Best landed after `task-057` merges, since it changes which templates exist.

## Triage & Execution Notes

- capture: raised by the review of `task-057-builtin-directive-templates` (Wave 2, 2026-09-17), filed
  under `bug-ingest-rel-v0.2-wave2-review-findings-plan`.
