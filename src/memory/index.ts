/**
 * `memory` module — Project Memory pillar; git-backed documents with per-type state machines
 * (P1.13). `memory.yaml`'s schema (spec-001-memory-yaml-schema) lives here — the pillar owns its own
 * independent schema (REQ-SYS-02); `src/core`'s loader wires it through the shared validation
 * pipeline. Further Memory behavior (per-type CLI verbs, frontmatter schema) lands in later tasks.
 */
export const MODULE_NAME = 'memory' as const;

export { MemoryYaml, MemoryTypeEntry, StateMachine, TemplateConfig } from './schema';
