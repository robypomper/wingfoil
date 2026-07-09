/**
 * `mcp-server` module — agent interface (MCP over stdio, Anthropic SDK); Resources, Prompts, Tools.
 * Path is `src/mcp` per `dna.yaml`'s module entry (`name: mcp-server`, `path: src/mcp`).
 *
 * task-006-dual-interface-shared-core adds the thin adapter (spec-006 §2, spec-004): `registerCoreModules`
 * derives every MCP Tool (mutating) and Resource (read-only) from the same `CoreModule[]` registry
 * `src/cli` builds its commands from (`src/core/index.ts`'s `CORE_MODULES`), with no business logic
 * of its own.
 *
 * task-011-mcp-resources-read-only adds the spec-004-mcp-surface-contract §2-conformant Resources
 * channel (REQ-INT-01 / REQ-SEC-05): `registerMemoryResources` (`wingfoil://memory/{type}`,
 * `wingfoil://memory/{type}/{id}` — REPLACING task-009-mcp-resource-fetch-latency's placeholder
 * `wingfoil://memory/{id}` adapter), `registerDnaResources` (`wingfoil://dna`, `wingfoil://dna/{section}`),
 * `registerWorkflowResources` (`wingfoil://workflows`, `wingfoil://workflows/{name}`), and
 * `registerWriteRefusalHandler` (the structural `resources/write` refusal, spec-004 §2.3).
 * `registerReadOnlyResources` wires all four together — the one call a future production entry point
 * (`task-030-implement-mcp-resources`'s `StdioServerTransport`/`wingfoil mcp` command, out of this
 * task's scope) needs alongside `registerCoreModules`. See `./read-only.ts` for the shared
 * write-refusal/not-found conventions every one of these Resources follows.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/** This module's `dna.yaml` name (`mcp-server`) — the stable identifier surfaces and tests key it by. */
export const MODULE_NAME = 'mcp-server' as const;

export { registerCoreModules, deriveMcpToolName, deriveMcpResourceUri } from './registrar';
export type { RegisterCoreModulesOptions } from './registrar';

export {
  registerMemoryResources,
  MEMORY_COLLECTION_URI_TEMPLATE,
  MEMORY_DOCUMENT_URI_TEMPLATE,
} from './memory-resource';
export type { RegisterMemoryResourcesOptions } from './memory-resource';

export { registerDnaResources, DNA_WHOLE_URI, DNA_SECTION_URI_TEMPLATE } from './dna-resource';
export type { RegisterDnaResourcesOptions } from './dna-resource';

export {
  registerWorkflowResources,
  WORKFLOWS_COLLECTION_URI,
  WORKFLOW_DOCUMENT_URI_TEMPLATE,
} from './workflow-resource';
export type { RegisterWorkflowResourcesOptions } from './workflow-resource';

export {
  registerWriteRefusalHandler,
  refuseIfWriteIntent,
  resourceNotFoundError,
  WRITE_REFUSAL_MESSAGE,
  WRITE_INTENT_META_KEY,
} from './read-only';

import { registerDnaResources } from './dna-resource';
import { registerMemoryResources } from './memory-resource';
import { registerWriteRefusalHandler } from './read-only';
import { registerWorkflowResources } from './workflow-resource';

/** Options for {@link registerReadOnlyResources}. */
export interface RegisterReadOnlyResourcesOptions {
  /** Resolves the project root each Resource read is served from (an ambient concern, not a request parameter). */
  readonly resolveRoot: () => string;
}

/**
 * Wire the full spec-004 §2 read-only Resources channel onto `server` in one call: the Memory, DNA,
 * and Workflow Resources plus the structural `resources/write` refusal. Deliberately does not touch
 * `registerCoreModules`/`CORE_MODULES` — a caller building a real server still calls that separately
 * for the (today, zero) Tools/legacy-shaped Resources it derives from `src/core`.
 */
export function registerReadOnlyResources(server: McpServer, options: RegisterReadOnlyResourcesOptions): void {
  registerWriteRefusalHandler(server);
  registerMemoryResources(server, options);
  registerDnaResources(server, options);
  registerWorkflowResources(server, options);
}

// The production stdio entry point (task-030-implement-mcp-resources, spec-014-mcp-server-entry-point):
// `createMcpServer` builds a real `McpServer` with the v0.1 read-only Resources channel above wired on,
// `startMcpServer` connects it over `StdioServerTransport`. Exported here so the `bin`/`wingfoil mcp`
// seam imports the whole `src/mcp` surface from one module.
export { createMcpServer, startMcpServer } from './server';
export type { McpServerOptions } from './server';
