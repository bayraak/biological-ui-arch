# Extraction notes — eslint-plugin-biological-ui-arch

Staged 18 Aug 2026 from two monorepo copies of the same plugin. Not published, not pushed. Local git only, no remote configured.

## Sources compared

- `dielime/packages/eslint-plugin-biological-architecture` (base, chosen)
- `during.day/packages/eslint-plugin-biological-architecture`

## Why dielime is the base

- It is the superset: it has every rule during.day has, plus two rules during.day lacks (`cell-must-be-stateful`, `no-brand-names`). 35 rules vs 33.
- It is newer in substance: rule bodies dated Jun 3-4 2026 vs during.day's Apr 2026. during.day's four files with Jul 11 2026 mtimes are a Prettier reformat of the older logic, not new features (verified by diff).
- Its versions of shared rules are functionally richer. Examples: `tissue-must-compose` in dielime recognizes react-email primitives, `.parts`/`.sections`/`.layouts` sibling splits, feature barrels, and re-export shims; dielime's tissue path pattern `(?:features/[^/]+/)?tissues/` also matches flat design-kit layouts where during.day's `features/[^/]+/tissues/` only matches feature folders.
- Its test suite (41 fixture assertions through the real oxlint pipeline + 8 unit assertions) runs on plain Node, so it works outside any monorepo. during.day's suite requires Bun (`bun test`).

## Divergences between the two copies (nothing taken from during.day)

- Rules only in dielime: `cell-must-be-stateful`, `no-brand-names`.
- Rules only in during.day: none.
- during.day path-scoping is narrower (feature folders only); dielime also covers flat kit layouts. Kept dielime's.
- during.day builds with Bun and exposes a `bun` export condition plus a `typecheck` script; dielime builds with tsup. Kept tsup. No `typecheck` script was carried over (dielime had none; the source rules typecheck loosely by design, using structural `unknown`-based AST types).
- One comment string differed by brand only (`@dielime/ui/atoms/button` vs `@during/ui/atoms/button`); both genericized to `@ui/atoms/button`.

## Renames

- Package name: `eslint-plugin-biological-architecture` -> `eslint-plugin-biological-ui-arch`, version 0.1.0, `private` removed.
- Plugin `meta.name` in `src/index.ts`: `biological-architecture` -> `biological-ui-arch`, `meta.version` -> `0.1.0`. This is the rule namespace, so configs reference `biological-ui-arch/<rule>`.
- `test/fixtures.oxlintrc.json`: all 20 rule keys re-prefixed; `jsPlugins` changed from the workspace package name to `"../dist/index.js"` (resolved relative to the config file) so the suite runs without the package being installed in its own `node_modules`.
- `test/run.mjs`: diagnostic matcher updated to `biological-ui-arch(<rule>)`.

## Standalone changes

