---
id: spec-005-cli-command-contract
type: tech-spec
title: "CLI command contract — exit codes, output formats, error format"
status: approved
scope: "src/cli"
supersedes: ""
tmpl_version: 260703
---

## Context

Every `wingfoil` command — regardless of pillar (`memory`, `dna`, `directive`, `workflow`, `agent`) or
flat command (`init`, `audit`, `paths`) — is consumed by two audiences that need a **stable, predictable
contract** independent of the specific command's arguments: (1) humans reading console output, and
(2) scripts, CI pipelines, and other tools parsing exit codes and structured output.

Without a single shared definition of exit codes, output-format switching, and error-message shape,
each command implementation would invent its own conventions — divergent exit codes for the same class
of failure, inconsistent `--format json`/`--format yaml` shapes, ad-hoc error strings that can't be
parsed or scripted against. That divergence breaks REQ-INT-04 (exit-code contract), REQ-INT-05
(machine-readable output formats), and REQ-INT-08 (consistent CLI error format), and undermines the
Determinism Index: two agents implementing two different commands must produce output that composes
predictably in CI without either one having read the other's code.

This spec defines that shared contract — the **exit-code / output-format / error-message layer** — as
a single source of truth that every command implementation in `src/cli` and every CLI-* command spec
built on top of it must conform to. It does **not** define the invocation grammar, the command map, the
global-flags surface, or the interactive-prompt layer (see spec-008-cli-grammar); it also does not
define command-specific arguments, flags, or success-output schemas (each command's own spec owns
those, subject to the format rules here).

## Specification

### 1. Exit-code contract (REQ-INT-04)

Every `wingfoil` invocation terminates with exactly one of three exit codes:

| Code | Name                    | When                                                                                                   |
|------|-------------------------|----------------------------------------------------------------------------------------------------------|
| `0`  | Success                 | The command completed successfully; any requested Memory/DNA/Directives/Workflow mutation was applied. |
| `1`  | User / logic error      | The invocation was well-formed but failed on business logic: element not found, illegal state transition, validation failure, git operation failure, missing/invalid credentials. |
| `2`  | Usage / argument error  | The invocation itself is malformed: unknown command/pillar/verb, unknown flag, missing required argument, invalid flag value (e.g. `--format` not in `console\|json\|yaml`). |

Rules:

- Exactly one process exit call per invocation; all exits route through a single exit function so the
  mapping above cannot be bypassed by an uncaught code path.
- A non-zero exit code (`1` or `2`) is **always** accompanied by an error message on stderr in the
  format defined in §3 below — a bare non-zero exit with no message is a contract violation.
- `--help` and `--version` always exit `0`, even if other arguments on the same invocation are invalid
  (they take precedence and short-circuit the rest of parsing).
- Read-only commands (`memory search`, `dna show`, `workflow status`, `paths`, …) can only exit `0`
  (found/empty result) or `1` (e.g. malformed query); they never exit `2` once argument parsing has
  succeeded.
- This is a **three-code** contract: `0`/`1`/`2` only. There is no dedicated dry-run or interrupt exit
  code reserved by this spec — a command that adds a `--dry-run` mode or handles `SIGINT` still reports
  through `0`/`1`/`2` per the rules above, and defines the exact mapping for its own case in that
  command's own CLI-* spec.

```ts
// src/cli/exit.ts
export type ExitCode = 0 | 1 | 2;

export function exitWith(code: ExitCode, message?: string): never {
  if (message) process.stderr.write(message + '\n');
  process.exit(code);
}
```

### 2. Machine-readable output formats (REQ-INT-05)

Every command accepts a `--format` option with three values; `console` is the default when the flag is
omitted.

```
--format console | json | yaml
```

| Value     | Destination | Audience                          | Notes                                                          |
|-----------|-------------|------------------------------------|-------------------------------------------------------------------|
| `console` | stdout      | Humans (default)                  | Free-form, colour-capable, may include prefixes/formatting.       |
| `json`    | stdout      | Scripts, CI, dashboards            | A single JSON value on stdout — must parse with a standard JSON parser (e.g. `JSON.parse`). |
| `yaml`    | stdout      | Scripts, CI, dashboards            | The same logical structure as `json`, serialized as YAML.         |

Contract rules:

- An invalid `--format` value is a **usage error**: exit `2`, message `error: invalid --format value
  "<value>", expected one of: console, json, yaml`.
- For `json`/`yaml`, stdout carries **only** the structured payload — no banners, progress lines, or
  colour codes interleaved with it. Diagnostic/progress output (if any) goes to stderr regardless of
  `--format`.
- The payload *shape* per command (success case) is owned by that command's own spec (e.g. `paths
  --format json`, `workflow status --format json`); this spec only fixes the *envelope* rules that
  apply uniformly: stdout-only, single top-level value, no extraneous output mixed in.
- Error payloads under `--format json`/`--format yaml` follow the structured error shape in §3.2,
  regardless of which command raised the error — this part of the shape is not command-specific.

```ts
// src/cli/output.ts
export type OutputFormat = 'console' | 'json' | 'yaml';

