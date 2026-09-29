---
id: "dl-122-no-secret-shaped-literals-in-fixtures"
type: decision-log
title: "The secret scanner's own tests hold 24 secret-shaped source literals, one of which blocked the first push — `security-secrets` gains a rule that such fixtures are built at runtime"
status: ready
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed by the v0.2 retrospective (`retro-v0.2`). Its dispositions pair
`dl-073-scan-surface-vs-publication-boundary` (`in-discussion`) with
`bug-055-secret-scan-fixture-literal-blocks-push-protection` (`open`). The approver ruled on
2026-09-28 that their standing half becomes a rule in the `security-secrets` directive: no
secret-shaped literals in fixtures.

**What happened.** `test/validation/secret-scan.test.ts` proves each `spec-007` pattern by passing
`scanText` a string of the matching shape, written as a source literal. GitHub push protection scans
everything pushed. It rejected the repository's first push, naming the AWS secret-key fixture. The
approver cleared it through GitHub's allow-secret flow, so a standing push-protection exception now
exists on the repository for a test fixture (`bug-055` Summary).

**How many literals there are.** The same scanner, run over its own test file, finds them. In a
throw-away directory:

```
npm init -y >/dev/null && npm i wingfoil@0.2.1
git -C <wingfoil-repo> show a20b346c:test/validation/secret-scan.test.ts > fixture.txt
node -e "const s=require('wingfoil/dist/validation/secret-scan.js');
  const r=s.scanText(require('fs').readFileSync('fixture.txt','utf8'),'f');
  console.log(r.blocking.length, [...new Set(r.blocking.map(f=>f.patternId))].sort().join(','))"
```

This prints `24` blocking findings across eight pattern ids: `aws-access-key-id`,
`aws-secret-access-key`, `gcp-service-account-key`, `generic-api-key-assignment`, `github-token`,
`jwt-like`, `private-key-pem` and `slack-token`. GitHub flagged one of them. Another remote,
scanner or data-loss tool may flag any of the others. The project's own scan does not report them,
because `test/` is outside its surface (`spec-007` §1 *Scan surface*). That divergence is the subject
of `dl-073`.

**What the directive says today.** At `a20b346c`, `security-secrets.md` covers credentials in
documents: never commit one, and use one of the three `spec-007` §3 exclusions (a placeholder value,
a marked example fence, an ignored path) when a document must show a credential-shaped line. It says
nothing about test sources. `git grep -l -E 'dl-073|bug-055' a20b346c -- docs/self/.wingfoil`
prints nothing (exit 1). The same command for `dl-075` finds `claim-evidence.md`.

**Where `dl-073` stands.** It offers three options:

- **(A)** widen the scan to every tracked file, with an ignore list;
- **(B)** require fixtures to be non-literal, by directive rule;
- **(C)** document that the scan covers the configuration store and is not a pre-publication check.

It recommends "(C) now, (B) next, (A) only if measured". It also notes that `bug-055` verifies the
runtime-built string is `===` the literal, so the assertion is unchanged. The approver's ruling takes
(B) as a directive rule. It does not choose between (A) and (C).

## Decision

The `security-secrets` directive gains one rule:

- **S1 — A fixture that must match a secret pattern is built at runtime.** A test, script or fixture
  file that needs a secret-shaped value assembles it when it runs, for example by joining fragments
  that are not themselves secret-shaped. It is never written as a single source literal that a
  secret pattern matches. The assertion is unchanged: the built value is identical to the literal it
  replaces. This applies to every tracked file, not only to files inside the project scan's surface,
  because every scanner that meets the repository reads every file.

**Q1 — rule only, or rule and check.**

- **(a) Rule only.** S1 is prose, and review is its only guard.
- **(b) Rule plus a suite test.** A test runs `scanText` over the tracked files under `test/` and
  fails on any blocking finding. The `spec-007` §3 exclusions stay available for a line that must
  remain literal. This uses the scanner the project already ships, on a surface chosen for this
  rule, and leaves the production scan surface (`dl-073` (A)) unchanged.
