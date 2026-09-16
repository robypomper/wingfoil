/**
 * `dna` module — Project DNA pillar; structured project map (P2.4). `dna.yaml`'s schema
 * (spec-002-dna-yaml-schema) lives here — the pillar owns its own independent schema (REQ-SYS-02);
 * `src/core`'s loader wires it through the shared validation pipeline. `./roles` adds the
 * role-based binding resolver (REQ-SYS-08, task-034-role-based-binding): `team.roles` is the sole
 * role catalogue, `resolveRoleHolders` reads `team.members`/`team.agents` alone to answer "who holds
 * this role today" — the foundation the Directives pillar (P3) builds on. Approval routing is *not*
 * here (`dl-033-canonical-role-resolver`, option b): "may this principal approve?" is answered by
 * `src/core/approval-authority.ts`. Further DNA behavior (`wingfoil dna show/set`, `wingfoil paths`)
 * lands in later tasks.
 */
export const MODULE_NAME = 'dna' as const;

export {
  DnaYaml,
  Project,
  Module,
  TechEntry,
  MethodologyEntry,
  Stacks,
  TeamMember,
  AgentEntry,
  RoleEntry,
  Team,
  Paths,
} from './schema';

export { isValidKeyPath, setDnaValue, setDnaValueInText, DNA_KEY_ALIASES } from './set';

export {
  isRoleDefined,
  assertRoleDefined,
  resolveRoleHolders,
  UnknownRoleError,
} from './roles';
export type { RoleHolders } from './roles';
