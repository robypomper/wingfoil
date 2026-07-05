/**
 * `memory` module — Project Memory pillar; git-backed documents with per-type state machines
 * (P1.13). `memory.yaml`'s schema (spec-001-memory-yaml-schema) lives here — the pillar owns its own
 * independent schema (REQ-SYS-02); `src/core`'s loader wires it through the shared validation
 * pipeline. The transition-legality engine (REQ-SYS-04, task-005-per-type-state-machines) also lives
 * here — it consumes the schema's already-validated `StateMachine` shape, it does not re-validate it.
 * Further Memory behavior (per-type CLI verbs, frontmatter schema) lands in later tasks.
 */
export const MODULE_NAME = 'memory' as const;

export { MemoryYaml, MemoryTypeEntry, StateMachine, TemplateConfig } from './schema';
export {
  DEPRECATED_STATE,
  E_INVALID_TRANSITION,
  resolveStateMachine,
  resolveTransitionTarget,
} from './state-machine';
export type { TransitionOp } from './state-machine';
