---
id: security
name: "Security"
type: directive
kind: custom
title: "Security"
tags: [custom, security, secrets]
ref: [P3.8]
---

# Directive — Security

Custom stand-in directive (the P3.8 Security template). Applies to all roles.

> **Stand-in custom directive.** WingFoil's official built-in P3.8 templates are not yet implemented;
> until they ship, this generic rule (adapted to the project methodology/tech-stack in `dna.yaml`) is
> kept as `custom`. `ref: [P3.8]` records the built-in template it becomes once those exist.

- Credential handling: never hardcode credentials, tokens, or secrets in source, config, or docs.
- Secrets stay out of version control; use environment/secret managers, not committed files.
- Validate and sanitize external input at boundaries.
- Principle of least privilege for any access the system grants.

> Source: Features §P3.8 (Security: credential handling, secrets). WingFoil's project-specific
> elaboration of this rule lives in the custom directive `security-secrets` (assigned globally).
