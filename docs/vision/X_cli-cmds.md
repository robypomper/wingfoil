# CLI Commands Reference — WingFoil

**Version:** 1.0
**Date:** 2026-06-24  
**Status:** Pending

---

This document provides a comprehensive reference of all WingFoil CLI commands organized by pillar. Each command includes
its interface, description, actors (personas), user journeys, relevant notes, and parameter specifications.

---

## Pillar 1: Project Memory Commands

**Philosophy:** Memory documents are created in draft state, then flow through a state machine (draft → pending →
approved/rejected → deprecated). This mirrors the Workflow pillars but operates at the document level.

| Command                                                                                 | Description                                                             | Actors              | Journeys  | Notes                                                                                                                                                                          |
|-----------------------------------------------------------------------------------------|-------------------------------------------------------------------------|---------------------|-----------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `wingfoil memory add [--type TYPE] [--title "title"] [--tags "tag1,tag2"]`              | Create new Memory document (draft state) with specified type            | Morgan, Alex, Casey | 0a, 0b, 5 | Creates document in `.wingfoil/memory/[TYPE]/[document-id].md` with frontmatter state. Assigns unique document-id (UUID or slug)                                               |
| `wingfoil memory search [keyword] [--type TYPE] [--status STATUS] [--format json/yaml]` | Query Memory by keyword, type, and status                               | Casey, Alex         | 1, 3, 5   | Keyword search only in v0.1. Filters by type (adr, rfc, decision, task, etc.) and status (draft, pending, approved, deprecated)                                                |
| `wingfoil memory import [path] [--action copy/move/link]`                               | Scan existing docs and import into Memory                               | Morgan, Alex        | 0b        | Interactive if `--action` not specified. Prevents duplicates by checking filename hash. Supports: copy (new file), move (original deleted), link (symlink, avoids duplication) |
| `wingfoil memory submit [document-id] [--notes "text"]`                                 | Submit Memory document for approval (draft → pending state)             | Morgan, Alex        | 2, 4, 5   | State transition recorded in frontmatter. Creates git commit. Notes stored in frontmatter for context                                                                          |
| `wingfoil memory approve [document-id] [--reason "reason"]`                             | Approve Memory document (pending → approved state)                      | Morgan, Casey       | 2, 4, 5   | Records approver name, timestamp, reason in frontmatter. Creates git commit. Document is now active/current                                                                    |
| `wingfoil memory reject [document-id] [--reason "reason"]`                              | Reject Memory document (pending → draft state)                          | Morgan, Casey       | 2, 4, 5   | Reverts to draft for rework. Reason stored in frontmatter for feedback. Creates git commit                                                                                     |
| `wingfoil memory deprecate [document-id] [--reason "reason"]`                           | Mark Memory document as deprecated (any state → deprecated)             | Morgan, Casey       | 2, 3, 5   | Document remains in repo (not deleted) but marked as obsolete. Reason recorded. Agents ignore deprecated docs in context loading                                               |
| `wingfoil memory history [document-id] [--format json/yaml]`                            | View audit trail of Memory document (commits, approvals, state changes) | Morgan, Casey       | 2, 3, 5   | Shows full git history + state transitions from frontmatter                                                                                                                    |

### Parameters for Pillar 1 Commands

| Parameter               | Type               | Description                                                  | Where Found                                            | How Managed                                                                       | Where Saved                                                            |
|-------------------------|--------------------|--------------------------------------------------------------|--------------------------------------------------------|-----------------------------------------------------------------------------------|------------------------------------------------------------------------|
| `document-id`           | string (slug/UUID) | Unique identifier for Memory document                        | Auto-generated on `memory add`, or provided in command | System generates if not specified (e.g., `adr-001-async-design`) or user provides | Filename and frontmatter `id:` field                                   |
| `TYPE`                  | enum               | Document type: adr, rfc, decision, task, release, risk, etc. | User selects during `memory add` (interactive or flag) | Dropdown menu or `--type` flag                                                    | Directory structure `.wingfoil/memory/[TYPE]/` and frontmatter `type:` |
| `document-id` (history) | string             | ID of document to view history for                           | Provided in command                                    | Must exist in Memory                                                              | Retrieved from filename                                                |
| `status`                | enum               | Document state: draft, pending, approved, deprecated         | Auto-tracked in frontmatter                            | State machine transitions (submit, approve, reject, deprecate)                    | Frontmatter `status:` field, tracked via git commits                   |

