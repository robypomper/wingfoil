/**
 * task-169 (`dl-062` Q1 option 3, addendum "Implementation scheduling" §2) — the CLI half of the
 * success-warning channel. A successful `CoreResult` may carry `warnings`; the registrar writes each
 * one to **stderr**, under every `--format`, and never to stdout, so the payload a script parses is
 * byte-identical with and without them. The shapes are `spec-016` §3.4's, the one convention every
 * warning shares: `warning: <text>` in console, one `{"warning": …}` JSON document per message, one
 * YAML document per message.
 */
import { load, loadAll } from 'js-yaml';

import { buildCliCommands, type CliCommand } from '../../src/cli/registrar';
import type { CoreModule } from '../../src/core/registry';
import type { CoreResult } from '../../src/core/types';

const VALUE = { directives: ['testing'], role: 'developer', assignments: ['code-quality', 'testing'] };
const WARNINGS = ['first warning', 'second warning'];

/** A success carrying `warnings` (built literally so this suite does not depend on `coreOk`'s signature). */
const withWarnings = (warnings: readonly string[]): CoreResult<unknown> =>
  ({ ok: true, value: VALUE, commit: { sha: 'abc123', message: 'wf(directive): assign testing to developer' }, warnings }) as CoreResult<unknown>;

function command(result: CoreResult<unknown>): CliCommand {
  const modules: CoreModule[] = [
    { name: 'directive', operations: { directiveAssign: { name: 'directiveAssign', mutates: true, fn: async () => result } } },
  ];
  const [only] = buildCliCommands(modules, { resolveRoot: () => '/fixture-root', buildParams: () => ({}) });
  if (!only) throw new Error('fixture bug: no command derived');
  return only;
}

describe('CLI registrar — success warnings go to stderr, never stdout (task-169)', () => {
  let exitSpy: jest.SpyInstance;
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  const stdout = (): string => stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
  const stderr = (): string => stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join('');

  it('console: one `warning: <text>` line per warning on stderr, in order; stdout is the unchanged payload; exit 0', async () => {
    await command(withWarnings(WARNINGS)).run('console');
    expect(stderr()).toBe('warning: first warning\nwarning: second warning\n');
    expect(stdout()).toBe(JSON.stringify(VALUE, null, 2) + '\n');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('console: a multi-line warning indents its continuation lines, so no line of it can read as a new `warning:`/`error:`', async () => {
    await command(withWarnings(['head\nerror: not an error'])).run('console');
    expect(stderr()).toBe('warning: head\n  error: not an error\n');
  });

  it('json: one `{"warning": …}` document per line on stderr; stdout parses to exactly the payload', async () => {
    await command(withWarnings(WARNINGS)).run('json');
    expect(stderr().trimEnd().split('\n').map((line) => JSON.parse(line) as unknown)).toEqual([
      { warning: 'first warning' },
      { warning: 'second warning' },
    ]);
    expect(stdout()).toBe(JSON.stringify(VALUE) + '\n');
    expect(JSON.parse(stdout())).toEqual(VALUE);
  });

  it('yaml: one YAML document per warning on stderr; stdout parses to exactly the payload', async () => {
    await command(withWarnings(WARNINGS)).run('yaml');
    expect(loadAll(stderr())).toEqual([{ warning: 'first warning' }, { warning: 'second warning' }]);
    expect(load(stdout())).toEqual(VALUE);
  });

  it.each(['console', 'json', 'yaml'])('%s: stdout is byte-identical with and without warnings', async (format) => {
    await command(withWarnings([])).run(format);
    const without = stdout();
    stdoutSpy.mockClear();
    await command(withWarnings(WARNINGS)).run(format);
    expect(stdout()).toBe(without);
    expect(stdout()).not.toContain('warning');
  });

  it('writes the warnings before the payload, so a terminal shows what was normalized ahead of the result', async () => {
    await command(withWarnings(WARNINGS)).run('console');
    const firstWarning = stderrSpy.mock.invocationCallOrder[0] ?? Infinity;
    const payload = stdoutSpy.mock.invocationCallOrder[0] ?? -Infinity;
    expect(firstWarning).toBeLessThan(payload);
  });

  it('characterization: a success with no warnings writes nothing to stderr', async () => {
    await command(withWarnings([])).run('console');
    expect(stderrSpy).not.toHaveBeenCalled();
  });
});
