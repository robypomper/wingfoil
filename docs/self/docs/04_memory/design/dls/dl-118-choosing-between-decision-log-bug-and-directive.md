---
id: "dl-118-choosing-between-decision-log-bug-and-directive"
type: decision-log
title: "No written rule chooses between a decision-log, a bug and a directive change, so the same situation was filed six times as one and six times as the other"
status: in-discussion
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed by the v0.2 retrospective (`retro-v0.2`). Its dispositions include the finding that nothing
written tells an author which Memory type a finding belongs to. The approver ruled on 2026-09-28
that the rule is (c) below, that it lands in a directive, and that the elements filed under the old
habit stay as history.

**What the type descriptions say today.** At `a20b346c`, `memory.yaml` describes `decision-log` as
"A product/process decision record (DL)" (`types.decision-log.description`), and `bug` as "A defect
report" (`types.bug.description`). Neither says when a finding is one rather than the other, and no
directive mentions the choice. Nothing names a third outcome at all: a rule that should govern all
future work belongs in a directive, but it can only arrive there through an element of some other
type.

**What happened without a rule.** The retrospective's classification pass
(`retrospective-rel-v0.2-plan` §4.10) opened every element that an earlier title-only triage had
proposed to retype. One situation recurs: an `approved` or `accepted` document says something that
is now false. It was filed six times as a decision-log and six times as a bug.

- As decision-logs: `dl-039-spec-004-prompt-example-corrections`, `dl-040-spec-006-resource-uri-divergence`,
  `dl-041-spec-006-module-grouping-vs-core-module-name`, `dl-043-console-format-human-rendering`,
  `dl-052-verdaccio-started-by-staging-script-in-ci`, `dl-060-roles-yaml-binds-by-directive-id`.
- As bugs: `bug-028-mcp-command-missing-from-cli-specs`, `bug-032-spec-004-stale-illegal-transition-example`,
  `bug-039-p3-8-scenario-names-unregistered-trunk-based-template`, `bug-052-req-state-08-names-retired-default-machine`,
  `bug-053-spec-011-memory-yaml-row-stale-states-encoding`, `bug-054-adr-001-present-tense-stack-parenthetical-stale`.

The only criterion anyone wrote down is in `dl-060`'s Decision: "Filed as a decision-log rather than
a bug because the correction is to an `approved` specification". That criterion is about the
*target document*. It says nothing about whether a choice exists.

The same pass found two more mismatches:

- **Standing rules filed as decisions or defects.** `dl-024-git-branch-tag-conventions`,
  `dl-035-task-branch-sync-with-main` and `dl-054-submit-commit-subject-bracket` are permanent git
  conventions. `dl-047-tech-specs-carry-no-version-field` and `dl-075-no-bare-line-offsets-in-memory`
  are documentation rules. `bug-040-builtin-directive-docs-stale-after-task-057` and
  `bug-045-mutating-op-enumeration-titles-stale` describe a missing rule, not a defect in code.
  Parts of `dl-034-lint-gate-in-dev-loop`, `dl-044-typecheck-gate-for-test-sources` and
  `dl-073-scan-surface-vs-publication-boundary` are the same shape. They are handled by the directive
  decision-logs filed alongside this one (see Relations).
- **A design choice filed as a bug.** `bug-094-a-bug-ruled-wontfix-after-triage-has-no-legal-exit`
  asks which state machine a bug should have. Its own 2026-09-24 correction says that "is a design
  question, not a defect, and it does not belong in a bug". It is retyped by
  `dl-123-a-bug-ruled-wontfix-has-a-legal-exit`.

Statuses were read at `a20b346c` with
`git show a20b346c:<file> | awk '/^---$/{n++} n==1&&/^(status|release):/'`.

## Decision

WingFoil adopts one rule for the type a finding is filed as, stated in the `traceability` directive:

1. **Bug** — something is wrong, and the fix is **mechanical and uncontested**. Once the defect is
   described, any competent reader would make the same change. This includes an approved document
   that states something false, where the document is simply corrected to match what was already
   ratified.
2. **Decision-log** — there is **a real choice**: at least two options a reasonable approver could
   pick, each with a cost. This includes an approved document that is false where deciding which
   side is right (the document or the code) is itself the question. `dl-060` is the example: binding
   by `name` was a live, rejected alternative, so it is correctly a decision-log under this rule too.
3. **Directive change, proposed through a decision-log** — the finding is a rule meant to govern
   **all future work** of some role, rather than a single change. The decision-log argues it; the
   directive states it. When the rule is ratified and written, the decision-log **stays `ready` and
   is cited by the directive**. It is neither deprecated nor superseded. `task-094` set this
   precedent: it wrote the `command-baseline` directive citing
   `dl-080-which-baseline-each-command-reads`, and `dl-080` is still `ready` at `a20b346c`.

**The misfiled elements stay as history.** None of the twelve elements above is retyped, and their
ids and states do not change. The approver ruled this on 2026-09-28. Re-filing would move audit
records without changing any outcome, and several of them are already `ready` or closed. There are
two exceptions. `bug-094` is retyped, because leaving it as a bug would leave a design choice with
no decision-log. `bug-040` and `bug-045` close as absorbed once their directive is ratified
(`dl-120-documentation-directive-extensions`).

