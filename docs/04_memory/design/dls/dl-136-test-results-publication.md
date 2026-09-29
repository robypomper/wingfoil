---
id: dl-136-test-results-publication
type: decision-log
title: "A release publishes a tarball and keeps no test results or coverage, so its quality claims cannot be checked afterwards — every release publishes the results of each suite and the coverage, produced by the CI run on the tag"
status: in-discussion
context: "planning"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed during v0.3 `release-planning`, from the approver ruling of 2026-09-29, v0.3 release-planning
(`release-planning-rel-v0.3-plan` R6): at the end of each release, the results of every test suite
(unit, integration, BDD, smoke) and the coverage are published.

**What a release keeps today: the tarball, and nothing else.**

- `publish.yml` has three jobs, `gate`, `stage` and `promote` (`.github/workflows/publish.yml:143,176,194`).
  It uploads one artifact: `grep -c upload-artifact .github/workflows/publish.yml` → `1`, the
  tarball (`publish.yml:170-174`, `name: ${{ env.TARBALL_ARTIFACT }}`, `path: dist-pack/*.tgz`).
- The `gate` job runs `npm run prepublishOnly` (`publish.yml:162-163`), which is
  `npm run build && npm test && npm run lint` (`package.json:35`), and `npm test` is plain `jest`
  (`package.json:40`). The CI run on the tag therefore **measures no coverage**: coverage runs only
  under `npm run test:coverage` (`jest --coverage`, `package.json:41`), and `jest.config.js:66-73`'s
  80% threshold applies only then.
- The staging smoke (`dl-023`) runs in the `stage` job (`publish.yml:191-192`); its output exists only
  in that run's log.
- The one GitHub Release, `v0.2.1`, carries no asset: `gh release list -R robypomper/wingfoil | wc -l`
  → `1`; `gh release view v0.2.1 --json assets -q '.assets|length'` → `0`. `v0.2.2` has no Release.
- None of the release workflows declares an output: `grep -c produces
  .wingfoil/workflows/custom/{e2e-smoke,release-submit,release-publishing}.yaml` → `0` for each.
  `release-submit`'s `pre-release-checks` asserts `tests.passing` and `tests.coverage(min: 80)`
  (`release-submit.yaml:19-23`) and leaves no evidence that it did.

So `07_sequencer.md`'s release criteria such as "✓ >80% test coverage on all modules"
(`docs/01_vision/07_sequencer.md:413`) are claimed at every release and verifiable at none.

**What the suites are, as the repository has them.** There is one runner, Jest 30 (`npx jest
--version` → `30.4.1`), and one run:

- `find test -name "*.test.ts" | wc -l` → `161` test files; `find test -name
  "*.integration.test.ts" | wc -l` → `15` of them are integration tests by name;
- BDD scenarios are Jest tests that cite their feature file: `grep -rln "02_bdd/features" test | wc
  -l` → `26`. There is no separate BDD runner (`grep -n cucumber package.json` → nothing);
- the CLI smoke is `test/cli/e2e-smoke.test.ts`, and the staging smoke is `npm run publish:staging`
  in CI;
- the API-docs and lint gates are Jest tests too: `test/docs/api-docs.test.ts`
  (`npm run docs:api`, `package.json:39`) and `test/lint/lint-clean.test.ts` (`npm run lint`).

"Per-suite results" therefore means one Jest run classified by a declared rule, not separate
runners.

**What is available without a new dependency.**

- Jest's own `--json --outputFile` writes the full results as JSON (`npx jest --help`).
- Coverage reporters come with Jest's istanbul reporters; `ls node_modules/istanbul-reports/lib`
  lists `json-summary`, `lcov`, `lcovonly`, `cobertura` and `text-summary` among others.
  `jest.config.js` sets no `coverageReporters` (`grep -c coverageReporters jest.config.js` → `0`), so
  Jest's defaults apply. A local `npx jest --coverage` on `main` leaves `lcov.info` (108K),
  `coverage-final.json` (680K) and `lcov-report/` (3.8M) (`du -sh coverage/*`).
