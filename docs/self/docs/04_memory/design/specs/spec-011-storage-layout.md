---
id: spec-011-storage-layout
type: tech-spec
title: ".wingfoil/ directory layout and initialization detection"
status: pending
scope: "docs/self/.wingfoil/"
supersedes: ""
tmpl_version: 260703
---

## Context

Every WingFoil pillar (Memory, DNA, Directives, Workflow) persists its configuration as files under
`.wingfoil/` (REQ-SYS-01: git-backed single source of truth; REQ-SYS-02: pillars as decoupled,
independently loadable artifacts). Multiple tasks and future tooling (`wingfoil init`, the config
loader, the MCP server's resource layer) all need to agree on: which top-level files exist, how the
`built-in/` vs `custom/` split works for directives and workflows, where Memory templates live, and
— critically — how a running `wingfoil` process finds the project root and decides whether it is
already initialized. Without a single shared definition of this layout, different tasks would
re-implement path resolution and init-detection with subtly different (and divergent) rules, breaking
REQ-SYS-01's fit criterion that a fresh `git clone` reconstructs 100% of pillar state with no external
source.

This spec is scoped to `docs/self/.wingfoil/` — the actual, current, hand-authored dogfooding
directory (see `docs/self/.wingfoil/README.md`) — not a hypothetical repo-root layout. It documents the
layout **as it exists today** on the `design/initial-design` branch and defines the root-detection /
init-marker algorithm the (not-yet-built) `wingfoil` tool must use once this directory moves to the
repository root.

## Specification

### Directory layout (ground truth: `docs/self/.wingfoil/`, verified via `find docs/self/.wingfoil -maxdepth 4`)

```
docs/self/.wingfoil/                  ← WingFoil root for the dogfooding setup (temporary location;
│                                        moves to repo-root .wingfoil/ once the tool exists — see README.md)
├── README.md                         ← human-facing layout doc + rationale (this spec formalizes it)
├── dna.yaml                          ← Project DNA (P2.4): modules, stack, team & roles, conventions
├── memory.yaml                       ← Memory element registry (P1.13): per-type path/state machine/template
├── roles.yaml                        ← Directive role assignments (P3.2/P3.7): role → directive list
├── workflows.yaml                    ← Workflow main config (P4.1): version + includes: [...] list
├── directives/
│   ├── built-in/                     ← Official P3.8 templates; EMPTY today (only a .gitkeep) —
│   │                                    not yet implemented, see README.md "interim decision"
│   └── custom/                       ← P3.5 rules + P3.8 stand-ins (kind: custom, ref: [P3.8])
│       ├── architecture.md
│       ├── code-quality.md
│       ├── code-review.md
│       ├── determinism.md
│       ├── doc-versioning.md
│       ├── documentation.md
│       ├── security.md               ← generic P3.8 stand-in (unassigned in roles.yaml)
│       ├── security-secrets.md        ← WingFoil elaboration (assigned globally)
│       ├── testing.md
│       └── traceability.md
├── memory/
│   └── templates/                    ← One scaffold per Memory element type (P1.13); consumed by
│       │                                `memory.add` when creating a new draft file
│       ├── adr.md
│       ├── bug.md
│       ├── decision-log.md
│       ├── release-line.md
│       ├── release.md
│       ├── task.md
│       └── tech-spec.md
└── workflows/
    ├── built-in/                     ← Official workflow templates; EMPTY today (only a .gitkeep)
    └── custom/                       ← All 4 startable mains + every sub-workflow (P4.1)
        ├── sw-life-cycle.yaml         (kind: main — the end-to-end lifecycle)
        ├── bug-ingest.yaml            (kind: main)
        ├── decision-log-ingest.yaml   (kind: main)
        ├── adr-ingest.yaml            (kind: main)
        ├── lean-inception.yaml        (kind: sub)
        ├── specification-downcast.yaml
        ├── user-story-mapping.yaml
        ├── specification-by-examples.yaml
        ├── volere-requirements.yaml
        ├── backlog-export.yaml
        ├── wingfoil-init.yaml
        ├── initial-design.yaml
        ├── release-line-cycle.yaml
        ├── release-cycle.yaml
        ├── release-planning.yaml
        ├── dev-loop.yaml
        ├── release-submit.yaml
        ├── release-publishing.yaml
        ├── retrospective.yaml
        └── end-of-life.yaml           (kind: sub, all remaining files)
```

Note: `docs/self/.wingfoil/` does **not** currently contain an `agents.yaml` file, an
`.assignments.yaml` file, or a flat `memory/<type>/` content subtree — these appeared in an earlier
draft pass and are superseded by the files actually present: role→directive
bindings live in top-level `roles.yaml`, and Memory element **content** (as opposed to templates)
resolves via the per-type `path` pattern declared in `memory.yaml` against the `docs/self/` root (e.g.
`docs/04_memory/planning/{id}.md` → `docs/self/docs/04_memory/planning/{id}.md`), landing under
`docs/self/docs/04_memory/`, not inside `.wingfoil/`.

### Top-level config files

| File            | Pillar             | Contract |
|------------------|---------------------|----------|
| `dna.yaml`       | DNA (P2.4)          | Modules, tech stack, team & roles, conventions, resource `paths:` (query categories `sources, tests, docs, config, governance`) |
| `memory.yaml`    | Memory (P1.13)      | `types:` map — one entry per element type, each declaring `path` (must contain `{id}`), `states` (values/initial/transitions), and `template:` (`frontmatter.required` + `file:` pointing into `memory/templates/`) |
| `roles.yaml`     | Directives (P3.2/P3.7) | `assignments:` map (role → list of directive names) + a `global:` list applied to every role |
| `workflows.yaml` | Workflow (P4.1)     | `version:` + `includes:` — an ordered list of paths under `workflows/custom/` (and, once populated, `workflows/built-in/`); this file inlines nothing itself, it only composes |

Each of these four files is independently loadable and schema-validated (REQ-SYS-02): editing
`roles.yaml` must not require touching `workflows.yaml`, and vice versa.

### `directives/{built-in,custom}/` split

- `built-in/` — reserved for the official P3.8 directive templates shipped by the `wingfoil` npm
  package once implemented. Today it contains only `.gitkeep` (empty).
- `custom/` — every directive file that exists right now, including the six P3.8 **stand-ins**
  (`code-quality`, `testing`, `code-review`, `architecture`, `security`, `documentation` — each
  authored with `kind: custom`, `ref: [P3.8]`) plus WingFoil-specific rules (`determinism`,
  `doc-versioning`, `security-secrets`, `traceability`). `roles.yaml` binds by directive **name**,
  independent of which of the two subdirectories currently holds the file — so promoting a stand-in
  from `custom/` to `built-in/` later requires no change to `roles.yaml`.

### `workflows/{built-in,custom}/` split

- `built-in/` — reserved for official workflow templates shipped by the npm package; empty today
  (`.gitkeep` only).
- `custom/` — every workflow file that exists today: 4 startable `kind: main` workflows
  (`sw-life-cycle`, `bug-ingest`, `decision-log-ingest`, `adr-ingest` — REQ-STATE-03 permits multiple
  open mains) plus every `kind: sub` workflow they compose via `include()` (REQ-SYS-06). `sub`
  workflows cannot be started directly; only `workflows.yaml`'s `includes:` list — not the
  subdirectory a file lives in — determines what is loaded.

### `memory/templates/`

One Markdown scaffold per Memory element type declared in `memory.yaml`'s `types:` map — currently
`adr.md`, `bug.md`, `decision-log.md`, `release-line.md`, `release.md`, `task.md`, `tech-spec.md`.
Each scaffold's frontmatter skeleton must satisfy that type's `template.frontmatter.required` list in
`memory.yaml` (the P4.12 alignment rule: workflow steps calling `memory.add` declare
`checks.post: ["frontmatter.required: [...]"]` and that list must match this file). `memory.add`
copies the scaffold verbatim to the type's `path` (resolved elsewhere — Memory element **content**
lives outside `.wingfoil/`, per the per-type `path` pattern in `memory.yaml`; this directory holds only
the templates consumed to create new drafts, never the elements themselves).