export function isValidFormat(value: string): value is OutputFormat {
  return value === 'console' || value === 'json' || value === 'yaml';
}
```

### 3. Consistent error format (REQ-INT-08)

#### 3.1 Console format (`--format console`, default)

A single-line, script-greppable prefix, on **stderr**:

```
error: <reason>
```

- `<reason>` is a human-readable, lower-case-initial sentence fragment (no trailing period), e.g.
  `error: element not found: task/task-999`.
- Every error line begins with the literal token `error: ` — this is the invariant other tooling can
  grep for; it is not itself a symbolic code.
- An optional second line may suggest a fix, prefixed `hint: `:
  ```
  error: unknown command "memorey"
  hint: did you mean "memory"?
  ```
- **Unknown-command suggestion:** when the first token after `wingfoil` (and any recognized global
  flags) does not match a known pillar or flat command, the CLI computes the closest known command by
  edit distance and — if within a small distance threshold — appends the `hint:` suggestion line shown
  above; if no close match exists, the `hint:` line is omitted. This is the mechanism that makes the
  "closest-command suggestion for unknown commands" requirement concrete; the exact distance function
  and threshold are an implementation detail owned by `src/cli`, not fixed by this spec.

#### 3.2 Structured format (`--format json` / `--format yaml`)

```json
{
  "error": "<reason>",
  "hint": "<optional corrective suggestion>"
}
```

- `error` is required and carries the same reason text as the console `<reason>`.
- `hint` is present only when a suggestion applies (same condition as §3.1); otherwise the field is
  omitted rather than set to `null`.
- The `yaml` variant is the same two-field structure serialized as YAML instead of JSON.
- This structured error object is written to **stderr**, not stdout, even under `--format json` /
  `--format yaml` — the success payload contract in §2 reserves stdout for the command's own result
  shape; keeping errors on stderr lets a caller distinguish "parse stdout for a result" from "parse
  stderr for a failure" without inspecting the exit code first.

```ts
// src/cli/error.ts
export function emitError(
  reason: string,
  opts: { format: OutputFormat; hint?: string }
): void {
  if (opts.format === 'json') {
    process.stderr.write(JSON.stringify({ error: reason, ...(opts.hint ? { hint: opts.hint } : {}) }) + '\n');
  } else if (opts.format === 'yaml') {
    process.stderr.write(yamlDump({ error: reason, ...(opts.hint ? { hint: opts.hint } : {}) }));
  } else {
    process.stderr.write(`error: ${reason}\n`);
    if (opts.hint) process.stderr.write(`hint: ${opts.hint}\n`);
  }
}
```

### 4. Worked examples

**Unknown command (usage error, exit 2):**

```
$ wingfoil memorey add --type task --title "Fix login"
error: unknown command "memorey"
hint: did you mean "memory"?
```
Exit code: `2`

**Missing required argument (usage error, exit 2):**

```
$ wingfoil memory submit --format json
{"error":"missing required argument: --reason"}
```
Exit code: `2`

**Business-logic failure (user/logic error, exit 1):**

```
$ wingfoil memory approve task/task-999 --reason "looks good"
error: element not found: task/task-999
```
Exit code: `1`

**Success with structured output (exit 0):**

```
$ wingfoil paths sources --format json
{"category":"sources","paths":["src/cli","src/core"]}
```
Exit code: `0`

## Consequences

- Every command implementation under `src/cli` routes its process termination through the single
  `exitWith` function and its error rendering through `emitError`, so no command can silently diverge
  from the `0`/`1`/`2` mapping or the `error: <reason>` / `{"error": ...}` shape.
- Each command's own CLI-* spec is responsible only for: its argument/flag surface, its success-output
  payload shape under `--format json`/`--format yaml`, and which of its failure modes map to `1` vs `2`
  — it must not introduce new exit codes or a different error envelope.
- Automated cross-command tests (an "exit-code matrix" per REQ-INT-04's fit criterion) can be written
  once against this contract and reused for every command, asserting: success → `0`, a representative
  logic error → `1`, a missing/invalid argument → `2`.
- If this contract is later revised (e.g. a new exit code is added for a class of error not covered by
  `1`/`2`), every command depends on that revision and must be re-verified against the updated matrix;
  such a revision would supersede this spec.
- `--dry-run`, `--verbose`, `--no-color`, `--no-interactive`, and the rest of the global-flag surface
  are out of scope here and are governed by spec-008-cli-grammar; any interaction between those flags
  and this contract (e.g. how `--dry-run` reports its outcome) is defined there or in the owning
  command's own spec, not here.

## Process Notes

Authored proactively during rl-v1 `initial-design` (`seed-specs`), not in response to a dev-loop gap.
Grounded directly in the ground-truth requirements `docs/02_requirements/03_sard/04_integrations.md`
(REQ-INT-04, REQ-INT-05, REQ-INT-08) and the feature description of P5.1.4 in
`docs/01_vision/06_features.md`. This document follows REQ-INT-04's three-code exit contract (`0`
success / `1` user-or-logic error / `2` usage-or-argument error) with no dedicated dry-run or interrupt
code. Its error-format prefix (`error: <reason>`, all-lowercase, no symbolic `E_*` code) follows
REQ-INT-08's literal fit criterion.
