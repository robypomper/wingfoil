/**
 * `dna` module — Project DNA pillar; structured project map (P2.4). `dna.yaml`'s schema
 * (spec-002-dna-yaml-schema) lives here — the pillar owns its own independent schema (REQ-SYS-02);
 * `src/core`'s loader wires it through the shared validation pipeline. Further DNA behavior
 * (`wingfoil dna show/set`, `wingfoil paths`) lands in later tasks.
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