---

## Pillar 2: Project DNA Commands

**Philosophy:** DNA is the source of truth for project structure, tech stack, and team. Changes to DNA trigger automatic
synchronization of Directives and Workflow built-in templates. DNA structure includes: modules, tech-stack, team,
conventions, and resource paths.

| Command                                                      | Description                                                                         | Actors       | Journeys  | Notes                                                                                                                        |
|--------------------------------------------------------------|-------------------------------------------------------------------------------------|--------------|-----------|------------------------------------------------------------------------------------------------------------------------------|
| `wingfoil dna set [--field FIELD] [--value VALUE]`           | Define/update project DNA field (interactive or flag-based)                         | All          | 0a, 6     | Modifies `.wingfoil/dna.yaml`. Supports nested fields (e.g., `tech-stack.backend=nodejs`)                                    |
| `wingfoil dna show [--section SECTION] [--format json/yaml]` | Query and display project DNA                                                       | Casey, All   | 3, 5      | Show full DNA or specific section (modules, tech-stack, team, conventions, paths)                                            |
| `wingfoil dna infer [--confirm]`                             | Auto-scan codebase and propose DNA structure                                        | Morgan, Alex | 0b        | Infers modules from directory structure, languages/frameworks from files. Requires human review/approval before updating DNA |
| `wingfoil paths [category] [--format json/yaml]`             | Query project resource paths by category (sources, tests, docs, config, governance) | All          | 0a, 0b, 5 | Reads from DNA `paths:` section. Drill-down support (e.g., `paths sources --list`). Console/JSON/YAML output                 |

### Parameters for Pillar 2 Commands

| Parameter  | Type         | Description                                                      | Where Found                          | How Managed                     | Where Saved                         |
|------------|--------------|------------------------------------------------------------------|--------------------------------------|---------------------------------|-------------------------------------|
| `FIELD`    | path         | DNA field path (e.g., `tech-stack.backend`, `team.lead`)         | User specifies or interactive prompt | Structured YAML path navigation | `.wingfoil/dna.yaml` nested keys    |
| `VALUE`    | string/array | New value for DNA field                                          | User input (flag or prompt)          | Validated against DNA schema    | `.wingfoil/dna.yaml`                |
| `SECTION`  | enum         | DNA section: modules, tech-stack, team, conventions, paths       | User specifies or shows all          | Matches top-level keys in YAML  | `.wingfoil/dna.yaml`                |
| `category` | enum         | Resource path category: sources, tests, docs, config, governance | User specifies                       | Defined in DNA `paths:` section | `.wingfoil/dna.yaml` under `paths:` |

---

## Pillar 3: Project Directives Commands

**Philosophy:** Directives are of two kinds:

1. **Built-in directives:** Auto-installed during project init based on tech-stack and methodology chosen in DNA.
   Automatically synced when DNA changes (removed/added based on updated stack).
2. **Custom directives:** Created by tech lead/architect. Associated with specific roles or globally scoped. Manually
   managed.

**Sync Process:** When `wingfoil dna set` updates `tech-stack` or `methodology`, WingFoil automatically:

- Installs new built-in directives for added stack choices
- Removes directives for removed stack choices
- Updates role→directive assignments to reflect new built-in set

| Command                                                                                             | Description                                                  | Actors       | Journeys | Notes                                                                                                                                                                  |
|-----------------------------------------------------------------------------------------------------|--------------------------------------------------------------|--------------|----------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `wingfoil directive create [--name NAME] [--format md/yaml] [--template TEMPLATE]`                  | Create new custom directive file (interactive or flag-based) | Morgan, Alex | 0a, 4    | Creates `.wingfoil/directives/custom/[name].md`. Unique within custom directives. Not auto-removed                                                                     |
| `wingfoil directive assign [--directive DIRECTIVE_ID] [--role ROLE] [--scope global/role-specific]` | Bind custom directive to role(s) or make global              | Morgan       | 2, 6     | Maps custom directive to roles defined in DNA. One directive can bind to multiple roles. Records in `.wingfoil/directives/.assignments.yaml`                           |
| `wingfoil directive remove [--directive DIRECTIVE_ID] [--verify-usage]`                             | Disassociate custom directive from roles and remove it       | Morgan, Alex | 2, 4, 6  | Only removes custom directives (built-in removed via DNA change). `--verify-usage` checks if directive is referenced anywhere before removal. Removes from assignments |
| `wingfoil directives list [--role ROLE] [--built-in/--custom/--all] [--format json/yaml]`           | List all directives (built-in + custom) and role assignments | All          | All      | Shows: directive id, name, type (built-in/custom), roles assigned, scope. Can filter by role or type                                                                   |

