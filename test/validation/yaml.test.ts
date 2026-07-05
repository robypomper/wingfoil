/**
 * `parseYaml` — the shared pre-Zod YAML parse step (spec-009-validation-strategy §1 Pass 1 step 1:
 * "Parse the raw text as YAML. A parse failure never reaches Zod — see E_YAML_PARSE_ERROR below.").
 * Every pillar loader (memory.yaml, dna.yaml, workflows.yaml, directive frontmatter) calls this
 * before `runValidation`, so YAML-parse failures are mapped uniformly instead of each loader
 * re-wrapping `js-yaml` itself.
 */
import { parseYaml } from '../../src/validation/yaml';
import { E_YAML_PARSE_ERROR, EXIT_INTEGRITY, ValidationError } from '../../src/validation/errors';

describe('parseYaml', () => {
  it('returns the parsed data structure for well-formed YAML', () => {
    expect(parseYaml('a: 1\nb: [1, 2]\n', 'f.yaml')).toEqual({ a: 1, b: [1, 2] });
  });

  it('throws a ValidationError with E_YAML_PARSE_ERROR and exit code 2 for malformed YAML', () => {
    // Unclosed flow sequence — js-yaml cannot parse this at all.
    const badYaml = 'a: [1, 2\n';
    expect(() => parseYaml(badYaml, 'broken.yaml')).toThrow(ValidationError);
    try {
      parseYaml(badYaml, 'broken.yaml');
      fail('expected parseYaml to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const validationError = err as ValidationError;
      expect(validationError.exitCode).toBe(EXIT_INTEGRITY);
      expect(validationError.issues).toHaveLength(1);
      expect(validationError.issues[0]?.code).toBe(E_YAML_PARSE_ERROR);
      expect(validationError.issues[0]?.file).toBe('broken.yaml');
    }
  });

  it('treats an empty document as `undefined`, not an error', () => {
    expect(parseYaml('', 'empty.yaml')).toBeUndefined();
  });
});
