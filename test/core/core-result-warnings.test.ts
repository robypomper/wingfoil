/**
 * task-169 (`dl-062` Q1 option 3, addendum "Implementation scheduling" §2) — the success arm of
 * `CoreResult` carries `warnings`: what a successful operation wants the operator told, on a channel
 * that is not the operation's value. `coreOk` accepts them; an empty list is the same as none, so the
 * shape every existing success had is unchanged (no `warnings` key at all).

 */
import { coreOk } from '../../src/core/types';


describe('coreOk — the success-warning channel (task-169)', () => {
  it('carries the warnings it is given, in order, beside the value and the commit', () => {
    const commit = { sha: 'abc123', message: 'wf(directive): assign a to developer' };
    expect(coreOk({ a: 1 }, commit, ['first', 'second'])).toEqual({
      ok: true,
      value: { a: 1 },
      commit,
      warnings: ['first', 'second'],
    });
  });

  it('carries warnings on a success that made no commit', () => {
    expect(coreOk('v', undefined, ['only'])).toEqual({ ok: true, value: 'v', warnings: ['only'] });
  });

  it('characterization: no warnings, or an empty list, leaves no `warnings` key', () => {
    expect(coreOk('v')).toEqual({ ok: true, value: 'v' });
    expect(Object.keys(coreOk('v', undefined, []))).toEqual(['ok', 'value']);
  });
});
