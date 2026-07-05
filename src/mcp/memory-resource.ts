/**
 * `wingfoil://memory/{id}` Resource — task-009-mcp-resource-fetch-latency, REQ-PERF-04. A thin,
 * read-only adapter over `src/memory/query.ts`'s `findMemoryDocumentById` (wrapping task-008's
 * bounded scan primitives), registered directly here rather than through `registerCoreModules`'s
 * `CoreModule[]` registry (`src/core/registry.ts`): no `memoryShow`/`memoryGet` `CoreOperation`
 * exists in `src/core`'s production `CORE_MODULES` yet (see `src/core/index.ts`'s SCOPE note —
 * task-008 deliberately left its query primitives unregistered, and registering one here would
 * complete task-021/task-030's own acceptance criteria ahead of them). Hand-wiring
 * `McpServer.registerResource` directly here, instead of adding a real `CoreOperation` and letting
 * `registerCoreModules` register it, is a deliberate spec-006-core-domain-api §4 (Parity rule)
 * deviation — acceptable only because this surface is test/benchmark-only today (no CLI or Tool
 * counterpart exists or is claimed for it), to be reconciled by task-030-implement-mcp-resources.
 *
 * This module's only job is to prove REQ-PERF-04's fit criterion against the real primitive the
 * future feature task will wrap. The URI it benchmarks is NOT a spec-004-mcp-surface-contract §2.1
 * form: spec-004's actual scheme is `wingfoil://memory/{type}` (collection listing) and
 * `wingfoil://memory/{type}/{id}` (single document) — there is no bare, single-segment
 * `wingfoil://memory/{id}` address in spec-004 at all, and this `{id}` segment would semantically
 * collide with spec-004's `{type}` segment (e.g. `wingfoil://memory/task` binds `id="task"` here,
 * but `type="task"` there). This URI comes from REQ-PERF-04 / task-009's own Acceptance Criteria
 * wording verbatim, not from spec-004 — see task-009's Execution Notes for the full boundary
 * reasoning. The JSON body with no `metadata` envelope returned below also diverges from spec-004
 * §2.2 (which wants `text/markdown` content plus an `id/type/status/title` metadata block). Both
 * divergences mean task-030-implement-mcp-resources must REPLACE this adapter with a real
 * `wingfoil://memory/{type}/{id}` Resource, not extend it — the URI collision rules out carrying
 * this single-segment form forward.
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
