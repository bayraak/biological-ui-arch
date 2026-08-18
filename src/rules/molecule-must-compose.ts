// Molecules combine atoms (+ other molecules, + Radix primitives for multi-part
// Molecules). This rule checks BEHAVIOR (render), not syntax (import). A molecule
// That imports an atom but never renders it is FAKE composition — the import is
// Lint-theater. ("lint-theater" prohibition).

import fs from 'node:fs'

// A pure re-export shim (only `export … from`, no component) is a compatibility
// alias left behind when a component moves to a feature folder — not a molecule.
function isReexportOnly(file: string): boolean {
  try {
    const src = fs
      .readFileSync(file, 'utf8')
      .replaceAll(/\/\*[\s\S]*?\*\//g, '')
      .replaceAll(/\/\/.*$/gm, '')
    const hasReexport = /\bexport\b[^;]*\bfrom\b\s*['"]/.test(src)
    const hasComponent = /\bfunction\b|=>|\breturn\b|<[A-Za-z]/.test(src)
    return hasReexport && !hasComponent
  } catch {
    return false
  }
}

interface ImportSpecifier {
  imported?: { name?: string; type: string }
  local?: { name?: string; type: string }
  type: string
}

interface ImportNode {
  importKind?: string
  loc: unknown
  source: { value: string }
  specifiers?: ImportSpecifier[]
}

interface JsxIdentifier {
  name?: string
  type: 'JSXIdentifier'
}

interface JsxMemberExpression {
  object?: { name?: string; type: string }
  property?: { name?: string; type: string }
  type: 'JSXMemberExpression'
}

interface JsxOpeningElement {
  attributes?: unknown[]
  loc?: unknown
  name: JsxIdentifier | JsxMemberExpression | { type: string }
  type: 'JSXOpeningElement'
}

function isCompositionSource(src: string): boolean {
  // Our own atoms/molecules — relative (../atoms/x, ../../feature/atoms/x), a
  // self-subpath feature barrel (#ui/button/atoms, #email/body/molecules), or a
  // legacy absolute path. Match the tier segment with a trailing slash OR at the
  // end of the specifier so feature-barrel imports (`…/atoms`) are recognized.
  if (/\/(atoms|molecules)(\/|$)/.test(src)) return true
  if (/^\.\/[^/]+$/.test(src)) return true
  // Radix primitives count as composition for multi-part molecules
  if (src.startsWith('@radix-ui/') || src === 'radix-ui' || src.startsWith('radix-ui/')) return true
  // react-email primitives are the email surface's compositional units —
  // an email molecule that renders <Section>/<Row>/<Text> IS composing.
  if (src.startsWith('@react-email/')) return true
  return false
}

const moleculeMustCompose = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const filename = context.filename
    const isMolecule = /\/molecules\/(?!index\.)[^/]+\.tsx?$/.test(filename)

    if (!isMolecule) return {}
    if (isReexportOnly(filename)) return {}

    const bioImportLocals = new Set<string>()
    const renderedTagNames = new Set<string>()
    let programNode: unknown = null

    return {
      ImportDeclaration(node: ImportNode) {
        if (node.importKind === 'type') return
        const source = node.source.value
        if (!isCompositionSource(source)) return
        for (const spec of node.specifiers ?? []) {
          const localName = spec.local?.name
          if (localName) bioImportLocals.add(localName)
        }
      },
      JSXOpeningElement(node: JsxOpeningElement) {
        const name = node.name
        if (!name) return
        if (name.type === 'JSXIdentifier') {
          const id = name as JsxIdentifier
          if (id.name) renderedTagNames.add(id.name)
        } else if (name.type === 'JSXMemberExpression') {
          const member = name as JsxMemberExpression
          const root = member.object?.name
          if (root) renderedTagNames.add(root)
        }
      },
      'Program:exit'(node: unknown) {
        programNode = node
        const composesByRender = [...bioImportLocals].some((localName) =>
          renderedTagNames.has(localName),
        )

        if (!composesByRender) {
          const shortName = filename.split('/').pop() || filename
          context.report({
            data: { filename: shortName },
            messageId: 'missingComposition',
            node: programNode as unknown,
          })
        }
      },
    }
  },
  meta: {
    docs: {
      description:
        'Molecules MUST RENDER at least one atom or another molecule (or Radix primitive). A molecule is BY DEFINITION a combination — importing an atom without rendering it is FAKE composition (lint-theater). This rule checks the JSX render tree, not just the import list.',
    },
    messages: {
      missingComposition:
        'Molecule "{{filename}}" does not RENDER any atom, molecule, or Radix primitive. Molecules are BY DEFINITION combinations — they must actually render at least one ../atoms/, ../molecules/, or @radix-ui/ element. Importing without rendering is FAKE composition. Fix: actually render the imported atom in JSX, OR demote this file to an atom if it only renders a single native HTML element, OR delete it.',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default moleculeMustCompose
