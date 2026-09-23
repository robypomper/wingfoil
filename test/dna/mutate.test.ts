/**
 * The pure `add | remove | update` semantics over a parsed `dna.yaml`
 * (`src/dna/mutate.ts`, task-093) — `dl-081-dna-mutation-surface-shape` option (E) as ratified.
 *
 * `--value` carries two things by position (AC6): the new entry's **identity** when the path ends at a
 * collection, the new **value** when it ends at a leaf. Everything else about an entry travels in one
 * option per schema field.
 *
 * This module is pure: no git, no filesystem, no clock (REQ-SYS-07), and it never mutates the document
 * it is given — a refused mutation must leave the caller's object byte-identical, since `src/core`'s
 * verbs re-validate and commit only what comes back.
 */
import { z } from 'zod';

import { applyDnaMutation } from '../../src/dna/mutate';

function dna(): Record<string, unknown> {
  return {
    version: 1.1,
    project: { name: 'WingFoil', license: 'MIT' },
    modules: [{ name: 'core', path: 'src/core' }],
    stacks: { technologies: [{ name: 'TypeScript', category: 'language' }], methodologies: [] },
    team: {
      members: [{ name: 'roberto', email: 'r@example.it', roles: ['approver'] }],
      agents: [],
      roles: [{ name: 'approver' }, { name: 'developer' }],
    },
    paths: { sources: ['src/'], tests: ['test/'] },
  };
}

/** The mutated document, or a thrown assertion failure naming the refusal. */
function mutated(request: Parameters<typeof applyDnaMutation>[1], document = dna()): Record<string, unknown> {
  const result = applyDnaMutation(document, request);
  if (!result.ok) throw new Error(`expected the mutation to apply, got refusal: ${result.message}`);
  return result.dna;
}

/** The refusal message, or a thrown assertion failure (the mutation was expected to be refused). */
function refusal(request: Parameters<typeof applyDnaMutation>[1], document = dna()): string {
  const result = applyDnaMutation(document, request);
  if (result.ok) throw new Error('expected the mutation to be refused, but it applied');
  return result.message;
}

describe('add', () => {
  it('appends an entry to an object collection, taking its name from --value (AC5 shape 2)', () => {
    const result = mutated({ verb: 'add', field: 'modules', value: 'cli', fields: { path: 'src/cli' } });
    expect(result.modules).toEqual([
      { name: 'core', path: 'src/core' },
      { name: 'cli', path: 'src/cli' },
    ]);
  });

  it('writes an entry\'s keys in schema order, so the same call always renders the same bytes (REQ-SYS-07)', () => {
    const result = mutated({
      verb: 'add',
      field: 'team.members',
      value: 'ada',
      fields: { roles: 'developer', email: 'ada@example.it' },
    });
    const added = (result.team as { members: Array<Record<string, unknown>> }).members[1];
    expect(Object.keys(added!)).toEqual(['name', 'email', 'roles']);
    expect(added).toEqual({ name: 'ada', email: 'ada@example.it', roles: ['developer'] });
  });

  it('splits a string-list entry field on commas (the `directive assign --directive a,b` precedent)', () => {
    const result = mutated({
      verb: 'add',
      field: 'team.members',
      value: 'ada',
      fields: { roles: 'developer, approver' },
    });
    expect((result.team as { members: Array<Record<string, unknown>> }).members[1]!.roles).toEqual([
      'developer',
      'approver',
    ]);
  });

  it('appends to an array of strings at depth 2 (AC5 shape 1)', () => {
    const result = mutated({ verb: 'add', field: 'paths.sources', value: 'lib/' });
    expect((result.paths as Record<string, unknown>).sources).toEqual(['src/', 'lib/']);
  });

  it('appends to a string array nested inside an object array (AC5 shape 4 — dl-081\'s reason for name addressing)', () => {
    const result = mutated({ verb: 'add', field: 'team.members.roberto.roles', value: 'developer' });
    expect((result.team as { members: Array<Record<string, unknown>> }).members[0]!.roles).toEqual([
      'approver',
      'developer',
    ]);
  });

  it('creates a declared-but-absent list rather than refusing (the schema declares it; the document omits it)', () => {
    const document = dna();
    delete (document.paths as Record<string, unknown>).tests;
    const result = mutated({ verb: 'add', field: 'paths.tests', value: 'test/' }, document);
    expect((result.paths as Record<string, unknown>).tests).toEqual(['test/']);
  });

  it('refuses a duplicate entry name — uniqueness is the addressing prerequisite (AC4)', () => {
    expect(refusal({ verb: 'add', field: 'modules', value: 'core' })).toContain('core');
  });

  it('refuses a duplicate value in a list of strings', () => {
    expect(refusal({ verb: 'add', field: 'paths.sources', value: 'src/' })).toContain('src/');
  });

  it('refuses an entry that omits a field the schema requires, naming it', () => {
    const message = refusal({ verb: 'add', field: 'team.members', value: 'ada' });
    expect(message).toContain('roles');
  });

  it('refuses an option that is not a field of that collection\'s entry, naming the ones that are', () => {
    const message = refusal({ verb: 'add', field: 'modules', value: 'cli', fields: { email: 'x@y.z' } });
    expect(message).toContain('email');
    expect(message).toContain('modules');
  });

  it('refuses `add` at a scalar leaf and points at the verb that does apply', () => {
    expect(refusal({ verb: 'add', field: 'project.license', value: 'MIT' })).toMatch(/update|set/);
  });

  it('refuses `add` at a section, and at an existing entry, and points at the collection form', () => {
    expect(refusal({ verb: 'add', field: 'team', value: 'x' })).toContain('team');
    expect(refusal({ verb: 'add', field: 'modules.core', value: 'x' })).toContain('modules');
  });

  it('refuses a path the schema does not declare (bug-084, through the mutation surface)', () => {
    expect(refusal({ verb: 'add', field: 'tech_stack.cli', value: 'x' })).toContain('tech_stack');
  });
});

