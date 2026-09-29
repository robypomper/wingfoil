---
id: "dl-117-ai-attribution-policy"
type: decision-log
title: "No rule says when and how AI co-authorship is attributed in commits — five model names, gaps and co-authored approvals follow; declare one policy"
status: ready
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed by the v0.2 retrospective (`retro-v0.2`, being filed now). At its `additional-points` gate the
approver accepted the proposal to decide an AI attribution policy: which name, and when.

**What the history shows at `a20b346c`.** Attribution is a `Co-Authored-By:` trailer, written by
whoever wrote the commit, following no rule.

- **Coverage.** 994 of 2,101 commits on `main` carry one
  (`git log --format='%H %(trailers:key=Co-Authored-By,valueonly,separator=%x2C)' a20b346c | awk 'NF>1' | wc -l`
  against `git rev-list --count a20b346c`). In v0.2's era (`20e8271..a20b346c`), 929 of 1,654.
- **Names.** Five distinct values, counted by
  `git log --format='%(trailers:key=Co-Authored-By,valueonly)' a20b346c | sed 's/ <.*//' | grep . | sort | uniq -c`:

  | Name | Commits | First – last (`%ad`, `--date=short`) |
  |---|---|---|
  | Claude Opus 4.8 (1M context) | 60 | 2026-06-29 – 2026-07-08 |
  | Claude Sonnet 4.6 | 1 | 2026-06-29 |
  | Claude Sonnet 5 | 4 | 2026-07-03 – 2026-07-04 |
  | Claude Opus 5 | 856 | 2026-09-15 – 2026-09-28 |
  | Claude Opus 5.5 | 73 | 2026-09-25 – 2026-09-28 |

  Two names overlap from 2026-09-25, so the name records which session wrote a commit, not a
  project-level choice. No process note records the change.
- **Approvals.** 79 of the 235 `wf(…): approve` commits carry an AI co-author trailer
  (`git log --grep='^wf(.*): approve ' --format='%H %(trailers:key=Co-Authored-By,valueonly,separator=%x2C)' a20b346c | awk 'NF>1' | wc -l`).
  `dna.yaml` declares the agent with `approval_authority: false`. The likely reading is that an agent
  wrote those commits on the approver's instruction, but nothing in the record or in any rule says so,
  and a reader could as well conclude that an agent approved.
- **No rule.** `git grep -n -iE "co-authored|attribution" a20b346c -- docs/self/.wingfoil/directives
  docs/self/.wingfoil/roles.yaml` returns nothing. The same pattern finds 10 lines in
  `src/memory/audit.ts` and 6 in `dl-020-contribution-model`, so it works.
  `dl-020-contribution-model` (`ready`) credits a human contributor whose intent an agent turned into
  work (`contributor:` and `credit:` frontmatter); it says nothing about the agent itself.

**Why it matters.** Attribution is part of the audit trail P1.2 promises (changes "tracked via git
with author, timestamp, commit message"), and REQ-SEC-01's rationale is that "every change must be
attributable". The release-health analysis tracks it as a metric that cannot be judged until a policy
exists (`dl-089`, G08, "trend per policy"). And WingFoil will write commits on an agent's behalf
through `agent execute` (P5.3.1); whatever it writes should follow a declared rule rather than the
habits of whichever session is running.

## Decision

The project declares one AI attribution policy, in a directive, and WingFoil's own commit writer
follows it once it writes commits for agents. The open choices below remain for the approver.

**Q1 — which commits carry AI attribution:**
- **(A) every commit whose content an agent produced**, in whole or in part, including Memory
  operations the agent performed on the approver's instruction;
- **(B) as (A), except approval-gate commits** (`approve`, `reject`): those record a human decision,
  and carry no AI co-author even when an agent typed them;
- **(C) none**; the role recorded elsewhere is enough.

**Q2 — which name:**
- **(a) the exact model identifier** the running agent reports, as today, but always present;
- **(b) the agent entry declared in `dna.yaml` `team.agents`** (today "AI agent (Claude/Cursor/etc.)"),
  so the name is stable and the model goes in a separate trailer;
- **(c) both:** `Co-Authored-By:` names the `dna.yaml` agent, and an `AI-Model:` trailer records the
  model identifier.

**Q3 — where the policy lives:**
- **(x) the `git-conventions` directive** proposed by `dl-119`, bound to every role that commits;
- **(y) the `traceability` directive**.

**Recommendation:** Q1 (B), Q2 (c), Q3 (x).
- **Q1 (B)**: attribution should say who produced the content. On an approval the content is the
  approver's decision, and an AI co-author line there invites the reading that the agent approved,
  which `approval_authority: false` rules out.
- **Q2 (c)** keeps the name stable across model upgrades (a mid-release model change then shows as a
  value change in one trailer, not a new co-author), and keeps the model identifier, which the
  replay experiment and cost records (`dl-114`) need.
- **Q3 (x)**: attribution is a git convention, and `dl-119` gathers those.

## Rationale

- **A trail nobody declared cannot be audited.** Today "no trailer" can mean human-written, or
  agent-written without the trailer, and the history cannot tell which.
- **Stable names make trends readable.** Five names in one history split one actor five ways;
  G08 cannot compare windows until the name is fixed.
- **Approvals are the sensitive case.** They are the records P1.7 exists for, and REQ-SEC-03 limits
  them to holders of the approver role. Keeping them free of AI co-authorship keeps them unambiguous.
- **Trade-off.** Q1 (B) under-reports agent involvement on approval commits, by design. Q2 (c) adds a
  second trailer, which `dl-067`'s block rule already accommodates in the trailing trailer paragraph.

## Actions

1. **Ratify, choosing Q1–Q3.** Owner: approver. The choice goes in the approve commit's `Reason:`.
2. **Write the rule** into the directive chosen in Q3; bump `roles.yaml` if a binding changes.
3. **`dl-089`'s G08** is measured against the rule from v0.3 on.
4. **`agent execute` (P5.3.1)** writes attribution per the rule; this and the directive text are
   derived as tasks by v0.3 `release-planning` (`build-backlog`), not created here.
5. **Past commits are not rewritten.** The policy applies from its ratification.

## Relations

- **Origin:** `retro-v0.2`, the attribution disposition (2026-09-28).
- **Related:** `dl-119-a-git-conventions-directive`; `dl-020-contribution-model` (human credit);
  `dl-067-reason-trailer-contract` (the trailer paragraph); `dl-111-tool-signature-in-commits` (the
  other trailer filed by this retrospective); `dl-094-one-author-identity-per-act` (the git author
  side of the same record); `dl-089-release-health-analyses-before-retrospective` (G08).
- **Traceability:** P1.2 (audit trail), P1.7, REQ-SEC-01, REQ-SEC-03.
