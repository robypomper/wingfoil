/**
 * The environment a suite hands a real `npm` it spawns
 * (`task-146-make-suite-result-independent-concurrent-runs-machine-load`, `bug-181`, `bug-167`).
 *
 * npm reads every environment variable named `npm_config_<key>`, in either letter case, as
 * configuration. `npm run …` exports its own configuration that way to the scripts it runs, so a
 * suite started by `npm run -s test:coverage` carries `npm_config_loglevel=silent`, and a spawned npm
 * that inherited it printed nothing: the publish dry-run case asserting npm's `+ <name>@<version>`
 * line failed under `npm run -s` and passed under `npm run`.
 */

/** Run `body` with `vars` added to this process's environment, as a caller's shell would export them. */
export function withCallerEnv<T>(vars: Readonly<Record<string, string>>, body: () => T): T {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  Object.assign(process.env, vars);
  try {
    return body();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}
