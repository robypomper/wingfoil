# Changelog

All notable changes to WingFoil are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Every entry ends with the WingFoil Memory element(s) it comes from: a `done` task (`task-NNN`) or a
`closed` bug (`bug-NNN`).

## [0.2.0] - Unreleased

The Project Directives release: the Memory state-transition verbs, the full Directives pillar, a
mutation surface for Project DNA, and role Prompts on the MCP server.

### Added

#### Memory

- `wingfoil memory submit <id>` moves a document from `draft` to its type's post-submit state and
  records the transition as one `wf(<type>): submit <id>` commit. A later submit clears any
  `rejection_reason` left by a reject. (task-045)
- `wingfoil memory approve <id> --reason <text>` advances a document through an approval gate. The
  commit records the approver's identity (`Approver: Name <email> (role)`), the reason, and the
  `[from → to]` transition in its subject; the timestamp is the commit's own. (task-046)
- `wingfoil memory reject <id> --reason <text>` sends a document back to its type's reject target,
  records the same `Approver:`/`Reason:` trailer, and copies the reason into the document's
  `rejection_reason` frontmatter field. (task-047)
- `wingfoil memory deprecate <id> [--reason <text>]` retires a document from any state to
  `deprecated`; the file stays in place. (task-048)
- `wingfoil memory history <id>` returns the document's audit trail in chronological order: one
  entry per commit with sha, author, ISO-8601 timestamp, operation, `from`/`to` state, approver and
  reason. (task-049)
- A reason may span several lines and paragraphs; `memory history` returns it whole. (task-072)
- Only a team member holding the `approver` role in `dna.yaml` can approve or reject; otherwise the
  verb fails with `user not authorized to approve type '<type>'` (exit 1). Approval authority is bound
  to roles, never to named people, and an AI agent's `executes_as: [approver]` grants no authority.
  (task-034, task-040, task-046)
- Each transition verb validates the document's current `status` against its type's state machine
  and refuses a state the machine does not declare, or a transition it does not allow (exit 1).
  (task-036)

#### Directives

- `wingfoil directive create --name <name>` creates a custom directive under
  `.wingfoil/directives/custom/` and commits it. (task-050)
- `wingfoil directive assign --directive <id>[,<id>...] --role <role>` binds one or more directives
  to a role in `roles.yaml` and commits the change; an unknown role is refused. (task-051, task-056)
- `wingfoil directive remove <name>` deletes an unassigned custom directive and commits the removal.
  A directive still assigned to a role is refused with
  `cannot remove '<name>': still assigned to role '<role>'`. (task-052)
- `wingfoil directives list [--role <role>]` lists every directive with its role assignments
  (`global (all roles)` for global ones), plus a `warnings` list. (task-053)
- `wingfoil init` now installs six built-in directive templates under
  `.wingfoil/directives/built-in/` — `code-quality`, `testing`, `code-review`, `architecture`,
  `security`, `documentation` — next to a git-tracked `.wingfoil/directives/custom/`.
  (task-054, task-057)
- A custom directive with the same id as a built-in one takes precedence, and the shadowing is
  reported as a warning naming both files and the one in use. (task-055)

#### DNA

- `wingfoil dna add|update|remove <path> --value <v>` edit collections and lists in `dna.yaml`: add a
  team member or a role, update a field of an entry, remove an entry. `add` and `update` accept
  `--entry-<field>` options for the fields the target collection declares (for example
  `--entry-email`, `--entry-roles`). This gives the first CLI path to seed the approver.
  (task-093, bug-083)
- Path segments can be quoted, so entries whose name contains a dot are addressable, e.g.
  `wingfoil dna update 'stacks.technologies."Node.js".version' --value 24`. (task-099, bug-091)

#### Interaction layer (MCP)

- The MCP server (`wingfoil mcp`) now serves one read-only Prompt per role, named `{role}-session`,
  that embeds the role's assigned directives plus the global ones. A request for an undefined role
  is refused. (task-039, task-058, task-037)

#### Packaging

- The npm package ships an MIT `LICENSE` file and declares `repository`, `homepage`, `bugs` and
  `author`; it is published publicly with npm provenance. (task-059, task-070)

### Changed

- **Node.js 22.12.0 or later is now required** (`engines.node: ">=22.12.0"`). 0.1.0 declared
  `>=18`, which its own dependencies did not accept. (task-074, bug-023)
- **Breaking:** `wingfoil dna set` takes its value as an option — `dna set <path> --value <v>` —
  instead of a second positional (`dna set <path> <v>` in 0.1.0): the positional is always the target,
  options are attributes. (task-093)
- `wingfoil dna set <path> --value <v>` writes scalar fields only. For a collection or list it now
  answers with the `dna add|remove|update` command to use. A path that does not resolve to a declared
  field is refused instead of creating an unschema'd key. (task-093, bug-084)
- `wingfoil memory search` leaves out archived documents (`deprecated`, `superseded`) by default;
  ask for them explicitly with `--status deprecated` or `--status superseded`. (task-038, task-069)
- The MCP `wingfoil://memory/{type}` collection Resource leaves out archived documents too, so an
  agent reads the same set as a default `memory search`. (task-069, bug-010)
- Commands resolve their configuration from the last commit (`HEAD`), not from uncommitted edits:
  the state machine and type registry in `memory.yaml` (including `memory add`'s `path` and
  `template`), the role catalogue and approval authority in `dna.yaml`, and the directive inventory
  that `directive assign` and `directive remove` check. Commit configuration changes before relying
  on them. (task-090, task-091, task-095, task-096, bug-079, bug-081, bug-082, bug-085, bug-086)
