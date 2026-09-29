---
id: e2e-smoke-rel-v0.2.2-plan
type: plan
title: "E2E smoke — v0.2.2 (fresh-init + CLI black-box gate, mcp-registration, examples)"
status: active
version: "1.0"
workflow: "e2e-smoke"
phase: "rel-v0.2.2"
element: "patch-v0.2.2"
release: "v0.2.2"
tmpl_version: 260703
---

## Context

`patch-v0.2.2` (`docs/04_memory/planning/rl-v1/patch-v0.2.2.md`) is `in-development`. Its
`implementation` phase is complete (`dev-loop-rel-v0.2.2-plan` `done`, `cb7e8b1c`; 16/16 tasks `done`,
the 12 bugs with `release: "v0.2.2"` `closed`), and so is `user-docs` (`user-docs-rel-v0.2.2-plan`
`done`, merged `414df933`). Per `release-cycle.yaml` (`include: e2e-smoke`) and `dl-092` Q2 (ii) —
dev-loop → user-docs → e2e-smoke → release-submit → release-publishing, no retrospective — the next
phase is **`e2e-smoke`**. This plan is its execution scaffold (`dl-019`); no workflow engine exists, so
every step is performed by hand.

The contract is `.wingfoil/workflows/custom/e2e-smoke.yaml` **v1.2**, `element: release`, four phases,
all `role: qa`:

| Phase | `actions` | `checks.post` |
|---|---|---|
| `fresh-init` | `cli.run("wingfoil init")` (each supported template) | "exit-code-zero"; scaffolded dna.yaml/memory.yaml/directives round-trip their own loaders |
| `drive-cli` | `dna show`, `dna set <path> --value <v>`, `memory add …; memory submit …`, `paths <category>`, `directives list` | exit codes match `spec-005-cli-command-contract`; no schema-invalid artifact |
| `mcp-registration` | `cli.run("npm run check:mcp")` | exit 0; registered server version == `package.json` pin; channel set == `EXPECTED_CHANNELS` |
| `gate` | — | "e2e-smoke-passed (staged: warn until green for a release, then hard-reject)" · `approval: { by_role: approver }` |

**What changed since v0.2's run** (`e2e-smoke-rel-v0.2-plan`, `done`), per the dev-loop and user-docs
handoffs and `git log -- scripts/e2e-smoke.cjs .wingfoil/workflows/custom/e2e-smoke.yaml`:

- `e2e-smoke.yaml` gained the **`mcp-registration`** phase (v1.2, `task-112`, `19b89547`), executed by
  `scripts/check-mcp-registration.cjs`. This is its first run as a release gate.
- `scripts/e2e-smoke.cjs` changed only a doc-comment path (`task-111`); its step list is the one
  `task-107` closed `bug-029` with (`memory submit` included). `test/cli/e2e-smoke.test.ts` untouched.
- CLI surface touched by the patch and reachable from a scaffolded project: `memory add --set`
  (`task-110`), commented technology lines in init's `dna.yaml` (`task-118`), init's missing-template
  message (`task-119`), help text (`task-120`). Exit codes unchanged per `task-120`'s 41-invocation
  record.
- Known, unscheduled gaps of the smoke against its own YAML, carried by elements and **not** v0.2.2
  scope: `bug-132` (asserts only exit 0), `bug-133` (never revalidates what a command wrote),
  `bug-134` (no `produces:`; also carries the hard-reject text amendment) — all `triaged`,
  `release: ""`.

**Produces.** The phase declares no `produces:` (`bug-134`), so its artefact is this plan's Execution
Notes: the run logs and the gate report. Completion is the approver's `gate` approval plus this plan
reaching `done`.

## Phases / Steps

### P — Preconditions (verify first, stop if unmet)

