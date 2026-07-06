/**
 * Machine-readable output envelope (spec-005-cli-command-contract §2, REQ-INT-05 —
 * task-013-machine-readable-formats). The `--format` infrastructure itself already exists
 * (`src/cli/output.ts`, built in task-006); these are the REQ-INT-05 *fit-criterion* checks: the
 * json/yaml payloads must parse with a standard parser into a single value, and json/yaml/console must
 * all carry the same logical structure. The literal `wingfoil paths` / `wingfoil workflow status`
 * cases in the AC await those commands (task-028+) — the envelope they will inherit is verified here.
 */
import { load as yamlLoad } from 'js-yaml';

import { isValidFormat, renderSuccess } from '../../src/cli/output';

describe('isValidFormat (REQ-INT-05, spec-005 §2)', () => {
  it.each(['console', 'json', 'yaml'])('accepts the supported value %p', (value) => {
    expect(isValidFormat(value)).toBe(true);
  });

  it.each(['xml', 'JSON', 'yml', 'toml', ''])('rejects the unsupported value %p', (value) => {
    expect(isValidFormat(value)).toBe(false);
  });
});

describe('renderSuccess — machine-readable envelope (REQ-INT-05)', () => {
  const VALUE = {
    category: 'sources',
    paths: ['src/cli', 'src/core'],
    nested: { count: 2, flags: [true, false], empty: null },
  };

  it('json output parses via JSON.parse into a single top-level value equal to the input', () => {
    const out = renderSuccess(VALUE, 'json');
    expect(out.endsWith('\n')).toBe(true);
    // A single top-level value on stdout — no banners/progress/colour interleaved (envelope rule).
    expect(out.trimEnd().split('\n')).toHaveLength(1);
    expect(JSON.parse(out)).toEqual(VALUE);
  });

  it('yaml output parses via a standard YAML parser into the same structure as json', () => {
    const yamlOut = renderSuccess(VALUE, 'yaml');
    const jsonOut = renderSuccess(VALUE, 'json');
    expect(yamlLoad(yamlOut)).toEqual(VALUE);
    expect(yamlLoad(yamlOut)).toEqual(JSON.parse(jsonOut));
  });

  it('console is the default human shape — same structure, pretty-printed', () => {
    const out = renderSuccess(VALUE, 'console');
    expect(JSON.parse(out)).toEqual(VALUE);
    expect(out).toContain('\n  '); // indented (pretty), unlike the compact single-line json
  });
});
