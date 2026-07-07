/**
 * task-030-implement-mcp-resources (P5.2.1, spec-014-mcp-server-entry-point §1) — `runMcp`, the
 * `wingfoil mcp` command handler. Mirrors `test/cli/init-command.test.ts`: the side-effecting server
 * start is INJECTED, so the resolve-root / error / exit path is asserted without ever opening a real
 * `StdioServerTransport` against a repo (HARD RULE — no real stdio server in a test). The production
 * `startMcpServer` is only wired as the default `deps.start`; here it is always overridden.
 */
import { runMcp, type McpCliDeps } from '../../src/cli/mcp-command';

describe('runMcp — the `wingfoil mcp` command handler (spec-014 §1)', () => {
  let exitSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;
  let startCalls: Array<{ root: string; name: string; version: string }>;

  beforeEach(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    startCalls = [];
  });
  afterEach(() => {
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  function deps(over: Partial<McpCliDeps> = {}): McpCliDeps {
    return {
      resolveRoot: () => '/repo',
      version: '1.2.3',
      start: async (options) => {
        startCalls.push({ root: options.resolveRoot(), name: options.name, version: options.version });
        return undefined;
      },
      ...over,
    };
  }

  it('starts the server with the resolved root, the wingfoil name, and the given version — no exit, no error', async () => {
    await runMcp(deps());

    expect(startCalls).toEqual([{ root: '/repo', name: 'wingfoil', version: '1.2.3' }]);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('when the project root cannot be resolved, emits an error and exits 1 without ever starting the server', async () => {
    await runMcp(
      deps({
        resolveRoot: () => {
          throw new Error('not a WingFoil project (no .wingfoil/ found)');
        },
      }),
    );

    expect(startCalls).toEqual([]);
    expect(exitSpy).toHaveBeenCalledWith(1);
    const emitted = stderrSpy.mock.calls.map((call) => String(call[0])).join('');
    expect(emitted).toContain('not a WingFoil project');
  });

  it('the injected start receives a resolveRoot that returns the already-resolved root (resolved once, up front)', async () => {
    let resolveCount = 0;
    await runMcp(
      deps({
        resolveRoot: () => {
          resolveCount += 1;
          return '/some/project';
        },
      }),
    );
    // The pre-flight resolves the root exactly once; the closure handed to start returns that value.
    expect(resolveCount).toBe(1);
    expect(startCalls).toEqual([{ root: '/some/project', name: 'wingfoil', version: '1.2.3' }]);
  });
});
