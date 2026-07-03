---
id: dl-005-manual-approval-gates
type: decision-log
title: "Manual approval gates (no automated approval) in the MVP"
status: in-discussion
context: process
release: ""
tmpl_version: 260703
---

## Context

Workflows reach approval gates — key state transitions where human oversight is essential. These gates could be 
implemented as automated CI/CD checks (e.g., branch protection rules, automated validations), or they could require a 
human in the `approver` role to explicitly approve each transition. The choice impacts how WingFoil enforces governance 
and accountability as development flows through workflows.

## Decision

Approvals are **manual** — a human in the `approver` role ([SPEC] P4.14, team members defined in `.wingfoil/dna.yaml`) 
must explicitly approve state transitions. No automated CI/CD approval gates or algorithmic validation gates in the MVP.

## Rationale

This decision serves three purposes:

1. **Accountability**: Keeping a human decision-maker in the approval path ensures explicit accountability for state 
   changes (e.g., releasing a version, accepting a task, approving a design decision) while the tool matures and team 
   workflows stabilize.

2. **Role-based model alignment**: WingFoil's governance is built on role-based directives and approval routing 
   ([SPEC] P4.14, §4 "Golden Rules"). Agents never self-approve — they can only *propose* work (submit memory documents, 
   write code); humans in the `approver` role make final decisions. A manual gate enforces this principle from day one 
   and prevents agents from circumventing governance through automation.

3. **Future-compatible design**: Automation can be layered on later (e.g., "auto-approve if all tests pass") without 
   changing the approval model. The human remains the final authority; automation becomes an optional accelerant, not 
   a replacement.

The trade-off is slower workflow throughput in the MVP compared to fully automated pipelines. This is acceptable: 
WingFoil's north star is determinism (consistent, predictable development), not velocity; and single-developer/small-team 
adoption in v0.1–v0.2 means approval latency is not yet a blocker.
