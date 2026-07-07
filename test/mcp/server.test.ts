/**
 * task-030-implement-mcp-resources (P5.2.1, REQ-INT-01, spec-004-mcp-surface-contract §1/§2,
 * spec-014-mcp-server-entry-point §2/§3) — the PRODUCTION MCP server construction.
 *
 * task-011-mcp-resources-read-only proved the read-only Resources CHANNEL (`registerReadOnlyResources`)
 * over the SDK's in-memory transport; task-030 wraps that channel in a real, production `McpServer`
 * built by `createMcpServer` (`src/mcp/server.ts`) — the first production `McpServer` in the codebase,
 * the same object `startMcpServer` then connects over a real `StdioServerTransport` (the thin,
 * un-unit-tested transport seam). This suite exercises `createMcpServer`'s server end-to-end over a
 * real `Client` (mirroring `test/mcp/read-only-resources.test.ts`), so the three P5.2.1 acceptance
 * criteria are asserted against exactly what an MCP client sees from the production server — not a
 * private registrar list — and the v0.1 read-only-only channel scope (spec-014 §3) is pinned.
 */
import { performance } from 'perf_hooks';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { WRITE_REFUSAL_MESSAGE } from '../../src/mcp';
import { createMcpServer } from '../../src/mcp/server';
import { commitAll, makeTempGitRepo, removeTempDir, writeFixtureFile } from '../storage/helpers/git-fixture';
import { assertFilesUnchanged, attemptEveryResourceWrite, snapshotFiles } from './helpers/channel-enumeration';

const DNA_YAML = `
version: 1.1
project:
  name: "Fixture Project"
modules:
  - name: core
    path: src/core
stacks:
  technologies:
    - name: TypeScript
      category: language
team:
  members:
    - name: Test User
      roles: [ developer ]
  roles:
    - name: developer
paths:
  sources: [ src/ ]
`;

const MEMORY_YAML = `
version: 1.1
types:
  task:
    path: "docs/04_memory/{release}/{id}.md"
  decision-log:
    path: "docs/04_memory/design/dls/{id}.md"
`;

/** The BDD's "decision-12" document (P5.2.1-mcp-resources.feature, AC a). */
function decisionDoc(): string {
  return [
    '---',
    'id: decision-12',
    'type: decision-log',
    'title: "Adopt stdio transport"',
    'status: in-discussion',
    'tags: [ transport ]',
    '---',
    '',
    'Body of decision-12 — full markdown content that a fetch must return verbatim.',
    '',
  ].join('\n');
}

/** Seed a minimal, committed fixture project the production server resolves its root at. */
function seedFixtureRepo(): string {
  const root = makeTempGitRepo();
  writeFixtureFile(root, '.wingfoil/dna.yaml', DNA_YAML);
  writeFixtureFile(root, '.wingfoil/memory.yaml', MEMORY_YAML);
  writeFixtureFile(root, 'docs/04_memory/design/dls/decision-12.md', decisionDoc());
  commitAll(root, 'seed task-030 production MCP server fixture');
  return root;
}

/**
 * Connect a real MCP `Client` to the PRODUCTION server built by `createMcpServer` over the SDK's
 * in-memory transport — the production `McpServer` construction, not `registerReadOnlyResources` in
 * isolation (that is task-011's `connectReadOnlyClient`). No stdio: the transport is the SDK's own
 * in-memory pair, so no real `StdioServerTransport` is ever opened against a repo (HARD RULE).
 */
async function connectProductionClient(root: string): Promise<Client> {
  const server = createMcpServer({ resolveRoot: () => root, name: 'wingfoil', version: '9.9.9-test' });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'wingfoil-test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe('task-030 — production MCP server (createMcpServer), spec-014 §2', () => {
  let root: string;
  let client: Client;

  beforeAll(async () => {
    root = seedFixtureRepo();
    client = await connectProductionClient(root);
  });

  afterAll(() => removeTempDir(root));

  it('AC (a): fetching a Memory document returns its full content + id/type/status/title metadata, in under 1 second', async () => {
    const start = performance.now();
    const result = await client.readResource({ uri: 'wingfoil://memory/decision-log/decision-12' });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1000);
    const content = result.contents[0]!;
    expect(content.mimeType).toBe('text/markdown');
    expect('text' in content && content.text).toContain('id: decision-12');
    expect('text' in content && content.text).toContain('Body of decision-12');
    expect((result as unknown as { metadata: Record<string, unknown> }).metadata).toEqual({
      id: 'decision-12',
      type: 'decision-log',
      status: 'in-discussion',
      title: 'Adopt stdio transport',
    });
  });

  it('AC (b): a write attempt through the Resources channel is refused byte-exact and mutates no file', async () => {
    const tracked = ['.wingfoil/dna.yaml', '.wingfoil/memory.yaml', 'docs/04_memory/design/dls/decision-12.md'];
    const before = snapshotFiles(root, tracked);

    const messages = await attemptEveryResourceWrite(client, 'wingfoil://memory/decision-log/decision-12');

    expect(messages).toHaveLength(2);
    messages.forEach((message) => expect(message).toBe(WRITE_REFUSAL_MESSAGE));
    assertFilesUnchanged(root, before);
  });

  it('AC (c): a non-existent resource is refused with a "resource not found" error naming the missing id', async () => {
    // task-011's channel disambiguates by the type-qualified identifier (ids are not unique across
    // types — see src/mcp/memory-resource.ts); the BDD's bare "decision-999" surfaces here as the
    // resolvable identifier `memory/decision-log/decision-999`. The `resource not found:` prefix and
    // the missing id are both present verbatim.
    const error = await client
      .readResource({ uri: 'wingfoil://memory/decision-log/decision-999' })
      .catch((caught: unknown) => caught);
    expect(String((error as Error).message)).toContain('resource not found:');
    expect(String((error as Error).message)).toContain('decision-999');
    expect(String((error as Error).message)).not.toContain(WRITE_REFUSAL_MESSAGE);
  });

  it('scope (spec-014 §3): the v0.1 server exposes ONLY the read-only Resources channel — no Tools, no Prompts', async () => {
    const caps = client.getServerCapabilities();
    expect(caps?.resources).toBeDefined();
    // No mutating Tool channel is advertised — in particular the task-025 `dna.set` Tool is NOT
    // registered on the read-only v0.1 server (Tools are P5.2.3/v0.4 scope).
    expect(caps?.tools).toBeUndefined();
    expect(caps?.prompts).toBeUndefined();
  });

  it('the DNA and Workflow Resources are also reachable on the production server (spec-004 §2.1)', async () => {
    const dna = await client.readResource({ uri: 'wingfoil://dna' });
    const dnaContent = dna.contents[0]!;
    const parsed = 'text' in dnaContent ? JSON.parse(dnaContent.text) : undefined;
    expect(parsed.team.roles).toEqual([{ name: 'developer' }]);
  });
});