describe('remove', () => {
  it('removes an entry from an object collection, identified by --value', () => {
    const result = mutated({ verb: 'remove', field: 'modules', value: 'core' });
    expect(result.modules).toEqual([]);
  });

  it('removes one value from a list of strings, leaving the others in order', () => {
    const result = mutated({ verb: 'remove', field: 'paths.sources', value: 'src/' });
    expect((result.paths as Record<string, unknown>).sources).toEqual([]);
  });

  it('removes one role from one member (AC5 shape 4)', () => {
    const result = mutated({ verb: 'remove', field: 'team.members.roberto.roles', value: 'approver' });
    expect((result.team as { members: Array<Record<string, unknown>> }).members[0]!.roles).toEqual([]);
  });

  it('removes an OPTIONAL scalar field — `--value` is not needed to say which, the path already did', () => {
    const result = mutated({ verb: 'remove', field: 'team.members.roberto.email' });
    expect((result.team as { members: Array<Record<string, unknown>> }).members[0]).toEqual({
      name: 'roberto',
      roles: ['approver'],
    });
  });

  it('refuses to remove a scalar the schema requires', () => {
    expect(refusal({ verb: 'remove', field: 'modules.core.name' })).toContain('name');
    expect(refusal({ verb: 'remove', field: 'version' })).toContain('version');
  });

  it('refuses to remove an entry that is not there, naming it', () => {
    expect(refusal({ verb: 'remove', field: 'modules', value: 'nope' })).toContain('nope');
  });

  it('refuses to remove a value that is not in the list', () => {
    expect(refusal({ verb: 'remove', field: 'paths.sources', value: 'nope/' })).toContain('nope/');
  });

  it('removes several values from a list in one call, keeping the rest in order', () => {
    const document = dna();
    (document.paths as Record<string, string[]>).sources = ['src/', 'lib/', 'vendor/'];
    const result = mutated({ verb: 'remove', field: 'paths.sources', value: 'vendor/, src/' }, document);
    expect((result.paths as Record<string, unknown>).sources).toEqual(['lib/']);
  });

  it('refuses the whole multi-value removal when one of the values is not there — no partial write', () => {
    const document = dna();
    (document.paths as Record<string, string[]>).sources = ['src/', 'lib/'];
    expect(refusal({ verb: 'remove', field: 'paths.sources', value: 'src/,nope/' }, document)).toContain('nope/');
    expect((document.paths as Record<string, string[]>).sources).toEqual(['src/', 'lib/']);
  });

  it('removes an entry addressed by an entry-terminated path, without repeating it in --value', () => {
    const result = mutated({ verb: 'remove', field: 'modules.core' });
    expect(result.modules).toEqual([]);
  });

  it('refuses `remove` at a section', () => {
    expect(refusal({ verb: 'remove', field: 'team' })).toContain('team');
  });
});

