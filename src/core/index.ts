/**
 * `core` module — shared domain logic; single behavior behind both the CLI and MCP surfaces
 * (REQ-SYS-05). Exposes one loader per Project pillar (task-004-decoupled-pillars, REQ-SYS-02):
 * `loadMemoryYaml`, `loadDnaYaml`, `loadWorkflowsYaml`, `loadDirectives` — each independently reads
 * and validates only its own pillar's artifact(s), so editing one pillar's config never requires
 * touching another's loader. Further core domain behavior lands in later v0.1 tasks.
 */
export const MODULE_NAME = 'core' as const;

export {
  loadDirectives,
  loadDnaYaml,
  loadMemoryYaml,
  loadWorkflowsYaml,
} from './loaders';
export type { DirectiveFile, WorkflowsLoadResult } from './loaders';
