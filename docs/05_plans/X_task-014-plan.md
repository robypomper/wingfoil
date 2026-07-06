# Plan — task-014-git-identity-required (REQ-SEC-01)

> Interim dev-loop plan (CLAUDE.md §6 / golden rule #7). Branch
> `task/task-014-git-identity-required`, worktree `.claude/worktrees/task-014-git-identity`, parallel
> to the task-agent. Role: developer (code-quality, testing, determinism).

## Design-gate finding (scope)

REQ-SEC-01 requires a pre-flight check, shared by every state-mutating command, that refuses to run
when git identity (`user.name` + `user.email`) is unset — the exact message
`git identity not configured (user.name/user.email)`, writing nothing. Backing: `adr-006` (accepted).

The **check function itself is fully implementable and testable now** — it only reads git config, no
mutating command needs to exist. What cannot be done yet is *wiring* it into real mutating operations:
`CORE_MODULES` is entirely read-only (`dnaShow`/`directivesList`/`workflowList`); the mutating
operations (`memoryAdd`/`memorySubmit`/`memoryApprove`/…, `workflowStart`/…) are task-018+.

**Scope decision (approver: recommended scope):** deliver the shared `src/core` check + its unit test
now (real production code, the REQ-SEC-01 foundation); defer wiring the call into mutating operations
to the tasks that implement them (task-019+), documented in Execution Notes.

## Deliverable

- **`src/core/git-identity.ts`** (new):
  - `requireGitIdentity(root: string): CoreResult<void>` — reads `git -C <root> config user.name` and
    `user.email` via `execFileSync('git', …)` (same primitive style as `src/memory/history.ts`); if
    either is empty/unset, returns `coreErr({ code: 'VALIDATION', message: 'git identity not configured
    (user.name/user.email)' })`; otherwise `coreOk<void>(undefined)`.
  - Lives in `src/core` so the CLI and every MCP Tool share identical enforcement by construction
    (REQ-SYS-05); the check is the single call site future mutations invoke before writing.
- **`src/core/index.ts`** — `export * from './git-identity'`.

## Tests (test-first)

- **`test/core/git-identity.test.ts`** (new, unit): a throwaway temp `git init` repo, **isolated from
  the host's global/system git identity** (`GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM` → an empty file,
  `GIT_CONFIG_NOSYSTEM=1`) so "unset" is deterministic regardless of the dev machine. Cases:
  - neither name nor email set → error with the exact REQ-SEC-01 message;
  - only `user.name` set → error; only `user.email` set → error;
  - both set → `ok` (and the check reads the configured values).

## Checks (refactor.checks.post equivalent)

- `npx jest` green (full), coverage > 80% (`git-identity.ts` fully covered).
- `npx tsc -p tsconfig.build.json` clean; eslint clean on changed files.
- Determinism: the check reads declared git config (no wall-clock/random); env-isolated in tests.
- Traceability: task-014 → REQ-SEC-01 → adr-006; BDD P1.2-versioning-audit-trail.

## Coordination

Touches only `src/core` (new file + one export line) + a new test — not `src/cli`/`src/mcp`. Rebase
onto `main` before the approver-gated merge; only plausible overlap is `src/core/index.ts`'s export
list (trivial union) if another task edits it concurrently.

## Deferred (out of this task, traced)

- Wiring `requireGitIdentity` into the actual mutating operations (`memory add/submit/approve/reject/
  deprecate`, `workflow start/end/next`) → the tasks that implement those operations (task-019+). Each
  mutation calls this check first and returns its `CoreResult.error` unchanged, so the CLI/MCP
  surfaces render the exact message and write nothing (REQ-SEC-01 AC) with no per-command logic.
- The "reject via CLI/MCP with identity unset, nothing written" end-to-end assertion belongs to those
  command tasks (the command must exist to invoke); the shared check's own contract is proven here.
