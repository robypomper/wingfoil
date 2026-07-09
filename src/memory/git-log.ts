/**
 * Shared low-level `git log` field walk (task-015-complete-audit-trail refactor) — task-011's
 * `./history` (`getMemoryHistory`) and this task's `./audit` (`auditAttribution`) both need the same
 * "run `git log` with a custom multi-field format, split stdout into per-commit records, oldest
 * first" plumbing over a different field set/pathspec shape; this is that one shared primitive, so
 * the record-separator convention lives in exactly one place instead of being copy-pasted twice.
 */
import { execFileSync } from 'child_process';

/**
 * Field separator (ASCII unit separator, `0x1f`) between the `--format` fields of one commit — a
 * control character a real commit subject/body never contains, so splitting on it needs no escaping.
 */
export const FIELD_SEP = '\x1f';
/**
 * Record separator (ASCII record separator, `0x1e`) between commits in the `git log` output — same
 * "never appears in real commit text" guarantee as {@link FIELD_SEP}.
 */
export const RECORD_SEP = '\x1e';

/**
 * Run `git log <extraArgs> --format=<fields joined by FIELD_SEP><RECORD_SEP> -- <pathspecs>` and
 * return each matching commit's raw field list (in `fields` order, not yet destructured into a named
 * shape — that's each caller's concern), oldest first. Returns `[]` — never throws — both when `root`
 * is not a git repository at all and when none of `pathspecs` has any matching history; "not a repo"/
 * "not found" is a caller concern, not this primitive's (mirrors `getMemoryHistory`'s original
 * contract).
 */
export function walkGitLogFields(
  root: string,
  fields: readonly string[],
  pathspecs: readonly string[],
  extraArgs: readonly string[] = [],
): string[][] {
  const format = fields.join(FIELD_SEP) + RECORD_SEP;
  let stdout: string;
  try {
    stdout = execFileSync(
      'git',
      ['-C', root, 'log', ...extraArgs, `--format=${format}`, '--', ...pathspecs],
      { encoding: 'utf-8' },
    );
  } catch {
    return [];
  }

  const records = stdout
    .split(RECORD_SEP)
    .map((record) => record.replace(/^\n+/, ''))
    .filter((record) => record.length > 0);

  return records.map((record) => record.split(FIELD_SEP)).reverse();
}
