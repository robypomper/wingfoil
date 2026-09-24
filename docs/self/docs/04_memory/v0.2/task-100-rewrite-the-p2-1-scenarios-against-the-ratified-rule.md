---
id: "task-100-rewrite-the-p2-1-scenarios-against-the-ratified-rule"
type: task
title: "Rewrite `P2.1-dna-set.feature`'s first two scenarios so the acceptance contract asserts a write the ratified rule permits, in the grammar the CLI reference now records"
status: backlog
release: "v0.2"
priority: "high"
tags: ["v0.2", "dna", "bdd"]
ref: "bug-089-p2-1-bdd-scenarios-contradict-the-ratified-write-rule"
bug: ["bug-089-p2-1-bdd-scenarios-contradict-the-ratified-write-rule"]
depends_on: ["task-093-dna-mutation-surface-add-remove-update", "task-098-align-the-cli-reference-and-specs-to-the-ratified-dna-grammar"]
tmpl_version: 260703
---

## Description

Scenarios 1 and 2 of `docs/02_requirements/02_bdd/features/p2-dna/P2.1-dna-set.feature` run
`wingfoil dna set tech_stack.language python` and assert the key lands under `tech_stack`. The
ratified rule refuses that write: a path that does not resolve against the schema is refused, never
created. The approver ruled on 2026-09-24 that **the contract moves**.

The reasoning matters and is recorded in `bug-089`: these scenarios are stale *independently* of
`bug-084`. `spec-002` retired the fixed-key `tech_stack` object in favour of two flat lists, so
`stacks.technologies` is an array of `{name, category, ...}` entries and the schema declares no
`language` key anywhere. This is spec against spec with the later and more specific one winning — not
code against spec — so CLAUDE.md §10.1 is not in tension and nothing is being overruled.

Sequenced last of the three on purpose: `task-093` decides what the CLI does, `task-098` records it,
and this task writes the acceptance contract against a surface that has stopped moving.

## Acceptance Criteria

**AC1 — scenarios 1 and 2 assert a write the ratified rule permits**, against the current schema, in
the grammar `task-098` recorded. Run each rewritten scenario by hand against a throwaway
`wingfoil init --template Scrum` repository and paste the output into the Execution Notes. A Gherkin
step that has never been executed is a guess.

**AC2 — the refusal is covered too.** The old scenarios documented a *creating* write. Its replacement
in the contract is the refusal: a path that does not resolve is rejected at exit 1 with a message
naming the unknown field. That behaviour is the heart of `dl-081` and no scenario asserts it today.

**AC3 — scenario 3 is untouched.** `dna set ..language python` → `invalid key path` at exit 2 still
passes and still should. Confirm by running it; do not edit it.

**AC4 — nothing else in the file drifts.** Read the whole feature, not only the first two scenarios.
If another scenario asserts the retired `tech_stack` shape, name it in the Execution Notes and fix it
here — that is the same defect, not a new one. If none does, say that you checked.

**AC5 — the traceability chain is intact.** The feature carries `P2.1`. If the rewrite touches which
user story or requirement it exercises, update the references rather than leaving the chain pointing
at the old shape.

## Implementation Notes

- **There is no BDD runner.** `dev-loop`'s review gate declares one; nothing executes `.feature` files
  today, which is why this contradiction has been latent. So the scenarios cannot be made to fail and
  then pass — every AC is **characterization or verification** under `dl-014`/T1, and the substitute
  for a red is AC1's requirement that you execute each step by hand and record the output. Do not
  fabricate a red, and do not build a runner here.
- Read `task-093`'s and `task-098`'s Execution Notes first (`dl-015`). In particular `task-093` will
  have recorded what these scenarios do after the grammar change — that is your starting point, not
  the pre-change behaviour described in `bug-089`.
- `dl-075` applies to the durable prose you write.
