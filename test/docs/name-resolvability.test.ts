/**
 * Name-resolvability gate (`task-151-check-backticked-name-specs-adrs-requirements-resolves-head`,
 * `dl-116-document-parity-tests-beyond-the-cli-reference` Q1 (B), Q2 (a), Q3 (ii)).
 *
 * Every backticked name in a tech-spec (`docs/04_memory/design/specs/`), an ADR
 * (`docs/04_memory/design/adrs/`) or a SARD requirement document (`docs/02_requirements/03_sard/`)
 * that has the shape of a command, a Memory element or requirement id, a repository path, a code
 * symbol or a configuration key path must resolve in the repository — or be listed in
 * `name-resolvability.allowlist.ts` with the reason it does not. The classes and what each resolves
 * against are documented in `support/name-resolvability.ts`. This is the generic check for the
 * largest group of document divergences `dl-116` counted: a name that was renamed, moved or retired
 * in the code while a document kept the old one.
 *
 * **Mode: `warn` for v0.3; switch `MODE` to `'fail'` in v0.4** (`dl-116` Q3 (ii), the staging
 * `dl-023-init-cli-e2e-smoke-gate` used for the e2e smoke). What each mode does:
 *
 * - in both, a finding that the allowlist does not list fails — a document changed in v0.3 cannot add
 *   a dangling name without saying why — and so does an allowlist entry with no reason, out of order
 *   or listed twice, and a `planned` entry citing no task or a task that does not exist;
 * - `warn` reports, without failing, the entries still marked `UNTRIAGED` (first-run findings nobody
 *   has fixed or justified yet), the entries that no longer match a finding (the name was fixed or now
 *   resolves, so the entry should go) and the `planned` entries whose cited tasks are all `done`;
 * - `fail` fails on all three: by v0.4 every first-run finding is fixed in its document, carries the
 *   reason it is quoted on purpose, or is still planned by a task that is not `done`; and the
 *   allowlist holds nothing stale.
 *
 * "In the repository" means the working-tree content of the files git tracks (`git ls-files`):
 * untracked files never make a name resolve, but an uncommitted edit to a tracked file does. In CI's
 * clean checkout that is `HEAD`; locally, run it on a clean tree to get the `HEAD` answer.
 *
 * Deterministic: documents are read in `git ls-files` order, findings and the allowlist are sorted by
 * `document|class|name`, and a finding never carries a line offset (`dl-075`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Command } from 'commander' with { 'resolution-mode': 'import' };

import { buildProgram } from '../../src/cli/program';
import { CORE_MODULES } from '../../src/core';
import { NAME_ALLOWLIST, PLANNED, UNTRIAGED } from './name-resolvability.allowlist';
import {
  type AllowlistEntry,
  type Document,
  type NameIndex,
  applyAllowlist,
  buildNameIndex,
  classifyName,
  findingKey,
  findUnresolvedNames,
  inlineCodeSpans,
  planProblems,
  taskStatuses,
  trackedFiles,
} from './support/name-resolvability';

/** `'warn'` through v0.3; `'fail'` from v0.4 (`dl-116` Q3 (ii)). */
const MODE = 'warn' as 'warn' | 'fail';

const repoRoot = join(__dirname, '..', '..');
const SCANNED = /^(?:docs\/04_memory\/design\/(?:specs|adrs)|docs\/02_requirements\/03_sard)\/[^/]+\.md$/;
const FIXTURE = join(__dirname, 'fixtures', 'name-resolvability', 'sample.md');

/** Every shipped command path → its option flags, Commander's implicit `help` included. */
function commandIndex(program: Command): Map<string, Set<string>> {
  const flags = (command: Command): Set<string> =>
    new Set(command.options.map((option) => option.long).filter((long): long is string => long !== undefined));
  const commands = new Map<string, Set<string>>([['help', new Set()]]);
  for (const top of program.commands) {
    commands.set(top.name(), flags(top));
    for (const sub of top.commands) commands.set(`${top.name()} ${sub.name()}`, flags(sub));
  }
  return commands;
}

async function headIndex(): Promise<NameIndex> {
  const program = await buildProgram(CORE_MODULES, { resolveRoot: () => repoRoot, buildParams: () => ({}) });
  const globalFlags = new Set(['--help', ...program.options.map((option) => option.long ?? '')]);
  return buildNameIndex(repoRoot, commandIndex(program), globalFlags);
}