- `package.json` rewritten: MIT license, author Bayram Ali Basgul, repository `github.com/bayraak/biological-ui-arch`, `files` whitelist (`dist`, README, LICENSE), `prepublishOnly: npm test`. There were no workspace-protocol dependencies to remove (the dielime copy was dependency-less and borrowed oxlint/tsup from the monorepo root); the borrowed tools are now explicit devDependencies: `oxlint ^1.77.0`, `tsup ^8.5.1`, `typescript ^5.9.3` (versions matching what the monorepo pinned).
- `test` script now runs `npm run build` first (turbo's task graph used to provide that ordering).
- Added `.gitignore`, `LICENSE`, `README.md`, `.github/workflows/ci.yml` (ubuntu-latest, Node 22, `npm ci`, `npm test`).

## Scrub log (every content change, file by file)

- `src/discover-atoms.ts`: default `importPathPrefix` `'@dielime/ui/atoms'` -> `'@ui/atoms'` (2 occurrences). Callers can pass their own prefix; the default only affects message text.
- `src/rules/no-raw-html-atoms.ts`: description "Use the atom from @dielime/ui instead." -> "Use the wrapping atom from your UI kit instead."
- `src/rules/no-card-shaped-div.ts`: two message strings "Use <Card> ... from @dielime/ui/atoms/card instead" -> "Use the <Card> atom from your design system instead".
- `src/rules/next-route-segment-is-thin-delegate.ts`: comment example `'@dielime/ui/atoms/button'` -> `'@ui/atoms/button'`.
- `src/rules/no-brand-names.ts`: **behavioral change.** The rule had `sunbasket` and `buketi` hardcoded in its regex and `media.sunbasket.com` as a hardcoded allowance. Rewritten to take options `{ brands: string[], allow: string[] }` with a JSON schema; with no `brands` configured the rule is a no-op. Logic otherwise identical (line scan, `allow` substrings stripped before matching, `examples/` exempt, first hit per file reported).
- `test/fixtures/brand/bad-brand.tsx`: `'Powered by Sunbasket'` -> `'Powered by ExampleBrand'`.
- `test/fixtures/brand/good-media-url.tsx`: `media.sunbasket.com` URL -> `media.examplebrand.com`.
- `test/fixtures.oxlintrc.json`: `no-brand-names` now configured `["error", { "brands": ["examplebrand"], "allow": ["media.examplebrand.com"] }]`. This also proves oxlint passes options through to jsPlugin rules.
- Internal doctrine references removed from rule descriptions, messages, and comments, wording of the principle kept: `CLAUDE.md §11.10` / `§11.2` / `§11.5` / `ARTICLE XI` mentions in `tissue-must-compose.ts`, `molecule-must-compose.ts`, `no-hook-in-component-disguise.ts`, `tissue-no-data-props.ts`, `no-render-prop-reader.ts`.
- `test/discover-atoms.test.mjs`: comment "run `pnpm build`" -> "run `npm run build`" (2 mentions), since the package no longer lives under pnpm/turbo.
- Not scrubbed, deliberately: `test/run.mjs` keeps two comments mentioning turbo's non-TTY env as the historical reason for `--format=unix` and for resolving the oxlint binary by walking `node_modules/.bin`. Both behaviors still make sense standalone and the comments explain real quirks.
- Verified clean: grep across staging (sources, tests, configs, docs) for dielime, buketi, sunbasket, during, musa, noissue, triog, and `/Users/` paths finds nothing. `bayram`/`basgul`/`bayraak` appear only where intended: package.json author and repository fields, LICENSE.

## Test results (standalone)

```
npm install    # 50 packages, no workspace, no pnpm, no turbo
npm test
  tsup build OK
  biological-ui-arch rule regression OK — 41 assertions passed.
  discover-atoms detectFirstNativeJsxElement OK — 8 assertions passed.
```

Node v24 locally; CI pins Node 22.

## Needs the owner's eye before publishing

1. **`no-brand-names` API change.** The `brands`/`allow` options shape is my design. If you prefer a different shape (flat array, regex strings), now is the time; it is public API once published.
2. **Rule count vs configs.** The fixture config enables 20 of 35 rules; that matches the source repo and tests the trickiest rules, but 15 rules ship without regression fixtures (`no-raw-html-atoms`, `no-card-shaped-div`, `no-cross-feature-stores`, `no-renamed-html-props`, `no-render-prop-reader`, `no-inert-hidden-jsx`, `no-inline-data-in-jsx`, `no-invalid-feature-folders`, `no-trivial-wrapper-component`, `no-hook-in-component-disguise`, `next-route-segment-is-thin-delegate`, `cells-folder-index-is-barrel`, `organelle-single-source`, `zustand-v5-best-practices`, `no-type-definitions-in-components`). Same coverage as the source; noted so it is not mistaken for full coverage.
3. **ESLint flat config is documented but untested.** The rules follow the ESLint rule API and use `context.filename` (ESLint 9+), but the suite only exercises oxlint. Consider an ESLint smoke test before advertising it hard.
4. **`no-react-namespace` and `zustand-v5-best-practices` are general React rules**, not tier-architecture rules. Fine to ship, but you may want them out of scope for this package's identity.
5. **GitHub repo name** assumed `bayraak/biological-ui-arch` per your instruction; create it before publishing so the repository field resolves.
6. **`README.md` claims "extracted from two production Next.js codebases"** without naming them. Confirm you are comfortable with even that much provenance.

## How the monorepos would consume the published package (describe only, not performed)

- **dielime**: in `.oxlintrc.json`, change `jsPlugins` entry `"eslint-plugin-biological-architecture"` to `"eslint-plugin-biological-ui-arch"` and re-prefix the `biological-architecture/...` rule keys to `biological-ui-arch/...`; add `eslint-plugin-biological-ui-arch` to root devDependencies and delete `packages/eslint-plugin-biological-architecture`. Note: dielime's config enables `no-brand-names` as plain `"error"`; after the option change it must become `["error", { "brands": ["sunbasket", "buketi"], "allow": ["media.sunbasket.com"] }]` or the rule silently stops firing.
- **during.day**: replace the `@during/eslint-plugin-biological-architecture` workspace dependency with `eslint-plugin-biological-ui-arch` and update its lint config's plugin reference/prefix the same way. Two rules new to during.day (`cell-must-be-stateful`, `no-brand-names`) arrive with the package; they are opt-in per rule, so nothing fires until enabled. The `bun` export condition is gone; the package resolves to `dist/` ESM, which Bun consumes fine.
