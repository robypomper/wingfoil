/**
 * task-132 AC2 (`bug-142`, `dl-064` B.1): the identity → prepare-transition preamble is written once.
 *
 * Every state-moving `memory` verb opens with the same two steps — resolve the git identity
 * (REQ-SEC-01), then locate the document and resolve its transition. Before task-132 they were
 * copied into each verb, and the identity was then read again for the authority check and the
 * `Approver:` line. `beginMemoryTransition` (`src/core/memory-transition.ts`) is the one place the
 * pair lives, and its result carries the identity every later step uses.
 *
 * Structural, and generic on purpose: the verbs are enumerated from `CORE_MODULES`, not listed here,
 * so a verb registered later (`memory park`, task-180) is held to the rule by being registered. The
 * one exclusion is `memoryAdd`, which creates a document rather than moving one and so has no
 * transition to prepare. Each verb's compiled source is read with `Function.prototype.toString` — the
 * same text the CLI and the MCP Tool dispatch to.
 */
import { CORE_MODULES } from '../../src/core';

/** Mutating `memory` operations that create rather than transition a document. */
const NOT_A_TRANSITION = new Set(['memoryAdd']);

const TRANSITION_VERBS = Object.entries(CORE_MODULES.find((module) => module.name === 'memory')?.operations ?? {})
  .filter(([name, operation]) => operation.mutates && !NOT_A_TRANSITION.has(name))
  .map(([name, operation]) => [name, operation.fn.toString()] as const)
  .sort(([a], [b]) => a.localeCompare(b));

describe('task-132 AC2 — one shared preamble for the memory transition verbs', () => {
  it('enumerates the registered transition verbs (submit, approve, reject, deprecate, amend at least)', () => {
    const names = TRANSITION_VERBS.map(([name]) => name);
    expect(names).toEqual(expect.arrayContaining(['memoryAmend', 'memoryApprove', 'memoryDeprecate', 'memoryReject', 'memorySubmit']));
  });

  it.each(TRANSITION_VERBS)('%s calls beginMemoryTransition', (_name, source) => {
    expect(source).toMatch(/\bbeginMemoryTransition\b/);
  });

  it.each(TRANSITION_VERBS)('%s reads no git identity and prepares no transition of its own', (_name, source) => {
    expect(source).not.toMatch(/\brequireGitIdentity\b/);
    expect(source).not.toMatch(/\breadGitIdentity\b/);
    expect(source).not.toMatch(/\bprepareMemoryTransition\b/);
  });
});
