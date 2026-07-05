/**
 * `wingfoil://memory/{id}` Resource — task-009-mcp-resource-fetch-latency, REQ-PERF-04. A thin,
 * read-only adapter over `src/memory/query.ts`'s `findMemoryDocumentById` (wrapping task-008's
 * bounded scan primitives), registered directly here rather than through `registerCoreModules`'s
 * `CoreModule[]` registry (`src/core/registry.ts`): no `memoryShow`/`memoryGet` `CoreOperation`
 * exists in `src/core`'s production `CORE_MODULES` yet (see `src/core/index.ts`'s SCOPE note —
 * task-008 deliberately left its query primitives unregistered, and registering one here would
 * complete task-021/task-030's own acceptance criteria ahead of them). This module's only job is to
 * prove REQ-PERF-04's fit criterion against the real primitive the future feature task will wrap —
 * it is deliberately NOT the full spec-004-mcp-surface-contract §2.1 Resources surface: no
 * `wingfoil://memory/{type}` collection listing, no `wingfoil://dna/{section}` sub-resource
 * addressing, no `metadata` envelope field, and no `wingfoil://memory/{type}/{id}` two-segment
 * addressing (all deferred to task-030-implement-mcp-resources, which owns spec-004 §2.1's rich
 * sub-resource addressing — see task-009's Execution Notes for the full boundary reasoning). The
 * zero-argument `wingfoil://memory/{id}` form used here matches task-009's own Acceptance Criteria
 * wording verbatim.
 *
 * Structurally read-only (REQ-SEC-05): registered only via `McpServer.registerResource`, never as a
 * Tool — there is no write path here, mirroring `registerCoreModules`'s Resource half.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

import { loadMemoryYaml } from '../core';
import { findMemoryDocumentById } from '../memory/query';

export interface RegisterMemoryDocumentResourceOptions {
  readonly resolveRoot: () => string;
}

/** `wingfoil://memory/{id}` — the URI form task-009's Acceptance Criteria names. */
export const MEMORY_DOCUMENT_RESOURCE_URI_TEMPLATE = 'wingfoil://memory/{id}';

/**
 * Register the `wingfoil://memory/{id}` Resource on `server`. Reads `.wingfoil/memory.yaml` fresh on
 * every request (no server-lifetime cache) — the same "no cold-start cost, but no stale-config
 * either" contract `registerCoreModules`'s existing Resources already have (REQ-PERF-04's "no
 * restart" requirement is about the *process*, not about caching config across requests).
 */
export function registerMemoryDocumentResource(
  server: McpServer,
  options: RegisterMemoryDocumentResourceOptions,
): void {
  const template = new ResourceTemplate(MEMORY_DOCUMENT_RESOURCE_URI_TEMPLATE, { list: undefined });
  server.registerResource(
    'memory.show',
    template,
    { description: 'memory document fetch by id (read-only)' },
    async (uri, variables) => {
      const root = options.resolveRoot();
      const memoryYaml = loadMemoryYaml(root);
      // `variables.id` is typed `string | string[]` (the SDK's generic `Variables` shape), but this
      // template's `{id}` variable has no `*`/`+` explode modifier, so a match always binds it to a
      // single string (see the SDK's `UriTemplate.match`) — the `string[]` case is unreachable here.
      const id = variables.id as string;
      const doc = findMemoryDocumentById(root, memoryYaml, id);
      if (!doc) throw new Error(`memory document not found: ${id}`);
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify(doc),
          },
        ],
      };
    },
  );
}
