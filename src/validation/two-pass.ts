/**
 * Two-pass validation pipeline (spec-009-validation-strategy §1).
 *
 * Pass 1 is the structural Zod parse (`schema.safeParse`); on failure it is fatal and Pass 2 never
 * runs. On success the unknown-field warning fires once (spec-009 §2), then every caller-supplied
 * semantic check (Pass 2) executes in order. The typed, parsed data is returned.
 */
import type { ZodType } from 'zod';

import { toValidationError } from './error-mapper';
import { emitUnknownFieldWarning, HasShape } from './warning';

/** A Pass-2 semantic / cross-field check: returns silently on success, throws on failure. */
export type SemanticCheck = () => void;

/** Optional inputs to {@link runValidation}: the Pass-1 error-code map and the ordered Pass-2 checks. */
export interface RunValidationOptions {
  /** Dot-path → `E_*` code map for Pass-1 issues (spec-009 §3). */
  errorMap?: Record<string, string>;
  /** Pass-2 checks, run in order only after Pass 1 succeeds. */
  semanticChecks?: SemanticCheck[];
}

/**
 * Run the two-pass pipeline (spec-009 §1) for one file: Pass 1 is `schema.safeParse` (fatal on
 * failure, mapped via {@link toValidationError}); on success the unknown-field warning fires once,
 * then every `semanticChecks` entry runs in order. Returns the typed, parsed data.
 */
export function runValidation<T>(
  schema: ZodType<T>,
  raw: unknown,
  filePath: string,
  opts: RunValidationOptions = {},
): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    // Pass 1 fatal — Pass 2 never runs.
    throw toValidationError(result.error, filePath, opts.errorMap);
  }
  // Every consuming schema is a `.passthrough()` object (spec-009 Consequences), so it exposes
  // `.shape`; the cast narrows the generic `ZodType<T>` to that structural view for the warning.
  emitUnknownFieldWarning(
    raw as Record<string, unknown>,
    schema as unknown as HasShape,
    filePath,
  ); // fires regardless of Pass-2 outcome (spec-009 §2)
  for (const check of opts.semanticChecks ?? []) check(); // Pass 2
  return result.data;
}
