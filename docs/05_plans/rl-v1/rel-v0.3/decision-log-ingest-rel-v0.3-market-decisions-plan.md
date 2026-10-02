---
id: decision-log-ingest-rel-v0.3-market-decisions-plan
type: plan
title: "Decision-log-ingest — rel-v0.3 market positioning and direction decisions"
status: active
version: "1.0"
workflow: "decision-log-ingest"
phase: "rel-v0.3-market-decisions"
element: "minor-v0.3"
release: "v0.3"
tmpl_version: 260703   # Orignal template version
---

## Context

On 2026-10-02 the approver ratified, in substance, six strategic decisions on WingFoil's
positioning, long-term direction and next features, and asked that they be recorded as
decision-logs. The request reached this session from another working session. They are captured
through `decision-log-ingest` (`.wingfoil/workflows/custom/decision-log-ingest.yaml` v1.0), during
v0.3's dev-loop.

Preconditions:
- the decision-logs are created with the code version (`npm run build && node dist/cli.js memory
  …`), not the pinned build: 0.2.1 cannot be trusted with `memory add` ids on this repository
  (`bug-087`/`bug-162`, fixed by `task-128`). The pinned build stays the dl-095 declaration
  (`npm run -s wingfoil -- --version` → `0.2.2`);
- each decision-log carries its whole content and cites only public sources, read 2026-10-01 or
  2026-10-02. Every fact it states about a public source is checked against that source at capture;
  every fact about this repository names the command or file that establishes it (`claim-evidence`).

Produces `docs/04_memory/design/dls/{id}.md` for each decision, in state `in-discussion`.

## Phases / Steps

1. **capture** (product-owner): one decision-log per decision, `memory add --type decision-log`
   then `memory submit` (`draft → in-discussion`):
   - `dl-140` — positioning, primary target and message (D1, D2, D5), with the roadmap order (D3)
     and the first-wave channels (D6) as its Consequences;
   - `dl-141` — long-term direction: no runtime of WingFoil's own (D4);
   - `dl-142` — approval of agent plans as a recorded transition;
   - `dl-143` — one generator for every agent's instruction formats. Recorded as a new
     decision-log that extends `dl-137` rather than as an amendment of it: `memory amend` needs the
     approver role, and `dl-137`'s open questions Q1–Q3 stay where they are;
   - `dl-144` — importers, OpenSpec first, then Spec Kit;
   - `dl-145` — the user guide's Integrations section.
2. **approve** (⛔ approver): `in-discussion → ready` for each, or `reject → draft`.

## Handoff

- **Approver:** ratification of `dl-140`…`dl-145`, and the final tagline wording (`dl-140`).
- **Agent:** capture and fact checks; the tasks follow at release-planning v0.4 (`dl-140`
  Consequences give the order).
- **Completion criteria:** `dl-140`…`dl-145` `ready` (or back to `draft`); this plan
  `active → done`.

## Execution Notes
