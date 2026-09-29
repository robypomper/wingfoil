---
id: user-docs-rel-v0.2.2-plan
type: plan
title: "User-docs — v0.2.2 (align user and agent docs to the shipped surface, add the project logo)"
status: active
version: "1.0"
workflow: "user-docs"
phase: "rel-v0.2.2"
element: "patch-v0.2.2"
release: "v0.2.2"
tmpl_version: 260703
---

## Context

`patch-v0.2.2` (`docs/04_memory/planning/rl-v1/patch-v0.2.2.md`) is `in-development`, and its
`implementation` phase is complete: `dev-loop-rel-v0.2.2-plan` is `done` (`cb7e8b1c`), with the 16
tasks `task-109` … `task-124` `done` and the 12 bugs carrying `release: "v0.2.2"` `closed`. Per
`release-cycle.yaml` (v1.1) the next phase is **`user-docs`** (`include: user-docs`), followed by
`e2e-smoke`, `release-submit` and `release-publishing`.

The phase contract is `.wingfoil/workflows/custom/user-docs.yaml` **v1.1**, `element: release`, three
phases:

| Phase | Role | Contract |
|---|---|---|
| `check-implementation-complete` | tech-lead | `checks.pre`: "all tasks where tags=[{release.version}] are status: done" |
| `align-user-docs` | developer | `produces:` `README.md`, `docs/user-guide.md`, `docs/cli-reference.md`, `docs/examples/`, `CHANGELOG.md` · `checks.post`: "user-facing docs aligned with the release's shipped CLI/feature surface" · `approval: { by_role: approver }` |
| `align-agent-docs` | architect | `produces:` `CLAUDE.md`, `.wingfoil/README.md` · four `checks.post` (status vs `CORE_MODULES`, element/state tables vs `memory.yaml`, workflow list vs `workflows.yaml`, role bindings vs `roles.yaml`) · `approval: { by_role: approver }` |