/** One `## ` section of the fixture, as its own document. */
function fixtureSection(heading: string): Document[] {
  const text = readFileSync(FIXTURE, 'utf8');
  const start = text.indexOf(`## ${heading}\n`);
  if (start === -1) throw new Error(`fixture has no section "${heading}"`);
  const end = text.indexOf('\n## ', start + 1);
  return [{ path: 'fixture.md', text: text.slice(start, end === -1 ? undefined : end) }];
}

let index: NameIndex;

beforeAll(async () => {
  index = await headIndex();
});

describe('name resolvability — the engine, on a fixture', () => {
  it('resolves a name of each class against the repository', () => {
    const section = fixtureSection('Names that resolve');
    // Not vacuous: every name in the section is one the engine classifies, and all five classes occur.
    const topLevel = new Set([...index.dirs].map((dir) => dir.split('/')[0] ?? ''));
    const classes = inlineCodeSpans(section[0]?.text ?? '').map((name) => [name, classifyName(name, topLevel)] as const);
    expect(classes.filter(([, nameClass]) => nameClass === undefined).map(([name]) => name)).toEqual([]);
    expect([...new Set(classes.map(([, nameClass]) => nameClass))].sort()).toEqual(['command', 'config', 'element', 'path', 'symbol']);
    expect(findUnresolvedNames(section, index)).toEqual([]);
  });

  it('reports a dangling name of each class as a finding', () => {
    expect(findUnresolvedNames(fixtureSection('Names that do not'), index).map(findingKey)).toEqual([
      'fixture.md|command|wingfoil memory teleport',
      'fixture.md|config|stacks.teleporters',
      'fixture.md|element|task-999-a-task-that-was-never-filed',
      'fixture.md|path|src/teleport/index.ts',
      'fixture.md|symbol|teleportElement',
    ]);
  });

  it('does not report a dangling name the allowlist lists, and reports the entry as matched', () => {
    const findings = findUnresolvedNames(fixtureSection('A dangling name quoted on purpose'), index);
    const entry = { document: 'fixture.md', nameClass: 'path', name: '.wingfoil/teleport-index/', reason: 'retired on purpose' } as const;

    expect(findings.map(findingKey)).toEqual(['fixture.md|path|.wingfoil/teleport-index/']);
    const applied = applyAllowlist(findings, [entry]);
    expect(applied.unlisted).toEqual([]);
    expect(applied.listed).toEqual([entry]);
    expect(applied.stale).toEqual([]);
    expect(applyAllowlist([], [entry]).stale).toEqual([entry]);
  });

  it('skips placeholders, prose and fenced code blocks', () => {
    expect(findUnresolvedNames(fixtureSection('Spans the check skips'), index)).toEqual([]);
  });

  // Review fix 4: a backtick pairs only within its paragraph (CommonMark), so a stray one cannot hide
  // every name after it; and a fence nobody closes runs to the end of the document.
  it('pairs backticks within a paragraph, so a stray backtick hides nothing after it', () => {
    const probe = { path: 'probe.md', text: 'A stray ` backtick in one paragraph.\n\nThen `src/teleport/x.ts` and `teleportFoo`.\n' };
    expect(findUnresolvedNames([probe], index).map(findingKey)).toEqual([
      'probe.md|path|src/teleport/x.ts',
      'probe.md|symbol|teleportFoo',
    ]);
  });

  it('treats an unclosed fence as code to the end of the document', () => {
    const probe = { path: 'probe.md', text: 'Before `teleportBefore`.\n\n```yaml\nteleport: `teleportInside`\n\nAfter `teleportAfter`.\n' };
    expect(findUnresolvedNames([probe], index).map(findingKey)).toEqual(['probe.md|symbol|teleportBefore']);
  });
});

