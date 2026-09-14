---
id: "dl-033-canonical-role-resolver"
type: decision-log
title: "Two role resolvers, two answers: does an AI agent hold the `approver` role? (task-034 vs task-040)"
status: ready
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Two v0.2 tasks, developed in parallel and both currently `in-review`, independently implemented role
resolution over `dna.yaml` — and they disagree on the one question that matters for security.

**`task-034-role-based-binding`** (`src/dna/roles.ts`) counts agents as role holders:

```ts
export function resolveRoleHolders(dna: DnaYaml, role: string): RoleHolders {
  assertRoleDefined(dna, role);
  return {
    members: dna.team.members.filter((member) => member.roles.includes(role)),
    agents: (dna.team.agents ?? []).filter((agent) => agent.executes_as.includes(role)),
  };
}

export function resolveApprover(dna: DnaYaml, role: string): TeamMember | AgentEntry {
  const { members, agents } = resolveRoleHolders(dna, role);
  const holder = members[0] ?? agents[0];
  if (!holder) throw new NoRoleHolderError(role);
  return holder;
}
```

`approval_authority` is never consulted. With the `approver` role held by no human member and an
agent whose `executes_as` includes it, `resolveApprover` returns the agent.

**`task-040-role-based-approval-authority`** (`src/core/approval-authority.ts`) resolves from
`team.members` only, by git-identity email, and never looks at `team.agents` — a deliberate choice its
module documentation states explicitly.

`adr-006-git-integrity-role-based-authz` (`accepted`) settles the substance in task-040's favour: AI
agents "execute under roles such as developer/reviewer/qa/architect but **never hold approval
authority** (`approval_authority: false` in `dna.yaml`); every approval routes to a **human** holding
the `approver` role." CLAUDE.md §4 and §8 say the same. `src/dna/schema.ts` documents
`approval_authority` as the REQ-SEC-03 carrier — and the only function in the codebase that makes an
approval-routing decision ignores it.

`task-034`'s own module doc names `task-040` as its consumer. `task-040` did not use it, and neither
branch is merged, so the duplication is not yet on `main`.

## Decision

*(in-discussion — proposed, not yet ratified)* **Option (b): two resolvers, one hard boundary.**
`src/core/approval-authority.ts` is canonical for *authority* ("may this principal approve?");
`src/dna/roles.ts` is canonical for *binding* ("which directives does this role load?", P5.4.2) and
is scoped out of approval entirely — meaning `resolveApprover` is **removed** from `task-034`, not
patched.

Alternatives:

- **(a) `src/dna/roles.ts` canonical**, with `task-040` refactored onto it and `resolveApprover`
  filtering candidates by `approval_authority === true`. Keeps one resolver, but keeps the two
  questions fused in one module — which is what produced the defect.
- **(c) Keep both as they are**, with a documented split of responsibilities. Rejected: it leaves two
  functions that answer "who holds `approver`" differently, which is a correctness trap for the next
  reader regardless of documentation.

## Rationale

- "Who holds this role" and "may this principal approve" are genuinely different questions with
  different answers, and `adr-006` only constrains the second. Agents *do* hold `developer`/`reviewer`
  roles — that is what `executes_as` is for — so `resolveRoleHolders` including agents is correct for
  directive binding and wrong for approval routing. Conflating them is the root cause, not the
  fallback line.
- Under (b) the fix to `task-034` is a deletion, not a new branch of logic. Deleting the function that
  cannot be made safe in that module is cheaper and less error-prone than adding an
  `approval_authority` filter that a future caller may forget to rely on.
- P4.14's routing scenarios ("Route a pending approval to the role holder", "Error - the approval role
  has no member in DNA") then belong to whichever task wires `memory approve` — currently
  `task-046-memory-approve` (`depends_on: ["task-040-…", "task-041-…"]`) — built on the authority
  module, with P4.14's `by_person` override handled there too.
- **Timing matters.** `task-034` is being returned to `red`. If this DL is not ratified first, its fix
  will be written against option (a) and rewritten if (b) is later chosen. This decision is a hard
  input to that task's `design` phase.

## Actions

- Owner **approver**: ratify (a) or (b) — **before** `task-034` re-enters `red`.
- If (b): remove `resolveApprover`/`NoRoleHolderError` from `task-034`'s scope; keep
  `isRoleDefined`/`assertRoleDefined`/`resolveRoleHolders` for P5.4.2 directive binding; reassign
  P4.14's routing scenarios to `task-046-memory-approve`.
- If (a): add the `approval_authority === true` filter and a red-first test for "an agent holds the
  approver role but no member does → error"; refactor `task-040` onto the shared resolver.
- Either way: `task-034`'s TSDoc currently claims P4.14's "no member in DNA" scenario is implemented;
  correct that when the task returns through `red`.
