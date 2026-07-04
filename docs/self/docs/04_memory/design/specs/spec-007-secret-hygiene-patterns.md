---
id: spec-007-secret-hygiene-patterns
type: tech-spec
title: "Secret-hygiene scan patterns and procedure"
status: approved
scope: "docs/self/.wingfoil/directives/custom/security-secrets.md"
supersedes: ""
tmpl_version: 260703
---

## Context

The `security-secrets` directive (`docs/self/.wingfoil/directives/custom/security-secrets.md`) states
the rule — "never commit credentials, tokens, or secrets to git" — but a directive is prose, not a
checkable artefact. REQ-SEC-08 requires that "a scan of committed `.wingfoil/` content matches 0 known
secret patterns"; REQ-SEC-10 requires built-in templates be integrity/schema-checked before installation
during `init`, aborting on failure. Neither requirement is enforceable without one shared, versioned
pattern set and one shared scan procedure. Without this spec, every future call site (init's integrity
check, a future `wingfoil audit` command, a pre-commit hook) would be tempted to re-implement its own
regex list, and the patterns would drift — defeating the "0 known secret patterns" fit criterion, which
presumes a single canonical list to match against.

This spec defines that canonical pattern set and the procedure that applies it. It is the technical
backing for the `security-secrets` directive and does not add obligations beyond what that directive and
REQ-SEC-08/REQ-SEC-10 already prescribe.

## Specification

### 1. Scan surface

The secret-hygiene scan (hereafter "the scan") walks every **text file** tracked or staged under:

- `.wingfoil/` (repo-root, once `init` exists) — DNA, directives, workflows, memory documents.
- `docs/self/.wingfoil/` and `docs/self/docs/04_memory/` — the current self-hosted config, same rule
  applied by analogy until the tool-managed root exists.

Binary files (detected via a null-byte sniff on the first 8KB, consistent with `git diff --numstat`
binary detection) are skipped — they are out of scope for this spec.

### 2. Pattern set

Each pattern is a named rule: `{id, regex, description, severity}`. `severity` is `block` (fails the
scan) or `warn` (reported, does not fail). All regexes are case-insensitive unless noted, anchored to
match anywhere in a line (not full-line anchored), and run per-line so a match can be reported with a
file:line location.

```yaml
# Canonical secret-hygiene pattern set (informative YAML; the authoritative shape is the table below)
patterns:
  - id: private-key-pem
    description: "PEM-encoded private key header"
    severity: block
    regex: '-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----'

  - id: generic-api-key-assignment
    description: "Variable assignment that looks like an API key/secret/token"
    severity: block
    regex: '(?i)(api[_-]?key|secret|token|passwd|password)\s*[:=]\s*["'']?[A-Za-z0-9_\-\/+=]{16,}["'']?'

  - id: aws-access-key-id
    description: "AWS access key ID shape"
    severity: block
    regex: '\b(AKIA|ASIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASCA)[0-9A-Z]{16}\b'

  - id: aws-secret-access-key
    description: "AWS secret access key assignment (40-char base64-ish, near 'aws' or 'secret')"
    severity: block
    regex: '(?i)aws.{0,20}(secret|key).{0,5}[:=]\s*["'']?[A-Za-z0-9\/+=]{40}["'']?'

  - id: gcp-service-account-key
    description: "GCP service-account JSON key fragment"
    severity: block
    regex: '"type"\s*:\s*"service_account"|"private_key_id"\s*:\s*"[0-9a-f]{40}"'

  - id: github-token
    description: "GitHub personal access / app / fine-grained token"
    severity: block
    regex: '\b(ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{36,}\b'

  - id: slack-token
    description: "Slack bot/user/app token"
    severity: block
    regex: '\bxox[baprs]-[A-Za-z0-9-]{10,}\b'

  - id: jwt-like
    description: "JSON Web Token shape (header.payload.signature, base64url segments)"
    severity: warn
    regex: '\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b'

  - id: generic-high-entropy-string
    description: "Long contiguous base64/hex-alphabet token assigned to a suspicious key name"
    severity: warn
    regex: '(?i)(auth|credential|bearer)\s*[:=]\s*["'']?[A-Za-z0-9_\-\/+=]{24,}["'']?'

  - id: dotenv-style-secret-line
    description: ".env-style KEY=VALUE line where KEY names a credential"
    severity: warn
    regex: '(?im)^[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY)[A-Z0-9_]*\s*=\s*\S+'
```

Notes on the set:

- `block` patterns are unambiguous secret *shapes* (vendor-specific prefixes, PEM headers) — a match is
  treated as a real finding with no tunable threshold.
- `warn` patterns are heuristic (generic high-entropy / JWT-shaped strings) — reported for human review
  but do not by themselves abort a scan, to bound false-positive noise on identifiers that merely look
  like tokens (e.g. long UUIDs, content hashes).
- The generic high-entropy rule intentionally uses a *named-key proximity* heuristic (`auth|credential|
  bearer` near the value) rather than raw Shannon-entropy scoring, to keep the check regex-only,
  deterministic, and dependency-free (no entropy-calculation library), consistent with the project's
  determinism principle (REQ-SYS-07).
