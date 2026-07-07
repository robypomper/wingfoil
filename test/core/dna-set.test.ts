/**
 * P2.1 (US-0A-08) — `wingfoil dna set <key> <value>` core-op fit criteria, per
 * `docs/02_requirements/02_bdd/features/p2-dna/P2.1-dna-set.feature`,
 * `docs/self/docs/04_memory/design/specs/spec-002-dna-yaml-schema.md` (DnaYaml re-validation),
 * `spec-005-cli-command-contract.md` (exit codes: usage error -> 2, logic error -> 1),
 * `spec-006-core-domain-api.md` (dnaSet is `mutates: true`; requireGitIdentity pre-flight),
 * task-025-implement-dna-set.
 *
 * Exercises the REAL, registered `CORE_MODULES` `dna.dnaSet` operation — the first `mutates: true`
 * op in the whole system, the exact same `CoreFn` both `src/cli`'s `dna set` command and the MCP
 * `dna.set` Tool call. Every write lands in a THROWAWAY temp git repo (never this repo's own
 * `.wingfoil/dna.yaml`).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CORE_MODULES, loadDnaYaml } from '../../src/core';
import type { CoreFn } from '../../src/core/registry';
import { exitCodeForResult } from '../../src/core/exit-code';
import { UsageError } from '../../src/core/usage-error';
import { makeTempGitRepo, removeTempDir, writeFixtureFile, commitAll } from '../storage/helpers/git-fixture';

const DNA_FIXTURE = `version: 1.1
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

/** The real, registered `dna.dnaSet` `CoreFn` — fails loudly if a future change un-registers it. */
function dnaSetFn(): CoreFn<unknown, unknown> {
  const dnaModule = CORE_MODULES.find((module) => module.name === 'dna');
  const operation = dnaModule?.operations.dnaSet;
  if (!operation) throw new Error('fixture bug: "dnaSet" operation not registered on the dna module');
  return operation.fn;
}

function head(repo: string): string {
  return execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim();
}
function dnaText(repo: string): string {
  return readFileSync(join(repo, '.wingfoil', 'dna.yaml'), 'utf-8');
}

