/**
 * task-039-mcp-prompts-role-based-infra — **REQ-INT-02** (MCP Prompts, role-based),
 * `spec-004-mcp-surface-contract` §3. Exercised end to end over the MCP SDK's own in-memory transport
 * plus a real `Client` — the same fixture shape `test/mcp/read-only-resources.test.ts` uses for the
 * Resources channel — against `registerRolePrompts` (`src/mcp/prompt.ts`).
 *
 * The four assertions map 1:1 onto the task's T1 acceptance-criterion classification (all four
 * red-first; see the task's Execution Notes):
 *
 *  - AC-1 `prompts/list` advertises exactly one `{role}-session` prompt per `dna.yaml` `team.roles`
 *    entry (spec-004 §3.1).
 *  - AC-2 `prompts/get` embeds 100% of the role's resolved directives — own `assignments` ∪ `global` —
 *    each as a `## Directive: {id}` block carrying the directive's full body, and 0 directives bound
 *    only to another role (spec-004 §3.2 / REQ-INT-02 Fit Criterion, first half).
 *  - AC-3 a directive assigned to the role *after* the server was constructed appears in the next
 *    `prompts/get` on that same live server (spec-004 §3.2 "resolved per-request, not cached from
 *    server boot" / REQ-INT-02 Fit Criterion, second half).
 *  - AC-4 the Prompts channel is read-only (spec-004 §3.3): a full `prompts/list` + `prompts/get`
 *    round trip leaves every config file byte-for-byte unchanged and registers no Tool.
 *
 * The BDD scenarios of `p5-interaction/P5.2.2-mcp-prompts.feature` — including its undefined-role
 * error string — belong to `task-058-mcp-prompts-role-based`, which `depends_on` this task; they are
 * deliberately not asserted here (see this task's Execution Notes on the infra/feature boundary).
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerRolePrompts, roleSessionPromptName } from '../../src/mcp';
import { commitAll, makeTempGitRepo, removeTempDir, writeFixtureFile } from '../storage/helpers/git-fixture';

import { assertFilesUnchanged, snapshotFiles } from './helpers/channel-enumeration';

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
    - name: qa
paths:
  sources: [ src/ ]
  docs: [ docs/ ]
`;

/** `developer` owns two directives, `reviewer` one; `security-secrets` is global to every role. */
const ROLES_YAML = `
version: 1.0
assignments:
  developer:
    - code-quality
    - testing
  reviewer:
    - code-review
global:
  - security-secrets
`;

/** A `roles.yaml` identical to {@link ROLES_YAML} except `determinism` is now also bound to `developer`. */
const ROLES_YAML_WITH_DETERMINISM = `
version: 1.0
assignments:
  developer:
    - code-quality
    - testing
    - determinism
  reviewer:
    - code-review
global:
  - security-secrets
`;

function directiveDoc(id: string, body: string): string {
  return [
    '---',
    `id: ${id}`,
    `name: "${id}"`,
    'type: directive',
    'kind: custom',
    `title: "${id}"`,
    '---',
    '',
    body,
    '',
  ].join('\n');
}

/** Body text unique per directive, so "this body was embedded" is an unambiguous assertion. */
const DIRECTIVE_BODIES: Readonly<Record<string, string>> = {
  'code-quality': 'BODY-code-quality: lint clean, small functions.',
  testing: 'BODY-testing: write the failing test first.',
  determinism: 'BODY-determinism: no wall-clock, no randomness.',
  'code-review': 'BODY-code-review: check traceability before approving.',
  'security-secrets': 'BODY-security-secrets: never commit credentials.',
};

/** Every config file this suite asserts is left untouched by a Prompts round trip (AC-4). */
const CONFIG_FILES = [
  '.wingfoil/dna.yaml',
  '.wingfoil/roles.yaml',
  ...Object.keys(DIRECTIVE_BODIES).map((id) => `.wingfoil/directives/custom/${id}.md`),
];

function seedFixtureRepo(): string {
  const root = makeTempGitRepo();
  writeFixtureFile(root, '.wingfoil/dna.yaml', DNA_YAML);
  writeFixtureFile(root, '.wingfoil/roles.yaml', ROLES_YAML);
  for (const [id, body] of Object.entries(DIRECTIVE_BODIES)) {
    writeFixtureFile(root, `.wingfoil/directives/custom/${id}.md`, directiveDoc(id, body));
  }
  commitAll(root, 'seed task-039 role-prompts fixture');
  return root;
}

