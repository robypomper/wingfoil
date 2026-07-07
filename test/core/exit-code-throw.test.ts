/**
 * `exitCodeForThrow` (spec-005-cli-command-contract §1, spec-008-cli-grammar §5 exit table,
 * task-025-implement-dna-set). The surface (`src/cli`, `src/mcp`) catches a *thrown* error from a core
 * op and must know both the exit code and the human reason to render — and, per spec-008 Consequences,
 * `src/core` owns that selection, not the surface. This is the throw-path companion to
 * `exitCodeForResult` (the return-path selector, task-012): a `UsageError` (a malformed argument, e.g.
 * an invalid dotted key path) maps to exit 2; a `ValidationError` uses its own `exitCode` (integrity ->
 * 2, field-level -> 1) with a reason drawn from its issues; anything else is exit 1.
 */
import { exitCodeForThrow } from '../../src/core/exit-code';
import { UsageError } from '../../src/core/usage-error';
import { ValidationError } from '../../src/validation';

describe('exitCodeForThrow — thrown error -> { reason, exitCode }', () => {
  it('maps a UsageError to exit 2 with its clean message verbatim', () => {
    expect(exitCodeForThrow(new UsageError("invalid key path: '..language'"))).toEqual({
      reason: "invalid key path: '..language'",
      exitCode: 2,
    });
  });

  it('maps an integrity ValidationError (exitCode 2) to exit 2, reason from its issues', () => {
    const error = ValidationError.semantic([{ code: 'E_X', path: 'p', file: 'f', message: 'boom' }]);
    expect(exitCodeForThrow(error)).toEqual({ reason: 'boom', exitCode: 2 });
  });

  it('maps a field-level ValidationError (default exitCode 1) to exit 1', () => {
    const error = new ValidationError([{ code: 'E_X', path: '', file: 'f', message: 'bad' }]);
    expect(exitCodeForThrow(error)).toEqual({ reason: 'bad', exitCode: 1 });
  });

  it('maps a generic Error to exit 1 with its message', () => {
    expect(exitCodeForThrow(new Error('nope'))).toEqual({ reason: 'nope', exitCode: 1 });
  });

  it('stringifies a non-Error throw and exits 1', () => {
    expect(exitCodeForThrow('weird')).toEqual({ reason: 'weird', exitCode: 1 });
  });
});
