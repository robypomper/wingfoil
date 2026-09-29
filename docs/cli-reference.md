# WingFoil CLI reference

Every `wingfoil` command in release **0.2.2**, one entry each. For a guided, step-by-step introduction
read the [user guide](user-guide.md); for runnable scenarios see [`examples/`](examples/).

> This reference is checked against the CLI by `test/docs/cli-reference.test.ts`: every shipped command
> has exactly one `### wingfoil …` entry below, and no entry documents a command that does not ship.
> `wingfoil --help` and `wingfoil <noun> --help` list the same surface. New in 0.2.2: each command's
> `--help` opens with the first sentence of its entry, names its argument as the entry does, and shows
> one example and the exit codes.

---

## Conventions shared by every command

### Where to run it

Run `wingfoil` from the **root of a git repository** that has been initialized with `wingfoil init`.
Outside a git repository a command fails with `error: E_NO_GIT_ROOT: not inside a git repository`; in a
subdirectory it fails with `error: E_NOT_AT_GIT_ROOT: run wingfoil from the project root` (both exit `1`).

### Argument grammar

- **The positional argument is the target** — the thing the command acts on: a document id
  (`memory submit task-001-my-first-task`), a DNA path (`dna set project.name`), a section or category
  (`dna show project`, `paths sources`), a directive name (`directive remove api-style`).
- **Options are attributes** — the values the command writes or filters by (`--value`, `--reason`,
  `--type`, `--role`, …).
- A **DNA path** is dotted: `project.name`, `modules.api`, `stacks.technologies.TypeScript`. A segment
  that itself contains a dot is quoted: `'stacks.technologies."Node.js"'` (quote the whole argument for
  your shell, and the segment with double quotes inside it).
- A list value is comma-separated: `--tags demo,quickstart`, `--entry-roles approver,developer`.

### Global options

Accepted by every command:

| Option | Effect |
|---|---|
| `--format <console\|json\|yaml>` | Output format. `console` (default) prints indented JSON; `json` prints compact single-line JSON; `yaml` prints YAML. `json`/`yaml` write only the result — nothing else — so scripts can parse stdout directly. |
| `--verbose` | Emit diagnostic logs to stderr. |
| `--no-color` | Disable ANSI colors. |
| `--no-interactive` | Fail on a missing argument instead of prompting for it. |
| `-h`, `--help` | Show help for the command. |
| `-V`, `--version` | Print the version (top level only). |

### Exit codes

Every invocation ends with exactly one of three codes:

| Code | Meaning | Example |
|---|---|---|
| `0` | Success — including a search that matches nothing | `wingfoil memory search nothingmatches` |
| `1` | The request was well-formed but cannot be carried out | `wingfoil memory submit task-999-nope` → `error: document not found: task-999-nope` |
| `2` | The command line itself is wrong: unknown command, missing or blank argument, invalid value | `wingfoil memory add --type task` → `error: missing required argument: --title` |

A non-zero exit always prints one `error: <reason>` line to stderr — or, under `--format json`/`yaml`,
the object `{"error": "<reason>"}`.

### Git side effects

Every command that changes the project writes **exactly one git commit**, authored by your git identity.
Read-only commands never commit. The commit subject is listed per command below; `wingfoil memory
history` reads the Memory ones back.

A command reads WingFoil's configuration (`dna.yaml`, `memory.yaml`, `roles.yaml`, directives) **as
committed at `HEAD`**. If you edit a configuration file by hand, commit it before running the command
that depends on it — otherwise the command fails and says the change is not committed.

### Git identity

