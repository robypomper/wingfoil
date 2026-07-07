/**
 * task-020-implement-memory-add — the pure/domain helpers behind `wingfoil memory add` (P1.3),
 * factored into `src/memory/add.ts` so the `CoreResult`-wrapped orchestration in `src/core` stays
 * thin (mirroring `dna set`'s split: pure `setDnaValue` in `src/dna`, the `CoreFn` in `src/core`).
 *
 * These functions are deterministic (REQ-SYS-07): a slug is a pure function of the title, the
 * document render a pure function of (scaffold, id, title, tags), and the sequence counter a pure
 * function of the committed on-disk state — no wall-clock, no randomness.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  hasNumericToken,
  nextSequenceNumber,
  parseTags,
  renderAddDocument,
  resolveTypeDirectory,
  slugifyTitle,
} from '../../src/memory/add';
import { writeFixtureFile } from '../storage/helpers/git-fixture';

describe('slugifyTitle — deterministic, valid ID piece from a human title', () => {
  it('lowercases, collapses non-alphanumerics to single hyphens, and trims edges', () => {
    expect(slugifyTitle('Use PostgreSQL')).toBe('use-postgresql');
    expect(slugifyTitle('  Keep   It Simple!  ')).toBe('keep-it-simple');
    expect(slugifyTitle('CLI: exit-code contract (v2)')).toBe('cli-exit-code-contract-v2');
  });

  it('never emits leading/trailing/doubled hyphens (a valid single ID piece)', () => {
    expect(slugifyTitle('--Hello--World--')).toBe('hello-world');
    expect(slugifyTitle('a & b')).toBe('a-b');
  });
});

describe('parseTags — comma-separated CLI value to a trimmed string array', () => {
  it('splits on commas and trims each tag', () => {
    expect(parseTags('infra,db')).toEqual(['infra', 'db']);
    expect(parseTags(' a , b ,c ')).toEqual(['a', 'b', 'c']);
  });

  it('returns undefined for an absent value and drops empty entries', () => {
    expect(parseTags(undefined)).toBeUndefined();
    expect(parseTags('')).toBeUndefined();
    expect(parseTags('a,,b,')).toEqual(['a', 'b']);
  });
});

describe('hasNumericToken — whether an id_pattern needs a sequence counter', () => {
  it('detects a {n}-family numeric token', () => {
    expect(hasNumericToken('task-{n}-{slug}')).toBe(true);
    expect(hasNumericToken('bug-{nnn}-{slug}')).toBe(true);
  });

  it('is false for slug-only / version-only patterns', () => {
    expect(hasNumericToken('note-{slug}')).toBe(false);
    expect(hasNumericToken('rl-{version}')).toBe(false);
  });
});

describe('renderAddDocument — fill only the frontmatter skeleton, copy the scaffold verbatim otherwise', () => {
  const SCAFFOLD = `---
id: ""
type: decision
title: ""
status: draft
tmpl_version: 260101
tags: []
---

<!-- decision body -->
`;

  it('sets id (plain), title (quoted), status: draft, and leaves tmpl_version/body untouched', () => {
    const out = renderAddDocument(SCAFFOLD, { id: 'decision-001-use-postgresql', title: 'Use PostgreSQL' });
    expect(out).toContain('id: decision-001-use-postgresql');
    expect(out).toContain('title: "Use PostgreSQL"');
    expect(out).toContain('status: draft');
    expect(out).toContain('type: decision'); // untouched
    expect(out).toContain('tmpl_version: 260101'); // untouched (spec-010)
    expect(out).toContain('<!-- decision body -->'); // body copied verbatim
    // A single id/title/status line each — no duplicates appended.
    expect(out.match(/^id:/gm)).toHaveLength(1);
    expect(out.match(/^title:/gm)).toHaveLength(1);
    expect(out.match(/^status:/gm)).toHaveLength(1);
  });

  it('writes tags as a compact YAML flow sequence when provided', () => {
    const out = renderAddDocument(SCAFFOLD, {
      id: 'decision-001-x',
      title: 'X',
      tags: ['infra', 'db'],
    });
    expect(out).toContain('tags: ["infra","db"]');
    expect(out.match(/^tags:/gm)).toHaveLength(1);
  });

  it('appends a field the scaffold lacks rather than losing it', () => {
    const scaffoldNoTags = `---\nid: ""\ntype: note\ntitle: ""\nstatus: draft\n---\n\nbody\n`;
    const out = renderAddDocument(scaffoldNoTags, { id: 'note-x', title: 'X', tags: ['a'] });
    expect(out).toContain('tags: ["a"]');
  });

  it('throws when the scaffold has no frontmatter block', () => {
    expect(() => renderAddDocument('no frontmatter here', { id: 'x', title: 'Y' })).toThrow();
  });
});

describe('resolveTypeDirectory + nextSequenceNumber — deterministic counter from committed state', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'wf-seq-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('resolveTypeDirectory strips the {id}.md leaf to the containing directory', () => {
    expect(resolveTypeDirectory('/root', 'docs/memory/decision/{id}.md')).toBe('/root/docs/memory/decision');
  });

  it('nextSequenceNumber is 1 for an empty/absent directory', () => {
    expect(nextSequenceNumber(join(dir, 'missing'), 'decision-{n}-{slug}')).toBe(1);
  });

  it('counts only files whose basename matches the id_pattern, +1', () => {
    writeFixtureFile(dir, 'decision/decision-001-a.md', 'x');
    writeFixtureFile(dir, 'decision/decision-002-b.md', 'x');
    writeFixtureFile(dir, 'decision/README.md', 'x'); // not an id-pattern match
    expect(nextSequenceNumber(join(dir, 'decision'), 'decision-{n}-{slug}')).toBe(3);
  });
});
