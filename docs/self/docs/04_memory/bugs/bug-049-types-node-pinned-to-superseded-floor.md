---
id: "bug-049-types-node-pinned-to-superseded-floor"
type: bug
title: "`@types/node` is pinned `^18.19.130` explicitly to match the old floor, so the codebase types against Node 18 while promising >=22.12"
status: in-progress
severity: "medium"
release-origin: "v0.2"
release: "v0.2"
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`@types/node` is pinned to `^18.19.130` — not incidentally, but as a **deliberate** decision recorded
in `task-001`'s Execution Notes to match `engines.node >=18.0.0`. Once `adr-010-node-22-runtime-floor`
raises the declared floor to `>=22.12.0`, that pin stops tracking the contract it was set to track:
`src/` would typecheck against a Node 18 API surface while the package promises Node 22.12+, so the
compiler can no longer tell a developer that an API they used is unavailable on the supported runtime
— and, worse, will reject APIs that *are* available on it.

## Steps to Reproduce

Measured 2026-09-21 in a clean worktree of `main` at `bcc66a9`, after `npm ci` (exit 0).

1. Read the pin, in all three places it is recorded:

```
$ node -e 'console.log(require("./package.json").devDependencies["@types/node"])'
^18.19.130
$ node -e 'const l=require("./package-lock.json");console.log(l.packages[""].devDependencies["@types/node"])'
^18.19.130
$ node -e 'console.log(require("./node_modules/@types/node/package.json").version)'
18.19.130
$ grep -n '"node_modules/@types/node"' -A2 package-lock.json
1592:    "node_modules/@types/node": {
1593-      "version": "18.19.130",
1594-      "resolved": "https://registry.npmjs.org/@types/node/-/node-18.19.130.tgz",
```

2. Read why it is pinned — `task-001-nodejs-typescript-scaffold`, Execution Notes `:89-90`:

   > **`@types/node` pinned to `^18` (not latest `^2x`)**, matching the `engines.node >=18.0.0` floor,
   > so stub/future code doesn't typecheck against Node APIs newer than the minimum supported runtime.

   The pin's stated justification is the floor. When the floor moves, the justification moves with it;
   the pin does not.

3. Confirm the declared floor is about to move:

```
$ node -e 'console.log(JSON.stringify(require("./package.json").engines))'
{"node":">=18.0.0"}          # adr-010 (pending) decides >=22.12.0; task-074 (backlog) applies it
```

4. Confirm the local runtime is already far past the type surface: `node -v` → `v22.21.0`, and
   `.github/workflows/publish.yml:78` pins CI at `22.12.0`. So *every* environment that actually runs
   this code is Node 22, while the types describe Node 18.

## Expected Behavior

`@types/node`'s major tracks the declared `engines.node` floor, as `task-001` intended — so the
compiler's model of the runtime matches the runtime the package promises.

## Actual Behavior

The pin is frozen at the floor's *old* value. After `task-074` it will describe a runtime three
majors below the one declared, with nothing connecting the two.

## Notes

### The failure is two-directional, and the second direction is the costly one

- **False negatives** (what `task-001` guarded against): code using a Node 20/22 API typechecks as an
  error, so a developer cannot use the runtime the package actually requires without fighting the
  compiler or reaching for `any`.
- **Stale surface**: types for APIs whose signatures changed between 18 and 22 describe the older
  shape, so the compiler agrees with a runtime nobody runs. This is the quieter failure, and there is
  no gate that would report it: `tsc -p tsconfig.build.json` passes against whatever `@types/node`
  says, by construction.

### Sequencing — after task-073, and probably alongside task-074

Bumping `@types/node` is **lockfile-aware**: it changes `package.json`'s `devDependencies` and
rewrites `package-lock.json`'s `node_modules/@types/node` entry (step 1 shows all three copies). That
puts it downstream of `task-073-fix-stale-package-lock` (`done`, merged `2151946`), whose whole
contribution was a three-line lock refresh, and it must not ride the same diff as an unrelated change
— `task-073`'s own convention is that a lock change is reviewable only when it is the whole diff.

It is also the kind of bump that surfaces new type errors across `src/` and `test/` in one go, which
makes it a poor passenger on `task-074` (a one-string manifest edit plus a guard). The honest shapes
are: (a) its own task, sequenced immediately after `task-074`; or (b) explicitly in scope for
`task-074` with the type fallout budgeted. This report does not choose.

### Interaction with the typecheck gate

`bug-026-type-error-on-main-untested-by-any-gate` and `dl-044-typecheck-gate-for-test-sources` concern
whether `tsc --noEmit` covers test sources. A `@types/node` major bump is exactly the change that
would exercise that gap: type errors it introduces in `test/` may not be caught by whatever gate
exists. Whoever does the bump should check those two first rather than discovering it in review.

### Suggested fix — do NOT apply as part of this report

After `adr-010` is `accepted` and `task-074` has set `engines.node` to `>=22.12.0`, bump
`@types/node` to the `^22` line matching it, in a change whose diff is the bump plus the type fallout
and nothing else. Re-verify `task-001`'s rationale still applies in the new form (it does: the pin
exists to keep the type surface at the *minimum supported runtime*, which is the rule, not the number
18), and record the new number's justification the same way.

Severity **medium**: no runtime impact — `@types/node` is dev-only, is not in the production closure
and is not in the published tarball (`files: ["dist", "README.md"]`) — but it silently degrades the
compiler's ability to enforce the runtime contract across all of `src/`, which is a correctness tool
the `code-quality` and `determinism` directives lean on.

## Triage & Execution Notes

Raised during the v0.2 release-governance ingest (2026-09-21), from the review of
`task-074-fix-engines-node-floor` (`backlog`). Filed unfixed per the ingest plan — the agent stops at
`open`.

Every figure above was read from the files named, in a worktree where `npm ci` had been run (exit 0);
`task-001`'s rationale was quoted from its Execution Notes rather than paraphrased from memory. Not
attempted here: actually bumping `@types/node` to see how much of `src/` and `test/` breaks. That
number is unknown and should be measured by the task that takes this on, not estimated.

Related: `adr-010-node-22-runtime-floor` (`pending`, moves the floor this pin was matched to),
`bug-023-engines-node-floor-contradicts-commander` (`planned`), `task-074-fix-engines-node-floor`
(`backlog`), `task-073-fix-stale-package-lock` (`done`, the lockfile predecessor and the
whole-diff convention), `task-001-nodejs-typescript-scaffold` (`done`, Execution Notes `:89-90` — the
pin and its stated reason), `bug-026-type-error-on-main-untested-by-any-gate`,
`dl-044-typecheck-gate-for-test-sources`, `bug-046-lock-root-engines-never-asserted` (the other
lockfile/manifest agreement nothing asserts), `package.json` `devDependencies`,
`package-lock.json:1592`.
