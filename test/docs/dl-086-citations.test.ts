/**
 * `dl-086` citation gate (`task-161-revise-command-baseline-which-verbs-read-head-filesystem`, AC 3).
 *
 * `dl-086-a-guard-over-a-filesystem-effect-resolves-on-the-filesystem` was ratified (`ready`, approve
 * `593d7fc3`) after the shipped guards had cited it as `in-discussion`. A status word inside a TSDoc
 * goes stale the moment the decision-log moves, and nothing re-reads a comment when it does
 * (`release-planning-rel-v0.3-plan`, Appendix B, "Surprise 3"). This test enumerates every source
 * site that cites `dl-086` and fails if one still calls it `in-discussion`.
 *
 * The enumeration is not allowed to be vacuous: the guards that rely on the decision are named below,
 * and each must still cite it, so a rewrite that drops the citation altogether fails here too rather
 * than passing by having nothing to check. Deterministic: files are walked in sorted order and the
 * result is a sorted list.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

/** Every `.ts` file under `dir`, repository-relative, sorted. */
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.ts')) out.push(relative(repoRoot, full));
  }
  return out;
}

/**
 * The text that follows one citation, up to the end of its sentence (or 200 characters), with the
 * comment markers of a wrapped TSDoc line removed — enough to see a parenthesised status word that
 * wrapped onto the next line.
 */
function citationTail(source: string, index: number): string {
  const window = source.slice(index, index + 200).replace(/\n\s*\*\s?/g, ' ');
  const end = window.search(/\.(\s|$)/);
  return end === -1 ? window : window.slice(0, end);
}

interface Site {
  file: string;
  line: number;
  tail: string;
}

/** Every citation of `dl-086` under `src/` and `test/`, as file, 1-based line and following text. */
function dl086Sites(): Site[] {
  const sites: Site[] = [];
  for (const file of [...tsFiles(join(repoRoot, 'src')), ...tsFiles(join(repoRoot, 'test'))]) {
    if (file === relative(repoRoot, __filename)) continue;
    const source = readFileSync(join(repoRoot, file), 'utf8');
    for (const match of source.matchAll(/dl-086/g)) {
      const index = match.index ?? 0;
      sites.push({ file, line: source.slice(0, index).split('\n').length, tail: citationTail(source, index) });
    }
  }
  return sites;
}

/** The guards whose baseline `dl-086` decides; each must keep citing it. */
const GUARDS_CITING_DL_086 = [
  'src/core/confinement.ts',
  'src/core/memory-transition.ts',
  'src/core/write-guard.ts',
  'src/storage/confinement.ts',
  'src/storage/memory-path.ts',
];

describe('dl-086 citations in the source', () => {
  const sites = dl086Sites();

  it('are cited by every guard whose baseline the decision-log decides', () => {
    const citing = [...new Set(sites.map((site) => site.file))];
    expect(GUARDS_CITING_DL_086.filter((file) => !citing.includes(file))).toEqual([]);
  });

  it('never call the ratified decision-log `in-discussion`', () => {
    const stale = sites
      .filter((site) => /in-discussion/.test(site.tail))
      .map((site) => `${site.file}:${site.line}: ${site.tail.trim()}`);
    expect(stale).toEqual([]);
  });
});
