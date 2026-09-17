/**
 * P3.2 (US-4-05) — `wingfoil directive assign` core-op fit criteria, per
 * `docs/02_requirements/02_bdd/features/p3-directives/P3.2-directive-assign.feature` (all three
 * scenarios), `spec-006-core-domain-api` §3 (`directiveAssign`, module `directive`, `mutates: true`,
 * CLI `wingfoil directive assign`, Tool `directive.assign` — dl-041 B), `spec-008-cli-grammar` §4/§5
 * (exit codes), REQ-SYS-08 (the role must be defined in `dna.yaml`), REQ-SEC-01 (identity pre-flight)
 * — task-051-directive-assign.
 *
 * Exercises the REAL registered `CORE_MODULES` operation against THROWAWAY temp git repos carrying the
 * real `wingfoil init` scaffold, never this repository's own `.wingfoil/`.
 *
 * bug-027 note: `commitPaths` currently commits the whole index. These tests start every call from a
 * clean index and assert the commit contains exactly `.wingfoil/roles.yaml`; they deliberately do NOT
 * depend on (or test) the whole-index behaviour — that regression test belongs to bug-027's fix.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CORE_MODULES, initWingfoilProject, loadRolesYaml } from '../../src/core';
import { exitCodeForResult, exitCodeForThrow } from '../../src/core/exit-code';
import type { CoreFn } from '../../src/core/registry';
import { deriveVerb, enumerateOperations } from '../../src/core/registry';
import { UsageError } from '../../src/core/usage-error';
import { deriveMcpToolName } from '../../src/mcp/registrar';
import { commitAll, makeTempGitRepo, removeTempDir, writeFixtureFile } from '../storage/helpers/git-fixture';

const ROLES = '.wingfoil/roles.yaml';

/** The real, registered `directive.directiveAssign` `CoreFn` — fails loudly if it is ever un-registered. */
function directiveAssignFn(): CoreFn<unknown, unknown> {
  const operation = CORE_MODULES.find((module) => module.name === 'directive')?.operations.directiveAssign;
  if (!operation) throw new Error('fixture bug: "directiveAssign" operation not registered on the directive module');
  return operation.fn;
}

function gitOut(repo: string, args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf-8' }).trim();
}

function head(repo: string): string {
  return gitOut(repo, ['rev-parse', 'HEAD']);
}

function readRoles(repo: string): string {
  return readFileSync(join(repo, ROLES), 'utf-8');
}

/** A temp git repo with the REAL `wingfoil init` Scrum scaffold (dna.yaml roles, roles.yaml, 10 directives). */
function makeInitializedRepo(): string {
  const repo = makeTempGitRepo();
  const init = initWingfoilProject(repo, 'Scrum');
  if (!init.ok) throw new Error(`fixture bug: wingfoil init failed — ${init.error.message}`);
  return repo;
}

/** The scaffold with `testing` NOT yet bound to `developer`, committed — the P3.2 Sc.1 precondition. */
function makeRepoWithoutDeveloperTesting(): string {
  const repo = makeInitializedRepo();
  const scaffold = readRoles(repo);
  const edited = scaffold.replace('  developer:\n    - code-quality\n    - testing\n', '  developer:\n    - code-quality\n');
  if (edited === scaffold) throw new Error('fixture bug: scaffold roles.yaml shape changed');
  writeFixtureFile(repo, ROLES, edited);
  commitAll(repo, 'fixture: unbind testing from developer');
  return repo;
}

async function thrownBy(call: Promise<unknown>): Promise<unknown> {
  try {
    await call;
  } catch (error) {
    return error;
  }
  throw new Error('expected the call to throw');
}

describe('CORE_MODULES directive.directiveAssign — registration (spec-006 §3, dl-041 B)', () => {
  it('is registered on the SINGULAR `directive` module as a `mutates: true` operation', () => {
    const entry = enumerateOperations(CORE_MODULES).find(
      ({ module, operation }) => module.name === 'directive' && operation.name === 'directiveAssign',
    );
    expect(entry).toBeDefined();
    expect(entry?.operation.mutates).toBe(true);
    const plural = CORE_MODULES.find((module) => module.name === 'directives');
    expect(plural?.operations.directiveAssign).toBeUndefined();
  });

  it('derives the CLI command `directive assign` and the MCP Tool `directive.assign`', () => {
    const verb = deriveVerb('directive', 'directiveAssign');
    expect(verb).toBe('assign');
    expect(deriveMcpToolName('directive', verb)).toBe('directive.assign');
  });

  it('declares `--directive` and `--role` as required value-bearing options', () => {
    const operation = CORE_MODULES.find((m) => m.name === 'directive')?.operations.directiveAssign;
    expect(operation?.options).toEqual([
      { name: 'directive', required: true },
      { name: 'role', required: true },
    ]);
  });
});

