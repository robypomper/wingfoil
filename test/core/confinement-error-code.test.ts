/**
 * One confinement rule, one `CoreError.code` (task-130 AC3, `bug-123`; `spec-005` §3).
 *
 * REQ-SEC-06's refusal reached a caller as `IO` from `memory add` — `memoryAddFn` mapped every
 * `StorageError` that way, including the confinement ones `resolveConfinedMemoryPath` throws — and as
 * `VALIDATION` from the transition verbs, whose guard (`requireConfinedWriteTarget`) returns that code.
 * The chosen code is `VALIDATION`: the request named a target the rule forbids, which is what
 * happened, whereas `IO` named only the layer that detected it. `directive remove`'s confinement
 * refusal (`requireConfinedTarget`) was already `VALIDATION` too, so the choice moves one site, not
 * three.
 *
 * Both of the rule's refusals are covered — a path that resolves outside the project root, and (on
 * the write path) a target that is itself a symlink — for `memory add` and for every verb that writes
 * through `commitMemoryTransition`: the four of AC3 plus `amend` (task-127), which shares the guard.
 * 2 refusals × 6 verbs = 12 cases.
 *
 * The outside directory is a SECOND `mkdtemp`, so a wrong boundary writes only into a temp dir.
 */
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CORE_MODULES } from '../../src/core';
import type { CoreFn } from '../../src/core/registry';
import type { CoreResult } from '../../src/core/types';
import { commitAll, makeTempGitRepo, removeTempDir, writeFixtureFile } from '../storage/helpers/git-fixture';

const TYPE_DIR = 'docs/memory/note';
const CONFINEMENT_CODE = 'VALIDATION';

const MEMORY_YAML = `version: 1
defaults:
  states:
    sequence: [draft, pending, approved]
    gates:
      pending: { reject: draft }
types:
  note:
    path: "${TYPE_DIR}/{id}.md"
    id_pattern: "note-{slug}"
    amendable: true
    template:
      file: "memory/templates/note.md"
      frontmatter:
        required: [id, type, title, status]
`;

const NOTE_TEMPLATE = `---
id: ""
type: note
title: ""
status: draft
---

<!-- note body -->
`;

/** `dna.yaml` in which the fixture's own git identity holds `approver` (REQ-SEC-03 happy path). */
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
    - name: WingFoil Test
      email: wf-test@example.invalid
      roles: [ approver, developer ]
  roles:
    - name: approver
    - name: developer
paths:
  sources: [ src/ ]
`;

function noteDoc(status: string): string {
  return `---
id: "note-planted"
type: note
title: "A planted note"
status: ${status}
---

## Body

Real content.
`;
}

function memoryFn(operationName: string): CoreFn<unknown, unknown> {
  const operation = CORE_MODULES.find((module) => module.name === 'memory')?.operations[operationName];
  if (!operation) throw new Error(`fixture bug: "${operationName}" operation not registered on the memory module`);
  return operation.fn;
}

/** The error a call refused with — fails the test if the call succeeded or threw. */
async function refusal(operation: string, params: Record<string, unknown>): Promise<{ code: string; message: string }> {
  const result = (await memoryFn(operation)(params)) as CoreResult<unknown>;
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('unreachable');
  return result.error;
}

const TRANSITION_VERBS: readonly { operation: string; from: string; options?: Record<string, string> }[] = [
  { operation: 'memorySubmit', from: 'draft' },
  { operation: 'memoryApprove', from: 'pending', options: { reason: 'probe' } },
  { operation: 'memoryReject', from: 'pending', options: { reason: 'probe' } },
  { operation: 'memoryDeprecate', from: 'draft', options: { reason: 'probe' } },
  { operation: 'memoryAmend', from: 'approved', options: { reason: 'probe' } },
];

describe('AC3 — the confinement refusal has one CoreError.code on every Memory write verb (bug-123)', () => {
  let repo: string;
  let outside: string;

  beforeEach(() => {
    repo = makeTempGitRepo();
    outside = mkdtempSync(join(tmpdir(), 'wf-outside-'));
    writeFixtureFile(repo, '.wingfoil/memory.yaml', MEMORY_YAML);
    writeFixtureFile(repo, '.wingfoil/memory/templates/note.md', NOTE_TEMPLATE);
    writeFixtureFile(repo, '.wingfoil/dna.yaml', APPROVER_DNA);
    commitAll(repo, 'seed memory.yaml + template + dna.yaml');
  });

  afterEach(() => {
    removeTempDir(repo);
    removeTempDir(outside);
  });

  describe("a path that resolves outside the project root (the type's store is a symlink out)", () => {
    beforeEach(() => {
      mkdirSync(join(repo, 'docs/memory'), { recursive: true });
      symlinkSync(outside, join(repo, TYPE_DIR));
      commitAll(repo, 'fixture: alias the note store at a directory outside the project');
    });

    it(`memory add refuses with ${CONFINEMENT_CODE}`, async () => {
      const error = await refusal('memoryAdd', { root: repo, options: { type: 'note', title: 'escape probe' } });
      expect(error.message).toContain('outside the project root');
      expect(error.code).toBe(CONFINEMENT_CODE);
    });

    it.each(TRANSITION_VERBS)(`$operation refuses with ${CONFINEMENT_CODE}`, async ({ operation, from, options }) => {
      writeFileSync(join(outside, 'note-planted.md'), noteDoc(from), 'utf-8');
      const error = await refusal(operation, { root: repo, positional: 'note-planted', ...(options ? { options } : {}) });
      expect(error.message).toContain('outside the project root');
      expect(error.code).toBe(CONFINEMENT_CODE);
    });
  });

  describe('a write target that is itself a symlink (inside a real, in-project store)', () => {
    beforeEach(() => {
      mkdirSync(join(repo, TYPE_DIR), { recursive: true });
    });

    it(`memory add refuses with ${CONFINEMENT_CODE}`, async () => {
      symlinkSync(join(outside, 'leaked.md'), join(repo, TYPE_DIR, 'note-escape-probe.md'));
      const error = await refusal('memoryAdd', { root: repo, options: { type: 'note', title: 'escape probe' } });
      expect(error.message).toContain('symbolic link');
      expect(error.code).toBe(CONFINEMENT_CODE);
    });

    // The link is committed (mode 120000), as `bug-120` D2 plants it, so the verb finds the document.
    it.each(TRANSITION_VERBS)(`$operation refuses with ${CONFINEMENT_CODE}`, async ({ operation, from, options }) => {
      const target = join(outside, 'leafy.md');
      writeFileSync(target, noteDoc(from), 'utf-8');
      symlinkSync(target, join(repo, TYPE_DIR, 'note-planted.md'));
      commitAll(repo, 'fixture: link one note at a document outside the project');
      const error = await refusal(operation, { root: repo, positional: 'note-planted', ...(options ? { options } : {}) });
      expect(error.message).toContain('symbolic link');
      expect(error.code).toBe(CONFINEMENT_CODE);
    });
  });
});
