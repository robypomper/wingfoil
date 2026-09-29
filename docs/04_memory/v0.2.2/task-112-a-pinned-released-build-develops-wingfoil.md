---
id: "task-112-a-pinned-released-build-develops-wingfoil"
type: task
title: "A pinned, published WingFoil build manages the project, and `.mcp.json` registers its MCP server"
status: in-review
release: "v0.2.2"
priority: "high"
tags: ["v0.2.2", "dogfooding", "mcp", "tooling"]
ref: "dl-095-which-wingfoil-build-develops-wingfoil"
bug: []
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here can never leave `triaged`. A single string is still accepted for documents predating dl-045.
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-111-configuration-moves-to-the-repository-root"]
tmpl_version: 260703
---

## Description

Once the configuration is at the root (`task-111`), the project is managed by a WingFoil build. That
build must be a **published, pinned** one, not the one under development (`dl-095`, ratified Q1 (a),
Q2 (i), Q3 (B)). This task also delivers `dl-026`, the MCP server registered in the repository so
agents consume WingFoil's own server. `dl-095` Q2 (i) amends `dl-026`'s registration command: the
pinned build needs no build step, so `dl-026`'s option (b) `prepare` hook is no longer needed.

## Acceptance Criteria

1. **Q1 (a).** `package.json` has the devDependency `"wingfoil-released": "npm:wingfoil@0.2.1"`,
   exact, recorded in `package-lock.json`, and covered by `scripts/check-lockfile-pins.cjs`. `dl-095`
   asks for two behaviours to be confirmed before they are relied on:
   - npm installs the alias although the package is itself named `wingfoil`;
   - inside the repository, a command reaches the pinned binary and not the local `bin`. This
     package's own name is `wingfoil`, so check which binary `npx wingfoil` resolves to.

   Both results go in Execution Notes. If `npx wingfoil` resolves to the local package, the documented
   command is the alias's binary path or an npm script, and the precondition in AC 4 uses that.
2. **Q2 (i) with `dl-026`.** A root `.mcp.json` registers the pinned build's `mcp` command. A fresh
   clone followed by `npm ci` gives a working server with no build step. `COLLABORATION.md` gets the
   contributor setup and the equivalent registration for other MCP clients, as `dl-026`'s ratification
   requires.
3. **`dl-026`'s re-verification.** The `e2e-smoke` workflow's checks gain the step that verifies the
   registered server's channel set. `dl-026` placed it in that gate.
4. **Q3 (B).** `release-planning.yaml` gains a precondition step: the pin moves forward only, to
   published builds, one commit per switch. Every phase plan's preconditions gain "the build in use is
   the pinned one" (`dl-095` Actions), using the command established in AC 1.
5. `npm test` green.

## Implementation Notes

- The switch to `0.2.2` after the `v0.2.2` tag is **not** this task. It is the first application of
  Q3 (B), in v0.3, at §6.8 step 7.

## Execution Notes

Branch `task/task-112-a-pinned-released-build-develops-wingfoil`, worktree `../.wf2-wt/task-112`,
cut from `main` at `c3df9df3` (W3 of `dev-loop-rel-v0.2.2-plan`). Node 22.21.0, npm 11.6.2
(`node -v`, `npm -v`).

### design (architect)

**`depends_on` read (dl-015).** `task-111` is `done` (`grep -m1 '^status:'
docs/04_memory/v0.2.2/task-111-*.md` → `done`). What this task takes from its notes:
- The configuration is at the root (`.wingfoil/`, `docs/04_memory/`), and the CLI resolves it from
  the git root with no code change — so the published `0.2.1`, which predates `task-109/110/111`, can
  now read this repository. Measured below (AC 1), not assumed.
- `memory add` still fails here on every type until `task-123` lands (`bug-156`). The pinned build
  inherits that: measured below.
- `task-111`'s AC 5 left `CLAUDE.md` §3/§5.1 staleness to `align-agent-docs` (`dl-025`). This task
  adds a command agents should use (`npm run -s wingfoil`); `CLAUDE.md` is not edited here either,
  for the same reason (review: open item).

**Governing decisions.** `dl-095` `ready` (approve commit `Reason:`: Q1 (a), Q2 (i), Q3 (B));
`dl-026` `ready`, its registration command amended by `dl-095` Q2 (i), so its build-prerequisite
question (a)/(b)/(c) is moot: the pinned build ships `dist/`.

**Specs.** `spec-014-mcp-server-entry-point` `approved`, `spec-015-packaging-publishing` `approved`
(`grep -m1 '^status:'` on both). Neither defines a repository-level MCP registration nor a dev-only
alias, and neither is contradicted: the published package's `files`/`bin` are untouched, and the
alias is a devDependency, never installed by a consumer. No new spec scaffolded.

