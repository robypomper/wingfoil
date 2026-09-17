/**
 * `wingfoil directives list` — P3.4 (US-4-04), ground-truth BDD
 * `docs/02_requirements/02_bdd/features/p3-directives/P3.4-directives-list.feature`
 * (task-053-directives-list).
 *
 * Driven through the REGISTERED `directives.directivesList` operation in the production
 * `CORE_MODULES` array (`src/core/index.ts`), not through an internal helper: spec-006-core-domain-api
 * §3 makes that operation the contract both surfaces derive from, so asserting on it is asserting on
 * what `wingfoil directives list` and the `wingfoil://directives/list` Resource actually return.
 *
 * T1 classification (dl-014, recorded in the task's Execution Notes): the *enumeration* half of
 * Scenario 1 and the whole of Scenario 3 are **characterization** — `loadDirectives`
 * (`src/core/loaders.ts`) already walked `.wingfoil/directives/**` and returned `{path, frontmatter}`
 * per file before this task, and those cases were already green here. The **role-assignment** half of
 * Scenario 1 and all of Scenario 2 (`--role`) are **red-first**: nothing in the payload read
 * `roles.yaml`, and the operation declared no `--role` option at all. Each case below is labelled.
 *
 * Role binding is read off `spec-012-context-loader-relevance-filtering` §5 — a role's own
 * `roles.yaml` `assignments` entries PLUS the unconditional `global` list — and binds on
 * `frontmatter.id`, never `name` (`src/directives/schema.ts`'s `RolesYaml` doc: assignment values and
 * `global` entries are directive ids).
 *
 * NOT asserted here, deliberately: `dl-037-builtin-vs-custom-directive-precedence`'s custom-wins
 * precedence and its shadow warning. That gap lives in `resolveRoleDirectives`
 * (`src/core/context.ts`) and is `task-055-auto-load-directives-by-role`'s to close. This listing
 * deliberately does not deduplicate at all — see the `shadowed id` case below.
 */
import { CORE_MODULES } from '../../src/core';
import type { CoreOperation } from '../../src/core/registry';
import type { CoreResult } from '../../src/core/types';
import { makeTempGitRepo, removeTempDir, writeFixtureFile } from '../storage/helpers/git-fixture';

/**
 * The contract shape one listed directive is expected to carry, declared structurally here rather
 * than imported, so this suite states the expectation independently of the implementation's own
 * exported type.
 */
interface ListedDirective {
  readonly path: string;
  readonly frontmatter: { readonly id: string; readonly name: string };
  readonly roles: readonly string[];
  readonly global: boolean;
  readonly assignment: string;
}

function findDirectivesList(): CoreOperation {
  const module = CORE_MODULES.find((entry) => entry.name === 'directives');
  if (!module) throw new Error('no `directives` module registered in CORE_MODULES');
  const operation = module.operations['directivesList'];
  if (!operation) throw new Error('no `directivesList` operation registered in the `directives` module');
  return operation;
}

/** Run the registered operation the way the CLI adapter does: `{ root, options }` (spec-006 §2). */
async function runList(root: string, options?: Record<string, string>): Promise<CoreResult<unknown>> {
  return findDirectivesList().fn({ root, options });
}

/** Unwrap a successful listing, failing the test loudly (never silently) if the call errored. */
async function listOk(root: string, options?: Record<string, string>): Promise<readonly ListedDirective[]> {
  const result = await runList(root, options);
  if (!result.ok) throw new Error(`expected coreOk, got ${result.error.code}: ${result.error.message}`);
  return result.value as readonly ListedDirective[];
}

function directiveDoc(id: string, name: string): string {
  return [`---`, `id: ${id}`, `name: "${name}"`, `type: directive`, `kind: custom`, `title: "${name}"`, `---`, ``, `# ${name}`, ``].join('\n');
}

