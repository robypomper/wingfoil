/**
 * Quoted path segments — `dl-083-dotted-entry-names-in-paths` (`ready`), task-099, closing
 * `bug-091-entry-names-containing-a-dot-are-unaddressable`.
 *
 * `dl-081-dna-mutation-surface-shape` made an entry's `name` the key it is addressed by, which made
 * two properties of `name` load-bearing: that it is unique within its collection, and that it is
 * expressible inside a dotted path. `task-093` implemented the first (`uniquelyNamed`, pinned by
 * `test/dna/schema-uniqueness.test.ts`); this suite pins the second.
 *
 * The rule, in `dl-083`'s Decision's own words: **"A path segment may be quoted with double quotes,
 * and a quoted segment is taken verbatim, dots included."** The delimiters are not part of the name,
 * quoting a segment with no dot is legal and means the same thing, an unterminated quote is a usage
 * error at exit `2`, and a quoted segment may not contain `"` — there is **no escape sequence**, and
 * that cost is accepted deliberately rather than overlooked.
 *
 * **A quoting overlap worth naming, because a reader will get it wrong.** In a shell invocation such
 * as `wingfoil dna update 'stacks.technologies."Node.js".version' --value 22.14+`, the **outer single
 * quotes are the shell's** (they stop it from eating the double quotes) and the **inner double quotes
 * are WingFoil's** (they are the path grammar). What this module sees is only the inner form, which is
 * what every string in this file spells — no shell is involved here.
 */
import { load } from 'js-yaml';

import { resolveDnaPath } from '../../src/dna/path';
import { DnaYaml } from '../../src/dna/schema';
import { isValidKeyPath, quoteDnaSegment, splitDnaPath } from '../../src/dna/set';

/**
 * The three entry names `docs/self/.wingfoil/dna.yaml` really carries whose `name` contains a dot,
 * transcribed from that file at commit `3a350aa6` — `Node.js` and `Commander.js` in
 * `stacks.technologies`, `AI agent (Claude/Cursor/etc.)` in `team.agents`.
 *
 * `dl-083` Action 3 asks for exactly this corpus, and it is the durable half of this task: a future
 * "forbid dots in `name`" refinement attached to `DnaYaml` the way `uniquelyNamed` is would reject
 * this fixture **on load**, so the ban cannot be reintroduced without a failing test (`bug-091`'s
 * Correction, which is the measurement that overturned the first ruling).
 */
const DOTTED_DNA = `
version: 1.1
project:
  name: WingFoil
  license: MIT
modules:
  - name: core
    path: src/core
stacks:
  technologies:
    - name: TypeScript
      category: language
    - name: Node.js
      category: runtime
      version: "22.12+"
    - name: Commander.js
      category: framework
      notes: CLI command surface (P2 Interaction Layer)
  methodologies:
    - name: TDD
team:
  members:
    - name: roberto
      email: r@example.it
      roles: [ approver, developer ]
  agents:
    - name: AI agent (Claude/Cursor/etc.)
      executes_as: [ developer, reviewer ]
      approval_authority: false
  roles:
    - name: approver
    - name: developer
    - name: reviewer
paths:
  sources: [ src/ ]
`;

/** The fixture as a plain document — parsed once per call so no test can mutate another's input. */
function dotted(): Record<string, unknown> {
  return load(DOTTED_DNA) as Record<string, unknown>;
}

/** The resolved target, or a thrown assertion failure naming the refusal. */
function target(path: string, document: Record<string, unknown> = dotted()) {
  const resolved = resolveDnaPath(document, path);
  if (!resolved.ok) throw new Error(`expected '${path}' to resolve, got refusal: ${resolved.message}`);
  return resolved.target;
}

/** The refusal message, or a thrown assertion failure (the path was expected NOT to resolve). */
function refusal(path: string, document: Record<string, unknown> = dotted()): string {
  const resolved = resolveDnaPath(document, path);
  if (resolved.ok) throw new Error(`expected '${path}' to be refused, but it resolved as ${resolved.target.kind}`);
  return resolved.message;
}

/** The parser's refusal message, or a thrown assertion failure. */
function splitError(path: string): string {
  const split = splitDnaPath(path);
  if (split.ok) throw new Error(`expected '${path}' to be refused, but it split as ${JSON.stringify(split.segments)}`);
  return split.message;
}

