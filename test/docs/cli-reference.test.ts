/**
 * CLI-reference coverage gate (`user-docs-rel-v0.2-plan` §11.3 — approver decision of 2026-09-25).
 *
 * `docs/cli-reference.md` documents every shipped `wingfoil` command under a heading of the exact form
 * ``### `wingfoil <noun> <verb>` `` (or ``### `wingfoil <command>` `` for a flat command). This test
 * walks the Commander program `buildProgram` derives from `CORE_MODULES` — the same tree the `bin`
 * entry point runs, bootstrap commands (`init`, `mcp`) included — and requires the two sets to be
 * equal: a shipped command with no reference entry fails, and so does an entry for a command that
 * does not ship. It is the documentation twin of the API-docs gate (`api-docs.test.ts`): the
 * reference cannot silently fall behind the surface. Deterministic: both sides are sorted lists
 * derived from fixed inputs.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Command } from 'commander' with { 'resolution-mode': 'import' };

import { buildProgram } from '../../src/cli/program';
import { CORE_MODULES } from '../../src/core';

const repoRoot = join(__dirname, '..', '..');
const referencePath = join(repoRoot, 'docs', 'cli-reference.md');

/** Every leaf command of `program` as `"noun verb"` / `"command"`, sorted, Commander's implicit `help` excluded. */
function shippedCommands(program: Command): string[] {
  const out: string[] = [];
  for (const top of program.commands) {
    const subs = top.commands.filter((sub) => sub.name() !== 'help');
    if (subs.length === 0) out.push(top.name());
    else for (const sub of subs) out.push(`${top.name()} ${sub.name()}`);
  }
  return out.sort();
}

/** Every command the reference documents, read from its ``### `wingfoil …` `` headings, sorted. */
function documentedCommands(markdown: string): string[] {
  const out: string[] = [];
  for (const [, command] of markdown.matchAll(/^### `wingfoil ([a-z][a-z -]*[a-z])`\s*$/gm)) {
    if (command) out.push(command);
  }
  return out.sort();
}

describe('CLI reference coverage (docs/cli-reference.md)', () => {
  it('documents exactly the commands the CLI ships — none missing, none invented', async () => {
    const program = await buildProgram(CORE_MODULES, {
      resolveRoot: () => repoRoot,
      buildParams: () => ({}),
    });
    const shipped = shippedCommands(program);
    const documented = documentedCommands(readFileSync(referencePath, 'utf8'));

    expect(shipped.length).toBeGreaterThan(0);
    expect(documented).toEqual(shipped);
  });
});
