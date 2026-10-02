/**
 * CLI-reference coverage gate (`user-docs-rel-v0.2-plan` §11.3 — approver decision of 2026-09-25).
 *
 * `docs/cli-reference.md` documents every shipped `wingfoil` command under a heading of the exact form
 * ``### `wingfoil <noun> <verb>` `` (or ``### `wingfoil <command>` `` for a flat command). This test
 * walks the Commander program `buildProgram` derives from `CORE_MODULES` — the same tree the `bin`
 * entry point runs, bootstrap commands (`init`, `mcp`) included — and requires the two sets to be
 * equal: a shipped command with no reference entry fails, and so does an entry for a command that
 * does not ship. It is the documentation twin of the API-docs gate (`api-docs.test.ts`): the
 * reference cannot silently fall behind the surface. Since task-120 it also holds the TEXT together:
 * each command's `--help` description is its entry's first sentence, and each declared positional
 * appears in its entry under the name `--help` shows, and (task-169) so does every declared flag and
 * option. Deterministic: both sides are sorted lists
 * derived from fixed inputs.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Command } from 'commander' with { 'resolution-mode': 'import' };

import { buildProgram } from '../../src/cli/program';
import { CORE_MODULES } from '../../src/core';
import { deriveVerb, enumerateOperations } from '../../src/core/registry';

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

  // task-120-subcommand-help-describes-every-command AC 3 (`bug-128`): the one-line description
  // `--help` shows for a command and the summary its reference entry opens with are the same sentence,
  // so neither can be corrected without the other. The comparison ignores only what a terminal cannot
  // render and a sentence in a list does not carry: backticks, the first letter's case, and the final
  // period.
  it("gives every command the description its entry's first sentence states", async () => {
    const program = await buildProgram(CORE_MODULES, {
      resolveRoot: () => repoRoot,
      buildParams: () => ({}),
    });
    const markdown = readFileSync(referencePath, 'utf8');
    const disagreements: string[] = [];
    for (const [path, command] of leafCommands(program)) {
      const summary = entrySummary(markdown, path);
      const help = command.description();
      if (summary === undefined || normalizeSentence(summary) !== normalizeSentence(help)) {
        disagreements.push(`${path}: --help ${JSON.stringify(help)} vs reference ${JSON.stringify(summary)}`);
      }
    }
    expect(disagreements).toEqual([]);
  });

  it("names every command's positional, as --help names it, in the command's entry", async () => {
    const markdown = readFileSync(referencePath, 'utf8');
    const missing: string[] = [];
    for (const { module, operation } of enumerateOperations(CORE_MODULES)) {
      if (!operation.positional) continue;
      const verb = deriveVerb(module.name, operation.name);
      const path = verb ? `${module.name} ${verb}` : module.name;
      if (!(entryBody(markdown, path) ?? '').includes(`<${operation.positional.name}>`)) missing.push(`${path}: <${operation.positional.name}>`);
    }
    expect(missing).toEqual([]);
  });

  // task-169: a command-specific flag or option (`directive assign --force`, dl-062) is part of the
  // command's contract, so its entry must name it — the twin of the positional check above.
  it("names every flag and option a command declares, as `--<name>`, in the command's entry", () => {
    const markdown = readFileSync(referencePath, 'utf8');
    const missing: string[] = [];
    for (const { module, operation } of enumerateOperations(CORE_MODULES)) {
      const verb = deriveVerb(module.name, operation.name);
      const path = verb ? `${module.name} ${verb}` : module.name;
      const body = entryBody(markdown, path) ?? '';
      // A family of derived options is documented once as a pattern, `--entry-<field>` (dl-082).
      const patterns = [...body.matchAll(/--([a-z][a-z-]*)<[a-z_]+>/g)].map(([, prefix]) => prefix ?? '');
      for (const { name } of [...(operation.flags ?? []), ...(operation.options ?? [])]) {
        const named = new RegExp(`--${name}(?![a-z_-])`).test(body) || patterns.some((prefix) => name.startsWith(prefix));
        if (!named) missing.push(`${path}: --${name}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

/** Every leaf command of `program` keyed by its path, as {@link shippedCommands} lists it. */
function leafCommands(program: Command): Array<[string, Command]> {
  const out: Array<[string, Command]> = [];
  for (const top of program.commands) {
    const subs = top.commands.filter((sub) => sub.name() !== 'help');
    if (subs.length === 0) out.push([top.name(), top]);
    else for (const sub of subs) out.push([`${top.name()} ${sub.name()}`, sub]);
  }
  return out;
}

/** The text of the ``### `wingfoil <path>` `` entry, up to the next heading of level 3 or above. */
function entryBody(markdown: string, path: string): string | undefined {
  const heading = `### \`wingfoil ${path}\``;
  const start = markdown.indexOf(`${heading}\n`);
  if (start < 0) return undefined;
  const rest = markdown.slice(start + heading.length + 1);
  const end = rest.search(/^#{1,3} /m);
  return end < 0 ? rest : rest.slice(0, end);
}

/** The first sentence of an entry's first paragraph — the summary the reference opens each entry with. */
function entrySummary(markdown: string, path: string): string | undefined {
  const paragraph = (entryBody(markdown, path) ?? '').trim().split(/\n\s*\n/)[0];
  if (!paragraph) return undefined;
  const flat = paragraph.replace(/\s*\n\s*/g, ' ');
  const end = flat.search(/\.(\s|$)/);
  return end < 0 ? flat : flat.slice(0, end + 1);
}

function normalizeSentence(sentence: string): string {
  const plain = sentence.replace(/`/g, '').trim().replace(/\.$/, '');
  return plain.charAt(0).toLowerCase() + plain.slice(1);
}
