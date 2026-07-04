---
id: adr-005-typescript-node-stack
type: adr
title: "TypeScript on Node.js 18+, distributed via npm"
status: accepted
sard_ref: "REQ-SYS-09"
supersedes: ""
tmpl_version: 260703   # Orignal template version
---

## Context

WingFoil ships as an installable CLI (`wingfoil`) and an MCP server, both of which must reach
developers and AI agents with minimal install friction, and both of which need to interoperate
smoothly with the Model Context Protocol / Anthropic SDK ecosystem. The implementation language and
runtime choice affects three things directly: how the tool is distributed, how naturally it can host
an MCP server over stdio, and how well it can enforce the determinism and validation guarantees the
project depends on (REQ-SYS-07). Candidates considered included Python, Go, and Rust in addition to
TypeScript/Node.js. Without an explicit decision here, module implementation could drift across
languages, undermining the single coherent CLI/MCP surface required by REQ-SYS-05, and distribution
would lack a single well-trodden packaging path.

## Decision

WingFoil is implemented in **TypeScript**, running on **Node.js 18+**, and distributed as a public
package via the **npm registry** (`npm install -g wingfoil`), using **semantic versioning** for
releases. This is recorded as the authoritative tech stack in `docs/self/.wingfoil/dna.yaml`
(`tech_stack:`) and in the product brief's Technical Stack section, and it underpins the surrounding
toolchain choices — Commander.js + chalk for the CLI, MCP over stdio with the Anthropic SDK for the
MCP server, Zod for validation at system boundaries, and Jest (>80% coverage target) for testing.

## Consequences

- positive:
  - npm is a single, well-understood distribution channel for a CLI tool, satisfying REQ-SYS-09's fit
    criterion directly: `npm install -g wingfoil` puts `wingfoil` on PATH and `wingfoil --help` exits 0.
  - TypeScript/Node.js gives first-class support for the MCP protocol and Anthropic SDK, which are
    predominantly TypeScript-native, minimizing integration friction for the MCP server module.
  - Static typing plus Zod validation at boundaries supports the determinism and structured-context
    guarantees the project is built around (REQ-SYS-07), catching malformed config/memory data early.
- negative:
  - Ties the whole toolchain (CLI, MCP server, core, storage, memory, dna, directives, workflow
    modules) to a single language/runtime; there is no polyglot escape hatch if a future module would
    be better served by another ecosystem.
  - Requires contributors and CI to standardize on Node.js 18+ as a baseline, excluding environments
    that cannot run that runtime.
- neutral:
  - Establishes npm registry + semantic versioning as the release mechanics for all future WingFoil
    versions, which subsequent ADRs/tech-specs about packaging or release automation must build on
    rather than re-decide.

## Process Notes

Grounded in `docs/02_requirements/03_sard/01_architecture.md` (REQ-SYS-09), `docs/self/.wingfoil/dna.yaml`
(`tech_stack:` section), and `docs/01_vision/01_product-brief.md` (Technical Stack section), all of
which agree on TypeScript/Node.js 18+/npm as the stack. This plan classifies it as an **ADR** because
REQ-SYS-09 gives the decision a citable, testable SARD fit criterion (`npm install -g wingfoil`
must work end-to-end), which is the kind of architecturally significant, requirement-backed choice
ADRs exist to record — a Decision Log entry alone would not carry that traceability link.
