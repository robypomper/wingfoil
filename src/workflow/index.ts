/**
 * `workflow` module — Project Workflow pillar; phases/steps/atomic actions, `include()` composition
 * (P4.1). `workflows.yaml`'s Layer-1 manifest + Layer-2 Workflow DSL schemas
 * (spec-003-workflows-yaml-schema) live here — the pillar owns its own independent schema
 * (REQ-SYS-02); `src/core`'s loader wires it through the shared validation pipeline. Further
 * Workflow behavior (engine execution, `wingfoil workflow *`) lands in later tasks.
 */
export const MODULE_NAME = 'workflow' as const;

export { WorkflowsYaml, Workflow, Phase } from './schema';
