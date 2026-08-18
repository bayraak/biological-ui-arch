// Regression lock for the biological-ui-arch rules.
//
// These rules silently no-op'd for the entire kit migration because they were
// scoped to a features/<name>/<tier>/ path the flat kit never had, and nothing
// tested them. This runner asserts each refined rule (a) STILL fires on a
// genuine breach and (b) does NOT fire on the kit's accepted conventions
// (own-sibling splits, .types files, iterator-authored JSX, preset wrappers,
// hooks in private parts). It runs the REAL oxlint pipeline against the built
// plugin, so it also catches the plugin silently going dead.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pkgRoot = resolve(here, '..')
const config = resolve(here, 'fixtures.oxlintrc.json')
const fixtures = resolve(here, 'fixtures')

// Resolve the oxlint binary directly from a node_modules/.bin on the way up to
// the workspace root. Invoking the binary by absolute path avoids `npx`/`pnpm
// exec`, which under turbo's task env try to (re)install into this dep-less
// package ("node_modules missing, did you mean to install?") and fail.
function resolveOxlint() {
  let dir = pkgRoot
  for (;;) {
    const bin = resolve(dir, 'node_modules/.bin/oxlint')
    if (existsSync(bin)) return bin
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return 'oxlint' // fall back to PATH
}

const oxlintBin = resolveOxlint()

let output = ''
try {
  // `--format=unix` forces one-line `path:line:col: msg [Error/rule]` diagnostics
  // so the `fires()` matcher is deterministic. Without it, oxlint emits its
  // multi-line graphical format under turbo's non-TTY env (rule + path on
  // separate lines), and every assertion silently mis-reports as "did not fire".
  output = execFileSync(
    oxlintBin,
    ['--format=unix', '--config', config, fixtures],
    { cwd: pkgRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )
} catch (err) {
  // oxlint exits non-zero when it reports problems — that's expected here.
  output = `${err.stdout || ''}${err.stderr || ''}`
}

// A rule "fires on file" when some diagnostic line names BOTH the file and the rule.
const fires = (file, rule) =>
  output
    .split('\n')
    .some((line) => line.includes(`/${file}:`) && line.includes(`biological-ui-arch(${rule})`))

const cases = [
  // [file, rule, shouldFire]
  ['cells/bad-cross-cell.tsx', 'cell-must-not-compose-cell', true],
  ['cells/good-own-sibling.tsx', 'cell-must-not-compose-cell', false],
  ['cells/bad-stateless-display.tsx', 'cell-must-be-stateful', true],
  ['cells/good-stateful.tsx', 'cell-must-be-stateful', false],
  ['organelles/bad-imports-cell.tsx', 'organelle-dependency', true],
  ['organelles/good-imports-atom.tsx', 'organelle-dependency', false],
  ['cells/bad-logic.ts', 'no-ts-in-bio-folders', true],
  ['cells/good-shape.types.ts', 'no-ts-in-bio-folders', false],
  ['brand/bad-brand.tsx', 'no-brand-names', true],
  ['brand/good-media-url.tsx', 'no-brand-names', false],
  ['cells/bad-two-exports.tsx', 'no-logic-in-component-files', true],
  ['cells/good-one-export.tsx', 'no-logic-in-component-files', false],
  ['cells/bad-triplicate.tsx', 'no-duplicate-jsx-patterns', true],
  ['cells/good-iterated.tsx', 'no-duplicate-jsx-patterns', false],
  ['tissues/bad-passthrough.tsx', 'tissue-must-compose', true],
  ['tissues/good-composes.tsx', 'tissue-must-compose', false],
  ['tissues/good-types.types.ts', 'tissue-must-compose', false],
  ['tissues/bad-hooks-entry.tsx', 'tissue-no-hooks', true],
  ['tissues/good-hooks.parts.tsx', 'tissue-no-hooks', false],
  ['react/bad-react-namespace.tsx', 'no-react-namespace', true],
  ['react/good-react-namespace.tsx', 'no-react-namespace', false],
  ['tissues/bad-store-import.tsx', 'tissue-no-stores', true],
  ['tissues/good-composes.tsx', 'tissue-no-stores', false],
  ['tissues/bad-organelle-import.tsx', 'tissue-no-organelles', true],
  ['tissues/good-composes.tsx', 'tissue-no-organelles', false],
  ['cells/bad-tissue-import.tsx', 'cell-no-tissues', true],
  ['cells/good-stateful.tsx', 'cell-no-tissues', false],
  ['compounds/bad-store-import.tsx', 'compound-no-stores', true],
  ['compounds/good-compound.tsx', 'compound-no-stores', false],
  ['compounds/bad-stateful.tsx', 'compound-must-be-stateless', true],
  ['compounds/good-compound.tsx', 'compound-must-be-stateless', false],
  ['molecules/bad-cell-import.tsx', 'molecule-atoms-only', true],
  ['molecules/good-molecule.tsx', 'molecule-atoms-only', false],
  ['molecules/bad-passthrough.tsx', 'molecule-must-compose', true],
  ['molecules/good-molecule.tsx', 'molecule-must-compose', false],
  ['atoms/bad-import.tsx', 'atom-no-deps', true],
  ['atoms/good-atom.tsx', 'atom-no-deps', false],
  ['organelles/use-counter.ts', 'effect-hook-naming', true],
  ['organelles/use-counter-effect.ts', 'effect-hook-naming', false],
  ['cells/bad-type-def.tsx', 'no-type-definitions-in-components', true],
  ['cells/good-stateful.tsx', 'no-type-definitions-in-components', false],
]

const failures = []
for (const [file, rule, shouldFire] of cases) {
  const did = fires(file, rule)
  if (did !== shouldFire) {
    failures.push(
      `  ${did ? 'FIRED but should NOT' : 'did NOT fire but should'}: ${rule} on ${file}`,
    )
  }
}

if (failures.length > 0) {
  console.error('biological-ui-arch rule regression FAILED:')
  console.error(failures.join('\n'))
  console.error('\n--- oxlint output ---\n' + output)
  process.exit(1)
}
console.log(`biological-ui-arch rule regression OK — ${cases.length} assertions passed.`)
