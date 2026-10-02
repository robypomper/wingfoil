/**
 * A directive's `version:` frontmatter key is never a reason to fail the Directives pillar
 * (`spec-013-directive-frontmatter-schema`, Revision 2026-10-01; approver ruling R1 at `task-144`'s
 * review, 2026-10-02). It accepts a string or a number, like `memory.yaml`'s and `roles.yaml`'s own
 * `version`. Two cases still deserve a word to the author, and this module decides them over the parsed
 * frontmatter plus the frontmatter's own text:
 *
 * - **An unquoted number that does not read back as written.** YAML reads `version: 1.10` as the
 *   number `1.1`, and `version: 1.0` as `1`: the digits the author typed are lost. The value loads as
 *   parsed, and the warning tells the author to quote it.
 * - **A value that is neither a string nor a number** (a list, a mapping, a boolean). It is dropped
 *   before validation, with a warning, so the rest of the file — and every other directive — still
 *   loads.
 *
 * Pure (REQ-SYS-07): the caller decides where the warning goes (`loadDirectiveInventory` puts it in its
 * `warnings` as `directive '<.wingfoil/directives/…>': <warning>`).
 */

/** The parsed frontmatter, possibly without its `version`, and the warning to show, if any. */
export interface DirectiveVersionCheck {
  readonly data: unknown;
  readonly warning: string | null;
}

/**
 * The scalar written after `version:` on its own top-level line of `frontmatterText`, or `null` when
 * there is no such line. A trailing `# comment` is not part of the value.
 */
function writtenVersionToken(frontmatterText: string): string | null {
  const match = /^version:[ \t]*([^\s#]+)/m.exec(frontmatterText);
  return match?.[1] ?? null;
}

/**
 * Check `data.version` against the text it was parsed from. Returns `data` unchanged unless the
 * version is neither a string nor a number, in which case a shallow copy without `version` is returned.
 */
export function checkDirectiveVersion(data: unknown, frontmatterText: string): DirectiveVersionCheck {
  if (data === null || typeof data !== 'object' || Array.isArray(data) || !('version' in data)) {
    return { data, warning: null };
  }
  const { version, ...rest } = data as Record<string, unknown>;
  if (typeof version === 'string') return { data, warning: null };
  if (typeof version === 'number') {
    const written = writtenVersionToken(frontmatterText);
    if (written === null || written === String(version)) return { data, warning: null };
    return {
      data,
      warning: `version: ${written} reads as the number ${String(version)}; quote it (version: "${written}") to keep it as written`,
    };
  }
  return { data: rest, warning: 'version must be a string or a number; ignored' };
}
