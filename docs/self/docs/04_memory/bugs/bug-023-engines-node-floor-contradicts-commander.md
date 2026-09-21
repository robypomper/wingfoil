---
id: "bug-023-engines-node-floor-contradicts-commander"
type: bug
title: "package.json declares engines node >=18 but commander@15 requires >=22.12 — published contract is false"
status: in-review
severity: "medium"
release-origin: "v0.2"
release: "v0.2"
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`package.json:16` declares `"node": ">=18.0.0"`, while the installed `commander@15` declares
`"engines": {"node": ">=22.12.0"}`. The package advertises support for a Node floor its own
dependency tree does not accept.

## Steps to Reproduce

1. On Node 18: `npm i -g wingfoil` (or install the packed tarball).
2. npm emits `EBADENGINE`.
3. With `engine-strict=true` in `.npmrc`, the install **hard-fails**.

## Expected Behavior

The declared `engines.node` floor is one every dependency actually supports.

## Actual Behavior

The floor is three majors below what `commander@15` requires.

## Notes

This is a **published-contract defect, not a test-harness note**. Node 18+ is a declared product
constraint in `dna.yaml` (`stacks.technologies`) and in the product brief, and
`spec-015-packaging-publishing:60` actively pins `engines: node >=18` under "Unchanged" — so the
**approved spec ratifies the wrong floor** and has to move with the fix.

**Nobody owns it today.** `task-059-publish-metadata` is `done` and its acceptance criteria never
validated `engines` against the dependency tree; `test/cli/publish-metadata.test.ts` makes no
`engines` assertion at all; and `task-060`'s Verdaccio staging smoke runs `npm install -g wingfoil`
on CI's Node (≥22), so it will not catch this.

Runtime may well survive on Node 18 — commander's only notable builtin use is
`stripVTControlCharacters` from `node:util` (Node ≥16.11), plus optional chaining — but the declared
contract is wrong either way, and guessing that it works is not a contract.

Fix shape: decide the real floor (raise ours, or pin an older commander), correct `package.json` and
`spec-015` §1 together, and pin it with an assertion in `publish-metadata.test.ts` that every
dependency's `engines.node` range is satisfied by ours — so the next dependency bump cannot
reintroduce it silently.

**Scheduled v0.3 by the approver.** It blocks nothing in v0.2 development, but it must land before
`task-060` / `task-061` publish for real.

## Triage & Execution Notes

Raised from `task-065`'s dev-loop review (v0.2). Severity `medium` — wrong published contract, no
development impact. `release: v0.3` per the approver's scheduling decision.