**One question stays open: where else the rule appears.**

- **(A) The directive only.** `traceability.md` gains the rule, and nothing else changes.
- **(B) The directive, plus one line in each ingest workflow.** The `capture` phase `description` of
  `bug-ingest.yaml` and `decision-log-ingest.yaml` gains a pointer to the rule. The capture step is
  where the choice is made. At `a20b346c`, `bug-ingest`'s `capture` phase runs as `developer`, a role
  `roles.yaml` does not bind to `traceability` (it binds it to `reviewer`, `architect` and
  `product-owner`). `decision-log-ingest`'s `capture` runs as `product-owner`, which does load it.
- **(C) (B), plus the type descriptions.** `types.bug.description` and
  `types.decision-log.description` in `memory.yaml` each say when to use that type. For the rule to
  reach other projects, the `memory.yaml` that `wingfoil init` scaffolds would carry it too. That
  file is produced by `memoryYaml` in `src/storage/templates.ts`, and it carries no type descriptions
  at `a20b346c`.

**Recommendation: (B).** The rule has to be in front of whoever files, and the directive alone does
not reach `developer`, the role that files bugs. (C) changes what `init` ships, for a rule this
project has not yet tried for a single release.

## Rationale

- **The criterion is the choice, not the document.** Whether the target is `approved` changes who
  must sign off on the correction. It does not change whether there is anything to decide. A
  mechanical correction to an approved spec still needs the approver's `approve` on its fix task. It
  does not need a debate.
- **Rule (c) keeps both types honest.** Filing a mechanical fix as a DL puts it in a queue that 28 of
  86 decision-logs were already waiting in at `5269223d`, as measured by
  `dl-089-release-health-analyses-before-retrospective`. Filing a real choice as a bug hides the
  alternatives from the approver. It also puts the decision inside a fix task, which is exactly what
  `bug-092`'s notes warn against.
- **Directives need a named route in.** No element type is a directive change, so a standing rule
  can only arrive through a DL or a bug. Without rule 3 it lands as whichever type the author picks,
  and nothing ever writes it where the role that must follow it would load it.
- **Leaving history alone is cheaper and loses nothing.** Each misfiled element is fully readable as
  it is. The rule is about what gets filed next.

Alternatives considered:

- **(a) Retype all twelve.** Rejected by the approver on 2026-09-28. It rewrites records to fit a
  rule adopted after they were written.
- **(b) "Always a DL when the target is approved."** This is `dl-060`'s implicit rule. Rejected: it
  sends every mechanical correction through a decision queue.

**Enforcement caveat.** A directive has no enforcement point today. Nothing loads one into an agent's
context, because P3.6 (auto-load by role) is not built: `git show a20b346c:src/core/index.ts | grep -c agentExecute` prints `0`, while the same
command with `memoryApprove` prints `7`. No hook or CI job reads a commit:
`git ls-tree -r --name-only a20b346c | grep -ciE 'husky|pre-commit|lefthook|commitlint'` prints `0`,
while the same pipe with `publish.yml` prints `1`. The rule reaches an agent only when a brief loads
it by hand. The enforcement point is owned by `dl-097-claim-evidence-needs-an-enforcement-point`
and `dl-103-governance-enforced-outside-the-agent`, not by this decision.

## Actions

1. **Ratify, choosing (A), (B) or (C).** Owner: approver. The choice goes in the approve commit's
   `Reason:`.
2. **On ratification, `docs/self/.wingfoil/directives/custom/traceability.md` changes.** It gains
   rules 1–3, the example of `dl-060`, and a citation of this decision-log.
3. Under (B), `docs/self/.wingfoil/workflows/custom/bug-ingest.yaml` and `decision-log-ingest.yaml`
   change their `capture` phase `description` and bump `version`. Under (C),
   `docs/self/.wingfoil/memory.yaml` `types.bug.description` and `types.decision-log.description`
   change too, and so does `memoryYaml` in `src/storage/templates.ts`.
4. The twelve elements listed in Context are **not** transitioned by this decision.
5. Tasks are derived by v0.3 `release-planning` (`build-backlog`), not created here.

## Relations

- **Origin:** `retro-v0.2`, from the classification pass in `retrospective-rel-v0.2-plan` §4.10.
- **Applied by:** `dl-119-a-git-conventions-directive`, `dl-120-documentation-directive-extensions`,
  `dl-121-testing-directive-extensions` and `dl-122-no-secret-shaped-literals-in-fixtures`, which
  are rule 3; and `dl-123-a-bug-ruled-wontfix-has-a-legal-exit`, which retypes `bug-094` under
  rule 2.
- **Precedent:** `task-094` / `dl-080` (a DL that stays `ready`, cited by the directive that
  implements it).
- **Enforcement:** `dl-097-claim-evidence-needs-an-enforcement-point`,
  `dl-103-governance-enforced-outside-the-agent`.
- **Traceability:** P3.5 (custom directives); REQ-SYS-08 (directives bind to roles).
