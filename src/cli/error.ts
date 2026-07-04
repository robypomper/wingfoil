/**
 * The consistent error format (spec-005-cli-command-contract §3, REQ-INT-08). Written verbatim
 * from the spec's own code listing so `src/cli` and the spec cannot drift.
 */
import { dump as yamlDump } from 'js-yaml';

import type { OutputFormat } from './output';

export function emitError(reason: string, opts: { format: OutputFormat; hint?: string }): void {
  if (opts.format === 'json') {
    process.stderr.write(JSON.stringify({ error: reason, ...(opts.hint ? { hint: opts.hint } : {}) }) + '\n');
  } else if (opts.format === 'yaml') {
    process.stderr.write(yamlDump({ error: reason, ...(opts.hint ? { hint: opts.hint } : {}) }));
  } else {
    process.stderr.write(`error: ${reason}\n`);
    if (opts.hint) process.stderr.write(`hint: ${opts.hint}\n`);
  }
}