- JUnit XML is **not** built in: `grep -rli junit node_modules/@jest/reporters/build` → nothing, and
  no `jest-junit` is installed (`ls node_modules | grep -iE "jest-junit"` → nothing).

**What must be fixed first.** `bug-141-coverage-omits-unrequired-source-files` (`triaged`, v0.3):
because `jest.config.js:4` sets `roots: ['<rootDir>/test']`, a `src/` file no test loads is absent
from the report instead of reported at 0%. A published coverage figure would be computed over a
denominator that silently excludes such files.

## Decision

Every release publishes the results of its test suites and its coverage. They are produced from the
CI run on the release tag, classified per suite by a declared rule, and each release's
`CHANGELOG.md` section links them.

What is published, at minimum:

- **Results**, one Jest run, classified into **unit**, **integration** (`*.integration.test.ts`),
  **BDD** (test files citing `docs/02_requirements/02_bdd/features/`), **smoke/e2e**
  (`test/cli/e2e-smoke.test.ts` and the `stage` job's staging smoke), and the **API-docs** and
  **`lint.clean`** gates; each with counts of passed, failed and skipped.
- **Coverage**: `coverage-summary.json` (`json-summary` reporter) and `lcov.info`.
- **A Markdown summary**: one table per suite plus the coverage totals, the commit, the tag, the CI
  run URL and the build (`dl-111`).

`bug-141` is fixed before the first release that publishes coverage.

**Q1 — where the reports are published.**
- **(a) GitHub Release assets** of the tag (`dl-130` step 1). Light on the repository; readable only
  through GitHub, never from a clone.
- **(b) Files in the repository**, e.g. `docs/reports/<version>/`. Versioned, readable from any clone
  and servable by an MCP Resource (today's Resources serve only DNA, Memory and workflows,
  `src/mcp/index.ts:11-14`); every release adds its reports to the history for good (`lcov.info`
  alone is 108K per run).
- **(c) Both:** the Markdown summary and `coverage-summary.json` in the repository, the full results
  and `lcov.info` as Release assets.

**Q2 — the machine-readable results format.**
- **(a) Jest's own JSON** (`--json --outputFile`). No new dependency.
- **(b) JUnit XML** through `jest-junit`, a new devDependency. Read by most CI dashboards.
  `dl-010-minimal-dependencies` limits production dependencies; a devDependency is "never installed
  by a consumer of the published package" (`package.json:63`), but it is still supply-chain surface
  in the pipeline that publishes.

**Q3 — which build produces them.**
- **(a) The CI run on the tag.** Tied to the published commit and to the tarball `promote` publishes;
  `gate` must run `jest --coverage` instead of plain `npm test`.
- **(b) A local run by the approver.** No pipeline change; not reproducible, and not demonstrably
  from the published commit.

**Q4 — which phase owns them.**
- **(a) `release-submit` produces them** as the evidence for its `approve-release` gate, and
  **`release-publishing` attaches** the tag run's reports once the tag exists.
- **(b) `release-publishing` only**: produced and attached after the tag.

**Recommendation: Q1 (c), Q2 (a), Q3 (a), Q4 (a).**

- **Q1 (c)** keeps what a reader needs, the summary and the totals, in the repository, where
  `dl-089`'s release-health comparison and an agent can read it from a clone. The heavy files go where
  they cost the history nothing.
- **Q2 (a)** needs no dependency and loses nothing: the JSON carries every assertion. JUnit XML can
  be added later if a consumer asks for it.
- **Q3 (a)** makes the reports describe the published artifact rather than a working tree. The
  candidate run inside `release-submit` uses the same commands, so the two are comparable.
- **Q4 (a)** turns `release-submit`'s `tests.passing` / `tests.coverage(min: 80)` from a check that
  leaves no trace into one with evidence the approver reads before approving. The tag run then
  confirms it on the published commit.

## Rationale

- **A quality claim nobody can check afterwards is not a claim.** Every release criterion about tests
  and coverage is asserted at approval time and lost after it. Published reports make each release's
  claim checkable by a user, a contributor or the next retrospective.
- **They are `dl-089`'s input data.** Its quality catalogue already measures coverage per release
  (Q03, Q04, `dl-089-release-health-analyses-before-retrospective.md:211-212`) by rerunning the suite.
  Published reports let it read the numbers of the published commit instead of recomputing them.
- **They are the `produces:` the release workflows lack** (`bug-134`), and the evidence `dl-099`'s
  per-candidate gates need to leave behind.
- **Per-run process conformance fits the same summary.** The Determinism Index's process component,
  in `dl-131-determinism-index-scope`, is measured on every run; the release
  summary is where its per-release figure can be reported alongside the tests.
- **Trade-off.** The `gate` job gets slower by the coverage instrumentation, and the classification
  rule must be kept in step with test naming. Both are cheaper than a release whose quality cannot be
  read back.

Alternatives considered:
- **Publish only a coverage badge.** Rejected: one number, no per-suite result, no evidence of which
  commit it describes.
- **Split into separate Jest projects per suite.** Deferred: it changes how the suite runs in order to
  change how it is reported. Classifying one run gives the same table without touching the tests.

## Actions

1. **Ratify, choosing Q1–Q4.** Owner: approver. The choice goes in the approve commit's `Reason:`.
2. **Fix `bug-141` first**; the task that publishes coverage `depends_on` its fix task (`dl-015`).
3. **`jest.config.js`** gains `coverageReporters` including `json-summary` and `lcov`; a script
   writes the per-suite classification and the Markdown summary from Jest's JSON (no new dependency
   under Q2 (a)).