describe('CORE_MODULES dna.dnaSet — P2.1 fit criteria (repo with a configured identity)', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeTempGitRepo();
    writeFixtureFile(repo, '.wingfoil/dna.yaml', DNA_FIXTURE);
    commitAll(repo, 'seed dna.yaml');
  });

  afterEach(() => {
    removeTempDir(repo);
  });

  it('AC(a): sets a field, writes it, commits exactly one scoped commit, returns ok + commit sha (exit 0)', async () => {
    const before = head(repo);
    const result = await dnaSetFn()({ root: repo, positionals: ['tech_stack.language', 'python'] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.commit?.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(result.commit?.sha).toBe(head(repo));
    expect(head(repo)).not.toBe(before);
    expect(exitCodeForResult(result)).toBe(0);

    // The written file re-parses and validates, with the value under `stacks` (tech_stack alias).
    const dna = loadDnaYaml(repo) as { stacks: Record<string, unknown> };
    expect(dna.stacks.language).toBe('python');
    expect(dnaText(repo)).toContain('language: python');

    // Scoped commit: only .wingfoil/dna.yaml changed in it.
    const changed = execFileSync('git', ['-C', repo, 'show', '--name-only', '--format=', 'HEAD'], {
      encoding: 'utf-8',
    }).trim();
    expect(changed).toBe('.wingfoil/dna.yaml');
  });

  it('AC(b): updating an existing key overwrites in place — one key, no duplicate', async () => {
    await dnaSetFn()({ root: repo, positionals: ['tech_stack.language', 'python'] });
    await dnaSetFn()({ root: repo, positionals: ['tech_stack.language', 'go'] });

    const dna = loadDnaYaml(repo) as { stacks: Record<string, unknown> };
    expect(dna.stacks.language).toBe('go');

    const text = dnaText(repo);
    expect(text.match(/language: go/g)).toHaveLength(1);
    expect(text).not.toContain('language: python');
  });

  it('re-setting a key to its current value is a deterministic, idempotent no-op: exit 0, no new commit, byte-identical file', async () => {
    const firstResult = await dnaSetFn()({ root: repo, positionals: ['stacks.language', 'python'] });
    expect(firstResult.ok).toBe(true);
    const afterFirst = dnaText(repo);
    const headAfterFirst = head(repo);

    const secondResult = await dnaSetFn()({ root: repo, positionals: ['stacks.language', 'python'] });
    expect(secondResult.ok).toBe(true);
    if (secondResult.ok) expect(secondResult.commit).toBeUndefined(); // no-op: no new commit
    expect(dnaText(repo)).toBe(afterFirst); // re-serialization is stable (REQ-SYS-07)
    expect(head(repo)).toBe(headAfterFirst);
  });

  it('AC(c): an invalid key path throws a UsageError (exit 2), leaving the file unchanged and making no commit', async () => {
    const before = head(repo);
    const beforeText = dnaText(repo);

    await expect(dnaSetFn()({ root: repo, positionals: ['..language', 'python'] })).rejects.toBeInstanceOf(
      UsageError,
    );
    try {
      await dnaSetFn()({ root: repo, positionals: ['..language', 'python'] });
      throw new Error('expected a UsageError');
    } catch (error) {
      expect(error).toBeInstanceOf(UsageError);
      expect((error as UsageError).message).toBe("invalid key path: '..language'");
      expect((error as UsageError).exitCode).toBe(2);
    }

    expect(head(repo)).toBe(before);
    expect(dnaText(repo)).toBe(beforeText);
  });

  it('a value that fails the DnaYaml schema is a logic error (CoreResult.error VALIDATION -> exit 1), file unchanged', async () => {
    const before = head(repo);
    const beforeText = dnaText(repo);

    // `version` must be a positive number; a non-numeric string re-parses as a string and fails Zod.
    const result = await dnaSetFn()({ root: repo, positionals: ['version', 'not-a-number'] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
    expect(exitCodeForResult(result)).toBe(1);

    expect(head(repo)).toBe(before);
    expect(dnaText(repo)).toBe(beforeText);
  });

  it('a missing value is a usage error (exit 2), file unchanged', async () => {
    const beforeText = dnaText(repo);
    await expect(dnaSetFn()({ root: repo, positionals: ['tech_stack.language'] })).rejects.toBeInstanceOf(
      UsageError,
    );
    expect(dnaText(repo)).toBe(beforeText);
  });
});

describe('CORE_MODULES dna.dnaSet — REQ-SEC-01 git-identity pre-flight (no configured identity)', () => {
  const ISOLATION_KEYS = ['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM', 'GIT_CONFIG_NOSYSTEM'] as const;
  let repo: string;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'wf-dnaset-noid-'));
    execFileSync('git', ['-C', repo, 'init', '-q', '--initial-branch=main'], { encoding: 'utf-8' });
    const emptyConfig = join(repo, 'empty.gitconfig');
    writeFileSync(emptyConfig, '');
    for (const key of ISOLATION_KEYS) saved[key] = process.env[key];
    process.env.GIT_CONFIG_GLOBAL = emptyConfig;
    process.env.GIT_CONFIG_SYSTEM = emptyConfig;
    process.env.GIT_CONFIG_NOSYSTEM = '1';
    writeFixtureFile(repo, '.wingfoil/dna.yaml', DNA_FIXTURE);
  });

  afterEach(() => {
    for (const key of ISOLATION_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    rmSync(repo, { recursive: true, force: true });
  });

  it('refuses with the exact REQ-SEC-01 message (CoreResult.error VALIDATION -> exit 1), writing nothing', async () => {
    const beforeText = dnaText(repo);
    const result = await dnaSetFn()({ root: repo, positionals: ['stacks.language', 'python'] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
    expect(result.error.message).toBe('git identity not configured (user.name/user.email)');
    expect(exitCodeForResult(result)).toBe(1);
    expect(dnaText(repo)).toBe(beforeText);
  });
});
