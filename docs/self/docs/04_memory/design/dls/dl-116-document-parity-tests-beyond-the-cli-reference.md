---
id: "dl-116-document-parity-tests-beyond-the-cli-reference"
type: decision-log
title: "About one bug in six is a document that disagrees with the code or with another document, and only the CLI reference has a parity test — extend mechanical parity checks to specs, requirements and agent docs"
status: ready
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed by the v0.2 retrospective (`retro-v0.2`, being filed now). At its `additional-points` gate the
approver accepted the proposal to extend parity tests from the CLI reference to the specifications,
after the retrospective found that a large share of the release's bugs are document divergences
rather than behaviour defects.

**The share, re-measured.** At `a20b346c` there are 136 bug files
(`git ls-tree -r --name-only a20b346c -- docs/self/docs/04_memory/bugs/ | grep -c 'bug-[0-9]'`).
Classified by title, with the summary opened where the title was not decisive, a bug is a **document
divergence** when the behaviour is correct, or not at issue, and the defect is a document saying
something the code or another document contradicts: a spec, a requirement, a BDD step, an ADR, a
TSDoc block, a comment, the CLI reference, a backlog file or the agent guide.

- **23 clear cases:** `bug-008`, `bug-016`, `bug-028`, `bug-032`, `bug-039`, `bug-040`, `bug-045`,
  `bug-052`, `bug-053`, `bug-054`, `bug-062`, `bug-068`, `bug-069`, `bug-074`, `bug-089`, `bug-090`,
  `bug-096`, `bug-099`, `bug-100`, `bug-105`, `bug-106`, `bug-107`, `bug-109`.
- **3 where either side could be the one to fix:** `bug-104` (the suggestion format against
  `spec-005` §3.1), `bug-113` (a documented `scope` field the schema does not declare), `bug-134`
  (`e2e-smoke.yaml` declares no `produces:` that `dl-023` asked for).

That is 23 to 26 of 136, 17% to 19%. The classification is a judgement on titles and summaries,
written down so it can be checked; the first action of this decision makes the definition
mechanical. A higher share was proposed at the gate from notes kept during the release; it used a
definition that was not recorded, so it is not used here.

**What those bugs have in common.** Most are the same event: a ratified change landed in one place,
and a document elsewhere kept the old name, count, state or command.
- Retired names that stayed in prose: `bug-052` (a retired default machine in `REQ-STATE-08`),
  `bug-053`, `bug-105`, `bug-106`, `bug-109`.
- Claims about which commands exist or what they do: `bug-008`, `bug-074` (the agent guide
  declaring shipped verbs unbuilt), `bug-028`, `bug-099`.
- Enumerations that outgrew their titles: `bug-045`.
- Two documents specifying one grammar differently: `bug-089`, `bug-090`, `bug-100`.
- Transient facts written as durable ones: `bug-062`, `bug-068`, `bug-069`, `bug-096`.

**What checks documents today.** Two tests under `test/docs/`
(`git ls-tree -r --name-only a20b346c -- test/docs`):
- `cli-reference.test.ts` requires the set of `### \`wingfoil …\`` headings in
  `docs/cli-reference.md` to equal the command tree `buildProgram` derives from `CORE_MODULES`;
- `api-docs.test.ts` requires every exported declaration to carry TSDoc.

Nothing compares a specification, a requirement, a BDD step or the repository's agent guide with the
code or with another document. The CLI-reference test reads only that file's headings; `bug-099`
and `bug-100` sit in the same file's body, below them.

## Decision

Document parity is checked mechanically where a document names something the code or the
configuration defines, and by review only where it cannot be. The open choices below remain for the
approver.

**Q1 — which checks:**
- **(A) enumeration parity**, one test per enumeration a document restates, modelled on
  `cli-reference.test.ts`. Candidates: the command list in `spec-005` / `spec-008` against
  `CORE_MODULES`; the Memory types and their states in `spec-001` and in the repository's agent
  guide (owned by `align-agent-docs`, `dl-025-agent-facing-docs-ownership`) against `memory.yaml`;
  the exit codes in `spec-008` §5 and `spec-009` §3 against `src/core`; the MCP Tools in `spec-004`
  §4 against the registered Tools.
- **(B) name resolvability**: every backticked identifier in a spec, ADR or requirement that has the
  shape of a `src/` symbol, a config key path, a command or an element id must resolve at `HEAD`,
  or be listed in an allowlist that says why it does not (a retired name quoted on purpose).
- **(C) both**, (B) first.

**Q2 — where they run:**
- **(a) in the Jest suite**, like the CLI-reference gate, so `dev-loop`'s review gate runs them;
- **(b) in a separate `docs:check` script**, run at `user-docs` and `release-submit`.

**Q3 — what a failure does:**
- **(i) fails the build**, like `cli-reference.test.ts`;
- **(ii) warns for one release, then fails**, the staging `dl-023-init-cli-e2e-smoke-gate` used for
  the e2e smoke.

**Recommendation:** Q1 (C) with (B) first, Q2 (a), Q3 (ii).
- **(B) first** because it covers the largest group above, retired names and removed symbols, with
  one generic check, while each (A) test covers one enumeration.
- **Q2 (a)** puts the check where every change already passes; a check that runs only at release
  end finds the divergence after the task that caused it is `done`.
- **Q3 (ii)** because (B) is likely to start with real hits in existing documents; the warn release
  is when they are fixed or allowlisted.

## Rationale

- **The divergence is created at a known moment.** Almost every case above began when a decision was
  ratified or a symbol was renamed. A check at that moment is the only one that costs one line to
  satisfy; found later, each costs a bug, a triage and a task.
- **The CLI-reference test is the pattern.** It compares two sorted lists derived from fixed inputs,
  one from the document and one from the code, which is exactly what each (A) test would do.
- **What a check cannot see stays with review.** Transient facts and conflicting prose need a
  reader; that rule belongs to the `documentation` directive (`dl-120`), not to a test.
- **Trade-off.** An allowlist is maintenance, and a symbol-shaped pattern will have false positives.
  Both are visible and reviewable, which the current state is not.

Alternatives considered:
- **Generate the specs' enumerations from the code.** Rejected for now: the specs say what should be
  built, and generating them from the code would make the code the authority over them.
- **Review only.** Rejected: that is the current state, and it produced the 23 above.

## Actions

1. **Ratify, choosing Q1–Q3.** Owner: approver. The choice goes in the approve commit's `Reason:`.
2. **Make the definition mechanical:** record in `dl-089`'s catalogue how its metric Q15 (share of
   bugs opened in a window that are document divergences) classifies a bug, using this decision's
   definition, so the next retrospective does not classify by hand.
3. **Tests**, behind v0.3 tasks: the (B) resolvability check with its allowlist, then the (A) tests in
   the order the ratified choice sets; each lands under `test/docs/`.
4. **`dev-loop.yaml`'s `review` phase** names the new checks among those it runs; bump its `version`.
5. **Tasks are derived by v0.3 `release-planning` (`build-backlog`)**, not created here.

## Relations

- **Origin:** `retro-v0.2`, the document-divergence disposition (2026-09-28).
- **Extends:** `test/docs/cli-reference.test.ts` (the `user-docs` gate,
  `dl-013-documentation-process-gate`).
- **Related:** `dl-120-documentation-directive-extensions` (resolvable references, transient facts);
  `dl-075-no-bare-line-offsets-in-memory`; `dl-023-init-cli-e2e-smoke-gate` (the warn-then-fail
  staging Q3 (ii) borrows);
  `dl-089-release-health-analyses-before-retrospective` (Q15).