describe('splitDnaPath — one parser, three call sites (task-093 seam; dl-083 Action 1)', () => {
  it('splits an ordinary path exactly as `split(".")` did, so nothing that worked changes', () => {
    expect(splitDnaPath('team.members.roberto.roles')).toEqual({
      ok: true,
      segments: ['team', 'members', 'roberto', 'roles'],
    });
    expect(splitDnaPath('version')).toEqual({ ok: true, segments: ['version'] });
  });

  it('AC1: a quoted segment is taken verbatim, dots included', () => {
    expect(splitDnaPath('stacks.technologies."Node.js".version')).toEqual({
      ok: true,
      segments: ['stacks', 'technologies', 'Node.js', 'version'],
    });
  });

  it('AC2: the delimiters are dropped, and quoting a dot-free segment means the same as not quoting it', () => {
    expect(splitDnaPath('team."members".roberto.roles')).toEqual(splitDnaPath('team.members.roberto.roles'));
    expect(splitDnaPath('"version"')).toEqual({ ok: true, segments: ['version'] });
  });

  it('AC1: a quoted segment may be first, last, or the whole path', () => {
    expect(splitDnaPath('"Node.js"')).toEqual({ ok: true, segments: ['Node.js'] });
    expect(splitDnaPath('stacks.technologies."Commander.js"')).toEqual({
      ok: true,
      segments: ['stacks', 'technologies', 'Commander.js'],
    });
  });

  it('keeps the malformed-path message `P2.1-dna-set.feature` scenario 3 pins, verbatim', () => {
    expect(splitError('..language')).toBe("invalid key path: '..language'");
    expect(splitError('')).toBe("invalid key path: ''");
    expect(splitError('team.')).toBe("invalid key path: 'team.'");
    // An empty QUOTED segment is empty just the same: the quotes are delimiters, not content.
    expect(splitError('team.""')).toBe('invalid key path: \'team.""\'');
  });

  it('AC3: an unterminated quote is refused as unterminated, not taken as a name beginning with a quote', () => {
    const message = splitError('stacks.technologies."Node.js');
    expect(message).toMatch(/unterminated/i);
    expect(message).toContain('stacks.technologies."Node.js');
  });

  it('AC4: a `"` the delimiters cannot account for refuses the NAME as unaddressable', () => {
    for (const path of ['stacks.technologies."say "hi""', 'modules.co"re.path', 'team.agents."etc."."x"y"']) {
      const message = splitError(path);
      expect(message).toMatch(/unaddressable/i);
      // Not "malformed"/"invalid key path": AC4 is a property of the NAME, not of the path's spelling.
      expect(message).not.toMatch(/invalid key path/);
      // And it says there is no way out, because there is none — no escape sequence exists.
      expect(message).toMatch(/escape/i);
    }
  });

  /**
   * `"Node.js"x` carries no second `"`, so no name containing a quote is being reached for — it is a
   * quoted segment that simply does not span its segment, which is the malformed family. Keeping the
   * two apart is what lets AC4's message be true every time it is printed: it is shown when, and only
   * when, a `"` appears where no delimiter can account for it.
   */
  it('a quoted segment that does not span its segment is malformed, NOT unaddressable', () => {
    expect(splitError('stacks.technologies."Node.js"x')).toBe(
      'invalid key path: \'stacks.technologies."Node.js"x\'',
    );
  });

  it('isValidKeyPath agrees with the parser, since it IS the parser (one rule, not two)', () => {
    for (const path of ['team.members.roberto.roles', 'stacks.technologies."Node.js".version', '"Node.js"']) {
      expect(isValidKeyPath(path)).toBe(true);
    }
    for (const path of ['..language', '', 'stacks."Node.js', 'modules.co"re']) {
      expect(isValidKeyPath(path)).toBe(false);
    }
  });

  it('quoteDnaSegment is the inverse: it quotes exactly the names that need it, and re-splits to itself', () => {
    expect(quoteDnaSegment('roberto')).toBe('roberto');
    expect(quoteDnaSegment('Node.js')).toBe('"Node.js"');
    for (const name of ['roberto', 'Node.js', 'AI agent (Claude/Cursor/etc.)']) {
      expect(splitDnaPath(quoteDnaSegment(name))).toEqual({ ok: true, segments: [name] });
    }
  });
});

