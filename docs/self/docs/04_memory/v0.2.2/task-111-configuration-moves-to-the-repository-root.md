---
id: "task-111-configuration-moves-to-the-repository-root"
type: task
title: "The configuration moves to the repository root, so the Memory verbs run on this repository's own Memory"
status: backlog
release: "v0.2.2"
priority: "high"
tags: ["v0.2.2", "config", "dogfooding", "memory"]
ref: "bug-075-memory-verbs-cannot-read-this-repos-own-memory"
bug: ["bug-075-memory-verbs-cannot-read-this-repos-own-memory"]
depends_on: ["task-109-transition-brackets-accept-the-ascii-arrow", "task-110-memory-add-keeps-version-dots-and-sources-every-id-token"]
tmpl_version: 260703
---

## Description

The Memory verbs shipped in v0.2 cannot be pointed at this repository's Memory. The configuration
lives under `docs/self/.wingfoil/`, while the CLI resolves it from the git root, and running from
`docs/self/` is refused as not-at-git-root (`bug-075`). So every operation on WingFoil's own Memory
is still done by hand.

The retrospective chose the remedy and its timing (`retrospective-rel-v0.2-plan` §6.8 step 2). The
configuration moves to the repository root, as the patch's first structural step, so v0.2.2 and v0.3
both write Memory at the new location and nothing has to be migrated twice. **v0.3 may start once
this task is on `main`** (the `dl-092` parallel-release rule). This closes `bug-075`.

## Acceptance Criteria

1. `docs/self/.wingfoil/` becomes `.wingfoil/` at the root, and `docs/self/docs/04_memory/` becomes
   `docs/04_memory/`. Both move with `git mv`, so that `wingfoil memory history --follow` keeps each
   element's history across the move. That is checked on at least one element of each type.
2. At the root, with the build under development, `wingfoil memory history <id>` and
   `wingfoil memory search` answer on this repository's own Memory. The `wf()` transitions come back,
   in both arrow forms (`task-109`). *Red-first* (today they fail).
3. Every test that loads the real configuration loads it from the root. Before: 32 test files cite
   `docs/self` (`grep -rl "docs/self" test/ | wc -l` on 2026-09-29). After the task, the same command
   returns 0, unless a remaining hit is justified in Execution Notes.
4. Durable citations of moved paths are updated in the Memory documents and plans that cite them
   (206 files under `docs/self/docs/04_memory/` cite `docs/self` on 2026-09-29). Historical quotes,
   such as commit subjects or text quoted verbatim, stay as written.
5. The comments and README that describe the config root are corrected: `memory.yaml`'s
   "resolved against the docs/self/ dogfooding root", and `.wingfoil/README.md`. `CLAUDE.md` §3, §5
   and §5.1 get only the path corrections that keep them true. Their full realignment belongs to the
   `user-docs` phase's `align-agent-docs` step (`dl-025`).
6. The non-configuration files under `docs/self/` (`X_wingfoil-init-plan.md`, `WORKFLOW.md`, and any
   others `ls docs/self` shows) are each either moved or left with a pointer. Every choice is listed
   in Execution Notes.
7. `npm test` green; coverage not regressing; `tsc --noEmit` clean.

## Implementation Notes

- The move is large. Land it as one reviewable change, with the rename commits separate from the
  content edits, so the review can check that the renames are pure (`git diff -M --stat`).
- Check `.gitignore` and `package.json` `files` (today `["dist", "README.md"]`), so the root
  `.wingfoil/` and `docs/04_memory/` never enter the tarball.
- The pinned released build (`task-112`) does not exist yet. Verify with the build under development,
  and say so in Execution Notes.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
