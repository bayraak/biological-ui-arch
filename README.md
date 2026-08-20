# eslint-plugin-biological-ui-arch

[![CI](https://github.com/bayraak/biological-ui-arch/actions/workflows/ci.yml/badge.svg)](https://github.com/bayraak/biological-ui-arch/actions/workflows/ci.yml)

An architecture that is not enforced by tooling is a suggestion. This plugin turns a layered UI component architecture into 35 lint rules, so the layer boundaries hold on every commit instead of surviving only as a diagram in a doc. It was extracted from two production Next.js codebases where the rules run in CI on every change.

## The biological tier architecture

UI components are organized into tiers, named by analogy with biology. Each tier may only compose tiers at or below its own level, and state may live only where the tier definition allows it.

```
atoms -> molecules -> compounds -> organelles -> cells -> tissues
```

| Tier | Role | State |
|---|---|---|
| **atoms** | Smallest indivisible UI elements (button, input, badge, icon) | inert |
| **molecules** | Simple combinations of atoms (form field, card row) | inert |
| **compounds** | Larger composed, still-presentational assemblies | inert |
| **organelles** | Hooks and stateful units (`use-*` files) | stateful |
| **cells** | Complex self-contained sections (header, modal, drawer) | stateful |
| **tissues** | Full page layouts and multi-step flows; pure arrangements of cells | inert |

Core doctrine, each point backed by rules below:

- State lives only at the organelle and cell tiers. Atoms, molecules, compounds, and tissues are inert.
- Dependencies point downward only. A tissue composes cells; a cell composes compounds, molecules, atoms, and its own organelles; nothing imports upward.
- A cell may not import another cell (the "membrane" rule). Cross-cell coordination happens in the parent tissue.
- Composition must be real. Importing a lower-tier component without rendering it satisfies a naive import-based lint but not this one; several rules check the JSX render tree to catch "lint-theater".
- Files live in tier folders (`atoms/`, `molecules/`, `compounds/`, `organelles/`, `cells/`, `tissues/`, plus `stores/` and `lib/`), typically under `features/<name>/` or a design-system package. The rules identify a file's tier from its path.

## Install

```sh
npm install --save-dev github:bayraak/biological-ui-arch   # not on npm yet; install from GitHub
```

## Usage with oxlint (primary, what the test suite runs)

The plugin is written against the ESLint rule API that oxlint's `jsPlugins` supports. In `.oxlintrc.json`:

```jsonc
{
  "jsPlugins": ["eslint-plugin-biological-ui-arch"],
  "rules": {
    "biological-ui-arch/atom-no-deps": "error",
    "biological-ui-arch/cell-must-not-compose-cell": "error",
    "biological-ui-arch/tissue-no-hooks": "error"
    // ... enable the rules you want, see the table below
  }
}
```

## Usage with ESLint flat config

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

The rules use `context.filename`, so ESLint 9 or later is required. The regression suite exercises the rules through oxlint; ESLint flat config is API-compatible but not covered by the tests.

## Rules

### Tier direction

| Rule | Enforces |
|---|---|
| `atom-no-deps` | Atoms import nothing from higher tiers. Atoms are dependency-free leaves. |
| `molecule-atoms-only` | Molecules combine atoms (and other molecules) only. Composing a stateful primitive makes the file a cell. |
| `compound-no-stores` | Compounds may import atoms, molecules, and other compounds. Never organelles, cells, tissues, stores, or routes. |
| `organelle-dependency` | Organelles may depend on atoms, molecules, compounds, stores, and other organelles (sub-organelles). Never on cells or tissues. |
| `cell-no-tissues` | Cells cannot import tissues or app route files. Tissues compose cells, not the reverse. |
| `cell-must-not-compose-cell` | The membrane rule. A cell must not import any other cell, anywhere in the repo. Type-only imports are allowed. |
| `tissue-no-organelles` | Tissues cannot import organelles directly. Organelles live inside cells; a tissue reaches one through a cell. |
| `tissue-no-stores` | Tissues cannot import stores. State lives at the organelle and cell levels. |
| `no-cross-feature-stores` | A cell or organelle in `features/X/` reads only `features/X/stores/` or shared stores. Cross-feature data flows through the parent as props. |

### State placement

| Rule | Enforces |
|---|---|
| `compound-must-be-stateless` | Compounds are props-in/JSX-out. No hook imports, no hook calls, no context providers. |
| `cell-must-be-stateful` | A cell must own state somewhere in its family (a hook, a state-bearing organelle, or a store). A fully stateless "cell" is a compound and belongs in `compounds/`. |
| `tissue-no-hooks` | Tissues cannot import stateful React hooks. A tissue that needs hooks is actually a cell. |
| `tissue-no-data-props` | Tissues must not own data. Tissue props are limited to `children`, ReactNode slots, `params`, `searchParams`, icon types, and layout-variant literal unions. A primitive or domain-typed prop means the file is a cell. |
| `organelle-single-source` | One state source per organelle: no mixing Zustand with react-hook-form, and at most one Zustand store per organelle. The cell coordinates across sources. |

### Composition honesty

These rules check the JSX render tree, not just the import list, so an import added to satisfy a naive lint does not pass.

| Rule | Enforces |
|---|---|
| `molecule-must-compose` | A molecule must actually render at least one atom, molecule, or Radix primitive. Importing without rendering is fake composition. |
| `tissue-must-compose` | A tissue (or Next.js page/layout/template) must actually render at least one cell, compound, molecule, atom, or tissue. Passthrough wrappers like `<>{children}</>` do not count. Route fallback files and metadata-only layouts are exempt. |
| `no-hook-in-component-disguise` | A component whose body calls effect hooks but only ever returns `null`, bare `children`, or an empty fragment is a hook wearing a component costume. Move it to `organelles/use-*-effect.ts`. |
| `no-inert-hidden-jsx` | Forbids elements whose only className is `hidden` and which have no functional attributes. Hidden-but-functional elements (file inputs behind labels, skip links) are allowed. |
| `no-trivial-wrapper-component` | Flags components whose entire body is `return <ImportedComponent/>` with no children, dynamic attrs, or hooks. Route files are exempt, since thin delegation is their purpose. |

### File and folder hygiene

| Rule | Enforces |
|---|---|
| `no-invalid-feature-folders` | Files inside `features/*/` sit in a valid tier folder. `utils/`, `helpers/`, `components/`, `hooks/` are forbidden; hooks go in `organelles/`. |
| `no-ts-in-bio-folders` | Tier folders hold `.tsx` only. Pure logic goes in `lib/`, hooks in `organelles/`, stores in `stores/`. Co-located `<component>.types.ts` files are allowed. |
| `no-type-definitions-in-components` | Component `.tsx` files contain no `interface`/`type` declarations. Props are typed inline; shared types go in `lib/types.ts`. |
| `no-logic-in-component-files` | One exported component per public component file. Private sibling splits (`.parts`/`.sections`/`.layouts`), co-located helpers, and thin preset wrappers are accepted. |
| `cells-folder-index-is-barrel` | `index.ts` under `cells/` contains only re-exports. Component definitions live in their own files. |
| `effect-hook-naming` | Hook files using `useEffect`/`useLayoutEffect` carry an `-effect` filename suffix and an `Effect` function-name suffix, so side-effectful hooks are identifiable at the import site. |

### Design-system consistency

| Rule | Enforces |
|---|---|
| `no-raw-html-atoms` | Forbids raw native HTML elements that have an atom wrapper. Takes a restriction list as options; generate it from your atoms folder with the `discover-atoms` helper (below). |
| `no-card-shaped-div` | Forbids a raw `<div>` styled as a card (border plus background classes). Use the design system's Card atom. |
| `no-duplicate-jsx-patterns` | The same long className repeated 3+ times signals a missed compound extraction. Iterator-authored JSX and symmetric pairs are ignored. |
| `no-inline-data-in-jsx` | Forbids inline data arrays (3+ object literals) in JSX. Configuration data lives in `lib/`. |
| `no-renamed-html-props` | Components spread `ComponentProps` and keep HTML-native prop names instead of renaming them. |
| `no-render-prop-reader` | Forbids the `View={}` render-prop reader pattern. Organelles read from stores and render their own output. |
| `no-brand-names` | Keeps a brand-agnostic kit brand-free. Configure the forbidden brand words via `brands` and exempt substrings (demo CDN hosts) via `allow`. Files under `examples/` are exempt. Does nothing until `brands` is configured. |

### Framework specifics

| Rule | Enforces |
|---|---|
| `next-route-segment-is-thin-delegate` | Next.js `page`/`layout`/`template` files return exactly one imported component or `null`. No inline JSX, no native HTML wrapping, no helpers. Route fallback files are exempt. |
| `no-react-namespace` | No `React.*` namespace access. Use named imports (`import type { ReactNode } from 'react'`). |
| `zustand-v5-best-practices` | Store hooks are called with a selector, and multiple selectors on one store are consolidated with `useShallow`. |

## The `discover-atoms` helper

`no-raw-html-atoms` needs to know which native elements your atoms wrap. Rather than maintaining that list by hand, scan the atoms folder at config time:

```js
import { buildAtomRuleRestrictions } from 'eslint-plugin-biological-ui-arch/discover-atoms'

const restrictions = buildAtomRuleRestrictions('src/atoms', '@ui/atoms')
// pass as the rule's option:
// 'biological-ui-arch/no-raw-html-atoms': ['error', restrictions]
```

It detects each atom's wrapped element from its source, including the Radix `asChild ? Slot : 'button'` pattern, prefers the atom whose filename matches the element, and skips generic containers (`div`, `span`). `buildAtomRestrictions` produces the same mapping in `no-restricted-syntax` format for linters that support that instead.

## Development

```sh
npm install
npm test   # builds with tsup, then runs the oxlint fixture regression + unit tests
```

The regression suite runs the real oxlint pipeline against fixture files and asserts each rule both fires on a genuine breach and stays quiet on the accepted conventions.

## Agent skill

The repo ships a [SKILL.md](SKILL.md) for AI agents: how to wire the plugin
into oxlint or ESLint, each tier's import and state contract so generated
components pass the rules first try, and a remedy for every rule id. Point an
agent at the repo and it picks the skill up, or copy the repo folder into your
agent's skills directory (e.g. `~/.claude/skills/`).

## License

MIT