- The pattern set is versioned as data (the YAML block above); adding, removing, or re-classifying a
  pattern is a revision to this spec, not a code change scattered across call sites.

### 3. Exclusions

A line is exempt from `block` failure (but still eligible to be listed as `info`) if either:

- It sits inside a fenced code block explicitly labelled as an example/placeholder, i.e. immediately
  preceded by an HTML comment `<!-- example -->` or `<!-- placeholder -->` on its own line; or
  It matches a placeholder shape: the captured value is entirely `x`/`X`/`*` repeats, or one of the
  literal strings `REDACTED`, `PLACEHOLDER`, `EXAMPLE`, `xxxxxxxxxxxxxxxx` (case-insensitive).
- The file path matches a configured ignore list (`.wingfoil/security-ignore` — one glob per line, git
  attribute-style), for genuinely public fixtures (e.g. a BDD `.feature` file that fixture-tests the
  scanner itself with a known-fake key). Ignoring a path is itself an auditable, versioned decision
  (the ignore file lives in git).

### 4. Scan procedure

```
scan(paths) -> ScanResult { blocking: Finding[], warnings: Finding[] }

Finding = { pattern_id, severity, file, line, column, excerpt }
```

1. Resolve `paths` to the scan surface (§1) — either "all tracked+staged files under the configured
   roots" (full scan) or a caller-supplied file list (incremental scan, e.g. only files touched by the
   current commit/task).
2. For each file: skip if binary (§1); otherwise read line by line.
3. For each line, evaluate every pattern in the set (§2) in the fixed order they are declared —
   deterministic iteration, no set/map ordering (per REQ-SYS-07/determinism directive).
4. Apply exclusions (§3); a line surviving exclusion that matches a `block` pattern becomes a
   `blocking` Finding, a `warn` pattern becomes a `warnings` Finding.
5. Return `ScanResult`. The caller decides disposition:
   - **`init` integrity check (REQ-SEC-10):** run the scan over the built-in directive/workflow
     templates about to be installed *before* writing any file. Any `blocking` finding aborts `init`
     before writing partial assets, with a message naming the failing template path and `pattern_id`
     (mirrors the "corrupted template" abort behaviour REQ-SEC-10 already requires for schema checks —
     this scan is an additional integrity gate run in the same pre-write pass).
   - **Future `wingfoil audit` / `memory.submit` pre-commit gate (REQ-SEC-08):** run the scan over the
     file(s) about to be committed. Any `blocking` finding fails the operation before the commit is
     created — an operation that cannot complete cleanly writes nothing. `warnings` findings are
     surfaced to the operator but do not block.
6. Exit/return contract: `blocking.length === 0` is required for the caller to proceed; `warnings` are
   always returned for display regardless of outcome.

### 5. Non-goals

- This spec does not define secret *rotation* or *revocation* procedures — only detection before
  persistence.
- It does not scan runtime process environment or `.env` file *values* proactively outside a scan
  invocation — there is no background watcher, only on-demand scans at the call sites in §4 step 5.
- It does not replace `.gitignore`-based exclusion of files that should never be tracked at all (e.g.
  a real `.env`); it is a defense-in-depth check on what *is* about to be tracked/committed.

## Consequences

- `init`'s integrity check (REQ-SEC-10) and any future audit/pre-commit gate (REQ-SEC-08) both consume
  the pattern set in §2 and the procedure in §4 rather than each defining their own regexes — a single
  place to update when a new secret shape needs coverage (e.g. a new cloud vendor's key prefix).
- Because the pattern set is versioned data, extending it (new vendor prefixes, tightening a heuristic)
  is a revision to this spec's §2 table, tracked like any other tech-spec change — not a silent code
  edit.
- The `security-ignore` file introduced in §3 is a new, small governance surface: it must itself be
  git-versioned and auditable, and any task that adds an entry to it should justify why in its commit
  message (an ignored path is a deliberate hygiene exception, not a default).
- Tasks implementing the actual scan module (once `src/` exists) must reproduce the pattern table in §2
  verbatim (or import it as data) and must not hand-roll alternative regexes — a task that finds this
  set insufficient (missing a vendor shape, too many false positives) should raise a fix against this
  spec rather than diverging locally.

## Process Notes

Authored proactively during `initial-design` (rl-v1) to give the `security-secrets` directive and
REQ-SEC-08/REQ-SEC-10 a concrete, checkable backing, since neither the directive nor the SARD requirement
itself specifies pattern content. Grounded directly in
`docs/self/.wingfoil/directives/custom/security-secrets.md` and
`docs/02_requirements/03_sard/05_security-compliance.md` (REQ-SEC-08, REQ-SEC-10); no prior-art source
was available, so the pattern set and scan procedure were authored fresh, favoring well-known,
low-false-positive secret shapes (vendor-prefixed tokens, PEM headers) as `block` severity and
entropy-adjacent heuristics as `warn` severity to keep the design deterministic and dependency-free.
