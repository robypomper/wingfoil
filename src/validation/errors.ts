/**
 * Shared validation error types and exit codes (spec-009-validation-strategy §3).
 *
 * A single {@link ValidationError} carries the full list of mapped issues from one validation run
 * so no failure is ever silently dropped. Its {@link ValidationError.exitCode} follows spec-009 §3,
 * which keys the code on the **nature** of the failure, not on the pass that detects it: parse and
 * system-integrity failures exit `2`; every other validation failure — field-level, mapped, generic,
 * and business-rule failures detected in Pass 2 (e.g. `E_INVALID_TRANSITION`, `E_INVALID_STATE`) —
 * exits `1`, matching spec-008's exit-code table.
 */

/** A single mapped validation failure — one Zod issue or one semantic-check failure. */
export interface ValidationIssue {
  /** `E_*` code from the shared convention (spec-009 §3), e.g. `E_INVALID_ID`, `E_VALIDATION`. */
  readonly code: string;
  /** Dot-joined path to the offending field (empty string for whole-document failures). */
  readonly path: string;
  /** Path of the file the failure was found in. */
  readonly file: string;
  /** Human-readable description (typically the raw Zod message). */
  readonly message: string;
  /**
   * Optional longer explanation kept apart from {@link message} — for a failure whose `message` is a
   * pinned contract string, the diagnostic that says *why* travels here instead of replacing it
   * (`dl-032-illegal-transition-message-contract`, option (c)). Absent for most issues.
   */
  readonly detail?: string;
}

/**
 * Process exit code for a validation failure whose worst issue is a mapped `E_INVALID_*` /
 * `E_INVALID_*_SCHEMA` or the generic `E_VALIDATION` fallback (spec-009 §3, spec-008 exit table).
 */
export const EXIT_VALIDATION = 1;

/**
 * Process exit code for a parse or system-integrity failure — `E_YAML_PARSE_ERROR`, and the
 * cross-file integrity checks that presuppose a parseable tree: the input could not be understood,
 * or the installation is inconsistent (spec-009 §3, spec-008 exit table). **Not** every Pass-2
 * failure: spec-009 §3 keys exit codes on the nature of the failure, not the pass, so a business-rule
 * failure found in Pass 2 (an illegal transition, an invalid state) exits {@link EXIT_VALIDATION}.
 */
export const EXIT_INTEGRITY = 2;

/** `E_*` code emitted when a file cannot be parsed as YAML at all, before Zod runs (spec-009 §3). */
export const E_YAML_PARSE_ERROR = 'E_YAML_PARSE_ERROR';

/** Generic fallback code for any issue with no explicit `ErrorMap` entry (spec-009 §3). */
export const E_VALIDATION = 'E_VALIDATION';

/**
 * The single error type thrown by every validation path. Extends {@link Error} so it integrates
 * with normal throw/catch, but always carries the structured {@link issues} list and the process
 * {@link exitCode} the CLI/MCP surface should exit with.
 */
export class ValidationError extends Error {
  readonly issues: readonly ValidationIssue[];
  readonly exitCode: number;

  constructor(issues: ValidationIssue[], exitCode: number = EXIT_VALIDATION) {
    super(
      issues.length > 0
        ? issues.map((i) => `${i.code} ${i.path ? `${i.path} ` : ''}(${i.file}): ${i.message}`).join('; ')
        : 'validation failed',
    );
    this.name = 'ValidationError';
    this.issues = issues;
    this.exitCode = exitCode;
    // Restore the prototype chain so `instanceof ValidationError` holds after transpilation.
    Object.setPrototypeOf(this, ValidationError.prototype);
  }

  /**
   * Build a pre-parse YAML failure. Exits `2` (integrity) because it means the file could not even
   * be turned into a data structure — Zod never ran.
   */
  static yamlParse(filePath: string, message: string): ValidationError {
    return new ValidationError(
      [{ code: E_YAML_PARSE_ERROR, path: '', file: filePath, message }],
      EXIT_INTEGRITY,
    );
  }

  /**
   * Build a **system-integrity** failure detected after parsing. Exits `2` ({@link EXIT_INTEGRITY}).
   * Use it only when the input could not be understood or the installation is inconsistent (e.g. a
   * loader's cross-file check, a malformed `id_pattern`). It is **not** the constructor for every
   * Pass-2 check: spec-009 §3 keys exit codes on the nature of the failure, not the detecting pass,
   * so a business-rule failure found in Pass 2 (`E_INVALID_TRANSITION`, `E_INVALID_STATE`) is built
   * with the plain constructor and exits `1`.
   */
  static semantic(issues: ValidationIssue[]): ValidationError {
    return new ValidationError(issues, EXIT_INTEGRITY);
  }
}