- **(c) Rule, plus (A) from `dl-073`,** which widens the production scan to every tracked file.

**Recommendation: (b).** `dl-073`'s own objection to (B) is that "a directive is prose, not a
checkable artefact": the next contributor pastes a literal, and no gate says so. (b) answers that
objection with a check whose surface is exactly the rule's scope. It does not settle `dl-073`'s
repository-wide question, which stays open.

## Rationale

- **Removing the literals fixes the problem for every scanner.** An ignore list or an allowlist
  teaches one scanner to look away. A fixture built at runtime is invisible to all of them: GitHub's,
  a mirror's, an employer's.
- **The population is known and small.** It is one file, with 24 findings, at `a20b346c`. S1 costs
  one rewrite of that file (`bug-055`'s fix) plus a habit for new pattern tests.
- **The rule is standing, so it is a directive.** Every future detector added to `spec-007` §2 comes
  with a test that needs a matching string. That is a rule for every author of such a test
  (`dl-118-choosing-between-decision-log-bug-and-directive`, rule 3), not a one-off change.
- **`dl-073` keeps its open questions.** S1 is its option (B), taken on its own. Whether the
  production scan widens (A), and what the documents say about the scan's boundary (C), are still
  `dl-073`'s to decide.

**Enforcement caveat.** A directive has no enforcement point today. Nothing loads one into an agent's
context, because P3.6 (auto-load by role) is not built:
`git show a20b346c:src/core/index.ts | grep -c agentExecute` prints `0`, while the same command with
`memoryApprove` prints `7`. No hook or CI job reads a commit:
`git ls-tree -r --name-only a20b346c | grep -ciE 'husky|pre-commit|lefthook|commitlint'` prints `0`,
while the same pipe with `publish.yml` prints `1`. Q1 (b) is a local enforcement point for this one
rule. The general one is `dl-097-claim-evidence-needs-an-enforcement-point` and
`dl-103-governance-enforced-outside-the-agent`.

## Actions

1. **Ratify, choosing Q1.** Owner: approver. The choice goes in the approve commit's `Reason:`.
2. **On ratification, `.wingfoil/directives/custom/security-secrets.md` changes**, gaining
   S1 with `dl-073` and `bug-055` cited. The directive stays bound globally in `roles.yaml`.
3. **`bug-055` stays a bug.** Its fix is rewriting the fixtures in
   `test/validation/secret-scan.test.ts` to satisfy S1. Under Q1 (b), the same task or a sibling adds
   the suite test.
4. **Record the push-protection exception** that `bug-055` created as a `service` element, a platform
   setting, once `dl-088-a-memory-type-for-state-that-lives-outside-the-repository` provides the
   type. Its `Management` section says whether the exception can be withdrawn once no fixture needs
   it.
5. `dl-073` is **not** transitioned by this decision. Its own approval records how (A) and (C)
   relate to S1.
6. Tasks are derived by v0.3 `release-planning` (`build-backlog`), not created here.

## Relations

- **Origin:** `retro-v0.2`.
- **Takes, by citation:** `dl-073` option (B); the standing half of `bug-055`.
- **Filed under:** `dl-118-choosing-between-decision-log-bug-and-directive`, rule 3.
- **Related:** `spec-007-secret-hygiene-patterns` §1 and §3; `dl-036-secret-scan-warn-severity-vs-req-sec-08`;
  `dl-088-a-memory-type-for-state-that-lives-outside-the-repository` (the exception as a `service`);
  `dl-121-testing-directive-extensions` (fixture authors meet `testing` too).
- **Enforcement:** `dl-097-claim-evidence-needs-an-enforcement-point`,
  `dl-103-governance-enforced-outside-the-agent`.
- **Traceability:** REQ-SEC-08 (secret hygiene).
