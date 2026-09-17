---
id: "task-061-publish-secrets"
type: task
title: "Publish secrets: CI secret store + rollback posture (dl-018 T4)"
status: in-progress
rejection_reason: "All six ACs are implemented and each has a test that goes red under mutation: the literal .npmrc written from a promote-only secret and removed on success and failure, the empty-token check, the npm-publish environment, the approver runbook and rollback docs, the dl-036 promotion with its escape hatch proven by the directive's own examples, and bug-015's index reading, including renames, symlinks, conflict stages and odd filenames. Gates are green, coverage does not regress, and it merges cleanly with main and the parallel branches. It is rejected for one false claim in the Execution Notes: test/validation/secret-scan.test.ts is said to scan to 23 blocking with 4 new fixture lines, but at HEAD it scans to 24 with 5, because df9797a added one and the note was not updated. Correct the count and resubmit. The dotenv regex gap (bug-037), publish hardening (dl-057), the trusted-publishing decision (dl-057 item e) and the spec-007 ignore-path inconsistency are filed separately."
release: "v0.2"
priority: "High"
tags: ["v0.2", "release"]
ref: "dl-018-release-publishing-strategy"
bug: ["bug-015-scan-reads-worktree-not-index"]
depends_on: ["task-060-publish-pipeline"]
tmpl_version: 260703
---

## Description

Deliver **dl-018 T4**: wire the registry token as a CI secret (never committed) and document the human approval/rollback steps. Implements `spec-015` §5.

## Acceptance Criteria

Per `spec-015` §5 + `security-secrets`/`spec-007`:
- `NPM_TOKEN` in the GitHub Actions secret store only; transient `.npmrc` at publish time; never committed.
- Document the `approver` (Roberto) providing/rotating the secret + authorizing the tagged release (`adr-006`).
- Rollback posture: prefer `npm deprecate` + patch over `npm unpublish`; failed staging smoke blocks promotion.


**`dl-036` — promoted secret patterns + the escape hatch (assigned by `dl-036`, ratified option 1
per-pattern).** This task already cites `spec-007` and is the task that writes `NPM_TOKEN` handling
into documentation, i.e. the most likely tripper of the pattern being promoted. It therefore owns:

1. **Land the promotion in code.** `jwt-like` and `dotenv-style-secret-line` move `warn → block` in
   `src/validation/secret-scan.ts` to match the amended `spec-007` §2; `generic-high-entropy-string`
   stays `warn`. Widen `task-043`'s REQ-SEC-08 Fit-Criterion test to assert the newly-blocking set.
2. **Ship the escape hatch with the promotion, not after it.** No `.wingfoil/security-ignore` exists
   today, so the first author to trip a false positive has to discover `spec-007` §3 from the spec.
   Seed the file, or document the fence-marker/placeholder hatch where an author writing a memory
   document will meet it. `dl-036` makes this part of the decision rather than a follow-up.

Beware the self-reference: this task's own `.env`-style examples are written into a scanned surface
(`docs/self/docs/04_memory/`), so it must use the §3 hatch on its own documentation or it will fail
the gate it is landing.

**`bug-015` — guard the scanner against a staged deletion before a gate consumes it.**
`scanProjectSurface` builds its file list from `listTrackedFiles`, which enumerates the **git index**,
then reads each path with `readFileSync`, which reads the **working tree**. A path tracked in the index
but absent from disk throws `ENOENT` and takes the whole scan down instead of reporting.

Harmless in a clean checkout, which is why it survived two review passes of `task-043`. It stops being
harmless at the call site the scanner exists for — a commit-time or pre-publish gate runs against a
working tree where staged deletions are ordinary, and this task is the one wiring secret handling into
the publish path. Decide the contract deliberately while you are here: either the scanner reports on
**what is committed** (read blobs via `git show :path`), or on **what is on disk at tracked paths**
(current behaviour, plus an existence guard) — and say which in the TSDoc. `task-043`'s Fit-Criterion
test also calls its surface "this repository's own **committed** surface", which is only true under the
first reading. `bug-015` needs closing by hand — no `bug:` back-reference.
## Implementation Notes

