---
id: security-secrets
name: "Security & secrets handling"
type: directive
kind: custom
title: "Security & secrets handling"
tags: [custom, security, secrets]
scope: global
ref: [docs/02_requirements/03_sard/05_security-compliance.md]
---

# Directive — Security & secrets handling

Custom WingFoil rule. Applies to all roles.

- Never commit credentials, tokens, or secrets to git (everything in `.wingfoil/` is versioned).
- No secrets in Memory documents, DNA, directives, or workflow files.
- MCP Resources are read-only; never expose a write path through the read channel.
- Validate and sanitize all external input at boundaries (Zod).

> Rationale: all project state is git-backed and shared with agents; leaked secrets would be
> permanent in history. Source: SARD §Security & Compliance.

## The secret scan, and how to document a credential without tripping it

Everything under `.wingfoil/` (here: `docs/self/.wingfoil/` and `docs/self/docs/04_memory/`) is checked
by the secret scan (`spec-007-secret-hygiene-patterns`, REQ-SEC-08). It reads the **git index** — what
your next commit would contain — and **any blocking match fails the gate**. Nine of its ten patterns
block, including a JWT-shaped string and a `.env`-style line whose key names a credential
(`dl-036-secret-scan-warn-severity-vs-req-sec-08`). So a line that starts `NPM_TOKEN=` followed by
any value blocks, even inside a code fence, even in a document *about* tokens.

When a document genuinely needs to show such a line, use one of the three `spec-007` §3 exclusions.
Each downgrades the match to `info`: still reported, so the exemption stays auditable, but not failing.

- **Placeholder value** — the value is entirely `x`/`X`/`*`, or exactly `REDACTED`, `PLACEHOLDER` or
  `EXAMPLE` (any case). Prefer this; it keeps an example obviously fake at a glance:

NPM_TOKEN=REDACTED

- **Marked example fence** — put `<!-- example -->` or `<!-- placeholder -->` on its own line directly
  above a backtick code fence; every line inside that fence is exempt:

<!-- example -->
```
NPM_TOKEN=npm_example_value_not_a_real_token
```

- **Ignored path** — list a glob in `.wingfoil/security-ignore` at the project root (one glob per line,
  `#` comments) for a file that must hold a known-fake credential, e.g. a scanner fixture. Adding a
  line there is a versioned hygiene exception: justify it in the commit message.

None of these makes a real credential safe to commit. A real token goes in a secret store — for
WingFoil's own npm publish, the GitHub Actions `npm-publish` environment secret documented in
`.github/workflows/publish.yml` — never in a file.
