---
id: "release-planning-rel-v0.2.2-plan"
type: plan
title: "Release-planning — rel-v0.2.2"
status: active
version: "1.8"
workflow: "release-planning"
phase: "rel-v0.2.2"
element: "patch-v0.2.2"
release: "v0.2.2"
tmpl_version: 260703
---

## Context

`patch-v0.2.2` (`docs/self/docs/04_memory/planning/rl-v1/patch-v0.2.2.md`) is the first patch of a
released minor. The v0.2 retrospective ruled that it ships before v0.3.0 (`retro-v0.2`, rows 9–42;
`retrospective-rel-v0.2-plan` §6.7–§6.8), and `dl-092` ruled how it is tracked: a `release` element
with `kind: patch` and `patch-of: minor-v0.2` (Q1 (A), id variant (a), `{kind}-{version}`), running
every `release-cycle` phase except `retrospective` (Q2 (ii)). This plan executes the first of those
phases, `release-planning` (`.wingfoil/workflows/custom/release-planning.yaml` v1.2), per `dl-019`.

**Preconditions (verified on `design/release_planning_v0.2.2` at `75550694`).**
- `minor-v0.2` `released` (`d2ad1f3f`); `wingfoil@0.2.1` on npm; `main` equal to `origin/main`
  (`git rev-list --left-right --count origin/main...main` → `0 0`).
- `dl-092` implemented in configuration at `92908e8c`: `memory.yaml` v1.2 (`id_pattern:
  "{kind}-{version}"`, `kind` required), release template `tmpl_version: 260929`,
  `release-planning.yaml` v1.2 (define-scope check gains `kind`). `npm test` → 149 suites, 2418 tests
  green. The five `minor-*` ids are immutable and are not backfilled with `kind`.
- `patch-v0.2.2` added at `draft` (`75550694`).
- Identity: `git config --local user.email` → `robypomper@gmail.com` (`dl-094` remedy (i), done by the
  approver on 2026-09-28).
- The Memory verbs still cannot be pointed at this repository (`bug-075`, `open`): every Memory
  operation in this plan is done by hand in the §5.1 commit format.
- Next free ids: `task-109`, `adr-011`, `spec-016`, `bug-154`, `dl-131`
  (`ls` of each type directory, highest number + 1).

**Scope in, as the retrospective approved it** (status and `release` at `75550694`, read with
`grep -m1 '^status:\|^release:'` on each file):

| Element | Status | `release` | §6.8 step |
|---|---|---|---|
| `dl-094` identity, `bug-137` `BRACKET_RE`, `dl-092` patch tracking | ready / triaged / ready | v0.2.2 | 1 |
| `bug-075` configuration at the root; `dl-095` pinned build; `dl-026` MCP registered; `dl-107` version dots in ids | open / ready / ready / ready | "" / v0.2.2 / "" / v0.2.2 | 2 |
| `dl-087` staged publishing, `bug-136` publish actions on Node 20 | ready / triaged | v0.2.2 / **v0.3** | 3 |
| `dl-088` the `service` type and the backfilled services | ready | v0.2.2 | 4 |
| `dl-091` public identity; `dl-093` metadata; `bug-138`, `bug-139`, `bug-140`, `bug-128`, `bug-129`; `bug-021` downgrade; `dl-123` won't-fix exit and `bug-092`; `dl-096` re-baseline | in-discussion / ready / triaged ×3 / open ×2 / open / ready + triaged / ready | v0.2.2 except `bug-128`, `bug-129`, `bug-021`, `bug-092` ("") | 5 |
| Staging → tag `v0.2.2` on the pushed `main` → publish | — | — | 6 (`release-publishing`, not this phase) |

**Scope out, on purpose.** `bug-118`, `bug-126`, `bug-072`, `bug-131` and the dirty-tree `submit`
question stay in v0.3 (§6.8, *Kept in v0.3 on purpose*). The unscheduled population — 70 `open` bugs
and 26 `in-discussion` decision-logs with `release: ""` — is v0.3's clean-up, and the selection
filters below name their elements explicitly rather than sweeping the whole filter.

