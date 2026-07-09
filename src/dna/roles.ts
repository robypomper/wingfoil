/**
 * Role-based binding resolver (REQ-SYS-08, task-034-role-based-binding) — the DNA-only primitives
 * directive binding (P3.2/P3.7), auto-load (P3.6), and approval routing (P1.7/P4.14) build on.
 * Directives and approval authority reference roles, never named persons (ADR-006): every function
 * here reads only the already-parsed `DnaYaml` (`team.roles`/`team.members`/`team.agents`,
 * spec-002-dna-yaml-schema) — never a directive or workflow file — so reassigning a person's role in
 * `dna.yaml` changes the resolved binding with zero edits anywhere else (the REQ-SYS-08 Fit
 * Criterion). No `CORE_MODULES` operation is registered here: this is the pure resolver later tasks
 * (task-040 REQ-SEC-03 approval-authority enforcement, task-046 `memory approve` routing, task-051/056
 * `directive assign`/role-based assignment) wire into their own CLI/MCP surfaces.
 */
import type { AgentEntry, DnaYaml, TeamMember } from './schema';

/**
 * Raised when a role name is referenced (e.g. a directive binding or an approval step) but is not
 * registered in `dna.yaml`'s `team.roles` catalogue. Message matches BDD
 * `p5-interaction/P5.4.2-role-directives-binding.feature` "Error - binding references an undefined
 * role" verbatim.
 */
export class UnknownRoleError extends Error {
  /** The role name that was not found in `team.roles`. */
  readonly role: string;

  constructor(role: string) {
    super(`unknown role '${role}' (not defined in dna.yaml)`);
    this.name = 'UnknownRoleError';
    this.role = role;
    // Restore the prototype chain so `instanceof UnknownRoleError` holds after transpilation.
    Object.setPrototypeOf(this, UnknownRoleError.prototype);
  }
}

/**
 * Raised by {@link resolveApprover} when a role is defined in `dna.yaml` but no team member or agent
 * currently holds it. Message matches BDD `p4-workflow/P4.14-approval-routing.feature` "Error - the
 * approval role has no member in DNA" verbatim.
 */
export class NoRoleHolderError extends Error {
  /** The role name nobody currently holds. */
  readonly role: string;

  constructor(role: string) {
    super(`no approver found for role '${role}' in dna.yaml`);
    this.name = 'NoRoleHolderError';
    this.role = role;
    // Restore the prototype chain so `instanceof NoRoleHolderError` holds after transpilation.
    Object.setPrototypeOf(this, NoRoleHolderError.prototype);
  }
}

/** Whether `role` is registered in `dna.team.roles` — the sole role catalogue (REQ-SYS-08). */
export function isRoleDefined(dna: DnaYaml, role: string): boolean {
  return dna.team.roles.some((entry) => entry.name === role);
}

/** Throws {@link UnknownRoleError} unless `role` is registered in `dna.team.roles`. */
export function assertRoleDefined(dna: DnaYaml, role: string): void {
  if (!isRoleDefined(dna, role)) throw new UnknownRoleError(role);
}

/** The team members and agents currently holding a role, as resolved by {@link resolveRoleHolders}. */
export interface RoleHolders {
  /** `team.members` entries whose `roles` include the resolved role. */
  readonly members: readonly TeamMember[];
  /** `team.agents` entries whose `executes_as` include the resolved role. */
  readonly agents: readonly AgentEntry[];
}

/**
 * Resolves who currently holds `role`, reading only `dna.team.members`/`dna.team.agents` — no
 * directive or workflow file. Throws {@link UnknownRoleError} if `role` is not in `team.roles`;
 * returns empty lists (not an error) when the role is defined but nobody currently holds it.
 */
export function resolveRoleHolders(dna: DnaYaml, role: string): RoleHolders {
  assertRoleDefined(dna, role);
  const members = dna.team.members.filter((member) => member.roles.includes(role));
  const agents = (dna.team.agents ?? []).filter((agent) => agent.executes_as.includes(role));
  return { members, agents };
}

/**
 * Routes an approval to whoever holds `role` today (BDD P4.14 "Route a pending approval to the role
 * holder"), preferring a human member over an agent when both hold the role. Throws
 * {@link UnknownRoleError} for an undefined role, or {@link NoRoleHolderError} when the role is
 * defined but currently held by nobody (P4.14 "Error - the approval role has no member in DNA").
 * Routing by explicit person (`approval: { by_person: ... }`, P4.14 scenario 2) bypasses role
 * resolution entirely and is out of this function's scope — it belongs to the caller that reads the
 * workflow step declaration.
 */
export function resolveApprover(dna: DnaYaml, role: string): TeamMember | AgentEntry {
  const { members, agents } = resolveRoleHolders(dna, role);
  const holder = members[0] ?? agents[0];
  if (!holder) throw new NoRoleHolderError(role);
  return holder;
}
