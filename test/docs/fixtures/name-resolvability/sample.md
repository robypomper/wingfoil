# Name-resolvability fixture

Read by `test/docs/name-resolvability.test.ts`, never by the repository scan (it lives under `test/`,
not among the specs, ADRs and requirements). Each section holds one name per class.

## Names that resolve at HEAD

- command: `wingfoil memory add --set <name>=<value>`, `wingfoil dna show`
- element: `spec-001`, `dl-116-document-parity-tests-beyond-the-cli-reference`, `REQ-SYS-03`
- path: `src/core/index.ts`, `.wingfoil/memory.yaml`, `dna.yaml`
- symbol: `CORE_MODULES`, `buildProgram()`
- config: `stacks.technologies`, `dev-loop.review`, `task.release`

## Names that do not

- command: `wingfoil memory teleport`
- element: `task-999-a-task-that-was-never-filed`
- path: `src/teleport/index.ts`
- symbol: `teleportElement`
- config: `stacks.teleporters`

## A dangling name quoted on purpose

- retired: `.wingfoil/teleport-index/`

## Spans the check skips

- a placeholder: `wingfoil memory add <type> --set {token}=<value>`
- prose: `not a name at all`

```yaml
# a fenced block is an example, never a claim: src/fenced/teleport.ts
teleport: `teleportFenced`
```