**Parallel-release rule (`dl-092`, option (a)).** v0.3 starts after step 2. From then until the
`v0.2.2` tag, v0.3 merges only Memory and process documents into `main`; its branches take v0.2.2
through `git merge main`, never a rebase (`dl-035`).

**Produces.** `patch-v0.2.2` → `in-development`; `dl-091` → `ready`; the selected bugs `triaged` then
`planned`, `bug-094` `closed`; any ADR or tech-spec amendment the scope needs; tasks `task-109…` at
`backlog` under `docs/self/docs/04_memory/v0.2.2/`; `release: "v0.2.2"` stamped on every included
element.

## Phases / Steps

Executed on branch `design/release_planning_v0.2.2` (`dl-024` branch-per-phase), merged into `main`
with `--no-ff` at the end. Every Memory operation is one scoped `wf({type}): {verb} {ids}` commit
(§5.1). Approver gates (⛔) run only on the approver's explicit instruction, with `Approver:` and
`Reason:` in the commit body.

0. **Configuration for the patch** (done). `dl-092` Q1 (A) in `92908e8c`, implemented with a `kind`
   field and `{kind}-{version}` (the approver's choice on 2026-09-29; `dl-092` itself proposed
   `patch-{version}`); `wf(plan): add` this
   plan (`639aea4a`); `wf(release): add patch-v0.2.2` (`75550694`).
1. **define-scope** (product-owner, no gate). Fill `patch-v0.2.2`: `title`, `kind: patch`,
   `patch-of: minor-v0.2`, `version: v0.2.2`, `release-line: v1`, and
   - `pillar: P1` — the root move, the `service` type and the patch-tracking edge are Memory work;
   - `features` — the features the scope touches, not new ones: P1.3 (`dl-107`), P1.10 (`bug-137`),
     P1.13 (`dl-088`, `dl-092`, `dl-123`), P2.4 (`bug-139`), P5.1.1 (`bug-129`, `bug-140`), P5.1.4
     (`bug-128`), P5.2.1 (`dl-026`);
   - `requirements` — `retro-v0.2`'s path. No `by-release/v0.2.2.json` exists, and the patch's
     approved scope is the retrospective's disposition table (`dl-124`'s `not-applicable` is v0.3).
   Write Scope, Pillar Focus and Success Criteria from §6.8. `memory.submit` `[draft → planning]`.
2. **triage-bugs** (tech-lead, ⛔). Selected, from the filter `{status: open, release: ["", v0.2.2]}`:
   - `memory.approve` `[open → triaged]`: `bug-021`, `bug-075`, `bug-128`, `bug-129`;
   - `memory.reject` `[open → closed]`: `bug-094`, `Reason:` retyped to `dl-123` (`ready`,
     `release: v0.2.2`), which carries its content — nothing is left to fix under the bug itself.
   The other 69 open unscheduled bugs are not selected and stay untouched.
   **Done 2026-09-29** on the approver's instruction: `1b138d40` (approve, four bugs) and `30c18658`
   (reject `bug-094`, `rejection_reason` set).
3. **reconcile-governance** (product-owner, ⛔). In scope and not `ready`: only `dl-091`. Before the
   gate, the agent records in `dl-091` the name checks (npm, GitHub, crates.io, PyPI, trademarks), each
   with its source and the date read. The approver chooses the MCP namespace and the new repository
   name; `memory.approve dl-091 [in-discussion → ready]`. The other 25 unscheduled `in-discussion`
   decision-logs are not selected.
   **Done 2026-09-29**: the facts in `4283ca65` and `f5927f93`, the approval in `a4e80e11`.
4. **record-adrs** (architect, optional, `dl-022` spec-review + ⛔). `dl-087` changes `adr-009`'s
   decision points 4 (promotion) and 5 (credential), not its trigger, gate or Verdaccio staging
   (points 1–3). The approver asked for a new ADR on 2026-09-29. `adr-011` is scoped to points 4–5
   (option (c) in its Context): `adr-009` stays `accepted`, and on `adr-011`'s acceptance gains a
   dated revision note sending points 4–5 there. Nothing is deprecated or moved to `superseded`.
   *Superseded wording (v1.0–v1.3): "`adr-009` retired with `deprecate`", written before `dl-087`
   was read against `adr-009` point by point.*