Source: `dl-018` T4; contract `spec-015` §5; requirement REQ-SYS-09/REQ-SEC-08. Depends on the pipeline (`task-060`).

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### design — role: architect

Branch `task/task-061-publish-secrets`, worktree `/home/robypomper/Workspaces/.wf2-wt/task-061-publish-secrets`
(from `main` @ `8a6a091`; `git merge-base --is-ancestor 117e95f main` → true, so task-060's merge is in).
`start` committed `4cfbcd5` (task `backlog → in-progress`) and `b67be05` (`bug-015` `planned → in-progress`,
`bug.sync_state`, dl-045 absorbed bug).

**`agent.read_related` (`dl-015`, HARD gate) — acknowledged.**

- `task-060-publish-pipeline` Execution Notes read in full (design → review-ready summary), plus its
  approve commit body (`git show 39209d7`). Obligations that land here:
  - design decision 7 / review item 4: promote carries **no auth** (a real tag push fails `ENEEDAUTH`)
    and **no** GitHub `environment:` approval gate — "task-061's call". Both are closed below.
  - `publish-pipeline.test.ts` › "carries no registry credential — the token wiring is spec-015 §5
    (task-061)" asserts `NPM_TOKEN` is absent from the whole workflow. It was written to be narrowed
    by this task; it becomes "gate and stage carry no credential".
  - `publish-staging.cjs` already scrubs `NPM_TOKEN`/`NODE_AUTH_TOKEN` from the staging env
    (`publish-staging.test.ts:113-121`), so a CI secret cannot reach Verdaccio — nothing to add there.
  - approve body: "§5 is untouched and still feasible"; hardening items were handed to this task by
    the orchestrator (evaluated below).
- `task-059-publish-metadata` "Handoff to task-060 / task-061": `publishConfig.registry` is prod only
  (`https://registry.npmjs.org/`, read in `package.json`) — the transient `.npmrc` scopes the token to
  exactly that host; "No `NPM_TOKEN`, no `.npmrc`" shipped by 059 — confirmed
  (`publish-metadata.test.ts:133` asserts `NPM_TOKEN` absent from `package.json`; stays true).
- `bug-022` (read — not mine: this task adds no `npm pack`), `bug-023` (read — not mine; it still must
  land before the first real publish, and the approver runbook written here says so).

**Governance acknowledged.** `adr-009` (accepted) §4–§5: provenance via OIDC, "any npm automation token
(for registries that still require one) lives only in the GitHub Actions secret store", approver
provides/rotates it and authorizes the tagged release (`adr-006`). `spec-015` (approved) §5 is this task;
§1–§4 are done. `spec-007` (approved) §2 already carries `jwt-like`/`dotenv-style-secret-line` at
`severity: block` (dl-036 note in its YAML); `src/validation/secret-scan.ts` still has both at `warn`
(read above) — the code lags the spec. `dl-036` (ready): option 1 per-pattern, escape hatch shipped with
the promotion. `dl-045` (ready): `bug:` is a list; `bug-015` absorbed here, synced at start/submit.

**`agent.verify_specs` — no new tech-spec; design passes through.** spec-015 §5 names every artefact
(`NPM_TOKEN`, transient `.npmrc` line, rollback posture); spec-007 §2/§3/§4 cover the scanner.
BDD: `grep -rlniE "secret|npm_token|npmrc|publish" docs/02_requirements/02_bdd/features/` → no match.

**Trusted publishing (OIDC) vs `NPM_TOKEN` — §5 kept, not stopped on.** npm trusted publishing would
remove the long-lived token entirely, but (a) adr-009 §5 explicitly keeps a token "for registries that
still require one"; (b) CI pins Node 22.12.0, whose bundled npm (10.9 per the orchestrator's brief — not
checkable offline here) predates trusted publishing (npm ≥ 11.5.1); (c) `wingfoil` has never been
published, and to my knowledge a trusted publisher is configured on an existing package, so the first
publish needs a token regardless — unverified offline, which is why it goes to the approver as a
proposed decision-log rather than being asserted here. §5 as written is feasible and is implemented.