/**
 * The BDD Background, transcribed: built-in directives plus one custom directive
 * `no-direct-db-access`. `roles.yaml` binds `testing` to `developer` (Scenario 2's `Given`),
 * `code-review` to `reviewer` only, and makes `security-secrets` global; `architecture` is present
 * on disk but named by nobody, which is the `unassigned` case.
 */
const ROLES_YAML = `version: 1.0
assignments:
  developer:
    - testing
    - no-direct-db-access
  reviewer:
    - code-review
  qa:
    - testing
global:
  - security-secrets
`;

/** The six P3.8 built-in ids (`dl-037` names them): the scenario's "6 built-in directives". */
const BUILT_IN_IDS = ['architecture', 'code-quality', 'code-review', 'documentation', 'security', 'testing'] as const;

function seedBuiltIns(root: string): void {
  for (const id of BUILT_IN_IDS) {
    writeFixtureFile(root, `.wingfoil/directives/built-in/${id}.md`, directiveDoc(id, id));
  }
}

describe('directivesList — P3.4 Scenario 1: list all directives with assignments', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeTempGitRepo();
    seedBuiltIns(repo);
    writeFixtureFile(repo, '.wingfoil/directives/custom/no-direct-db-access.md', directiveDoc('no-direct-db-access', 'No direct DB access'));
    writeFixtureFile(repo, '.wingfoil/directives/custom/security-secrets.md', directiveDoc('security-secrets', 'Security & secrets'));
    writeFixtureFile(repo, '.wingfoil/roles.yaml', ROLES_YAML);
  });

  afterEach(() => removeTempDir(repo));

  // T1: CHARACTERIZATION — `loadDirectives` already enumerated both trees before this task.
  it('the output includes the 6 built-in directives and "no-direct-db-access"', async () => {
    const entries = await listOk(repo);
    const ids = entries.map((entry) => entry.frontmatter.id).sort();
    expect(ids).toEqual([...BUILT_IN_IDS, 'no-direct-db-access', 'security-secrets'].sort());
  });

  // T1: RED-FIRST — no role information existed in the payload.
  it('each directive shows its assigned roles', async () => {
    const entries = await listOk(repo);
    const byId = new Map(entries.map((entry) => [entry.frontmatter.id, entry]));
    expect(byId.get('testing')?.roles).toEqual(['developer', 'qa']);
    expect(byId.get('code-review')?.roles).toEqual(['reviewer']);
    expect(byId.get('no-direct-db-access')?.roles).toEqual(['developer']);
  });

  // T1: RED-FIRST — the BDD's literal alternative wording, asserted character-exact.
  it('a directive no role names shows the exact string "unassigned"', async () => {
    const entries = await listOk(repo);
    const architecture = entries.find((entry) => entry.frontmatter.id === 'architecture');
    expect(architecture).toBeDefined();
    expect(architecture?.roles).toEqual([]);
    expect(architecture?.global).toBe(false);
    expect(architecture?.assignment).toBe('unassigned');
  });

  // T1: RED-FIRST — an assigned directive must NOT read as "unassigned"; the roles are rendered.
  it('an assigned directive renders its roles, never "unassigned"', async () => {
    const entries = await listOk(repo);
    const testing = entries.find((entry) => entry.frontmatter.id === 'testing');
    expect(testing?.assignment).toBe('developer, qa');
    expect(entries.filter((entry) => entry.assignment === 'unassigned').map((entry) => entry.frontmatter.id)).toEqual([
      'architecture',
      'code-quality',
      'documentation',
      'security',
    ]);
  });

  // T1: RED-FIRST — `global` directives apply to every role (spec-012 §5), so they are neither
  // role-listed nor "unassigned".
  it('a `global` directive is flagged global and is not reported as unassigned (spec-012 §5)', async () => {
    const entries = await listOk(repo);
    const secrets = entries.find((entry) => entry.frontmatter.id === 'security-secrets');
    expect(secrets?.global).toBe(true);
    expect(secrets?.roles).toEqual([]);
    expect(secrets?.assignment).toBe('global (all roles)');
  });

  // T1: CHARACTERIZATION — the pre-existing `{path, frontmatter}` pair is preserved verbatim, so
  // this task's change is purely additive for every existing consumer.
  it('keeps the pre-existing `path` + `frontmatter` fields on every entry', async () => {
    const entries = await listOk(repo);
    const testing = entries.find((entry) => entry.frontmatter.id === 'testing');
    expect(testing?.path).toBe('directives/built-in/testing.md');
    expect(testing?.frontmatter.name).toBe('testing');
  });

  // REQ-SYS-07: the listing is a pure function of what is on disk — same inputs, deep-equal output.
  it('is deterministic — two calls return a deep-equal listing in the same order', async () => {
    expect(await listOk(repo)).toEqual(await listOk(repo));
  });
});

