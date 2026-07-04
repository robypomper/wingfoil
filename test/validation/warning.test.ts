import { z } from 'zod';

import { emitUnknownFieldWarning } from '../../src/validation/warning';

// spec-009 §2 — unknown-field warning policy. The diff MUST be raw-keys vs the schema's declared
// shape, never raw-vs-parsed: under .passthrough() the parsed object keeps every unknown key, so a
// raw-vs-parsed diff is always [] and the warning path is dead (the "known-defective mechanism").
describe('emitUnknownFieldWarning — passthrough unknown-field policy (spec-009 §2)', () => {
  let writes: string[];
  let spy: jest.SpyInstance;

  beforeEach(() => {
    writes = [];
    spy = jest.spyOn(process.stderr, 'write').mockImplementation((...args: unknown[]): boolean => {
      writes.push(String(args[0]));
      return true;
    });
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it('fires against genuinely unknown keys, diffing raw vs schema.shape', () => {
    const schema = z.object({ known: z.string() }).passthrough();
    const raw = { known: 'x', mysteryField: 'y', anotherUnknown: 1 };
    emitUnknownFieldWarning(raw, schema, 'cfg.yaml');
    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain('mysteryField');
    expect(writes[0]).toContain('anotherUnknown');
    expect(writes[0]).toContain('cfg.yaml');
  });

  it('would be a no-op under the known-defective raw-vs-parsed diff, yet still warns', () => {
    const schema = z.object({ known: z.string() }).passthrough();
    const raw = { known: 'x', unknownKey: 'y' };
    // Demonstrate the trap concretely: .passthrough() copies unknownKey onto parsed, so the
    // defective `raw` vs `parsed` diff sees nothing to warn about.
    const parsed = schema.parse(raw) as Record<string, unknown>;
    const defectiveDiff = Object.keys(raw).filter((k) => !(k in parsed));
    expect(defectiveDiff).toEqual([]); // the WRONG mechanism is blind here
    // The correct mechanism (raw vs schema.shape) must still fire.
    emitUnknownFieldWarning(raw, schema, 'cfg.yaml');
    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain('unknownKey');
  });

  it('stays silent when every raw key is declared in the schema shape', () => {
    const schema = z.object({ a: z.string(), b: z.number() }).passthrough();
    emitUnknownFieldWarning({ a: 'x', b: 1 }, schema, 'cfg.yaml');
    expect(writes).toHaveLength(0);
  });
});
