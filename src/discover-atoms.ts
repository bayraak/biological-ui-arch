import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

// Atoms that wrap generic container elements should NOT forbid raw usage:
// <div>/<span> are too generic - forbidding them would break every component.
const GENERIC_ELEMENTS = new Set(['div', 'span'])

interface AtomMapping {
  atomFile: string
  atomName: string
  nativeElement: string
}

interface AtomRestriction {
  atom: string
  element: string
  importPath: string
}

interface RestrictedSyntaxEntry {
  message: string
  selector: string
}

/**
 * Build no-restricted-syntax entries that forbid raw native HTML usage
 * for every native element wrapped by an atom. Apply these entries to
 * molecules, compounds, cells, and tissues (NOT atoms themselves).
 */
export function buildAtomRestrictions(
  atomsDir: string,
  importPathPrefix = '@ui/atoms',
): RestrictedSyntaxEntry[] {
  const mappings = scanAtomMappings(atomsDir)
  return mappings.map(({ atomName, nativeElement }) => ({
    message: `Use <${toPascalCase(atomName)}> from '${importPathPrefix}/${atomName}' instead of raw <${nativeElement}>. Native HTML elements that have an atom wrapper must not be used directly in molecules/compounds/cells/tissues - use the atom to preserve consistent styling and behavior.`,
    selector: `JSXOpeningElement[name.name='${nativeElement}']`,
  }))
}

/**
 * Build atom restrictions in the format expected by the no-raw-html-atoms rule.
 * This replaces no-restricted-syntax for linters that don't support it (e.g. oxlint).
 */
export function buildAtomRuleRestrictions(
  atomsDir: string,
  importPathPrefix = '@ui/atoms',
): AtomRestriction[] {
  const mappings = scanAtomMappings(atomsDir)
  return mappings.map(({ atomName, nativeElement }) => ({
    atom: toPascalCase(atomName),
    element: nativeElement,
    importPath: `${importPathPrefix}/${atomName}`,
  }))
}

/**
 * Scan the atoms directory and build a mapping from native HTML element
 * to the atom that wraps it. This is used to generate no-restricted-syntax
 * entries that forbid raw native HTML usage in higher-level components.
 *
 * When multiple atoms wrap the same element (e.g. `input.tsx` and
 * `inline-input.tsx` both wrap `<input>`), the atom whose filename
 * exactly matches the element name is preferred as the canonical one.
 * Variants are kept as alternatives in the error message.
 */
export function scanAtomMappings(atomsDir: string): AtomMapping[] {
  const entries = readdirSync(atomsDir, { withFileTypes: true })
  const candidates = new Map<string, AtomMapping[]>()

  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!entry.name.endsWith('.tsx')) continue

    const atomFile = entry.name
    const atomName = basename(atomFile, '.tsx')
    const content = readFileSync(join(atomsDir, atomFile), 'utf8')
    const nativeElement = detectFirstNativeJsxElement(content)

    if (!nativeElement) continue
    if (GENERIC_ELEMENTS.has(nativeElement)) continue

    const existing = candidates.get(nativeElement) || []
    existing.push({ atomFile, atomName, nativeElement })
    candidates.set(nativeElement, existing)
  }

  // For each element, prefer the atom whose name exactly matches the element.
  const mappings: AtomMapping[] = []
  for (const [element, list] of candidates) {
    const exact = list.find((m) => m.atomName === element)
    mappings.push(exact ?? list[0])
  }

  return mappings
}

export function detectFirstNativeJsxElement(source: string): null | string {
  // Handle the polymorphic Radix Slot pattern first:
  //   const Comp = asChild ? Slot : 'button'
  // This is the canonical pattern for atoms that support asChild composition.
  // The string literal IS the native element the atom wraps.
  const slotMatch = source.match(/Slot\s*:\s*['"]([a-z][a-z0-9]*)['"]/)
  if (slotMatch) return slotMatch[1]

  // Strip string literals and comments so we don't match JSX-looking text inside them
  const cleaned = source
    .replaceAll(/\/\/.*$/gm, '')
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .replaceAll(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, '""')

  // Look for the first JSX opening element whose tag name starts with a lowercase letter
  // (uppercase would mean a React component, not a native HTML element)
  const match = cleaned.match(/<([a-z][a-z0-9]*)\b/)
  return match ? match[1] : null
}

function toPascalCase(kebab: string): string {
  return kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}
