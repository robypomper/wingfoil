---
id: "bug-138-unused-anthropic-sdk-runtime-dependency"
type: bug
title: "`@anthropic-ai/sdk` is a declared runtime dependency but is imported nowhere in `src/`"
status: open
severity: "low"
release-origin: "v0.2"
release: "v0.2.2"
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`package.json` lists `@anthropic-ai/sdk` as a runtime `dependencies` entry, but no file under
`src/` imports it — every published install carries a dependency the shipped code never loads.

## Steps to Reproduce

1. `grep -n "\"@anthropic-ai/sdk\"" package.json` → `"@anthropic-ai/sdk": "^0.110.0",` under
   `dependencies` (not `devDependencies`).
2. `grep -rn "@anthropic-ai" src/` → no matches: nothing in `src/` imports or requires the package.
3. `du -sh node_modules/@anthropic-ai 2>/dev/null` on a fresh `npm install` shows the package (and
   its own transitive dependencies) are pulled down for every consumer even though `dist/` never
   references them.

## Expected Behavior

`package.json`'s `dependencies` lists only packages the published `dist/` actually imports at
runtime; a declared-but-unused SDK either gets a real call site or is removed.

## Actual Behavior

The dependency sits unused. `dna.yaml`'s own `stacks.technologies` entry for the Anthropic SDK
already records this drift from ADR-004's original framing (`grep -n "anthropic" docs/self/.wingfoil/dna.yaml`
shows the technology entry with a note to that effect), but the `package.json` manifest itself has
not been corrected to match.

## Notes

- Root cause: the dependency was added for an anticipated integration (per ADR-004) that the
  shipped `src/` design never ended up needing — every AI-facing surface in this project is the MCP
  server (`src/mcp`) talking stdio to a caller's own agent process, not a direct SDK call from
  WingFoil's own code.
- Fix: remove `@anthropic-ai/sdk` from `package.json` `dependencies` (and its lockfile entry), or —
  if a future release plans an actual call site — move it to `devDependencies`/`optionalDependencies`
  until one exists, and update `dna.yaml`'s drift note accordingly.

## Triage & Execution Notes

- capture: filed by the v0.2 retrospective (retro-v0.2), from the packaging/dependency-surface
  review pass.