### Git-root detection algorithm

```ts
// Walk up from CWD looking for a `.git` entry. WingFoil must be invoked at the exact git
// root — no upward search for `.wingfoil/` itself, only for `.git`.
function findGitRoot(cwd: string): string | null {
    let dir = cwd
    while (true) {
        if (fs.existsSync(path.join(dir, '.git'))) return dir
        const parent = path.dirname(dir)
        if (parent === dir) return null   // reached filesystem root without finding .git
        dir = parent
    }
}

const root = findGitRoot(process.cwd())
if (root === null) throw new Error('E_NO_GIT_ROOT: not inside a git repository')
if (root !== process.cwd()) throw new Error('E_NOT_AT_GIT_ROOT: run wingfoil from the project root')
```

`.wingfoil/` must live at that same root, one level below the directory containing `.git/`. Nested
`.wingfoil/` directories (a subdirectory of the project already containing its own `.wingfoil/`) are
not supported — at most one WingFoil root per git root.

### Initialization-marker detection algorithm

A project is WingFoil-initialized when `.wingfoil/` exists **and** contains at least one file:

```ts
function detectInitState(root: string): 'absent' | 'incomplete' | 'initialized' {
    const wfDir = path.join(root, '.wingfoil')
    if (!fs.existsSync(wfDir)) return 'absent'
    const entries = fs.readdirSync(wfDir)
    return entries.length > 0 ? 'initialized' : 'incomplete'
}
```

