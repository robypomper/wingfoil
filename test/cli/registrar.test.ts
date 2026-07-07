/**
 * `src/cli`'s registrar — the thin, Commander-independent adapter that derives one
 * `wingfoil <noun> <verb>` command descriptor per operation from a `CoreModule[]` registry
 * (spec-006 §2/§4, spec-005 exit-code/format/error contract, spec-008 grammar). No business logic
 * here beyond dispatch: these tests only exercise parse-format -> call-core-fn -> render-CoreResult,
 * never a real domain operation. (See `src/cli/program.ts` for why the actual `commander` wiring —
 * a thin, mechanical pass-through over this exact model — is not itself covered by an automated
 * test in this task: `commander` v15 is ESM-only and cannot be loaded under this project's current
 * Jest configuration.)
 */
import type { CoreModule } from '../../src/core/registry';
import { coreErr, coreOk } from '../../src/core/types';
import type { CoreErrorCode, CoreResult } from '../../src/core/types';
import { buildCliCommands, listRegisteredCliCommands, type CliCommand } from '../../src/cli/registrar';
import { StorageError, E_NO_GIT_ROOT } from '../../src/storage/errors';

const FIXTURE_MODULES: CoreModule[] = [
  {
    name: 'dna',
    operations: {
      dnaShow: { name: 'dnaShow', mutates: false, fn: async () => coreOk({ hello: 'world' }) },
      dnaSet: {
        name: 'dnaSet',
        mutates: true,
        fn: async () => coreOk({ committed: true }, { sha: 'abc123', message: 'wf(dna): set' }),
      },
    },
  },
  {
    name: 'memory',
    operations: {
      memoryApprove: {
        name: 'memoryApprove',
        mutates: true,
        fn: async () => coreErr({ code: 'INVALID_TRANSITION', message: 'illegal transition: draft to approved' }),
      },
    },
  },
];

function buildTestCommands(): CliCommand[] {
  return buildCliCommands(FIXTURE_MODULES, {
    resolveRoot: () => '/fixture-root',
    buildParams: () => ({}),
  });
}

function findCommand(commands: readonly CliCommand[], noun: string, verb: string): CliCommand {
  const found = commands.find((c) => c.noun === noun && c.verb === verb);
  if (!found) throw new Error(`fixture bug: ${noun} ${verb} not derived`);
  return found;
}

describe('buildCliCommands — command derivation (spec-006 §4: CLI exposes every operation)', () => {
  it('derives one `wingfoil <noun> <verb>` command per operation, regardless of `mutates`', () => {
    expect(listRegisteredCliCommands(buildTestCommands())).toEqual(['dna set', 'dna show', 'memory approve']);
  });

  it('tags each derived command with the operation\'s own `mutates` flag', () => {
    const commands = buildTestCommands();
    expect(findCommand(commands, 'dna', 'show').mutates).toBe(false);
    expect(findCommand(commands, 'dna', 'set').mutates).toBe(true);
    expect(findCommand(commands, 'memory', 'approve').mutates).toBe(true);
  });
});

