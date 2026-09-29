---
id: "task-124-the-service-memory-type"
type: task
title: "A `service` Memory type records the state WingFoil depends on outside the repository, with its ingest workflow and the first services registered"
status: pending
release: "v0.2.2"
priority: "medium"
tags: ["v0.2.2", "memory", "config", "service", "operations"]
ref: "dl-088-a-memory-type-for-state-that-lives-outside-the-repository"
bug: []                # optional — LIST of bug ids this task closes (dl-045). Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here can never leave `triaged`. A single string is still accepted for documents predating dl-045.
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-111-configuration-moves-to-the-repository-root", "task-123-template-paths-are-relative-to-the-config-root", "task-114-bug-decline-edges-from-triaged-and-planned"]
tmpl_version: 260703   # Orignal template version
---

## Description

`dl-088` (`ready`, `release: v0.2.2`) adds a Memory type, `service`: one unit of state outside the
git repository that the project owns, depends on, or presents itself through. Examples are an
account, a credential held by reference, a registry listing, a platform setting, a domain or a
handle. Its ratification (`e6074c94`) chose state machine (a) `draft → pending → active`, edits to an
`active` service as `docs(self)` commits until `dl-079` settles, and implementation route (a), out of
flow.

**Why a task.** On 2026-09-29 the approver replaced route (a) with a task in the v0.2.2 dev-loop, so
the change goes through the review gate like the rest of the patch. It is §6.8 step 4 of the
retrospective's order. It runs after `task-114`, because both edit `.wingfoil/memory.yaml` and its
`version`.

The shape is `dl-088` §Decision: the `memory.yaml` entry, the frontmatter table, the four body
sections and the security rule.

## Acceptance Criteria

1. `.wingfoil/memory.yaml` gains the `service` type as `dl-088` declares it, annotated `[AUTHORING]`
   citing `dl-088`, with a `version` bump. The machine is `sequence: [draft, pending, active]` with
   `gates.pending.reject: draft`. **Deviation from the text of `dl-088`:** `template.file` is
   `memory/templates/service.md`, relative to the configuration root (`spec-001`, `bug-156`), not the
   `.wingfoil/…` path `dl-088` quotes. *Configuration.*
2. `.wingfoil/memory/templates/service.md` carries the frontmatter of `dl-088`'s table (required
   `title, provider, kind, owner_role, verify`; optional `url, account, renews, repo_refs, decision,
   release`) and the four body sections (Purpose, Configuration, Verification, Management). Its
   comments state the security rule: a `service` never holds a secret value.
3. A `service-ingest` main (`.wingfoil/workflows/custom/service-ingest.yaml`) with `capture`
   (`memory.add` + `memory.submit`, and the `spec-007` scan among `checks.post`), then `approve` by
   the `approver`. It is registered in `.wingfoil/workflows.yaml`, and `workflow list` shows it.
4. Tests on the real, committed configuration. *Red-first:* `service` resolves its scaffold (the
   `task-123` test covers every type), and its machine is `draft → pending → active`, with `reject`
   from `pending` landing on `draft` and `approve` from `active` illegal. On a throwaway clone,
   `memory add --type service` with the pinned build (`npm run -s wingfoil -- …`) creates
   `svc-001-…` under `docs/04_memory/services/`.
5. The type lists are updated wherever they enumerate the Memory types, each with its
   `doc-versioning` bump where it has a version:
   - `.wingfoil/README.md`;
   - `spec-001-memory-yaml-schema` (a dated revision note; the approver signs it at review);
   - `spec-011-storage-layout`'s tree, for the two new files;
   - `CLAUDE.md` §3 and the §5 type table;
   - `docs/user-guide.md` / `docs/cli-reference.md` if they list the types.
   The list is re-derived with `grep -rn "decision-log, tech-spec\|release-line, release" --include=*.md`
   when the task runs, not taken from this AC.
6. **First services registered** through `service-ingest` (`add → submit`, to `pending`; the
   approver runs each `verify` and approves after the review). The candidates are the ones in
   `release-planning-rel-v0.2.2-plan` §"Visibility session outcome" B.1–B.4 and `dl-088`'s backfill
   list. They include the GitHub organisation `wingfoil`, the npm organisation `wingfoilhq`, the
   repository and its settings, the npm package `wingfoil`, and the `npm-publish` environment.
   `NPM_TOKEN` is registered only if it still exists (`adr-011` removes it; `task-113` dropped its use).
   None holds a secret value, and the `spec-007` scan runs on each. The ids are the ones the CLI
   returns.
7. `npm test` green; coverage not regressing; `workflow list` and `check:mcp` exit 0.

## Implementation Notes

- The ids come from `memory add` at commit time (agreement with the parallel viewer session,
  2026-09-29). `services/` is a new directory, so the `{n}` counter starts clean (`bug-087` needs a
  gap to fire).
- The `retrospective` check on `renews` is `dl-088`'s non-blocking follow-up, and it is not in this
  task.
- Registering the benchmark repository is v0.3 (`dl-089`).

## Execution Notes

<!-- Running log of what actually happened during this task's dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