5. **identify-specs** (architect, `dl-022` spec-review + ⛔). Survey the artefacts the scope changes:
   `spec-015-packaging-publishing` §1/§4 (`dl-093`, `dl-087`, `bug-136`) and
   `spec-001-memory-yaml-schema` (`dl-088` `service` type, `dl-092` `kind`/`patch-of`, `dl-123` edge).
   Each is either amended under the approver's gate or scaffolded as `spec-016…` if the change is a new
   artefact. The survey also found `spec-010` (type enumeration stale since `dl-019`). No new spec is
   needed. Drafted 2026-09-29: `adr-011` (`df6512fe`, `pending`), `spec-015` (`0a4f7a9c`), `spec-001`
   (`0f68c739`), `spec-010` (`289300a5`); the `dl-022` spec-review returned PASS-with-fixes (14
   findings, no blocker), applied in the commit after this revision. Carried to build-backlog, not
   done here: the `spec-008` amendment for `memory add`'s token option (`dl-107` Action 2), and the
   `release-publishing.yaml` `publish` phase gaining the npm approval step (`dl-087` Action 3). The
   npm facts were copied into `dl-068` Action 4 as `dl-087` Action 5 asks.
   **Gate passed 2026-09-29** (steps 4 and 5): `adr-011` accepted (`cdf286d4`), and `adr-009`'s
   revision note added in the commit after this revision; the approver signed off the `spec-015`,
   `spec-001` and `spec-010` amendments as committed (`0a4f7a9c`, `0f68c739`, `289300a5`, fixed in
   `33d89b7c`). The specs carry no state change: they stay `approved`. Next: build-backlog (step 6),
   on the approver's go.
6. **build-backlog** (product-owner, no gate). Tasks `task-109…`, tagged `v0.2.2`, `add → submit`
   `[draft → pending]`, grouped by §6.8 step so the dev-loop respects its order (`depends_on`,
   `dl-015`): step 1 (`bug-137`; `dl-094`'s `.mailmap` if the ruling needs one), step 2 (`bug-075`,
   `dl-107`, `dl-095`, `dl-026`), step 3 (`dl-087` + `bug-136`), step 4 (`dl-088`), step 5 (`dl-091` +
   `dl-093` metadata; **the slug sweep after the approver's transfer to `wingfoil/wingfoil`**, planned
   below in *Visibility session outcome* §C, before the publish; `bug-138`, `bug-139`, `bug-140`,
   `bug-128`, `bug-129`; `bug-021`; `dl-123` edge then `bug-092`; `dl-096` vision re-baseline). The
   selected bugs go `bug.set_state(planned)` `[triaged → planned]`. `release: "v0.2.2"` is stamped on
   `bug-021`, `bug-075`, `bug-092`, `bug-128`, `bug-129`, `bug-136` (from `v0.3`, approver ruling
   2026-09-29) and `dl-026`, and on every ADR, spec and task this phase creates. The build-backlog also carries
   the two follow-ups identify-specs deferred (the `spec-008` token option, `dl-107` Action 2; the
   npm approval step in `release-publishing.yaml`, `dl-087` Action 3).
   **Done 2026-09-29**:
   - `wf(task): add` (`80849b18`) and `submit` (`a9ed8e1a`) of `task-109` … `task-121`, all `pending`;
   - eight bugs `[triaged → planned]` with `release: v0.2.2` (`8da0abfb`);
   - `bug-021`, `bug-092` (`2715b7bc`) and `dl-026` (`dfc09f9d`) stamped `v0.2.2`.

   Mapping, budget and the in-scope elements with no task are in `patch-v0.2.2`'s Planning notes.
   The `spec-008` amendment is inside `task-110`, and the `release-publishing.yaml` step is inside
   `task-113`. **`bug-021` re-read on the approver's request (2026-09-29).** The retrospective's
   "downgraded, closure with no code" does not hold, because its Expected Behavior needs a change to
   `jest.config.js`. The re-read also found a second `index.ts` holding logic, `src/mcp/index.ts`.
   So `task-122` was added (`25b32681` add, `a02efdc6` submit), and `bug-021` went
   `[triaged → planned]` (`f225f5b6`). The backlog is **14 tasks**, `task-109` … `task-122`.
