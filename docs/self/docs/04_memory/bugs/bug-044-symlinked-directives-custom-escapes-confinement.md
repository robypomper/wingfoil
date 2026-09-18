---
id: "bug-044-symlinked-directives-custom-escapes-confinement"
type: bug
title: "A symlinked directives/custom/ lets `directive remove` delete a file outside the project root, then fails with an unmapped raw git error"
status: open
severity: "medium"
release-origin: "v0.2"
release: ""
feature: "P3.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

When `.wingfoil/directives/custom` is a **symlink to a directory outside the project root**,
`wingfoil directive remove <name>` unlinks the outside file for real and only then fails — with a raw
`Command failed: git … add -- …` error that is not a `CoreError`, so the operator gets a leaked git
message instead of a mapped refusal, and the deletion is never recorded anywhere.

## Steps to Reproduce

Against branch `task/task-052-directive-remove`, HEAD `a624067` (`directive remove` is **not** on `main`
yet — the branch was read read-only with `git show`, then built in a throwaway clone via
`npm run build`; `npx tsc -p tsconfig.json` fails on `bug-026`, `tsconfig.build.json` does not).

```
$ mkdir -p lab/proj lab/outside && cd lab/proj
$ git init -q . && git config user.name Probe && git config user.email probe@example.invalid
$ node <clone>/dist/cli.js init --template Scrum        # scaffolds .wingfoil/ and commits it

# plant a valid directive OUTSIDE the project root, and alias custom/ at it
$ cat > ../outside/legacy-rule.md <<'EOF'
---
id: legacy-rule
name: legacy-rule
type: directive
kind: custom
title: "Legacy rule"
---
# Legacy rule
EOF
$ rm -rf .wingfoil/directives/custom && ln -s ../../../outside .wingfoil/directives/custom
$ git add -A && git commit -qm "plant symlinked custom dir"
$ git status --short           # (empty — clean tree before the run)

$ ls -l ../outside
-rw-rw-r-- 1 … 170 … legacy-rule.md

$ node <clone>/dist/cli.js directive remove legacy-rule
fatal: pathspec '.wingfoil/directives/custom/legacy-rule.md' is beyond a symbolic link
error: Command failed: git -C /…/lab/proj add -- .wingfoil/directives/custom/legacy-rule.md
fatal: pathspec '.wingfoil/directives/custom/legacy-rule.md' is beyond a symbolic link

$ echo $?
1
$ ls -l ../outside
total 0                        # <-- the outside file is GONE
$ git status --short           # (empty — nothing recorded the deletion)
```

## Expected Behavior

The command refuses before touching the filesystem, with a mapped `CoreError` (exit `1`, rendered as
`error: <reason>` per `spec-008-cli-grammar` §6) saying the resolved path lies outside the project. A
mutating operation must not delete anything it is then unable to commit, and must never delete anything
outside the root at all — the property REQ-SEC-06 states for the Memory store and REQ-SEC-07 assumes for
the directives store.

## Actual Behavior

1. The outside file is unlinked (`removeDocument`) — a real, unrecoverable deletion of a file the project
   does not own.
2. `commitPaths` then runs `git add -- <path>`; git refuses with `pathspec … is beyond a symbolic link`,
   and `runGit` (`src/storage/commit.ts:27-32`, `execFileSync`) throws a **raw `Error`**, not a
   `CoreResult.error`.
3. The CLI's catch-all (`src/cli/registrar.ts:115-123`) routes it through `exitCodeForThrow`
   (`src/core/exit-code.ts:62-71`), whose final branch maps any non-`UsageError`/`ValidationError` throw
   to `{reason: error.message, exitCode: 1}` — so the operator sees the child-process message verbatim,
   absolute path and all, and git's own `fatal:` on stderr twice.
4. No commit is made, and nothing in the repository records the deletion — `git status` is clean, because
   the file that was deleted was never in the repository.

## Notes

### Correction to the first framing of this finding

The raw error does **not** bypass error handling entirely: it does not escape as an uncaught throw, and
the process exits `1` rather than crashing. What it bypasses is `exitCodeForError` — the `CoreResult`
path, and with it every mapped message and error code the pillar defines. The defect is (a) the deletion
outside the root, and (b) an **unmapped, leaky** error rather than a refusal.

Likewise, "leaves the tree deleted-but-uncommitted" holds only in the sense that *no commit records the
deletion*; `git status` is clean afterwards, because the victim lives outside the repository. There is no
dirty-tree signal for the operator to notice.

### Why the existing guards miss it

- **`requireCustomAsset`** (`src/core/builtin-asset.ts`, REQ-SEC-07 clause (a), `task-042`) is a
  string-level allow-list over the `.wingfoil`-relative path. `directives/custom/legacy-rule.md` is
  exactly the shape it accepts, so it passes — correctly, on the text it is given.
