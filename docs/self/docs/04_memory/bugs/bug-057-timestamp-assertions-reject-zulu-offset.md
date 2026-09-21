---
id: "bug-057-timestamp-assertions-reject-zulu-offset"
type: bug
title: "Two timestamp assertions reject git's `Z` zero-offset, so `prepublishOnly` fails on any UTC runner"
status: planned
severity: "high"
release-origin: "v0.2"
release: "v0.2"
feature: "P1.2"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`test/core/memory-approve.test.ts:168` and `test/memory/versioning-audit-trail.test.ts:61` assert that
git's `%aI` author date matches `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/`, i.e. that the
offset is always written `[+-]HH:MM`. Git >= 2.55 renders a **zero** offset as `Z`, which is valid
ISO-8601/RFC-3339. On a UTC runner — the normal state of CI — both assertions therefore fail, and with
them `prepublishOnly`, which `spec-015` §2 requires to pass in the release gate. **The assertions are
wrong, not git.**

## Steps to Reproduce

1. Run the suite on a machine whose git is >= 2.55 with `TZ=UTC` (or with no `TZ`, as a runner has):
   `TZ=UTC npx jest test/core/memory-approve.test.ts test/memory/versioning-audit-trail.test.ts`.
2. Or reproduce the underlying rendering alone:
   `TZ=UTC git commit --allow-empty -m x && git log -1 --format=%aI`.

## Expected Behavior

`Z` and `+00:00` are the same instant and both are valid ISO-8601 zero-offset renderings; P1.2 asks that
the audit trail carry an ISO-8601 timestamp, not that it carry one particular spelling of zero. Both
assertions should accept either form, as a third assertion in this repository already does.

## Actual Behavior

The two regexes, read from the tree at `b505473`:

```
$ sed -n '168p' test/core/memory-approve.test.ts
    expect(gitOut(repo, ['log', '-1', '--format=%aI'])).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
$ sed -n '61p' test/memory/versioning-audit-trail.test.ts
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
```

Neither accepts the string git >= 2.55 produces. Demonstrated against the exact literals:

```
$ node -e 'const re=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/; const fix=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/; ...'
2026-09-21T09:25:53Z      current: false   fixshape: true
2026-09-21T09:25:53+00:00 current: true    fixshape: true
```

`task-077-first-real-staging-run` observed both failing inside the runner image, with the received
strings `"2026-09-21T09:25:53Z"` and `"2026-09-21T09:26:05Z"`, and isolated the cause by re-running the
identical probe with `--env TZ=Europe/Rome` and nothing else changed: 3 failing suites became 1 (the
remaining one is `bug-058`, unrelated).

**The CI premise is closed, which `task-077` could not do.** Its notes listed "the git version on
GitHub's own `ubuntu-24.04` image" as the one unverified fact. Read here from `actions/runner-images`'
own image readme:

```
$ curl -sS https://raw.githubusercontent.com/actions/runner-images/main/images/ubuntu/Ubuntu2404-Readme.md | grep -i '^- Git '
- Git 2.55.0
```

2.55.0 is exactly the version that renders a zero offset as `Z`. GitHub runners run in UTC. So
`prepublishOnly` **will** fail on GitHub at these two assertions — this is not an `act` artefact.

**The fix shape already exists in the codebase.** A third assertion over the same kind of value already
accepts both spellings:

```
$ grep -n 'Z|\[+-\]' test/cli/program.integration.test.ts
471:        expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/);
```

`test/cli/program.integration.test.ts:471` is the pattern the two failing assertions should adopt
verbatim: `(?:Z|[+-]\d{2}:\d{2})`.

## Notes

**This cannot be reproduced on the developer machine, and that is the whole point.** Its git is 2.43.0,
which renders a zero offset the old way:

```
$ git --version
git version 2.43.0
$ TZ=UTC git commit -q --allow-empty -m x && git log -1 --format=%aI
2026-09-21T18:21:21+00:00
```

So the failing condition is "git >= 2.55 **and** a UTC runner", and the local toolchain meets neither
half. Any verification of the fix must therefore be run against a git that emits `Z` (the runner image
`catthehacker/ubuntu:act-24.04` ships 2.55.0), not merely under `TZ=UTC` locally, which would pass with
or without the fix.

**Scope.** Only these two assertions were observed failing. Whether other suites carry the same
`[+-]HH:MM` literal is not asserted here — the fix task is told to sweep for it rather than assume.

## Triage & Execution Notes

Filed from finding **F3** of `task-077-first-real-staging-run` (`done`), at the scheduling act its
approve commit `ac10060` directs. Severity **high**, release-blocking: `prepublishOnly` is the gate's
own quality step and `spec-015` §2 requires it to exit non-zero on any failure, i.e. to be passable on
CI. The reviewer strengthened the finding beyond what the task could claim, by closing the GitHub
image's git version; that claim is re-verified here from the source the reviewer names. Fix task:
`task-081-fix-timestamp-offset-assertions`.
