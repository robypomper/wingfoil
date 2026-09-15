/**
 * Immutable built-in assets pre-flight check (REQ-SEC-07 — task-042-immutable-builtin-assets). Every
 * `directive remove`/`workflow remove` mutating op must call `requireCustomAsset` before writing
 * anything; anything that is not positively a file under that pillar's `custom/` subdirectory
 * (`spec-011-storage-layout`'s `{built-in,custom}` split) is refused with no side effects. Mirrors
 * `requireGitIdentity` (task-014)'s pre-flight shape: `CoreResult<void>`, safe to call before any
 * read/write, refusal code `VALIDATION`.
 *
 * The classification is an **allow-list**, so the test is written as two tables — one of shapes that
 * must be removable, one of shapes that must not — asserted against *both* exports, so the predicate
 * and the guard can never drift. The refused table deliberately goes well beyond the two shapes
 * REQ-SEC-07 names: a deny-list on the literal segment `built-in` was the first-pass defect, and it
 * failed **open** on the platform separator, on casing, on traversal and on the empty string.
 *
 * The two fit-criterion message strings are restated here rather than imported (the
 * `test/core/git-identity.test.ts` precedent): they are asserted verbatim by
 * `P3.3-directive-remove.feature` / `P4.9-workflow-remove.feature`, so the test must pin them
 * independently of whatever constant the implementation happens to hold them in.
 */
import { type AssetKind, isRemovableCustomAssetPath, requireCustomAsset } from '../../src/core/builtin-asset';

const BUILT_IN_DIRECTIVE_ERROR = 'built-in directives cannot be removed';
const BUILT_IN_WORKFLOW_ERROR = 'built-in workflows cannot be removed';

/** Shapes that ARE a removable custom asset — the entire allow-list surface. */
const REMOVABLE_SHAPES: ReadonlyArray<readonly [string, AssetKind, string]> = [
  ['a directive directly under directives/custom/', 'directive', 'directives/custom/legacy-rule.md'],
  ['a workflow directly under workflows/custom/', 'workflow', 'workflows/custom/arch-review.yaml'],
  ['a custom asset nested deeper under custom/', 'directive', 'directives/custom/p3/legacy-rule.md'],
  // It is the `custom` SEGMENT that decides, never a substring of a file name.
  ['a custom file whose NAME merely contains "built-in"', 'directive', 'directives/custom/built-in-notes.md'],
  // `src/core/loaders.ts` stores this path with the platform separator, so both forms must be accepted.
  ['the Windows-separator form of a custom directive', 'directive', 'directives\\custom\\legacy-rule.md'],
  ['the Windows-separator form of a custom workflow', 'workflow', 'workflows\\custom\\arch-review.yaml'],
];

/** Shapes that must NOT be removable — the fail-closed register. */
const REFUSED_SHAPES: ReadonlyArray<readonly [string, AssetKind, string]> = [
  // The two shapes REQ-SEC-07 names directly, plus a nested one.
  ['a built-in directive', 'directive', 'directives/built-in/testing.md'],
  ['a built-in workflow', 'workflow', 'workflows/built-in/release-cycle.yaml'],
  ['a nested built-in directive', 'directive', 'directives/built-in/p3/testing.md'],
  // The reachable defect: `src/core/loaders.ts` builds a directive's stored path with the PLATFORM
  // separator (`join('directives', relativePath)`), so on Windows a built-in arrives as
  // `directives\built-in\testing.md` — a forward-slash-only split never sees the `built-in` segment.
  ['the Windows-separator form of a built-in directive', 'directive', 'directives\\built-in\\testing.md'],
  ['the Windows-separator form of a built-in workflow', 'workflow', 'workflows\\built-in\\release-cycle.yaml'],
  ['a nested built-in via the Windows separator', 'directive', 'directives\\built-in\\p3\\testing.md'],
  ['a path mixing both separators', 'directive', 'directives\\built-in/testing.md'],
  // Casing: a case-insensitive filesystem resolves these to the protected directory.
  ['an upper-case BUILT-IN segment', 'directive', 'directives/BUILT-IN/testing.md'],
  ['a mixed-case Built-In segment', 'directive', 'directives/Built-In/testing.md'],
  ['an upper-case CUSTOM segment', 'directive', 'directives/CUSTOM/legacy-rule.md'],
  // Traversal / absolute: refused rather than resolved — a symlinked `custom/` aliasing `built-in/`
  // defeats string-level normalisation, so an ambiguous shape is never guessed at.
  ['a parent traversal', 'directive', '../../etc/passwd'],
  ['a traversal back into built-in', 'directive', 'directives/custom/../built-in/testing.md'],
  ['a single-dot segment', 'directive', './directives/custom/legacy-rule.md'],
  ['an absolute posix path', 'directive', '/etc/passwd'],
  ['an empty segment from a doubled separator', 'directive', 'directives//custom/legacy-rule.md'],
  // Shapes that are not an asset path at all.
  ['the empty string', 'directive', ''],
  ['a bare filename', 'directive', 'anything.md'],
  ['the custom directory itself, with no file', 'workflow', 'workflows/custom'],
  // Kind/pillar mismatch: `directive remove` must not reach a workflow file, and vice versa.
  ['a workflow path offered as a directive', 'directive', 'workflows/custom/arch-review.yaml'],
  ['a directive path offered as a workflow', 'workflow', 'directives/custom/legacy-rule.md'],
  // A sibling tree that merely starts with the right word.
  ['a look-alike root segment', 'directive', 'directives-backup/custom/legacy-rule.md'],
];

describe('isRemovableCustomAssetPath — allow-list on the custom segment (REQ-SEC-07, spec-011)', () => {
  it.each(REMOVABLE_SHAPES)('is true for %s', (_label, kind, path) => {
    expect(isRemovableCustomAssetPath(kind, path)).toBe(true);
  });

  it.each(REFUSED_SHAPES)('is false for %s', (_label, kind, path) => {
    expect(isRemovableCustomAssetPath(kind, path)).toBe(false);
  });
});

describe('requireCustomAsset fails closed on everything the allow-list does not accept (REQ-SEC-07)', () => {
  it.each(REMOVABLE_SHAPES)('allows %s', (_label, kind, path) => {
    expect(requireCustomAsset(kind, path)).toMatchObject({ ok: true });
  });

  it.each(REFUSED_SHAPES)('refuses %s', (_label, kind, path) => {
    expect(requireCustomAsset(kind, path)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  });
});

describe('requireCustomAsset refusal messages (REQ-SEC-07 fit criterion)', () => {
  it('uses the exact REQ-SEC-07 wording for a built-in directive', () => {
    expect(requireCustomAsset('directive', 'directives/built-in/testing.md')).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION', message: BUILT_IN_DIRECTIVE_ERROR },
    });
  });

  it('uses the exact REQ-SEC-07 wording for a built-in workflow', () => {
    expect(requireCustomAsset('workflow', 'workflows/built-in/release-cycle.yaml')).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION', message: BUILT_IN_WORKFLOW_ERROR },
    });
  });

  it('uses that same wording when the built-in is reached via the Windows separator', () => {
    expect(requireCustomAsset('directive', 'directives\\built-in\\testing.md')).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION', message: BUILT_IN_DIRECTIVE_ERROR },
    });
  });

  it('refuses an unrecognised shape without claiming it is a built-in', () => {
    const result = requireCustomAsset('directive', 'anything.md');
    if (result.ok) throw new Error('expected requireCustomAsset to refuse an unrecognised shape');
    expect(result.error.message).not.toBe(BUILT_IN_DIRECTIVE_ERROR);
    expect(result.error.message).toContain('anything.md');
  });
});
