/**
 * Immutable built-in assets pre-flight check (REQ-SEC-07 — task-042-immutable-builtin-assets). Every
 * `directive remove`/`workflow remove` mutating op must call `requireCustomAsset` before writing
 * anything; anything that is not positively a file under that pillar's `custom/` subdirectory
 * (spec-011-storage-layout's `{built-in,custom}` split) refuses with no side effects. Mirrors
 * `requireGitIdentity` (task-014)'s pre-flight shape: `CoreResult<void>`, safe to call before any
 * read/write, refusal code `VALIDATION`.
 *
 * The classification is an **allow-list**: these tests assert not only that the two known-built-in
 * shapes are refused, but that every *unrecognised* shape is refused too — a deny-list on the literal
 * segment `built-in` was the first-pass defect (fail-open on the platform separator, on casing, on
 * traversal and on the empty string).
 *
 * The message strings below are duplicated from the implementation on purpose (the
 * `test/core/git-identity.test.ts` precedent): they are the REQ-SEC-07 fit criterion as asserted
 * verbatim by `P3.3-directive-remove.feature` / `P4.9-workflow-remove.feature`, so the test must pin
 * them independently of whatever constant the implementation happens to hold them in.
 */
import { isRemovableCustomAssetPath, requireCustomAsset } from '../../src/core/builtin-asset';

const BUILT_IN_DIRECTIVE_ERROR = 'built-in directives cannot be removed';
const BUILT_IN_WORKFLOW_ERROR = 'built-in workflows cannot be removed';

describe('isRemovableCustomAssetPath — allow-list on the custom segment (REQ-SEC-07, spec-011)', () => {
  it('is true for a directive directly under directives/custom/', () => {
    expect(isRemovableCustomAssetPath('directive', 'directives/custom/legacy-rule.md')).toBe(true);
  });

  it('is true for a workflow directly under workflows/custom/', () => {
    expect(isRemovableCustomAssetPath('workflow', 'workflows/custom/arch-review.yaml')).toBe(true);
  });

  it('is true for a custom asset nested deeper under custom/', () => {
    expect(isRemovableCustomAssetPath('directive', 'directives/custom/p3/legacy-rule.md')).toBe(true);
  });

  it('is true for a custom file whose NAME merely contains "built-in"', () => {
    expect(isRemovableCustomAssetPath('directive', 'directives/custom/built-in-notes.md')).toBe(true);
  });

  it('accepts the platform-separator form loaders.ts produces on Windows', () => {
    expect(isRemovableCustomAssetPath('directive', 'directives\\custom\\legacy-rule.md')).toBe(true);
  });

  it('is false for a built-in directive', () => {
    expect(isRemovableCustomAssetPath('directive', 'directives/built-in/testing.md')).toBe(false);
  });

  it('is false for a built-in workflow', () => {
    expect(isRemovableCustomAssetPath('workflow', 'workflows/built-in/release-cycle.yaml')).toBe(false);
  });

  it('is false for a built-in directive written with the Windows separator', () => {
    expect(isRemovableCustomAssetPath('directive', 'directives\\built-in\\testing.md')).toBe(false);
  });

  it('is false for the empty string', () => {
    expect(isRemovableCustomAssetPath('directive', '')).toBe(false);
  });

  it('is false for an unrecognised shape (fails closed, not open)', () => {
    expect(isRemovableCustomAssetPath('directive', 'anything.md')).toBe(false);
  });
});

