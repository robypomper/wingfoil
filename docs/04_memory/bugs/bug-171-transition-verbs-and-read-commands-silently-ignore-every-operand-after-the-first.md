---
id: bug-171-transition-verbs-and-read-commands-silently-ignore-every-operand-after-the-first
type: bug
title: "Transition verbs and read commands silently ignore every operand after the first"
status: closed
severity: "medium"
release-origin: "v0.2.2"
release: "v0.3"
feature: "P1.7"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`memory submit|approve|reject|deprecate|history` and `dna show` accept any number of operands. They
act on the first, drop the rest without a word and exit `0`. An approver who names two documents gets
one approval, a success exit code and nothing that says the second was skipped.

## Steps to Reproduce

1. In a throwaway repository, `wingfoil init --template Scrum`, register an approver, and bring two
   tasks to `pending` (`memory add` + `memory submit`, twice).
2. `wingfoil memory approve <first-id> <second-id> --reason x`.
3. Observed with both builds on 2026-09-29: `wingfoil@0.2.1`, the pinned build, and `dist/cli.js`
   built from `main` at `804c4545`.
   - Exit `0`; the JSON output names only `<first-id>`.
   - `git log -1 --format=%s` → `wf(task): approve <first-id> [pending → approved]`.
   - `memory search --type task` shows `<second-id>` still `pending`.
4. The same, dev build, one extra operand each; every command exits `0` and ignores it:
   - `memory submit <id> <other>`;
   - `memory reject <id> bogus --reason x`;
   - `memory deprecate <id> bogus`;
   - `memory history <id> bogus`;
   - `dna show project bogus`.

   By contrast, `dna set project.name bogus --value y` exits `2` with *"wingfoil dna set takes one
   positional <path>; … (got 2 …)"*.

Found for real on this repository: `npm run -s wingfoil -- memory approve bug-169-… bug-170-…
--reason …` wrote `4fa3cee0` (`wf(bug): approve bug-169-… [open → triaged]`) and left `bug-170`
`open`, with exit `0`.

## Expected Behavior

Per `dl-082-cli-parameter-shape`, each command takes at most one positional. The registrar leaves the
refusal of an extra one to the operation. The comment above `target.argument(...)` in
`src/cli/program.ts` says so: *"an operation refuses an extra one itself (`dna set`'s migration
message)"*. So every command refuses an extra operand with exit `2` and a message naming the command
and the count, as `dna set` does, before it changes anything.

Either that, or the transition verbs take several ids **by design**. In that case each id is
transitioned and the commit subject lists them all.

## Actual Behavior

Only `dna set` implements the refusal. Every other command with a positional ignores the surplus, so
a partial operation reports success.

## Notes

- **A contract that suggests the opposite.** The commit format this repository documents is
  `wf({type}): {verb} {id1}, {id2}, ...`, and batch approvals are in its history: `9a38cd9e` triaged
  six bugs in one commit. A user reading that format will try the batch form on the
  CLI and meet this bug. The fix must choose between refusing (exit `2`) and batching, and the
  documented format then follows the choice (`spec-008-cli-grammar`, `dl-079` for the commit grammar).
- **Duplicate search:**
  `grep -rl -i 'excess\|extra positional\|surplus\|second id\|too many\|multiple ids' docs/04_memory/bugs docs/04_memory/design/dls`
  → only `dl-020`, unrelated. `bug-168` (missing-operand messages) is the opposite case: too few
  operands, not too many.
- **Found** by `user-docs-rel-v0.2.2-plan`, while triaging `bug-169`/`bug-170`, and filed through
  `bug-ingest-rel-v0.2.2-user-docs-findings-plan`.

## Triage & Execution Notes

<!-- Filled at triage (bug-ingest) and by the fix task. -->
