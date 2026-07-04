import { z } from 'zod';

import { EXIT_INTEGRITY, EXIT_VALIDATION, ValidationError } from '../../src/validation/errors';
import { toValidationError } from '../../src/validation/error-mapper';

function zodErrorFor(schema: z.ZodType, raw: unknown): z.ZodError {
  const result = schema.safeParse(raw);
  if (result.success) {
    throw new Error('test setup: expected the schema to reject this input');
  }
  return result.error;
}

// spec-009 §3 — shared error-code convention: three families + a generic E_VALIDATION fallback,
// and the documented exit codes (2 for parse/cross-field integrity, 1 for mapped/generic).
describe('toValidationError — shared error-code convention (spec-009 §3)', () => {
  it('maps a whole-document Pass-1 failure to its E_INVALID_<SCHEMA>_SCHEMA code', () => {
    const schema = z.object({ version: z.number() }).passthrough();
    const err = toValidationError(zodErrorFor(schema, { version: 'x' }), 'memory.yaml', {
      version: 'E_INVALID_MEMORY_YAML_SCHEMA',
    });
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.issues.map((i) => i.code)).toEqual(['E_INVALID_MEMORY_YAML_SCHEMA']);
    expect(err.issues.map((i) => i.path)).toEqual(['version']);
    expect(err.issues.map((i) => i.file)).toEqual(['memory.yaml']);
  });

  it('maps a named field failure to its E_INVALID_<X> code', () => {
    const schema = z.object({ id: z.string() }).passthrough();
    const err = toValidationError(zodErrorFor(schema, { id: 42 }), 'doc.md', { id: 'E_INVALID_ID' });
    expect(err.issues.map((i) => i.code)).toEqual(['E_INVALID_ID']);
  });

  it('falls back to E_VALIDATION for any issue path with no ErrorMap entry (no silent drop)', () => {
    const schema = z.object({ a: z.string(), b: z.number() }).passthrough();
    const err = toValidationError(zodErrorFor(schema, { a: 1, b: 'x' }), 'doc.md', {
      a: 'E_INVALID_A',
    });
    expect(err.issues).toHaveLength(2);
    expect(err.issues.map((i) => [i.path, i.code])).toEqual(
      expect.arrayContaining([
        ['a', 'E_INVALID_A'],
        ['b', 'E_VALIDATION'],
      ]),
    );
  });

  it('carries exit code 1 for a mapped/generic Pass-1 validation failure', () => {
    const schema = z.object({ id: z.string() }).passthrough();
    const err = toValidationError(zodErrorFor(schema, { id: 42 }), 'doc.md', { id: 'E_INVALID_ID' });
    expect(err.exitCode).toBe(EXIT_VALIDATION);
    expect(EXIT_VALIDATION).toBe(1);
  });

  it('carries E_YAML_PARSE_ERROR and exit code 2 for a pre-parse YAML failure', () => {
    const err = ValidationError.yamlParse('broken.yaml', 'unexpected end of stream');
    expect(err.issues.map((i) => i.code)).toEqual(['E_YAML_PARSE_ERROR']);
    expect(err.exitCode).toBe(EXIT_INTEGRITY);
    expect(EXIT_INTEGRITY).toBe(2);
  });

  it('carries exit code 2 for a Pass-2 cross-field/semantic failure', () => {
    const err = ValidationError.semantic([
      {
        code: 'E_INVALID_GATES_REF',
        path: 'gates',
        file: 'workflows.yaml',
        message: 'gates references a step not in sequence',
      },
    ]);
    expect(err.exitCode).toBe(EXIT_INTEGRITY);
    expect(err.issues.map((i) => i.code)).toEqual(['E_INVALID_GATES_REF']);
  });
});