describe('update', () => {
  it('sets a scalar leaf — `--value` is the new value when the path ends at a leaf (AC6)', () => {
    const result = mutated({ verb: 'update', field: 'project.license', value: 'Apache-2.0' });
    expect((result.project as Record<string, unknown>).license).toBe('Apache-2.0');
  });

  it('sets a scalar inside an entry, addressed by the entry\'s name (AC3)', () => {
    const result = mutated({ verb: 'update', field: 'modules.core.path', value: 'source/core' });
    expect(result.modules).toEqual([{ name: 'core', path: 'source/core' }]);
  });

  it('fills a declared-but-absent optional scalar', () => {
    const result = mutated({ verb: 'update', field: 'project.repository', value: 'WingFoil' });
    expect((result.project as Record<string, unknown>).repository).toBe('WingFoil');
  });

  it('creates a declared-but-absent optional SECTION on the way to a leaf it declares', () => {
    const document = dna();
    delete document.project;
    const result = mutated({ verb: 'update', field: 'project.name', value: 'WingFoil' }, document);
    expect(result.project).toEqual({ name: 'WingFoil' });
  });

  it('updates an entry\'s fields, with --value naming the entry (dl-081 option (E) synopsis)', () => {
    const result = mutated({
      verb: 'update',
      field: 'team.members',
      value: 'roberto',
      fields: { email: 'new@example.it' },
    });
    expect((result.team as { members: Array<Record<string, unknown>> }).members[0]).toEqual({
      name: 'roberto',
      email: 'new@example.it',
      roles: ['approver'],
    });
  });

  it('replaces a whole list of strings when the path ends at one', () => {
    const result = mutated({ verb: 'update', field: 'team.members.roberto.roles', value: 'developer,approver' });
    expect((result.team as { members: Array<Record<string, unknown>> }).members[0]!.roles).toEqual([
      'developer',
      'approver',
    ]);
  });

  it("updates an entry addressed by an entry-terminated path — the path already says which, so --value is not repeated", () => {
    const result = mutated({ verb: 'update', field: 'team.members.roberto', fields: { email: 'new@example.it' } });
    expect((result.team as { members: Array<Record<string, unknown>> }).members[0]!.email).toBe('new@example.it');
  });

  it('refuses an option that is not a field of the entry, through the entry-terminated path too', () => {
    expect(refusal({ verb: 'update', field: 'modules.core', fields: { email: 'x@y.z' } })).toContain('email');
  });

  it('refuses --value at an entry-terminated path, where it would say nothing the path has not said', () => {
    expect(refusal({ verb: 'update', field: 'team.members.roberto', value: 'roberto', fields: { email: 'x@y.z' } })).toMatch(
      /--value/,
    );
  });

  it('refuses an update at a collection that carries no field to change', () => {
    expect(refusal({ verb: 'update', field: 'team.members', value: 'roberto' })).toMatch(/--/);
  });

  it('refuses an update of an entry that is not there', () => {
    expect(refusal({ verb: 'update', field: 'modules', value: 'nope', fields: { path: 'x' } })).toContain('nope');
  });

  it('refuses an update at a section', () => {
    expect(refusal({ verb: 'update', field: 'paths', value: 'x' })).toContain('paths');
  });

  it('refuses a rename through `name` — identity is what the path addresses (state it, do not infer it)', () => {
    const message = refusal({ verb: 'update', field: 'modules', value: 'core', fields: { name: 'renamed' } });
    expect(message).toContain('name');
  });
});

