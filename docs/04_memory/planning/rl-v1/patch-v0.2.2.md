---
id: "patch-v0.2.2"
type: release
title: "WingFoil v0.2.2 - Configuration at the root, staged publishing, first-use fixes"
status: in-development
kind: "patch"
patch-of: "minor-v0.2"
version: "v0.2.2"
pillar: "P1"
features: [P1.3, P1.10, P1.13, P2.4, P5.1.1, P5.1.4, P5.2.1]
requirements: "docs/04_memory/design/dls/retro-v0.2.md"
release-line: "v1"
tmpl_version: 260929
---

## Scope

v0.2.2 is a patch of `minor-v0.2`, published before v0.3.0. It adds no feature: it prepares the
repository, rehearses the new publishing steps, and fixes what a first user meets. Its code changes
are limited to the fixes listed below; `dl-107` (`memory add` keeps version dots) and the help and
error texts of `bug-128`, `bug-129`, `bug-140` are the only ones a user can observe. Its approved scope is the v0.2 retrospective's
disposition table (`retro-v0.2`, the rows targeting v0.2.2), carried out in the order the approver
fixed on 2026-09-28 (`retrospective-rel-v0.2-plan` §6.8):

1. **Prerequisites.** One author identity per act (`dl-094`); `BRACKET_RE` accepts the ASCII arrow
   (`bug-137`); patch tracking (`dl-092`, already in configuration).
2. **Configuration at the root.** `docs/self/.wingfoil/` moves to the repository root so the Memory
   verbs can run on WingFoil's own Memory (`bug-075`); version dots survive in ids (`dl-107`); the
   released build that develops WingFoil is pinned (`dl-095`); the MCP server is registered in the
   repository (`dl-026`). v0.3 may start once this step is on `main`.
3. **Staged publishing.** npm staged publishing (`dl-087`) with the publish workflow's actions moved
   off Node 20 (`bug-136`).
4. **External state in Memory.** The `service` type and the services WingFoil already depends on
   (`dl-088`).
5. **Public identity and first use.** The name and MCP namespace (`dl-091`), the repository renamed
   and its URLs swept before publish, the package's discovery metadata (`dl-093`); the unused
   `@anthropic-ai/sdk` removed (`bug-138`); `init` and its scaffold name what they need
   (`bug-139`, `bug-140`, `bug-129`); subcommand help describes its commands (`bug-128`); the coverage
   gate measures every `index.ts` that holds logic (`bug-021`); a closure with no code (`bug-092`,
   through `dl-123`'s won't-fix exit); the vision's calendar
   re-based on active days (`dl-096`).
6. **Publish.** Staging, then the `v0.2.2` tag on the pushed `main`, then the npm publish.

Out of scope on purpose: `bug-118`, `bug-126`, `bug-072`, `bug-131` and the dirty-tree `submit`
question, which need behaviour changes and stay in v0.3.

## Pillar Focus

**Pillar 1 (Project Memory)** is where most of the patch lands: the configuration root that the
Memory verbs read, the `service` type, the `kind` field that lets a patch be a `release` at all, and
the bug machine's won't-fix exit. The rest is packaging and first-use polish on P2 and P5. The patch
matters less for what it adds than for what it unblocks: after it, WingFoil's own Memory is operated
through its own verbs, and every later publish goes through staging.

## Success Criteria

- The configuration lives at the repository root; `wingfoil memory history` and the gated verbs run
  on this repository's own Memory (`bug-075` closed).
- A pinned, released build of `wingfoil` develops WingFoil, and `.mcp.json` registers its MCP server.
- `wingfoil@0.2.2` is published through npm staged publishing, with provenance, from the `v0.2.2`
  tag on the pushed `main`.
- The published package carries its discovery metadata and URLs that match the renamed repository.
- Every bug scheduled into v0.2.2 is `closed`; `npm test` green; coverage >80% and not regressing.
- Every `release-cycle` phase except `retrospective` has a `done` plan under
  `docs/05_plans/rl-v1/rel-v0.2.2/` (`dl-092` Q2 (ii)).

## Execution Notes

<!-- Running log of what actually happened during this release's workflow — filled in
     incrementally as each phase runs, not written after the fact. Raw material for the
     retrospective (docs/04_memory/design/dls/{id}.md), not the retrospective itself: capture
     what happened here; save "why it matters going forward" for the retrospective. -->

### Planning (release-planning)

- **identify-specs (2026-09-29).** No new spec. Amended in place: `spec-015`, `spec-001`, `spec-010`.
  Recorded: `adr-011`, which replaces `adr-009` points 4–5. Found late: no Node 22 release bundles
  npm 11, so `promote` needs Node ≥ 24.18.0.
- **build-backlog (2026-09-29): 14 tasks, `task-109` … `task-122`**, grouped by §6.8 step:
  - step 1: `task-109` (`bug-137`);
  - step 2: `task-110` (`dl-107`), `task-111` (`bug-075`), `task-112` (`dl-095` with `dl-026`);
  - step 3: `task-113` (`adr-011`/`dl-087`, `bug-136`);
  - step 5: `task-114` (`dl-123`), `task-115` (`dl-093`/`dl-091`), `task-116` (the slug after the
    transfer), `task-117` (`bug-138`), `task-118` (`bug-139`), `task-119` (`bug-140`, `bug-129`),
    `task-120` (`bug-128`), `task-121` (`dl-096`), `task-122` (`bug-021`, added after a re-read on
    the approver's request: its Expected Behavior needs a configuration change, so it is not a
    closure with no code as the retrospective's row 27 had it).
- **In scope, with no task:**
  - `dl-088` is implemented out of flow as a configuration change in step 4, the route ratified as
    (a);
  - `dl-092` is already in configuration;
  - `dl-094` needs no `.mailmap` (b), and its remedy (ii) goes to `dl-119`'s directive in v0.3;
  - `bug-092` closes with no code, by the approver's reject once `task-114` lands.
- **Budget (`dl-096`, measured velocity).** 14 tasks ÷ 6.5 per active day ≈ **2.2 active days**,
  against `dl-096`'s proxy of ≈ 4. The difference is the size of `task-111`: one task, but the
  largest single change of the patch (32 test files, 206 Memory documents). The task count
  underweights it. Expect nearer the proxy than the count.

### Implementation (dev-loop, per task)

<!-- Recurring blockers across tasks, tech-specs revised mid-release, review rejections and why,
     anything that deviated from the plan in Scope/Pillar Focus above. -->

### Submit & Publishing

<!-- pre-release-checks failures and fixes, approve-release rejections, publishing issues. -->
