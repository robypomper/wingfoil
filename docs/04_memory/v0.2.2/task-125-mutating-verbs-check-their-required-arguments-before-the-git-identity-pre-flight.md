---
id: "task-125-mutating-verbs-check-their-required-arguments-before-the-git-identity-pre-flight"
type: task
title: "Mutating memory and directive verbs check their required arguments before the git identity pre-flight"
status: pending
release: "v0.2.2"
priority: "high"
tags: ["v0.2.2", "cli", "exit-codes", "publish-blocker"]
ref: "bug-172-mutating-memory-and-directive-verbs-report-a-missing-git-identity-before-a-missing-required-argument"
bug: ["bug-172-mutating-memory-and-directive-verbs-report-a-missing-git-identity-before-a-missing-required-argument"]
depends_on: ["task-120-subcommand-help-describes-every-command"]
tmpl_version: 260703
---

## Description

Eight mutating verbs run `requireGitIdentity` (REQ-SEC-01, task-014) before they validate their
required arguments: `memory add|submit|approve|reject|deprecate` and `directive create|assign|remove`.
With no git identity configured, a missing required argument therefore exits `1` ("git identity not
configured") instead of the usage exit `2` that REQ-INT-04 and `spec-005-cli-command-contract` §1
require. The `dna` mutations and `init` already validate first. task-120's
`test/cli/help-positional-required.integration.test.ts` pins the exit `2` and fails in
`publish.yml`'s `gate` job, which has no git identity. That failure stopped the first `v0.2.2` tag
run (`36621412441`) before anything was staged (`bug-172`).

**Why in v0.2.2.** It blocks the v0.2.2 publish. The approver ruled on 2026-09-29: fix it in the
product (argument validation before the environment pre-flight), keep the test unchanged, and reuse
the version `0.2.2` once the fix is on `main`. This closes `bug-172`.

## Acceptance Criteria

1. In each of the eight verbs, every usage check (a missing or malformed required argument or option,
   thrown as `UsageError` → exit `2`) runs before `requireGitIdentity`. A missing required argument
   exits `2` with the same `missing required argument: …` message with or without a git identity.
   *Red-first:* a test that runs each verb with its required arguments missing and **no** git
   identity (an isolated environment: no `GIT_AUTHOR_*`/`GIT_COMMITTER_*`, `GIT_CONFIG_GLOBAL`
   pointing at an empty file, `GIT_CONFIG_NOSYSTEM=1`, an empty `HOME`) asserts exit `2` and fails
   on today's order.
2. With valid arguments and no git identity, each verb still refuses with the identity error
   (exit `1`) before it reads or writes anything. *Characterization:* the existing task-014 /
   REQ-SEC-01 tests keep passing unchanged. If one pins the old order for a missing-argument case,
   record it and update it here, with the reason.
3. The doc comments that describe the mutating-op order (the "1. requireGitIdentity pre-flight,
   2. Argument validation" lists in `src/core/index.ts`, `memoryAddFn` among them) state the new
   order. Every same-class description the task touches is fixed in-task. *Documentation.*
4. `test/cli/help-positional-required.integration.test.ts` is unchanged and passes both with the
   developer's git identity and with no git identity. The whole suite passes with no git identity,
   the way the `gate` job runs it (`env … npx jest` with the AC 1 isolation, exit `0`).
   *Verification.*
5. `npm test` green; coverage not regressing; the six gates green.

## Implementation Notes

- Out of scope: changing the test harness or `publish.yml` so an identity exists in CI (options (b)
  and (c), rejected by the approver in `bug-172`).
- Out of scope: `bug-171` (extra operands ignored) and `bug-131`, although they touch the same
  argument handling. Name them in Execution Notes if the change makes either easier or harder.
- The process gap in `bug-172` (no pre-tag check reproduces the `gate` job's environment) is not
  this task's. `release-publishing-rel-v0.2.2-plan` adds a no-identity `npx jest` run before the
  tag. A permanent fix is filed as its own element, if the review asks for one.

## Execution Notes

<!-- Filled by dev-loop. -->
