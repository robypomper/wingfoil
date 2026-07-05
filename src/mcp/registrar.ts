/**
 * The MCP adapter's Tool/Resource registrar (spec-006-core-domain-api §2/§4,
 * spec-004-mcp-surface-contract — task-006). `registerCoreModules` is the "Tool/Resource
 * registrar" spec-006 §4.1 refers to: it iterates the exact same `enumerateOperations` order as
 * `src/cli`'s registrar, and for each operation registers it as **either** an MCP Tool (`mutates:
 * true`) **or** an MCP Resource (`mutates: false`) — never both, and never a hardcoded allow/deny
 * list of operation names (§4.2). This is the structural half of REQ-SEC-05 ("MCP Resources are
 * read-only — mutations only via validated MCP Tools"): a `mutates: true` operation is
 * *structurally incapable* of being registered as a Resource by this function, and vice versa.
 *
 * Naming: Tool names use the dot form `{module}.{verb}` and Resource URIs use the `wingfoil://`
 * scheme, both per spec-004 (§4.1, §2.1) — spec-004 is the spec explicitly scoped to `src/mcp`
 * (`scope: "src/mcp"`), so it is authoritative for the actual wire-visible names here, ahead of
 * spec-006 §5's own (looser, `src/core`-scoped) naming note, which uses a snake_case Tool-name
 * form (`memory_approve`) that this task deliberately does not follow — see task-006's Execution
 * Notes for the full reasoning on that spec-004/spec-006 naming discrepancy.
 *
 * Resource URIs today are the mechanical, zero-argument `wingfoil://{module}/{verb}` form — spec-004
 * §2.1's fuller scheme (`wingfoil://memory/{type}/{id}`, `wingfoil://dna/{section}`, ...) adds
 * sub-resource addressing that today's `CoreOperation` shape (spec-006 §2: just `{name, mutates,
 * fn}`, no parameter metadata) cannot mechanically derive; that richer addressing is deferred to
 * whichever feature task (018-030) first registers an operation that needs it.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { CoreModule, ParamsBuilder } from '../core/registry';
import { deriveVerb, enumerateOperations } from '../core/registry';

export interface RegisterCoreModulesOptions {
  readonly resolveRoot: () => string;
  readonly buildParams: ParamsBuilder;
}

/** `{module}.{verb}` — spec-004 §4.1's Tool naming convention (mechanical transform of the CLI verb). */
export function deriveMcpToolName(moduleName: string, verb: string): string {
  return `${moduleName}.${verb}`;
}

/** `wingfoil://{module}/{verb}` — spec-004 §2.1's URI scheme, applied mechanically (see module doc). */
export function deriveMcpResourceUri(moduleName: string, verb: string): string {
  return `wingfoil://${moduleName}/${verb}`;
}

/**
 * Register every operation in `modules` onto `server`: `mutates: true` as a Tool, `mutates: false`
 * as a Resource. Each handler wraps exactly one core call (spec-006 §2) and serializes its
 * `CoreResult` — a successful value as JSON text; a `CoreResult.error` as a Tool `isError: true`
 * response (spec-004 §4.3's "rejected identically to the CLI path") or, for a Resource read (which
 * has no `isError` flag in the MCP protocol), a thrown error surfaced as a protocol-level read
 * failure (spec-004 §2.2's "resource not found"-style refusal, generalized to any read failure).
 */
export function registerCoreModules(
  server: McpServer,
  modules: readonly CoreModule[],
  options: RegisterCoreModulesOptions,
): void {
  // Always advertise both channels (spec-004 §1: Resources and Tools are fixed channel types of
  // the MCP surface), even when `modules` currently has zero operations of one kind — as is the
  // case for the real production registry today (0 mutating ops; see task-006 Execution Notes).
  // Without this, a client's `tools/list` call on a server with zero registered Tools fails at the
  // protocol level ("Method not found") because the SDK only auto-declares a capability the first
  // time something is registered under it.
  server.server.registerCapabilities({ tools: {}, resources: {} });

  for (const { module, operation } of enumerateOperations(modules)) {
    const verb = deriveVerb(module.name, operation.name);

    const callCore = async (): Promise<{ ok: true; text: string } | { ok: false; message: string }> => {
      const params = options.buildParams({
        moduleName: module.name,
        operationName: operation.name,
        root: options.resolveRoot(),
      });
      const result = await operation.fn(params);
      return result.ok ? { ok: true, text: JSON.stringify(result.value) } : { ok: false, message: result.error.message };
    };

    if (operation.mutates) {
      const toolName = deriveMcpToolName(module.name, verb);
      server.registerTool(toolName, { description: `${module.name} ${verb} (mutating)` }, async () => {
        const outcome = await callCore();
        return outcome.ok
          ? { content: [{ type: 'text', text: outcome.text }] }
          : { content: [{ type: 'text', text: outcome.message }], isError: true };
      });
    } else {
      const uri = deriveMcpResourceUri(module.name, verb);
      const resourceName = deriveMcpToolName(module.name, verb);
      server.registerResource(
        resourceName,
        uri,
        { description: `${module.name} ${verb} (read-only)` },
        async (readUri) => {
          const outcome = await callCore();
          if (outcome.ok) {
            return { contents: [{ uri: readUri.toString(), mimeType: 'application/json', text: outcome.text }] };
          }
          throw new Error(outcome.message);
        },
      );
    }
  }
}