### Parameters for Pillar 3 Commands

| Parameter                   | Type   | Description                                                         | Where Found                                 | How Managed                                                        | Where Saved                                                            |
|-----------------------------|--------|---------------------------------------------------------------------|---------------------------------------------|--------------------------------------------------------------------|------------------------------------------------------------------------|
| `NAME`                      | string | Custom directive name (slug format)                                 | User input or auto-generated from template  | Must be unique within custom directives. Auto-slug if not provided | Filename `.wingfoil/directives/custom/[name].md`                       |
| `DIRECTIVE_ID`              | string | Unique ID of directive (built-in or custom)                         | Listed via `directives list` or in filename | System-managed (UUID or slug)                                      | Directive filename or registry                                         |
| `ROLE`                      | string | Role name defined in DNA (developer, reviewer, qa, architect, etc.) | Listed via `dna show team.roles`            | Defined in DNA, referenced in assignments                          | `.wingfoil/directives/.assignments.yaml`                               |
| `SCOPE`                     | enum   | Scope type: global (all roles) or role-specific                     | User specifies via flag                     | Controls whether directive applies to all roles or specific ones   | `.wingfoil/directives/.assignments.yaml` mapping                       |
| `--built-in/--custom/--all` | flag   | Filter directive type                                               | User selects                                | Separates installed built-in from user-created custom              | Inferred from directory: `.wingfoil/directives/built-in/` vs `custom/` |

---

## Pillar 4: Project Workflow Commands

**Philosophy:** Similar to Directives, Workflows are:

1. **Built-in templates:** Auto-installed during init based on methodology in DNA (Scrum, Kanban, Lean, Trunk-Based).
   Auto-synced when DNA changes.
2. **Custom workflows:** Created by tech lead/architect. Can be included in main workflow via `include()` directive.

**File layout:** `.wingfoil/workflows.yaml` is the **main configuration file**. It does not contain every workflow
inline — it references the built-in and custom workflow files via `include()`. Built-in templates live in
`.wingfoil/workflows/built-in/`, custom workflows in `.wingfoil/workflows/custom/`.

**Sync Process:** When `wingfoil dna set methodology` updates, WingFoil:

- Copies/updates built-in template files to `.wingfoil/workflows/built-in/`
- Syncs methodology-specific configuration
- Preserves custom workflows (not auto-removed)

| Command                                                             | Description                                                                 | Actors        | Journeys      | Notes                                                                                                                                                          |
|---------------------------------------------------------------------|-----------------------------------------------------------------------------|---------------|---------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `wingfoil workflow status [--format json/yaml]`                     | Show current state of open workflows and pending approvals                  | Morgan, Casey | 2, 3, 4, 5, 6 | Dashboard view of all workflow states. Useful for identifying bottlenecks. Filterable by approval status                                                       |
| `wingfoil workflow next [--assigned-to USER] [--format json/yaml]`  | Show next step + directives for current role + task instructions            | Alex, Morgan  | 1, 4          | Displays current workflow state, pending tasks, next action. Shows auto-loaded directives for assigned role. Can filter by element type                        |
| `wingfoil workflow start [--name NAME]`                             | Open workflow phase; initialize first step                                  | Morgan, Alex  | 0a, 0b        | Marks workflow as "in-progress" in state tracking (Memory frontmatter). Creates git commit                                                                     |
| `wingfoil workflow end [--name NAME]`                               | Close workflow phase; mark as complete                                      | Morgan, Alex  | 0a, 0b        | Marks workflow as "completed". Creates git commit                                                                                                              |
| `wingfoil workflow list [--format json/yaml]`                       | List available workflows                                                    | All           | 0a, 0b        | Shows: name, description, methodology (for built-in), phases, built-in status                                                                                  |
| `wingfoil workflow show [--name NAME] [--format json/yaml]`         | Display details of a workflow (phases, steps, directives, Memory structure) | All           | 0a, 0b        | Shows full workflow spec: phases, steps, default directives bound, initial Memory docs to create                                                               |
| `wingfoil workflow create [--name NAME]`                            | Create new custom workflow file (interactive or flag-based)                 | Morgan, Alex  | 2, 4, 6       | Creates `.wingfoil/workflows/custom/[name].yaml`. Custom workflows can be included in main via `include()`. Not auto-removed on DNA change                     |
| `wingfoil workflow remove [--name NAME] [--verify-includes]`        | Remove custom workflow after verifying it's not included elsewhere          | Morgan, Alex  | 2, 4, 6       | Only removes custom workflows (built-in removed via DNA change). `--verify-includes` checks if workflow is referenced in `include()` statements before removal |

