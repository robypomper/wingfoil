---
id: "task-043-secret-credential-hygiene"
type: task
title: "Infrastructure: REQ-SEC-08 — secret/credential hygiene"
status: in-progress
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

### green / refactor / review

(filled in per phase below)