// Review fix 3: a `planned` entry cites the non-done tasks that name it; once every one of them is
// `done` and the name still does not resolve, the plan did not deliver it, and from v0.4 that fails.
describe('name resolvability — planned entries', () => {
  const entry = (name: string, plannedBy: readonly string[]): AllowlistEntry => ({
    document: 'fixture.md',
    nameClass: 'symbol',
    name,
    reason: PLANNED,
    plannedBy,
  });

  it('reports a planned entry whose cited tasks are all done, and a cited task that does not exist', () => {
    const shipped = entry('shippedName', ['task-001', 'task-002']);
    const pending = entry('pendingName', ['task-001', 'task-003']);
    const ghost = entry('ghostName', ['task-999']);
    const statuses = new Map([
      ['task-001', 'done'],
      ['task-002', 'done'],
      ['task-003', 'backlog'],
    ]);

    expect(planProblems([shipped, pending, ghost], statuses)).toEqual({
      exhausted: [shipped],
      unknownTasks: ['fixture.md|symbol|ghostName: task-999'],
    });
  });

  it('reads every task status from the repository', () => {
    const statuses = taskStatuses(repoRoot);
    expect(statuses.get('task-151')).toBeDefined();
    expect([...statuses.keys()]).toEqual([...statuses.keys()].sort());
  });
});

describe(`name resolvability — specs, ADRs and requirements in the repository (mode: ${MODE})`, () => {
  const documents = (): Document[] =>
    trackedFiles(repoRoot)
      .filter((file) => SCANNED.test(file))
      .map((path) => ({ path, text: readFileSync(join(repoRoot, path), 'utf8') }));

  it('scans every spec, ADR and requirement document', () => {
    const paths = documents().map((document) => document.path);
    expect(paths.filter((path) => path.includes('/specs/')).length).toBeGreaterThan(0);
    expect(paths.filter((path) => path.includes('/adrs/')).length).toBeGreaterThan(0);
    expect(paths.filter((path) => path.includes('/03_sard/')).length).toBeGreaterThan(0);
  });

  it('gives every allowlist entry a reason, in sorted order, once', () => {
    const keys = NAME_ALLOWLIST.map(findingKey);
    expect(NAME_ALLOWLIST.filter((entry) => entry.reason.trim() === '').map(findingKey)).toEqual([]);
    expect(keys).toEqual([...keys].sort());
    expect(keys.filter((key, position) => keys.indexOf(key) !== position)).toEqual([]);
    // A `planned` entry cites at least one task, and only a `planned` entry cites any.
    expect(NAME_ALLOWLIST.filter((entry) => (entry.reason === PLANNED) !== (entry.plannedBy?.length ?? 0) > 0).map(findingKey)).toEqual([]);
  });

  it('finds no unresolved name the allowlist does not list', () => {
    const applied = applyAllowlist(findUnresolvedNames(documents(), index), NAME_ALLOWLIST);

    const untriaged = applied.listed.filter((entry) => entry.reason === UNTRIAGED);
    const plans = planProblems(applied.listed, taskStatuses(repoRoot));
    if (untriaged.length > 0 || applied.stale.length > 0 || plans.exhausted.length > 0) {
      const perDocument = new Map<string, number>();
      for (const entry of untriaged) perDocument.set(entry.document, (perDocument.get(entry.document) ?? 0) + 1);
      const report = [
        `name-resolvability (${MODE} mode until v0.4): ${untriaged.length} untriaged first-run finding(s), ` +
          `${applied.stale.length} stale allowlist entr${applied.stale.length === 1 ? 'y' : 'ies'}, ` +
          `${plans.exhausted.length} planned entr${plans.exhausted.length === 1 ? 'y' : 'ies'} whose tasks are all done.`,
        ...[...perDocument].map(([document, count]) => `  untriaged  ${count}  ${document}`),
        ...applied.stale.map((entry) => `  stale      ${findingKey(entry)}`),
        ...plans.exhausted.map((entry) => `  delivered? ${findingKey(entry)} (${(entry.plannedBy ?? []).join(', ')} all done)`),
      ].join('\n');
      if (MODE === 'warn') console.warn(report);
    }

    expect(applied.unlisted.map(findingKey)).toEqual([]);
    expect(plans.unknownTasks).toEqual([]);
    if (MODE === 'fail') {
      expect(plans.exhausted.map(findingKey)).toEqual([]);
      expect(untriaged.map(findingKey)).toEqual([]);
      expect(applied.stale.map(findingKey)).toEqual([]);
    }
  });
});
