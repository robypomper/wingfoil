/**
 * The comment-preserving structural edit (`src/dna/edit.ts`, task-093) — the sequence-aware sibling of
 * `setDnaValueInText` (`task-063`, `bug-004-dna-set-strips-yaml-comments`).
 *
 * `setDnaValueInText` rewrites or inserts exactly one **mapping** line and deliberately skips every
 * sequence branch, so it can express none of the shapes `dl-081`'s verbs write. Its fallback — a
 * whole-file `dump()` — is correct but strips every comment, including the inline `[SPEC]`/`[AUTHORING]`
 * field-provenance annotations `bug-004` exists to protect. That fallback is rare for `dna set` and
 * would be the NORM for `dna add`, so the structural edit is part of the mutation surface rather than a
 * follow-up to it.
 *
 * Same safety contract as `setDnaValueInText`: every candidate edit is verified by re-parsing it and
 * comparing the WHOLE document against the intended object, and anything it cannot do provably-minimally
 * returns `undefined` for the caller to fall back on.
 */
import { load } from 'js-yaml';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { applyDnaEditInText } from '../../src/dna/edit';
import { applyDnaMutation, type DnaMutationRequest } from '../../src/dna/mutate';

/** Run a mutation through the text editor, returning the edited text (or `undefined` for "no minimal edit"). */
function edit(text: string, request: DnaMutationRequest): string | undefined {
  const document = load(text) as Record<string, unknown>;
  const applied = applyDnaMutation(document, request);
  if (!applied.ok) throw new Error(`fixture bug: the mutation was refused — ${applied.message}`);
  return applyDnaEditInText(text, applied.edit, applied.dna);
}

/** Run a mutation through the editor and fail loudly if it declined to produce a minimal edit. */
function edited(text: string, request: DnaMutationRequest): string {
  const result = edit(text, request);
  if (result === undefined) throw new Error('expected a minimal in-place edit, got undefined (the dump() fallback)');
  return result;
}

const BLOCK = `# top comment
version: 1                       # [AUTHORING] format version

# Modules — the parts of the system   [SPEC: P2.4]
modules:
  - name: core
    description: Shared domain logic.
    path: src/core
  - name: dna
    path: src/dna

team:
  members:
    - name: roberto
      email: r@example.it
      roles: [ approver, developer ]
  roles:
    - name: approver
    - name: developer

# Resource paths
paths:
  sources:
    - src/
  tests: []
`;

describe('append to a sequence — the flow `dna add` runs on every fresh project', () => {
  it('appends an object entry to a block sequence, leaving every comment byte-for-byte', () => {
    const result = edited(BLOCK, { verb: 'add', field: 'modules', value: 'cli', fields: { path: 'src/cli' } });
    expect(result).toContain('# Modules — the parts of the system   [SPEC: P2.4]');
    expect(result).toContain('# [AUTHORING] format version');
    expect(result).toContain('  - name: cli\n    path: src/cli\n');
    expect((load(result) as { modules: unknown[] }).modules).toHaveLength(3);
  });

  it('appends a value to a FLOW sequence of strings, in place on its own line', () => {
    const result = edited(BLOCK, { verb: 'add', field: 'team.members.roberto.roles', value: 'qa' });
    expect(result).toContain('roles: [ approver, developer, qa ]');
  });

  it('appends a value to a BLOCK sequence of strings, at the items\' own indentation', () => {
    const result = edited(BLOCK, { verb: 'add', field: 'paths.sources', value: 'lib/' });
    expect(result).toContain('  sources:\n    - src/\n    - lib/\n');
  });

  it('turns an empty `[]` into a block sequence when the first item is added', () => {
    const result = edited(BLOCK, { verb: 'add', field: 'paths.tests', value: 'test/' });
    expect(result).toContain('  tests:\n    - test/\n');
    expect((load(result) as { paths: { tests: string[] } }).paths.tests).toEqual(['test/']);
  });
});

describe('remove from a sequence', () => {
  it('removes an object entry and only its own lines', () => {
    const result = edited(BLOCK, { verb: 'remove', field: 'modules', value: 'core' });
    expect(result).toContain('# Modules — the parts of the system   [SPEC: P2.4]');
    expect(result).not.toContain('Shared domain logic');
    expect(result).toContain('  - name: dna\n    path: src/dna\n');
  });

  it('removes a value from a flow sequence', () => {
    const result = edited(BLOCK, { verb: 'remove', field: 'team.members.roberto.roles', value: 'developer' });
    expect(result).toContain('roles: [ approver ]');
  });

  it('removes a value from a block sequence', () => {
    const result = edited(BLOCK, { verb: 'remove', field: 'paths.sources', value: 'src/' });
    expect((load(result) as { paths: { sources: unknown[] } }).paths.sources).toEqual([]);
  });
});

