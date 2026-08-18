---
name: biological-ui-arch
description: Configures and satisfies eslint-plugin-biological-ui-arch, 35 lint rules enforcing a biological tier architecture (atoms, molecules, compounds, organelles, cells, tissues) in React codebases. Covers wiring the plugin into oxlint jsPlugins or ESLint flat config, each tier's import and state contract so new components pass the rules on the first try, and a rule-by-rule remedy map for fixing violations. Use when setting up component architecture lint, writing or placing React components in a repo that uses UI tiers or this plugin, or resolving biological-ui-arch rule errors.
---

# Biological UI architecture: configure the lint, write code that passes it

The plugin turns a layered UI component architecture into lint rules that run
in CI. Rules identify a file's tier **from its path**, so placement is part of
the contract. Full rule-by-rule reference: README.md. This file is the
operating contract: where code goes, what each tier may do, and how to fix
each rule id.

## Configuring the plugin

Install: `npm install --save-dev eslint-plugin-biological-ui-arch`.

**oxlint** (primary — what the regression suite exercises), in `.oxlintrc.json`:

```jsonc
{
  "jsPlugins": ["eslint-plugin-biological-ui-arch"],
  "rules": {
    "biological-ui-arch/atom-no-deps": "error",
    "biological-ui-arch/cell-must-not-compose-cell": "error",
    "biological-ui-arch/tissue-no-hooks": "error"
    // ... enable the rules you want (full list in README.md)
  }
}
```

**ESLint flat config** (API-compatible, not covered by the tests; requires
ESLint 9+ because the rules use `context.filename`):

```js
// eslint.config.js
import bio from 'eslint-plugin-biological-ui-arch'

export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'biological-ui-arch': bio },
    rules: {
      'biological-ui-arch/atom-no-deps': 'error',
      'biological-ui-arch/cell-must-not-compose-cell': 'error',
      'biological-ui-arch/tissue-no-hooks': 'error',
      // ...
    },
  },
]
```

Two rules take options:

- `no-raw-html-atoms` — needs the map of native elements your atoms wrap.
  Generate it at config time instead of maintaining it by hand:
  ```js
  import { buildAtomRuleRestrictions } from 'eslint-plugin-biological-ui-arch/discover-atoms'
  const restrictions = buildAtomRuleRestrictions('src/atoms', '@ui/atoms')
  // 'biological-ui-arch/no-raw-html-atoms': ['error', restrictions]
  ```
  (`buildAtomRestrictions` emits the same mapping in `no-restricted-syntax`
  format for linters that support that instead.)
- `no-brand-names` — does nothing until configured:
  `["error", { "brands": ["examplebrand"], "allow": ["media.examplebrand.com"] }]`.
  Files under `examples/` are exempt.

Feedback loop: run your linter (e.g. `npx oxlint`) → fix findings per the
remedy map below → re-run until clean. For plugin development in this repo,
run `npm test` (builds with tsup, then runs the oxlint fixture regression +
unit tests).

## The tier contract — write to this and the rules pass

Folder layout the rules expect: tier folders `atoms/`, `molecules/`,
`compounds/`, `organelles/`, `cells/`, `tissues/`, plus `stores/` and `lib/`,
typically under `features/<name>/` or a design-system package. `utils/`,
`helpers/`, `components/`, `hooks/` folders are forbidden inside `features/*/`.

| Tier | Role | State | May import (lower tiers only) |
|---|---|---|---|
| atoms | smallest UI elements (button, input, badge) | inert | nothing from higher tiers — dependency-free leaves |
| molecules | simple combinations (form field, card row) | inert | atoms, other molecules |
| compounds | larger, still-presentational assemblies | inert | atoms, molecules, other compounds — never organelles, cells, tissues, stores, routes |
| organelles | hooks / stateful units (`use-*` files) | stateful | atoms, molecules, compounds, stores, other organelles — never cells or tissues |
| cells | self-contained sections (header, modal) | stateful | compounds, molecules, atoms, own organelles — never another cell, never tissues/routes |
| tissues | page layouts, multi-step flows | inert | cells and below — never organelles directly, never stores |

Rules of thumb that keep every file legal:

- **State lives only in organelles and cells.** A compound that needs a hook
  is a cell; a tissue that needs a hook is a cell; a "cell" with no state
  anywhere in its family is a compound.
- **Nothing imports upward, and cells never import cells** (the membrane
  rule; type-only imports across cells are allowed). Cross-cell coordination
  happens in the parent tissue; cross-feature data flows through the parent
  as props, not by reaching into another feature's `stores/`.
- **Composition must be real.** Several rules check the JSX render tree, not
  the import list: a molecule must actually render an atom/molecule/Radix
  primitive; a tissue must actually render something; importing without
  rendering is flagged as fake composition.
- **File hygiene.** Tier folders hold `.tsx` only (co-located
  `<component>.types.ts` allowed); pure logic goes in `lib/`, hooks in
  `organelles/`, stores in `stores/`. One exported component per public
  component file (private `.parts`/`.sections`/`.layouts` splits are
  accepted). No `interface`/`type` declarations in component files — type
  props inline, put shared types in `lib/types.ts`. `cells/index.ts` is a
  barrel of re-exports only.