7. **commit-backlog** (tech-lead, ⛔). `memory.approve` every task `[pending → backlog]`;
   `patch-v0.2.2` `[planning → in-development]`.

## Approver inputs received (2026-09-29)

- **npm (for `dl-087`).** On npmjs.com the `wingfoil` package has one granular token, created
  2026-09-28, never used, expiring 2026-12-27: read and write, **stage only**, on `wingfoil` alone, no
  organisation access. **Account 2FA is disabled.** Two gaps against `dl-087` as ratified
  (`7b1b1e82`: Q1 (B), Q2 (iii)), for the approver at identify-specs (gate 5):
  - Q1 (B) is OIDC trusted publishing with no long-lived token; the configured credential is Q1 (A),
    a stage-only token. Either `dl-087`'s ruling is revised to (A), or the trusted publisher is
    configured on npmjs.com and the token revoked before step 3.
  - Q2 (iii) keeps two human gates, the second being npm 2FA on `npm stage approve`. With 2FA
    disabled that gate does not exist; only the GitHub environment reviewer remains.
  The token's expiry precedes npm's January 2027 removal of direct publish, so it covers v0.2.2 either
  way.
  **npm documentation, read 2026-09-29** (settles part of `dl-087` Action 5; to be copied into
  `dl-068` Action 4 at identify-specs):
  - `https://docs.npmjs.com/trusted-publishers`: a GitHub Actions trusted publisher is keyed on
    organisation or user, repository, workflow filename and optional environment; it can be limited to
    staged publishing ("stage-only"), so Q1 (B) exists as `dl-087` describes it. It needs npm ≥ 11.5.1
    and Node ≥ 22.14.0, `id-token: write`, and generates provenance automatically. After setup npm
    recommends "Require two-factor authentication and disallow tokens". The page says nothing about a
    repository transfer, so the publisher is configured against `wingfoil/wingfoil` after the transfer.
  - `https://docs.npmjs.com/staged-publishing`: 2FA on the account is a **prerequisite**; `npm stage
    publish` does not prompt for it, but approving does, in the CLI or on npmjs.com. So with 2FA off no
    staged release can be approved at all, under Q1 (A) or (B). It needs npm ≥ 11.15.0 and Node ≥
    22.14.0 (`dl-087` Q3 (a)). Whether `npm stage publish` accepts `--access public` and
    `--provenance` is not documented there, and stays open. It is recorded here and not in the repository: no token value was given or stored.
- **Budget (for `dl-096`).** Derived from the measured velocity, not set by hand. `dl-096` Q1 (a)
  keeps budgets in the vision documents only, so no field is added to `patch-v0.2.2`. At
  build-backlog the budget is computed as *tasks ÷ 6.5 per active day* (v0.1 6.6, v0.2 6.3,
  `retrospective-rel-v0.2-plan` §6.9), recorded in `patch-v0.2.2`'s Planning notes next to
  `dl-096`'s proxy of ≈ 4 active days, and carried into `07_sequencer.md` by `dl-096`'s own task.

## External identities registered, pending the `service` type

`dl-088`'s `service` type arrives in §6.8 step 4. Until then the identities the approver reserves are
recorded here, with the date and the account used, and each becomes a `service` element there
(`dl-091` Actions):

| Identity | Created | Account | Verified by |
|---|---|---|---|
| GitHub organisation `wingfoil` | 2026-09-29 11:05 UTC | `robypomper` (GitHub) | `https://api.github.com/orgs/wingfoil` → `created_at: 2026-09-29T11:05:14Z` |
| npm organisation `wingfoilhq` | 2026-09-29 | `robypomper` (npm) | `https://registry.npmjs.org/-/org/wingfoilhq/package` → 200 |
| `wingfoil.dev`, `wingfoilhq.dev`, Bluesky | **after v0.3** (`dl-091` addendum, D7) | — | — |
| `wingfoilhq` on X, LinkedIn, Mastodon, YouTube | not yet; the approver checks at signup | — | — |

## Visibility session outcome (2026-09-29)

