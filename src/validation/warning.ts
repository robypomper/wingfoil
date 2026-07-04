/**
 * Unknown-field warning policy for `.passthrough()` schemas (spec-009-validation-strategy §2).
 *
 * Unknown-ness is decided against the schema's own declared key set (`schema.shape`), NOT against
 * the passthrough-parsed output. Under `.passthrough()` the parsed object retains every unknown
 * key, so a `raw` vs `parsed` diff is always empty — the "known-defective mechanism" spec-009 §2
 * explicitly warns against. Diffing raw keys against `schema.shape` is the correct mechanism.
 */

/**
 * Minimal structural view of a Zod object schema: only its declared top-level `shape` is needed.
 * Typed structurally rather than as `AnyZodObject` (spec-009 §2's listing) because Zod 4 — the
 * version pinned in `dna.yaml` / `package.json` (`zod@^4`) — no longer exports the `AnyZodObject`
 * alias; every `.passthrough()` object schema still exposes `.shape`, which is all this check reads.
 */
export interface HasShape {
  readonly shape: Record<string, unknown>;
}

export function emitUnknownFieldWarning(
  raw: Record<string, unknown>,
  schema: HasShape,
  filePath: string,
): void {
  const known = new Set(Object.keys(schema.shape));
  const unknown = Object.keys(raw).filter((k) => !known.has(k));
  if (unknown.length > 0) {
    process.stderr.write(`Warning: ${filePath}: unknown field(s) ignored: ${unknown.join(', ')}\n`);
  }
}
