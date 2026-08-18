// Unit coverage for detectFirstNativeJsxElement — the pure atom-element detector
// behind no-raw-html-atoms (scanAtomMappings -> buildAtomRuleRestrictions). It maps
// an atom .tsx to the native HTML element it wraps, so a regression here silently
// drops a forbid-raw-<el> restriction (e.g. molecules could use raw <input> again
// with no lint error). The RULE is integration-tested via run.mjs against fixtures;
// this pins the DETECTOR's subtle edge cases (Radix Slot asChild, string/comment
// stripping, lowercase-only tag matching) directly, with no oxlint round-trip.
//
// Imports from the built dist (ESM). `npm run build` must run first — the
// package `test` script builds before chaining this after run.mjs.
import { detectFirstNativeJsxElement } from '../dist/discover-atoms.js'

if (typeof detectFirstNativeJsxElement !== 'function') {
  console.error(
    'detectFirstNativeJsxElement is not exported from dist/discover-atoms.js — run `npm run build` (and ensure src/discover-atoms.ts exports it).',
  )
  process.exit(1)
}

const cases = [
  // [label, source, expected]
  ['Radix Slot asChild -> the quoted native element', `const Comp = asChild ? Slot : 'button'`, 'button'],
  ['Slot with double quotes', `const C = asChild ? Slot : "a"`, 'a'],
  ['first lowercase tag is the native element', `export const X = () => <input className="x" />`, 'input'],
  [
    'skips an uppercase component, matches the inner native tag',
    `const X = () => <Wrapper><label>Hi</label></Wrapper>`,
    'label',
  ],
  ['a tag inside a string literal is ignored', `const html = '<button>x</button>'`, null],
  ['a tag inside a line comment is ignored', '// renders a <textarea>\nexport const X = () => null', null],
  ['a tag inside a block comment is ignored', `/* <span> */ export const X = () => <Box />`, null],
  ['a component-only render has no native element', `export const X = () => <Card>hi</Card>`, null],
]

const failures = []
for (const [label, source, expected] of cases) {
  const got = detectFirstNativeJsxElement(source)
  if (got !== expected) {
    failures.push(`  ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`)
  }
}

if (failures.length > 0) {
  console.error('discover-atoms detectFirstNativeJsxElement unit regression FAILED:')
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`discover-atoms detectFirstNativeJsxElement OK — ${cases.length} assertions passed.`)