**AC 1 measurement (before designing on it)** — a `git clone` of this branch in the session
scratchpad, `npm install --save-dev --save-exact wingfoil-released@npm:wingfoil@0.2.1`:
- **npm installs the alias although this package is named `wingfoil`: yes.** `package.json` gains
  `"wingfoil-released": "npm:wingfoil@0.2.1"`; the lock gains `node_modules/wingfoil-released` with
  `"name": "wingfoil"`, `"version": "0.2.1"`, `resolved` `…/wingfoil-0.2.1.tgz` and an `integrity`.
  `ls -la node_modules/.bin/wingfoil` → `-> ../wingfoil-released/dist/cli.js`.
- **`npx wingfoil` is ambiguous — it depends on whether `dist/` is built.** The local package's
  version is also `0.2.1`, so `--version` alone cannot tell them apart; the probe set the clone's
  `package.json` `version` to `0.0.0-local-probe`:
  - no `dist/` (fresh clone): `npx wingfoil --version` → `0.2.1` (the alias);
  - after `npm run build`: `npx wingfoil --version` → `0.0.0-local-probe`, also from `src/`, and also
    with the global `~/.npm-global/bin/wingfoil` removed from `PATH`. npm exec runs **this project's
    own `bin`** once its target exists;
  - `node_modules/.bin/wingfoil --version` → `0.2.1` in both states
    (`readlink -f` → `node_modules/wingfoil-released/dist/cli.js`).
  So `npx wingfoil` is **not** the documented command. Per the AC's fallback it is an npm script
  naming the alias's binary path: `"wingfoil": "node node_modules/wingfoil-released/dist/cli.js"`.
  `npm run -s wingfoil -- --version` → `0.2.1` with the local version at `0.0.0-local-probe`, also
  from `src/`. `-s` matters: without it npm prints its `> wingfoil@… wingfoil` banner to **stdout**
  (`npm run wingfoil -- --version 2>/dev/null` shows it), which would corrupt `--format json` output.

**What the pinned `0.2.1` does on this repository now** (same clone, `node
node_modules/wingfoil-released/dist/cli.js …`):
- `memory search --type task --format json`, `memory history task-112-…`, `memory history bug-077-…`
  (8 entries, `null>draft … in-review>closed closed>closed`), `dna show`, `workflow list`,
  `paths sources` → all exit 0 with the root configuration.
- `directives list` → exit 0, plus 3 stderr warnings `unknown field(s) ignored: scope` (on
  `claim-evidence.md`, `doc-versioning.md`, `security-secrets.md`): `0.2.1`'s directive schema
  predates the `scope:` field.
- `memory add --type bug --title "scratch probe"` → exit 1, `cannot read the scaffold for memory type
  'bug': '.wingfoil/.wingfoil/memory/templates/bug.md' is not committed at HEAD` — `bug-156`, owned by
  `task-123`; the pinned build will need the pin to move (Q3) only if the fix is in code, which it is
  not (`task-123` edits `memory.yaml`).
- `mcp`: an MCP SDK `Client` over `StdioClientTransport` spawning `node
  node_modules/wingfoil-released/dist/cli.js mcp` (cwd = clone root) → `serverInfo`
  `{"name":"wingfoil","version":"0.2.1"}`, capabilities `{"prompts":{},"resources":{"listChanged":true}}`,
  2 resources (`wingfoil://dna`, `wingfoil://workflows`), 4 resource templates, 8 prompts,
  `tools/list` → `MCP error -32601: Method not found`; `readResource wingfoil://dna` returns this
  repository's `dna.yaml` as JSON.

**Design.**
- **AC 1** — the exact alias devDependency, plus the npm script `wingfoil` above.
  `scripts/check-lockfile-pins.cjs` gains a fourth property: every `npm:` alias among the direct
  dependencies is exact (`npm:<name>@X.Y.Z`) and the lock carries `node_modules/<alias>` with that
  `name` and `version`. General over aliases, like property 3 is general over peers.
