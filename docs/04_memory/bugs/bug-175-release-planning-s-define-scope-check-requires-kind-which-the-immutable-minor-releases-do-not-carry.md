---
id: bug-175-release-planning-s-define-scope-check-requires-kind-which-the-immutable-minor-releases-do-not-carry
type: bug
title: "release-planning's define-scope check requires kind, which the immutable minor releases do not carry"
status: triaged
severity: "low"
release-origin: "v0.3"
release: ""
feature: "P1.13"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`release-planning.yaml`'s define-scope post-check requires `kind` on the release, and `memory.yaml`
lists `kind` among the release type's required fields, while the same `memory.yaml` declares that the
releases added before `dl-092` (`minor-v0.1` … `minor-v1.0`) are immutable and carry no `kind:` field.
For `minor-v0.3`, `minor-v0.4` and `minor-v1.0` the check can never pass.

## Steps to Reproduce

1. `grep -n "frontmatter.required" .wingfoil/workflows/custom/release-planning.yaml` → line 46:
   `post: ["frontmatter.required: [title, kind, version, pillar, features, requirements, release-line]"]`
   (`# dl-092: + kind`).
2. `sed -n 94p .wingfoil/memory.yaml` → the release `id_pattern` comment: "ids added before dl-092
   (minor-v0.1..minor-v1.0) are immutable and carry no `kind:` field".
3. `sed -n 100p .wingfoil/memory.yaml` → `required: [ title, kind, version, pillar, features, requirements, release-line ]`.
4. `grep -c "^kind:" docs/04_memory/planning/rl-v1/minor-v0.3.md` → `0`.

## Expected Behavior

One rule, stated once: either the pre-`dl-092` minors are exempt from `kind` and the check says so, or
they carry `kind: minor` (which changes no id, since the ids are already `minor-*`) and the "carry no
`kind:` field" clause is dropped.

## Actual Behavior

The two declarations contradict each other. v0.3's define-scope could not satisfy its own post-check
without breaking the `memory.yaml` rule, so it left `minor-v0.3` without `kind:` and recorded the
contradiction (`release-planning-rel-v0.3-plan`, *Observations*). No command fails today: the check is
not executed by any engine yet (P4.12 is v1.0), and the release's `planning → in-development` edge is a
`waiting` edge with no CLI verb, so `memory submit`'s required-field check never runs on these files. It
will fail as soon as either happens.

## Notes

- Origin: `dl-092` (Q1 (A), `kind` field) and its implementation at `92908e8c`, which added `kind` to
  the required list and to the check while declaring the older ids immutable.
- Found by v0.3's `release-planning`, step 1 (define-scope), 2026-09-29.

## Triage & Execution Notes

- capture (bug-ingest, `bug-ingest-rel-v0.3-planning-findings-plan`): no duplicate found
  (`grep -l "kind" docs/04_memory/bugs/*.md | xargs grep -l -i "define-scope"` → nothing). Proposed
  severity **low**: nothing fails today, and the fix is a one-line configuration decision.
