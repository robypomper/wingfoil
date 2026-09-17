/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  // The ESM/CommonJS harness (task-065-fix-commander-esm-jest-harness, bug-007). This replaces the
  // bare `preset: 'ts-jest'` (which is exactly the first entry below with no `tsconfig` option) so
  // the two halves of the harness sit side by side:
  //
  //  1. TypeScript sources compile against `tsconfig.test.json` — identical to `tsconfig.json` except
  //     `module: CommonJS`. Under the inherited `module: Node16`, TypeScript *preserves*
  //     `src/cli/program.ts`'s `await import('commander')`, and jest's CommonJS runtime has no
  //     dynamic-import callback, so loading the CLI entry-point wiring from a test died with
  //     `TypeError: A dynamic import callback was invoked without --experimental-vm-modules`. That is
  //     bug-007: `src/cli/program.ts` and `src/cli.ts` were untestable AND absent from the coverage
  //     report. `module: CommonJS` downlevels that call to `require('commander')`.
  //  2. `transformIgnorePatterns` below un-ignores `node_modules/commander/` so that `require` can
  //     succeed: `commander` v15 is ESM-only (`"type": "module"`, a single `default` export
  //     condition), so ts-jest transforms its `.js` to CommonJS on the way in. Its sources only ever
  //     statically import node builtins and sibling files — no `import.meta` outside JSDoc — so the
  //     transform is mechanical.
  //
  // What this does NOT change: `npm run build` / `npx tsc --noEmit` / `npm run docs:api` all keep
  // reading `tsconfig.build.json` / `tsconfig.json` with `module: Node16`, so the PUBLISHED CLI still
  // loads `commander` as ESM through a preserved dynamic `import()`. The in-process suites therefore
  // exercise the wiring against a CommonJS-transpiled commander; the real ESM load stays covered
  // black-box by the suites that spawn the compiled `dist/` (`test/cli/program.integration.test.ts`,
  // `test/cli/npm-distribution.test.ts`, `test/cli/journey-0a.integration.test.ts`).
  //
  // Note the override has to be global rather than scoped to `src/cli/**`: ts-jest resolves ONE
  // shared `ConfigSet` per jest config, so a narrower second `transform` entry with its own
  // `tsconfig` does not take effect (verified — see the task's Execution Notes).
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
    '^.+\\.m?js$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  transformIgnorePatterns: ['/node_modules/(?!commander/)'],
  // Build the compiled `dist/` once, before any worker starts, so the out-of-process CLI integration
  // suites can share it without racing on a per-suite `rmSync`/rebuild (bug-003-cli-integration-dist-race).
  globalSetup: '<rootDir>/test/global-setup.cjs',
  // Coverage is opt-in (via `npm run test:coverage`), not part of the default `npm test` run — see
  // task-001's Execution Notes for why: at this scaffold stage `src/` is almost entirely stub
  // `index.ts` files with no behavior for the initial test to exercise, so enforcing the >80%
  // threshold on every `npm test` would fail on emptiness rather than on a real regression. The
  // threshold itself is still declared here (satisfies the acceptance criteria) and is enforced
  // whenever coverage IS collected; `collectCoverageFrom` excludes barrel/stub `index.ts` files so
  // the threshold measures real logic once tasks add it, not placeholder re-exports.
  collectCoverageFrom: ['src/**/*.ts', '!src/**/index.ts'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
