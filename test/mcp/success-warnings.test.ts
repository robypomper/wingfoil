/**
 * task-169 (`dl-062` Q1 option 3, addendum "Implementation scheduling" §2) — the MCP half of the
 * success-warning channel. An MCP Tool has no stderr, so a successful Tool result carries the
 * warnings in a declared field: `structuredContent: {value, warnings}`, beside the unchanged text
 * content (the payload's JSON). It is the success twin of task-130's refusal shape,
 * `structuredContent: {error, details}`. A success with no warnings is the text-only result it always
 * was.
 *
 * Observed over the SDK's in-memory transport with a real `Client`, as `./error-details.test.ts` does.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { CoreModule } from '../../src/core/registry';
import { coreOk, type CoreResult } from '../../src/core/types';
import { registerCoreModules } from '../../src/mcp/registrar';

const VALUE = { directives: ['testing'], role: 'developer', assignments: ['code-quality', 'testing'] };
const WARNING = 'roles.yaml was rewritten as a whole file (--force)';

const success = (warnings: readonly string[]): CoreResult<unknown> =>
  coreOk<unknown>(VALUE, { sha: 'abc123', message: 'wf(directive): assign testing to developer' }, warnings);

const MODULES: CoreModule[] = [
  {
    name: 'directive',
    operations: {
      directiveAssign: { name: 'directiveAssign', mutates: true, fn: async () => success([WARNING]) },
      directiveCreate: { name: 'directiveCreate', mutates: true, fn: async () => success([]) },
    },
  },
];

async function connectedClient(): Promise<Client> {
  const server = new McpServer({ name: 'wingfoil-test', version: '0.0.0' });
  registerCoreModules(server, MODULES, { resolveRoot: () => '/fixture-root', buildParams: () => ({}) });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'wingfoil-test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe('MCP registrar — success warnings on a Tool result (task-169)', () => {
  it('a successful Tool call keeps the payload as its text and carries `{value, warnings}` as structuredContent', async () => {
    const result = await (await connectedClient()).callTool({ name: 'directive.assign', arguments: {} });
    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(VALUE) }]);
    expect(result.structuredContent).toEqual({ value: VALUE, warnings: [WARNING] });
  });

  it('characterization: a successful Tool call without warnings is the text-only result it always was', async () => {
    const result = await (await connectedClient()).callTool({ name: 'directive.create', arguments: {} });
    expect(result).toEqual({ content: [{ type: 'text', text: JSON.stringify(VALUE) }] });
  });
});
