---
id: "dl-034-lint-gate-in-dev-loop"
type: decision-log
title: "Add a lint gate to dev-loop's refactor phase, and authorise the harness fix tasks as a recorded v0.2 exception"
status: ready
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

The `code-quality` directive requires *"Lint clean: no errors; warnings triaged before merge"*, and
**no workflow enforces it**. Verified across every file in `.wingfoil/workflows/custom/`: `dev-loop`'s
`refactor` phase checks `tests.passing`, `tests.coverage(min: 80)`, `docs.api.public-complete` and
`docs.api.build`; `review` checks `tests.bdd.passing`. Lint appears nowhere.

The cost is already measurable. `npm run lint` has been red on `main` since v0.1
(`bug-009-eslint-baseline-require-imports`, one `no-require-imports` error from `task-018`). Because
the gate was already red and unwatched, `task-043-secret-credential-hygiene` added **four** more
errors while its Execution Notes recorded "ESLint clean", and the count went 1 → 5 without any
state change anyone could observe. Seven of the ten v0.2 review agents independently had to
re-derive that the residual error was pre-existing in order to judge their own branch — work a gate
should do once, not seven times.

Fixing `bug-009` alone would only reset the counter until the next task introduces an error. The
durable fix is a gate.

A second, separate question rides along. `bug-009` and `bug-011-cli-latency-assertion-measures-spawn-contention`
are both harness defects that make the verification of *all* remaining v0.2 work unreliable — seven
tasks currently in `red` plus twenty-one still in `backlog`. Fixing them needs tasks, and creating
tasks inside a release already `in-development` is a `release-planning`/`build-backlog` action. This
is exactly the mid-flight widening that `dl-030-req-sec-07-referenced-asset-ownership` declined for
P4.9, so it cannot be done silently: it needs to be an explicit, recorded exception or not happen at all.

## Decision

1. **Add `lint.clean` to `dev-loop`'s `refactor` post-checks**, alongside the existing tests,
   coverage and `docs.api.*` checks. Backed by `npm run lint` exiting 0.
2. **Hard-reject from the start** — no warn-then-enforce ramp. `docs.api.*` needed one
   (`dl-014` B-DECISION Option 2, closed by `task-062`) because its backfill spanned every exported
   declaration in the tree; here the backfill is a single line in one test file.
3. **In `refactor`, not `review`.** The developer fixes their own lint before a reviewer is engaged.
4. **Recorded exception:** `bug-009` and `bug-011` are scheduled into `v0.2` despite the release being
   `in-development`, because they gate every remaining task in it. This is a deliberate departure from
   `dl-030`'s rule, justified below — not a precedent for widening a release with feature work.

   **Extended by the approver to `bug-008` and `bug-010`** after the Fase-3 reviews. The extension is
   recorded here rather than assumed, because this clause originally read "one-off": using it as a
   precedent without amending it would have contradicted a ratified decision. The bar this exception
   set — *argue from blocked work, not from convenience* — is met by both, and by the same shape of
   argument that admitted `bug-009`:
   - **`bug-008`** (CLAUDE.md §1 declares the project pre-implementation). `bug-009` was admitted
     because it gated the *verification* of every remaining v0.2 task; this gates their
     *orientation*. `CLAUDE.md` is the agent entry point, read first in every session, and it asserts
     there is no source code, that the CLI/MCP is unimplemented, and that runtime behaviour must not
     be assumed — all false since `minor-v0.1` was released. Every remaining v0.2 task is executed by
     an agent that reads it.
   - **`bug-010`** (archived documents reach agent context). Admitted on *ordering*, not urgency: its
     two surfaces are unwired today — no `.mcp.json` exists (`dl-026`), and `assembleExecutionContext`
     has no CLI/MCP surface — but `task-055-auto-load-directives-by-role` is in the v0.2 backlog and
     is precisely what makes the context path user-reachable. Fixing it after `task-055` means v0.2
     ships a context path that leaks archived documents; the same ordering logic that put `task-064`
     ahead of `task-057`.

   Still not admitted by this clause: feature work, or anything whose case is convenience. **If a
   fifth bug needs this, stop extending the list and write a standing rule for out-of-band bug
   scheduling** — four is where an exception starts becoming a policy in disguise.
5. **Two fix tasks, not one.** `task-066-fix-eslint-baseline-and-lint-gate` (`bug: bug-009`, and it
   wires the gate from point 1) and `task-067-fix-cli-latency-assertion` (`bug: bug-011`). The
   original proposal was a single combined task; the `bug:` frontmatter field is singular and
   `dev-loop`'s `bug.sync_state` keys on it, so one task covering two bugs would leave the second
   permanently unsynced and hand-advanced. The exception being authorised here is one decision, not
   one task.
6. **The `planned` state is skipped for bugs scheduled under this exception, and that is accepted.**
   `memory.yaml`'s `bug` machine has `planned` as a `waiting` state — entered when
   `release-planning`/`build-backlog` schedules the bug (the established two-commit shape is
   `wf(bug): sync … [triaged → planned]` then `[planned → in-progress]`, as `bug-005` did). A bug
   authorised out of band by this DL never passes through `release-planning`, so nothing stamps
   `planned`, and its fix task starts it directly at `in-progress`. `bug-009` and `bug-011` both did
   this. Ratified as an accepted consequence of the exception rather than treated as a defect; it
   applies only to bugs scheduled under this authorisation, not to the normal path.

## Rationale

- **A gate that cannot go from green to red carries no information.** That is the whole of the
  `task-043` incident: the check existed as a directive sentence, the tooling existed, and nothing
  connected them. The fix is the connection, not the one error.
- **`refactor` is where the other mechanical quality checks already live**, so this adds no new
  concept to the workflow — one entry in an existing list, enforced by a command the project already
  ships (`npm run lint`).
- **The exception is narrow and self-limiting.** Both tasks are test/tooling changes with no product
  surface; neither adds scope to what v0.2 delivers; and both pay for themselves across the 28
  remaining task runs. Deferring them to v0.3 means every one of those runs re-pays the "was this
  error already here?" cost, and keeps the review gate producing stale numbers — several v0.2 task
  Execution Notes already record a "558/559" or "561/562" that no serialized run reproduces.
- **Trade-off accepted:** this does set a small precedent that a release `in-development` can gain
  tasks. It is bounded by being recorded here with an explicit justification tied to gate
  reliability. Any future request to add work mid-release should have to clear the same bar — argue
  from blocked work, not from convenience — and `dl-030`'s refusal for P4.9 remains the default.

## Actions

- Owner **developer**: amend `.wingfoil/workflows/custom/dev-loop.yaml` — add `lint.clean` to the
  `refactor` phase's `checks.post`, bump the workflow `version`, cite this DL inline.
- Owner **developer**: `task-066-fix-eslint-baseline-and-lint-gate` — replace the `require()` at
  `test/storage/git-backed-storage.test.ts:90` with an ES import; land the gate amendment above.
- Owner **developer**: `task-067-fix-cli-latency-assertion` — correct what P1.5's under-1-second
  budget measures (see `bug-011`; measuring in-process around the core operation is the preferred
  option, leaving the integration test to assert exit code and output).
- Both tasks run before the seven `red` tasks resubmit, so those resubmissions are verifiable against
  a green baseline.
- Related: `dl-014` (the `docs.api.*` ramp this deliberately does not repeat),
  `dl-030` (the mid-release rule this makes a recorded exception to).
