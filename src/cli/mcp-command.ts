/**
 * `wingfoil mcp` command handler (task-030-implement-mcp-resources, P5.2.1,
 * spec-014-mcp-server-entry-point §1). `mcp` is a SPECIAL command: it does not wrap a single `src/core`
 * `CoreOperation` (so it is not a `CORE_MODULES` noun-verb op) — it owns a long-running process
 * lifecycle, starting the production MCP server over stdio. It is wired directly onto the program
 * (see ./program.ts), exactly like `wingfoil init` (task-029).
 *
 * `runMcp` owns the spec-014 §1 pre-flight: resolve the project root, and on failure emit the standard
 * `error: <reason>` line and exit `1` (a user/logic error — not inside a WingFoil project) WITHOUT
 * starting a partially-wired server. The side-effecting server start (`startMcpServer`, which opens a
 * real `StdioServerTransport`) is injected as `deps.start`, so this whole pre-flight is unit-testable
 * without ever opening a real stdio channel against a repo — the same seam `init-command.ts`'s
 * injectable `runInit` uses.
 */
import { startMcpServer } from '../mcp/server';

import { emitError } from './error';
import { exitWith } from './exit';
import { isValidFormat, type OutputFormat } from './output';

/** The options `runMcp` acts on (injected so the resolve-root/error path needs no real stdio server). */
export interface McpCliDeps {
  /** Resolve the project (git) root; throws when the cwd is not inside an initialized WingFoil project. */
  readonly resolveRoot: () => string;
  /** The CLI version to advertise as the MCP server's identity `version` (read from `package.json`). */
  readonly version: string;
  /** The output format for the pre-flight error path; defaults to `console`. */
  readonly format?: OutputFormat;
  /** Start the server; defaults to {@link startMcpServer} (overridden in tests to avoid real stdio). */
  readonly start?: (options: { resolveRoot: () => string; name: string; version: string }) => Promise<unknown>;
}

/**
 * Execute `wingfoil mcp`. Resolves the project root once, up front (fail-fast: an unresolvable root
 * emits `error: <reason>` on stderr and exits `1`, never starting the server), then hands the server
 * start a closure returning that already-resolved root. On success it does not exit — the server runs
 * over stdio until the transport closes.
 */
export async function runMcp(deps: McpCliDeps): Promise<void> {
  const format: OutputFormat = deps.format && isValidFormat(deps.format) ? deps.format : 'console';

  let root: string;
  try {
    root = deps.resolveRoot();
  } catch (error) {
    emitError(error instanceof Error ? error.message : String(error), { format });
    exitWith(1);
    return;
  }

  const start = deps.start ?? startMcpServer;
  await start({ resolveRoot: () => root, name: 'wingfoil', version: deps.version });
}