describe('directivesList — P3.4 Scenario 2: filter the listing by role', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeTempGitRepo();
    seedBuiltIns(repo);
    writeFixtureFile(repo, '.wingfoil/directives/custom/no-direct-db-access.md', directiveDoc('no-direct-db-access', 'No direct DB access'));
    writeFixtureFile(repo, '.wingfoil/directives/custom/security-secrets.md', directiveDoc('security-secrets', 'Security & secrets'));
    writeFixtureFile(repo, '.wingfoil/roles.yaml', ROLES_YAML);
  });

  afterEach(() => removeTempDir(repo));

  // T1: RED-FIRST — the operation declared no `--role` option; the filter did not exist.
  it('only directives assigned to "developer" are listed, including "testing"', async () => {
    const entries = await listOk(repo, { role: 'developer' });
    const ids = entries.map((entry) => entry.frontmatter.id);
    expect(ids).toContain('testing');
    expect(ids).toContain('no-direct-db-access');
    expect(ids).not.toContain('code-review');
    expect(ids).not.toContain('architecture');
  });

  // T1: RED-FIRST — globals are unconditional (spec-012 §5), so they belong to `developer` too.
  it('includes the `global` directives, which are assigned to every role (spec-012 §5)', async () => {
    const ids = (await listOk(repo, { role: 'developer' })).map((entry) => entry.frontmatter.id);
    expect(ids).toContain('security-secrets');
    expect(ids.slice().sort()).toEqual(['no-direct-db-access', 'security-secrets', 'testing']);
  });

  // T1: RED-FIRST — dl-029: a role with no bindings of its own is never an error; it still gets globals.
  it('a role with no assignments of its own lists exactly the globals, exit-0 (dl-029)', async () => {
    const result = await runList(repo, { role: 'architect' });
    expect(result.ok).toBe(true);
    const ids = ((result as { value: readonly ListedDirective[] }).value).map((entry) => entry.frontmatter.id);
    expect(ids).toEqual(['security-secrets']);
  });

  // `roles.yaml` hygiene: a role listing the same directive id twice is a config typo, not a reason
  // to report that role twice on the entry.
  it('a role listing the same directive id twice reports that role once', async () => {
    writeFixtureFile(
      repo,
      '.wingfoil/roles.yaml',
      'version: 1.0\nassignments:\n  developer:\n    - testing\n    - testing\nglobal: []\n',
    );
    const entries = await listOk(repo);
    const testing = entries.find((entry) => entry.frontmatter.id === 'testing');
    expect(testing?.roles).toEqual(['developer']);
    expect(testing?.assignment).toBe('developer');
  });

  // A directive id that collides with an `Object.prototype` member must not resolve through the
  // prototype chain (same hazard `ownAssignments` guards in `src/core/context.ts`).
  it('a directive id shadowing an Object.prototype member is unassigned, not a prototype member', async () => {
    writeFixtureFile(repo, '.wingfoil/directives/custom/constructor.md', directiveDoc('constructor', 'Constructor'));
    const entries = await listOk(repo);
    const entry = entries.find((item) => item.frontmatter.id === 'constructor');
    expect(entry?.roles).toEqual([]);
    expect(entry?.assignment).toBe('unassigned');
  });
});

