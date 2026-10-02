/**
 * The probe suite `test/lint/coverage-parity.test.ts` runs in a child jest with `--coverage`
 * (task-134-report-source-file-coverage-so-untested-file-counts, `bug-141`).
 *
 * It loads NO source file on purpose: every `src/` file the coverage report lists is then one no test
 * required, so the report proves that coverage discovery walks `src/` rather than following the
 * tests' imports. The name ends in `.ts`, not `.test.ts`, so the normal `testMatch` never collects it.
 */
it('loads no source file', () => {
  expect(true).toBe(true);
});
