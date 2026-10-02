/**
 * task-169 (`dl-062` Q1 option 3, addendum "Implementation scheduling" §2) — the success arm of
 * `CoreResult` carries `warnings`: what a successful operation wants the operator told, on a channel
 * that is not the operation's value. `coreOk` accepts them; an empty list is the same as none, so the
 * shape every existing success had is unchanged (no `warnings` key at all).
 *
 * `coreOk` is called through an untyped view so this suite states the contract without depending on
 * the signature it is pinning.
 */
import { coreOk } from '../../src/core/types';

const coreOkWith = coreOk as unknown as (value: unknown, commit?: unknown, warnings?: readonly string[]) => unknown;

describe('coreOk — the success-warning channel (task-169)', () => {
  it('carries the warnings it is given, in order, beside the value and the commit', () => {
    const commit = { sha: 'abc123', message: 'wf(directive): assign a to developer' };
    expect(coreOkWith({ a: 1 }, commit, ['first', 'second'])).toEqual({
      ok: true,
      value: { a: 1 },
      commit,
      warnings: ['first', 'second'],
    });
  });

  it('carries warnings on a success that made no commit', () => {
    expect(coreOkWith('v', undefined, ['only'])).toEqual({ ok: true, value: 'v', warnings: ['only'] });
  });

  it('characterization: no warnings, or an empty list, leaves no `warnings` key', () => {
    expect(coreOkWith('v')).toEqual({ ok: true, value: 'v' });
    expect(Object.keys(coreOkWith('v', undefined, []) as object)).toEqual(['ok', 'value']);
  });
});
