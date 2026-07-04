---
id: adr-006-git-identity-role-based-authz
type: adr
title: "Git identity for attribution, role-based authority for approval"
status: accepted
sard_ref: REQ-SEC-01, REQ-SEC-03, REQ-SYS-08
supersedes: ""
tmpl_version: 260703
---

## Context

WingFoil needs two related but distinct guarantees: every state change must be attributable to a real
actor, and every approval decision must be gated to actors who actually hold the authority to make it.
A conventional design would reach for an external identity provider (OAuth2, Cognito, Auth0) to
authenticate users and a role/permission table to authorize them. That would add a runtime service,
network dependency, and account-provisioning step to a tool whose entire value proposition is "zero
infra to operate" and "git-backed single source of truth" (REQ-SYS-01) — every project state artifact
lives as a file in the project's own git repository, reconstructable from a clone with no external data
source. Introducing an external IAM provider would put authentication state outside that boundary,
breaking the single-source-of-truth guarantee and adding a dependency most projects (and most solo or
small-team users of WingFoil) don't need.

Separately, if approval authority or directive bindings were hardcoded to named individuals (e.g. "Sabina
approves releases"), every team change — a hire, a role reassignment, a contractor rotation — would
require editing directive and workflow files throughout the config. That coupling also has no clean
meaning for AI agents, which act on behalf of a function (developer, reviewer, qa, architect) rather than
as a named person with an email inbox.

Without this decision, WingFoil would either need an external identity service to establish "who did
this," or would fall back on unenforced convention (trusting commit authorship without validation), and
approval/directive rules would ossify into per-person hardcoding that breaks on every team change.

## Decision

Two combined points:

1. **Git identity is the attribution mechanism for every state change.** WingFoil requires a configured
   git identity (`user.name` + `user.email`) before any state-mutating command runs; with no configured
   identity, the command fails and writes nothing. Every commit's author and the git commit timestamp
   supply the "who" and "when" for the audit trail — there is no separate authentication layer, session
   system, or external IAM/OAuth2/Cognito/Auth0 provider. Identity is exactly what git already tracks.
2. **Approval authority and directive binding are role-based, never bound to a named person.** Roles
   (`developer, reviewer, qa, architect, product-owner, tech-lead, facilitator, approver`) are defined in
   `dna.yaml` under `team.roles`, and each team member (or AI agent) is granted a set of roles via
   `team.members[].roles` / `team.agents[].executes_as`. Directives and workflow approval steps reference
   roles, never people. AI agents execute under roles such as `developer/reviewer/qa/architect` but never
   hold approval authority (`approval_authority: false` in `dna.yaml`); every approval routes to a human
   holding the `approver` role.

## Consequences

- **Positive:**
  - No external identity service to provision, operate, or trust — attribution rides on git, which is
    already the project's single source of truth (REQ-SYS-01), so a fresh clone reproduces the full
    audit trail with zero extra infrastructure.
  - Reassigning a person's role in `dna.yaml` changes their effective directives and approval authority
    project-wide with zero edits to directive or workflow files (REQ-SYS-08 fit criterion).
  - AI agents slot into the same model as humans (execute under a role) without needing a bespoke
    permission system, and are structurally prevented from self-approving.
- **Negative:**
  - Attribution is only as strong as local git configuration — WingFoil cannot verify that
    `user.name`/`user.email` actually correspond to the person who ran the command (no cryptographic
    identity proof, e.g. GPG signing, is required by this decision).
  - Every role referenced by a directive assignment or workflow approval step must be defined in
    `dna.yaml`'s `team.roles`, or the reference is rejected — adding a new approval gate requires a DNA
    edit first.
  - Because roles are declared, not inferred, a misconfigured `dna.yaml` (e.g. an approver role granted
    to no one) can silently block all approvals until corrected.
- **Neutral:**
  - One person may hold many roles simultaneously — in WingFoil's own dogfooding config, Roberto
    Pompermaier holds all eight roles including `approver`.
  - This decision does not preclude adding stronger attribution (e.g. commit signing) later; it only
    fixes git identity as the baseline mechanism, with no external IAM as an alternative path.

## Process Notes

Grounded in `docs/02_requirements/03_sard/05_security-compliance.md` (REQ-SEC-01, REQ-SEC-03),
`docs/02_requirements/03_sard/01_architecture.md` (REQ-SYS-08), and `docs/self/.wingfoil/dna.yaml`
(`team.members`, `team.agents`, `team.roles`). Point 1 (REQ-SEC-01) and its consequences were
authored fresh against the SARD ground truth. This ADR is filed as `pending` per the current
template scaffold.
