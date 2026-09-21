---
id: "dl-057-publish-pipeline-hardening"
type: decision-log
title: "Publish pipeline hardening left out of task-060/061: action SHA pins, job timeouts, Verdaccio SIGKILL fallback, annotated-tag enforcement, trusted publishing, shell tracing, explicit npm userconfig"
status: ready
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`task-060-publish-pipeline` (merged `117e95f`) built `.github/workflows/publish.yml` and
`scripts/publish-staging.cjs`; `task-061-publish-secrets` (branch `task/task-061-publish-secrets`,
`986e613`, not merged) wires `NPM_TOKEN` and the approver runbook. `task-061`'s design table explicitly
leaves five hardening items (a)–(e) out of scope and hands them back as proposed elements
(`git show 986e613:docs/self/docs/04_memory/v0.2/task-061-publish-secrets.md`, lines 166-170 and 291-292).
Its review added two more, (f) and (g). Each is verified below against `986e613` (read-only) — the
`publish.yml` facts hold on `main` too except where noted.

**(a) Actions are pinned to mutable major tags.** Every `uses:` is `@v4` — `actions/checkout`,
`actions/setup-node`, `actions/upload-artifact`, `actions/download-artifact`
(`git show 986e613:.github/workflows/publish.yml | grep -n 'uses:'` → lines 85, 89, 108, 118, 121, 124,
139, 142). The `promote` job (`:131-157`) holds `NPM_TOKEN` and `id-token: write`, and runs
`actions/setup-node@v4` and `actions/download-artifact@v4` — a retagged upstream release would execute
in the job that can publish. `task-061` declined to SHA-pin because resolving `@v4` to a commit "needs a
GitHub lookup this task may not make; a hand-typed SHA cannot be verified".

**(b) No job timeouts.** `grep -c timeout-minutes .github/workflows/publish.yml` → `0` on `main` and on
`986e613`. A hung Verdaccio start, npm install or an unanswered `npm-publish` environment approval runs
to GitHub's default job limit.

**(c) No SIGKILL fallback when stopping Verdaccio.** `git show 986e613:scripts/publish-staging.cjs`,
`stop()` at `:210-215` (same code on `main`): sends `SIGTERM` and awaits `exit` with no timeout. If the
child ignores or stalls on `SIGTERM`, the staging script never returns, and the teardown that follows
never runs.

**(d) The annotated-tag requirement is not enforced.** `spec-015` §4 (`:91`): "The publish trigger is an
annotated git tag `vX.Y.Z` created on `main`". The gate checks that the tag's commit is on `main` and that
its name matches `package.json` (`scripts/check-release-tag.cjs`, a pure string check on
`$GITHUB_REF_NAME`), not that it is annotated. Whether `actions/checkout@v4` preserves the annotated tag
object on a tag-push checkout — which a `git cat-file -t` check would need — **was not verified** (it
requires a real GitHub run); `task-061` gives the same reason for not adding the check.

**(e) Long-lived `NPM_TOKEN` vs npm trusted publishing (OIDC).** `spec-015` §5 specifies `NPM_TOKEN` in
the Actions secret store with a transient `.npmrc`; `task-061` implements it. Trusted publishing would
remove the long-lived token. Constraints, with their verification status:
- `adr-009` §5 (`:76`) keeps a token "for registries that still require one" — verified.
- The pipeline pins `NODE_VERSION: '22.12.0'` (`publish.yml:78`, forced by `commander@15`'s engines floor,
  `bug-023`) — verified. That Node 22.12.0 bundles npm 10.9, and that trusted publishing needs
  npm ≥ 11.5.1, are **not verified here** (no network; both come from the Wave 2 brief).
- Whether a package's first-ever publish can use trusted publishing, or needs a token because a trusted
  publisher is configured on an existing package — **unverified**.