| `detectInitState` result | Interpretation                | Action                                       |
|---------------------------|-------------------------------|-----------------------------------------------|
| `absent`                  | Not initialized               | Suggest `wingfoil init`                       |
| `incomplete`               | `.wingfoil/` exists but empty | Warn "incomplete init"; suggest `--repair`    |
| `initialized`              | Ready                         | Proceed normally                              |

This check is intentionally shallow (top-level non-emptiness only, no deep validation of every
expected file) — deep validation of individual pillar files is each pillar's own schema-load
responsibility (REQ-SYS-02: isolated load/validate per artifact), not the init-marker's job.

### `.gitignore` policy

`.wingfoil/` must **never** appear in `.gitignore` — it is intentionally git-tracked in full (REQ-SYS-01:
git is the single source of truth; there is no external state store to fall back to). No subpath
within `.wingfoil/` is excluded.

## Consequences

- Every task that implements config loading (DNA loader, Memory registry loader, directive loader,
  workflow composer) or root/init detection must target exactly this layout — no ad hoc path
  guessing. Changing a top-level file name (e.g. `roles.yaml`) or the `built-in`/`custom` split
  requires revising this spec first, then the dependent code.
- `wingfoil init` (not yet implemented) is the eventual producer of this layout at the repository
  root; until then, this directory under `docs/self/` is the hand-authored reference implementation
  agents must keep in sync with any change to this spec.
- The MCP server's read-only Resources layer and the CLI's config-inspection commands both resolve
  paths through the algorithms defined here, keeping the dual CLI/MCP interface (REQ-SYS-05)
  consistent by construction — one root/init-detection implementation, two surfaces.
- If a future revision moves Memory documents to a different subtree convention, or introduces
  per-type content roots, this spec must be revised (or superseded) before `memory.yaml`'s `path`
  patterns change meaning.

## Process Notes

Cross-checked against the actual current tree at `docs/self/.wingfoil/` (via
`find docs/self/.wingfoil -maxdepth 4`) and against `docs/02_requirements/03_sard/01_architecture.md`
(REQ-SYS-01 through REQ-SYS-09).