Every command that commits requires `git config user.name` and `git config user.email` to be set.
`memory approve` and `memory reject` additionally require that identity's email to belong to a
`team.members` entry holding the `approver` role in the committed `dna.yaml` (see
[`memory approve`](#wingfoil-memory-approve)).

---

## Setup

### `wingfoil init`

Scaffold `.wingfoil/` in the current git repository and commit it.

```
wingfoil init [--template <Scrum|Kanban>]
```

| Option | Description |
|---|---|
| `--template <name>` | Methodology template: `Scrum` or `Kanban` (`init --help` lists them). Omit it in a terminal to be prompted; required without a terminal or with `--no-interactive`. |

Creates `.wingfoil/dna.yaml`, `memory.yaml` (+ `memory/templates/`), `roles.yaml`, the six built-in
directives in `directives/built-in/` plus four starter custom directives in `directives/custom/`,
`workflows.yaml` (+ `workflows/custom/`). The two templates differ only in the delivery sub-workflow
(`scrum-delivery` vs `kanban-delivery`) and in `project.methodology` / `stacks.methodologies`.

- **Output:** `{ root, template, files: [...] }` — the files it created.
- **Commit:** `chore(wingfoil): initialize .wingfoil/ with the <Template> template (P5.1.1)`
- **Errors:** already initialized → exit `1` (`error: WingFoil already initialized (to change its
  configuration, edit the files under .wingfoil/ and commit them, or use the wingfoil dna and wingfoil
  directive commands)`); `--template` omitted without a terminal or with `--no-interactive` → exit `2`
  (`error: missing required argument: --template (one of: Scrum, Kanban)`); unknown template → exit `2`
  (`error: unknown template "Foo", expected one of: Scrum, Kanban`); not a git repository → exit `1`.

### `wingfoil mcp`

Start the WingFoil MCP server (read-only Resources and role Prompts) over stdio. Meant to be launched
by an MCP client, not typed by hand.

```
wingfoil mcp
```

Exposes the project **read-only**: Resources for DNA, Memory and workflows, and one Prompt per role
(`<role>-session`) embedding that role's directives. It exposes no Tools — every write goes through the
CLI. See the [user guide §9](user-guide.md#9-connect-an-ai-agent) for client configuration and the
full Resource list.

---

## DNA — the project's structural map

`dna.yaml` holds `project`, `modules`, `stacks` (`technologies`, `methodologies`), `team` (`members`,
`roles`, `agents`) and `paths`. **Scalar** fields are written with `dna set`; **collections and lists**
with `dna add` / `dna update` / `dna remove`.

### `wingfoil dna show`

Print `dna.yaml`, or one top-level section of it.

```
wingfoil dna show [<section>]
```

`<section>` is a top-level key: `project`, `modules`, `stacks`, `team`, `paths`. Deeper paths are not
accepted here — `dna show team.members` fails with `error: no DNA key named 'team.members'`.

```console
$ wingfoil dna show project
{
  "name": "My Project",
  "description": "",
  "methodology": "Scrum"
}
```

- **Commit:** none.
- **Errors:** unknown section → exit `1`.

### `wingfoil dna set`

Set one scalar field.

```
wingfoil dna set <path> --value <value>
```

```console
$ wingfoil dna set project.name --value "My Project"
{
  "key": "project.name",
  "value": "My Project"
}
```

- **Commit:** `wf(dna): set <path>`
- **Errors:** `<path>` names a collection or list → exit `1`, pointing you to `dna add|remove|update`.

### `wingfoil dna add`

Add an entry to a collection, or values to a list.

```
wingfoil dna add <path> --value <name-or-values> [--entry-<field> <value> ...]
```

- When `<path>` is a **collection** (`modules`, `stacks.technologies`, `stacks.methodologies`,
  `team.members`, `team.roles`, `team.agents`), `--value` is the new entry's `name` and the
  `--entry-<field>` options set its other fields.
- When `<path>` is a **list** (`paths.sources`, …), `--value` is the value(s) to append,
  comma-separated.

| Collection | Fields (`--entry-<field>`) |
|---|---|
| `modules` | `description`, `path` |
| `stacks.technologies` | `category` (required), `version`, `notes` |
| `stacks.methodologies` | `phase`, `notes` |
| `team.members` | `email`, `roles` (comma-separated) |
| `team.roles` | `description` |
| `team.agents` | `executes_as` (comma-separated), `approval_authority` (`true`/`false`) |

```console
$ wingfoil dna add team.members --value "Ada Lovelace" --entry-email ada@example.com --entry-roles approver,developer
{
  "key": "team.members",
  "value": "Ada Lovelace"
}
$ wingfoil dna add paths.sources --value src
{
  "key": "paths.sources",
  "value": "src"
}
```

- **Commit:** `wf(dna): add <path> <value>`
- **Errors:** a field the collection does not declare → exit `1`
  (`error: '--entry-executes_as' is not a field of 'team.members' entries; they carry --entry-email, --entry-roles`);
  a required field missing → exit `1` (`error: an entry of 'stacks.technologies' requires --entry-category`).

### `wingfoil dna update`

Change fields of an existing collection entry.

```
wingfoil dna update <collection>.<name> [--entry-<field> <value> ...]
wingfoil dna update <collection>.<name>.<field> --value <value>
```

The second form sets one field of an entry; `dna set` on the same path is equivalent for a scalar
field (`dna set 'stacks.technologies."Node.js".version' --value 24`).

```console
$ wingfoil dna update modules.api --entry-description "Public HTTP API"
{
  "key": "modules.api"
}
```

- **Commit:** `wf(dna): update <path>`
- **Errors:** no entry with that name → exit `1` (`error: no entry named 'x' in 'modules'`).

### `wingfoil dna remove`

Remove a collection entry, or values from a list.

```
wingfoil dna remove <collection>.<name>
wingfoil dna remove <list-path> --value <values>
```

```console
$ wingfoil dna remove 'stacks.technologies."Node.js"'
{
  "key": "stacks.technologies.\"Node.js\""
}
$ wingfoil dna remove paths.docs --value README.md
{
  "key": "paths.docs",
  "value": "README.md"
}
```

- **Commit:** `wf(dna): remove <path>[ <value>]`
- **Errors:** no such entry → exit `1`.

### `wingfoil paths`

Print the resource paths declared in `dna.yaml` `paths:`.

```
wingfoil paths [<category>] [--list]
```

`<category>` is `sources`, `tests`, `docs`, `config` or `governance`. Without it the whole map is
printed. `--list` is accepted for a planned drill-down view, but in this release it does not change
the output.

```console
$ wingfoil paths sources
{
  "category": "sources",
  "paths": [
    "src"
  ]
}
```

- **Commit:** none.

---

## Memory — documents with a state machine

A Memory document is a Markdown file with YAML frontmatter. Its **type** (declared in `memory.yaml`)
fixes its path, its id pattern, its template and its state machine; its **state** is the `status:` field
of its frontmatter. The verbs below are the only supported way to change a state.

### `wingfoil memory add`

Create a document in its type's initial state (`draft`) from the type's template.

```
wingfoil memory add --type <type> --title <title> [--tags <t1,t2>] [--set <name>=<value> ...]
```

```console
$ wingfoil memory add --type task --title "My first task" --tags demo,quickstart
{
  "id": "task-001-my-first-task",
  "path": "docs/memory/task/task-001-my-first-task.md"
}
```

| Option | Description |
|---|---|
| `--type <type>` | The Memory type, as the committed `memory.yaml` declares it. Required. |
| `--title <title>` | The document title; also the source of the `{slug}` token. Required. |
| `--tags <t1,t2>` | Comma-separated tags, written as the `tags` list. |
| `--set <name>=<value>` | New in 0.2.2. Repeatable. Gives the `id_pattern` or `path` token `{name}` its value and writes the frontmatter field `name`, so the id and the field agree. |

The id comes from the type's `id_pattern`. For `task-{n}-{slug}` that is a per-type counter plus a
slug of the title. The slug keeps a `.` between two letters or digits (`v0.2` stays `v0.2`); every
other run of non-alphanumeric characters becomes one `-`.

Any other token in the pattern names a frontmatter field, and you give its value with `--set`. A
`release` type with `id_pattern: "{kind}-{version}"` and `path: "docs/04_memory/planning/{release-line}/{id}.md"`:

```console
$ wingfoil memory add --type release --title "v0.2.3" --set kind=patch --set version=v0.2.3 --set release-line=v1
{
  "id": "patch-v0.2.3",
  "path": "docs/04_memory/planning/v1/patch-v0.2.3.md"
}
```

The workflow tokens `{workflow}`, `{phase}` and `{scope}` are given the same way. They are written
to the frontmatter only where the type's template has a field of that name.

- **Commit:** `wf(<type>): add <id>`
- **Errors:**
  - Exit `2`: a missing `--type` or `--title`. Also a `--set` with no `=`, a name that is not a field
    name (`[a-z][a-z0-9_-]*`, so no dots), a blank value, or the same name twice. So is a name
    `memory add` fills itself: `id`, `type`, `status`, `title`, `tags`, `n`, `slug`, `date`, `author`.
  - Exit `1`: a type not in the committed `memory.yaml`. Also a `--set` name the type's `id_pattern`
    and `path` do not use, or a token left without a value
    (`missing value for token {version}: give it with --set version=<value>`).

### `wingfoil memory submit`

Move a document one step forward along its type's sequence — for the default machine, `draft → pending`.

```
wingfoil memory submit <id>
```

Before running it, fill the document's body and every frontmatter field its type lists in
`template.frontmatter.required` — you do not need to commit those edits first: the submit commit
records the document's content **and** its state change together. A submit also clears a previous
`rejection_reason`.

```console
$ wingfoil memory submit task-001-my-first-task
{
  "id": "task-001-my-first-task",
  "path": "docs/memory/task/task-001-my-first-task.md",
  "from": "draft",
  "to": "pending"
}
```

- **Commit:** `wf(<type>): submit <id>`
- **Errors:** unknown id → exit `1`; the current state is a **gate** (its forward step needs
  `memory approve`) or the end of the sequence → exit `1` (`error: illegal transition …`).

### `wingfoil memory approve`

Pass a gate: move a document forward from a gated state (default machine: `pending → approved`).

```
wingfoil memory approve <id> --reason <text>
```

Requires the **approver role**: your git email must match a `team.members` entry whose `roles` include
`approver`, in the committed `dna.yaml`:

```console
$ wingfoil dna add team.members --value "Ada Lovelace" --entry-email ada@example.com --entry-roles approver
$ wingfoil memory approve task-001-my-first-task --reason "Scope and acceptance criteria are clear."
{
  "id": "task-001-my-first-task",
  "path": "docs/memory/task/task-001-my-first-task.md",
  "from": "pending",
  "to": "approved"
}
```

- **Commit:** subject plus body

  ```
  wf(task): approve task-001-my-first-task [pending → approved]

  Approver: Ada Lovelace <ada@example.com> (approver)
  Reason: Scope and acceptance criteria are clear.
  ```

Unlike `submit`, `approve` (and `reject`, `deprecate`) records the state change **and nothing else**:
if the document has uncommitted edits the command refuses (exit `1`, `error: refusing to commit …`) —
commit or stash them first.

- **Errors:** missing `--reason` → exit `2`; blank `--reason` → exit `2`
  (`error: invalid flag value: --reason must not be blank`); not an approver → exit `1`
  (`error: user not authorized to approve type 'task'`); the state is not a gate → exit `1`
  (`error: illegal transition draft -> approved for type 'task'`).

### `wingfoil memory reject`

Send a gated document back to its gate's reject target (default machine: `pending → draft`).

```
wingfoil memory reject <id> --reason <text>
```

Same approver requirement as `approve`. The reason is recorded in the commit **and** copied to the
document's `rejection_reason` frontmatter field.

```console
$ wingfoil memory reject task-001-my-first-task --reason "Add acceptance criteria before resubmitting."
{
  "id": "task-001-my-first-task",
  "path": "docs/memory/task/task-001-my-first-task.md",
  "from": "pending",
  "to": "draft",
  "reason": "Add acceptance criteria before resubmitting."
}
```

- **Commit:** `wf(<type>): reject <id> [<from> → <to>]` with `Approver:` and `Reason:` body lines.
- **Errors:** as for `approve`.

### `wingfoil memory deprecate`

Retire a document, from any state, to `deprecated`.

```
wingfoil memory deprecate <id> [--reason <text>]
```

No approver role is required. `--reason` is optional, but when given it must not be blank.

```console
$ wingfoil memory deprecate dl-001-use-postgresql --reason "Superseded by the hosted-DB decision."
{
  "id": "dl-001-use-postgresql",
  "path": "docs/memory/decision-log/dl-001-use-postgresql.md",
  "from": "draft",
  "to": "deprecated",
  "reason": "Superseded by the hosted-DB decision."
}
```

- **Commit:** `wf(<type>): deprecate <id> [<from> → deprecated]`, with a `Reason:` body line when given.

#### Rules for `--reason` (approve, reject, deprecate)

- It may span several lines, but it may not be blank.
- No line of it may begin with `Approver:` or `Reason:` — those keys are reserved for the commit trailer.
- It may not end with a paragraph made only of `Key: value` lines; end with a sentence instead.
- Trailing whitespace is stripped, runs of blank lines collapse to one, and leading/trailing blank lines
  are dropped.

### `wingfoil memory history`

Print a document's audit trail, reconstructed from git.

```
wingfoil memory history <id>
```

Each entry carries `sha`, `author`, `timestamp` (ISO-8601), `operation`, `from`, `to`, `approver`,
`reason` and the commit `subject`. A commit that touched the document without being a WingFoil
operation (a hand edit you committed yourself) appears too, with `"operation": null`.

```console
$ wingfoil memory history task-001-my-first-task
{
  "id": "task-001-my-first-task",
  "path": "docs/memory/task/task-001-my-first-task.md",
  "entries": [
    {
      "sha": "cc871612ce9ec0120644e97e4a6281b552b99b02",
      "author": "Ada Lovelace <ada@example.com>",
      "timestamp": "2026-09-25T16:56:39+02:00",
      "operation": "add",
      "from": null,
      "to": "draft",
      "approver": null,
      "reason": null,
      "subject": "wf(task): add task-001-my-first-task"
    },
    …
    {
      "sha": "ef9669e07a182feb3bddc964aa1d7a2e16f7e7f2",
      "author": "Ada Lovelace <ada@example.com>",
      "timestamp": "2026-09-25T16:56:43+02:00",
      "operation": "approve",
      "from": "pending",
      "to": "approved",
      "approver": "Ada Lovelace <ada@example.com> (approver)",
      "reason": "Scope and acceptance criteria are clear.",
      "subject": "wf(task): approve task-001-my-first-task [pending → approved]"
    }
  ]
}
```

- **Commit:** none.
- **Errors:** missing id → exit `2`; unknown id → exit `1`.

### `wingfoil memory search`

Find documents by keyword and/or metadata.

```
wingfoil memory search [<keyword>] [--type <type>] [--status <status>] [--tag <tag>]
```

The keyword is a case-insensitive substring matched against each document's title, id, tags and body
— a title/id/tag match ranks above a body-only match. It is not semantic search. The filters narrow by
frontmatter (`--type` and `--status` exactly, `--tag` exactly). With no keyword, the filters alone
browse by metadata.

```console
$ wingfoil memory search --status approved --type task
{
  "query": "",
  "matches": [
    {
      "path": "docs/memory/task/task-001-my-first-task.md",
      "id": "task-001-my-first-task",
      "title": "My first task",
      "type": "task",
      "status": "approved",
      "tags": [
        "demo",
        "quickstart"
      ]
    }
  ]
}
```

No match is still a success (exit `0`), with `"matches": []` and
`"message": "no documents matched the query"`.

- **Commit:** none.

---

## Directives — rules bound to roles

A directive is a Markdown file under `.wingfoil/directives/built-in/` (shipped by WingFoil, cannot be
removed) or `.wingfoil/directives/custom/` (yours). `roles.yaml` binds directives to roles, plus a
`global:` list that applies to every role.

### `wingfoil directives list`

List directives with the roles each is assigned to.

```
wingfoil directives list [--role <role>]
```

Each entry carries `path`, `frontmatter` (`id`, `name`, `kind`, …), `roles`, `global` and a readable
`assignment`. `--role` keeps only the directives that apply to that role, globals included.

- **Commit:** none.

### `wingfoil directive create`

Create a custom directive from a scaffold.

```
wingfoil directive create --name <name>
```

```console
$ wingfoil directive create --name api-style
{
  "name": "api-style",
  "path": ".wingfoil/directives/custom/api-style.md"
}
```

Then write the rule into the file's body. To adapt a **built-in** directive, create a custom one with
the same id: it takes precedence, and `directives list` reports the override.

- **Commit:** `wf(directive): create <name>`
- **Errors:** missing `--name` → exit `2`; the directive already exists → exit `1`.

### `wingfoil directive assign`

Assign one or more directives to a role in `roles.yaml`.

```
wingfoil directive assign --directive <name[,name...]> --role <role>
```

```console
$ wingfoil directive assign --directive api-style --role developer
{
  "directives": [
    "api-style"
  ],
  "role": "developer",
  "assignments": [
    "code-quality",
    "testing",
    "determinism",
    "api-style"
  ]
}
```

- **Commit:** `wf(directive): assign <name> to <role>`
- **Errors:** missing option → exit `2`; role not in the committed `dna.yaml` → exit `1`.

### `wingfoil directive remove`

Delete a custom directive.

```
wingfoil directive remove <name>
```

A directive still assigned to a role is refused
(`error: cannot remove 'api-style': still assigned to role 'developer'`). There is no unassign command
in 0.2.2: delete the name from `roles.yaml`, **commit** that change, then run `directive remove`.
Built-in directives are refused (`error: built-in directives cannot be removed`).

- **Commit:** `wf(directive): remove <name>`
- **Errors:** still assigned, built-in, or unknown → exit `1`.

---

## Workflow

### `wingfoil workflow list`

Print the workflow manifest (`workflows.yaml`) and every workflow it includes, with their phases.

```
wingfoil workflow list
```

Read-only. WingFoil 0.2.2 has **no workflow engine**: workflows describe the process, and you (or your
agent) follow them by hand — see the [user guide §7](user-guide.md#7-workflows).

- **Commit:** none.
