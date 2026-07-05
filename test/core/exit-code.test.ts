/**
 * Exit-code selection (spec-005-cli-command-contract §1, REQ-INT-04, task-012-cli-exit-code-contract).
 * Both the CLI and the MCP surface derive severity from the same CoreError model (REQ-SYS-05); this
 * maps a CoreError / CoreResult onto the 0/1/2 exit contract in ONE place so neither surface hardcodes
 * its own convention. Usage errors (2) are not modeled here — they are parse-level failures the surface
 * detects before any core call (spec-005 §1).
 */
import { coreErr, coreOk } from '../../src/core/types';
import type { CoreErrorCode } from '../../src/core/types';
import { exitCodeForError, exitCodeForResult } from '../../src/core/exit-code';

const ALL_CODES: readonly CoreErrorCode[] = ['NOT_FOUND', 'INVALID_TRANSITION', 'VALIDATION', 'CONFLICT', 'IO'];

describe('exitCodeForError — CoreError → exit code (REQ-INT-04)', () => {
  it.each(ALL_CODES)('maps the domain error code %s to a logic-error exit 1', (code) => {
    expect(exitCodeForError({ code, message: `boom: ${code}` })).toBe(1);
  });
});

describe('exitCodeForResult — CoreResult → exit code', () => {
  it('maps a successful result to 0', () => {
    expect(exitCodeForResult(coreOk({ any: 'value' }))).toBe(0);
  });

  it.each(ALL_CODES)('maps a %s failure result to 1', (code) => {
    expect(exitCodeForResult(coreErr({ code, message: 'boom' }))).toBe(1);
  });
});