describe('requireCustomAsset (REQ-SEC-07)', () => {
  it('refuses a built-in directive with the exact REQ-SEC-07 message', () => {
    expect(requireCustomAsset('directive', 'directives/built-in/testing.md')).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION', message: BUILT_IN_DIRECTIVE_ERROR },
    });
  });

  it('refuses a built-in workflow with the exact REQ-SEC-07 message', () => {
    expect(requireCustomAsset('workflow', 'workflows/built-in/release-cycle.yaml')).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION', message: BUILT_IN_WORKFLOW_ERROR },
    });
  });

  it('refuses a built-in directive reached via the Windows separator with the SAME message', () => {
    expect(requireCustomAsset('directive', 'directives\\built-in\\testing.md')).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION', message: BUILT_IN_DIRECTIVE_ERROR },
    });
  });

  it('refuses an unrecognised shape WITHOUT claiming it is a built-in', () => {
    const result = requireCustomAsset('directive', 'anything.md');
    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    if (result.ok) throw new Error('unreachable');
    expect(result.error.message).not.toBe(BUILT_IN_DIRECTIVE_ERROR);
    expect(result.error.message).toContain('anything.md');
  });

  it('allows a custom directive written with the Windows separator', () => {
    expect(requireCustomAsset('directive', 'directives\\custom\\legacy-rule.md')).toMatchObject({ ok: true });
  });

  it('allows a custom file whose name merely contains "built-in"', () => {
    expect(requireCustomAsset('directive', 'directives/custom/built-in-notes.md')).toMatchObject({ ok: true });
  });

  it('allows a custom directive', () => {
    expect(requireCustomAsset('directive', 'directives/custom/legacy-rule.md')).toMatchObject({ ok: true });
  });

  it('allows a custom workflow', () => {
    expect(requireCustomAsset('workflow', 'workflows/custom/arch-review.yaml')).toMatchObject({ ok: true });
  });
});

describe('requireCustomAsset fails CLOSED on every unrecognised path shape (REQ-SEC-07)', () => {
  it.each([
    // The reachable defect: `src/core/loaders.ts` builds a directive's path with the PLATFORM
    // separator (`join('directives', relativePath)`), so on Windows a built-in arrives as
    // `directives\built-in\testing.md` — a forward-slash-only split never sees the `built-in` segment.
    ['windows separator, built-in directive', 'directive', 'directives\\built-in\\testing.md'],
    ['windows separator, built-in workflow', 'workflow', 'workflows\\built-in\\release-cycle.yaml'],
    ['windows separator, nested built-in', 'directive', 'directives\\built-in\\p3\\testing.md'],
    ['mixed separators', 'directive', 'directives\\built-in/testing.md'],
    // Casing: a case-insensitive filesystem resolves these to the protected directory.
    ['upper-case BUILT-IN segment', 'directive', 'directives/BUILT-IN/testing.md'],
    ['mixed-case Built-In segment', 'directive', 'directives/Built-In/testing.md'],
    ['upper-case CUSTOM segment', 'directive', 'directives/CUSTOM/legacy-rule.md'],
    // Traversal / absolute: nothing here is a `.wingfoil`-relative custom asset.
    ['parent traversal', 'directive', '../../etc/passwd'],
    ['traversal back into built-in', 'directive', 'directives/custom/../built-in/testing.md'],
    ['single-dot segment', 'directive', './directives/custom/legacy-rule.md'],
    ['absolute posix path', 'directive', '/etc/passwd'],
    ['empty segment (doubled separator)', 'directive', 'directives//custom/legacy-rule.md'],
    // Shapes that are simply not an asset path at all.
    ['empty string', 'directive', ''],
    ['bare filename', 'directive', 'anything.md'],
    ['the custom directory itself, no file', 'workflow', 'workflows/custom'],
    // Kind/pillar mismatch: `directive remove` must not reach a workflow file and vice versa.
    ['workflow path via the directive kind', 'directive', 'workflows/custom/arch-review.yaml'],
    ['directive path via the workflow kind', 'workflow', 'directives/custom/legacy-rule.md'],
    // A sibling tree that merely starts with the right word.
    ['look-alike root segment', 'directive', 'directives-backup/custom/legacy-rule.md'],
  ])('refuses %s', (_label, kind, path) => {
    expect(requireCustomAsset(kind as 'directive' | 'workflow', path)).toMatchObject({ ok: false });
  });
});
