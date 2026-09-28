---
id: "bug-153-audit-accepts-reserved-domain-authors"
type: bug
title: "`isValidAttribution` accepts RFC 2606 reserved-TLD email domains (`.invalid`, `.example`, `.test`, `.localhost`) as valid authors"
status: open
severity: "medium"
release-origin: "v0.2"
release: "v0.3"
feature: "P1.2"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`isValidAttribution` (`src/memory/audit.ts`) rejects an empty identity, git's own
`.(none)`-guessed-domain marker, and a malformed email shape — but it has no check against the
RFC 2606 reserved domains (`.invalid`, `.example`, `.test`, `.localhost`), so a placeholder address
on one of those domains passes as a "real, deliberately-configured" author.

## Steps to Reproduce

1. `sed -n '83,89p' src/memory/audit.ts`:
   ```ts
   export function isValidAttribution(name: string, email: string): boolean {
     const trimmedName = name.trim();
     const trimmedEmail = email.trim();
     if (!isConfiguredIdentity(trimmedName, trimmedEmail)) return false;
     if (trimmedEmail.includes(GIT_GUESSED_DOMAIN_MARKER)) return false;
     return EMAIL_RE.test(trimmedEmail);
   }
   ```
   `GIT_GUESSED_DOMAIN_MARKER` is the literal `.(none)`; `EMAIL_RE` (line 51) is
   `/^[^\s@]+@[^\s@]+\.[^\s@()]+$/` — it accepts any syntactically well-formed address, reserved TLD
   or not.
2. Compiled against `dist/memory/audit.js` at this commit:
   ```
   node -e "
   const m = require('./dist/memory/audit.js');
   console.log(m.isValidAttribution('Scratch User','scratch@example.invalid'));  // true
   console.log(m.isValidAttribution('Scratch User','scratch@example.test'));      // true
   console.log(m.isValidAttribution('Scratch User','scratch@example.localhost')); // true
   console.log(m.isValidAttribution('Scratch User','scratch@invalid'));           // false (EMAIL_RE needs a dot)
   "
   ```
   The first three all print `true`: a commit authored under any RFC 2606 reserved TLD is treated as
   a fully valid, auditable identity by `auditAttribution`/`isValidAttribution`.

## Expected Behavior

An email on a reserved, documentation/testing-only domain (`.invalid`, `.example`, `.test`,
`.localhost`) is treated the same way `isValidAttribution` already treats git's own guessed-identity
marker: a placeholder, not a deliberately-configured author, so `auditAttribution`'s "0 unknown
author" fit criterion (REQ-SEC-02) does not silently count reserved-domain commits as attributed.

## Actual Behavior

Reserved-domain addresses pass the check unconditionally — including `.invalid`, the exact domain
convention this retrospective's own throw-away reproductions use for scratch/test identities,
meaning a real project's history could accumulate committer identities on these domains and the
audit would report them as valid, real authors.

## Notes

- Root cause: `isValidAttribution` layers two read-only augmentations on top of the shared
  `isConfiguredIdentity` base (git's guessed-domain marker, and email shape), but was never extended
  to recognize RFC 2606's reserved domains as the same class of "not a real identity" signal.
- This is the read side of the identity-hygiene family the retrospective is also addressing on the
  write side (a shared repository git config setting a non-team-member identity): removing a bad
  identity going forward does not retroactively make historical reserved-domain commits show up as
  unattributed in an audit that already treats them as fine.
- Fix: extend `isValidAttribution` to reject an email whose domain is (or ends in) `.invalid`,
  `.example`, `.test`, or `.localhost`, alongside the existing `.(none)` marker check.

## Triage & Execution Notes

- capture: filed by the v0.2 retrospective (retro-v0.2); reproduced directly against the compiled
  `dist/memory/audit.js` at this commit.