The project-visibility session handed back what it did after its planning was absorbed by the v0.2
retrospective (§6.7): the approver's external actions and decisions, each with its dated source. The
approver chose on 2026-09-29 to integrate it here rather than revive that withdrawn plan
(`decision-log-ingest-rel-v0.3-visibility-plan`, which exists only on the withdrawn branch). External
checks are **not repeated**. The evidence below is the session's, with its dates, except where a row
says this session read it.

### A. Execution Notes of the visibility planning's stages 3 and 5

**Stage 3 — name check → DL-N (2026-09-28/29).** DL-N is `dl-091`. Its facts and ratified answers
are in `dl-091` (`4283ca65`, `f5927f93`, approve `a4e80e11`). The session's own findings and the
approver's later decisions went into its addendum (`1405a700`):
- the brand stays WingFoil (D3), positioning "Intent" (D4);
- the organisation `wingfoil` and the repository transfer happen last (D5);
- `@wingfoilhq` is the npm scope, because `@wingfoil` is wingfoil-io's (D6);
- the domains wait until after v0.3 (D7);
- wingfoil-io's "deterministic" positioning, and the trademark residual risk.

Stage 4 (DL-P) is `dl-092`, ratified `864d8bdf`.

**Stage 5 — external steps (2026-09-29).** The order was identities → repository settings →
directory claims → metrics baseline. Done by the approver:
- the GitHub organisation `wingfoil` and the npm organisation `wingfoilhq`, both from the
  `robypomper` account;
- the repository settings of §B.3, applied by hand in the web interface.

Directory claims did not happen: the MCP Registry entry needs the transfer and `dl-093`'s `mcpName`
first. The metrics baseline was read on 2026-09-29 and is recorded in `dl-130`'s Context
(`2f3f14ee`). It is DL-F's baseline, next to the first reading of 2026-09-28,
whose view count differs. The session also proposed declaring the repository's settings as code (a
`.github/repository.yml` with a drift check). The approver declined it on 2026-09-29, and no
decision-log was filed: **no repository settings as code in the project**.

### B. `service` candidates — registered through `service-ingest` once `dl-088` is implemented (§6.8 step 4)

Each is `add → submit`, and the approver approves after running `verify`. None carries a secret
value.

1. **GitHub organisation `wingfoil`.**
   - provider GitHub · kind `account` · owner_role `approver` · account `robypomper` (owner) ·
     renews `""` (free plan) · url `https://github.com/wingfoil` · created 2026-09-29.
   - verify: `gh api orgs/wingfoil --jq .login` → `wingfoil`.
   - Purpose: owner of the canonical repository, the MCP namespace `io.github.wingfoil`, and Pages.
   - Settings the session recommended, for the approver to confirm as applied: profile name
     "WingFoil" with the category line; require 2FA; base permission "No permission".
2. **npm organisation `wingfoilhq`.**
   - provider npmjs.com · kind `account` · owner_role `approver` · account `robypomper` (owner) ·
     renews `""` (free, unlimited public packages) · url `https://www.npmjs.com/org/wingfoilhq` ·
     created 2026-09-29.
   - verify: `curl -s https://registry.npmjs.org/-/org/wingfoilhq/package` → HTTP 200 `{}`, read by
     the session and by this one on 2026-09-29.
   - Purpose: the scope for future auxiliary packages; the main package stays the unscoped `wingfoil`.
