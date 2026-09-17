---
id: "dl-059-builtin-security-directive-bound-to-no-role"
type: decision-log
title: "The built-in `security` directive is bound to no role, so no agent context loads it — bind it globally, or narrow REQ-SEC-08's reliance on it"
status: in-discussion
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

**REQ-SEC-08** (`docs/02_requirements/03_sard/05_security-compliance.md:79-85`): "Credentials and
secrets are handled per the built-in Security directive and are never persisted into Memory, DNA, or
Directives"; Fit Criterion: "After `init`, the built-in `security` directive is present; a scan of
committed `.wingfoil/` content matches 0 known secret patterns".

The Fit Criterion checks that the directive **exists**. Nothing makes it **apply**: a directive reaches an
agent only through `roles.yaml` (`assignments` per role, plus `global`), and `security` is in neither —
in the scaffold or in this repository's own configuration. Verified on `main` (`8a6a091`):

- **Scaffold:** `rolesYaml()` in `src/storage/templates.ts` (lines ~280-310) assigns `code-quality,
  testing, determinism` / `code-review, traceability` / … per role and
  `global: [doc-versioning, documentation, security-secrets]`; `grep -n security src/storage/templates.ts`
  → only the `DIRECTIVES` catalogue entries (`:203`, `:204`) and `- security-secrets` in the roles scaffold
  (`:307`). Same on `task/task-057-builtin-directive-templates` (`9b77243`, `:303`), which moves
  `security` into `built-in/`.
- **Dogfood:** `docs/self/.wingfoil/roles.yaml` binds `security-secrets` globally and states the omission
  on purpose (`:4-6`): "The generic `security` stand-in is left unassigned here; its WingFoil
  elaboration `security-secrets` is assigned globally."

So no `developer-session` Prompt, no `directives list --role` preview and no future `agent execute`
context contains `security`. What `security-secrets` does not cover: the built-in's non-secret rules —
on `9b77243`, `src/storage/builtin-directives.ts:97-108`: "Validate and sanitize all external input at
trust boundaries", "Grant the least privilege each component needs", "Review dependencies for known
vulnerabilities…" — and, for a freshly initialised project, the scaffold's `security-secrets` is a
one-line summary ("Never commit credentials or secrets; …", `src/storage/templates.ts:204`), weaker than
the built-in's credential rules.

`task-057` flagged the unbound id and deliberately left the binding unchanged
(`git show 9b77243:docs/self/docs/04_memory/v0.2/task-057-builtin-directive-templates.md`, line 150).

## Decision

*Approver to choose.*

1. **Bind `security` globally in the `init` scaffold** (recommended), alongside `security-secrets`.
   Every role in every new project then receives the built-in Security directive — which is what
   REQ-SEC-08's Description ("handled per the built-in Security directive") presupposes. Decide
   separately whether this repository's dogfood `roles.yaml` follows (its `security-secrets` is a richer
   elaboration; binding both is harmless, since resolution deduplicates by id).
2. **Bind `security` to specific roles** (e.g. `developer`, `architect`, `reviewer`) in the scaffold.
   Narrower; leaves roles such as `product-owner` or `approver` without the credential rules.
3. **Keep it unbound and amend REQ-SEC-08** so its Description relies on whatever directive the project
   binds (e.g. "per the project's bound security directives"), with presence of the built-in as a
   baseline asset only.

## Rationale

- A security directive that no role loads is inert for agents; the requirement's Fit Criterion is met
  while its Description is not.
- Global binding is the pattern the scaffold already uses for cross-cutting rules
  (`doc-versioning`, `documentation`, `security-secrets`), and REQ-SEC-08 is cross-cutting.
- Option 3 is coherent only if the project wants `security-secrets` to be *the* security rule; then the
  requirement should say so rather than name a directive nothing loads.

## Actions

- Owner **approver**: choose.
- If 1 or 2: change `rolesYaml()` in `src/storage/templates.ts` (after `task-057` merges, which edits the
  same file), update `test/storage/templates.test.ts` / init tests, and decide the dogfood `roles.yaml`
  line.
- If 3: amend REQ-SEC-08's Description.

Related: REQ-SEC-08, BDD `P3.8`, BDD `P3.7` (its example assigns `security` to `developer`),
`task-057-builtin-directive-templates`, `dl-058`, `bug-038`, `spec-007`.
