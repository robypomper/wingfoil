/**
 * What of a {@link CoreError}'s `details` every surface shows (task-130, `dl-055` option 1,
 * `spec-005` §3, `spec-004`).
 *
 * Every core refusal built from a `ValidationError` carries `details: { issues }`, and two fields of
 * an issue are for the operator: the `file` it was found in (`bug-031`'s missing file name) and the
 * `detail` that explains a pinned contract message (`dl-032` option (c)). Until this module no surface
 * read either. A spec-003 loader refusal (task-136) carries `details: { diagnostics }` instead; each
 * diagnostic is shown in the reason form (see `diagnosticDetails`). Deciding *which* fields are shown once, here, is what keeps the CLI (`src/cli/error.ts`)
 * and the MCP registrar (`src/mcp/registrar.ts`) from drifting apart (REQ-SYS-05); each surface only
 * decides how to write the list in its own format.
 */
import { formatDiagnostic, type Diagnostic } from '../validation';
import type { CoreError } from './types';

/** One operator-facing entry of a refusal: the file an issue names and/or its explanation. */
export interface ErrorDetail {
  readonly file?: string;
  readonly detail?: string;
}

/**
 * The operator-facing details of `error`, in issue order (REQ-SYS-07 — the order core recorded, never
 * re-sorted). An issue contributes an entry only when it names a non-empty `file` or `detail`, and the
 * entry carries only the fields it has. Anything else in `details` is ignored: the list is empty for
 * an error with no `details.issues`, which is the case for every error that carried no details before.
 *
 * A `file` the error's `message` already contains, verbatim, is not repeated (task-130 review):
 * `ValidationError`'s message embeds `(<file>)` for every issue, so repeating it would print the path
 * twice. The entry keeps its `detail`, and an entry left with neither field is dropped. What remains is
 * exactly what the reason does not already say — for the illegal-transition refusal, whose message is
 * the bare `dl-032` contract string, both the file and the explanation.
 */
export function errorDetails(error: CoreError): readonly ErrorDetail[] {
  const diagnostics = error.details?.diagnostics;
  if (Array.isArray(diagnostics)) return diagnosticDetails(error.message, diagnostics as readonly Diagnostic[]);
  const issues = error.details?.issues;
  if (!Array.isArray(issues)) return [];
  const entries: ErrorDetail[] = [];
  for (const issue of issues as readonly unknown[]) {
    if (typeof issue !== 'object' || issue === null) continue;
    const { file, detail } = issue as { file?: unknown; detail?: unknown };
    const entry: ErrorDetail = {
      ...(typeof file === 'string' && file !== '' && !error.message.includes(file) ? { file } : {}),
      ...(typeof detail === 'string' && detail !== '' ? { detail } : {}),
    };
    if (entry.file !== undefined || entry.detail !== undefined) entries.push(entry);
  }
  return entries;
}

/**
 * The details of a refusal that carries spec-003 `diagnostics` (task-136) rather than `issues`: one
 * entry per diagnostic, in the loader's order, its `detail` the diagnostic in the reason form
 * (`formatDiagnostic`: code, path, file and message), so every further error and every warning reaches
 * the operator. The diagnostic the reason already is — the first error — is not repeated.
 */
function diagnosticDetails(reason: string, diagnostics: readonly Diagnostic[]): readonly ErrorDetail[] {
  const entries: ErrorDetail[] = [];
  for (const diagnostic of diagnostics) {
    const line = formatDiagnostic(diagnostic);
    if (line !== reason) entries.push({ detail: line });
  }
  return entries;
}
