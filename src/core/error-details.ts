/**
 * What of a {@link CoreError}'s `details` every surface shows (task-130, `dl-055` option 1,
 * `spec-005` §3, `spec-004`).
 *
 * Every core refusal built from a `ValidationError` carries `details: { issues }`, and two fields of
 * an issue are for the operator: the `file` it was found in (`bug-031`'s missing file name) and the
 * `detail` that explains a pinned contract message (`dl-032` option (c)). Until this module no surface
 * read either. Deciding *which* fields are shown once, here, is what keeps the CLI (`src/cli/error.ts`)
 * and the MCP registrar (`src/mcp/registrar.ts`) from drifting apart (REQ-SYS-05); each surface only
 * decides how to write the list in its own format.
 */
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
 */
export function errorDetails(error: CoreError): readonly ErrorDetail[] {
  const issues = error.details?.issues;
  if (!Array.isArray(issues)) return [];
  const entries: ErrorDetail[] = [];
  for (const issue of issues as readonly unknown[]) {
    if (typeof issue !== 'object' || issue === null) continue;
    const { file, detail } = issue as { file?: unknown; detail?: unknown };
    const entry: ErrorDetail = {
      ...(typeof file === 'string' && file !== '' ? { file } : {}),
      ...(typeof detail === 'string' && detail !== '' ? { detail } : {}),
    };
    if (entry.file !== undefined || entry.detail !== undefined) entries.push(entry);
  }
  return entries;
}
