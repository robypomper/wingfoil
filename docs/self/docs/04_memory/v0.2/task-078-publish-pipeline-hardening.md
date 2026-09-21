---
id: "task-078-publish-pipeline-hardening"
type: task
title: "Publish-pipeline hardening (dl-057 a, c, f, g): SHA-pin the actions, bound Verdaccio's SIGTERM, forbid shell tracing in promote, name the npm config file explicitly"
status: in-review
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

### design — role: architect

Branch `task/task-078-publish-pipeline-hardening`, worktree
`/home/robypomper/Workspaces/.wf2-wt/task-078-publish-pipeline-hardening`, cut from `main` at
**`a7d783a`** (`git log --oneline -1 main` → `a7d783a wf(adr): deprecate adr-005-typescript-node-stack`).
`npm ci --prefer-offline --no-audit --no-fund` → exit 0, a real install (`bug-043` closed), not a
reuse of the parent tree's `node_modules`.

**Scope confirmed against `dl-057` (`status: ready`) and its approve commit `0924712`.** The commit
body ratifies option 1 on (a), (c), (f), (g) and closes with: "(a), (c), (f) and (g) do not [depend on
`dl-056`'s first real run] and can land before it." Items (b), (d), (e) are out of scope here — see
AC12, and the "Excluded, on purpose" note in the review summary.

