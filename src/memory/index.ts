/**
 * `memory` module — Project Memory pillar; git-backed documents with per-type state machines
 * (P1.13). `memory.yaml`'s schema (spec-001-memory-yaml-schema) lives here — the pillar owns its own
 * independent schema (REQ-SYS-02); `src/core`'s loader wires it through the shared validation
 * pipeline. The transition-legality engine (REQ-SYS-04, task-005-per-type-state-machines) also lives
 * here — it consumes the schema's already-validated `StateMachine` shape, it does not re-validate it.
 * Further Memory behavior (per-type CLI verbs, frontmatter schema) lands in later tasks.
 *
 * task-008-dna-memory-query-latency adds the `memory search`/`memory history` query-path
 * *primitives* (REQ-PERF-02) `./query` and `./history` — the performance-bearing foundation
 * task-021/a-later-P1.10-task build their CLI/MCP surface on top of; see those modules' own doc
 * comments and the task's Execution Notes for the foundation/feature scoping decision.
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
export {
  computeMemoryContentRoots,
  listMemoryDocumentPaths,
  loadMemoryDocumentSummary,
  searchMemoryDocuments,
} from './query';
export type { MemoryDocumentSummary, MemorySearchMatch, MemorySearchOptions } from './query';
export { getMemoryHistory } from './history';
export type { MemoryHistoryEntry } from './history';
