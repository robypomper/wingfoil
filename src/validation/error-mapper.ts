/**
 * Zod-issue → {@link ValidationError} mapper (spec-009-validation-strategy §3).
 *
 * Every Pass-1 Zod issue is mapped to an `E_*` code via the caller-supplied `ErrorMap` (keyed by
 * dot-path). Any issue whose path has no entry falls back to `E_VALIDATION`, so no failure is ever
 * silently dropped for lack of a specific code.
 */
import type { ZodError } from 'zod';

import { E_VALIDATION, ValidationError, ValidationIssue } from './errors';

/**
 * Map a Zod parse failure to a {@link ValidationError} (spec-009 §3): each issue's dot-path is looked
 * up in `errorMap` for its `E_*` code, falling back to `E_VALIDATION` so no issue is dropped. `filePath`
 * is attached to every issue for operator-facing messages.
 */
export function toValidationError(
  zodError: ZodError,
  filePath: string,
  errorMap: Record<string, string> = {},
): ValidationError {
  const issues: ValidationIssue[] = zodError.issues.map((issue) => {
    const path = issue.path.join('.');
    const code = errorMap[path] ?? E_VALIDATION;
    return { code, path, file: filePath, message: issue.message };
  });
  return new ValidationError(issues);
}