- **`task-042` predicted this**, in that module's own doc (`src/core/builtin-asset.ts:27-30`): "`.`/`..`
  segments are **refused, not resolved**: resolving them textually is not equivalent to resolving them on
  a filesystem (a symlinked `custom/` aliasing `built-in/` defeats any string-level normalisation)". It
  named the `custom/` → `built-in/` aliasing case; the outside-the-root case is the same hole pointed the
  other way. What makes it destructive rather than theoretical is `removeDocument` — `task-052` adds the
  first file-deletion primitive in the codebase (its own notes record
  `grep -rn "unlinkSync\|rmSync\|removeDocument" src/` → no hit before it).
- **`resolveConfinedMemoryPath`** (`src/storage/memory-path.ts:69-82`, REQ-SEC-06,
  `task-017-storage-confinement`) would not catch it, for two independent reasons. It is scoped to
  **Memory** paths, not directives; and it is **textual** — `resolve(root)`, `resolve(root, rendered)`,
  `relative()`, with no `realpathSync` anywhere in `src/` (`grep -n "realpath" -r src/` → no hit). A path
  whose every segment is inside the root but whose *filesystem* target is not passes it unchanged.

### The benign case, verified safe

A symlinked **`.md` file** inside a real `custom/` directory behaves correctly: the link is unlinked, the
target survives, and the removal commits normally.

```
$ ln -s ../../../../outside2/target-rule.md .wingfoil/directives/custom/benign-rule.md
$ git add -A && git commit -qm "plant symlinked md"
$ node <clone>/dist/cli.js directive remove benign-rule
{ "name": "benign-rule", "path": ".wingfoil/directives/custom/benign-rule.md" }
$ echo $?; ls ../outside2; git log --oneline -1
0
target-rule.md                 # <-- target intact
4d27a73 wf(directive): remove benign-rule
```

`git` treats a symlink *file* as a tracked blob it can stage; it refuses only to reach *through* a
symlinked directory. So the whole defect is the directory case.

### Severity

**Medium**, not high: it is self-inflicted — the project owner must themselves replace
`.wingfoil/directives/custom` with a symlink pointing outside the root, which no WingFoil command does and
`wingfoil init` never produces. There is no path by which another party induces it. But when it does
happen the loss is silent and real, and the operator-facing failure is a leaked `execFileSync` message.

### Suggested fix — do NOT apply as part of this report

1. **Realpath-based confinement for the directives store**, mirroring REQ-SEC-06's intent: before any
   unlink, resolve the target with `realpathSync` and require it to be strictly inside
   `realpathSync(root)`. Textual normalisation provably cannot do this (`task-042`'s own module doc says
   so). This probably wants to be a shared primitive alongside `resolveConfinedMemoryPath` rather than a
   second implementation, so `workflow remove` (P4.9, still unowned per `dl-030`) inherits it instead of
   re-deriving it.
2. **Map the `commitPaths` failure.** A `git add`/`git commit` failure inside a mutating op should surface
   as a `CoreError`, not as `Command failed: git -C <absolute path> …`. Worth deciding together with
   `bug-027-commit-paths-commits-whole-index`, since both are about `commitPaths`' contract.
3. **Order**: whatever the confinement check is, it must run **before** `removeDocument`, in the
   pre-flight block alongside `requireCustomAsset` — "every refusal before the single write", the order
   `task-050` and `task-048` already establish.

## Triage & Execution Notes

Raised by `task-052-directive-remove`'s independent review. Every step above was re-run first-hand in a
throwaway clone of branch `task/task-052-directive-remove` (`a624067`) rather than transcribed; the two
corrections under "Correction to the first framing" are the result. Filed unfixed per the ingest plan —
the agent stops at `open`. `task-052` is `in-review` on that branch and not merged, so this bug describes
code that is not yet on `main`; it should reach that task's reviewer/approver before the merge, not after.

Related: REQ-SEC-06, REQ-SEC-07, P3.3, `task-017-storage-confinement` (`resolveConfinedMemoryPath`),
`task-042-immutable-builtin-assets` (`requireCustomAsset`, and the prediction at
`src/core/builtin-asset.ts:27-30`), `task-052-directive-remove`,
`bug-027-commit-paths-commits-whole-index`, `bug-026-type-error-on-main-untested-by-any-gate` (why the
build had to go through `tsconfig.build.json`), `dl-030-req-sec-07-referenced-asset-ownership` (P4.9,
which inherits the same store), `src/storage/commit.ts:27-32`, `src/cli/registrar.ts:115-123`,
`src/core/exit-code.ts:62-71`, `src/storage/memory-path.ts:69-82`.