- Usage errors now all exit `2` with an `error:` line: an unknown command, an unknown option, and a
  command group invoked without a subcommand (for example `wingfoil dna`). (task-101, task-103,
  bug-098, bug-103)

### Fixed

- A project created by `wingfoil init` can run every Memory transition verb: the scaffolded
  `memory.yaml` now carries a state machine. (task-071, bug-030)
- `wingfoil init` writes directive files that pass the directives schema, so `directives list` works
  on a fresh project. (task-064, bug-006)
- `wingfoil dna set` preserves comments in `dna.yaml`. (task-063, bug-004)
- Frontmatter edits made by the transition verbs keep the rest of the YAML intact (inline comments,
  column-0 comments inside sequences, values without a trailing newline). (task-047, bug-041)
- Memory commits contain only the element's own file; files you had already staged no longer ride
  into a `wf(...)` commit. (task-045, bug-027)
- `wingfoil memory history` no longer reports the commit of the type's template as an entry of the
  element. (task-089, bug-077)
- `wingfoil memory history` reports correct states for an element that was renamed, and no longer
  prints git's `fatal:` output to the terminal. (task-097, bug-080, bug-071)

### Security

- `approve`, `reject` and `deprecate` commit the status change and nothing else. If the document has
  uncommitted edits, the verb refuses (exit 1) and asks you to commit or stash them first.
  (task-088, bug-076)
- `init`, `memory add`, `dna` and `directive` commands refuse a target file that has uncommitted
  changes they did not make, so an unrelated edit cannot enter the audit trail under their commit.
  (task-092, bug-078)
- `--reason` has a declared shape: it may not be blank, and no line may start with `Approver:` or
  `Reason:`. Violations exit `2`. This stops a reason from forging an approval record, which matters
  most on `deprecate` because it writes no `Approver:` line. (task-041, task-072, bug-042)
- A reason containing git-log framing control characters can no longer fabricate a
  `memory history` entry. (task-086, bug-050)
- Memory writes stay inside the project root. A Memory directory that is a symlink leaving the
  project is refused with `E_PATH_ESCAPES_ROOT`, and a symlinked document file is not followed.
  (task-105, task-106, bug-117, bug-120)
- `wingfoil directive remove` refuses before deleting anything when the directive resolves outside
  the project root, for example through a symlinked `directives/custom/`. (task-102, bug-044)
- Built-in directives cannot be removed (`built-in directives cannot be removed`), and `init` checks
  the integrity of the built-in templates on every write path before installing them.
  (task-042, task-044, task-054, bug-018)

## [0.1.0]

The Project Memory + DNA release. It was completed but not published to npm.

### Added

#### Command line

- The `wingfoil` CLI, installed from npm as the `wingfoil` bin, with global options
  `--format console|json|yaml`, `--verbose`, `--no-color` and `--no-interactive`. (task-001,
  task-006, task-007, task-013)
- Exit-code contract: `0` success, `1` operation or validation failure, `2` usage or integrity error.
  (task-012)
- `wingfoil init [--template Scrum|Kanban]` scaffolds `.wingfoil/` (`dna.yaml`, `memory.yaml`,
  Memory templates, `roles.yaml`, workflows) in the current git repository and commits it; without
  `--template` it asks interactively. (task-029)

#### Memory

- Git-backed Memory: every document is a Markdown file whose state lives in its frontmatter, and
  every mutation is a git commit with author and timestamp. (task-003, task-018, task-019, task-022)
- `memory.yaml` declares the element types, their paths, id patterns, templates and per-type state
  machines, with a default machine for types that declare none. (task-005, task-010, task-024)
- `wingfoil memory add --type <type> --title <title> [--tags ...]` creates a document from its type's
  template and commits it. Mutating commands require a configured git identity (`user.name` and
  `user.email`). (task-014, task-020)
- `wingfoil memory search [query] [--tag] [--status] [--type]` keyword search over Memory.
  (task-021, task-023, task-008)

#### DNA

- `dna.yaml`, the Project DNA: modules, stacks (technologies and methodologies), team and roles, and
  resource paths, validated on read. (task-027, task-002)
- `wingfoil dna show [section]` and `wingfoil dna set <path> <value>`. (task-025, task-026)
- `wingfoil paths [category] [--list]` returns the resource paths by category (`sources`, `tests`,
  `docs`, `config`, `governance`). (task-028)

#### Directives and Workflow

- `wingfoil directives list` and `wingfoil workflow list`, read-only. (task-006)

#### Interaction layer (MCP)

- `wingfoil mcp` starts an MCP server over stdio exposing read-only Resources:
  `wingfoil://dna`, `wingfoil://dna/{section}`, `wingfoil://memory/{type}`,
  `wingfoil://memory/{type}/{id}`, `wingfoil://workflows`, `wingfoil://workflows/{name}`. The server
  exposes no write path. (task-009, task-011, task-016, task-030)

### Fixed

- `wingfoil --version` prints the version and exits `0`. (bug-001)
- Running outside a git repository fails with an `error:` line and the documented exit code instead
  of a stack trace. (bug-002)
- `wingfoil init` scaffolds a `dna.yaml` and `memory.yaml` that pass their own schemas, so
  `dna show`, `dna set`, `paths` and `memory add` work on a fresh project. (bug-005)
