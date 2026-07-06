/**
 * task-015-complete-audit-trail (REQ-SEC-02) — the audit/verification layer built on top of
 * task-011's `getMemoryHistory` git-log walk: attribution auditing, Approver/Reason parsing, full
 * transition reconstruction, and the frontmatter-vs-commit-message consistency check. See
 * `src/memory/audit.ts`'s module doc for how each piece maps to REQ-SEC-02's fit criterion.
 */
import {
  auditAttribution,
  isValidAttribution,
  parseApprovalMetadata,
  reconstructMemoryTransitions,
  verifyTransitionConsistency,
} from '../../src/memory/audit';
import { isConfiguredIdentity } from '../../src/core/git-identity';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  commitAll,
  commitAllAs,
  makeTempGitRepo,
  removeTempDir,
  writeFixtureFile,
} from '../storage/helpers/git-fixture';

const DOC_PATH = 'docs/04_memory/v0.1/task-901-doc.md';
const OTHER_DOC_PATH = 'docs/04_memory/v0.1/task-902-doc.md';

function writeDoc(repo: string, path: string, status: string): void {
  writeFixtureFile(
    repo,
    path,
    ['---', `id: ${path}`, `status: ${status}`, '---', '', 'Body.', ''].join('\n'),
  );
}

describe('isValidAttribution — pure predicate, no git involved', () => {
  it('accepts a fully-configured, non-placeholder name + email', () => {
    expect(isValidAttribution('Roberto Pompermaier', 'robypomper@gmail.com')).toBe(true);
  });

  it('rejects an empty name', () => {
    expect(isValidAttribution('', 'a@b.com')).toBe(false);
  });

  it('rejects an empty email', () => {
    expect(isValidAttribution('Someone', '')).toBe(false);
  });

  it('rejects a whitespace-only name/email', () => {
    expect(isValidAttribution('   ', '  ')).toBe(false);
  });

  it('rejects an email with no "@"', () => {
    expect(isValidAttribution('Someone', 'not-an-email')).toBe(false);
  });

  it('rejects git\'s own guessed-identity domain marker "user@host.(none)"', () => {
    expect(isValidAttribution('root', 'root@buildhost.(none)')).toBe(false);
  });
});

describe('isValidAttribution reconciled with isConfiguredIdentity (task-014 ↔ task-015, REQ-SEC-01/REQ-SEC-02)', () => {
  it('agrees with the shared isConfiguredIdentity base rule for a real, non-".(none)" identity', () => {
    const name = 'Roberto Pompermaier';
    const email = 'robypomper@gmail.com';
    expect(isConfiguredIdentity(name, email)).toBe(true);
    expect(isValidAttribution(name, email)).toBe(isConfiguredIdentity(name, email));
  });

  it('agrees with the shared isConfiguredIdentity base rule when both name and email are empty', () => {
    expect(isConfiguredIdentity('', '')).toBe(false);
    expect(isValidAttribution('', '')).toBe(isConfiguredIdentity('', ''));
  });

  it('is strictly narrower than isConfiguredIdentity only on the git-guessed ".(none)" case: same non-empty base, audit-only rejection layered on top', () => {
    const name = 'root';
    const email = 'root@buildhost.(none)';
    // The shared base rule (task-014) considers this a "configured" identity — both fields are
    // non-empty — because requireGitIdentity only ever checks *live* config, which git itself never
    // populates with a ".(none)" marker going forward.
    expect(isConfiguredIdentity(name, email)).toBe(true);
    // The historical audit (task-015) is stricter: it additionally rejects git's own guessed-domain
    // marker, which can only appear in commits made before task-014's write-time guard existed.
    expect(isValidAttribution(name, email)).toBe(false);
  });
});

