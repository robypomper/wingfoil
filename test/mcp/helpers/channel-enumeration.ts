/**
 * Shared "channel enumeration" fixture (REQ-INT-01 / REQ-SEC-05) — task-011-mcp-resources-read-only
 * establishes this; task-016-read-only-agent-channel reuses it rather than re-deriving the same
 * assertion. Not a `.test.ts` file, so Jest's `testMatch` never picks it up as a suite on its own
 * (mirrors `test/storage/helpers/git-fixture.ts`'s own convention).
 *
 * Connects a real MCP `Client`/`McpServer` pair, over the SDK's in-memory transport, wired with
 * every Resource `src/mcp/index.ts`'s `registerReadOnlyResources` registers; attempts every
 * write-shaped request the Resources channel can receive; and provides a before/after snapshot
 * comparison so a caller can assert nothing persisted after every refused attempt (spec-004 §2.3's
 * "the refusal persists nothing") over a committed git fixture: the listed files' bytes, the
 * working-tree status (untracked and ignored files included), `HEAD`, its symbolic target, and every
 * ref. See {@link PersistenceSnapshot} for exactly what is and is not compared (task-147).
 */
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { CoreModule } from '../../../src/core';
import { registerCoreModules, registerReadOnlyResources } from '../../../src/mcp';
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

/**
 * Connect a Client/Server pair with the operation-derived Tool/Resource surface wired on via
 * `registerCoreModules(modules)` — a `mutates: true` op becomes a Tool, a `mutates: false` op a
 * Resource (the structural half of REQ-SEC-05). task-011 established this fixture "to extend to Tools
 * without rework"; this is that extension (task-016-read-only-agent-channel), letting a test enumerate
 * the agent-facing channels over the SDK.
 */
export async function connectCoreModuleSurface(
  modules: readonly CoreModule[],
  options: { resolveRoot: () => string },
): Promise<ChannelEnumerationClient> {
  const server = new McpServer({ name: 'wingfoil-test', version: '0.0.0' });
  registerCoreModules(server, modules, {
    resolveRoot: options.resolveRoot,
    buildParams: (ctx) => ({ root: ctx.root }),
  });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'wingfoil-test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

/**
 * What a no-persistence check compares before and after a read-only round trip (REQ-SEC-05,
 * spec-004 §2.3 / §3.3 "persists nothing"), over a fixture that is a committed git working tree:
 *
 * - `files` — the raw bytes of each caller-listed, root-relative file;
 * - `status` — `git status --porcelain --untracked-files=all --ignored`, which {@link snapshotFiles}
 *   requires to be EMPTY: any file created, deleted or modified anywhere in the working tree
 *   afterwards — ignored paths included, whichever ignore rule (the fixture's own or a machine's
 *   global `core.excludesFile`) matches them — makes it non-empty;
 * - `head` — `git rev-parse HEAD` (a commit on the current branch, even an empty one);
 * - `symbolicHead` — `git rev-parse --symbolic-full-name HEAD` (a checkout of another branch, or a
 *   detach, even at the same commit);
 * - `refs` — `git for-each-ref --format='%(refname) %(objectname)'` (a branch, tag, note or stash
 *   created, moved or deleted, including a commit written to another branch without touching `HEAD`).
 *
 * Out of scope — NOT compared: `.git/config`, hooks, the reflog, and loose or packed objects that no
 * ref points to. A handler that writes only those passes this check.
 *
 * `files` alone was the whole check until task-147 (bug-036): a handler that created a file or made a
 * commit passed it.
 */
export interface PersistenceSnapshot {
  readonly files: ReadonlyMap<string, Buffer>;
  readonly status: string;
  readonly head: string;
  readonly symbolicHead: string;
  readonly refs: string;
}

/**
 * Run a read-only `git` query in `root`. `--no-optional-locks` keeps `git status` from refreshing and
 * rewriting `.git/index`, so taking the snapshot is not itself a write.
 */
function gitQuery(root: string, args: readonly string[]): string {
  return execFileSync('git', ['--no-optional-locks', ...args], { cwd: root, encoding: 'utf-8' });
}

/** The repository-level state of {@link PersistenceSnapshot}, everything but `files`. */
function gitState(root: string): Omit<PersistenceSnapshot, 'files'> {
  return {
    status: gitQuery(root, ['status', '--porcelain', '--untracked-files=all', '--ignored']),
    head: gitQuery(root, ['rev-parse', 'HEAD']).trim(),
    symbolicHead: gitQuery(root, ['rev-parse', '--symbolic-full-name', 'HEAD']).trim(),
    refs: gitQuery(root, ['for-each-ref', '--format=%(refname) %(objectname)']),
  };
}

/**
 * Snapshot a set of root-relative files' raw bytes plus the repository state, for
 * {@link assertFilesUnchanged}. Throws if the working tree is not clean (untracked and ignored files
 * included): the fixture must be committed, or a handler rewriting an already-dirty file would leave
 * the status unchanged and pass.
 */
export function snapshotFiles(root: string, relativePaths: readonly string[]): PersistenceSnapshot {
  const state = gitState(root);
  if (state.status !== '') {
    throw new Error(`channel-enumeration: fixture must be committed before a snapshot; git status:\n${state.status}`);
  }
  const files = new Map<string, Buffer>();
  for (const relativePath of relativePaths) {
    files.set(relativePath, readFileSync(join(root, relativePath)));
  }
  return { files, ...state };
}

/**
 * Assert nothing {@link PersistenceSnapshot} compares has changed since `snapshot` was taken: the
 * listed files' bytes, the working-tree status, `HEAD`, its symbolic target, and the refs. Each
 * check throws its own message, in that order.
 */
export function assertFilesUnchanged(root: string, snapshot: PersistenceSnapshot): void {
  for (const [relativePath, before] of snapshot.files) {
    const after = readFileSync(join(root, relativePath));
    if (!after.equals(before)) {
      throw new Error(`channel-enumeration: file changed after a refused write attempt: ${relativePath}`);
    }
  }
  const after = gitState(root);
  if (after.status !== snapshot.status) {
    throw new Error(`channel-enumeration: working tree changed after a refused write attempt:\n${after.status}`);
  }
  if (after.head !== snapshot.head) {
    throw new Error(`channel-enumeration: HEAD moved after a refused write attempt: ${snapshot.head} -> ${after.head}`);
  }
  if (after.symbolicHead !== snapshot.symbolicHead) {
    throw new Error(
      `channel-enumeration: HEAD switched after a refused write attempt: ${snapshot.symbolicHead} -> ${after.symbolicHead}`,
    );
  }
  if (after.refs !== snapshot.refs) {
    throw new Error(
      `channel-enumeration: refs changed after a refused write attempt:\n--- before\n${snapshot.refs}--- after\n${after.refs}`,
    );
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
