/**
 * Immutable built-in assets pre-flight check (REQ-SEC-07 — task-042-immutable-builtin-assets). Every
 * `directive remove`/`workflow remove` mutating op must call `requireCustomAsset` before writing
 * anything; a built-in asset (a file under a `built-in/` subdirectory, spec-011-storage-layout's
 * `{built-in,custom}` split) refuses with the exact REQ-SEC-07 message and no side effects. Mirrors
 * `requireGitIdentity` (task-014)'s pre-flight shape: `CoreResult<void>`, safe to call before any
 * read/write.
 */
import { isBuiltInAssetPath, requireCustomAsset } from '../../src/core/builtin-asset';

describe('isBuiltInAssetPath (REQ-SEC-07, spec-011 {built-in,custom} split)', () => {
  it('is true for a directive under directives/built-in/', () => {
    expect(isBuiltInAssetPath('directives/built-in/testing.md')).toBe(true);
  });

  it('is true for a workflow under workflows/built-in/', () => {
    expect(isBuiltInAssetPath('workflows/built-in/release-cycle.yaml')).toBe(true);
  });

  it('is true for a built-in asset nested in a subdirectory', () => {
    expect(isBuiltInAssetPath('directives/built-in/p3/testing.md')).toBe(true);
  });

  it('is false for a directive under directives/custom/', () => {
    expect(isBuiltInAssetPath('directives/custom/legacy-rule.md')).toBe(false);
  });

  it('is false for a workflow under workflows/custom/', () => {
    expect(isBuiltInAssetPath('workflows/custom/arch-review.yaml')).toBe(false);
  });

  it('is false when "built-in" is only a substring of a path segment, not a segment itself', () => {
    expect(isBuiltInAssetPath('directives/custom/built-in-notes.md')).toBe(false);
  });
});

describe('requireCustomAsset (REQ-SEC-07)', () => {
  it('refuses a built-in directive with the exact REQ-SEC-07 message', () => {
    expect(requireCustomAsset('directive', 'directives/built-in/testing.md')).toMatchObject({
      ok: false,
      error: { code: 'CONFLICT', message: 'built-in directives cannot be removed' },
    });
  });

  it('refuses a built-in workflow with the exact REQ-SEC-07 message', () => {
    expect(requireCustomAsset('workflow', 'workflows/built-in/release-cycle.yaml')).toMatchObject({
      ok: false,
      error: { code: 'CONFLICT', message: 'built-in workflows cannot be removed' },
    });
  });

  it('allows a custom directive', () => {
    expect(requireCustomAsset('directive', 'directives/custom/legacy-rule.md')).toMatchObject({ ok: true });
  });

  it('allows a custom workflow', () => {
    expect(requireCustomAsset('workflow', 'workflows/custom/arch-review.yaml')).toMatchObject({ ok: true });
  });
});