describe('auditAttribution — git-log walk with a 0-"unknown author" attribution check', () => {
  let repo: string;

  afterEach(() => removeTempDir(repo));

  it('reports every commit as valid when every commit has a real configured identity', () => {
    repo = makeTempGitRepo();
    writeDoc(repo, DOC_PATH, 'draft');
    commitAll(repo, 'wf(task): add task-901-doc');
    writeDoc(repo, DOC_PATH, 'pending');
    commitAll(repo, 'wf(task): submit task-901-doc');

    const entries = auditAttribution(repo, [DOC_PATH]);

    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.valid)).toBe(true);
    expect(entries.filter((e) => !e.valid)).toHaveLength(0);
  });

  it('flags a commit with a git-guessed placeholder identity as invalid ("unknown author")', () => {
    repo = makeTempGitRepo();
    writeDoc(repo, DOC_PATH, 'draft');
    commitAll(repo, 'wf(task): add task-901-doc');
    writeDoc(repo, DOC_PATH, 'pending');
    commitAllAs(repo, 'wf(task): submit task-901-doc', { name: 'root', email: 'root@buildhost.(none)' });

    const entries = auditAttribution(repo, [DOC_PATH]);

    expect(entries).toHaveLength(2);
    const invalid = entries.filter((e) => !e.valid);
    expect(invalid).toHaveLength(1);
    expect(invalid[0]?.subject).toBe('wf(task): submit task-901-doc');
  });

  it('merges multiple pathspecs without duplicating a commit that touches more than one', () => {
    repo = makeTempGitRepo();
    writeDoc(repo, DOC_PATH, 'draft');
    writeDoc(repo, OTHER_DOC_PATH, 'draft');
    commitAll(repo, 'wf(task): add task-901-doc, task-902-doc');

    const entries = auditAttribution(repo, [DOC_PATH, OTHER_DOC_PATH]);

    expect(entries).toHaveLength(1);
  });

  it('is deterministic — repeated calls over unchanged state produce the exact same result', () => {
    repo = makeTempGitRepo();
    writeDoc(repo, DOC_PATH, 'draft');
    commitAll(repo, 'wf(task): add task-901-doc');
    writeDoc(repo, DOC_PATH, 'pending');
    commitAll(repo, 'wf(task): submit task-901-doc');

    const first = auditAttribution(repo, [DOC_PATH]);
    const second = auditAttribution(repo, [DOC_PATH]);
    expect(second).toEqual(first);
  });

  it('returns [] over a pathspec with no history at all', () => {
    repo = makeTempGitRepo();
    writeDoc(repo, DOC_PATH, 'draft');
    commitAll(repo, 'wf(task): add task-901-doc');

    expect(auditAttribution(repo, ['docs/04_memory/v0.1/does-not-exist.md'])).toEqual([]);
  });

  it('returns [] (never throws) when `root` is not a git repository at all', () => {
    repo = mkdtempSync(join(tmpdir(), 'wf-not-a-repo-'));
    writeDoc(repo, DOC_PATH, 'draft'); // plain file write, no `git init`
    expect(auditAttribution(repo, [DOC_PATH])).toEqual([]);
  });
});

describe('parseApprovalMetadata — Approver:/Reason: commit-body parsing (CLAUDE.md §5.1)', () => {
  it('parses a well-formed approve commit body', () => {
    const body =
      'Approver: Roberto Pompermaier <robypomper@gmail.com> (approver)\nReason: meets standards';
    expect(parseApprovalMetadata(body)).toEqual({
      approverName: 'Roberto Pompermaier',
      approverEmail: 'robypomper@gmail.com',
      approverRole: 'approver',
      reason: 'meets standards',
    });
  });

  it('returns null when the body has no Approver: line', () => {
    expect(parseApprovalMetadata('Reason: meets standards')).toBeNull();
  });

  it('returns null when the body has no Reason: line', () => {
    expect(
      parseApprovalMetadata('Approver: Roberto Pompermaier <robypomper@gmail.com> (approver)'),
    ).toBeNull();
  });

  it('returns null for a plain add/submit body with no Approver/Reason lines at all', () => {
    expect(parseApprovalMetadata('')).toBeNull();
  });
});

