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
