---
id: "task-063-fix-dna-set-comment-preservation"
type: task
title: "Fix bug-004: `dna set` must preserve YAML comments ([SPEC]/[AUTHORING])"
status: in-review
release: "v0.2"
priority: "Medium"
tags: ["v0.2", "dna"]
ref: "P2.1"
bug: "bug-004-dna-set-strips-yaml-comments"
depends_on: []
tmpl_version: 260703
---

## Description

Fix **bug-004**: `wingfoil dna set` re-serializes `dna.yaml` via `js-yaml dump()`, stripping all comments and losing the `[SPEC]`/`[AUTHORING]` provenance annotations. Make `dna set` a minimal, comment-preserving in-place edit.

## Acceptance Criteria

From `bug-004`:
- `wingfoil dna set <key> <value>` on a comment-rich `dna.yaml` updates only the target value.
- All unrelated content — comments (incl. `[SPEC]`/`[AUTHORING]`) and formatting — is preserved.
- Deterministic output; existing `dna set` tests still green.

## Implementation Notes

Source: `bug-004` (triaged). Surfaced by task-025 review. Likely needs a comment-preserving YAML editor (e.g. `yaml`/eemeli) instead of `js-yaml dump`. dev-loop keeps the bug state in sync via `bug: bug-004`.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

**start** — `status: backlog → in-progress`; committed. `bug: bug-004-dna-set-strips-yaml-comments`
→ `bug.sync_state` advanced the bug `planned → in-progress` (`689a2e5`). `depends_on: []`, so
`agent.read_related` is a no-op — no upstream Execution Notes to acknowledge.

**design** (architect) — **T1 AC classification** (from `bug-004`):

| # | Acceptance criterion | Class |
|---|---|---|
| a | `dna set <key> <value>` on a comment-rich `dna.yaml` updates **only** the target value | **red-first** |
| b | All unrelated content — comments (incl. `[SPEC]`/`[AUTHORING]`) and formatting — is preserved | **red-first** |
| c | Deterministic output; existing `dna set` tests still green | **characterization** |

