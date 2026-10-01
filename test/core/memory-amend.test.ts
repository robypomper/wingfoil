/**
 * task-127-add-memory-amend-id-reason-approver-gated-verb — `wingfoil memory amend <id> --reason`,
 * the approver-gated verb that records a content correction without a state change (`dl-108` A1 (a),
 * A2 (i), A3; `spec-008-cli-grammar` §2's `amend` row, `[s → s]`; `spec-010` § Field-write ownership;
 * `spec-001`'s per-type `amendable` key).
 *
 * Exercises the REAL, registered `CORE_MODULES` `memory.memoryAmend` operation — the exact `CoreFn`
 * the CLI command and the MCP Tool dispatch to. Every write lands in a THROWAWAY temp git repo.
 *
 * The fixture's `tech-spec` and `adr` carry this repository's own machines (`.wingfoil/memory.yaml`);
 * `tech-spec` declares `amendable: true`, `adr` declares `amendable: false` (`dl-108` A3: a change to
 * an ADR's decision is a new element), and `note` declares nothing — absent means not amendable.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildProgram } from '../../src/cli/program';
import { CORE_MODULES } from '../../src/core';
import type { CoreFn } from '../../src/core/registry';
import { exitCodeForResult, exitCodeForThrow } from '../../src/core/exit-code';
import { UsageError } from '../../src/core/usage-error';
import { commitAll, makeTempGitRepo, removeTempDir, writeFixtureFile } from '../storage/helpers/git-fixture';

const MEMORY_YAML = `version: 1
types:
  tech-spec:
    path: "docs/memory/specs/{id}.md"
    amendable: true
    states:
      sequence: [draft, pending, approved, superseded]
      gates:
        pending: { reject: draft }
      waiting: [approved]
  adr:
    path: "docs/memory/adrs/{id}.md"
    amendable: false
    states:
      sequence: [draft, pending, accepted, superseded]
      gates:
        pending: { reject: draft }
      waiting: [accepted]
  note:
    path: "docs/memory/note/{id}.md"
`;

const TEST_EMAIL = 'wf-test@example.invalid';
const TEST_NAME = 'WingFoil Test';

const APPROVER_DNA = `version: 1.1
modules:
  - name: core
    path: src/core
stacks:
  technologies:
    - name: TypeScript
      category: language
team:
  members:
    - name: ${TEST_NAME}
      email: ${TEST_EMAIL}
      roles: [ approver, developer ]
  roles:
    - name: approver
    - name: developer
    - name: reviewer
paths:
  sources: [ src/ ]
`;

const REVIEWER_ONLY_DNA = APPROVER_DNA.replace('roles: [ approver, developer ]', 'roles: [ reviewer, developer ]');

const SPEC = 'docs/memory/specs/spec-001.md';
const ADR = 'docs/memory/adrs/adr-001.md';
const NOTE = 'docs/memory/note/note-1.md';

function doc(fields: { id: string; type: string; status: string; title?: string }, body = 'Original body.\n'): string {
  return `---
id: "${fields.id}"
type: ${fields.type}
title: "${fields.title ?? 'A title'}"
status: ${fields.status}          # auto-set by wingfoil
tmpl_version: 260703
---

## Specification

${body}`;
}

interface AmendValue {
  readonly id: string;
  readonly path: string;
  readonly from: string;
  readonly to: string;
}

interface HistoryEntry {
  readonly operation: string | null;
  readonly from: string | null;
  readonly to: string | null;
  readonly approver: string | null;
  readonly reason: string | null;
  readonly subject: string;
}

function operationFn<T>(name: string): CoreFn<unknown, T> {
  const operation = CORE_MODULES.find((module) => module.name === 'memory')?.operations[name];
  if (!operation) throw new Error(`"${name}" is not registered on the memory module`);
  return operation.fn as CoreFn<unknown, T>;
}
const amend = (): CoreFn<unknown, AmendValue> => operationFn<AmendValue>('memoryAmend');
const history = (): CoreFn<unknown, { entries: readonly HistoryEntry[] }> =>
  operationFn<{ entries: readonly HistoryEntry[] }>('memoryHistory');

function gitOut(repo: string, args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf-8' }).trim();
}
const head = (repo: string): string => gitOut(repo, ['rev-parse', 'HEAD']);
const read = (repo: string, path: string): string => readFileSync(join(repo, path), 'utf-8');

describe('CORE_MODULES memory.memoryAmend — task-127 (dl-108)', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeTempGitRepo();
    writeFixtureFile(repo, '.wingfoil/memory.yaml', MEMORY_YAML);
    writeFixtureFile(repo, '.wingfoil/dna.yaml', APPROVER_DNA);
    writeFixtureFile(repo, SPEC, doc({ id: 'spec-001', type: 'tech-spec', status: 'approved' }));
    writeFixtureFile(repo, ADR, doc({ id: 'adr-001', type: 'adr', status: 'accepted' }));
    writeFixtureFile(repo, NOTE, doc({ id: 'note-1', type: 'note', status: 'approved' }));
    writeFixtureFile(repo, 'src/other.ts', 'export const a = 1;\n');
    commitAll(repo, 'seed');
  });

  afterEach(() => removeTempDir(repo));

  /** Refusals must leave HEAD where it was and the author's working-tree edit untouched. */
  function expectNothingWritten(before: string, path: string, edited: string): void {
    expect(head(repo)).toBe(before);
    expect(read(repo, path)).toBe(edited);
  }

  describe('AC1 — an uncommitted edit on an approved tech-spec becomes one amend commit', () => {
    it('exits 0 and writes exactly one commit touching only that file, with the declared subject and body', async () => {
      const edited = doc({ id: 'spec-001', type: 'tech-spec', status: 'approved' }, 'Corrected body.\n');
      writeFixtureFile(repo, SPEC, edited);
      const before = head(repo);

      const result = await amend()({ root: repo, positional: 'spec-001', options: { reason: 'r' } });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(exitCodeForResult(result)).toBe(0);
      expect(result.value).toEqual({ id: 'spec-001', path: SPEC, from: 'approved', to: 'approved' });
      expect(gitOut(repo, ['rev-list', '--count', `${before}..HEAD`])).toBe('1');
      expect(gitOut(repo, ['show', '--name-only', '--format=', 'HEAD'])).toBe(SPEC);
      const message = gitOut(repo, ['log', '-1', '--format=%B']);
      expect(message).toBe(
        `wf(tech-spec): amend spec-001 [approved → approved]\n\nApprover: ${TEST_NAME} <${TEST_EMAIL}> (approver)\nReason: r`,
      );
      expect(result.commit).toEqual({ sha: head(repo), message });
      // The commit carries the author's bytes verbatim, and nothing is left behind for that file.
      expect(gitOut(repo, ['show', `HEAD:${SPEC}`]) + '\n').toBe(edited);
      expect(gitOut(repo, ['status', '--porcelain'])).toBe('');
    });

    it('may change a frontmatter field other than status (spec-010: amend owns the body and the non-status fields)', async () => {
      writeFixtureFile(repo, SPEC, doc({ id: 'spec-001', type: 'tech-spec', status: 'approved', title: 'Better title' }));
      const result = await amend()({ root: repo, positional: 'spec-001', options: { reason: 'fix the title' } });
      expect(result.ok).toBe(true);
      expect(gitOut(repo, ['show', `HEAD:${SPEC}`])).toContain('title: "Better title"');
    });

    it('bug-076: an unrelated modified file and an unrelated staged file are left out of the commit, and stay as they were', async () => {
      writeFixtureFile(repo, SPEC, doc({ id: 'spec-001', type: 'tech-spec', status: 'approved' }, 'Corrected body.\n'));
      writeFixtureFile(repo, 'src/other.ts', 'export const a = 2;\n');
      writeFixtureFile(repo, 'src/staged.ts', 'export const b = 1;\n');
      gitOut(repo, ['add', 'src/staged.ts']);

      const result = await amend()({ root: repo, positional: 'spec-001', options: { reason: 'r' } });

      expect(result.ok).toBe(true);
      expect(gitOut(repo, ['show', '--name-only', '--format=', 'HEAD'])).toBe(SPEC);
      expect(gitOut(repo, ['status', '--porcelain']).split('\n').sort()).toEqual([' M src/other.ts', 'A  src/staged.ts']);
    });
  });

  describe('AC2 — refusals, each before anything is written', () => {
    it('no content change → exit 1', async () => {
      const before = head(repo);
      const result = await amend()({ root: repo, positional: 'spec-001', options: { reason: 'r' } });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(exitCodeForResult(result)).toBe(1);
      expect(result.error.message).toBe(`nothing to amend: ${SPEC} carries no uncommitted change`);
      expect(head(repo)).toBe(before);
    });

    it('a working-tree edit that changes `status` → exit 1 naming the field', async () => {
      const edited = doc({ id: 'spec-001', type: 'tech-spec', status: 'superseded' }, 'Corrected body.\n');
      writeFixtureFile(repo, SPEC, edited);
      const before = head(repo);
      const result = await amend()({ root: repo, positional: 'spec-001', options: { reason: 'r' } });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(exitCodeForResult(result)).toBe(1);
      expect(result.error.message).toContain("frontmatter field 'status'");
      expectNothingWritten(before, SPEC, edited);
    });

    it('a working-tree edit that changes `id` → exit 1 naming the field (the element is renamed, not amended)', async () => {
      const edited = doc({ id: 'spec-002', type: 'tech-spec', status: 'approved' }, 'Corrected body.\n');
      writeFixtureFile(repo, SPEC, edited);
      const before = head(repo);
      const result = await amend()({ root: repo, positional: 'spec-002', options: { reason: 'r' } });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(exitCodeForResult(result)).toBe(1);
      expect(result.error.message).toContain("frontmatter field 'id'");
      expectNothingWritten(before, SPEC, edited);
    });

    it('a caller without approval authority → the same refusal `approve` gives (REQ-SEC-03)', async () => {
      writeFixtureFile(repo, '.wingfoil/dna.yaml', REVIEWER_ONLY_DNA);
      commitAll(repo, 'reviewer-only dna');
      const edited = doc({ id: 'spec-001', type: 'tech-spec', status: 'approved' }, 'Corrected body.\n');
      writeFixtureFile(repo, SPEC, edited);
      const before = head(repo);
      const result = await amend()({ root: repo, positional: 'spec-001', options: { reason: 'r' } });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(exitCodeForResult(result)).toBe(1);
      expect(result.error.message).toBe("user not authorized to approve type 'tech-spec'");
      expectNothingWritten(before, SPEC, edited);
    });

    it.each([
      ['adr', 'adr-001', ADR, 'declares amendable: false'],
      ['note', 'note-1', NOTE, 'does not declare amendable: true'],
    ])('a type whose memory.yaml entry does not declare itself amendable (%s) → exit 1', async (type, id, path, why) => {
      const status = type === 'adr' ? 'accepted' : 'approved';
      const edited = doc({ id, type, status }, 'Corrected body.\n');
      writeFixtureFile(repo, path, edited);
      const before = head(repo);
      const result = await amend()({ root: repo, positional: id, options: { reason: 'r' } });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(exitCodeForResult(result)).toBe(1);
      expect(result.error.message).toBe(`type '${type}' is not amendable: its memory.yaml entry ${why}`);
      expectNothingWritten(before, path, edited);
    });

    it('amendability is read from the committed memory.yaml, not the working tree (command-baseline)', async () => {
      writeFixtureFile(repo, '.wingfoil/memory.yaml', MEMORY_YAML.replace('amendable: false', 'amendable: true'));
      const edited = doc({ id: 'adr-001', type: 'adr', status: 'accepted' }, 'Corrected body.\n');
      writeFixtureFile(repo, ADR, edited);
      const before = head(repo);
      const result = await amend()({ root: repo, positional: 'adr-001', options: { reason: 'r' } });
      expect(result.ok).toBe(false);
      expectNothingWritten(before, ADR, edited);
    });

    it.each([
      [undefined, 'missing required argument: --reason'],
      [{}, 'missing required argument: --reason'],
      [{ reason: '   ' }, 'invalid flag value: --reason must not be blank'],
    ])('missing or blank `--reason` → exit 2 (dl-067), before anything is read', async (options, message) => {
      const edited = doc({ id: 'spec-001', type: 'tech-spec', status: 'approved' }, 'Corrected body.\n');
      writeFixtureFile(repo, SPEC, edited);
      const before = head(repo);
      let thrown: unknown;
      try {
        await amend()({ root: repo, positional: 'spec-001', options });
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(UsageError);
      expect(exitCodeForThrow(thrown)).toEqual({ reason: message, exitCode: 2 });
      expectNothingWritten(before, SPEC, edited);
    });

    it('a missing `<id>` → exit 2', async () => {
      await expect(amend()({ root: repo, options: { reason: 'r' } })).rejects.toBeInstanceOf(UsageError);
    });

    it('a document no commit contains → exit 1 (a new document is recorded by add and submit)', async () => {
      const path = 'docs/memory/specs/spec-009.md';
      const fresh = doc({ id: 'spec-009', type: 'tech-spec', status: 'approved' });
      writeFixtureFile(repo, path, fresh);
      const before = head(repo);
      const result = await amend()({ root: repo, positional: 'spec-009', options: { reason: 'r' } });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(exitCodeForResult(result)).toBe(1);
      expect(result.error.message).toContain(`${path} is not committed at HEAD`);
      expectNothingWritten(before, path, fresh);
    });
  });

  it('AC3 — `memory history` lists the amendment with operation "amend", its approver and its reason (P1.10)', async () => {
    writeFixtureFile(repo, SPEC, doc({ id: 'spec-001', type: 'tech-spec', status: 'approved' }, 'Corrected body.\n'));
    const amended = await amend()({ root: repo, positional: 'spec-001', options: { reason: 'later evidence corrected §2' } });
    expect(amended.ok).toBe(true);

    const result = await history()({ root: repo, positional: 'spec-001' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const entry = result.value.entries.find((candidate) => candidate.operation === 'amend');
    expect(entry).toMatchObject({
      operation: 'amend',
      from: 'approved',
      to: 'approved',
      approver: `${TEST_NAME} <${TEST_EMAIL}> (approver)`,
      reason: 'later evidence corrected §2',
      subject: 'wf(tech-spec): amend spec-001 [approved → approved]',
    });
  });
});

describe('AC4 — `wingfoil memory --help` lists amend', () => {
  it('the memory command has an `amend` subcommand taking <id> and --reason', async () => {
    const program = await buildProgram(CORE_MODULES, { resolveRoot: () => '/unused', buildParams: () => ({}) });
    const memory = program.commands.find((command) => command.name() === 'memory');
    expect(memory?.helpInformation()).toMatch(/^\s+amend\b/m);
    const amendCommand = memory?.commands.find((command) => command.name() === 'amend');
    expect(amendCommand?.helpInformation()).toContain('<id>');
    expect(amendCommand?.helpInformation()).toContain('--reason <text>');
  });
});
