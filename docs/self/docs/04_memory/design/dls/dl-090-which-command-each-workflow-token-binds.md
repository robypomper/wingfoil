---
id: "dl-090-which-command-each-workflow-token-binds"
type: decision-log
title: "Workflow `actions:` and `checks:` tokens bind to no command: where a binding is declared, whether it is strict, how it takes arguments, what its exit code means, who may change it, and what an `agent.*` token binds to"
status: in-discussion
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

**How this decision-log reached Memory.** It is not a finding of the v0.2 retrospective. The
approver decided on 2026-09-22 that a proposal about token bindings, written before the retrospective
and kept outside the repository, would be promoted to a decision-log during the retrospective
(`retrospective-rel-v0.2-plan` §6.1). The retrospective was the next phase that authored
decision-logs, so it was a matter of scheduling. `retro-v0.2` records it as an action taken, under
the disposition "workflow action and check token bindings, six questions", target v0.3. Nothing in the
retrospective's mining led to it. The source proposal is not cited, because a reader could not resolve
it (`dl-075`). Each question below is restated against the token it concerns in
`docs/self/.wingfoil/workflows/custom/*.yaml`, which is versioned.

**What a token is today.** `spec-003-workflows-yaml-schema` (`approved`) § "Action expressions"
defines an action as a "free-form string token naming one atomic operation". Its § "Check
expressions" defines a check as a "free-form assertion string, evaluated to a boolean gate". Its
Consequences call both grammars "enumerated string families, not a closed grammar". The loader
matches: the `Phase` schema in `src/workflow/schema.ts` types `actions` as `z.array(z.string())`, and
each check as `Check = z.string()`. `wingfoil workflow list` therefore accepts any string in either
place. Nothing states which command, if any, a token runs.

**The population, measured at `a20b346c`.** The worktree this was measured in has no diff from
`a20b346c` under the workflows or `src/workflow/`: `git diff --stat a20b346c HEAD --
docs/self/.wingfoil/workflows src/workflow` prints nothing.

- **Files and phases.** There are 22 workflow files: 4 `kind: main` and 18 `kind: sub`. Together
  they declare 81 phases.
- **Action tokens.** There are 84 occurrences of 25 distinct names. The command is
  `grep -hoE "^\s+- '?[a-z_]+(\.[a-z_]+)+" docs/self/.wingfoil/workflows/custom/*.yaml | sed -E "s/^\s+- '?//" | sort | uniq -c`.
- **Check strings.** There are 64 occurrences of 47 distinct strings. 17 are dotted tokens, such as
  `tests.passing` or `frontmatter.required: [title, scope]`. The other 30 are hyphenated keywords,
  such as `on-branch-is-main`, or English sentences, such as `release-publishing.yaml`'s
  `publish.checks.post` `"package published to npm registry"`. Both counts come from loading every
  file with `js-yaml` and collecting `phases[].checks.pre` and `phases[].checks.post`.

Of the 25 action names, only a few name a command that ships:

- the four `memory.*` verbs (`memory.add`, `memory.submit`, `memory.approve`, `memory.deprecate`)
  match `memoryAdd`, `memorySubmit`, `memoryApprove` and `memoryDeprecate` in `CORE_MODULES`
  (`src/core/index.ts`);
- `config.init` corresponds to `wingfoil init`;
- `cli.run(...)` carries a literal command line.

The other names have no command, and neither does any dotted check. Those names are
`element.set_state`, `bug.sync_state`, the six `git.*` operations, `tests.bdd.run` and the six
`agent.*` tokens.

**Where bindings live today: in comments.** `dev-loop.yaml`'s `refactor.checks.post` carries the only
explicit binding in the configuration, and it is a YAML comment: `docs.api.*` is "enforced" by `npm
run docs:api` and `lint.clean` by `npm run lint` (from `dl-013`, `dl-014` and `dl-034`).
`tests.passing` presumably means `npm test`, but no file says so. `dl-089` (`in-discussion`)
proposes a new family, `script.run("scripts/release-health/measure.cjs ...")`, and declares it
unbound pending this decision-log.

## Decision

Every `actions:` and `checks:` token that the workflow engine (P4.10, P4.12) will execute resolves
through a declared binding. The six questions below stay open for the approver, each with a
recommendation.

