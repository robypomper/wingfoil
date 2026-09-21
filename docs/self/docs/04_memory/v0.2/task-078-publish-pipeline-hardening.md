---
id: "task-078-publish-pipeline-hardening"
type: task
title: "Publish-pipeline hardening (dl-057 a, c, f, g): SHA-pin the actions, bound Verdaccio's SIGTERM, forbid shell tracing in promote, name the npm config file explicitly"
status: backlog
release: "v0.2"
priority: "Medium"
tags: ["v0.2", "release", "security"]
ref: "dl-057-publish-pipeline-hardening"
bug: []
depends_on: []
tmpl_version: 260703
---

## Description

`dl-057-publish-pipeline-hardening` (`status: ready`, approve commit **`0924712`**) ratifies the
recommended option on every item (a)–(g). Four of them — **(a), (c), (f), (g)** — do not depend on the
first real staging run and are this task. The approve commit says so explicitly: "(a), (c), (f) and (g)
do not [depend on dl-056's first real run] and can land before it."

Each item below was re-verified against `main` at **`8f2bce8`** for this task, not copied from the DL.

**(a) Every action is pinned to a mutable major tag.** `grep -n 'uses:' .github/workflows/publish.yml`
→ `85, 89, 108, 118, 121, 124, 139, 142`, all `@v4` (`actions/checkout`, `actions/setup-node`,
`actions/upload-artifact`, `actions/download-artifact`). The `promote` job (`:131-157`) holds
`NPM_TOKEN` and `id-token: write`, and its two `uses:` are `:139` (`setup-node@v4`) and `:142`
(`download-artifact@v4`) — a retagged upstream release would execute inside the job that can publish.
Ratified option 1: pin every action to a full commit SHA with the version in a trailing comment,
resolved by a **verified lookup**, at least on `promote`.

**(c) Stopping Verdaccio has no SIGKILL fallback.** `scripts/publish-staging.cjs:210-215`:

```js
const stop = () =>
  new Promise((done) => {
    if (exited) return done();
    child.once('exit', () => done());
    child.kill('SIGTERM');
  });
```

No timeout. If the child ignores or stalls on `SIGTERM`, the promise never settles, the staging script
never returns, and the teardown that follows it never runs. `stop()` is reached both from the
start-timeout path (`:218`) and from `runStaging`'s teardown (`:157`). Ratified option 1: wait a bounded
interval (e.g. 10 s) after `SIGTERM`, then `SIGKILL`.

**(f) Nothing prevents shell tracing in the promote publish step.** The step (`publish.yml:146-157`)
first tests `[ -z "${NPM_TOKEN:-}" ]` with the secret already mapped into its `env` (`:148-149`). Under
`set -x` / `bash -x`, bash prints that command with the token **expanded** into the job log, leaving
GitHub's secret masking as the only defence. `grep -rn 'set -x\|xtrace\|bash -x' .github/ test/ scripts/`
→ no output, so nothing asserts its absence either. Ratified option 1: add a test that the step contains
no tracing, and run the step's shell with tracing explicitly off.

**(g) The transient `.npmrc` is found by working directory, not named.** `:155-157` writes `.npmrc`
into the current directory and runs `npm publish … --provenance --access public` there, relying on npm's
project-config lookup — which npm resolves from the nearest ancestor holding a `package.json` or
`node_modules`, so a cwd `.npmrc` is ignored when such an ancestor exists. `promote` has no checkout
today, so this is robustness rather than a live failure. Ratified option 1: pass the file explicitly
(`--userconfig "$PWD/.npmrc"` or `NPM_CONFIG_USERCONFIG`) and assert it in the fake-npm test
(`test/cli/publish-secrets.test.ts`, the `describe` at `:80`, which already runs the real step body
against a recording fake `npm`).

## Acceptance Criteria

1. **(a) Every `uses:` in `.github/workflows/publish.yml` names a full 40-character commit SHA, with the
   version in a trailing comment** — e.g. `uses: actions/checkout@<sha> # v4.2.2`. Minimum scope per the
   ratification is the `promote` job; pin all eight unless there is a stated reason not to.
2. **(a) Every SHA is resolved by a verified lookup, and the lookup is recorded.** For each action,
   record the command used and its output (e.g. `gh api repos/actions/checkout/git/ref/tags/v4.2.2`, or
   `git ls-remote https://github.com/actions/checkout refs/tags/v4.2.2`), and the tag the SHA
   corresponds to. **A hand-typed or recalled SHA is not acceptable** — that is the exact reason
   `task-061` declined this item. **This AC needs network access.** If the environment has none, do not
   guess and do not silently drop the item: stop, report, and leave (a) for a run that has network,
   landing (c), (f) and (g) on their own.
3. **(a) The pin is verifiable afterwards.** State how a reader checks a pin has not drifted from its
   comment, and whether anything in the repository enforces it. If nothing does, say so plainly rather
   than implying the comment is checked. Do not add a new enforcement gate here — that would be new
   surface no decision has authorised.
4. **(c) `stop()` in `scripts/publish-staging.cjs` escalates.** After `SIGTERM`, it waits a bounded
   interval and then sends `SIGKILL`, and it resolves in every case — including a child that never
   exits. Covered by a test that drives the real `stop()` (or the smallest extractable piece of it)
   against a process that ignores `SIGTERM`, and fails if the escalation is removed. State the interval
   chosen and why; `dl-057` suggests 10 s as an example, not a requirement.
5. **(c) Both call sites still behave.** `stop()` is reached from the start-timeout path
   (`publish-staging.cjs:218`) and from `runStaging`'s teardown (`:157`). Confirm the change is correct
   from both, and that a normal successful run does not now wait out the new interval.
6. **(f) A test asserts the promote publish step carries no shell tracing.** It reads the step's `run:`
   body out of `.github/workflows/publish.yml` and fails if it contains `set -x`, `set -o xtrace`,
   `bash -x` or an equivalent. Prove the test works by mutation: add `set -x` to the step, watch the
   test go red, remove it. Record the mutation and the red.
7. **(f) The step's shell runs with tracing explicitly off.** Make it explicit in the step itself, so a
   trace cannot be inherited from the runner's shell configuration. Say which mechanism was used and why
   it is sufficient; if the chosen mechanism cannot defeat every route to tracing, say which routes
   remain.
8. **(g) The promote publish step names its npm config file explicitly** — `--userconfig "$PWD/.npmrc"`
   or `NPM_CONFIG_USERCONFIG` — and the `.npmrc` write, the `trap 'rm -f .npmrc' EXIT` cleanup and the
   unexpanded `${NPM_TOKEN}` reference are all preserved unchanged.
9. **(g) The fake-npm test asserts it.** `test/cli/publish-secrets.test.ts` (the `describe` at `:80`)
   already records the fake `npm`'s argv and the `.npmrc` it saw; extend it so the config file is
   asserted to be passed explicitly, and so removing the explicit reference turns the test red. Its
   existing assertions — the token value never written to disk, `.npmrc` removed after success **and**
   after failure, publish with `--provenance` — must all still hold.
10. **The token still never reaches disk or a log in plaintext.** After every change, re-confirm the
    property the whole step exists for: the `.npmrc` on disk holds the literal
    `//registry.npmjs.org/:_authToken=${NPM_TOKEN}` reference, not the value
    (`test/cli/publish-secrets.test.ts:58`, `:122`). Say how that was re-confirmed.
11. **Gates green:** full Jest suite, coverage >80% and non-regressing, `tsc -p tsconfig.build.json`,
    `npm run docs:api`, `npm run lint` (`lint.clean`, `dl-034`).
12. **Out of scope, deliberately, and each for a recorded reason:**
    - **(b) `timeout-minutes` on every job** — ratified option 1 is "sized from the first real run
      (`dl-056`)". The sizing input does not exist until `task-077-first-real-staging-run` produces it.
      **Left to v0.3 release-planning**, with `task-077`'s timings as its input.
    - **(d) the annotated-tag requirement** — ratified option **2 for now** (relax `spec-015` §4 to "a
      `vX.Y.Z` tag", dropping "annotated"), with the decision to be revisited once it is known what
      `actions/checkout@v4` does with an annotated tag on a tag-push checkout — a fact only a real run
      establishes. **Left to v0.3 release-planning.** Note the spec amendment itself is also not done
      here: it edits an `approved` `tech-spec` and needs a dated Revision note (`dl-047`), which is a
      separate act.
    - **(e) trusted publishing (OIDC) instead of `NPM_TOKEN`** — ratified option 1 is "keep `NPM_TOKEN`
      for the first publish and revisit after it". That is a decision to do **nothing now**; it is named
      here so its absence is not read as an oversight.
    - Anything else in `publish.yml` or `publish-staging.cjs`. `task-077` is running against these two
      files in the same release and must report on the pipeline as it stands.

## Implementation Notes

Source: `dl-057-publish-pipeline-hardening`, `status: ready`, approve commit **`0924712`**, items
**(a), (c), (f), (g)** — the four the same commit sequences *before* `dl-056`'s first real run. The
requirement behind the chain is **REQ-SYS-09**; `adr-009` §5 and `spec-015` §4/§5 are the architecture
and spec this hardens. `ref: dl-057-…` follows the `task-059`/`060`/`061` precedent.

**Why one task and not two.** The four items are logically independent and only (a) needs network, which
is a genuine argument for splitting. It is outweighed by three things:

1. `dl-057`'s own ratified Action says "Raise **one** hardening task for the chosen (a)–(c), (f) and (g)
   items".
2. Three of the four — (a), (f), (g) — edit `.github/workflows/publish.yml`, and (f)+(g) edit the *same
   step* (`:146-157`). Two tasks would both rewrite that file and guarantee a rebase against each other,
   for no gain.
3. (a) is small once network is available: eight `uses:` lines and eight lookups. Making its network
   dependency an explicit AC with a stop-and-report fallback (AC2) surfaces the constraint in one place;
   splitting would hide it behind a task boundary and still leave (a) blocked.

If AC2's lookup turns out to be impossible in the execution environment, the correct outcome is to land
(c), (f), (g) and report (a) as blocked — not to invent SHAs, and not to quietly drop the item.

- **No `depends_on`.** This task does not wait on `task-077-first-real-staging-run` (the approve commit
  puts these four items before it), and not on `task-073` either — nothing here requires `npm ci`
  to work. Nothing else's Execution Notes constrain it (`dl-015`).
- **Coordination, not dependency:** `task-077` runs `act` against these two files. Whichever lands
  first, the other must say which version it observed — `task-077` AC6 requires it to report the
  pipeline as it stands, and this task's notes should record `main`'s SHA at the time of the edit.
- **`dl-057`'s Context has one stale statement**, recorded so the next reader does not chase it: it
  describes `task-061-publish-secrets` as "branch `task/task-061-publish-secrets`, `986e613`, not
  merged". `task-061` is `status: done` and its work is on `main`; `publish.yml`'s promote step and
  `test/cli/publish-secrets.test.ts` both exist there. That satisfies the DL's own precondition — "after
  `task-061` merges (it edits the same file)" — rather than contradicting it. All line references in
  this task are against `main` at `8f2bce8`, not against `986e613`.
- **`bug:` is empty.** These items came out of a task review as proposed hardening, not as filed
  defects; `dl-057` is the element that carries them and no `bug` document exists for any of (a), (c),
  (f) or (g). Nothing for `bug.sync_state` to drive.
- **Related:** `task-060-publish-pipeline`, `task-061-publish-secrets`, `task-077-first-real-staging-run`,
  `dl-056`, `dl-052` (Verdaccio started by the staging script), `adr-009` §5, `spec-015` §4/§5,
  `REQ-SEC-08` (credential hygiene — the property items (a), (f) and (g) protect at the pipeline edge).

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