**`read_related` (`dl-015`, hard gate).** `depends_on: []` — nothing to acknowledge. Read anyway
because they own the same two files: `dl-057` in full + `0924712`; `task-061-publish-secrets`'s
Execution Notes, whose hand-over table states the reason (a) was deferred ("resolving `@v4` to a commit
SHA needs a GitHub lookup this task may not make; a hand-typed SHA cannot be verified and a wrong one
breaks or redirects the job holding the token — should land with a verified lookup") and the reason (c)
was deferred ("spec-015 §3 staging-script robustness … no credential involved"). Both are discharged
here, (a) by the verified lookup below. `task-077-first-real-staging-run` is `status: backlog` at
`a7d783a` and runs `act` against these same two files concurrently; coordination, not dependency — it
reports the pipeline as it stands, this branch does not affect its run.

**`verify_specs`.** No new `tech-spec` needed. `spec-015` §3/§5 (`approved`) and `adr-009` §5
(`accepted`) already specify the staging flow and the transient-`.npmrc` publish this task hardens;
nothing here changes what they prescribe — (a), (c), (f), (g) are robustness inside the shapes they
already fix. The one spec edit `dl-057` foresees is (d)'s amendment of `spec-015` §4, ratified as
"decide after the first real run" and explicitly out of scope (AC12).

**Verified action-SHA lookup (AC2).** Two independent methods, run today, agreeing exactly. Nothing was
recalled or hand-typed.

1. `git ls-remote https://github.com/actions/<repo> 'refs/tags/v4*'` — anonymous, no credentials.
   No `refs/tags/v4^{}` peel line appears for any of the four, so each `v4` is a *lightweight* tag
   pointing straight at a commit (the only peeled tag in the whole listing is
   `actions/download-artifact` `refs/tags/v4.1.1^{}`, which is not used here).
2. `gh api repos/actions/<repo>/git/ref/tags/<ref> --jq '.object.type + .object.sha'` for both the `v4`
   alias and the exact version tag, plus `gh api repos/actions/<repo>/commits/v4` to confirm the object
   really is a commit. All read-only GETs.

| `uses:` | pinned SHA | `= refs/tags/` | object type | the `@v4` it replaces resolved to the same SHA |
|---|---|---|---|---|
| `actions/checkout` | `11d5960a326750d5838078e36cf38b85af677262` | `v4.4.0` | commit | yes |
| `actions/setup-node` | `49933ea5288caeca8642d1e84afbd3f7d6820020` | `v4.4.0` | commit | yes |
| `actions/upload-artifact` | `ea165f8d65b6e75b540449e92b4886f43607fa02` | `v4.6.2` | commit | yes |
| `actions/download-artifact` | `d3f86a106a0bac45b974a628896c90dbdf5c8093` | `v4.3.0` | commit | yes |

Because each pinned SHA is *exactly* what `@v4` resolves to today, this pin changes no behaviour — it
only freezes the behaviour the pipeline already has. All eight `uses:` lines are pinned, not just
`promote`'s two: the ratification sets `promote` as the minimum, and there is no reason to leave the
job that builds and stages the artifact `promote` then publishes on a mutable tag.

**AC3 — how a reader checks a pin later, and what enforces it.** To check one line has not drifted from
its comment: `git ls-remote https://github.com/actions/checkout refs/tags/v4.4.0` and compare, or
`gh api repos/actions/checkout/git/ref/tags/v4.4.0 --jq .object.sha`. **Nothing in this repository
enforces the pin or the comment.** No test asserts the SHA form, no CI step re-resolves the tags, and
Dependabot is not configured (`ls .github/` → `workflows/` only). The trailing `# v4.4.0` comment is
documentation for a human, and a wrong comment would not fail anything. That is stated rather than
implied, and AC3 forbids adding an enforcement gate here — it would be new surface no decision has
authorised. What *does* still hold: `publish-pipeline.test.ts` and `publish-secrets.test.ts` locate
steps by `s.uses?.startsWith('actions/<name>@')`, so mangling the action *name* half of any pinned line
breaks the suite; the SHA half is unasserted.

**T1 — acceptance-criterion classification** (`dl-014` T1, `testing` directive).

| AC | Class | Evidence / test |
|---|---|---|
| 1 (a) every `uses:` a full SHA + version comment | **characterization (no new test — AC3)** | AC3 forbids a new enforcement gate, so this AC is discharged by the edit plus the recorded lookup, not by an assertion. Existing `startsWith('actions/…@')` lookups in both publish suites keep passing over the pinned lines. |
| 2 (a) verified lookup, recorded | **n/a — evidence, not behaviour** | the two-method transcript above; network was available (`git ls-remote` exit 0), so the stop-and-report fallback did not trigger. |
| 3 (a) pin verifiable afterwards | **n/a — documentation** | the paragraph above, including the plain statement that nothing enforces it. |
| 4 (c) `stop()` escalates to SIGKILL and always resolves | **red-first** | `publish-staging.test.ts` › "escalates to SIGKILL when the child ignores SIGTERM, and still resolves" — no `stopProcess` export exists, so the import itself fails before the edit. |
| 5 (c) both call sites still behave; no new latency on a clean run | **characterization** | `publish-staging.test.ts` › "resolves as soon as a well-behaved child exits, without waiting out the interval" (passes on today's logic too, once the function is extracted) + the existing orchestration cases that assert `stopRegistry` runs on every teardown path. |
| 6 (f) test forbids `set -x` / `xtrace` / `bash -x` in the promote publish step | **characterization, proven by mutation** | `publish-secrets.test.ts` › "runs the publish step with no shell tracing …". The step contains no tracing today, so this assertion passes on first run — a genuine red would have to be fabricated. AC6 asks for the mutation instead: add `set -x`, watch it go red, remove it. Recorded under `red`. |
| 7 (f) the step's shell runs with tracing explicitly off | **red-first** | same case, second half: `expect(firstLine).toBe('set +x')`. Fails today (the first line is `if [ -z "${NPM_TOKEN:-}" ]; then`). |
| 8 (g) step names its npm config file explicitly | **red-first** | `publish-secrets.test.ts` › "names the transient .npmrc explicitly …" — `--userconfig` is absent today. |
| 9 (g) fake-npm test asserts it | **red-first** | same case: the recorded argv must carry `--userconfig <abs>/.npmrc`; the fake `npm` records `$*`, which today has no such flag. |
| 10 token never on disk / in a log | **characterization** | the three existing fake-npm cases (`npmrc-seen` equals the literal `${NPM_TOKEN}` line, `.npmrc` removed on success and on failure) must keep passing unchanged. |
| 11 gates green | **characterization** | the six gate commands, run and pasted under `refactor`. |
| 12 (b)/(d)/(e) excluded | **n/a — documentation** | recorded in the review summary so their absence is not read as an oversight. |

**Design choices to be made explicit (they are decisions, not mechanics):**

- **(c) interval — 10 s, and where the constant lives.** `dl-057` offers 10 s "as an example, not a
  requirement" (AC4). Kept at 10 s: it is an order of magnitude above a healthy Verdaccio's SIGTERM
  shutdown and two orders below the 60 s `REGISTRY_START_TIMEOUT_MS` this file already uses, so the
  escalation can never fire before the start timeout it may be called from. Exposed as
  `REGISTRY_STOP_TIMEOUT_MS`, overridable per call so the test can drive it in milliseconds instead of
  sleeping for 10 s (determinism: no wall-clock dependence in the assertion).
- **(c) shape.** The `stop` closure at `:210-215` is lifted to a module-level, exported `stopProcess`
  so a test can drive the *real* code (AC4's "the smallest extractable piece of it") rather than a
  re-implementation. `startRegistry` then just binds it.
- **(f) mechanism — `set +x` as the step's first line.** GitHub's default `shell: bash` already runs
  `bash --noprofile --norc -eo pipefail {0}`, so no rc file can turn tracing on; `set +x` closes the
  remaining route, an `xtrace` inherited through the environment (`SHELLOPTS=xtrace`), before the
  first command that mentions `NPM_TOKEN`. **Routes it does not close, stated plainly:** a future
  editor adding `shell: bash -x` to the step, or `defaults.run.shell` at workflow/job level — so the
  test asserts the absence of both as well as of `set -x` in the body. And the one line that *could*
  still be traced under an inherited `xtrace` is `set +x` itself, which mentions no secret.
- **(g) `--userconfig "$PWD/.npmrc"` rather than `NPM_CONFIG_USERCONFIG`.** Both are ratified. The flag
  keeps the whole contract on one visible line that the existing fake-npm harness already records
  (`$*`), whereas the env var would need the harness to record the environment as well; and it cannot
  be silently dropped by the `env:` block that carries the secret. `$PWD` is used, not a relative path,
  because the point of the item is to stop depending on how npm resolves a path against its own cwd.

### red — role: developer

Commit `452efe6 test(cli): …`. Two suites widened, no new file.

Observed red — `npx jest test/cli/publish-secrets.test.ts test/cli/publish-staging.test.ts` →
`Tests: 8 failed, 33 passed, 41 total`. Reasons, per AC:

- AC4/AC5 (c), five cases: `TypeError: (0 , publish_staging_cjs_1.stopProcess) is not a function` —
  the export does not exist; and `expect(REGISTRY_STOP_TIMEOUT_MS).toBe(10000)` →
  `Received: undefined`.
- AC7 (f): "turns tracing off explicitly as its very first command" →
  `Expected: "set +x" / Received: "if [ -z \"${NPM_TOKEN:-}\" ]; then"`.
- AC8 (g): "names that .npmrc explicitly on the publish command" →
  `Expected substring: "--userconfig \"$PWD/.npmrc\""` against the unmodified step body.
- AC9 (g): the fake-npm case, `--userconfig <abs>/.npmrc` absent from the recorded argv.

Passing at red, by design — the five `carries no <tracing form>` cases (AC6). The step contains no
tracing today, so these are **characterization**: a red would have to be fabricated. AC6 asks for a
mutation instead, below.

**AC6 mutation proof.** `set -x` was added to the promote publish step, the tracing cases re-run, and
the file restored (`git diff --stat .github/workflows/publish.yml` → empty after each). Run at `red`
and again after the `main` merge (the merge touched no code — `git show --stat 7074786` lists only
`CLAUDE.md`, `01_product-brief.md`, `dna.yaml`, `dl-001` and the new `task-079` file):

| mutation injected into the step | `npx jest test/cli/publish-secrets.test.ts -t 'carries no'` |
|---|---|
| *(none — the committed file)* | `16 skipped, 5 passed` |
| `set -x` | `1 failed, 16 skipped, 4 passed` |
| `set -euxo pipefail` | `1 failed, 16 skipped, 4 passed` |
| `set -o xtrace` | `2 failed, 16 skipped, 3 passed` |
| `bash -x ./x.sh` | `1 failed, 16 skipped, 4 passed` |
| `export SHELLOPTS=xtrace` | `2 failed, 16 skipped, 3 passed` (run at `red`) |

The `set -euxo pipefail` row is the reason the pattern is
`set\s+-[a-zA-Z]*x[a-zA-Z]*(\s|$)` and not `…x\b`: the first draft of the test, written before the
mutations were run, used `\b` and **missed** `-euxo` — tracing hidden inside a short-option cluster,
which is how it would most plausibly arrive. Caught by running the mutation rather than by reading the
regex; the pattern was widened at `red`, before any production edit.

### green — role: developer

Commit `5261607 feat(cli): …`. `npx jest test/cli/publish-secrets.test.ts test/cli/publish-staging.test.ts
test/cli/publish-pipeline.test.ts` → `Test Suites: 3 passed, Tests: 56 passed`.

- **(a)** eight `uses:` lines rewritten to `@<40-char sha> # <tag>` using the table in `design`.
- **(c)** `stopProcess(child, {hasExited, timeoutMs, killGraceMs})` added at module level and exported;
  `startRegistry`'s closure becomes `const stop = () => stopProcess(child, { hasExited: () => exited })`.
  SIGTERM → `REGISTRY_STOP_TIMEOUT_MS` (10 s) → SIGKILL → `SIGKILL_GRACE_MS` (2 s) → resolve regardless.
  Both timers are `unref()`ed and cleared when `exit` arrives first, so a healthy stop is as immediate
  as before (**AC5**). Both call sites are the same function: the start-timeout path
  (`publish-staging.cjs:218`, `await stop()` before throwing) and `runStaging`'s teardown (`:157`,
  `await registry.stop()`). They cannot double-stop — when `startRegistry` throws, `registry` is never
  assigned, so the `finally`'s `if (registry)` is false.
- **(f)** `set +x` is the step's first command; `NPM_TOKEN` is first named on the line after it.
- **(g)** `--userconfig "$PWD/.npmrc"` appended to the publish command; the `.npmrc` write, the
  `trap 'rm -f .npmrc' EXIT` and the unexpanded `${NPM_TOKEN}` reference are byte-identical to before
  (`git diff main...HEAD -- .github/workflows/publish.yml` shows those three lines unchanged) — **AC8**.

**Reverse mutation for (c) — AC4's "fails if the escalation is removed".** With the `setTimeout`
escalation block replaced by `void timeoutMs; void killGraceMs;`:
`npx jest test/cli/publish-staging.test.ts -t 'stopProcess'` → `Tests: 2 failed, 15 skipped, 3 passed`
("escalates to SIGKILL when the child ignores SIGTERM" and "resolves even for a child that never exits
at all"). Restored → `15 skipped, 5 passed`.

### refactor — role: developer

Commit `d9753fd refactor(cli): …`.

- `publish.yml` header gains a "Pinned actions and the promote step's shell" section: the two
  re-resolution commands, the plain statement that nothing enforces the pin, and why the step disables
  xtrace and names its config file — **AC3** and **AC7** answered where a reader of the pipeline will
  look, not only here.
- One shared-config line: `clearTimeout: 'readonly'` added beside the `setTimeout: 'readonly'` already
  allowed for `scripts/**/*.cjs` in `eslint.config.js`. `npm run lint` fails without it
  (`scripts/publish-staging.cjs 197:18 error 'clearTimeout' is not defined no-undef`) — that globals
  list is an explicit allowlist, and `stopProcess` clears its escalation timer when the child exits
  first. The alternative, leaving stray timers to fire against an already-reaped child, was rejected.
- One rephrasing forced by an existing assertion: the header names the publish-secrets suite as "the
  publish-secrets suite under `test/cli/`" rather than by full filename, because
  `publish-secrets.test.ts:52` scans this file's **raw text** for `/secrets\.[A-Za-z_]+/g` and the
  filename itself matches `secrets.test`. Writing it out first turned that case red
  (`Received: ["secrets.test", "secrets.NPM_TOKEN"]`). Noted as a proposed element — the assertion is
  correct in intent but matches prose, not only workflow expressions.

### review-ready summary — role: developer → reviewer

**Scope delivered: `dl-057` items (a), (c), (f), (g), all ratified option 1 in approve commit `0924712`.**

| Item | What landed | Where |
|---|---|---|
| (a) | all 8 `uses:` pinned to a verified full commit SHA + version comment | `.github/workflows/publish.yml` |
| (c) | `stopProcess`: SIGTERM → 10 s → SIGKILL → 2 s → resolve, always | `scripts/publish-staging.cjs`, `.d.cts` |
| (f) | `set +x` first; five tracing forms asserted absent, plus no `shell:` override | `publish.yml`, `test/cli/publish-secrets.test.ts` |
| (g) | `--userconfig "$PWD/.npmrc"`, asserted against the recording fake `npm` | same two files |

**Excluded, on purpose — their absence is not an oversight** (AC12, and the same three items the
ratification sequences *after* the first real run):

- **(b) `timeout-minutes` on every job** — ratified option 1 is "sized from the first real run
  (`dl-056`)". That sizing input does not exist yet: `task-077-first-real-staging-run` is producing it
  while this task runs. Left to v0.3 release-planning with `task-077`'s timings as input. Note (b)
  would not have helped item (c) anyway: a job timeout is a CI construct and the hang (c) closes is a
  *local* one, which is exactly the argument the approve commit gives for doing (c) separately.
- **(d) the annotated-tag requirement** — ratified option **2 for now** (relax `spec-015` §4 to "a
  `vX.Y.Z` tag"), revisited once a real run shows what `actions/checkout` does with an annotated tag on
  a tag-push checkout. Neither the check nor the spec amendment is done here; the amendment edits an
  `approved` tech-spec and needs a dated Revision note (`dl-047`), a separate act.
- **(e) trusted publishing (OIDC)** — ratified option 1: keep `NPM_TOKEN` for the first publish and
  revisit after it. A decision to do **nothing now**, recorded so it is not read as forgotten.

**Nothing was published, pushed, tagged, or sent to a registry, and no GitHub setting was touched.**
Every lookup was a read-only `git ls-remote` / `gh api` GET against public `actions/*` repositories.
The suite remains offline: the `stopProcess` cases drive `node -e` children that open no socket, and
the promote-step cases run the real step body against the recording fake `npm` already in place since
`task-061`.

**Secret-scan self-check (`dl-036`, `spec-007`).** Every file this branch touches, scanned with the
repository's own `scanText`, after `npm run build`:

```
node -e "const {scanText}=require('./dist/validation/secret-scan.js'); …"
.github/workflows/publish.yml                    blocking=0 warn=0 info=
scripts/publish-staging.cjs                      blocking=0 warn=0 info=
scripts/publish-staging.d.cts                    blocking=0 warn=0 info=
test/cli/publish-secrets.test.ts                 blocking=0 warn=0 info=generic-api-key-assignment:placeholder-value
test/cli/publish-staging.test.ts                 blocking=0 warn=0 info=
eslint.config.js                                 blocking=0 warn=0 info=
docs/…/task-078-publish-pipeline-hardening.md    blocking=0 warn=0 info=
SCAN CLEAN (0 blocking across 7 files)
```

The single `info` is `task-061`'s pre-existing `FAKE_TOKEN = 'XXXXXXXXXXXXXXXXXXXX'`, exempted as
`placeholder-value` by `spec-007` §3, not a line this task wrote. No token — real or
realistic-looking — appears anywhere on the branch.

**AC10 — the token still never reaches disk or a log.** Re-confirmed, not assumed: the three
pre-existing fake-npm cases still pass unchanged (`publish-secrets.test.ts:122` — the `.npmrc` npm saw
equals the literal `//registry.npmjs.org/:_authToken=${NPM_TOKEN}` line, not a value; `.npmrc` removed
after success and after a failing publish). `git diff main...HEAD -- .github/workflows/publish.yml`
shows the `printf` line untouched. The new `set +x` strengthens the same property on the log side.

**Sync with `main`.** `git merge main` (`7074786`) at `ba2cad0` — clean, no conflicts. It carried
`CLAUDE.md`, `01_product-brief.md`, `dna.yaml`, `dl-001` and the new `task-079-spec-015-staging-and-
node-floor-corrections` (`status: backlog`). Re-read after merging: `task-079` amends `spec-015` §1 and
§3 only (the Node floor caveat and stage 2's Verdaccio description); it does not touch §4 or §5, which
are the sections these notes cite, and it is documentation-only, so no sentence above went stale. All
gates were re-run after the merge; the numbers below are the post-merge ones.

**BDD acceptance.** `grep -rln 'publish\|npm' docs/02_requirements/02_bdd/features/` finds no `.feature`
scenario for the publishing pipeline: `spec-015`/`adr-009`/`REQ-SYS-09` are its contract, as they were
for `task-059`/`060`/`061`. The asserting suites are `test/cli/publish-secrets.test.ts`,
`test/cli/publish-staging.test.ts` and `test/cli/publish-pipeline.test.ts`.

**Gates — post-merge, in the worktree** (`/home/robypomper/Workspaces/.wf2-wt/task-078-publish-pipeline-hardening`):

| Command | Result |
|---|---|
| `npx jest` | `Test Suites: 100 passed, 100 total · Tests: 1605 passed, 1605 total` |
| `npx jest --coverage` | `All files 98.54 % stmts · 92.3 % branch · 98.76 % funcs · 99.15 % lines` (≥ 80, non-regressing) |
| `npx tsc -p tsconfig.build.json --noEmit` | exit 0, no output |
| `npx tsc --noEmit -p tsconfig.json` | exit 2 — **only** `test/core/directive-create.test.ts(159,19): error TS2339`, the pre-existing `bug-026` error, untouched |
| `npm run lint` | exit 0 (`lint.clean`) |
| `npm run docs:api` | exit 0 (`docs.api.*`) |

`npm ci --prefer-offline --no-audit --no-fund` → exit 0 at the start of the run: a real install into a
fresh worktree, `bug-043` being closed.

**Known weak spots a reviewer should check.**

1. **Nothing enforces the pins** (AC3, stated rather than implied). The SHA and its `# vX.Y.Z` comment
   can drift apart silently; `ls -A .github/` → `workflows` only, so there is no Dependabot to keep
   them honest. AC3 forbids adding an enforcement gate here. A reviewer who wants one should file it,
   not expect it.
2. **The `set +x` line itself could still be traced** if a future editor sets `SHELLOPTS=xtrace` in the
   runner environment — bash would echo that one line before disabling tracing. It names no secret, so
   the exposure is nil, but the guarantee is "nothing after line 1", not "nothing at all".
3. **`--userconfig` was not exercised against a real npm.** The fake `npm` records the flag; that the
   flag makes npm read that file is `dl-057`'s locally verified finding (npm 11.6.2), not something this
   branch re-proved. The first real publish is the check.
4. **Timing in two `stopProcess` cases.** They drive real child processes with a 250 ms escalation and a
   30 s one. Neither asserts on a clock — the deaf-child case asserts the exit *signal* is `SIGKILL` and
   the well-behaved one that it is `SIGTERM`, which is what "did not wait out the interval" means here —
   but they do spawn processes, so a pathologically loaded machine could in principle flip the first.
   The two fake-child cases that cover "always resolves" use no real process and no real clock.
