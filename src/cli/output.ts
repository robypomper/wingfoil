/**
 * Machine-readable output formats (spec-005-cli-command-contract §2, REQ-INT-05). `console` is the
 * default when `--format` is omitted.
 */
import { dump as yamlDump } from 'js-yaml';

export type OutputFormat = 'console' | 'json' | 'yaml';

export function isValidFormat(value: string): value is OutputFormat {
  return value === 'console' || value === 'json' || value === 'yaml';
}

/**
 * Render a successful `CoreResult.value` to stdout text, per the envelope rules in spec-005 §2:
 * `json`/`yaml` carry only the structured payload (no banners/colour); `console` payload *shape*
 * is otherwise owned by each command's own spec (none exists yet for today's read-only pillar
 * queries — see task-006 Execution Notes — so `console` falls back to pretty-printed JSON, the
 * same structure as `json`/`yaml`, until a command-specific spec defines a human-facing rendering).
 */
export function renderSuccess(value: unknown, format: OutputFormat): string {
  if (format === 'json') return JSON.stringify(value) + '\n';
  if (format === 'yaml') return yamlDump(value);
  return JSON.stringify(value, null, 2) + '\n';
}
