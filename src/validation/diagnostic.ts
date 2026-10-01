/**
 * The configuration diagnostic shape (spec-003-workflows-yaml-schema § "Diagnostics"; shared by
 * spec-017-workflow-commands-and-state-deduction §2): `{ code, severity, file, path, message }`,
 * carried by commands in one array named `diagnostics`.
 *
 * A {@link Diagnostic} is a {@link ValidationIssue} with a `severity`, so a list of them can ride a
 * {@link ValidationError} unchanged; {@link DiagnosticsError} is the error a loader throws when the
 * list holds at least one `error`.
 */
import { EXIT_VALIDATION, ValidationError, ValidationIssue } from './errors';

/** `error` makes the operation fail; `warning` is reported and the operation goes on (spec-003). */
export type DiagnosticSeverity = 'error' | 'warning';

/** One load-time or deduction diagnostic (spec-003 § "Diagnostics", "Shape"). */
export interface Diagnostic extends ValidationIssue {
  /** `E_*` for an error, `W_*` for a warning. */
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  /** The configuration file, relative to `.wingfoil/` (e.g. `workflows/custom/dev-loop.yaml`). */
  readonly file: string;
  /** Locates the field inside `file`, e.g. `phases[3].include`; `''` for the whole file. */
  readonly path: string;
  readonly message: string;
}

/**
 * The failure of a load whose {@link diagnostics} hold at least one error (spec-003 § "Diagnostics"):
 * `VALIDATION`, exit `1` ({@link EXIT_VALIDATION}). Its `message` is the **first error's** message —
 * the reason the operation reports — and {@link diagnostics} is the whole ordered list, warnings
 * included, for the caller to carry in `details` (`dl-055`).
 */
export class DiagnosticsError extends ValidationError {
  readonly diagnostics: readonly Diagnostic[];

  constructor(diagnostics: readonly Diagnostic[]) {
    super([...diagnostics], EXIT_VALIDATION);
    const first = diagnostics.find((d) => d.severity === 'error') ?? diagnostics[0];
    this.message = first?.message ?? 'validation failed';
    this.name = 'DiagnosticsError';
    this.diagnostics = diagnostics;
    Object.setPrototypeOf(this, DiagnosticsError.prototype);
  }
}