| # | Condition | Command | Expected |
|---|---|---|---|
| P0 | Pinned build is the one in use (`dl-095`) | `npm run -s wingfoil -- --version` | `0.2.1` = `wingfoil-released` pin |
| P1 | `user-docs` complete | `awk '/^---$/{n++;next} n==1&&/^status:/' docs/05_plans/rl-v1/rel-v0.2.2/user-docs-rel-v0.2.2-plan.md` | `status: done` |
| P2 | Release `in-development` | `grep '^status:' docs/04_memory/planning/rl-v1/patch-v0.2.2.md` | `in-development` |
| P3 | Every v0.2.2 task `done`, every v0.2.2 bug `closed` | `for f in docs/04_memory/v0.2.2/task-*.md; do awk '/^---$/{n++;next} n==1&&/^status:/{print $2;exit}' "$f"; done \| sort \| uniq -c` · `grep -l '^release: "v0.2.2"' docs/04_memory/bugs/*.md \| xargs grep -h '^status:' \| sort \| uniq -c` | `16 done` · `12 closed` |
| P4 | Clean phase worktree, deps installed, `dist/` current | `git status --porcelain` · `npm ci` · `npm run build` | empty · exit 0 · exit 0 |

### D1 — APPROVER DECISION: staging posture for v0.2.2

`dl-023` "Staging record — 2026-09-28" rules: *"from v0.3 on, a failing `e2e-smoke` gate blocks
`release-submit`. v0.2 stays in warn, having passed."* `e2e-smoke.yaml` still describes the staged
posture (the amendment rides with `bug-134`). v0.2.2 is a patch released before v0.3, so the ruling does
not name it. Options: **(a) warn** — the letter of the ruling; a failure is reported and filed, does not
block `release-submit`. **(b) hard-reject** — v0.2 already ran green, so the flip condition of the
staged posture is met; a failure blocks `release-submit`. The decision is recorded before S6's report.
Irrespective of the posture, a failure is filed (S5); `mcp-registration` is new, so under (b) its
first-ever run is already blocking.

### S1 — `fresh-init` · qa

```bash
npm run build
node scripts/e2e-smoke.cjs --expect-version "$(node -p "require('./package.json').version")" \
  -- node "$PWD/dist/cli.js"
```