- **AC 2** — root `.mcp.json`: `wingfoil` → `node node_modules/wingfoil-released/dist/cli.js mcp`
  (the alias's path, not `npx`, for the reason above; no build step). New
  `scripts/check-mcp-registration.cjs` (`npm run check:mcp`): reads `.mcp.json`, spawns the
  registered command from the repository root, and requires (i) `serverInfo.version` equals the
  version `package.json` pins, (ii) the advertised channel set equals a declared constant (today
  `prompts`, `resources` — P5.2.1, P5.2.2; P5.2.3 Tools is v0.4), (iii) each advertised list
  answers. The fresh-clone proof runs this script. `COLLABORATION.md` gains the contributor setup
  and the equivalent registration for other MCP clients.
- **AC 3** — `e2e-smoke.yaml` gains a phase before `gate` that runs `npm run check:mcp`; when a
  release changes the channel set, the declared constant fails the check until it is updated, which
  is `dl-026`'s re-verification.
- **AC 4** — `release-planning.yaml` gains a first phase, `advance-pinned-build`, carrying Q3 (B)'s
  rule as checks. "Every phase plan's preconditions" is read as: the two plans that are `active`
  (`grep -rH -m1 '^status:' docs/05_plans | grep -v 'status: done'` → `dev-loop-rel-v0.2.2-plan`,
  `bug-ingest-rel-v0.2.2-review-findings-plan`) gain one precondition bullet each, and the `plan`
  template (`.wingfoil/memory/templates/plan.md`) names it in its Context guidance, so every future
  plan carries it. `done` plans are history and are not rewritten.

**AC classification (T1).**

| AC | Class | Why |
|---|---|---|
| 1 — alias pinned, locked, covered by the lockfile check | **red-first** | no alias today; the check has no alias property (`grep -n "npm:" scripts/check-lockfile-pins.cjs` → nothing) |
| 1 — behaviours confirmed | verification | measured above; pinned by tests on the script and `node_modules/.bin` |
| 2 — `.mcp.json` registers the pinned build; server works | **red-first** | `ls .mcp.json` → no such file |
| 2 — fresh clone + `npm ci`, no build | verification | a throwaway clone, recorded in green |
| 2 — `COLLABORATION.md` | documentation | no behaviour |
| 3 — e2e-smoke re-verification step | configuration | a workflow phase; the command it runs is AC 2's script |
| 4 — release-planning precondition; plan preconditions | configuration / documentation | no engine executes either |
| 5 — `npm test` green | verification | gates in refactor |

### red (developer) — `0727faad`

- `test/cli/check-lockfile-pins.test.ts`: six cases for the alias property (exact, locked under the
  alias path, same `name`, same `version`, runtime dependencies too) and one asserting this
  repository's `package.json` declares `wingfoil-released` exactly.
- `test/cli/mcp-registration.test.ts` (new): the committed `.mcp.json` entry, the `wingfoil` and
  `check:mcp` scripts, the alias binary's `--version` equal to the pin, `node_modules/.bin/wingfoil`
  resolving to the alias (the AC 1 behaviour, pinned so it is not relied on unchecked), the pure parts
  of `scripts/check-mcp-registration.cjs`, and the script against the real pinned build (in process,
  as `node scripts/check-mcp-registration.cjs`, and exit 1 on a temp git repo pinning `9.9.9`).
- `LockfilePackage` in `scripts/check-lockfile-pins.d.cts` gains the optional `name` field in the same
  commit, a type only, so the red is behavioural and not a compile error.
- `npx jest test/cli/mcp-registration.test.ts test/cli/check-lockfile-pins.test.ts` → the new suite
  fails to load (`Cannot find module '../../scripts/check-mcp-registration.cjs'`), and
  `Tests: 6 failed, 14 passed` in the lockfile suite: the five refusal cases (the check passed
  every alias) and the `package.json` declaration.

### green (developer)

- `1a598102` — `npm install --save-dev --save-exact wingfoil-released@npm:wingfoil@0.2.1`;
  `npm pkg set` of the scripts `wingfoil` = `node node_modules/wingfoil-released/dist/cli.js` and
  `check:mcp`; property 4 in `scripts/check-lockfile-pins.cjs` (and a remediation line for a pin
  switch); `scripts/check-mcp-registration.cjs` + `.d.cts`; root `.mcp.json`. The lock diff is one
  `packages[""].devDependencies` line and the `node_modules/wingfoil-released` entry (`git show
  1a598102 --stat -- package-lock.json` → `25 ++++++++++++++++++++++++-`). The three real-build cases
  got an explicit 60 s timeout: the first three-suite run failed the in-process case on jest's
  default 5 s, and passed alone in 4.5 s.
- `19b89547` — `e2e-smoke.yaml` v1.2 (phase `mcp-registration`, before `gate`, running
  `npm run check:mcp`) and `release-planning.yaml` v1.3 (first phase `advance-pinned-build`, Q3 (B)'s
  rule as its checks). Guard tests on both files added to `mcp-registration.test.ts` after the
  change — they passed on first run; they pin the configuration, they are not a red.
  `npm run -s build && node dist/cli.js workflow list` → exit 0, both phase names present.
- `953453b8` — `COLLABORATION.md` 1.1 → 1.2: contributor setup (`npm ci`, `npm run -s wingfoil`),
  the `.mcp.json` registration, the equivalent for other MCP clients (command, arguments, working
  directory), and the pin rule.
- `8501d1e0` — AC 4's plan preconditions (design interpretation): one bullet in
  `dev-loop-rel-v0.2.2-plan`, one sentence in `bug-ingest-rel-v0.2.2-review-findings-plan`, and the
  `plan` template's Context guidance. Neither plan's `version:` was bumped, to keep each edit a
  one-hunk merge against `main`, where both plans are edited by the orchestrating session (a
  deviation from `doc-versioning`, left to the merge: review, open item).

**AC 2 — fresh clone, `npm ci`, no build.** `git clone` of this branch at `1a598102` into
`mktemp -d` under the session scratchpad (deleted after):
`npm ci` → `added 503 packages`; `ls dist` → `No such file or directory`; `npm run check:mcp` →
`.mcp.json "wingfoil" runs the pinned wingfoil 0.2.1, advertising [prompts, resources] (prompts: 8,
resources: 2)`, exit 0; `npm run -s wingfoil -- --version` → `0.2.1`; `npm run -s check:lockfile` →
`… (2 overrides pin(s), 1 npm alias(es)) …`. The check spawns exactly the `.mcp.json` command
(`node node_modules/wingfoil-released/dist/cli.js mcp`) from the clone root and completes the MCP
`initialize` handshake plus `prompts/list` and `resources/list` over stdio. **Not verified here:**
that Claude Code itself starts the project-scoped server — that needs an interactive session to
approve a project `.mcp.json`, which this run did not do; nor what working directory another MCP
client uses (the setup text says to use an absolute path when it is not the repository root).

### refactor (developer) — checks, after `git merge main` (`3bbd66ef`, clean)

- `npx jest` → `Test Suites: 153 passed`, `Tests: 2501 passed` (2472 at `c3df9df3`).
- Coverage, `npx jest --coverage --coverageReporters=text-summary`: before (`c3df9df3`) and after
  (`8501d1e0`) identical — Statements 98.66 % (3392/3438), Branches 94.25 % (1789/1898), Functions
  98.98 % (584/590), Lines 99.46 % (3000/3016). The new code is under `scripts/`, outside jest's
  `collectCoverageFrom: ['src/**/*.ts', '!src/**/index.ts']` (`grep -n collectCoverageFrom
  jest.config.js`); it is tested by the suites above, not counted.
- `npm run lint` → exit 0 (one `preserve-caught-error` fixed in green: the timeout error now carries
  `cause`). `npx tsc --noEmit` → exit 0. `npm run docs:api` → exit 0.
- `npm run check:lockfile` → exit 0; `npm run check:mcp` → exit 0.
- `npm pack --dry-run --json` file list: 339 paths at `c3df9df3` and at the branch head, `diff` →
  identical. `.mcp.json` and `scripts/` are not packed; the alias is a devDependency, so a consumer
  of the published package never installs it.

### review (reviewer)

Unit and BDD suites green (`npx jest` above; the P5.2.1/P5.2.2 BDD suites under `test/mcp/` pass).
Open items for the approver, none fixed here:
- **`task-117` (W4) inherits a dependency edge.** `wingfoil@0.2.1` depends on
  `@anthropic-ai/sdk ^0.110.0` (lock entry `node_modules/wingfoil-released` → `dependencies`), so
  removing the SDK from this package's `dependencies` leaves it in the lock as a dev-only transitive
  of the alias until the pin moves to a build without it. Expected, not a defect; `task-117`'s ACs
  should not assert the SDK is gone from `package-lock.json`.
- **`directives list` on the pinned build warns** `unknown field(s) ignored: scope` for three
  directives: `0.2.1` predates the `scope:` field. Harmless (exit 0), but it is noise every agent
  will see until the pin moves.
- **`memory add` on the pinned build** fails as on `main` (`bug-156`, `task-123`), measured in design.
- **`CLAUDE.md`** says nothing about `npm run -s wingfoil` or `.mcp.json`; it is owned by
  `align-agent-docs` (`dl-025`), as `task-111`'s AC 5 left it. `COLLABORATION.md`'s "How to contribute
  (today)" still says the CLI "is still being built", a pre-existing stale sentence this task did not
  write (user-docs).
- **Plan `version:` not bumped** on the two active plans (green, `8501d1e0`); bump at merge if the
  approver wants `doc-versioning` applied.
