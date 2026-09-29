/** Outcome of {@link checkReleaseTag}. */
export interface ReleaseTagCheck {
  /**
   * `true` only when the tag is `vX.Y.Z` and equals `v` + the package version, and `server.json`'s
   * `version` and every `packages[].version` equal that same version.
   */
  readonly ok: boolean;
  /** One human-readable line explaining the verdict. */
  readonly message: string;
}

/** The part of the MCP Registry `server.json` the version check reads (spec-015 §1a). */
export interface ServerJsonVersions {
  /** The listing's own version. */
  readonly version?: unknown;
  /** One entry per distributed package; each carries its own `version`. */
  readonly packages?: unknown;
}

/**
 * spec-015 §4: the release tag must be `vX.Y.Z` and equal `v` + `package.json` `version`, and
 * `server.json` `version` and every `packages[].version` must equal `package.json` `version`
 * (`dl-093` point 5, option (a)).
 */
export function checkReleaseTag(
  tag: string | undefined,
  version: string,
  server: ServerJsonVersions | undefined,
): ReleaseTagCheck;
