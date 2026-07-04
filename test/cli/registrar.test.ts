/**
 * `src/cli`'s registrar — the thin adapter that derives `wingfoil <noun> <verb>` Commander
 * subcommands from a `CoreModule[]` registry (spec-006 §2/§4, spec-005 exit-code/format/error
 * contract, spec-008 grammar). No business logic here: these tests only exercise
 * parse-argv -> call-core-fn -> render-CoreResult, never a real domain operation.
 */
import type { CoreModule } from '../../src/core/registry';
import { coreErr, coreOk } from '../../src/core/types';
import { buildProgram, listRegisteredCliCommands } from '../../src/cli/registrar';

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

function buildTestProgram() {
  return buildProgram(FIXTURE_MODULES, {
    resolveRoot: () => '/fixture-root',
    buildParams: () => ({}),
  });
}

describe('buildProgram — CLI command registration (spec-006 §4: CLI exposes every operation)', () => {
  it('registers one `wingfoil <noun> <verb>` command per operation, regardless of `mutates`', () => {
    const program = buildTestProgram();
    expect(listRegisteredCliCommands(program)).toEqual(['dna set', 'dna show', 'memory approve']);
  });
});

describe('buildProgram — dispatch behavior', () => {
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
    const program = buildTestProgram();
    await program.parseAsync(['dna', 'show'], { from: 'user' });
    expect(stdoutSpy).toHaveBeenCalledWith(JSON.stringify({ hello: 'world' }) + '\n');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('--format yaml renders the same value as YAML on stdout', async () => {
    const program = buildTestProgram();
    await program.parseAsync(['dna', 'show', '--format', 'yaml'], { from: 'user' });
    const written = stdoutSpy.mock.calls[0][0] as string;
    expect(written).toContain('hello: world');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('an invalid --format value exits 2 with a usage error on stderr, and never calls the core fn', async () => {
    const program = buildTestProgram();
    await program.parseAsync(['dna', 'show', '--format', 'xml'], { from: 'user' });
    expect(stderrSpy).toHaveBeenCalledWith('error: invalid --format value "xml", expected one of: console, json, yaml\n');
    expect(exitSpy).toHaveBeenCalledWith(2);
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it('a CoreResult.error from a mutating op emits `error: <reason>` on stderr and exits 1', async () => {
    const program = buildTestProgram();
    await program.parseAsync(['memory', 'approve'], { from: 'user' });
    expect(stderrSpy).toHaveBeenCalledWith('error: illegal transition: draft to approved\n');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('--format json renders a single JSON error object on stderr and exits 1', async () => {
    const program = buildTestProgram();
    await program.parseAsync(['memory', 'approve', '--format', 'json'], { from: 'user' });
    expect(stderrSpy).toHaveBeenCalledWith(JSON.stringify({ error: 'illegal transition: draft to approved' }) + '\n');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('a successful mutating call still exits 0 and renders the value (commit metadata is not part of the payload)', async () => {
    const program = buildTestProgram();
    await program.parseAsync(['dna', 'set'], { from: 'user' });
    expect(stdoutSpy).toHaveBeenCalledWith(JSON.stringify({ committed: true }) + '\n');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
