---
id: "task-061-publish-secrets"
type: task
title: "Publish secrets: CI secret store + rollback posture (dl-018 T4)"
status: in-progress
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
| AC1 | `NPM_TOKEN` from the Actions secret store only, transient `.npmrc` at publish time, never committed | red-first | `grep -n "NPM_TOKEN\|npmrc" .github/workflows/publish.yml` → only the header comment "NOT wired here"; `grep -n npmrc .gitignore` → no match |
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