**(f) Nothing prevents shell tracing in the promote publish step.** The step (`publish.yml:146-157` on
`986e613`) first tests `[ -z "${NPM_TOKEN:-}" ]`; with `set -x` (or `bash -x`) added anywhere before
it, bash prints that command with the token **expanded** into the job log. GitHub's secret masking is
then the only defence. `test/cli/publish-secrets.test.ts` asserts the `.npmrc` line, the checkout-free
job and the fake-npm run, but nothing about tracing (`git grep -n 'set -x\|xtrace' 986e613 -- test .github`
→ no output); the review reports that a mutation adding `set -x` left the suite green (not re-run here).

**(g) The transient `.npmrc` is found by working directory, not named.** The step writes `.npmrc` into
the current directory and runs `npm publish` there, relying on npm reading the project-level config.
npm locates the project config from the nearest ancestor containing a `package.json` or `node_modules`,
so a cwd `.npmrc` is ignored when such an ancestor exists. Checked locally (npm 11.6.2, not the pipeline's
npm): in a directory holding `.npmrc` with a test `registry=` line, beneath an ancestor with
`node_modules/` (and again with a parent `package.json`), `npm config get registry` → the default
registry; with `--userconfig ./.npmrc` → the test value. On the GitHub runner the `promote` job has no
checkout, so today no such ancestor is expected — this is robustness, not a live failure (the runner's
directory ancestry was not verified).

## Decision

*Approver to choose per item.*

- **(a)** 1. Pin every action to a full commit SHA with the version in a trailing comment, resolved by a
  verified lookup (recommended), at least in `promote`; 2. pin `promote` only; 3. keep `@v4` and rely on
  environment approval. Recommendation: **1**, done as a task with network access.
- **(b)** 1. `timeout-minutes` on every job, sized from the first real run (`dl-056`) (recommended);
  2. leave defaults.
- **(c)** 1. After `SIGTERM`, wait a bounded interval (e.g. 10 s) then `SIGKILL` (recommended); 2. leave
  as is and rely on (b)'s job timeout in CI — which does not help a local run.
- **(d)** 1. Verify checkout's behaviour on the first real tag run, then add a `git cat-file -t
  "refs/tags/$GITHUB_REF_NAME"` = `tag` check (fetching the tag explicitly if checkout replaces it);
  2. relax `spec-015` §4 to "a `vX.Y.Z` tag", dropping "annotated". Recommendation: decide after the
  first real run (`dl-056`); until then, prefer **2**'s honesty over an unverifiable check.
- **(e)** 1. Keep `NPM_TOKEN` for the first publish and **revisit after it** (recommended): check the
  npm version constraint, whether a trusted publisher can then be configured on the existing package,
  and whether the Node pin can move; 2. switch now (needs an npm upgrade step in `promote` and a
  verified first-publish path); 3. keep `NPM_TOKEN` indefinitely.
- **(f)** 1. Add a test that the promote publish step contains no `set -x` / `xtrace` / `bash -x`, and run
  the step's shell with tracing explicitly off (recommended); 2. rely on GitHub masking.
- **(g)** 1. Pass the file explicitly — `npm publish … --userconfig "$PWD/.npmrc"` or
  `NPM_CONFIG_USERCONFIG` — and assert it in the fake-npm test (recommended); 2. leave the cwd lookup.

## Rationale

- (a), (e), (f) and (g) bear directly on the job that holds the publish credential; (b)–(d) are
  robustness and spec-conformance items whose cost is a stuck or mis-triggered release.
- Several answers depend on facts only a real run can establish (checkout's tag handling, realistic job
  durations, first-publish requirements), which is why they are sequenced after `dl-056`'s dry run
  rather than guessed now.

## Actions

- Owner **approver**: choose per item.
- Raise one hardening task for the chosen (a)–(c), (f) and (g) items, after `task-061` merges (it edits
  the same file); schedule (d) and (e) as follow-ups to the first real publishing run (`dl-056`).
- If (d).2: amend `spec-015` §4 with a dated Revision note (`dl-047`).

Related: `dl-056` (first real publishing run), `dl-052` (Verdaccio in CI), `adr-009` §5, `spec-015` §4/§5,
`task-060-publish-pipeline`, `task-061-publish-secrets`, `bug-023`.