**bug-015 — contract decided: the scanner reports on the git index (what the next commit would
contain).** spec-007 §1 defines the surface as "tracked or staged" files and §4 step 5 names a
pre-commit/pre-publish gate as the consumer: for that caller the content that matters is the staged
blob, not a working-tree edit that will not be committed. So `scanProjectSurface` enumerates **and
reads** the index (`git ls-files -s` for blob ids, one `git cat-file --batch` for contents) — a single
source, so a path deleted on disk but still indexed is scanned from its blob, a staged deletion is simply
not listed, and an unstaged clean edit cannot hide a staged secret. TSDoc and the Fit-Criterion
`describe` title are corrected to say "indexed" rather than "committed".

**T1 — acceptance-criteria classification.**

| # | AC | Class | Evidence (command run at design) |
|---|---|---|---|
| AC1 | `NPM_TOKEN` from the Actions secret store only, transient `.npmrc` at publish time, never committed | red-first | `grep -n "NPM_TOKEN\|npmrc" .github/workflows/publish.yml` → one hit, line 13, the header comment deferring the `.npmrc` to task-061 (no `NPM_TOKEN` at all); `grep -n npmrc .gitignore` → no match |
| AC2 | document approver providing/rotating the secret + authorizing the tagged release (`adr-006`) | red-first | `grep -niE "rotat\|environment" .github/workflows/publish.yml` → no match; promote has no `environment:` |
| AC3 | rollback: `npm deprecate` + patch over `npm unpublish`; failed staging smoke blocks promotion | split: **rollback doc red-first** (`grep -n deprecate .github/workflows/publish.yml` → no match) / **smoke-blocks-promotion characterization** — already true: `promote.needs: stage` and `publish-staging.cjs` exits non-zero on smoke failure (both asserted by task-060's suites) |
| AC4 | dl-036.1: `jwt-like`, `dotenv-style-secret-line` `warn → block` in code; widen the REQ-SEC-08 Fit-Criterion test | red-first | `secret-scan.ts` declares both `severity: 'warn'` (read above) |
| AC5 | dl-036.2: escape hatch discoverable where a memory author meets it | red-first | `grep -rn "example -->" docs/self/.wingfoil/directives` → no match; no `security-ignore` anywhere (`git ls-files \| grep security-ignore` → empty) |
| AC6 | bug-015: staged/on-disk divergence does not throw; contract stated in TSDoc | red-first | the bug's repro; red test below |

**Design decisions (architect).**

1. **Promote auth = one step.** `NPM_TOKEN` is mapped from `secrets.NPM_TOKEN` into the `env:` of the
   single promote publish step (not job- or workflow-level, never gate/stage). That step fails fast if
   the variable is empty, writes `$GITHUB_WORKSPACE/.npmrc` containing the **literal**
   `//registry.npmjs.org/:_authToken=${NPM_TOKEN}` (single-quoted, so the shell does not expand it — npm
   expands it at read time, and the token value never touches disk), removes it on exit via `trap`, and
   publishes. Promote has no `actions/checkout`, so there is no git tree the file could be committed
   from; `.npmrc` is also added to `.gitignore` so a developer's project-level token file cannot be
   committed either. Offline probe that npm reads a project `.npmrc` from a directory with no
   `package.json` and expands `${VAR}`: in an empty scratch dir,
   `printf '%s\n' 'init-author-name=${PROBE_VAR}' > .npmrc && PROBE_VAR=expanded-ok npm config get init-author-name`
   → `expanded-ok`; `npm config ls -l` → `; "project" config from …/npmrc-probe/.npmrc` (npm 11.6.2 —
   CI's npm 10.9 not checkable offline).
2. **Approval gate = protected environment `npm-publish` on promote.** The YAML reference is in scope;
   creating/protecting the environment and storing the secret are **approver actions in GitHub settings**
   (forbidden to this task) and are documented as a runbook in the workflow header: required reviewer =
   the approver, deployment branch/tag rule `v*`, `NPM_TOKEN` stored as an **environment** secret so only
   a job that passed the approval can read it (environment secrets are part of the Actions secret store,
   so §5's wording holds). Caveat recorded: GitHub creates a referenced-but-missing environment with no
   protection, so until the approver configures it the gate is nominal — the runbook says so.
3. **Rollback runbook** in the same header: `npm deprecate wingfoil@<bad> "<reason>"` + a patch release
   through the normal tag flow; `npm unpublish` not used; a failed stage job blocks promote.
4. **dl-036 escape hatch documented in the global `security-secrets` directive** (auto-loaded for every
   role, i.e. every author of a memory document), with worked examples that are themselves scanned —
   they must pass the gate they describe. The ignore-list hatch is documented as a root
   `.wingfoil/security-ignore`; no root `.wingfoil/` is created (CLAUDE.md §3), see proposed element.

**Hardening items handed over from task-060's review — evaluated.**

| Item | Verdict | Reason |
|---|---|---|
| `persist-credentials: false` on checkout | **in scope — implement + test** | credential hygiene of the workflow this task puts a secret into; gate's `git fetch origin main` then runs unauthenticated (works for a public repo; fails closed otherwise) |
| protected `environment:` on promote | **in scope — implement + test** | it *is* §5's "approver authorizes the tagged release" (decision 2) |
| SHA-pin actions (at least promote) | **not in scope** | resolving `@v4` to a commit SHA needs a GitHub lookup this task may not make; a hand-typed SHA cannot be verified and a wrong one breaks or redirects the job holding the token — should land with a verified lookup |
| `timeout-minutes` on every job | **not in scope** | job-runtime robustness, not §5; no secret or authorization property depends on it |
| SIGKILL fallback in `publish-staging.cjs` `stop()` | **not in scope** | spec-015 §3 staging-script robustness (task-060's ground); no credential involved (the staging token is throwaway and scrubbed) |
| enforce §4 annotated tag | **not in scope** | §4 is done ground; and whether `actions/checkout` preserves an annotated tag object on a tag push cannot be verified offline — an unverified check could fail the first real release |
| trusted publishing vs `NPM_TOKEN` | **approver decision, §5 kept** | see above |

### red — role: developer

Commit `6a3b02f test(validation): …`. New suite `test/cli/publish-secrets.test.ts` (12); widened
`test/validation/secret-scan.test.ts`; `publish-pipeline.test.ts` › "carries no registry credential"
narrowed to gate + stage (task-060 wrote it to be narrowed here).

Observed red — `npx jest test/validation/secret-scan.test.ts` → `Tests: 9 failed, 35 passed, 44 total`;
`npx jest test/cli/publish-secrets.test.ts test/cli/publish-pipeline.test.ts` →
`Tests: 10 failed, 17 passed, 27 total`. Reasons, per AC:

- AC1: `maps secrets.NPM_TOKEN…` `Expected: {"NPM_TOKEN": "${{ secrets.NPM_TOKEN }}"} / Received: undefined`;
  `.npmrc line` / fake-npm run cases fail on the missing step script; `git check-ignore` exit 1;
  `persist-credentials` undefined. `fails before writing anything… when the secret is not configured`:
  `Expected: not 0` — today's step calls npm with no secret check.
- AC2/AC3 doc: `Expected: "npm-publish" / Received: undefined`; runbook/rollback regexes do not match.
- AC4: severity cases `Expected: "block" / Received: "warn"` (×2 patterns), the pinned blocking-set case.
- AC5: both directive cases (no `<!-- example -->` etc. in `security-secrets.md`).
- AC6 (bug-015): `ENOENT: no such file or directory, open '/tmp/wf-storage-…/.wingfoil/leaky.md'` at
  `secret-scan.ts:397` (`readFileSync`); the two staged-vs-unstaged cases fail on deep equality because
  the working tree was read.

Passing at red, by design (guards, not ACs forced red): `keeps the promote job checkout-free` (true since
task-060), `removes the .npmrc after a successful publish` (vacuous until a `.npmrc` is written — paired
with the "publishes … while the .npmrc exists" case), `does not list a staged deletion at all` (`git rm`
removes both index entry and file, so the old reader agreed), and the narrowed pipeline case.

### green — role: developer

Commit `fcd5142 feat(validation): …`.

- `src/validation/secret-scan.ts`: `jwt-like`, `dotenv-style-secret-line` → `severity: 'block'` (comment
  cites dl-036); `scanProjectSurface` lists **and reads** the index (`git ls-files -s -z` + one
  `git cat-file --batch`), contract written into its TSDoc (bug-015).
- `.github/workflows/publish.yml`: promote `environment: npm-publish`; the publish step maps
  `NPM_TOKEN` from `secrets.NPM_TOKEN` into its own env only, fails fast when empty, writes the literal
  spec-015 §5 line to `.npmrc` (single-quoted), `trap 'rm -f .npmrc' EXIT`, then task-060's unchanged
  `npm publish dist-pack/*.tgz --provenance --access public`; `persist-credentials: false` on both
  checkouts; header runbook (environment setup, provide/rotate/revoke, authorize, rollback) replaces
  the "NOT wired here" paragraph.
- `.gitignore`: `.npmrc` (the file had no trailing newline — the first append produced `.idea.npmrc`;
  caught by the `git check-ignore` case, fixed before commit).
- `docs/self/.wingfoil/directives/custom/security-secrets.md`: "The secret scan, and how to document a
  credential without tripping it" — the three §3 exclusions with worked examples. The placeholder
  example first sat indented under a list item and matched **nothing** (see proposed element on the
  dotenv regex), which the "only because they use the hatch" case caught; it is now at column 0.

Registry host check, not assumed: the token line is scoped to `registry.npmjs.org`; publishing a
*tarball* still honours the manifest's `publishConfig.registry` — npm 11.6.2 source
`/usr/local/lib/node_modules/npm/lib/commands/publish.js` `#getManifest` reads the manifest via pacote
for a non-directory spec and then `flatten(filteredPublishConfig, opts)`.

`npx jest` → `Test Suites: 86 passed, 86 total` / `Tests: 1162 passed, 1162 total`.

### refactor — role: developer

Commits `79c3d94 refactor(validation): … pair indexed paths with their blobs in
one reader; pin gitlink skip and missing-blob failure` and `df9797a refactor(validation): … parse index records
with one regex; pin the empty surface-root guard`. The new cases were mutation-checked, not just added:
disabling the gitlink skip → `git cat-file could not read the indexed blob of .wingfoil/vendored` (red);
deleting the `trap` line in `publish.yml` → the two `.npmrc`-removal cases fail; swapping the
single-quoted `.npmrc` line for a double-quoted one (shell-expanded token on disk) → the unexpanded-line
case and the fake-npm "never writing the token value" case fail. The first refactor alone dropped global
branch coverage below main (89.97 vs 90.18); the second removed the untaken destructuring defaults and
covered the empty-roots guard.

`git merge main` (`38512c8`, dl-035) brought task-055 only: `git diff --stat 8a6a091 9c83ca2` lists
`src/core/{context,directives-list,index}.ts`, their tests and task-055's file — nothing this task cites
(`spec-015`, `spec-007`, `dl-036`, `dl-045`, `bug-015`, `publish.yml`, the scanner), so no note needed
correcting.

**Gates (after the merge, from this worktree):**

| Gate | Command | Result |
|---|---|---|
| tests | `npx jest` | `Test Suites: 91 passed, 91 total` · `Tests: 1281 passed, 1281 total` |
| coverage | `npx jest --coverage` | `All files | 98.37 | 91.02 | 98.63 | 99.06`; `main` @ `5f286af` measured in a detached scratch worktree: `98.35 | 90.93 | 98.62 | 99.05` — non-regressing on all four |
| build types | `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| full types | `npx tsc --noEmit -p tsconfig.json` | only `test/core/directive-create.test.ts(159,19): error TS2339` (bug-026) |
| lint.clean | `npm run lint` | exit 0 |
| docs.api | `npm run docs:api` | exit 0 |

**`security-secrets` / spec-007 over this task's own files.** Re-run at this HEAD with a scratch script
that calls `scanText` per file and then `scanProjectSurface(process.cwd())`, both from
`dist/validation/secret-scan.js` (`node …/scan.cjs <the nine files>`) — its verbatim output:

```
.github/workflows/publish.yml: blocking=0 warnings=0 info=[]
.gitignore: blocking=0 warnings=0 info=[]
src/validation/secret-scan.ts: blocking=0 warnings=0 info=[]
test/cli/publish-pipeline.test.ts: blocking=0 warnings=0 info=[]
test/cli/publish-secrets.test.ts: blocking=0 warnings=0 info=[generic-api-key-assignment/placeholder-value]
test/validation/secret-scan.test.ts: blocking=24 warnings=1 info=[generic-api-key-assignment/placeholder-value]
docs/self/.wingfoil/directives/custom/security-secrets.md: blocking=0 warnings=0 info=[dotenv-style-secret-line/placeholder-value generic-api-key-assignment/fenced-example dotenv-style-secret-line/fenced-example]
docs/self/docs/04_memory/v0.2/task-061-publish-secrets.md: blocking=0 warnings=0 info=[]
docs/self/docs/04_memory/bugs/bug-015-scan-reads-worktree-not-index.md: blocking=0 warnings=0 info=[]
surface: filesScanned=248 blocking=0 warnings=0 info=3
```

The one `info` in `publish-secrets.test.ts` is the `XXXXXXXXXXXXXXXXXXXX` fake token; the three on the
surface are the directive's own worked examples. **Exception, stated plainly, with the count corrected
(the first-pass note said 23 blocking / 4 new fixture lines — stale: `df9797a` added a sixth fixture
line after that sentence was written, and the approver's reject was for exactly this):**
`test/validation/secret-scan.test.ts` scans to **24 blocking / 1 warning**. It is the scanner's own
fixture suite and must hold *detectable* fake shapes. `main`'s copy scans to **19 blocking / 1 warning**
under the same (promoted) pattern set — `git show main:test/validation/secret-scan.test.ts` piped through
the same `scanText`. The delta is exactly **5 added lines** plus **1 rename**, from
`git diff main...HEAD -- test/validation/secret-scan.test.ts | grep -E "^[+-]" | grep -E "sk_live_fake|NPM_TOKEN=|MY_TOKEN="`:
five added `api_key: "sk_live_fake…"` fixtures (the suite's existing fake literal, elided here so this
document does not itself trip the gate — spec-007 §3 placeholder hygiene) (bug-015's four staged-vs-worktree cases +
the empty-surface-roots case), and one dotenv fixture renamed `MY_TOKEN=` → `NPM_TOKEN=` (added and
removed, so it is not part of the +5). It is outside the scan surface; the spec-007 hatch meant for it
(`security-ignore`) is unreachable in this repository — filed on `main`, not re-proposed here.

### second pass — role: developer (after the approver's reject `8b53313`)

Rejected for one false claim only: the fixture-count sentence above (now corrected in place, with the
command and its output). Nothing else was changed in code, tests, workflow or directive — the reject
body records that all six ACs, their mutation-checked tests and the gates were verified as correct.

`git merge main` (`8c2c972`, dl-035 — merge, never rebase) brought task-045 (memory submit, including
bug-027's fix: `commitPaths` now commits with `git commit --only -- <paths>`), task-058, task-055 and the
wave-2 findings ingest (`bug-028..bug-041`, `dl-046..dl-060`). Re-read after the merge, for staleness:
`spec-015` §5, `spec-007` §2/§3, `adr-009` §5, `dl-036`, `dl-045` and `bug-015` are unchanged by it
— `git diff --name-status 9c83ca2 5f286af -- docs/self/docs/04_memory/design docs/self/.wingfoil .github scripts`
lists, apart from added `bug-*`/`dl-*` files, exactly three modifications: `dl-039`, `dl-040` and
`spec-006` (a one-line change), none of them cited here. So no sentence above needed correcting beyond
the count; `npm ci` was re-run and every gate re-run post-merge (table above is that run).

Findings this task raised are now filed on `main` and are **not** re-proposed: `bug-037` (the
`dotenv-style-secret-line` leading-prefix gap, plus spec-007 §2's stale `warn` note), `dl-057` (publish.yml
hardening a–g, including the trusted-publishing decision and `--userconfig`), `dl-056` (the first real
publishing run + `bug-022` inside the release gate).

### review-ready summary

`tests.bdd.run`: no BDD feature exists for this task — `grep -rlniE "secret|npm_token|npmrc|publish"
docs/02_requirements/02_bdd/features/` → no match. REQ-SEC-08's feature traceability points at
`P3.8-builtin-directive-templates.feature` (task-057's). Acceptance tests are the suites below.

| AC | Class | Test(s) |
|---|---|---|
| AC1 `NPM_TOKEN` secret store only, transient `.npmrc`, never committed | red-first | `publish-secrets.test.ts` › maps secrets.NPM_TOKEN into the promote publish step only; › writes the spec-015 §5 .npmrc line…; › keeps the promote job checkout-free…; › git-ignores .npmrc…; › does not persist the GitHub token into any checkout…; the four `promote publish step … executed with a fake npm` cases; `publish-pipeline.test.ts` › gate and stage carry no registry credential… |
| AC2 approver provides/rotates + authorizes the release | red-first | `publish-secrets.test.ts` › runs promote in the protected `npm-publish` environment…; › documents the approver runbook… |
| AC3 rollback posture | red-first (doc) + characterization (smoke blocks promote) | `publish-secrets.test.ts` › documents rollback as npm deprecate + a patch release…; `publish-pipeline.test.ts` › runs gate → stage → promote as a strict `needs` chain; `publish-staging.test.ts` › fails (exit 1) when smoke fails, and still tears down |
| AC4 dl-036 promotion + widened Fit Criterion | red-first | `secret-scan.test.ts` › classifies each pattern block/warn severity…; › blocks on a JWT-shaped string; › blocks on a .env-style credential line…; REQ-SEC-08 Fit Criterion › gates on the dl-036 blocking set… |
| AC5 escape hatch discoverable | red-first | `secret-scan.test.ts` › escape hatch documented… › names all three spec-007 §3 exclusions; › its own worked examples pass the scan only because they use the hatch |
| AC6 bug-015 index contract | red-first | `secret-scan.test.ts` › reads the git index, not the working tree (bug-015) — all 7 cases |

**For the reviewer / approver:**
1. **Nothing here has run against GitHub or npm.** The promote step's shell was executed with a fake
   `npm`; the `.npmrc` env expansion was probed with npm 11.6.2 only (CI's npm is 10.9 per the brief).
2. **The approval gate is nominal until the approver configures `npm-publish`** (required reviewer,
   `v*` tags, environment secret) — GitHub creates a missing referenced environment unprotected.
3. **`persist-credentials: false` on gate** makes its `git fetch --no-tags origin main` anonymous: fine
   for a public repository, fails closed for a private one.
4. **bug-015 contract changes observable behaviour:** unstaged edits are no longer scanned. That is the
   point for a commit/publish gate, but a caller wanting "what is on disk" now has no entry point.
5. **`.gitignore` gains `.npmrc`** — a future *non-secret* project `.npmrc` (e.g. `engine-strict`) would
   need an explicit un-ignore.
6. Trusted publishing, SHA-pinning, `timeout-minutes`, the staging `stop()` SIGKILL fallback and
   annotated-tag enforcement are **not** done here (design table) — they are filed on `main` as
   `dl-057` (and `dl-056` for the first real run), so nothing is left only in these notes.