describe('reconstructMemoryTransitions — full history reconstructed from git log + frontmatter (ADR-007)', () => {
  let repo: string;

  afterEach(() => removeTempDir(repo));

  it('reconstructs add -> submit -> approve with fromState/toState and approval metadata', () => {
    repo = makeTempGitRepo();
    writeDoc(repo, DOC_PATH, 'draft');
    commitAll(repo, 'wf(task): add task-901-doc');
    writeDoc(repo, DOC_PATH, 'pending');
    commitAll(repo, 'wf(task): submit task-901-doc');
    writeDoc(repo, DOC_PATH, 'backlog');
    commitAll(
      repo,
      'wf(task): approve task-901-doc [pending → backlog]\n\nApprover: Roberto Pompermaier <robypomper@gmail.com> (approver)\nReason: looks good',
    );

    const transitions = reconstructMemoryTransitions(repo, DOC_PATH);

    expect(transitions).toHaveLength(3);

    expect(transitions[0]).toMatchObject({ operation: 'add', fromState: null, toState: 'draft', approval: null });
    expect(transitions[1]).toMatchObject({
      operation: 'submit',
      fromState: 'draft',
      toState: 'pending',
      approval: null,
    });
    expect(transitions[2]).toMatchObject({
      operation: 'approve',
      fromState: 'pending',
      toState: 'backlog',
      approval: {
        approverName: 'Roberto Pompermaier',
        approverEmail: 'robypomper@gmail.com',
        approverRole: 'approver',
        reason: 'looks good',
      },
    });
    for (const t of transitions) {
      expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(t.authorName).toBe('WingFoil Test');
    }
  });

  it('reconstructs a reject transition with its Approver/Reason', () => {
    repo = makeTempGitRepo();
    writeDoc(repo, DOC_PATH, 'draft');
    commitAll(repo, 'wf(task): add task-901-doc');
    writeDoc(repo, DOC_PATH, 'pending');
    commitAll(repo, 'wf(task): submit task-901-doc');
    writeDoc(repo, DOC_PATH, 'draft');
    commitAll(
      repo,
      'wf(task): reject task-901-doc [pending → draft]\n\nApprover: Roberto Pompermaier <robypomper@gmail.com> (approver)\nReason: tests missing',
    );

    const transitions = reconstructMemoryTransitions(repo, DOC_PATH);

    expect(transitions[2]).toMatchObject({
      operation: 'reject',
      fromState: 'pending',
      toState: 'draft',
      approval: { reason: 'tests missing' },
    });
  });

  it('returns exactly 1 entry for a document created and never touched again (creation event)', () => {
    repo = makeTempGitRepo();
    writeDoc(repo, DOC_PATH, 'draft');
    commitAll(repo, 'wf(task): add task-901-doc');

    const transitions = reconstructMemoryTransitions(repo, DOC_PATH);
    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toMatchObject({ operation: 'add', fromState: null, toState: 'draft' });
  });

  it('is deterministic — repeated calls over unchanged state produce the exact same result', () => {
    repo = makeTempGitRepo();
    writeDoc(repo, DOC_PATH, 'draft');
    commitAll(repo, 'wf(task): add task-901-doc');
    writeDoc(repo, DOC_PATH, 'pending');
    commitAll(repo, 'wf(task): submit task-901-doc');

    const first = reconstructMemoryTransitions(repo, DOC_PATH);
    const second = reconstructMemoryTransitions(repo, DOC_PATH);
    expect(second).toEqual(first);
  });

  it('yields toState null for a commit where the path no longer exists (e.g. deprecate-and-remove)', () => {
    repo = makeTempGitRepo();
    writeDoc(repo, DOC_PATH, 'draft');
    commitAll(repo, 'wf(task): add task-901-doc');
    rmSync(join(repo, DOC_PATH));
    commitAll(repo, 'wf(task): deprecate task-901-doc [draft → deprecated]');

    const transitions = reconstructMemoryTransitions(repo, DOC_PATH);

    expect(transitions).toHaveLength(2);
    expect(transitions[1]).toMatchObject({ fromState: 'draft', toState: null });
  });
});

describe('verifyTransitionConsistency — frontmatter-derived state agrees with the commit-message bracket (no drift)', () => {
  let repo: string;

  afterEach(() => removeTempDir(repo));

  it('reports no mismatches for a well-formed add/submit/approve sequence', () => {
    repo = makeTempGitRepo();
    writeDoc(repo, DOC_PATH, 'draft');
    commitAll(repo, 'wf(task): add task-901-doc');
    writeDoc(repo, DOC_PATH, 'pending');
    commitAll(repo, 'wf(task): submit task-901-doc');
    writeDoc(repo, DOC_PATH, 'backlog');
    commitAll(
      repo,
      'wf(task): approve task-901-doc [pending → backlog]\n\nApprover: Roberto Pompermaier <robypomper@gmail.com> (approver)\nReason: looks good',
    );

    expect(verifyTransitionConsistency(repo, DOC_PATH)).toEqual([]);
  });

  it('detects drift when the commit-message bracket disagrees with the frontmatter status actually written', () => {
    repo = makeTempGitRepo();
    writeDoc(repo, DOC_PATH, 'draft');
    commitAll(repo, 'wf(task): add task-901-doc');
    writeDoc(repo, DOC_PATH, 'pending');
    commitAll(repo, 'wf(task): submit task-901-doc');
    // Bug scenario: subject claims "pending -> backlog" but the frontmatter actually committed is
    // "approved" — the two views disagree.
    writeDoc(repo, DOC_PATH, 'approved');
    commitAll(
      repo,
      'wf(task): approve task-901-doc [pending → backlog]\n\nApprover: Roberto Pompermaier <robypomper@gmail.com> (approver)\nReason: looks good',
    );

    const mismatches = verifyTransitionConsistency(repo, DOC_PATH);

    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatchObject({
      declared: { from: 'pending', to: 'backlog' },
      derived: { from: 'pending', to: 'approved' },
    });
  });
});