describe('directivesList — P3.4 Scenario 3 (edge): only built-ins exist', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeTempGitRepo();
    seedBuiltIns(repo);
    writeFixtureFile(repo, '.wingfoil/roles.yaml', ROLES_YAML);
  });

  afterEach(() => removeTempDir(repo));

  // T1: CHARACTERIZATION — an empty `custom/` tree simply contributes no entries.
  it('exactly the 6 built-in directives are listed', async () => {
    const entries = await listOk(repo);
    expect(entries.map((entry) => entry.frontmatter.id)).toEqual([...BUILT_IN_IDS]);
  });
});

describe('directivesList — roles.yaml availability', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeTempGitRepo();
    writeFixtureFile(repo, '.wingfoil/directives/custom/testing.md', directiveDoc('testing', 'Testing'));
  });

  afterEach(() => removeTempDir(repo));

  // T1: RED-FIRST — a project may hold directives before anyone binds them (REQ-SYS-02 pillar
  // isolation). A missing `roles.yaml` means "no bindings", not a failed command.
  it('a missing roles.yaml lists every directive as "unassigned" and still succeeds', async () => {
    const entries = await listOk(repo);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.roles).toEqual([]);
    expect(entries[0]?.global).toBe(false);
    expect(entries[0]?.assignment).toBe('unassigned');
  });

  // A roles.yaml that EXISTS but does not validate is a real failure — only ENOENT is tolerated.
  it('a schema-invalid roles.yaml surfaces as a VALIDATION error, not as "unassigned"', async () => {
    writeFixtureFile(repo, '.wingfoil/roles.yaml', 'version: 1.0\nassignments: "not-a-record"\n');
    const result = await runList(repo);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });

  // T1: CHARACTERIZATION — an invalid directive file already failed the whole load (task-004).
  it('a schema-invalid directive file still surfaces as a VALIDATION error', async () => {
    writeFixtureFile(repo, '.wingfoil/directives/custom/broken.md', '---\nid: broken\ntype: not-a-directive\nkind: custom\ntitle: Broken\n---\n');
    const result = await runList(repo);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });
});

describe('directivesList — a shadowed id is listed, never hidden (dl-037 / spec-012 §5)', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeTempGitRepo();
    writeFixtureFile(repo, '.wingfoil/directives/built-in/testing.md', directiveDoc('testing', 'Testing (built-in)'));
    writeFixtureFile(repo, '.wingfoil/directives/custom/testing.md', directiveDoc('testing', 'Testing (custom)'));
    writeFixtureFile(repo, '.wingfoil/roles.yaml', ROLES_YAML);
  });

  afterEach(() => removeTempDir(repo));

  /**
   * This listing is an INVENTORY of the directive files installed, not the resolved per-role set
   * `resolveRoleDirectives` produces. It therefore does not deduplicate by id: when a built-in and a
   * custom file share an id, BOTH are listed, each with its own `path`. Hiding one would be the same
   * defect `dl-037` was raised about ("a shadowed directive is reported, never silently dropped",
   * spec-012 §5) reproduced in the one command whose purpose is directive visibility. Choosing the
   * winner, and warning about the loser, stays `task-055-auto-load-directives-by-role`'s job.
   */
  it('lists both files sharing an id, each with its own path', async () => {
    const entries = (await listOk(repo)).filter((entry) => entry.frontmatter.id === 'testing');
    expect(entries.map((entry) => entry.path)).toEqual(['directives/built-in/testing.md', 'directives/custom/testing.md']);
    expect(entries.map((entry) => entry.frontmatter.name)).toEqual(['Testing (built-in)', 'Testing (custom)']);
  });

  it('keeps both under a `--role` filter too — the shadowed file is never silently dropped', async () => {
    const entries = (await listOk(repo, { role: 'developer' })).filter((entry) => entry.frontmatter.id === 'testing');
    expect(entries).toHaveLength(2);
    entries.forEach((entry) => expect(entry.roles).toEqual(['developer', 'qa']));
  });
});
