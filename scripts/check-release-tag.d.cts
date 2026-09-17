/** Outcome of {@link checkReleaseTag}. */
export interface ReleaseTagCheck {
  /** `true` only when the tag is `vX.Y.Z` and equals `v` + the package version. */
  readonly ok: boolean;
  /** One human-readable line explaining the verdict. */
  readonly message: string;
}

/** spec-015 §4: the release tag must be `vX.Y.Z` and equal `v` + `package.json` `version`. */
export function checkReleaseTag(tag: string | undefined, version: string): ReleaseTagCheck;
