/**
 * Shared "channel enumeration" fixture (REQ-INT-01 / REQ-SEC-05) — task-011-mcp-resources-read-only
 * establishes this; task-016-read-only-agent-channel reuses it rather than re-deriving the same
 * assertion. Not a `.test.ts` file, so Jest's `testMatch` never picks it up as a suite on its own
 * (mirrors `test/storage/helpers/git-fixture.ts`'s own convention).
 *
 * Connects a real MCP `Client`/`McpServer` pair, over the SDK's in-memory transport, wired with
 * every Resource `src/mcp/index.ts`'s `registerReadOnlyResources` registers; attempts every
 * write-shaped request the Resources channel can receive; and provides a before/after file-snapshot
 * comparison so a caller can assert the underlying Memory/DNA/Workflow files are byte-for-byte
 * unchanged after every refused attempt (spec-004 §2.3's "the refusal persists nothing").
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { registerReadOnlyResources } from '../../../src/mcp';
import { WRITE_INTENT_META_KEY } from '../../../src/mcp/read-only';

export interface ChannelEnumerationClient {
  readonly client: Client;
  readonly server: McpServer;
}

/** Connect a Client/Server pair with the full read-only Resources channel wired on, over the fixture at `root`. */
export async function connectReadOnlyClient(root: string): Promise<ChannelEnumerationClient> {
  const server = new McpServer({ name: 'wingfoil-test', version: '0.0.0' });
  registerReadOnlyResources(server, { resolveRoot: () => root });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'wingfoil-test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

/** Snapshot a set of root-relative files' raw byte content, for a later unchanged-after comparison. */
export function snapshotFiles(root: string, relativePaths: readonly string[]): ReadonlyMap<string, Buffer> {
  const snapshot = new Map<string, Buffer>();
  for (const relativePath of relativePaths) {
    snapshot.set(relativePath, readFileSync(join(root, relativePath)));
  }
  return snapshot;
}

/** Assert every file captured in `snapshot` is still byte-for-byte identical to its snapshotted content. */
export function assertFilesUnchanged(root: string, snapshot: ReadonlyMap<string, Buffer>): void {
  for (const [relativePath, before] of snapshot) {
    const after = readFileSync(join(root, relativePath));
    if (!after.equals(before)) {
      throw new Error(`channel-enumeration: file changed after a refused write attempt: ${relativePath}`);
    }
  }
}

/**
 * Attempt every write-shaped request the read-only Resources channel can receive against `client`,
 * targeting a resolvable `resourceUri` (e.g. `wingfoil://memory/task/task-001-foo`): one raw,
 * unsupported `resources/write` call, and one `resources/read` call carrying a write-intent `_meta`
 * marker (see `src/mcp/read-only.ts`'s module doc for why `_meta` is the one channel a real
 * `resources/read` request can smuggle extra data through). Returns each attempt's caught error
 * message, in that order — both MUST equal spec-004 §2.3's exact refusal string
 * (`resources are read-only`); neither should ever resolve successfully.
 *
 * The request objects below deliberately do not conform to the SDK's own typed `Request` union (no
 * client method exists for either shape — MCP defines no `resources/write` at all, and no typed
 * client helper accepts extra `_meta` write-intent data) — hence the `as never` casts, which only
 * suppress the compile-time check; both requests are dispatched exactly as any other JSON-RPC
 * request at runtime.
 */
export async function attemptEveryResourceWrite(client: Client, resourceUri: string): Promise<string[]> {
  const messages: string[] = [];

  try {
    await client.request(
      { method: 'resources/write', params: { uri: resourceUri, text: 'malicious overwrite attempt' } } as never,
      z.unknown(),
    );
    messages.push('(no error thrown — resources/write unexpectedly succeeded)');
  } catch (error) {
    messages.push(error instanceof Error ? error.message : String(error));
  }

  try {
    await client.request(
      {
        method: 'resources/read',
        params: { uri: resourceUri, _meta: { [WRITE_INTENT_META_KEY]: { text: 'malicious overwrite attempt' } } },
      } as never,
      z.unknown(),
    );
    messages.push('(no error thrown — resources/read-with-write-intent unexpectedly succeeded)');
  } catch (error) {
    messages.push(error instanceof Error ? error.message : String(error));
  }

  return messages;
}