- **Organelles:** one state source each — never mix Zustand with
  react-hook-form, at most one Zustand store per organelle (the cell
  coordinates across sources). Files using `useEffect`/`useLayoutEffect`
  carry an `-effect` filename suffix and an `Effect` function-name suffix.
- **Tissue props** are limited to `children`, ReactNode slots, `params`,
  `searchParams`, icon types, and layout-variant literal unions. A primitive
  or domain-typed prop means the file is a cell.
- **Next.js route segments** (`page`/`layout`/`template`) are thin delegates:
  return exactly one imported component — a tissue — or `null`. No inline
  JSX, no native HTML wrapping. Route fallback files
  (`default`/`not-found`/`loading`/`error`) are exempt from most JSX rules.
- **Design-system consistency:** use the atom wrapper instead of the raw
  native element it wraps; use the Card atom instead of a border+background
  `<div>`; no `React.*` namespace access (use named imports, e.g.
  `import type { ReactNode } from 'react'`); call Zustand store hooks with a
  selector, consolidating multiple selectors with `useShallow`.

## Fixing violations, by rule id

Tier direction:

| Rule | Remedy |
|---|---|
| `atom-no-deps` | Remove the higher-tier import; if the atom genuinely needs it, the file is not an atom — move it up a tier. |
| `molecule-atoms-only` | Compose only atoms/molecules. If it composes a stateful primitive, move the file to `cells/`. |
| `compound-no-stores` | Drop the organelle/cell/tissue/store/route import; receive data via props, or promote the file to a cell. |
| `organelle-dependency` | An organelle importing a cell/tissue is inverted — lift the coordination into the cell that uses the organelle. |
| `cell-no-tissues` | Remove the tissue/route import; the tissue composes the cell, never the reverse. |
| `cell-must-not-compose-cell` | Lift the second cell into the parent tissue and pass what is needed as props. Type-only imports are fine. |
| `tissue-no-organelles` | Reach the organelle through a cell — wrap the stateful part in a cell the tissue renders. |
| `tissue-no-stores` | Move store access into a cell or organelle inside the tissue. |
| `no-cross-feature-stores` | Read only `features/<own>/stores/` or shared stores; pass cross-feature data down as props. |

State placement:

| Rule | Remedy |
|---|---|
| `compound-must-be-stateless` | Remove hook imports/calls and context providers, or move the file to `cells/`. |
| `cell-must-be-stateful` | A stateless "cell" is a compound — move it to `compounds/` (or give it its real state via an organelle/store). |
| `tissue-no-hooks` | A tissue calling stateful hooks is a cell — move it, or push the hook into a cell it renders. |
| `tissue-no-data-props` | Move the file from `tissues/` to `cells/` (cells own data), or reduce props to the allowed set (children, slots, params, searchParams, icon types, literal-union variants). |
| `organelle-single-source` | Split the organelle so each has one state source; coordinate in the cell. |

Composition honesty:

| Rule | Remedy |
|---|---|
| `molecule-must-compose` | Actually render the imported atom/molecule, or demote the file (a lone styled element is an atom). |
| `tissue-must-compose` | Render at least one real child; a passthrough `<>{children}</>` wrapper should be deleted or given content. |
| `no-hook-in-component-disguise` | The component only runs effects and renders null/children — move it to `organelles/use-<name>-effect.ts` and call the hook from a real component. |
| `no-inert-hidden-jsx` | Delete elements whose only purpose is a `hidden` className with no functional attributes. |
| `no-trivial-wrapper-component` | Delete the wrapper and call the inner component directly, or give it real work (structure, hooks, children). |

Hygiene and consistency:

| Rule | Remedy |
|---|---|
| `no-invalid-feature-folders` | Move files into a valid tier folder; hooks go in `organelles/`, not `hooks/`. |
| `no-ts-in-bio-folders` | Move `.ts` logic to `lib/`, hooks to `organelles/`, stores to `stores/`; only `.tsx` (and `*.types.ts`) stay. |
| `no-type-definitions-in-components` | Type props inline; move shared types to `lib/types.ts`. |
| `no-logic-in-component-files` | Split extra exported components into their own files (private `.parts` siblings are fine). |
| `cells-folder-index-is-barrel` | Move component definitions out of `cells/index.ts`; leave only re-exports. |
| `effect-hook-naming` | Rename file to `use-<name>-effect.ts` and the hook to `use<Name>Effect`. |
| `no-raw-html-atoms` | Replace the raw element with the design-system atom that wraps it. |
| `no-card-shaped-div` | Replace the border+background `<div>` with the Card atom. |
| `no-duplicate-jsx-patterns` | Extract the thrice-repeated className pattern into a compound. |
| `no-inline-data-in-jsx` | Move the inline array of object literals to `lib/` and import it. |
| `no-renamed-html-props` | Spread `ComponentProps` and keep the native HTML prop names. |
| `no-render-prop-reader` | Drop the `View={}` render prop; let the organelle read the store and render its own output. |
| `no-brand-names` | Remove the brand word, or add a legitimate host to the rule's `allow` list. |
| `next-route-segment-is-thin-delegate` | Move the implementation into a tissue under `features/*/tissues/` and return only that import (wrap fragments in a tissue). |
| `no-react-namespace` | Replace `React.X` with a named import from `'react'`. |
| `zustand-v5-best-practices` | Call the store hook with a selector; merge multiple selectors on one store with `useShallow`. |