describe('CORE_MODULES directive.directiveAssign — P3.2 scenarios (initialized project)', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeRepoWithoutDeveloperTesting();
  });

  afterEach(() => removeTempDir(repo));

  // BDD Scenario 1: "Assign a directive to a role".
  it('Sc.1: assigns testing to developer — the role lists it, one commit touching only roles.yaml, exit 0', async () => {
    const before = head(repo);
    const result = await directiveAssignFn()({ root: repo, options: { directive: 'testing', role: 'developer' } });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(exitCodeForResult(result)).toBe(0);
    expect(result.value).toEqual({
      directive: 'testing',
      role: 'developer',
      assignments: ['code-quality', 'determinism', 'testing'],
    });

    // "the role 'developer' lists 'testing' among its assigned directives" — read back through the real loader.
    expect(loadRolesYaml(repo).assignments.developer).toContain('testing');

    const message = 'wf(directive): assign testing to developer';
    expect(result.commit).toEqual({ sha: head(repo), message });
    expect(head(repo)).not.toBe(before);
    expect(gitOut(repo, ['log', '-1', '--format=%s'])).toBe(message);
    expect(gitOut(repo, ['show', '--name-only', '--format=', 'HEAD'])).toBe(ROLES);
    expect(gitOut(repo, ['status', '--porcelain'])).toBe('');
  });

  // AC4 — comment/format preservation: exactly one added line, every other byte intact.
  it('AC4: preserves every comment and line of roles.yaml — the diff is exactly one added item line', async () => {
    const before = readRoles(repo);
    await directiveAssignFn()({ root: repo, options: { directive: 'testing', role: 'developer' } });
    expect(readRoles(repo)).toBe(before.replace('    - determinism\n', '    - determinism\n    - testing\n'));
    expect(gitOut(repo, ['diff', '--numstat', 'HEAD~1', 'HEAD'])).toBe(`1\t0\t${ROLES}`);
  });

  // BDD Scenario 2: "Error - assigning to a role not defined in DNA".
  it('Sc.2: an undefined role exits 1 with the exact message and makes no assignment', async () => {
    const before = readRoles(repo);
    const sha = head(repo);
    const result = await directiveAssignFn()({ root: repo, options: { directive: 'testing', role: 'wizard' } });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ code: 'NOT_FOUND', message: "unknown role 'wizard' (not defined in dna.yaml)" });
    expect(exitCodeForResult(result)).toBe(1);
    expect(readRoles(repo)).toBe(before);
    expect(head(repo)).toBe(sha);
  });

  // BDD Scenario 3: "Error - assigning a non-existent directive".
  it('Sc.3: a non-existent directive exits 1 with the exact message and makes no assignment', async () => {
    const before = readRoles(repo);
    const sha = head(repo);
    const result = await directiveAssignFn()({ root: repo, options: { directive: 'ghost', role: 'developer' } });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ code: 'NOT_FOUND', message: 'unknown directive: ghost' });
    expect(exitCodeForResult(result)).toBe(1);
    expect(readRoles(repo)).toBe(before);
    expect(head(repo)).toBe(sha);
  });

  it('checks the role before the directive when both are unknown (deterministic first failure)', async () => {
    const result = await directiveAssignFn()({ root: repo, options: { directive: 'ghost', role: 'wizard' } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toBe("unknown role 'wizard' (not defined in dna.yaml)");
  });

  // AC5 — idempotence (P3.7 Sc.2 "Binding is idempotent").
  it('AC5: re-assigning an already-assigned directive exits 0, leaves the file byte-identical and commits nothing', async () => {
    const first = await directiveAssignFn()({ root: repo, options: { directive: 'testing', role: 'developer' } });
    expect(first.ok).toBe(true);
    const bytes = readRoles(repo);
    const sha = head(repo);

    const again = await directiveAssignFn()({ root: repo, options: { directive: 'testing', role: 'developer' } });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(exitCodeForResult(again)).toBe(0);
    expect(again.commit).toBeUndefined();
    expect(again.value).toEqual({
      directive: 'testing',
      role: 'developer',
      assignments: ['code-quality', 'determinism', 'testing'],
    });
    expect(readRoles(repo)).toBe(bytes);
    expect(head(repo)).toBe(sha);
    expect((loadRolesYaml(repo).assignments.developer ?? []).filter((id) => id === 'testing')).toHaveLength(1);
  });

  // AC7 — dl-029: a role defined in DNA with no `assignments` entry yet.
  it('AC7: assigns to a DNA role absent from roles.yaml by inserting its key before the trailing comment', async () => {
    const before = readRoles(repo);
    const result = await directiveAssignFn()({ root: repo, options: { directive: 'security', role: 'approver' } });
    expect(result.ok).toBe(true);
    expect(readRoles(repo)).toBe(
      before.replace('    - code-review\n\n# Global', '    - code-review\n  approver:\n    - security\n\n# Global'),
    );
    expect(loadRolesYaml(repo).assignments.approver).toEqual(['security']);
  });

  // AC9 — spec-008 §4 missing-required-argument wording.
  it.each([
    [{ role: 'developer' }, 'missing required argument: --directive'],
    [{ directive: 'testing' }, 'missing required argument: --role'],
    [{}, 'missing required argument: --directive'],
  ])('AC9: options %p is a usage error (exit 2) and writes nothing', async (options, reason) => {
    const before = readRoles(repo);
    const thrown = await thrownBy(directiveAssignFn()({ root: repo, options }));
    expect(thrown).toBeInstanceOf(UsageError);
    expect(exitCodeForThrow(thrown)).toEqual({ reason, exitCode: 2 });
    expect(readRoles(repo)).toBe(before);
  });

  it('a roles.yaml that is not valid YAML is a VALIDATION error (exit 1), nothing written', async () => {
    writeFixtureFile(repo, ROLES, 'assignments:\n  developer: [unclosed\n');
    commitAll(repo, 'fixture: unparseable roles.yaml');
    const result = await directiveAssignFn()({ root: repo, options: { directive: 'testing', role: 'developer' } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
    expect(exitCodeForResult(result)).toBe(1);
    expect(readRoles(repo)).toBe('assignments:\n  developer: [unclosed\n');
  });

  it('a schema-invalid roles.yaml is a VALIDATION error (exit 1), nothing written or committed', async () => {
    writeFixtureFile(repo, ROLES, 'assignments:\n  developer: not-a-list\n');
    commitAll(repo, 'fixture: break roles.yaml');
    const sha = head(repo);
    const result = await directiveAssignFn()({ root: repo, options: { directive: 'testing', role: 'developer' } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
    expect(readRoles(repo)).toBe('assignments:\n  developer: not-a-list\n');
    expect(head(repo)).toBe(sha);
  });
});

describe('CORE_MODULES directive.directiveAssign — built-in assets, missing and hand-written roles.yaml', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeInitializedRepo();
  });

  afterEach(() => removeTempDir(repo));

  // AC6 — dl-030 / REQ-SEC-07: assigning a built-in is allowed and does not modify the asset.
  it('AC6: a directive that exists only under built-in/ is assignable; the asset file is untouched', async () => {
    const builtIn = '.wingfoil/directives/built-in/house-style.md';
    const content = '---\nid: house-style\nname: house-style\ntype: directive\nkind: built-in\ntitle: House style\n---\n\n# House style\n';
    writeFixtureFile(repo, builtIn, content);
    commitAll(repo, 'fixture: a built-in directive');

    const result = await directiveAssignFn()({ root: repo, options: { directive: 'house-style', role: 'qa' } });
    expect(result.ok).toBe(true);
    expect(loadRolesYaml(repo).assignments.qa).toEqual(['testing', 'house-style']);
    expect(readFileSync(join(repo, builtIn), 'utf-8')).toBe(content);
    expect(gitOut(repo, ['show', '--name-only', '--format=', 'HEAD'])).toBe(ROLES);
  });

  it('matches `--directive` against the directive id (roles.yaml binds by id), not a filename or title', async () => {
    const result = await directiveAssignFn()({ root: repo, options: { directive: 'Testing', role: 'qa' } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toBe('unknown directive: Testing');
  });

  it('creates roles.yaml when the project has none yet (no bindings is legal), committing only that file', async () => {
    execFileSync('git', ['-C', repo, 'rm', '--quiet', ROLES]);
    execFileSync('git', ['-C', repo, 'commit', '--quiet', '-m', 'fixture: no roles.yaml']);

    const result = await directiveAssignFn()({ root: repo, options: { directive: 'testing', role: 'developer' } });
    expect(result.ok).toBe(true);
    expect(readRoles(repo)).toBe('version: 1\nassignments:\n  developer:\n    - testing\nglobal: []\n');
    expect(gitOut(repo, ['show', '--name-only', '--format=', 'HEAD'])).toBe(ROLES);
  });

  it('falls back to a whole-file rewrite only when the file has no comment to lose', async () => {
    writeFixtureFile(repo, ROLES, 'version: 1\nassignments: {developer: [code-quality]}\nglobal: [documentation]\n');
    commitAll(repo, 'fixture: flow-style roles.yaml without comments');

    const result = await directiveAssignFn()({ root: repo, options: { directive: 'testing', role: 'developer' } });
    expect(result.ok).toBe(true);
    const rolesYaml = loadRolesYaml(repo);
    expect(rolesYaml.assignments.developer).toEqual(['code-quality', 'testing']);
    expect(rolesYaml.global).toEqual(['documentation']);
    expect(rolesYaml.version).toBe(1);
  });

  // D6 — bug-019's lesson: never a silent comment loss.
  it('fails closed (CONFLICT, exit 1, file untouched) when only a comment-discarding rewrite could apply it', async () => {
    const text = '# hand-written\nassignments:\n  developer: [code-quality]  # flow style\nglobal: []\n';
    writeFixtureFile(repo, ROLES, text);
    commitAll(repo, 'fixture: flow-style roles.yaml with comments');
    const sha = head(repo);

    const result = await directiveAssignFn()({ root: repo, options: { directive: 'testing', role: 'developer' } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      code: 'CONFLICT',
      message: 'roles.yaml cannot be updated without discarding its comments; edit assignments.developer by hand',
    });
    expect(exitCodeForResult(result)).toBe(1);
    expect(readRoles(repo)).toBe(text);
    expect(head(repo)).toBe(sha);
  });

  // REQ-SYS-07: the written bytes are a pure function of (file, role, directive).
  it('writes byte-identical roles.yaml for the same assignment in two independent repositories', async () => {
    const other = makeInitializedRepo();
    try {
      await directiveAssignFn()({ root: repo, options: { directive: 'security', role: 'developer' } });
      await directiveAssignFn()({ root: other, options: { directive: 'security', role: 'developer' } });
      expect(readRoles(repo)).toBe(readRoles(other));
    } finally {
      removeTempDir(other);
    }
  });
});

describe('CORE_MODULES directive.directiveAssign — REQ-SEC-01 git-identity pre-flight (no configured identity)', () => {
  const ISOLATION_KEYS = ['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM', 'GIT_CONFIG_NOSYSTEM'] as const;
  let repo: string;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'wf-dirassign-noid-'));
    execFileSync('git', ['-C', repo, 'init', '-q', '--initial-branch=main'], { encoding: 'utf-8' });
    const emptyConfig = join(repo, 'empty.gitconfig');
    writeFileSync(emptyConfig, '');
    for (const key of ISOLATION_KEYS) saved[key] = process.env[key];
    process.env.GIT_CONFIG_GLOBAL = emptyConfig;
    process.env.GIT_CONFIG_SYSTEM = emptyConfig;
    process.env.GIT_CONFIG_NOSYSTEM = '1';
  });

  afterEach(() => {
    for (const key of ISOLATION_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    rmSync(repo, { recursive: true, force: true });
  });

  it('refuses before reading anything (exit 1)', async () => {
    const result = await directiveAssignFn()({ root: repo, options: { directive: 'testing', role: 'developer' } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      code: 'VALIDATION',
      message: 'git identity not configured (user.name/user.email)',
    });
    expect(exitCodeForResult(result)).toBe(1);
  });
});
