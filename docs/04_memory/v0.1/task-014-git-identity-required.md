---
id: "task-014-git-identity-required"
type: task
title: "Infrastructure: REQ-SEC-01 — Git identity required for state mutations"
status: done
release: "v0.1"
priority: "Blocker"
tags: ["v0.1", "architecture"]
ref: "REQ-SEC-01"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

Implement the pre-flight check, shared by every state-mutating command (`src/core`, invoked
identically by CLI and MCP per REQ-SYS-05), that verifies a configured git identity
(`user.name` + `user.email`) before any Memory/DNA/Directives/Workflow mutation is attempted. Git
identity is WingFoil's sole attribution mechanism — there is no separate authentication layer,
session system, or external IAM/OAuth2 provider; the commit author and commit timestamp *are* the
"who" and "when" of the audit trail. As Morgan (the auditor persona), I want every state-mutating
command to refuse to run at all when git identity is unset so that the audit trail can never contain
a commit with an unattributable author.

## Acceptance Criteria

Per REQ-SEC-01's fit criterion: "With git identity unset, any state-mutating command fails with
`\"git identity not configured (user.name/user.email)\"` and writes nothing."

Testable breakdown:
- With `user.name` and/or `user.email` unset (locally and globally), invoking any state-mutating
  command (`memory add/submit/approve/reject/deprecate`, `workflow start/end/next`, etc.) fails
  before any file is written, with the exact message `git identity not configured
  (user.name/user.email)`.
- The check runs identically whether the mutation is invoked via the CLI or via an MCP Tool call
  (same shared `core` validation path, REQ-SYS-05) — no divergent behaviour between the two
  surfaces.
- Read-only commands (`memory search`, `dna show`, `workflow status`, `paths`, …) are unaffected by
  missing git identity — the check applies only to the state-mutating surface.
- Once identity is configured, the same command proceeds normally and the resulting commit's author
  matches the configured `user.name <user.email>`.
- See BDD `p1-memory/P1.2-versioning-audit-trail.feature`.

## Implementation Notes

- Architectural backing: `docs/self/docs/04_memory/design/adrs/adr-006-git-identity-role-based-authz.md`
  — point 1 fixes git identity as the attribution mechanism for every state change (no external
  IAM/OAuth2/Cognito/Auth0 provider); point 2 (role-based approval authority, REQ-SEC-03) is a
  separate, later concern layered on top of this same identity.
- Storage grounding: `docs/self/docs/04_memory/design/adrs/adr-001-git-backed-storage.md` — git is
  the single source of truth (REQ-SYS-01); attribution rides on the commit author git already
  tracks, with no separate identity/session system to build or operate.
- Implement the check once in `src/core` (not duplicated per CLI command or per MCP Tool) so the
  CLI and MCP surfaces share identical enforcement by construction, per REQ-SYS-05.
- Related feature task that depends on this in this release: `task-019-implement-versioning-audit-trail`
  (backlog `TASK-017`, `wingfoil` Versioning & Audit Trail feature, P1.2).

## Execution Notes

Worked on branch `task/task-014-git-identity-required` (dedicated worktree), parallel to the task-agent
(task-011 already landed on `main`; task-012/013 done earlier this session). Plan:
`docs/05_plans/X_task-014-plan.md`.

- **design (scope):** the pre-flight check itself is fully implementable now (it only reads git
  config); only *wiring* it into real mutating operations must wait, because none exist yet
  (`CORE_MODULES` is read-only). Approver (Roberto) approved this scope: ship the shared `src/core`
  check + unit test now (real production code), defer the wiring to the command tasks (task-019+). No
  tech-spec for REQ-SEC-01 — backing is `adr-006` (accepted) + the AC's exact message; nothing found
  missing at the design gate.
- **green:** `src/core/git-identity.ts` — `requireGitIdentity(root)` reads `git -C <root> config
  user.name`/`user.email` via `execFileSync` (mirroring `src/memory/history.ts`'s git primitive) and
  returns `coreErr({ code: 'VALIDATION', message: 'git identity not configured (user.name/user.email)' })`
  when either is empty/unset, else `coreOk`. Exported from `src/core/index.ts`. Code `VALIDATION` (a
  failed precondition) → exit `1` via task-012's `exitCodeForError`.
- **test blocker (worth recording):** the "unset" cases must be deterministic regardless of the dev
  machine's own global git identity. Env isolation (`GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM` → empty
  file, `GIT_CONFIG_NOSYSTEM=1`) works in plain Node but **NOT** under Jest: Jest gives each test
  module a sandboxed `process.env` copy, and `child_process` spawned with no explicit `env` reads the
  *outer* realm's env, so the mutated isolation vars never reach `git`. Fix: `readGitConfig` passes
  `env: process.env` **explicitly** — a no-op in production (identical to the default) that makes the
  sandboxed env authoritative for the child, so the test can scope git-config resolution
  deterministically. Verified: with the explicit env, all four cases pass.
- **checks:** full suite green (319 tests), `git-identity.ts` 100% covered, overall 99% (> 80%),
  `tsc -p tsconfig.build.json` clean, eslint clean. Touched only `src/core` (+ one export line) and a
  new test — not `src/cli`/`src/mcp`.

**Deferred (out of scope, traced):**
- Wiring `requireGitIdentity` into the actual mutating operations (`memory add/submit/approve/reject/
  deprecate`, `workflow start/end/next`) → the tasks that implement those operations (task-019+). Each
  mutation calls this check first and returns its `CoreResult.error` unchanged, so the CLI/MCP surfaces
  render the exact message and write nothing (REQ-SEC-01 AC) with no per-command logic.
- The CLI/MCP end-to-end "identity unset → refuse, nothing written" assertion belongs to those command
  tasks (a command must exist to invoke); the shared check's own contract is proven here.