4. **`publish.yml`**: under Q3 (a), `gate` runs the suite with coverage and `--json`, and uploads the
   reports as a second artifact; the release job of `dl-130` Q1 (a) attaches them to the GitHub
   Release. `spec-015-packaging-publishing` §3 is amended with it.
5. **`.wingfoil/workflows/custom/release-submit.yaml`** (`pre-release-checks`) declares the reports
   under `produces:`; **`release-publishing.yaml`** declares the attached assets and, under Q1 (b) or
   (c), the committed summary; **`e2e-smoke.yaml`** declares its smoke report (`bug-134`). Each
   `version` is bumped.
6. **`docs/01_vision/07_sequencer.md`** release criteria that name coverage point to the published
   summary; `doc-versioning` bump.
7. Tasks are derived by v0.3 `release-planning` (`build-backlog`), not created here.

## Relations

- **Origin:** approver ruling, 2026-09-29, v0.3 release-planning (`release-planning-rel-v0.3-plan`
  R6).
- **Depends on:** `bug-141-coverage-omits-unrequired-source-files` (`triaged`, v0.3);
  `dl-130-visibility-steps-in-the-release-flow` (`ready`, v0.3), whose step 1 creates the GitHub
  Release the assets attach to.
- **Amends, on ratification:** `publish.yml`, `release-submit.yaml`, `release-publishing.yaml`,
  `jest.config.js`, `spec-015` §3.
- **Related:**
  - `bug-134-e2e-smoke-yaml-declares-no-produces` (`triaged`, `release: ""`, to be stamped v0.3 at
    build-backlog per the plan), whose missing report is one of these;
  - `dl-089-release-health-analyses-before-retrospective` (`ready`, v0.3), which consumes them;
  - `dl-099-release-gates-run-on-every-candidate-on-a-fresh-project` (`ready`, v0.3), whose gates
    produce part of them;
  - `dl-023-init-cli-e2e-smoke-gate` (the smoke-test report it asked for);
  - `dl-131-determinism-index-scope`, process component;
  - `dl-010-minimal-dependencies` (Q2).
- **Traceability:** `REQ-SYS-09` (distribution as an npm package); `REQ-SEC-02` (complete,
  attributable audit trail); the >80% coverage target (`docs/01_vision/01_product-brief.md:270`) and
  the release criteria that repeat it (`docs/01_vision/07_sequencer.md:371,384,399,413`).