### Parameters for Pillar 4 Commands

| Parameter       | Type   | Description                                                | Where Found                                            | How Managed                                                          | Where Saved                                                     |
|-----------------|--------|------------------------------------------------------------|--------------------------------------------------------|----------------------------------------------------------------------|-----------------------------------------------------------------|
| `WORKFLOW_NAME` | string | Workflow name (built-in or custom)                         | Listed via `workflow list` or defined in YAML          | Built-in: auto-generated from methodology. Custom: user-defined slug | Filename `.wingfoil/workflows/[built-in or custom]/[name].yaml` |

---

## Pillar 5: Project Initialization Commands

**Philosophy:** Initialization is the one-time setup of WingFoil on a project. Only two commands, three execution modes:
interactive wizard, flag-based, or inferred from repo. Initialization automatically:

- Creates DNA from user input (or inference)
- Installs built-in Directives based on tech-stack + methodology
- Installs built-in Workflows based on methodology
- Initializes Memory structure with suggested sections

| Command                                                                                                                | Description                                                                 | Actors       | Journeys | Notes                                                                                                                                                            |
|------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------|--------------|----------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `wingfoil init [--mode wizard/params/infer] [--template METHODOLOGY] [--tech-stack STACK] [--team-size N] [--confirm]` | Initialize WingFoil on new or existing project                              | Alex, Morgan | 0a, 0b   | Three modes: wizard (interactive Q&A), params (flags), infer (deduce from repo). Generates DNA, installs built-in directives/workflows, creates Memory structure |
| `wingfoil audit [--output-type full/summary] [--format json/yaml]`                                                     | Scan project and summarize current state (languages, frameworks, structure) | Morgan, Alex | 0b       | Pre-requisite to `init --mode infer`. Shows: repo size, languages, frameworks, module structure, team members (from git history). Helps inform DNA inference  |

### Parameters for Pillar 5 Commands

| Parameter     | Type   | Description                                                                  | Where Found                          | How Managed                                             | Where Saved                       |
|---------------|--------|------------------------------------------------------------------------------|--------------------------------------|---------------------------------------------------------|-----------------------------------|
| `--mode`      | enum   | Init execution mode: wizard (interactive), params (flags), infer (from repo) | User specifies or defaults to wizard | If not specified, prompts user to choose                | N/A (affects execution flow only) |
| `METHODOLOGY` | enum   | Project methodology: scrum, kanban, lean-inception, trunk-based, custom      | User selects during init             | Selects which built-in workflow template to install     | DNA `.yaml` `methodology:` field  |
| `STACK`       | string | Tech stack shorthand: nodejs-react, python-django, go-postgres, etc.         | User input or inferred from codebase | Determines which built-in Directives to install         | DNA `.yaml` `tech-stack:` section |
| `--confirm`   | flag   | Skip confirmation prompts and proceed with generated DNA                     | User specifies                       | If set, auto-confirms inferred values without prompting | N/A (affects execution flow)      |

---

## Agent Execution Commands

| Command                                                          | Description                                                           | Actors | Journeys       | Notes                                                                                                                                                                                                                |
|------------------------------------------------------------------|-----------------------------------------------------------------------|--------|----------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `wingfoil agent execute [--next] [--role ROLE] [--task TASK_ID]` | Launch agent with auto-loaded context (directives, Memory, next task) | All    | 0a, 1, 2, 4, 6 | Without `--next`: agent chooses task or user specifies with `--task`. With `--next`: automatically loads the next pending task from workflow + assigned directives for the role. Pre-loads Memory context in <30 sec |

### Parameters for Agent Execution

| Parameter | Type   | Description                                           | Where Found                                 | How Managed                                                                           | Where Saved                        |
|-----------|--------|-------------------------------------------------------|---------------------------------------------|---------------------------------------------------------------------------------------|------------------------------------|
| `--next`  | flag   | Auto-load next pending task from workflow             | Determined by workflow state machine        | If set, queries workflow state and loads next task automatically                      | N/A (affects behavior, not stored) |
| `ROLE`    | string | Agent role (developer, reviewer, qa, architect, etc.) | Defined in DNA or specified via flag        | Used to auto-load role-specific directives. If not specified, defaults to `developer` | N/A (used for context filtering)   |
| `TASK_ID` | string | Specific task ID to execute                           | Provided via flag or `workflow next` output | Must exist in workflow state                                                          | N/A (query parameter)              |