describe('resolveDnaPath — the same grammar on the resolution traversal (AC1, AC2)', () => {
  it('AC1: `stacks.technologies."Node.js".version` addresses the entry named `Node.js`', () => {
    const resolved = target('stacks.technologies."Node.js".version');
    expect(resolved.kind).toBe('scalar');
    expect(resolved.value).toBe('22.12+');
    expect(resolved.segments).toEqual(['stacks', 'technologies', 'Node.js', 'version']);
  });

  it('AC1: the entry itself resolves, and reports the collection it belongs to', () => {
    const resolved = target('stacks.technologies."Commander.js"');
    expect(resolved.kind).toBe('entry');
    expect(resolved.collectionPath).toBe('stacks.technologies');
    expect((resolved.value as { name: string }).name).toBe('Commander.js');
  });

  it('AC2: a quoted dot-free segment resolves to the same place as the bare spelling', () => {
    const quoted = target('team."members"."roberto".roles');
    const bare = target('team.members.roberto.roles');
    // `path` is the only difference, and deliberately so: it is the path AS GIVEN (never rewritten),
    // because it is what the commit subject echoes back to the author. Everything the verbs act on —
    // the segments, the node kind, the value — is identical.
    expect({ ...quoted, path: bare.path }).toEqual(bare);
    expect(quoted.segments).toEqual(['team', 'members', 'roberto', 'roles']);
    expect(quoted.value).toEqual(['approver', 'developer']);
  });

  it('AC6: all three of `dna.yaml`\'s real dotted names are addressable', () => {
    expect(target('stacks.technologies."Node.js"').kind).toBe('entry');
    expect(target('stacks.technologies."Commander.js".notes').value).toBe('CLI command surface (P2 Interaction Layer)');
    expect(target('team.agents."AI agent (Claude/Cursor/etc.)".executes_as').value).toEqual(['developer', 'reviewer']);
  });

  it('the bare spelling of a dotted name still does NOT resolve — quoting is how you reach it', () => {
    expect(refusal('stacks.technologies.Node.js.version')).toContain("no entry named 'Node'");
  });

  it('a refusal below a quoted segment re-quotes it, so the reported prefix can be pasted back', () => {
    const message = refusal('stacks.technologies."Node.js".bogus');
    // The prefix that DID resolve, not just the echoed path: `'bogus' is not declared under
    // 'stacks.technologies."Node.js"'` — and not the ambiguous `stacks.technologies.Node.js`, which
    // would re-split into four segments and name a different node.
    expect(message).toContain('under \'stacks.technologies."Node.js"\'');
    expect(message).not.toContain("under 'stacks.technologies.Node.js'");
  });

  it('AC3/AC4: the resolver refuses the same two spellings the parser does, with the parser\'s message', () => {
    expect(refusal('stacks.technologies."Node.js')).toMatch(/unterminated/i);
    expect(refusal('stacks.technologies."say "hi""')).toMatch(/unaddressable/i);
  });
});

describe('AC7 — no dot constraint joins `uniquelyNamed` in the schema', () => {
  it('a document carrying all three live dotted names LOADS (a dot ban would go red here, on read)', () => {
    const parsed = DnaYaml.safeParse(dotted());
    expect(parsed.success).toBe(true);
  });

  it('the three names survive validation byte-for-byte — nothing normalises the dot away', () => {
    const parsed = DnaYaml.parse(dotted());
    const technologies = (parsed.stacks as { technologies: Array<{ name: string }> }).technologies;
    expect(technologies.map((entry) => entry.name)).toEqual(['TypeScript', 'Node.js', 'Commander.js']);
    expect((parsed.team as { agents?: Array<{ name: string }> }).agents?.[0]?.name).toBe(
      'AI agent (Claude/Cursor/etc.)',
    );
  });

  it('duplicate names are still refused — `uniquelyNamed` stays exactly as task-093 left it', () => {
    const document = dotted();
    ((document.stacks as Record<string, unknown>).technologies as unknown[]).push({
      name: 'Node.js',
      category: 'runtime',
    });
    const parsed = DnaYaml.safeParse(document);
    expect(parsed.success).toBe(false);
  });
});