This is the **second** run of the gate (v0.2's was `user-docs-rel-v0.2-plan`) and the **first** run of
`align-agent-docs` (`dl-025`, landed in `user-docs.yaml` v1.1 after v0.2's run). Unlike v0.2, every
`produces:` artifact exists, and several tasks have already touched them. This run is a delta, not an
authoring job.

**Handoff.** The session "DEV v0.2.2 - B.dev-loop" handed over on 2026-09-29, with every fact read on
`main` at `804c4545`. That handoff is summarised in §3 and §4, and is re-measured in S2 rather than
trusted.

**Scope addition by the approver (2026-09-29): the project logo.** The approver asked this phase to
add an icon for the GitHub repository. GitHub has no per-repository icon. The request therefore
covers three surfaces:

- the logo at the top of `README.md`, which is in this phase's `produces:`;
- the organisation avatar, external state recorded by `svc-001-github-organisation-wingfoil`;
- the repository social preview, external state recorded by `svc-004-github-repository-settings`.
  That element currently reads *"social preview: none (`dl-128`)"*.

`dl-128-user-facing-presentation` (`ready`, `release: v0.3`) decides badges, demo, comparison and case
study for the README. It does not decide a logo, so this addition does not pre-empt it. The logo
source is the SVG the approver had produced in the session "Wingfoil logo SVG conversion". It sits
outside the repository and is integrated here (§5, S7).

**Build in use.** Memory operations run through the pinned build, `npm run -s wingfoil -- <cmd>`
(`dl-095`), which must print `0.2.1`. The exception is `memory add --type plan`: 0.2.1 has no `--set`,
so this plan was added with the dev build (`node dist/cli.js memory add … --set …`, `e5c68bd0`).

---

## 1. Preconditions — verify FIRST, stop if unmet

| # | Condition | Command | Expected |
|---|---|---|---|
| P1 | The release is `in-development` | `awk '/^---$/{n++;next} n==1&&/^status:/' docs/04_memory/planning/rl-v1/patch-v0.2.2.md` | `status: in-development` |
| P2 | Every v0.2.2 task is `done` (`checks.pre`) | `for f in docs/04_memory/v0.2.2/task-*.md; do awk '/^---$/{n++;next} n==1&&/^status:/{print $2; exit}' "$f"; done \| sort \| uniq -c` | one line: `16 done` |
| P3 | No v0.2.2 bug still open (informational: `release-submit`'s pre-check) | `grep -l 'release: "v0.2.2"' docs/04_memory/bugs/*.md \| xargs grep -h -m1 '^status' \| sort \| uniq -c` | `12 status: closed` |
| P4 | The pinned build is the one in use | `npm run -s wingfoil -- --version` | `0.2.1` |
| P5 | The phase worktree is clean, on its branch | `git -C ../.wf2-wt/user-docs-v0.2.2 status --porcelain` (empty) · `git -C ../.wf2-wt/user-docs-v0.2.2 branch --show-current` | `docs/user_docs_v0.2.2` |

P1, P2, P4 and P5 were measured on 2026-09-29 at `804c4545` and all passed. P3 is the handoff's figure
and is re-run in S1.

---

## 2. Conventions a fresh session will not know

- **Branch and worktree.** The phase runs on `docs/user_docs_v0.2.2`, in the worktree
  `../.wf2-wt/user-docs-v0.2.2`, cut from `main` at `804c4545`. Other sessions commit on `main`
  ("UX: Dashboard 0.1 5th", "DEV v0.3 - planning"). Check `git branch --show-current` before every
  commit. Sync with `git merge --no-edit main`, never a rebase (`dl-035`).
- **Memory operations.** Operations use the §5.1 commit format (`CLAUDE.md` is the entry point, the
  contract is `spec-008-cli-grammar`). One operation per commit, with explicit paths and never
  `git add -A`. `approve`/`reject` run only on the approver's instruction.
- **Ids come from the CLI at commit time.** A finding that becomes a bug gets its id from
  `npm run -s wingfoil -- memory add --type bug …`. Numbers are never pre-computed.
- **Evidence rule (`claim-evidence`).** Every sentence the docs add about what the tool does names the
  command that establishes it, and the command was actually run.
- **`doc-versioning`.** Bump a document's `version` only on its first edit after it is committed, and
  update its date with the bump.
- **Do not bump `package.json`/`server.json` `version`.** Both read `0.2.1`
  (`grep -n '"version"' package.json server.json`). The bump to `0.2.2` belongs to
  `release-publishing`. The tag gate also checks the `server.json` versions (task-115). The CHANGELOG
  heading is written without a date (`[0.2.2] - Unreleased`), which avoids a wall-clock date
  (REQ-SYS-07).
- **Never touch `test/validation/secret-scan.test.ts`.** Any commit that changes it trips GitHub push
  protection again (`bug-055`, second allowlist exception).
- **Roles and directives (`roles.yaml`).** `check-implementation-complete` → tech-lead →
  `architecture, code-review`. `align-user-docs` → developer →
  `code-quality, testing, determinism, command-baseline`. `align-agent-docs` → architect →
  `architecture, determinism, traceability, command-baseline`. Global: `doc-versioning,
  documentation, security-secrets, claim-evidence`.
- **Same-class drift is fixed before approval.** When a stale sentence is found, every instance of the
  same class in the files this phase owns is fixed in the same pass. Findings outside `produces:`
  become Memory elements. They are not left in notes.

---

## 3. What v0.2.2 changed that a user or an agent sees (handoff, to re-measure)

| Task | Change | Where it must be reflected |
|---|---|---|
| task-109 | The audit reads `->` as well as `→` in transition brackets, and reports brackets it cannot parse | CHANGELOG (Fixed) |
| task-110 | `memory add --set <name>=<value>`, repeatable; version dots kept in slugs; workflow `memory.add` may carry `id_pattern` | CHANGELOG (Added); cli-reference and user-guide already updated |
| task-111 | Configuration at the repository root: `.wingfoil/`, Memory at `docs/04_memory/`; the verbs run on this repository | CHANGELOG (contributor-facing); CLAUDE.md, `.wingfoil/README.md` |
| task-112 | Pinned build `wingfoil-released` = `npm:wingfoil@0.2.1`; `.mcp.json`; `npm run check:mcp`; phases `advance-pinned-build`, `mcp-registration` | CHANGELOG (contributor-facing); README, COLLABORATION already updated |
| task-113 | Publishing through the npm trusted publisher (OIDC), `npm stage publish`, no token | CHANGELOG (Changed/Security) |
| task-114 | Bug machine: reject from `triaged`/`planned` → `closed` | CHANGELOG; CLAUDE.md §5 already updated |
| task-115 | package metadata, `mcpName` `io.github.wingfoil/wingfoil`, root `server.json` | CHANGELOG |
| task-116 | Repository slug `wingfoil/wingfoil` | CHANGELOG; every repository URL in `produces:` |
| task-117 | `@anthropic-ai/sdk` and `chalk` removed from runtime dependencies | CHANGELOG (Removed) |
| task-118 | `init`'s `dna.yaml` scaffold shows the `{name, category}` technology shape | CHANGELOG; user-guide `init` section |
| task-119 | `init` error messages: missing `--template` lists the templates; already-initialised names a remedy | CHANGELOG; cli-reference already updated |
| task-120 | Every command's `--help`: description, operand, options, `(required)`, Example, Exit codes; one message changed (`option '--type <type>' argument missing`) | CHANGELOG; cli-reference, user-guide already updated |
| task-121 | Vision calendar rebased on active days | internal, no user doc |
| task-122 | Coverage measures `src/core/index.ts` and `src/mcp/index.ts` | internal, no user doc |
| task-123 | `memory add` works when template paths are relative to `.wingfoil/` | CHANGELOG (Fixed) |
| task-124 | New Memory type `service` (`svc-*`, `docs/04_memory/services/`, `draft → pending → active`) and a `service-ingest` main workflow | CHANGELOG (Added); user-guide if it lists the types; CLAUDE.md already updated |

External changes, not code: the repository was transferred to `wingfoil/wingfoil`, the npm trusted
publisher was configured (stage only), the `NPM_TOKEN` secret was deleted, and the Claude GitHub App
was installed on the organisation (`svc-001` … `svc-009`).

---

## 4. Known stale items (handoff, to re-measure)

- `CHANGELOG.md` has no `0.2.2` section; the latest is `[0.2.1] - 2026-09-28`.
- `docs/cli-reference.md` opens with *"Every `wingfoil` command in release **0.2.1**"*.
- `docs/examples/` (five scripts plus `lib.sh`) was touched by no task. S3 runs them against the
  current build.
- `CLAUDE.md`: `task-111`'s Execution Notes (AC 5) list the items left for `align-agent-docs`:
  - §3 said the Memory-transition verbs "do not exist yet";
  - §5.1 did not say whether WingFoil's own Memory runs through the verbs;
  - §1's status line said `minor-v0.2` `in-development`.

  Tasks 112, 117 and 124 fixed some of these later, so each is re-checked, not assumed.
- `.wingfoil/README.md`: the heading *"Why it lives here and is hand-authored"*, and the
  `directives/built-in/` row.
- `.wingfoil/workflows/custom/initial-design.yaml` and `wingfoil-init.yaml`: a header `NOTE` that
  *"WingFoil's CLI/MCP is not yet usable"*. These are **not** in either phase's `produces:`, so they
  are filed as a bug (S9), not edited here.

**Out of scope, with a release already assigned:** `bug-160` (vision index map), `bug-165`, `bug-168`
(message shapes), `bug-161`, `bug-164`, `bug-166` and `bug-155/157/158/162/163/167`, all `v0.3`. Also
out of scope: `bug-126`, `127`, `130`, `131`, `055`, open with no release. The four `dl-128`
artefacts (badges, demo, comparison, case study) are `v0.3`.

---

## 5. The logo — what is added and where

**Source.** `wingfoil_logo.svg`, 163×167, produced by the session "Wingfoil logo SVG conversion". It is
**outside the repository**, and repository documents never reference outside it, so it is copied in.

The file has two groups:

- `wf-mark`: the symbol, with a teal→blue gradient;
- `text25`: the wordmark "Wingfoil", converted to paths, fill `#081532`.

Two facts matter:

- **The wordmark reads "Wingfoil".** The product name everywhere else is **"WingFoil"** (README
  title, `svc-001`'s organisation name, corrected to `WingFoil` on 2026-09-29).
- **The wordmark is dark navy on transparent.** It is nearly invisible on GitHub's dark theme.

**Artifacts, all under `docs/assets/`:**

| File | What | Used by |
|---|---|---|
| `wingfoil-logo.svg` | full logo, symbol plus wordmark | reference / light backgrounds |
| `wingfoil-mark.svg` | symbol only (`wf-mark`), viewBox cropped to it | README header, avatar source |
| `wingfoil-avatar.png` | 500×500, symbol centred on an opaque background | the `wingfoil` organisation avatar (uploaded by the approver) |
| `wingfoil-social-preview.png` | 1280×640, under 1 MB: symbol, the "WingFoil" name and the category line on an opaque background | the repository social preview (uploaded by the approver) |
| `README.md` in the same folder | how each file is regenerated from `wingfoil-logo.svg` (the exact `inkscape`/`convert` commands) | reproducibility |

The two PNGs are generated from the SVG with `inkscape` and ImageMagick `convert`, both installed on
the author's machine, never added as npm dependencies (`dl-010`).

**README header.** The mark (`wingfoil-mark.svg`) is centred above the title, referenced by a relative
path. The title stays text, so the README spells the product name "WingFoil", and the mark is legible
on both GitHub themes because it contains no dark text.

**The README ships in the npm tarball, the assets do not.** `package.json` `files` is
`["dist", "README.md"]`. On npmjs.com a relative image resolves only if npm rewrites it against the
`repository` URL. That is checked on the package page after `release-publishing` (hazard H1). The
assets stay out of the tarball: S8 checks `npm pack --dry-run`.

---

## 6. Steps

### S1 — `check-implementation-complete` · role: tech-lead

- **Action:** run P1–P5 (§1) verbatim.
- **Check:** P2 prints `16 done`, P3 prints only `closed`.
- **Stop condition:** a task not `done` → the phase has not started.

### S2 — Survey · role: developer

- **Action:** measure the shipped surface and diff it against the docs.
  - Run `npm run build`, then `node dist/cli.js --help`, and `<group> --help` for every group.
  - Compare the command list with `CORE_MODULES` (`src/core/index.ts`) and with every command list in
    README, user-guide and cli-reference.
  - Re-run each §4 item with the command that settles it.
- **Produces:** the survey in this plan's `## Execution Notes`, each row with its command.
- **Check:** every `produces:` path of both phases has a verdict: aligned, or stale with the line.

### S3 — Run the examples · role: developer

- **Action:** run each `docs/examples/*/run.sh` against the current build, as `e2e-smoke`'s S2b does
  (`e2e-smoke-rel-v0.2-plan`).
- **Check:** all five exit 0. A failure is fixed in the example if the example is wrong. If the tool
  is wrong, it is filed as a bug and the approver is told.

### S4 — `CHANGELOG.md` `[0.2.2] - Unreleased` · role: developer

- **Action:** a Keep-a-Changelog section built from §3. Group it under Added / Changed / Removed /
  Fixed / Security. Every entry ends with its `task-NNN` or `bug-NNN`, as the file's preamble
  requires. Contributor-only changes (pinned build, config at the root) go in one short "For
  contributors" group, or are left out on the approver's call.
- **Check:** every entry traces to a `done` task or a `closed` v0.2.2 bug
  (`grep -o 'task-[0-9]*\|bug-[0-9]*'` on the section, each id's status read from its file). No entry
  describes something `node dist/cli.js --help` cannot do.

### S5 — `README.md`, `docs/user-guide.md`, `docs/cli-reference.md` · role: developer

- **Action:** fix every stale item S2 found. At minimum:
  - the cli-reference's release line becomes `0.2.2`;
  - repository URLs are `wingfoil/wingfoil` (`grep -rn 'robypomper/wingfoil' README.md docs/*.md` → empty);
  - the `service` type appears wherever the Memory types are listed;
  - `init`'s scaffold shape is shown as `{name, category}`.
- **Check:** `npx jest test/docs` is green (the cli-reference completeness gate). Every changed
  transcript was pasted from a real run in a throwaway project.

### S6 — `docs/examples/` · role: developer

- **Action:** only what S3 found. No new examples: the demo is `dl-128`'s, in v0.3.

### S7 — The logo · role: developer (files) + approver (uploads)

- **Action:**
  1. Copy the SVG into `docs/assets/wingfoil-logo.svg`.
  2. Extract `wingfoil-mark.svg`.
  3. Generate the two PNGs and write `docs/assets/README.md` with the regeneration commands.
  4. Add the mark to the top of `README.md`.
- **Approver decision, asked before the PNGs are finalised:**
  - (a) Should the wordmark in `wingfoil-logo.svg` be corrected to "WingFoil", or kept as designed?
  - (b) The background colour of avatar and social preview: white, or the dark navy `#081532` with a
    light wordmark?
- **Approver action:** upload `wingfoil-avatar.png` (Organization settings → Profile → Profile
  picture) and `wingfoil-social-preview.png` (Repository → Settings → General → Social preview →
  Edit). Neither has an API; the agent holds no credentials.
- **Then, developer:** update `svc-001`'s and `svc-004`'s Configuration and Verification, in a
  `docs(self)` commit (`dl-088` option 2), naming the file and its commit. The previous entry
  *"social preview: none (`dl-128`)"* is replaced. Verification:
  - the avatar URL, read with `gh api orgs/wingfoil --jq .avatar_url` and opened;
  - the social preview, checked by eye on the repository page, as `svc-004` already states.
- **Check:** `npm pack --dry-run 2>&1 | grep docs/assets` → empty. The README renders the mark on
  github.com in both themes (checked by eye by the approver once the merge is pushed).

### S8 — Gates · role: developer

```bash
npx tsc --noEmit
npx jest --coverage          # 160 suites / 2624 tests at cb7e8b1c; ≥80% enforced by coverageThreshold
npm run lint
npm run docs:api
npm run check:lockfile
npm run check:mcp
npm pack --dry-run           # 339 files at cb7e8b1c; docs/assets must not appear
```

### S9 — `align-user-docs` approval · role: approver

Present the S2 survey, the diff of the five `produces:` artifacts plus `docs/assets/`, and the S8
results. **Stop** until the approver rules. Findings outside `produces:` (the two workflow-YAML
`NOTE`s in §4, anything S2/S3 find) are filed as bugs via the pinned `memory add` first.

### S10 — `align-agent-docs` · role: architect

- **Action:** re-align `CLAUDE.md` and `.wingfoil/README.md` against the four `checks.post`, each run
  as a command:
  1. **Status and command surface vs `CORE_MODULES`.** §1's command list and count, and the release
     status lines (`minor-v0.2` `released`, `patch-v0.2.2` at its current state).
  2. **Element/state tables vs `memory.yaml`.** The §5 table compared type by type with
     `sequence`/`gates`/`waiting`, `service` included.
  3. **Workflow list vs `workflows.yaml`.** §6's mains and subs, `service-ingest` and the task-112
     phases included.
  4. **Role bindings vs `roles.yaml`.** The §7 table.

  Plus the `task-111` AC 5 items (§4) and the `.wingfoil/README.md` heading. Add the
  `docs/assets/` row to `CLAUDE.md` §2's documentation map.
- **Check:** each of the four checks records its command and result in Execution Notes.

### S11 — `align-agent-docs` approval, merge · role: approver

After approval, merge `docs/user_docs_v0.2.2` into `main` (`--no-ff`), move this plan
`active → done` (`finalize`), and update the auto-memory. The next phase is `e2e-smoke`. The push is
the approver's.

---

## 7. Known hazards

- **H1 — the README image on npmjs.com.** The tarball carries `README.md` but not `docs/assets/` (§5).
  After `release-publishing`, open `https://www.npmjs.com/package/wingfoil`. If the mark does not
  render there, file a bug. Do not switch to an absolute URL pre-emptively: an absolute URL
  breaks the rule that references resolve inside the repository, and whether a
  `raw.githubusercontent.com` SVG renders on npmjs.com has not been checked.
- **H2 — concurrent sessions on `main`.** The v0.3 planning session merges only Memory and process
  documents until the v0.2.2 tag (`dl-092` rule (a)). A conflict on `CLAUDE.md` or `README.md` at
  merge time is resolved by hand, never by a rebase.
- **H3 — worktrees that are not this phase's.** `.wf2-wt/design-dashboards` still carries
  `docs/self/` commits, and old v0.2 task worktrees are still open (`git worktree list`). Leave them.

---

## Handoff

- **Approver:** the two S7 decisions (wordmark spelling, background); the two uploads; the S9 and S11
  approvals; the push.
- **Agent:** S1–S8 and S10, filing findings as elements, and never approving.
- **Completion:** both approvals given; the branch merged into `main`; `svc-001`/`svc-004` updated;
  this plan `done`. Next phase: `e2e-smoke`.

---

## Execution Notes

**S7 (logo), done ahead of S1 on the approver's request, 2026-09-29.**
- `424f4c93`: the assets under `docs/assets/`. The logo, the mark and both banners come from the
  session "Wingfoil logo SVG conversion". The approver ruled the wordmark "WingFoil"; it was redrawn
  as paths from Inter Bold / Inter Display Bold. The avatar is the mark on white (the agent's choice;
  the approver used it).
- `7421e969`: the logo and mark PNGs. `d21bbcd8`: `docs/assets/README.md` gets the organisation's
  crop right.
- The approver uploaded the avatar and the **dark** banner. Both were read back through the API and
  recorded in `svc-001`/`svc-004` (`1a4a3252`):
  - the social preview is identical to `wingfoil-social-preview-dark.png`, RMSE `0`;
  - the avatar is a 370×370 crop made in GitHub's dialog.
- `npm pack --dry-run 2>&1 | grep -c docs/assets` → `0`, with 339 files in total.

**S1**, at `804c4545` (branch up to date with `main`):
- P1 → `status: in-development`;
- P2 → `16 done`;
- P3 → `12 status: closed`;
- P4 → `0.2.1`;
- P5 → clean, on `docs/user_docs_v0.2.2`.

**S2 — survey.**
- **Command surface.** `node dist/cli.js --help` and `<group> --help` list 20 commands: `init`,
  `mcp`, `paths`, `dna show|set|add|update|remove`,
  `memory add|submit|approve|reject|deprecate|history|search`, `directive create|assign|remove`,
  `directives list`, `workflow list`. This matches the README's *CLI at a glance* table and
  `CLAUDE.md` §1. The cli-reference completeness gate is green (`npx jest test/docs` → 2 suites,
  4 tests).
- **Stale version.** `grep -rn '0\.2\.1'` over the user docs found the release named as 0.2.1 in
  user-guide (5), cli-reference (3), examples/README (1), agents.md (5) and README (2). The one
  legitimate hit left is the README's 0.2 row, `wingfoil@0.2.1 on npm`.
- **Repository slug.** `grep -rn robypomper` over README, docs/*.md, examples and COLLABORATION →
  nothing (task-116 already did it).
- **README Quick Start.** Re-run verbatim in a throwaway repository with the dev build. Every output
  (init, dna set/add, memory add/submit/approve, `git log -1 --format=%B`) matches the README.
- **User guide.** §3 (`init`'s two error messages) and §11 (`dna show team.members` → exit 1;
  `E_NOT_AT_GIT_ROOT` from a subdirectory) re-run and confirmed. The one stale limitation was
  "`--help` is terse", fixed by task-120.
- **Correction to §3 of this plan.** The `service` type and the bug decline edges exist only in
  *this repository's* `.wingfoil/memory.yaml`. `init --template Scrum` installs templates for
  adr/bug/decision-log/release/release-line/task/tech-spec, and a bug type with no machine
  (`grep -A6 '^  bug:'` on the scaffolded `memory.yaml`). So they go in the CHANGELOG's
  contributor group, not in the user guide.

**S3.** `WINGFOIL="node $PWD/dist/cli.js" bash docs/examples/0*/run.sh` → all five exit `0`.

**S4–S6 (`6dea5c03`).**
- CHANGELOG `[0.2.2] - Unreleased`: its 15 task ids and 11 bug ids are all `done`/`closed`.
- Two claims were checked against the pinned 0.2.1:
  - the slug change: 0.2.1 gives `task-001-v0-2-prep` and 0.2.2 gives `task-s1-001-v0.2-prep`;
  - the missing-token message: exit 1.
- The docs name 0.2.2. The README carries the mark and "status in 0.2.2", and its 0.2.2 row reads
  "🔄 Being released", as the 0.2 row did at the same point in v0.2 (`git show 8e5c14f4:README.md`).
- **`docs/agents.md`** is in no `produces:` (the approver's ruling at v0.2). Its five "0.2.1" lines
  are the same class of drift as the user guide's, so they were fixed in the same commit. The
  approver confirms or reverts this at S9.
