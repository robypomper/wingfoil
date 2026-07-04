import { z } from 'zod';

import { ValidationError } from '../../src/validation/errors';
import { runValidation } from '../../src/validation/two-pass';

// spec-009 §1 — two-pass model. Pass 2 (semantic checks) must never run when Pass 1
// (Zod structural parse) fails, and all Pass-1 issues must be collected (not just the first).
describe('runValidation — two-pass pipeline (spec-009 §1)', () => {
  const schema = z.object({ name: z.string() }).passthrough();

  it('returns typed data when Pass 1 succeeds and runs every semantic check (Pass 2)', () => {
    const check = jest.fn();
    const data = runValidation(schema, { name: 'ok' }, 'f.yaml', { semanticChecks: [check] });
    expect(data).toEqual({ name: 'ok' });
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('never runs Pass 2 when Pass 1 fails (call-count spy, not just output)', () => {
    const check = jest.fn();
    expect(() =>
      runValidation(schema, { name: 123 }, 'f.yaml', { semanticChecks: [check] }),
    ).toThrow(ValidationError);
    expect(check).not.toHaveBeenCalled();
  });

  it('collects ALL Pass-1 Zod issues, not only the first (spec-009 §1 step 3)', () => {
    const multi = z.object({ a: z.string(), b: z.number() }).passthrough();
    let thrown: unknown;
    try {
      runValidation(multi, { a: 1, b: 'x' }, 'f.yaml');
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ValidationError);
    expect((thrown as ValidationError).issues).toHaveLength(2);
  });

  it('emits the unknown-field warning after a successful Pass 1 and before Pass 2', () => {
    const order: string[] = [];
    const spy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation((...args: unknown[]): boolean => {
        void args;
        order.push('warn');
        return true;
      });
    const check = jest.fn(() => order.push('check'));
    runValidation(schema, { name: 'ok', extra: 1 }, 'f.yaml', { semanticChecks: [check] });
    spy.mockRestore();
    expect(order).toEqual(['warn', 'check']);
  });
});
