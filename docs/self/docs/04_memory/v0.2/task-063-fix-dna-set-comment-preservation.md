---
id: "task-063-fix-dna-set-comment-preservation"
type: task
title: "Fix bug-004: `dna set` must preserve YAML comments ([SPEC]/[AUTHORING])"
status: in-progress
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