/** Connect a real `Client`/`McpServer` pair with only the Prompts channel wired on, over `root`. */
async function connectPromptClient(root: string): Promise<{ client: Client; server: McpServer }> {
  const server = new McpServer({ name: 'wingfoil-test', version: '0.0.0' });
  registerRolePrompts(server, { resolveRoot: () => root });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'wingfoil-test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

/** Concatenate every message's text content — the "prompt content" spec-004 §3.2 speaks of. */
function promptText(result: Awaited<ReturnType<Client['getPrompt']>>): string {
  return result.messages
    .map((message) => (message.content.type === 'text' ? message.content.text : ''))
    .join('\n');
}

describe('prompts/list — one {role}-session prompt per dna.yaml team.roles entry (spec-004 §3.1)', () => {
  let root: string;
  let client: Client;

  beforeAll(async () => {
    root = seedFixtureRepo();
    ({ client } = await connectPromptClient(root));
  });

  afterAll(() => removeTempDir(root));

  it('derives the prompt set from DNA — exactly one per role, named {role}-session', async () => {
    const { prompts } = await client.listPrompts();
    expect(prompts.map((prompt) => prompt.name).sort()).toEqual([
      'developer-session',
      'qa-session',
      'reviewer-session',
    ]);
  });

  it('exposes the name derivation itself, so the wire name is never hand-spelled twice', () => {
    expect(roleSessionPromptName('developer')).toBe('developer-session');
  });
});

describe('prompts/get — 100% of the role\'s directives embedded (spec-004 §3.2, REQ-INT-02)', () => {
  let root: string;
  let client: Client;

  beforeAll(async () => {
    root = seedFixtureRepo();
    ({ client } = await connectPromptClient(root));
  });

  afterAll(() => removeTempDir(root));

  it('embeds every directive assigned to the role plus every global one, with its full body', async () => {
    const text = promptText(await client.getPrompt({ name: 'developer-session' }));

    expect(text).toContain('# Role: developer');
    for (const id of ['code-quality', 'testing', 'security-secrets']) {
      expect(text).toContain(`## Directive: ${id}`);
      expect(text).toContain(DIRECTIVE_BODIES[id]!);
    }
  });

  it('embeds 0 directives bound only to another role (REQ-STATE-05\'s disjointness, on this surface)', async () => {
    const text = promptText(await client.getPrompt({ name: 'developer-session' }));

    expect(text).not.toContain('code-review');
    expect(text).not.toContain(DIRECTIVE_BODIES['code-review']!);
  });

  it('a role with no assignments of its own still receives the global directives (dl-029)', async () => {
    const text = promptText(await client.getPrompt({ name: 'qa-session' }));

    expect(text).toContain('# Role: qa');
    expect(text).toContain('## Directive: security-secrets');
    expect(text).not.toContain('## Directive: code-quality');
  });

  it('uses an MCP-legal message role — the protocol admits only "user"/"assistant"', async () => {
    const result = await client.getPrompt({ name: 'developer-session' });

    expect(result.messages.length).toBeGreaterThan(0);
    for (const message of result.messages) {
      expect(['user', 'assistant']).toContain(message.role);
    }
  });
});

describe('prompts/get — resolved per request, not cached at server boot (REQ-INT-02 Fit Criterion)', () => {
  let root: string;
  let client: Client;

  beforeAll(async () => {
    root = seedFixtureRepo();
    ({ client } = await connectPromptClient(root));
  });

  afterAll(() => removeTempDir(root));

  it('a directive newly assigned after server construction appears on the next prompts/get', async () => {
    const before = promptText(await client.getPrompt({ name: 'developer-session' }));
    expect(before).not.toContain('## Directive: determinism');

    // Same live server, same connected client — only `roles.yaml` on disk changes.
    writeFixtureFile(root, '.wingfoil/roles.yaml', ROLES_YAML_WITH_DETERMINISM);

    const after = promptText(await client.getPrompt({ name: 'developer-session' }));
    expect(after).toContain('## Directive: determinism');
    expect(after).toContain(DIRECTIVE_BODIES['determinism']!);
  });
});

describe('the Prompts channel is read-only (spec-004 §3.3, CLAUDE.md §8)', () => {
  let root: string;
  let client: Client;

  beforeAll(async () => {
    root = seedFixtureRepo();
    ({ client } = await connectPromptClient(root));
  });

  afterAll(() => removeTempDir(root));

  it('a full prompts/list + prompts/get round trip leaves every config file byte-for-byte unchanged', async () => {
    const snapshot = snapshotFiles(root, CONFIG_FILES);

    await client.listPrompts();
    await client.getPrompt({ name: 'developer-session' });
    await client.getPrompt({ name: 'reviewer-session' });
    await client.getPrompt({ name: 'qa-session' });

    assertFilesUnchanged(root, snapshot);
  });

  it('registers no Tool — the Prompts registrar adds no write path to the surface', async () => {
    await expect(client.listTools()).rejects.toThrow(/method not found/i);
  });
});
