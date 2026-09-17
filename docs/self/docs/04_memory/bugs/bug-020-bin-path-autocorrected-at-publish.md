---
id: "bug-020-bin-path-autocorrected-at-publish"
type: bug
title: "bin.wingfoil's leading ./ makes npm auto-correct the manifest at publish, and spec-015 §1 pins the bad value"
status: in-review
severity: "low"
release-origin: "v0.1"
release: "v0.2"
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`package.json` declares `"bin": { "wingfoil": "./dist/cli.js" }`. npm rejects the leading `./` in a
`bin` target, rewrites the manifest at publish time and warns:

```
npm warn publish "bin[wingfoil]" script name dist/cli.js was invalid and removed
```

The wording is misleading — the command is not removed, the path is normalised — but the warning is
emitted on every publish and every `publish --dry-run`.

## Steps to Reproduce

1. `npm publish --dry-run` on `main`. The warning appears.
2. Isolate: a probe package with `"./dist/cli.js"` reproduces it; the same package with
   `"dist/cli.js"` emits nothing. (`task-059`'s reviewer built both.)

## Expected Behavior

A clean `publish --dry-run` with no manifest auto-correction, so that a warning appearing in CI means
something new happened.

## Actual Behavior

The warning is permanent and pre-existing — it is on `main` and predates `task-059`, which only
surfaced it while implementing `spec-015` §1.

## Notes

**Not a functional defect.** `task-059`'s reviewer packed a probe, installed it into a throwaway
prefix and confirmed the shim works (`wingfoil -> ../lib/node_modules/probe-pkg/dist/cli.js`), so
REQ-SYS-09's fit criterion holds either way.

**Why it was not simply fixed:** `spec-015` §1 lists `bin.wingfoil: ./dist/cli.js` under **"Unchanged"**.
Correcting it inside `task-059` would have contradicted an approved spec, so the task correctly left it
and raised it. Closing this bug therefore means **either** amending `spec-015` §1 to drop the `./`,
**or** explicitly accepting the warning and recording that acceptance — it is a spec question, not a
code question.

**Why it is worth closing rather than tolerating.** `task-060-publish-pipeline` wires
`npm publish --dry-run` as the `spec-015` §3 stage-1 CI gate. Once it does, this warning lands in the
log of every CI run, where the next person to read it has no way to know it is known and accepted.
A gate whose output contains permanent expected noise is a gate people stop reading — the same failure
mode `bug-009`'s red lint baseline produced, in a milder form.

Cheapest resolution: amend `spec-015` §1 (one character) and change `package.json` to match. Should
land **before** `task-060` wires the gate, not after.

## Triage & Execution Notes

- **Resolution chosen by the approver: amend the spec.** `spec-015` §1 now specifies
  `bin.wingfoil: dist/cli.js` without the leading `./`, and the matching `package.json` change is
  assigned to `task-060-publish-pipeline`'s Acceptance Criteria — the task that wires the CI gate and
  would otherwise inherit the noise. Scheduled `v0.2` accordingly.
  Note this bug carries no `bug:` back-reference from `task-060`, because that task is not a derived
  fix task; `bug.sync_state` will therefore not advance it automatically and it needs closing by hand
  once `task-060` lands.
- capture (`bug-ingest`): raised by `task-059`'s review. Severity `low` — no functional impact, no user
  can hit it; the cost is entirely in the signal-to-noise of a CI gate that does not exist yet.