describe('buildCliCommands — flat (no-verb) commands (spec-008-cli-grammar §1, task-028: `wingfoil paths [category]`)', () => {
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

  const FLAT_MODULES: CoreModule[] = [
    {
      name: 'paths',
      operations: {
        paths: {
          name: 'paths',
          mutates: false,
          positional: ['category'],
          flags: ['list'],
          fn: async () => coreOk({ category: 'sources', paths: ['src/'] }),
        },
      },
    },
  ];

  it('a "self-named" operation (module name === operation name) derives an empty verb, not a subcommand', () => {
    const commands = buildCliCommands(FLAT_MODULES, { resolveRoot: () => '/fixture-root', buildParams: () => ({}) });
    const flat = findCommand(commands, 'paths', '');
    expect(flat.verb).toBe('');
    expect(flat.positional).toEqual(['category']);
    expect(flat.flags).toEqual(['list']);
  });

  it('`listRegisteredCliCommands` renders a flat command as the bare noun, not "noun " with a trailing space', () => {
    const commands = buildCliCommands(FLAT_MODULES, { resolveRoot: () => '/fixture-root', buildParams: () => ({}) });
    expect(listRegisteredCliCommands(commands)).toEqual(['paths']);
  });

  it('`run` forwards positional/flag values into `buildParams` via `ParamsContext`', async () => {
    let seenPositional: unknown;
    let seenFlags: unknown;
    const commands = buildCliCommands(FLAT_MODULES, {
      resolveRoot: () => '/fixture-root',
      buildParams: (ctx) => {
        seenPositional = ctx.positional;
        seenFlags = ctx.flags;
        return { root: ctx.root, ...(ctx.positional ?? {}), ...(ctx.flags ?? {}) };
      },
    });
    const flat = findCommand(commands, 'paths', '');
    await flat.run('json', { category: 'sources' }, { list: true });
    expect(seenPositional).toEqual({ category: 'sources' });
    expect(seenFlags).toEqual({ list: true });
    expect(stdoutSpy).toHaveBeenCalledWith(JSON.stringify({ category: 'sources', paths: ['src/'] }) + '\n');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('`run` still works with no positional/flags supplied (backward compatible with the 1-arg call shape)', async () => {
    const commands = buildCliCommands(FLAT_MODULES, { resolveRoot: () => '/fixture-root', buildParams: () => ({}) });
    const flat = findCommand(commands, 'paths', '');
    await expect(flat.run('console')).resolves.toBeUndefined();
  });
});

describe('CliCommand.run — dispatch behavior', () => {
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

  it('a successful read-only call renders the CoreResult value as JSON on stdout and exits 0', async () => {
    await findCommand(buildTestCommands(), 'dna', 'show').run('console');
    expect(stdoutSpy).toHaveBeenCalledWith(JSON.stringify({ hello: 'world' }, null, 2) + '\n');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('--format json renders a compact single JSON value on stdout', async () => {
    await findCommand(buildTestCommands(), 'dna', 'show').run('json');
    expect(stdoutSpy).toHaveBeenCalledWith(JSON.stringify({ hello: 'world' }) + '\n');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('--format yaml renders the same value as YAML on stdout', async () => {
    await findCommand(buildTestCommands(), 'dna', 'show').run('yaml');
    const written = stdoutSpy.mock.calls[0][0] as string;
    expect(written).toContain('hello: world');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('an invalid --format value exits 2 with a usage error on stderr, and never calls the core fn', async () => {
    await findCommand(buildTestCommands(), 'dna', 'show').run('xml');
    expect(stderrSpy).toHaveBeenCalledWith(
      'error: invalid --format value "xml", expected one of: console, json, yaml\n',
    );
    expect(exitSpy).toHaveBeenCalledWith(2);
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it('a CoreResult.error from a mutating op emits `error: <reason>` on stderr and exits 1', async () => {
    await findCommand(buildTestCommands(), 'memory', 'approve').run('console');
    expect(stderrSpy).toHaveBeenCalledWith('error: illegal transition: draft to approved\n');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('--format json renders a single JSON error object on stderr and exits 1', async () => {
    await findCommand(buildTestCommands(), 'memory', 'approve').run('json');
    expect(stderrSpy).toHaveBeenCalledWith(JSON.stringify({ error: 'illegal transition: draft to approved' }) + '\n');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('--format yaml renders a CoreResult.error as YAML on stderr and exits 1', async () => {
    await findCommand(buildTestCommands(), 'memory', 'approve').run('yaml');
    const written = stderrSpy.mock.calls[0][0] as string;
    expect(written).toContain('illegal transition: draft to approved');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('a successful mutating call still exits 0 and renders the value (commit metadata is not part of the payload)', async () => {
    await findCommand(buildTestCommands(), 'dna', 'set').run('json');
    expect(stdoutSpy).toHaveBeenCalledWith(JSON.stringify({ committed: true }) + '\n');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('an uncaught exception from the core fn is still reported through emitError/exitWith(1), never a bare crash', async () => {
    const commands = buildCliCommands(
      [{ name: 'x', operations: { xBoom: { name: 'xBoom', mutates: false, fn: async () => { throw new Error('boom'); } } } }],
      { resolveRoot: () => '/fixture-root', buildParams: () => ({}) },
    );
    await findCommand(commands, 'x', 'boom').run('console');
    expect(stderrSpy).toHaveBeenCalledWith('error: boom\n');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('a resolveRoot() failure (no git root) is reported via emitError/exitWith(1), not an escaped throw (bug-002)', async () => {
    const commands = buildCliCommands(FIXTURE_MODULES, {
      resolveRoot: () => {
        throw new StorageError(E_NO_GIT_ROOT, 'not inside a WingFoil project (no .git found)');
      },
      buildParams: (ctx) => ({ root: ctx.root }),
    });
    await findCommand(commands, 'dna', 'show').run('console');
    expect(stderrSpy).toHaveBeenCalledWith('error: E_NO_GIT_ROOT: not inside a WingFoil project (no .git found)\n');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it('an uncaught non-Error throw (e.g. a plain string) is still stringified and reported the same way', async () => {
    const commands = buildCliCommands(
      [{ name: 'x', operations: { xBoom: { name: 'xBoom', mutates: false, fn: async () => { throw 'boom-string'; } } } }],
      { resolveRoot: () => '/fixture-root', buildParams: () => ({}) },
    );
    await findCommand(commands, 'x', 'boom').run('console');
    expect(stderrSpy).toHaveBeenCalledWith('error: boom-string\n');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe('positional argument threading (task-026-implement-dna-show — generic seam reused by task-025/028)', () => {
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

  /** A one-operation module whose core fn just echoes back whatever params it received. */
  function echoCommand(): CliCommand {
    const commands = buildCliCommands(
      [{ name: 'x', operations: { xEcho: { name: 'xEcho', mutates: false, fn: async (params) => coreOk(params) } } }],
      {
        resolveRoot: () => '/fixture-root',
        buildParams: (ctx) => ({ root: ctx.root, positional: ctx.positional }),
      },
    );
    return findCommand(commands, 'x', 'echo');
  }

  it('`CliCommand.run`\'s optional second argument reaches `buildParams` as `ctx.positional`, generically (not dna-specific)', async () => {
    await echoCommand().run('json', 'some-section');
    expect(stdoutSpy).toHaveBeenCalledWith(JSON.stringify({ root: '/fixture-root', positional: 'some-section' }) + '\n');
  });

  it('an omitted positional argument is threaded through as `undefined`', async () => {
    await echoCommand().run('json');
    expect(stdoutSpy).toHaveBeenCalledWith(JSON.stringify({ root: '/fixture-root' }) + '\n');
  });
});

describe('exit-code matrix (REQ-INT-04, task-012) — dispatch routes 0/1/2 through core selection', () => {
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

  /** A one-operation module whose single op returns the given CoreResult, for driving `.run`. */
  function commandReturning(result: CoreResult<unknown>): CliCommand {
    const commands = buildCliCommands(
      [{ name: 'x', operations: { xDo: { name: 'xDo', mutates: false, fn: async () => result } } }],
      { resolveRoot: () => '/fixture-root', buildParams: () => ({}) },
    );
    return findCommand(commands, 'x', 'do');
  }

  it('success → exit 0', async () => {
    await commandReturning(coreOk({ ok: true })).run('console');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  const LOGIC_ERROR_CODES: readonly CoreErrorCode[] = [
    'NOT_FOUND',
    'INVALID_TRANSITION',
    'VALIDATION',
    'CONFLICT',
    'IO',
  ];

  it.each(LOGIC_ERROR_CODES)('a %s CoreResult.error → exit 1 (logic error)', async (code) => {
    await commandReturning(coreErr({ code, message: `boom: ${code}` })).run('console');
    expect(exitSpy).toHaveBeenLastCalledWith(1);
    expect(stderrSpy).toHaveBeenCalledWith(`error: boom: ${code}\n`);
  });

  it('an invalid --format value → exit 2 (usage error, decided pre-core by the CLI)', async () => {
    await commandReturning(coreOk({ ok: true })).run('xml');
    expect(exitSpy).toHaveBeenCalledWith(2);
    expect(stdoutSpy).not.toHaveBeenCalled();
  });
});