---

## Global Options

All commands support:

| Option      | Format                              | Description                                                                  |
|-------------|-------------------------------------|------------------------------------------------------------------------------|
| `--format`  | `json`, `yaml`, `console` (default) | Output format. JSON/YAML for scripting/CI. Console for humans                |
| `--help`    | flag                                | Show command-specific help and examples                                      |
| `--dry-run` | flag                                | Simulate command without making changes (creates no commits, no file writes) |
| `--verbose` | flag                                | Show detailed execution logs (useful for debugging)                          |

---

## Command-Line Syntax Conventions

- **Subcommand structure:** `wingfoil [pillar] [verb] [object] [options]`
    - Example: `wingfoil memory add --type adr --title "Async Design"`
    - Example: `wingfoil workflow status --format json`

- **Required vs. optional arguments:** Required arguments in `[brackets]`, optional in `--flags`
    - If required argument missing, command prompts interactively

- **Interactive mode:** Commands run in interactive mode by default if critical flags are omitted
    - Example: `wingfoil memory add` prompts for type, title, tags
    - Example: `wingfoil memory add --type adr --title "title"` runs without prompts

- **Output formats:** All output commands support `--format json/yaml/console`
    - Console (default): human-readable, colored output
    - JSON/YAML: machine-parseable for scripting and CI/CD

- **State and commits:** Commands that modify state (add, submit, approve, reject, deprecate, dna set, directive create)
  automatically:
    - Create git commits with descriptive messages
    - Update relevant state files (Memory frontmatter, DNA YAML, etc.)
    - Include actor name and timestamp in state records

---

## Release Timeline by Command

**v0.1 (Jul 10):**

- Pillar 1: `memory add`, `memory search`
- Pillar 2: `dna set`, `dna show`, `paths`
- Pillar 4: `workflow list`, `workflow show`
- Pillar 5: `init`, `audit`

**v0.2 (Jul 17):**

- Pillar 3: `directive create`, `directive assign`, `directive remove`, `directives list`
- Pillar 5: `init --template` (enhanced)

**v0.3 (Jul 24):**

- Pillar 1: `memory submit`, `memory approve`, `memory reject`, `memory deprecate`
- Pillar 4: `workflow start`, `workflow end`, `workflow next`, `workflow status`, `workflow create`, `workflow remove`
- Agent: `agent execute`

**v0.4 (Jul 31):**

- Pillar 1: `memory import`, `memory history`
- Pillar 2: `dna infer`

**v1.0 (Aug 7):**

- All commands stable and polished

---

## Command Reference by Persona

### Alex (Solo Developer)

**Primary commands:** `workflow next`, `agent execute --next`, `memory search`, `dna show`, `init`

- Starts each session with `workflow next` to see next task
- Launches agent with `agent execute --next` to pre-load context
- Searches Memory to find past decisions
- Queries DNA for project structure

### Morgan (Tech Lead)

**Primary commands:** `directive create`, `directive assign`, `workflow status`, `memory submit`, `memory approve`,
`memory reject`, `dna set`, `init`

- Creates and manages custom directives
- Tracks all workflows and approves/rejects deliverables
- Updates DNA when tech stack/methodology changes (triggers auto-sync of directives/workflows)
- Documents architectural decisions in Memory

### Casey (Non-Technical Manager)

**Primary commands:** `memory search`, `dna show`, `workflow status`, `memory history`

- Searches Memory for project decisions
- Queries DNA for team structure and tech stack
- Checks workflow status to identify bottlenecks
- Views audit trail and decision history

### Jordan (Team Developer)

**Primary commands:** `workflow next`, `directives list`, `agent execute --role developer`, `memory search`

- Gets assigned tasks via `workflow next`
- Views team directives with `directives list`
- Launches agents with developer role
- Finds relevant decisions in Memory

### Sam (Code Reviewer)

**Primary commands:** `workflow status --filter pending`, `agent execute --role reviewer`, `memory approve/reject`

- Checks pending reviews via `workflow status`
- Launches review agent with review role
- Submits review decisions via `memory approve/reject`