(a)/(b) are the defect itself and must be forced with a failing test. (c) pre-exists: `dnaSetFn`
already produces byte-stable output (`bug-004` Notes: "Determinism (REQ-SYS-07) is not regressed — the
rewrite is byte-stable") and the existing `test/core/dna-set.test.ts` suite is green on `main`, so no
fabricated red for it — it is asserted as a regression guard instead.

- **Spec verification (`agent.verify_specs`):** **no new `tech-spec` needed.** No approved spec pins
  `dna set`'s *serialization strategy*: `spec-002-dna-yaml-schema` (approved) defines only the
  `DnaYaml` structure, `spec-006-core-domain-api` §3 lists `dnaSet | mutates: true | wingfoil dna set |
  Tool dna.set` with no write-format contract, and `spec-008-cli-grammar` does not mention `dna set`
  at all. The BDD ground truth `P2.1-dna-set.feature` pins three scenarios (set / update / invalid key
  path with the exact message `invalid key path: '..language'`) and says nothing about comments — which
  is exactly why task-025 was merged as-is and `bug-004` was opened separately. The behavioural contract
  for this fix is therefore `bug-004`'s own Expected Behavior plus the **field-provenance convention**
  (`[SPEC]`/`[AUTHORING]`, declared in `dna.yaml`'s own header legend): stripping those annotations
  silently voids the rule that a `[SPEC]` field may only be removed/renamed after changing the
  referenced specification. Design passes straight through — no scaffold, so no approver gate.

- **Approach decision — in-place textual edit, NOT a new dependency.** The obvious fix (`yaml`/eemeli
  CST round-trip, `yawn-yaml`) would add a **production** dependency. `dl-010-minimal-dependencies`
  (`ready`) caps production deps at ~10 and requires "an explicit request for an exemption" at review;
  `package.json` currently declares **6** (`@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`, `chalk`,
  `commander`, `js-yaml`, `zod`) — so the cap is not yet breached, but a second YAML library alongside
  `js-yaml` is precisely the "secondary convenience package" dl-010 excludes, and `package.json` is
  owned by `task-059` this cycle (concurrent edit). A **minimal in-place edit** — locate the target
  key's line, replace only its value token, leave every other byte untouched — needs no dependency, is
  naturally byte-exact, and is a pure function of `(text, keyPath, value)` (REQ-SYS-07). Chosen.

- **Scalar-coercion property is preserved, not dropped.** `dnaSetFn`'s existing comment documents why
  it re-parses the *serialized* form rather than the in-memory object: it validates the exact bytes
  about to be written and honours YAML's own scalar coercion (so e.g. `dna set version 2` writes
  `version: '2'`, reads back as the **string** `'2'`, and fails `z.number()` — the current, intended
  behaviour). The in-place edit keeps this by rendering the value token with the *same* `js-yaml`
  `dump()` call (`dump(value, { lineWidth: -1 })` on the bare scalar), so the emitted token is
  byte-identical to what the whole-file `dump` would have emitted at that position; the re-parse +
  `DnaYaml.safeParse` then runs on the **actual final bytes** rather than on a re-serialization of
  them — strictly stronger than before.

- **Safe fallback, by design.** A textual editor cannot honestly handle every YAML shape, so
  `setDnaValueInText` returns `undefined` (→ `dnaSetFn` falls back to today's `dump()` path, unchanged
  and still correct) whenever it cannot make a provably-minimal edit: a block/multi-line scalar
  (`>-`, `|`) or any inline value followed by a more-indented continuation line; replacing a key that
  opens a nested block; descending through a key that holds an inline scalar; a value whose `dump`
  form is itself multi-line; or a post-edit self-check (re-parse, read back the key path) that does
  not return the expected scalar. Comments are lost only in those cases, never in the common one.

- **Placement.** The editor lives in `src/dna/set.ts` — the DNA pillar already owns dotted-key-path
  semantics (`isValidKeyPath`, `setDnaValue`, `DNA_KEY_ALIASES`) and stays a leaf under `src/core`
  (it imports `js-yaml` only, never `src/core`). `src/core/index.ts`'s change is confined to
  `dnaSetFn` (`task-049` is concurrently editing that file's `memory` module block).

**red** — two failing suites, both driven by the real artefact rather than a toy:
- `test/dna/set-in-text.test.ts` (24 cases) — the pure editor contract: minimal rewrite, inline-comment
  preservation, absent-key insertion, scalar-rendering parity with `dump`, and every honest refusal.
- `test/core/dna-set-comment-preservation.test.ts` (7 cases) — end-to-end through the **registered**
  `CORE_MODULES` `dna.dnaSet` op, seeding a throwaway git repo with WingFoil's own
  `docs/self/.wingfoil/dna.yaml`, read from this repository at run time (never written to).

  Observed red: **28 failed, 2 passed (30 total, 2 suites)**. The two that passed are the fixture guard
  (`the fixture is genuinely comment-rich`) and the invalid-key-path case, which already worked. The
  decisive failure, verbatim:

  ```
  ● AC(a): ONLY the target value changes — exactly one line differs, and it is the target key line
    expect(received).toHaveLength(expected)
    Expected length: 1
    Received length: 182
  ```

  On a 182-line file, **182 lines changed** — the `dump()` round-trip rewrote the entire document. The
  companion AC(b) failure listed every deleted comment line, including
  `#   [SPEC]      = required or defined by the specifications (ref cited inline).` — i.e. the legend
  that defines the convention was itself among the casualties. The unit suite failed with
  `TypeError: (0 , set_1.setDnaValueInText) is not a function` (module absent — genuine red, not a
  fabricated one).

**green** — `src/dna/set.ts` gains `setDnaValueInText(text, keyPath, value): string | undefined`, a
line-oriented, indentation-tracking editor over the raw file text (imports `js-yaml` only):
- `resolveKeyPath` walks block mappings top-down, maintaining the current key path by indentation, and
  skips sequence branches and block-scalar content wholesale — so a dotted path can only ever resolve
  to a real mapping key, never to a look-alike inside a list item.
- `replaceLeafValue` rewrites one line, keeping indentation, key, and any inline comment — realigned to
  the **same column** it already occupied when the new value leaves room, else separated by one space.
- `insertKeyPath` appends an absent key at the end of its parent's block, *before* any trailing comment
  lines, adopting the block's own child indentation.
- `renderScalar` renders the value with the very same `dump(value, { lineWidth: -1 })` call the old path
  used, so the value token is byte-identical to what a whole-file re-serialization would have emitted.
- `readsBackAs` re-parses the edited text and checks the key path really holds the intended scalar; any
  failure returns `undefined`.

`src/core/index.ts`'s change is **three lines inside `dnaSetFn`** (plus its docstring): read the current
text once, then
`const serialized = setDnaValueInText(current, keyPath, value) ?? dump(dna, { lineWidth: -1 });`,
and compare the idempotence check against that same `current`. `setDnaValue` on the in-memory object is
retained because the fallback still needs it. Nothing else in that file was touched (`task-049` owns the
`memory` module block). Full suite at the green commit: **71 suites, 911 tests, all passing**.

**refactor** — small and honest; there was not much to undo. Made `Resolution.depth` mean the same thing
on both branches (segments resolved), and added the one test that was missing: a case where the edited
text would no longer parse, exercising the final `readsBackAs` safety net (a flow sequence dedented to
column 0 makes the block scan end early, so the insertion would land inside the sequence — nothing
earlier can detect that). `src/dna/set.ts` went from 99.18% to **100% line coverage**.

Refactor-gate results, all observed on this branch:

| Gate | Result |
|---|---|
| `npx jest --maxWorkers=2` | **71 suites, 912/912 passing**, exit 0 |
| `npx jest --coverage --maxWorkers=2` | **All files 98.08% stmts / 89.50% branch / 98.28% funcs / 98.83% lines**; `src/dna` 97.95 / 94.53 / 100 / 100; `set.ts` 97.46 / 94.06 / 100 / **100** |
| `npm run docs:api` | exit 0 |
| `npx tsc -p tsconfig.build.json` | exit 0 |
| `npx eslint .` | exit 0 (`lint.clean`, `dl-034`) |

**Property verification — comments survive (AC(a)/(b)).** Run against a throwaway repo seeded with the
real `docs/self/.wingfoil/dna.yaml` (**182 lines, 44 whole-line comments, 23 `[SPEC]`/`[AUTHORING]`
markers**):

- `dna set project.name "WingFoil Renamed"` → ok; **44 comments and 23 markers after**, unchanged.
  `git diff --stat` = `1 file changed, 1 insertion(+), 1 deletion(-)`; the whole diff is
  `-  name: WingFoil` / `+  name: WingFoil Renamed`.
- `dna set project.methodology scrum` → the inline annotation stays on the edited line *and* keeps its
  column: `methodology: custom            # see .wingfoil/workflows.yaml (main: sw-life-cycle)` becomes
  `methodology: scrum             # see …`, `#` at column **33 before and after**.
- `dna set project.owner Roberto` (absent key) → one line inserted at the end of the `project:` block,
  before the blank line and the `# ---` section banner that follows; comment count unchanged.
- `dna set project.name WingFoil` (current value) → ok, `commit === undefined`, bytes identical, HEAD
  unchanged — the idempotent no-op now holds on a comment-rich file, which it could not before.

**Property verification — scalar coercion is PRESERVED.** The old code deliberately re-parsed the
*serialized* form rather than trusting the in-memory object, so that what is written is what will be
read back. The in-place path keeps that guarantee and tightens it: `serialized` is now literally the
final file text, so `DnaYaml.safeParse(parseYaml(serialized))` validates the exact bytes instead of a
re-serialization of them. Because `renderScalar` emits the token via the same `dump()` call, coercion is
unchanged — observed on the real file: `dna set version 2` still returns `VALIDATION` (exit 1) with the
file untouched, because the string `"2"` is written as `'2'` and reads back as a **string**, failing
`version`'s `z.number()`. Likewise `dna set paths.sources src` still returns `VALIDATION`, file
untouched (the `journey-0a` "cannot write an array-typed field" guarantee is intact).

**Honest caveat — when the fallback fires, comments are still lost.** `setDnaValueInText` returns
`undefined` (→ whole-file `dump()`, exactly the old behaviour) for: text that is not one valid YAML
document; a malformed key path; a value whose own YAML form is multi-line; a target that is a
block/multi-line scalar (`>-`, `|`), opens a nested block, or has a same-indent hanging sequence; an
ancestor holding an inline scalar; a parent block that is a sequence; or a failed read-back check.
Measured on the real file: `dna set project.north_star short` (a `>-` block scalar) succeeds via the
fallback and leaves **0 comments and 0 markers**. This is narrower than the bug — every scalar leaf and
every new key is now safe, which covers `dna set`'s documented scalar-only scope — but it is not zero.
Widening it (block-scalar rewriting) would need a CST-based YAML library, i.e. a `dl-010` exemption;
deliberately **not** taken here, and left on the record for the reviewer rather than hidden.

**review** (reviewer) — full suite re-run green: **71 suites, 912/912**. Coverage, `docs:api`, `tsc` and
`eslint` as tabulated above. Traceability intact: `bug-004` → `P2.1` / `P2.1-dna-set.feature` →
`spec-002`/`spec-006` → this task; the three BDD scenarios are still covered verbatim by the untouched
`test/core/dna-set.test.ts`. **No production dependency added** — `package.json` is untouched and still
declares six (`task-059` owns that file this cycle). Files touched: `src/dna/set.ts`, `src/dna/index.ts`
(one export), `src/core/index.ts` (**`dnaSetFn` and its docstring only**), plus the two new test files
and this Memory document. `src/mcp/`, `src/storage/`, `package.json` and the `memory` module block in
`src/core/index.ts` were not touched. `status: in-progress → in-review`; `bug.sync_state` advances
`bug-004` `in-progress → in-review` in the same commit.