3. **The GitHub repository's settings** (`robypomper/wingfoil`, then `wingfoil/wingfoil`).
   - provider GitHub · kind `setting` · owner_role `approver` · applied by hand 2026-09-29.
   - verify: `gh api repos/<owner>/wingfoil --jq '{description,homepage,topics,has_discussions,has_wiki,has_projects}'`.
     The session read every value below through the GitHub MCP on 2026-09-29, and all matched:
     - description: "The repo-native intent layer for AI-native software engineering — keeps intent
       and engineering state in git, turns them into workflows, verifies what agents deliver.
       CLI + MCP.";
     - homepage `https://www.npmjs.com/package/wingfoil`, until a domain exists;
     - 14 topics: `ai-agents`, `ai-assisted-development`, `claude-code`, `cli`,
       `context-engineering`, `determinism`, `developer-tools`, `git`, `intent-engineering`, `mcp`,
       `mcp-server`, `model-context-protocol`, `spec-driven-development`, `typescript`;
     - Discussions on, Issues on, Wiki off, Projects off; public; MIT;
     - Discussions categories Announcements, Q&A, Ideas, Show and tell (General and Polls deleted;
       the approver's report);
     - no social preview (`dl-128`).
   - This element is the only record of the settings: they are not declared as code (approver
     ruling, 2026-09-29).
4. **Backfill already listed in `dl-088` Actions.** The npm package `wingfoil`, the `npm-publish`
   environment and the repository's visibility, all unchanged by the session. The `NPM_TOKEN` secret
   is recorded only if it still exists when the type lands: `adr-011` removes it.

### C. The slug change — planned before the v0.2.2 publish

The transfer `robypomper/wingfoil → wingfoil/wingfoil` is the approver's last identity step (D5), and
it must land **before** the v0.2.2 publish, because npm provenance checks `repository.url` against the
repository that builds the package. build-backlog derives one task for it, in §6.8 step 5, which
depends on the transfer. The task:

- **changes the slug** in `package.json` (`repository.url`, `homepage`, `bugs.url`) and in
  `test/cli/publish-metadata.test.ts` (`REPO_SLUG`). These are the two files `dl-091` Q3 step 3
  found. The task re-runs its `grep` rather than trusting the list;
- **checks `spec-015` §1 against the result.** The 2026-09-29 amendment (`0a4f7a9c`) already fixes
  `<owner>` as `wingfoil`. If the task finds anything in `spec-015` still naming `robypomper/wingfoil`,
  it amends it under the approver's sign-off in the same task;
- **leaves historical Memory documents citing the old slug unchanged**, because GitHub redirects;
- **after the transfer, re-checks** on `wingfoil/wingfoil`:
  - the `npm-publish` environment and its required reviewer;
  - the Actions secrets, where `adr-011` expects no `NPM_TOKEN`;
  - the Claude GitHub App installation on the `wingfoil` organisation;
  - the local remotes (`git remote set-url origin https://github.com/wingfoil/wingfoil.git`);
  - the trusted publisher on npmjs.com, keyed on `wingfoil/wingfoil` (`adr-011` point 2);
  - the repository's settings (§B.3).

### D. For `dl-093`'s metadata task (§6.8 step 5)

The session's keyword list adds `intent-engineering`, `context-engineering` and `developer-tools` to
`dl-093`'s list, and omits `workflow` and `governance`. `spec-015` §1 fixes a minimum and leaves the
exact list to the task. The task starts from the union, and the approver settles the list at review.
`mcpName` is `io.github.wingfoil/wingfoil` in both `package.json` and `server.json`, and the
`description` follows the category line (`spec-015` §1, §1a).

### E. After v0.3 — not planned here

Registering `wingfoil.dev` and `wingfoilhq.dev` (auto-renew, transfer lock, WHOIS privacy), each a
`service` with `renews`; the Pages custom domain; Bluesky `@wingfoil.dev`; the `wingfoilhq` social
handles; an optional EUIPO filing (`dl-091` addendum).

## Handoff

- **Approver:** gates 2–5 and 7, and the go-ahead to merge into `main`. Inputs needed before the
  gates they block: the MCP namespace and the new repository name (gate 3); the ruling on the two `dl-087`
  gaps above (gate 5).
- **Agent:** all authoring (this plan, `patch-v0.2.2`'s content, `dl-091`'s facts, any ADR or spec,
  the tasks), the non-gated define-scope and build-backlog mechanics, spec-review preparation, commit
  hygiene. It never approves.
- **Completion criteria:** `patch-v0.2.2` `in-development`; `dl-091` `ready`; `bug-094` `closed`;
  every selected bug `planned` with `release: v0.2.2`; every task `backlog`. **Stop at
  commit-backlog** — the dev-loop is the next phase, and its first tasks are §6.8 step 1.
- **The phases after this one** (`dl-092` Q2 (ii)): dev-loop → user-docs → e2e-smoke →
  release-submit → release-publishing. No `retrospective`: v0.2.2's findings fold into v0.3's.
