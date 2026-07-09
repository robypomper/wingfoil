---
id: "task-043-secret-credential-hygiene"
type: task
title: "Infrastructure: REQ-SEC-08 — secret/credential hygiene"
status: in-review
release: "v0.2"
priority: "High"
tags: ["v0.2", "security"]
ref: "REQ-SEC-08"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

Implement the Security constraint **REQ-SEC-08** (no secrets/credentials committed; validated on write).

## Acceptance Criteria

Satisfies the Fit Criterion for **REQ-SEC-08** in `docs/02_requirements/03_sard/05_security-compliance.md`.

## Implementation Notes

Aligns with `security-secrets` directive + `spec-007`; relevant to the v0.2 publish token handling (`spec-015` §5).

## Execution Notes

### design

- `depends_on: []` — no upstream task Execution Notes to read (`dl-015` gate is a no-op here).
- AC classification (T1, `dl-014` + testing directive): the task's single AC ("satisfies the
  Fit Criterion for REQ-SEC-08") decomposes into **red-first** sub-criteria — no prior scan
  capability exists in `src/`, so every behavior below is new:
  1. The canonical pattern set (spec-007 §2, 10 named rules) is available as versioned data and
     detects each `block`-severity shape and each `warn`-severity shape.
  2. Per-line scan procedure (spec-007 §4) returns `{blocking, warnings}` Findings with
     `{pattern_id, severity, file, line, column, excerpt}`, patterns evaluated in fixed
     declaration order (determinism, REQ-SYS-07).
  3. Exclusions (spec-007 §3): fenced `<!-- example -->`/`<!-- placeholder -->` blocks, placeholder
     values (`x`/`X`/`*` repeats or literal `REDACTED`/`PLACEHOLDER`/`EXAMPLE`), and a
     `security-ignore` glob list all downgrade a would-be finding to `info` rather than dropping it.
  4. Binary files are skipped via a null-byte sniff on the first 8KB (spec-007 §1).
  5. A concrete "scan the committed `.wingfoil/`-ish surface" entry point exists and, run against
     this repo's own tracked content, returns `blocking.length === 0` — the literal REQ-SEC-08 Fit
     Criterion, made checkable.
  No characterization ACs — nothing pre-exists to characterize.
- `agent.verify_specs`: **spec-007-secret-hygiene-patterns** is `approved` and is explicitly the
  tech-spec backing REQ-SEC-08 (its `scope` targets the `security-secrets` directive; its
  Consequences section directs implementers to "reproduce the pattern table in §2 verbatim (or
  import it as data)" and not hand-roll alternative regexes). It fully covers pattern content,
  exclusions, and scan procedure — **no gap, no new spec needed**. Pass-through (no approval gate).
- Design decision (traceability directive): the pattern regexes are reproduced from spec-007 §2
  as literal JS `RegExp`s with each pattern's inline PCRE `(?i)`/`(?im)` prefix mechanically moved
  to the equivalent JS `i` flag (JS has no `(?i)` inline-modifier syntax — `new RegExp('(?i)...')`
  throws). This is a syntax translation, not a semantic rewrite — the match shape is unchanged, so
  it satisfies spec-007's "verbatim (or import as data)" constraint. Each pattern carries a comment
  citing the exact spec-007 YAML `regex:` string it corresponds to.