**Q1 — Where bindings are declared.**
- **(a) A file of their own**, `.wingfoil/workflows/bindings.yaml`, versioned under `doc-versioning`,
  mapping each token name to a command.
- **(b) A section of `dna.yaml`.** A test command depends on the stack, and `dna.yaml` already
  declares `stacks` and `paths`. The cost is that `spec-002-dna-yaml-schema` would need an amendment.
- **(c) Inline on each phase**, e.g. `checks.post: [{ token: lint.clean, run: "npm run lint" }]`.

*Recommendation: (a).* A built-in workflow (spec-011's `workflows/built-in/`) ships its tokens, but
the command behind `tests.passing` belongs to the project. Keeping bindings apart lets a built-in
workflow stay immutable (REQ-SEC-07) while each project binds it. (c) repeats the same binding on
every phase that uses it: `tests.passing` occurs in `dev-loop.yaml` (`green`, `refactor`),
`release-submit.yaml` (`pre-release-checks`) and `release-publishing.yaml` (`publish`).

**Q2 — Strict or optional.**
- **(a) Strict:** an unbound token is a `workflow list` validation error.
- **(b) Optional:** an unbound token is skipped with a note.
- **(c) Strict for `checks`, declared for `actions`:** an unbound check fails closed. An action with
  no command must be marked `manual: true` in the binding file, and the engine then waits for a
  human to confirm it.

*Recommendation: (c).* A skipped check passes a gate without checking anything. That is the class
of bug where a guard's name promises more than the guard asserts, which the retrospective routes to
the `testing` directive (`dl-121`). Some steps are legitimately manual. Under `dl-087`, for example,
a release published by `release-publishing.yaml`'s `publish` phase goes live only after a
maintainer's 2FA-backed `npm stage approve`, which no command can perform for the engine. Under (a),
such steps could not be expressed.

**Q3 — How a token's arguments reach its command.** Tokens take `key: value` arguments and
`{element.field}` interpolation (spec-003). Examples:
- `dev-loop.yaml` `start.actions` `git.create_branch("task/{task.id}")`;
- `release-publishing.yaml` `tag.actions` `git.commit("release {release.version}")`;
- `e2e-smoke.yaml` `drive-cli.actions` `cli.run("memory add ...; memory submit ...")`, which
  embeds a shell separator.

Interpolated values come from frontmatter, and outside contributors write frontmatter (`dl-020`). No
SARD requirement covers this input surface. `grep -rniE "inject|shell|interpolat|argv"
docs/02_requirements/03_sard/` finds nothing, while the same grep for `secret` finds five lines.
- **(a) argv, no shell.** Each binding is an argument vector. Interpolation fills whole arguments
  only. Interpolated values must match `spec-009-validation-strategy`'s ID character class, or a
  declared per-field pattern.
- **(b) A shell string with quoting** applied by the engine.
- **(c) No interpolation:** values reach the command as environment variables only.

*Recommendation: (a),* plus a new REQ-SEC requirement stating it. `e2e-smoke.yaml`'s `;` form then
becomes two tokens.

**Q4 — What a bound command's exit code means.** REQ-INT-04 fixes `0` for success, `1` for a
user or logic error and `2` for usage errors.
- For a **check**, `0` passes, `1` fails the gate and routes to `fallback`, and `2` is a binding
  misconfiguration that blocks the phase without counting as a failed gate. Any other status, a
  signal or a timeout is an error.
- For an **action**, any non-zero status marks the step `failed`, as REQ-INT-06 already requires
  for `git.merge`.

A staged check needs a severity per binding, `warn` or `reject`. `e2e-smoke.yaml`'s
`gate.checks.post` (`dl-023`) and `dl-014`'s B-DECISION ramp today put that severity in prose.
*Recommendation:* adopt this mapping, with the severity declared on the binding.

**Q5 — Who may declare or change a binding, and through which approval.** A binding decides which
command a gate runs, so changing one is as consequential as changing the code it tests.
- **(a)** Any role, by an ordinary commit.
- **(b)** Only through a task reviewed at `dev-loop`'s `review` gate, which requires approval by
  the approver. A `docs(self)` commit may never change a binding.
- **(c)** (b), plus built-in bindings shipped with built-in workflows are immutable (REQ-SEC-07).

*Recommendation: (c).* The approval verb for a document that is not a Memory element is
`dl-125`'s question (v0.4). Until it exists, the review gate is the only recorded approval, and the
check that no binding changed outside a task is `dl-103`'s enforcement point.

**Q6 — What an `agent.*` token binds to.** Six names occur 10 times: `agent.execute` (4),
`agent.survey_specs` (2), `agent.classify_acs`, `agent.read_related`, `agent.verify_specs` and
`agent.mine_execution_notes`.
- **(a) A command:** `wingfoil agent execute` (P5.3.1), with the phase's `role` (P5.3.2) and the
  token name as its instruction.
- **(b) A prompt:** the role's MCP `{role}-session` prompt (`registerRolePrompts`, P5.2.2), plus an
  instruction document named by the token.
- **(c) A prompt-rendering CLI command.** No feature declares one: `grep -rln "agent prompt"
  docs/01_vision docs/02_requirements` finds nothing, while `agent execute` is found in three files.

*Recommendation: (a) for execution and (b) for content.* The token selects an instruction document,
and `agent execute` runs it under the role's session prompt. Neither can satisfy a check.
`dev-loop.yaml`'s `design` phase shows why this matters. Its `agent.read_related` is paired with the
check `depends_on.acknowledged` (`dl-015`), which today only the agent can assert about itself. A
check an agent asserts about its own work is not a gate. It needs a non-agent binding, such as a
command that reads the acknowledgement from the task's Execution Notes.

## Rationale

- **The engine cannot run what nothing binds.** P4.10 and P4.12 are v0.3 scope, and every one of
  the 84 action occurrences and 64 check occurrences reaches the engine as a free-form string.
  Deciding the binding model after the engine exists would make its first shape the de facto
  decision.
- **Gates that nobody runs look like gates.** `dev-loop.yaml`'s `refactor` gate works because a
  comment and a test (`test/docs/api-docs.test.ts`, `test/lint/lint-clean.test.ts`) happen to line
  up. None of the other check strings has a declared command anywhere. Q2 (c) makes that visible
  instead of letting those gates pass silently.
- **Arguments are a new attack surface.** Q3 is the only question with a security consequence. A
  frontmatter title interpolated into a shell string is a command-injection path that no
  requirement covers today.

## Actions

On ratification, with the approver's choices recorded in the approve commit's `Reason:`:
1. Amend `spec-003-workflows-yaml-schema`, § "Action expressions" and § "Check expressions", to
   point at the binding file and its schema (Q1, Q2, Q4). Under Q1 (b), amend
   `spec-002-dna-yaml-schema` instead.
2. Add a REQ-SEC requirement for token arguments to
   `docs/02_requirements/03_sard/05_security-compliance.md` (Q3), and a REQ-INT-04 clause for check
   exit codes to `docs/02_requirements/03_sard/04_integrations.md` (Q4).
3. Write the first binding file for this repository's own workflows, starting with the
   `dev-loop.yaml` `refactor.checks.post` bindings that today live in a comment.
4. Bind `dl-089`'s `script.run` family under the chosen model.

v0.3 `release-planning` (`build-backlog`) derives the tasks. None are created here.

## Relations

- **Origin:** approver decision of 2026-09-22, `retrospective-rel-v0.2-plan` §6.1; recorded in
  `retro-v0.2` as an action taken.
- **Amends, on ratification:** `spec-003-workflows-yaml-schema`; SARD `05_security-compliance.md`,
  `04_integrations.md`.
- **Related:** `dl-089` (`script.run`), `dl-104` (phase evidence), `dl-105` (recurring phases run
  bound commands), `dl-109` (workflow `kind`), `dl-097` and `dl-103` (claim evidence and its
  enforcement), `dl-023` (staged gate), `dl-013`, `dl-014`, `dl-034` (the `refactor` gate's origin),
  `dl-015` (`depends_on.acknowledged`), `dl-125` (approving non-Memory documents).
- **Traceability:** P4.10, P4.12, P5.2.2, P5.3.1, P5.3.2; REQ-INT-04, REQ-INT-06, REQ-INT-07,
  REQ-SEC-07.