describe('update and delete a scalar, including inside a sequence entry', () => {
  it("rewrites a scalar inside an entry addressed by the entry's name", () => {
    const result = edited(BLOCK, { verb: 'update', field: 'modules.core.path', value: 'source/core' });
    expect(result).toContain('    path: source/core\n');
    expect(result).toContain('    description: Shared domain logic.\n');
  });

  it('adds a scalar an entry did not carry, inside that entry', () => {
    const result = edited(BLOCK, { verb: 'update', field: 'modules.dna', fields: { description: 'DNA pillar.' } });
    expect((load(result) as { modules: Array<Record<string, unknown>> }).modules[1]).toEqual({
      name: 'dna',
      path: 'src/dna',
      description: 'DNA pillar.',
    });
  });

  it('deletes an optional scalar from inside an entry', () => {
    const result = edited(BLOCK, { verb: 'remove', field: 'team.members.roberto.email' });
    expect(result).not.toContain('r@example.it');
    expect(result).toContain('    - name: roberto\n');
  });

  it('replaces a whole flow list', () => {
    const result = edited(BLOCK, { verb: 'update', field: 'team.members.roberto.roles', value: 'qa,reviewer' });
    expect((load(result) as { team: { members: Array<{ roles: string[] }> } }).team.members[0]!.roles).toEqual([
      'qa',
      'reviewer',
    ]);
  });
});

describe("WingFoil's own dna.yaml survives a round trip with its provenance annotations intact", () => {
  const path = join(__dirname, '..', '..', 'docs', 'self', '.wingfoil', 'dna.yaml');
  const text = readFileSync(path, 'utf-8');

  /** Every comment line in a document, trimmed — the thing `bug-004` exists to keep. */
  function comments(source: string): string[] {
    return source.split('\n').map((line) => line.trim()).filter((line) => line.startsWith('#'));
  }

  it.each<[string, DnaMutationRequest]>([
    ['add a module', { verb: 'add', field: 'modules', value: 'scratch', fields: { path: 'src/scratch' } }],
    ['add a role to the catalogue', { verb: 'add', field: 'team.roles', value: 'scribe' }],
    ['add a path', { verb: 'add', field: 'paths.sources', value: 'lib/' }],
    ['add a role to a member', { verb: 'add', field: 'team.members.Roberto Pompermaier.roles', value: 'scribe' }],
    ['update a technology', { verb: 'update', field: 'stacks.technologies.TypeScript', fields: { version: '5.9' } }],
    ['remove a module', { verb: 'remove', field: 'modules', value: 'validation' }],
  ])('%s — every comment line is still present', (_name, request) => {
    const result = edited(text, request);
    expect(comments(result)).toEqual(comments(text));
  });
});

describe('the safety contract: verified, or `undefined` for the caller to fall back on', () => {
  it('declines (returns undefined) when the target key is absent from the text entirely', () => {
    const text = 'version: 1\nmodules: []\nstacks: {}\nteam:\n  members: []\n  roles: []\npaths: {}\n';
    expect(edit(text, { verb: 'add', field: 'paths.sources', value: 'src/' })).toBeUndefined();
  });

  it('declines rather than guessing when the document does not parse as a single YAML document', () => {
    const document = load(BLOCK) as Record<string, unknown>;
    const applied = applyDnaMutation(document, { verb: 'add', field: 'paths.sources', value: 'lib/' });
    if (!applied.ok) throw new Error('fixture bug');
    expect(applyDnaEditInText('{{ not yaml', applied.edit, applied.dna)).toBeUndefined();
  });

  it('never returns text that parses to anything but the intended document', () => {
    const document = load(BLOCK) as Record<string, unknown>;
    const applied = applyDnaMutation(document, { verb: 'add', field: 'modules', value: 'cli', fields: { path: 'src/cli' } });
    if (!applied.ok) throw new Error('fixture bug');
    const result = applyDnaEditInText(BLOCK, applied.edit, applied.dna);
    expect(result).toBeDefined();
    expect(load(result!)).toEqual(applied.dna);
  });

  it('is a pure function of its inputs — same answer, and the input text is never mutated (REQ-SYS-07)', () => {
    const first = edited(BLOCK, { verb: 'add', field: 'modules', value: 'cli', fields: { path: 'src/cli' } });
    const second = edited(BLOCK, { verb: 'add', field: 'modules', value: 'cli', fields: { path: 'src/cli' } });
    expect(first).toBe(second);
  });
});