- Module placement: `src/validation/secret-scan.ts` (pure pattern set + `scanText`, no I/O) plus a
  thin git/fs composition (`scanProjectSurface`) in the same file that lists tracked files via
  `git ls-files` (mirrors `src/storage/commit.ts`'s `execFileSync('git', ['-C', root, ...])` style)
  and feeds them through `scanText` — this is the seam spec-007 §4 step 5 describes future callers
  (a commit-time gate, `task-044`'s init integrity check) consuming. `validation` is already listed
  as a `{module}` in the dev-loop commit convention and does not create a dependency from
  `storage`→`validation` or vice versa (the git listing is local to this file, not imported from
  `src/storage`, keeping `validation` dependency-free of `storage`).

### red

- Wrote `test/validation/secret-scan.test.ts` against the not-yet-existing `src/validation/secret-scan`
  module: pattern-set shape/order/severity, per-pattern block/warn detection fixtures (obviously-fake
  values only, per the global security-secrets directive), declared-order determinism (a same-line
  proof that finding order follows pattern declaration order, not match column), the three §3
  exclusions (fenced `<!-- example -->`, placeholder value, path-ignore), `isBinaryContent`'s 8KB
  null-byte sniff, and `scanProjectSurface` against temp-fixture git repos (clean surface → 0
  blocking; a planted secret under the scan surface → detected; untracked noise → not scanned;
  `.wingfoil/security-ignore` glob → downgraded to `info`; binary file → skipped, no throw).
- Confirmed red: `Cannot find module '../../src/validation/secret-scan'` (suite fails to run, as
  expected — no characterization ACs, everything here is new per the design-phase classification).

### green

- Implemented `src/validation/secret-scan.ts` to spec-007:
  - `SECRET_PATTERNS` — the 10 named rules of spec-007 §2 as `{id, description, severity, regex}`,
    in declared order. Each `RegExp` carries a comment quoting the exact spec-007 YAML `regex:`
    string it implements. The two PCRE `(?i)`/`(?im)`-inline patterns are translated to the JS `i`
    flag (JS `RegExp` has no inline-mode syntax — `new RegExp('(?i)…')` throws); the `m` on the
    dotenv rule is a documented no-op since the scan already runs per line.
  - `scanText(content, file, {pathIgnored?})` — per-line, patterns evaluated in declared order
    (determinism), returns `{blocking, warnings, info}` with `{patternId, severity, file, line,
    column, excerpt}` findings; applies the three §3 exclusions (fenced `<!-- example -->`/
    `<!-- placeholder -->`, placeholder values, path-ignore) by downgrading to `info` with an
    `exemptReason` rather than dropping.
  - `isBinaryContent` — 8KB null-byte sniff (§1). `scanProjectSurface(root, opts?)` — lists
    tracked/staged files under `SCAN_SURFACE_ROOTS` (`.wingfoil/`, `docs/self/.wingfoil/`,
    `docs/self/docs/04_memory/`) via `git -C <root> ls-files` (mirrors `src/storage/commit.ts`
    exec style; skips roots that don't exist so it's safe pre-`init`), skips binaries, applies the
    `.wingfoil/security-ignore` glob list (§3), and scans the rest — the concrete entry point the
    REQ-SEC-08 Fit Criterion ("0 known secret patterns") is checkable against.
  - Exported the public surface from `src/validation/index.ts`.
- All 27 red tests pass. Full suite: 575/576 (the one failure was the pre-existing
  `program.integration.test.ts` "under 1 second" wall-clock perf flake under parallel load — see
  review note; passes in isolation and on the later clean run).

### refactor

- Added direct unit tests for the exported `matchesIgnoreGlob` (exact / single-`*` non-crossing /
  `**` crossing / `?` / empty-list) and `loadIgnoreGlobs` (missing file → `[]`; blank/`#`-comment
  skipping + trimming), closing the single-`*` and `?` glob branches. Module coverage → 100% lines,
  100% funcs, 85.96% branch, 96.33% stmts. No source change (implementation was already minimal and
  clean); tests stayed green.

### review

- Directives (reviewer: code-review, traceability): every `SECRET_PATTERNS` entry cites its exact
  spec-007 §2 `regex:` line; `scanProjectSurface`/`scanText`/exclusions cite the spec-007 §-numbers
  they implement; traceability chain REQ-SEC-08 → spec-007 → this module is intact. Determinism
  (REQ-SYS-07): patterns evaluated in fixed declared order, `git ls-files` output consumed in git's
  own order, no wall-clock/random in the scan path.
- **No dedicated BDD `.feature`** exists for REQ-SEC-08 (its SARD Traceability points at P3.8's
  `p3-directives/P3.8-builtin-directive-templates.feature`, which is `task-057`'s built-in-templates
  acceptance, not a secret-scan feature). The task's acceptance is the SARD **Fit Criterion**
  itself — "a scan of committed `.wingfoil/` content matches 0 known secret patterns" — which is
  exercised directly by the `scanProjectSurface` test that runs against **this actual repository**
  and asserts `blocking.length === 0`, plus the planted-secret / ignore-glob / binary-skip
  fixture-repo tests. `tests.bdd.run` is therefore satisfied by this executable Fit-Criterion suite.
- **Known pre-existing flake:** `test/cli/program.integration.test.ts` "memory search api … under
  1 second" is a wall-clock assertion that flakes to ~4-5s under the current 10-way parallel
  dev-loop load. Observed failing once in a full-suite run, passing in isolation and on the
  subsequent clean `test:coverage` run (583/583). NOT touched (out of task scope; editing it would
  collide with sibling branches) — per coordinator advisory.
- Gate results at submit: `npm test` → 583/583 green on the clean run (575/576 under peak load,
  sole failure = the flake above); `tsc -p tsconfig.build.json` → exit 0; `npm run test:coverage`
  → exit 0, threshold held (`validation` module 97.61% stmts / 89.65% branch / 100% funcs / 99.15%
  lines; `secret-scan.ts` 100% lines / 85.96% branch); `npm run docs:api` → exit 0 (ACTIVE
  hard-reject; every new export in `secret-scan.ts` carries TSDoc). ESLint clean.
- Downstream: `task-057` (built-in directive templates) and `task-044` (built-in template
  integrity, REQ-SEC-10) depend on this scan; both can consume `scanText`/`scanProjectSurface`
  and the shared `SECRET_PATTERNS` per spec-007 §4 step 5 rather than re-implementing regexes.