`--expect-version` takes what `package.json` says (`0.2.1`): the 0.2.2 bump (and `server.json`'s, per
`task-115`'s tag gate) belongs to `release-publishing`. **Check:** every `[Scrum]`/`[Kanban] wingfoil
init …` line `ok`; `grep -n "export const TEMPLATES" -A2 src/storage/templates.ts` names the same two
templates as `SMOKE_TEMPLATES`.

### S2 — `drive-cli` · qa

Same run: the remaining steps per template and the clean-tree check. **Check:** all `ok`, exit 0,
`working tree clean after every mutation` for both templates. Record the run log and the contract
delta in Execution Notes: G1 (`memory submit`) closed by `task-107`; the exit-code and revalidation gaps
are `bug-132`/`bug-133` — restate, do not re-file.

**S2a — patch-surface probe (no new gate step; H8).** With the throwaway-project recipe of
`e2e-smoke-rel-v0.2-plan` §4, exercise by hand the patch changes a scaffolded project can reach:
`memory add --type task --title … --set <token>=…` is irrelevant to init's `task` (no token), so probe
only that `dna show`/`dna set` keep the `task-118` comment lines and that `init` without `--template`
exits 2 listing both templates (`task-119`). Findings go to S5.

### S2b — user-docs examples · qa

```bash
for d in docs/examples/0*/; do WINGFOIL="node $PWD/dist/cli.js" bash "$d/run.sh" || exit 1; done
```

**Check:** all five exit 0, each ending `OK: …`. On a `FAIL:` decide whether tool or example is wrong
and file it (S5); never edit an example to make it pass.

### S3 — `mcp-registration` · qa

```bash
npm run check:mcp
```

**Check:** exit 0; the report names the pinned `0.2.1` and `[prompts, resources]`. Cross-check
`.mcp.json` points at `node_modules/wingfoil-released/dist/cli.js` and `package.json` pins
`npm:wingfoil@0.2.1`. Note: this verifies the *pinned* build, not the 0.2.2 candidate — the candidate's
MCP server is covered by `test/mcp/` in S4 and by `docs/examples/04-mcp-server`.

### S4 — the repository gates (confirm the phase changed nothing)

```bash
npx tsc --noEmit
npx jest --coverage          # one jest at a time in this worktree (dist/ race)
npm run lint && npm run docs:api && npm run check:lockfile
npm pack --dry-run           # file count vs 339 at cb7e8b1c
```

`bug-167` (publish-secrets dry-run flaky under coverage, `triaged` v0.3) may fail the coverage run: if
so, re-run that suite alone and in plain `npm test`, and record both.

### S5 — file what the run found · qa

Every finding becomes an element via the `bug-ingest` (or `decision-log-ingest`) main workflow with its
own plan under `docs/05_plans/rl-v1/rel-v0.2.2/` — never left only in Execution Notes. Ids are
allocated by the CLI at commit time; before merging, check with `git ls-tree` that main holds no
element with the same number. A fix is dev-loop work behind a task on a branch cut from `main`, never
inline (H8).

### S6 — `gate` · qa, then approver

Report: S1–S4 results, the posture chosen at D1, the open gaps (`bug-132..134`) and anything filed in
S5. The approver approves the `gate` phase. Agents never self-approve.

### S7 — close

Record the approval in Execution Notes; merge `qa/e2e-smoke-v0.2.2` into `main` with `--no-ff`;
finalize this plan by hand (`wf(plan): finalize e2e-smoke-rel-v0.2.2-plan [active → done]`,
`active` being a `waiting` state with no CLI verb); remove the worktree; update the auto-memory. Push is
the approver's call.

### Hazards

- **H1** `scripts/e2e-smoke.cjs` is reused verbatim by `publish.yml` (spec-015 §3 stage 3): any edit
  changes the publish gate. This phase edits nothing under `scripts/`.
- **H2** Pinned-build pitfalls: one id per verb (`bug-171`); stamp non-transition fields in their own
  commit first (`bug-076` guard); `task`/`plan` add needs the dev build (`--set`).
- **H3** Never touch `test/validation/secret-scan.test.ts` (`bug-055`, GitHub push protection).
- **H4** Shared main tree: other sessions commit on `main`; check `git branch --show-current` before
  every commit; this phase commits only in its worktree `../.wf2-wt/e2e-smoke-v0.2.2`.
- **H5** The smoke stops at the first failure: a short log is one problem, not the only one.
- **H6** Role `qa` → directives `testing` + global `doc-versioning, documentation, security-secrets,
  claim-evidence`: every claim in the notes names the command that settles it.

## Handoff

- **Approver:** D1 (posture); the `gate` approval; triage of anything filed in S5; the merge push.
- **Agent (qa):** P, S1–S5, the report, commit hygiene, S7 mechanics.
- **Completion criteria:** S1–S3 green (or failures filed and, under D1 (a), waived in writing); S4
  green; every finding an element; `gate` approved; this plan `done`. Then `release-cycle` advances to
  `release-submit`, which carries forward from `user-docs`: CHANGELOG `[0.2.2] - Unreleased` (dated at
  release-publishing), `package.json` + `server.json` still `0.2.1`, README roadmap row "🔄 Being
  released", the README mark's rendering on npmjs.com to check after publish, and the MCP Registry
  listing + its `service` element (`dl-093`) at release-publishing.

## Execution Notes

### 2026-09-29 — run on `b68bc306` (branch `qa/e2e-smoke-v0.2.2`, cut from `main` `3a8518e9`)

Handoffs received from the sessions "DEV v0.2.2 - B.dev-loop" (gates at `cb7e8b1c`) and
"DEV v0.2.2 - C.user-docs" (examples at `804c4545`, S8 gates at `03ea7db7`); nothing under `src/` or
`test/` changed after either measurement (`git diff --stat cb7e8b1c 3a8518e9 -- src test scripts`).

**P — preconditions: all met.** P0 `npm run -s wingfoil -- --version` → `0.2.1`. P1
`user-docs-rel-v0.2.2-plan` `status: done`. P2 `patch-v0.2.2` `in-development`. P3 `16 done` tasks,
`12 closed` bugs with `release: "v0.2.2"`. P4 `npm ci` exit 0, `npm run build` exit 0, worktree clean.
Toolchain: Node 22.21.0, npm 11.6.2.

**S1 + S2 — `fresh-init` + `drive-cli`: PASS.**
`node scripts/e2e-smoke.cjs --expect-version 0.2.1 -- node "$PWD/dist/cli.js"` → exit 0, **20/20 `ok`**:
`--help`, `--version = 0.2.1`, then for `[Scrum]` and `[Kanban]` each of `init --template`,
`dna show`, `dna set project.name --value …`, `memory add --type task`, `memory submit
task-001-smoke-task`, `paths config --list`, `directives list`, `workflow list` exit 0, and "working
tree clean after every mutation — clean". `grep -n "export const TEMPLATES" src/storage/templates.ts`
→ `[SCRUM, KANBAN]`, the same set as `SMOKE_TEMPLATES`.
Contract delta vs `e2e-smoke.yaml` `drive-cli`: unchanged since v0.2 — `memory submit` present
(`task-107`); exit-code coverage (only 0 asserted) and artefact revalidation remain the open gaps
carried by `bug-132` / `bug-133`; the missing `produces:` by `bug-134`. Not re-filed.

**S2a — patch-surface probe (Scrum, throwaway repo, `dist/` of this worktree): no finding.**
`init` with no `--template` → exit 2, `error: missing required argument: --template (one of: Scrum,
Kanban)` (`task-119`). The scaffolded `dna.yaml` carries the `{name, category}` comment block above
`technologies: []` (`task-118`); after `dna set project.name --value Probe` (exit 0) the block is
intact, and after `dna add stacks.technologies --value TypeScript --entry-category language` (exit 0,
commit `wf(dna): add stacks.technologies TypeScript`) the block is intact and the entry reads
`{name: TypeScript, category: language}`; `git status --porcelain` empty after each.

**S2b — user-docs examples: PASS, 5/5.**
`for d in docs/examples/0*/; do WINGFOIL="node $PWD/dist/cli.js" bash "$d/run.sh"; done` — each exit 0:
`01-first-project` "OK: first project: init → add → submit → approve"; `02-custom-memory-type` "OK:
custom type: draft → ready → in-progress → done"; `03-directives-per-role` "OK: directives: create →
assign → list → unassign → remove"; `04-mcp-server` "OK: MCP server: resources, templates, role
prompts, a Memory read"; `05-ci-json-exit-codes` "OK: CI: json output, exit codes 0/1/2, a
pending-approval gate".

**S3 — `mcp-registration`: PASS (first run as a release gate).** `npm run -s check:mcp` → exit 0,
`.mcp.json "wingfoil" runs the pinned wingfoil 0.2.1, advertising [prompts, resources] (prompts: 8,
resources: 2)`. `.mcp.json` → `node node_modules/wingfoil-released/dist/cli.js mcp`; `package.json`
pins `"wingfoil-released": "npm:wingfoil@0.2.1"`.

**S4 — repository gates: all green.** `npx tsc --noEmit` exit 0; `npx jest --coverage` → 160 suites /
2624 tests passed, exit 0 (the `coverageThreshold.global` 80% gate is enforced by that exit); `npm run
lint` exit 0; `npm run docs:api` exit 0; `npm run check:lockfile` exit 0; `npm pack --dry-run` →
`total files: 339` (= `cb7e8b1c`). `bug-167` did not fire. `git status --porcelain` empty afterwards.

**S5 — findings: none.** No element filed by this phase.

**S6 — gate report (qa): PASS.** Every check of the four phases passed; the known smoke gaps are
`bug-132..134` (`triaged`, unscheduled). Posture: pending the approver's D1 ruling — under either
option the run passes, so the posture decides only what a future v0.2.x run would do. Awaiting the
approver's `gate` approval.
