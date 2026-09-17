/**
 * task-058-mcp-prompts-role-based — **P5.2.2** (US-1-06), the acceptance suite for
 * `docs/02_requirements/02_bdd/features/p5-interaction/P5.2.2-mcp-prompts.feature`, one `it` per
 * scenario (names quote the scenario titles), run against the PRODUCTION server built by
 * `createMcpServer` (`src/mcp/server.ts`, spec-014 §3) over the SDK's in-memory transport + a real
 * `Client` — the feature's Background "a running WingFoil MCP server".
 *
 * "An agent session starts under role R" is `prompts/get("{R}-session")`, the session-start entry
 * spec-004 §3.1 defines. The registrar-level contract (naming, 100% embedding, read-only) is
 * task-039's `test/mcp/role-prompts.test.ts`; this suite pins what P5.2.2 adds on top: the channel
 * reachable on the shipped server, and the undefined-role refusal.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

import { createMcpServer } from '../../src/mcp/server';
import { commitAll, makeTempGitRepo, removeTempDir, writeFixtureFile } from '../storage/helpers/git-fixture';

const DNA_YAML = `
version: 1.1
project:
  name: "Fixture Project"
modules:
  - name: mcp-server
    path: src/mcp
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
    - name: reviewer
paths:
  sources: [ src/ ]
`;

/** Background: role "developer" has directives "testing" and "code-quality" assigned. */
const ROLES_YAML = `
version: 1.0
assignments:
  developer:
    - testing
    - code-quality
  reviewer:
    - security
global: []
`;

/** Scenario 2's Given: "security" newly assigned to "developer". */
const ROLES_YAML_WITH_SECURITY = `
version: 1.0
assignments:
  developer:
    - testing
    - code-quality
    - security
  reviewer:
    - security
global: []
`;

/** A `roles.yaml` binding a role `wizard` that `dna.yaml` does not declare. */
const ROLES_YAML_BINDING_WIZARD = `
version: 1.0
assignments:
  wizard:
    - security
global: []
`;

const DIRECTIVE_BODIES: Readonly<Record<string, string>> = {
  testing: 'BODY-testing: write the failing test first.',
  'code-quality': 'BODY-code-quality: lint clean.',
  security: 'BODY-security: never commit credentials.',
};

function directiveDoc(id: string, body: string): string {
  return ['---', `id: ${id}`, `name: "${id}"`, 'type: directive', 'kind: custom', `title: "${id}"`, '---', '', body, ''].join('\n');
}

function seedFixtureRepo(): string {
  const root = makeTempGitRepo();
  writeFixtureFile(root, '.wingfoil/dna.yaml', DNA_YAML);
  writeFixtureFile(root, '.wingfoil/roles.yaml', ROLES_YAML);
  for (const [id, body] of Object.entries(DIRECTIVE_BODIES)) {
    writeFixtureFile(root, `.wingfoil/directives/custom/${id}.md`, directiveDoc(id, body));
  }
  commitAll(root, 'seed task-058 P5.2.2 fixture');
  return root;
}

async function connectProductionClient(root: string): Promise<Client> {
  const server = createMcpServer({ resolveRoot: () => root, name: 'wingfoil', version: '9.9.9-test' });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'wingfoil-test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

function promptText(result: Awaited<ReturnType<Client['getPrompt']>>): string {
  return result.messages.map((message) => (message.content.type === 'text' ? message.content.text : '')).join('\n');
}

describe('P5.2.2-mcp-prompts.feature — MCP Prompts (role-based templates), on the production server', () => {
  let root: string;
  let client: Client;

  beforeEach(async () => {
    root = seedFixtureRepo();
    client = await connectProductionClient(root);
  });

  afterEach(() => removeTempDir(root));

  it('Scenario: Auto-load role prompt at session start', async () => {
    const { prompts } = await client.listPrompts();
    expect(prompts.map((prompt) => prompt.name)).toContain('developer-session');

    const text = promptText(await client.getPrompt({ name: 'developer-session' }));

    expect(text).toContain('# Role: developer');
    for (const id of ['testing', 'code-quality']) {
      expect(text).toContain(`## Directive: ${id}`);
      expect(text).toContain(DIRECTIVE_BODIES[id]!);
    }
    expect(text).not.toContain('## Directive: security');
  });

  it('Scenario: Prompt reflects the current directive assignments', async () => {
    // "security" is newly assigned to "developer" on the already-running server.
    writeFixtureFile(root, '.wingfoil/roles.yaml', ROLES_YAML_WITH_SECURITY);

    const text = promptText(await client.getPrompt({ name: 'developer-session' }));

    expect(text).toContain('## Directive: security');
    expect(text).toContain(DIRECTIVE_BODIES['security']!);
  });

  it("Scenario: Error - requesting a prompt for an undefined role", async () => {
    const error = await client.getPrompt({ name: 'wizard-session' }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(McpError);
    expect((error as McpError).code).toBe(ErrorCode.InvalidParams);
    expect((error as McpError).message).toContain("no prompt for undefined role 'wizard'");
  });
});

describe('P5.2.2 — edges of the undefined-role refusal', () => {
  let root: string;
  let client: Client;

  beforeAll(async () => {
    root = seedFixtureRepo();
    client = await connectProductionClient(root);
  });

  afterAll(() => removeTempDir(root));

  it('the role set is DNA\'s, not roles.yaml\'s: a role bound in roles.yaml but absent from dna.yaml is undefined', async () => {
    writeFixtureFile(root, '.wingfoil/roles.yaml', ROLES_YAML_BINDING_WIZARD);

    const error = await client.getPrompt({ name: 'wizard-session' }).catch((caught: unknown) => caught);

    expect((error as McpError).message).toContain("no prompt for undefined role 'wizard'");
  });

  it('a name outside the {role}-session convention is a plain unknown prompt, not an undefined role', async () => {
    const error = await client.getPrompt({ name: 'wizard' }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(McpError);
    expect((error as McpError).code).toBe(ErrorCode.InvalidParams);
    expect((error as McpError).message).toContain('Prompt wizard not found');
    expect((error as McpError).message).not.toContain('undefined role');
  });
});
