/**
 * task-136 — `DiagnosticsError` (spec-003 § "Diagnostics"): `VALIDATION`, exit 1, the first **error**
 * as the reason, the whole ordered array kept.
 */
import { Diagnostic, DiagnosticsError, EXIT_VALIDATION, ValidationError } from '../../src/validation';

const warning: Diagnostic = { code: 'W_X', severity: 'warning', file: 'workflows.yaml', path: '', message: 'a warning' };
const failure: Diagnostic = { code: 'E_X', severity: 'error', file: 'workflows.yaml', path: 'include', message: 'an error' };

describe('DiagnosticsError', () => {
  it('takes the first error, with its code, path and file, as its message, even after a warning, and keeps every diagnostic', () => {
    const error = new DiagnosticsError([warning, failure]);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toBeInstanceOf(DiagnosticsError);
    expect(error.exitCode).toBe(EXIT_VALIDATION);
    expect(error.message).toBe('E_X include (workflows.yaml): an error');
    expect(error.diagnostics).toEqual([warning, failure]);
    expect(error.issues).toEqual([warning, failure]);
  });

  it('falls back to the first diagnostic, then to a generic reason', () => {
    expect(new DiagnosticsError([warning]).message).toBe('W_X (workflows.yaml): a warning');
    expect(new DiagnosticsError([]).message).toBe('validation failed');
  });
});
