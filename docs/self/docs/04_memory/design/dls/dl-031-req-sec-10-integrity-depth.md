---
id: "dl-031-req-sec-10-integrity-depth"
type: decision-log
title: "REQ-SEC-10 'integrity checks': is schema validation the contract, or is tamper-evidence required?"
status: ready
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

**REQ-SEC-10** (`docs/02_requirements/03_sard/05_security-compliance.md`) is internally ambiguous
about how deep its check goes:

> **REQ-SEC-10 — Integrity checks on built-in templates**
> **Description:** Built-in directive and workflow templates are integrity/schema-checked before
> installation during `init`.
> **Rationale:** A corrupted baseline must not partially install.
> **Fit Criterion:** A corrupted or schema-invalid built-in template aborts `init` before writing
> partial assets, with a message naming the failing template.

The title says *integrity*, the Description says *integrity/schema*, and the Fit Criterion is
dischargeable by schema validation alone — "corrupted" is satisfied by a parse failure.

`task-044-builtin-template-integrity` implemented the Fit Criterion reading: parse + Zod schema
validation per template, aborting `init` before any write, with the exact BDD messages. There is no
digest, no manifest, and no tamper-evidence. A built-in directive whose **body** is rewritten while
its frontmatter stays valid passes the check unnoticed.

The question is whether that is the requirement, or a partial implementation of it.

## Decision

*(in-discussion — proposed, not yet ratified)* **Option (a): the Fit Criterion is the contract.**
Schema validation satisfies REQ-SEC-10. Amend the title and Description to say "schema-checked"
rather than "integrity/schema-checked", so the requirement stops implying a control it does not
specify.

Alternatives:

- **(b) Add a digest manifest** (per-template hash, verified at install). Delivers real
  tamper-evidence, at three costs: a determinism surface that must be got exactly right (line-ending
  normalisation, trailing newline, file ordering, encoding — any of which makes the digest
  machine-dependent and the gate spuriously red, against REQ-SYS-07); a regeneration step every time
  a template is edited, which silently breaks the build when forgotten; and a manifest that is itself
  only as trustworthy as the tree it ships in.
- **(c) Split**: schema check now under REQ-SEC-10, tamper-evidence as a separate future requirement
  scoped by an explicit threat model.

## Rationale

- The threat REQ-SEC-10's Rationale names is **"a corrupted baseline must not partially install"** —
  an accident (truncated file, bad merge, botched edit), not an adversary. Schema validation catches
  exactly that class, and catches it at the right moment.
- Against an adversary who can rewrite a template body in the installed package, a manifest shipped
  in the same package is not a meaningful control. Real tamper-evidence would have to come from the
  distribution channel — which `adr-009` and `spec-015` already address via npm provenance — not from
  a self-referential hash file.
- Option (b)'s determinism hazards are not hypothetical for this project specifically: the North Star
  is that two runs produce equivalent output, and a digest that varies with checkout line endings
  would make `init` fail differently on different machines.
- **Argument for (c), stated for the approver:** if the threat model *does* include post-install
  tampering (an npm package modified in transit, a compromised global install), then a check is wanted
  — but it belongs next to REQ-SEC-07's immutability guarantees and needs its own threat statement,
  not a title tweak on REQ-SEC-10.

## Actions

- Owner **approver**: ratify (a) or (c).
- If (a): amend REQ-SEC-10's title and Description to say "schema-checked"; no code change.
- If (c): open a new SARD requirement with an explicit threat model; leave REQ-SEC-10 as (a).
- Unrelated to this decision but surfaced with it, and to be tracked wherever it belongs: `task-044`'s
  `BUILTIN_TEMPLATE_SOURCES` registry is decoupled from the `init` scaffold, so a future task can add a
  built-in template that the check never sees — fail-open by omission. It is being fixed in `task-044`
  itself via the review gate's `red` fallback.
