---
id: "bug-154-directives-list-succeeds-with-no-configuration"
type: bug
title: "`directives list` answers an empty listing with exit 0 in a project that has no configuration, and `--role` adds a false \"no directives assigned\" warning"
status: in-progress
severity: "medium"
release-origin: "v0.2"
release: "v0.3"
feature: "P3.4"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

Where the CLI finds no `.wingfoil/` at the root it resolves, every read command fails with the
missing file named — except `directives list`, which succeeds with `{"entries":[],"warnings":[]}`
and exit 0. With `--role <role>` it also warns `no directives assigned to role '<role>'`, which states
something about the project's bindings that nothing was read to establish. "The project has no
configuration here" becomes "this role has no rules".

## Steps to Reproduce

Reproduced against `wingfoil@0.2.1` (`wingfoil --version` → `0.2.1`), in an empty repository:

1. `mkdir nocfg && cd nocfg && git init`
2. `wingfoil --format json directives list; echo "exit $?"` →
   `{"entries":[],"warnings":[]}` · `exit 0`
3. `wingfoil --format json directives list --role developer; echo "exit $?"` →
   `{"entries":[],"warnings":["no directives assigned to role 'developer'"]}` · `exit 0`
4. For contrast, the other reads in the same directory, each `exit 1`:
   - `wingfoil --format json paths` / `dna show` → `{"error":"ENOENT: … .wingfoil/dna.yaml"}`
   - `wingfoil --format json workflow list` → `{"error":"ENOENT: … .wingfoil/workflows.yaml"}`
   - `wingfoil --format json memory search` → `{"error":"ENOENT: … .wingfoil/memory.yaml"}`

Until 2026-09-29 the same happened in this repository, whose configuration sat under `docs/self/`
(`bug-075`): `wingfoil --format json directives list` run at the root answered
`{"entries":[],"warnings":[]}`, exit 0, while `dna show` failed. **Updated 2026-09-29:** `task-111`
moved the configuration to the root (merge `582ec08a`), so this repository no longer reproduces the
bug. There `directives list` now reads the real configuration and exits 0 with its entries. The
reproduction above, in a git repository with no `.wingfoil/`, still stands.

## Expected Behavior

Like its sibling reads: when the project has no `.wingfoil/` at the resolved root, `directives list`
fails (exit 1, the missing path named), and never reports a role's bindings it did not read. An
existing configuration that simply declares no directives, or no `roles.yaml`, keeps today's
answer — that case is legitimate and already covered.

## Actual Behavior

An empty listing and exit 0, indistinguishable from a configured project that declares no directives;
with `--role`, a warning that asserts the role has no directives assigned.

## Notes

- **Root cause.** `listMarkdownFilesSorted` returns `[]` when the directory is absent
  (`sed -n 28,29p src/core/loaders.ts` → `if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];`),
  so `loadDirectives` (`src/core/loaders.ts:287`) cannot tell "no directives" from "no
  configuration"; and `loadDirectiveListing` reads `roles.yaml` only when it exists
  (`sed -n 191p src/core/directives-list.ts`), by design — its doc-comment tolerates "a genuinely
  absent file". Each tolerance is reasonable alone; together they leave no case that fails.
- **Why it matters more than a missing error message.** `docs/agents.md` tells agents to take the
  rules of their role from this command (`grep -n "directives list" docs/agents.md` → lines 41, 69,
  92). In a project the CLI cannot read, an agent following it is told its role has no directives
  and proceeds without them, with exit 0 and nothing on stderr.
- **Unchanged on `main`:** `git diff --stat v0.2.1 main -- src/core/loaders.ts src/core/directives-list.ts`
  prints nothing.
- **Other callers of the same loader**, not checked here: `grep -rn "loadDirectives(" src/` →
  `src/core/index.ts:1501` and `src/mcp/prompt.ts:135` (the role Prompts). Whether they can also
  turn a missing configuration into "no directives" is for the fix to establish.
- **Suggested direction, for triage:** have the listing require the project's configuration root the
  way the other pillar reads do (a missing `.wingfoil/` → the same `ENOENT`-style error), keeping
  "directory present but empty" and "no `roles.yaml`" as they are.
- **Found by** the roadmap viewer (`tools/roadmap/`, branch `design/dashboards`) while moving its reads
  onto the CLI: it had to probe with `dna show`, because this command cannot tell it whether the CLI
  can read the project at all.

## Triage & Execution Notes

- capture: reproduced on `wingfoil@0.2.1` in an empty repository and in this one (steps above);
  `release` left empty for the approver's triage. Found after `release-planning-rel-v0.2.2` had
  passed `triage-bugs` and `build-backlog`, so it is not in that plan's selection.
