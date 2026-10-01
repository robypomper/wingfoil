/**
 * The consistent error format (spec-005-cli-command-contract §3, REQ-INT-08). Written from the
 * spec's own code listing so `src/cli` and the spec cannot drift.
 */
import { dump as yamlDump } from 'js-yaml';

import type { ErrorDetail } from '../core/error-details';

import type { OutputFormat } from './output';

/**
 * Write an error to stderr in the consistent spec-005 §3 format for the active `--format`: a
 * `{error, hint?, details?}` object for `json`/`yaml`, or `error: <reason>` (+ optional `hint:` line,
 * + one indented line per detail) for `console`. Writes only; the caller terminates via
 * {@link exitWith}.
 *
 * `details` (task-130, `dl-055` option 1) is additive in every format: the `error:` line stays the
 * first line and byte-identical, and the structured `details` key is omitted when the list is empty,
 * so a consumer that reads only `error` is unaffected. A detail line is indented, and so is every
 * continuation line of a multi-line detail, so no line of it can begin with the greppable `error: `
 * or `hint: ` token.
 */
export function emitError(
  reason: string,
  opts: { format: OutputFormat; hint?: string; details?: readonly ErrorDetail[] },
): void {
  const details = opts.details ?? [];
  const payload = {
    error: reason,
    ...(opts.hint ? { hint: opts.hint } : {}),
    ...(details.length > 0 ? { details } : {}),
  };
  if (opts.format === 'json') {
    process.stderr.write(JSON.stringify(payload) + '\n');
  } else if (opts.format === 'yaml') {
    process.stderr.write(yamlDump(payload));
  } else {
    process.stderr.write(`error: ${reason}\n`);
    if (opts.hint) process.stderr.write(`hint: ${opts.hint}\n`);
    for (const detail of details) process.stderr.write(`  ${detailLine(detail).replace(/\n/g, '\n    ')}\n`);
  }
}

/** One console detail line: `<file>: <detail>`, or whichever of the two the entry has. */
function detailLine(detail: ErrorDetail): string {
  if (detail.file !== undefined && detail.detail !== undefined) return `${detail.file}: ${detail.detail}`;
  return detail.file ?? detail.detail ?? '';
}
