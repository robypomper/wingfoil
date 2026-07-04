/**
 * Zod-issue → {@link ValidationError} mapper (spec-009-validation-strategy §3).
 *
 * Every Pass-1 Zod issue is mapped to an `E_*` code via the caller-supplied `ErrorMap` (keyed by
 * dot-path). Any issue whose path has no entry falls back to `E_VALIDATION`, so no failure is ever
 * silently dropped for lack of a specific code.
 */
import type { ZodError } from 'zod';

import { E_VALIDATION, ValidationError, ValidationIssue } from './errors';

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
