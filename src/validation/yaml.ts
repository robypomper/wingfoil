/**
 * Shared pre-Zod YAML parse step (spec-009-validation-strategy §1, Pass 1 step 1: "Parse the raw
 * text as YAML. A parse failure never reaches Zod — see E_YAML_PARSE_ERROR below."). Every pillar
 * loader (memory.yaml, dna.yaml, workflows.yaml + its included workflow files, directive
 * frontmatter) calls this before handing the result to `runValidation`, so a malformed file always
 * surfaces as the same `E_YAML_PARSE_ERROR` / exit-2 `ValidationError` instead of each loader
 * re-wrapping `js-yaml` itself.
 */
import { load } from 'js-yaml';

import { ValidationError } from './errors';

/**
 * Parse `text` as YAML, returning the resulting data structure (`undefined` for an empty document —
 * that is a valid, if useless, YAML document, not a parse failure).
 *
 * @throws {@link ValidationError} `E_YAML_PARSE_ERROR` (exit 2) if `text` cannot be parsed as YAML
 *   at all. Zod never runs in that case (spec-009 §1).
 */
export function parseYaml(text: string, filePath: string): unknown {
  try {
    return load(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw ValidationError.yamlParse(filePath, message);
  }
}
