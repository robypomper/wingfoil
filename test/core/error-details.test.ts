/**
 * `errorDetails` on a refusal that carries spec-003 `diagnostics` (task-136) instead of `issues`
 * (task-130): each further diagnostic becomes one `detail` in the reason form, in the loader's order,
 * and the diagnostic the reason already is is not repeated.
 */
import { errorDetails } from '../../src/core/error-details';
import { coreErr } from '../../src/core/types';
import { formatDiagnostic, type Diagnostic } from '../../src/validation';

const first: Diagnostic = {
  code: 'E_WORKFLOW_FILE_NOT_FOUND',
  severity: 'error',
  file: 'workflows.yaml',
  path: 'include[2]',
  message: 'included workflow file not found: workflows/custom/missing.yaml',
};
const second: Diagnostic = {
  code: 'E_VALIDATION',
  severity: 'error',
  file: 'workflows/custom/bad.yaml',
  path: 'phases[0].name',
  message: 'Invalid input: expected string, received undefined',
};
const warning: Diagnostic = { code: 'W_EXAMPLE', severity: 'warning', file: 'workflows/custom/a.yaml', path: '', message: 'a warning' };

function refusal(diagnostics: readonly Diagnostic[]) {
  const result = coreErr({ code: 'VALIDATION', message: formatDiagnostic(diagnostics[0] as Diagnostic), details: { diagnostics } });
  if (result.ok) throw new Error('expected a refusal');
  return result.error;
}

describe('errorDetails — spec-003 diagnostics (task-130 × task-136)', () => {
  it('each further diagnostic is one detail in the reason form, the reason not repeated', () => {
    expect(errorDetails(refusal([first, second, warning]))).toEqual([
      { detail: formatDiagnostic(second) },
      { detail: formatDiagnostic(warning) },
    ]);
  });

  it('a single diagnostic adds no detail: the reason already is it', () => {
    expect(errorDetails(refusal([first]))).toEqual([]);
  });

  it('diagnostics take precedence over issues, which a diagnostics refusal does not carry', () => {
    const result = coreErr({ code: 'VALIDATION', message: 'x', details: { diagnostics: [second], issues: [{ file: 'ignored' }] } });
    if (result.ok) throw new Error('expected a refusal');
    expect(errorDetails(result.error)).toEqual([{ detail: formatDiagnostic(second) }]);
  });
});
