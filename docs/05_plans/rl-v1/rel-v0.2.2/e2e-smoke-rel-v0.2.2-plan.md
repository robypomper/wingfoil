---
id: e2e-smoke-rel-v0.2.2-plan
type: plan
title: "E2E smoke — v0.2.2 (fresh-init + CLI black-box gate, mcp-registration, examples)"
status: draft
version: ""            # optional — plan version
workflow: "e2e-smoke"
phase: "rel-v0.2.2"
element: ""            # optional — the Memory element this phase iterates (e.g. a release id)
release: ""            # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

<!-- Why this phase runs now, its preconditions, and what it produces. Keep coherent with the
     workflow definition's phases / roles / actions / produces / checks (dl-019).
     Every plan's preconditions include that the build in use is the pinned one (dl-095):
     `npm run -s wingfoil -- --version` prints the version package.json pins for
     `wingfoil-released`. -->

## Phases / Steps

<!-- The ordered steps to execute against the workflow phase — actions, roles, gates, models. -->

## Handoff

<!-- What requires the approver vs. the agent; the checkpoint(s) and the completion criteria. -->
