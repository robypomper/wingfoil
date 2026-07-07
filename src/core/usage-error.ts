/**
 * `UsageError` — a core operation's signal that its *arguments* were malformed (a usage/argument
 * error, spec-005-cli-command-contract §1: "unknown flag, missing required argument, invalid flag
 * value") as opposed to a business-logic failure. task-025-implement-dna-set introduces it for
 * `dna set`'s invalid dotted key path (AC(c)), the first operation whose argument SHAPE must be
 * interpreted inside the core function (a dotted path into `dna.yaml`) yet whose failure is classified
 * as a usage error → exit **2**, not the exit **1** every `CoreError` maps to (`./exit-code.ts`).
 *
 * Why a thrown error rather than a `CoreResult.error`: the fixed `CoreError.code` enumeration
 * (spec-006-core-domain-api §2) is all logic errors (exit 1) by design — `./exit-code.ts` documents
 * that usage errors are deliberately not modeled there — so a usage error a core op detects is carried
 * out to the single surface exit path as a throw, mapped by `exitCodeForThrow` (`./exit-code.ts`).
 * `.message` is the clean, ready-to-render reason (spec-005 §3: `error: <reason>`), never a composite.
 */
export class UsageError extends Error {
  /** Usage/argument error → exit 2 (spec-005-cli-command-contract §1, spec-008-cli-grammar §5). */
  readonly exitCode = 2;

  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
    // Restore the prototype chain so `instanceof UsageError` holds after transpilation.
    Object.setPrototypeOf(this, UsageError.prototype);
  }
}