describe('required arguments, per target kind — the checks that keep --value honest', () => {
  it('refuses remove/update at a collection with no --value: nothing says which entry', () => {
    expect(refusal({ verb: 'remove', field: 'modules' })).toContain('--value');
    expect(refusal({ verb: 'update', field: 'modules' })).toContain('--value');
  });

  it('refuses a list operation with no --value, and one whose --value is only separators', () => {
    expect(refusal({ verb: 'add', field: 'paths.sources' })).toContain('--value');
    expect(refusal({ verb: 'add', field: 'paths.sources', value: ' , ' })).toContain('--value');
  });

  it('refuses an update at a leaf with no --value', () => {
    expect(refusal({ verb: 'update', field: 'project.license' })).toContain('--value');
  });

  it('refuses removing a scalar that is not set — there is nothing to drop', () => {
    expect(refusal({ verb: 'remove', field: 'project.repository' })).toContain('project.repository');
  });

  it('refuses an update at an entry-terminated path that carries no field to change', () => {
    expect(refusal({ verb: 'update', field: 'modules.core' })).toMatch(/--path|--description/);
  });
});

describe('option values are coerced against the field the schema declares', () => {
  it("a boolean field takes true/false, not the string 'true'", () => {
    const result = mutated({
      verb: 'add',
      field: 'team.agents',
      value: 'claude',
      fields: { executes_as: 'approver', approval_authority: 'false' },
    });
    expect((result.team as { agents: Array<Record<string, unknown>> }).agents[0]).toEqual({
      name: 'claude',
      executes_as: ['approver'],
      approval_authority: false,
    });
  });

  it("'true' is the other half of the boolean pair", () => {
    const result = mutated({
      verb: 'add',
      field: 'team.agents',
      value: 'claude',
      fields: { executes_as: 'approver', approval_authority: 'true' },
    });
    expect((result.team as { agents: Array<Record<string, unknown>> }).agents[0]!.approval_authority).toBe(true);
  });

  it('a numeric field takes a number, and keeps an unparseable value as given', () => {
    // `DnaYaml` declares no numeric field inside a collection today, so this is checked against a
    // schema of its own — the same reason `applyDnaMutation` takes one (see its doc comment).
    const schema = z.object({ items: z.array(z.object({ name: z.string(), size: z.number() })) });
    const numeric = applyDnaMutation({ items: [] }, { verb: 'add', field: 'items', value: 'a', fields: { size: '42' } }, schema);
    expect(numeric.ok).toBe(true);
    if (numeric.ok) expect((numeric.dna.items as Array<Record<string, unknown>>)[0]).toEqual({ name: 'a', size: 42 });

    const nonsense = applyDnaMutation({ items: [] }, { verb: 'add', field: 'items', value: 'a', fields: { size: 'big' } }, schema);
    expect(nonsense.ok).toBe(true);
    if (nonsense.ok) expect((nonsense.dna.items as Array<Record<string, unknown>>)[0]!.size).toBe('big');
  });

  it('a value that is not a boolean is left as given, for the schema re-validation to reject', () => {
    const result = mutated({
      verb: 'add',
      field: 'team.agents',
      value: 'claude',
      fields: { executes_as: 'approver', approval_authority: 'yes-please' },
    });
    expect((result.team as { agents: Array<Record<string, unknown>> }).agents[0]!.approval_authority).toBe('yes-please');
  });
});

describe('purity (REQ-SYS-07)', () => {
  it('never mutates the document it is given, on success or on refusal', () => {
    const document = dna();
    const before = JSON.stringify(document);
    applyDnaMutation(document, { verb: 'add', field: 'modules', value: 'cli', fields: { path: 'src/cli' } });
    applyDnaMutation(document, { verb: 'remove', field: 'paths.sources', value: 'src/' });
    applyDnaMutation(document, { verb: 'update', field: 'project.license', value: 'Apache-2.0' });
    applyDnaMutation(document, { verb: 'add', field: 'modules', value: 'core' });
    expect(JSON.stringify(document)).toBe(before);
  });

  it('returns the same result for the same input, call after call', () => {
    const request = { verb: 'add', field: 'modules', value: 'cli', fields: { path: 'src/cli' } } as const;
    expect(JSON.stringify(applyDnaMutation(dna(), request))).toBe(JSON.stringify(applyDnaMutation(dna(), request)));
  });
});
