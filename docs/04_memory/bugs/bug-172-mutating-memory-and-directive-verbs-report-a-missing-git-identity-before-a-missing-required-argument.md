---
id: bug-172-mutating-memory-and-directive-verbs-report-a-missing-git-identity-before-a-missing-required-argument
type: bug
title: "Mutating memory and directive verbs report a missing git identity before a missing required argument"
status: in-review
severity: "high"
release-origin: "v0.2.2"
release: "v0.2.2"
feature: "P5.1.4"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

With no git identity configured, `memory add|submit|approve|reject|deprecate` and
`directive create|assign|remove` refuse on the identity pre-flight (exit `1`) before they check
their required arguments. A missing required argument is a usage error that must exit `2`
(REQ-INT-04, `spec-005-cli-command-contract` §1). task-120's test pins the exit `2` and fails in
`publish.yml`'s `gate` job, which has no git identity. That failure blocked the first `v0.2.2` publish.

## Steps to Reproduce

1. Build (`npm run build`), then run the test harness with no git identity:
   ```sh
   env -u GIT_AUTHOR_NAME -u GIT_AUTHOR_EMAIL -u GIT_COMMITTER_NAME -u GIT_COMMITTER_EMAIL \
     GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 HOME=<an empty directory> \
     node test/cli/fixtures/cli-harness.cjs "$PWD/dist" "$PWD/test/cli/fixtures/wingfoil-root" memory submit
   ```
2. Repeat with `memory approve`, `memory reject`, `memory deprecate`, `directive remove` (no
   positional), and with `memory add`, `directive create`, `directive assign` (no options).
3. For contrast, run the same step 1 command without the `env` prefix, on a machine with a git
   identity.

## Expected Behavior

`error: missing required argument: memory submit <id>` and exit `2`, whatever the git identity. An
argument check reads nothing, so running it first does not weaken REQ-SEC-01's "refuse before any
read or write".

## Actual Behavior

Measured on `main` `a1a2850b`, 2026-09-29:

| Command (arguments missing) | No git identity | With git identity |
|---|---|---|
| `memory submit` / `approve` / `reject` / `deprecate`, `directive remove` | `error: git identity not configured (user.name/user.email)`, exit `1` | `missing required argument: … <id>` / `<name>`, exit `2` |
| `memory add`, `directive create`, `directive assign` | the same identity error, exit `1` | the `missing required argument: --…` usage error, exit `2` |
| `dna set`, `dna add` | `missing required argument: wingfoil dna set <path> --value <value>`, exit `2` | the same, exit `2` |
| `memory history` (read-only, no pre-flight) | `missing required argument: memory history <id>`, exit `2` | the same |

In the `v0.2.2` tag run `36621412441` (`gh run view 36621412441 --log-failed`), the `gate` job's
`prepublishOnly` step failed on 5 tests of
`test/cli/help-positional-required.integration.test.ts` (line 70, `Expected: 2`, `Received: 1`):
`directive remove`, `memory approve`, `memory deprecate`, `memory reject` and `memory submit`, each
without its positional. The job had 159/160 suites and 2619/2624 tests passing. `stage` and `promote`
were skipped. Nothing was published: `npm view wingfoil@0.2.2 version` → `E404`.

## Notes

- **Root cause.** The mutating op bodies in `src/core/index.ts` call `requireGitIdentity(root)` first
  and validate arguments second. `memoryAddFn`'s doc comment states that order explicitly as the
  mutating-op template: step 1 is the pre-flight, step 2 argument validation. The `dna` mutations
  already validate before the identity check (the table above), so the two families disagree.
- **Why it was not seen before the tag.** task-120 added the test (`d1673d23`). `publish.yml` is the
  repository's only workflow and runs only on a tag, so no CI had ever run the suite without a git
  identity. Every local run, `release-submit`'s gates and `npm run publish:staging` ran on a machine
  with one. `publish:staging` runs no jest at all. This process gap is the second half of the
  finding: no pre-tag check reproduces the `gate` job's environment.
- **Approver ruling, 2026-09-29.**
  - Fix in the product (option 1a): argument validation moves before the environment pre-flight in
    every mutating verb. The test is not changed.
  - Rejected alternatives: (b) give the test harness a fake identity, which leaves a user without
    one getting exit `1` for a usage error; (c) configure an identity in the `gate` job, which hides
    the defect.
  - `0.2.2` is reused: the tag is deleted and re-created on the fix. npm never saw the version.
- **Duplicate search:** `grep -il "git identity" docs/04_memory/bugs/*.md` and the same over
  `identity` + `exit 2`/`usage`. No bug covers this order. `bug-149` (authority vs author identity)
  and `bug-131` (extra positionals ignored) are different defects.
- **Related:** task-014 (`requireGitIdentity`, REQ-SEC-01), task-120 / `bug-128` (the test),
  `bug-167` (a known flake in the same `gate` step, not this).

## Triage & Execution Notes

<!-- Filled at triage and by the fix task. -->
