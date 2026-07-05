/**
 * `mcp-server` module — agent interface (MCP over stdio, Anthropic SDK); Resources, Prompts, Tools.
 * Path is `src/mcp` per `dna.yaml`'s module entry (`name: mcp-server`, `path: src/mcp`).
 *
 * task-006-dual-interface-shared-core adds the thin adapter (spec-006 §2, spec-004): `registerCoreModules`
 * derives every MCP Tool (mutating) and Resource (read-only) from the same `CoreModule[]` registry
 * `src/cli` builds its commands from (`src/core/index.ts`'s `CORE_MODULES`), with no business logic
 * of its own. A runnable stdio server entry point (constructing the real `McpServer`, calling
 * `registerCoreModules`, and connecting a `StdioServerTransport`) is left to a later task — this
 * task's scope is the registrar mechanism and its test coverage (see task-006 Execution Notes).
 *
 * task-009-mcp-resource-fetch-latency adds one more Resource alongside `registerCoreModules`'s
 * `CoreModule`-derived set: `registerMemoryDocumentResource` (`./memory-resource.ts`), the thin
 * `wingfoil://memory/{id}` adapter REQ-PERF-04's benchmark measures — see that module's doc-comment
 * for why it is registered directly rather than through the `CoreModule[]` registry.
 */
export const MODULE_NAME = 'mcp-server' as const;

export { registerCoreModules, deriveMcpToolName, deriveMcpResourceUri } from './registrar';
export type { RegisterCoreModulesOptions } from './registrar';
export { registerMemoryDocumentResource, MEMORY_DOCUMENT_RESOURCE_URI_TEMPLATE } from './memory-resource';
export type { RegisterMemoryDocumentResourceOptions } from './memory-resource';
