/**
 * task-060-publish-pipeline — `scripts/check-release-tag.cjs`, the `spec-015` §4 assertion the publish
 * workflow's gate job runs before anything is built: the pushed tag is `vX.Y.Z` and equals
 * `v` + `package.json` `version`, so a hand-bumped version (or a mistyped tag) can never promote.
 *
 * task-115 added the `server.json` versions to the same check; those cases live in
 * `publish-metadata.test.ts` (`spec-015` §4). Here the `server.json` is always in sync, so the tag is
 * the only thing under test.
 */
import { checkReleaseTag } from '../../scripts/check-release-tag.cjs';

/** A `server.json` whose versions all agree with `version` — the tag is the only variable here. */
function syncedServer(version: string): { version: string; packages: { version: string }[] } {
  return { version, packages: [{ version }] };
}

describe('tag scheme (task-060) — spec-015 §4', () => {
  it('accepts a `vX.Y.Z` tag equal to the package.json version', () => {
    expect(checkReleaseTag('v0.2.0', '0.2.0', syncedServer('0.2.0')).ok).toBe(true);
  });

  it.each([
    ['v0.2.1', '0.2.0'],
    ['0.2.0', '0.2.0'],
    ['v0.2', '0.2.0'],
    ['v0.2.0-rc.1', '0.2.0-rc.1'],
    ['', '0.2.0'],
    [undefined, '0.2.0'],
  ])('rejects tag %p for version %p', (tag, version) => {
    const result = checkReleaseTag(tag, version, syncedServer(version));
    expect(result.ok).toBe(false);
    expect(result.message).not.toBe('');
  });
});
