import * as fs from 'node:fs'

// A CELL is the living unit that OWNS state — it holds a hook, composes a
// state-bearing organelle, or reads a store. A component whose ENTIRE family
// (main + .parts/.sections/.layouts/... siblings) is stateless props-in/JSX-out
// is "inert chemistry" and belongs in compounds/, not cells/. This rule is the
// inverse of compound-must-be-stateless: it keeps stateless displays from
// accumulating in the cell tier. State signals: any use* hook call, an organelle
// import (organelles are where state lives), a store import, or createContext.
// Organelle/store imports are matched at ANY depth and via `#` self-subpaths, so
// the signal survives the feature-driven layout (e.g. `../../../organelles/sheet`
// or `#ui/sheet/organelles`, `#ui/cart/store`) — not just the flat-tier
// `../organelles/` / `../stores` shapes.
const STATE_SIGNATURE =
  /\buse[A-Z]\w*\s*\(|from\s+['"][^'"]*\/organelles(?:\/|['"])|from\s+['"][^'"]*\/stores?(?:\/|['"])|createContext\s*\(/

// Private sibling modules that make up ONE component (state may live in any).
const SIBLING_SUFFIXES = [
  '.tsx',
  '.parts.tsx',
  '.sections.tsx',
  '.layouts.tsx',
  '.icons.tsx',
  '.sidebar.tsx',
  '.summary.tsx',
  '.form.tsx',
  '.data.tsx',
  '.steps.tsx',
]

const PRIVATE_OR_NON_ENTRY =
  /\.(parts|sections|layouts|types|icons|sidebar|summary|form|data|steps|stories|test|spec)\.tsx$/

// A pure re-export shim/barrel (only `export … from`, no component) is not a
// cell — e.g. a compatibility shim left behind when a component moves to a
// feature folder. Skip it so it isn't mistaken for a stateless display.
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

function familyHasState(mainFile: string): boolean {
  const stem = mainFile.replace(/\.tsx$/, '')
  for (const suffix of SIBLING_SUFFIXES) {
    const file = stem + suffix
    try {
      if (fs.existsSync(file) && STATE_SIGNATURE.test(fs.readFileSync(file, 'utf8'))) {
        return true
      }
    } catch {
      // unreadable sibling — ignore
    }
  }
  return false
}

const cellMustBeStateful = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const normalized = context.filename.replaceAll(/\\/g, '/')
    const base = normalized.split('/').pop() || ''
    const isCellEntrypoint =
      /(?:^|\/)cells\//.test(normalized) &&
      base.endsWith('.tsx') &&
      base !== 'index.tsx' &&
      !PRIVATE_OR_NON_ENTRY.test(base)
    if (!isCellEntrypoint) return {}
    if (isReexportOnly(context.filename)) return {}

    let programNode: unknown = null
    return {
      Program(node: unknown) {
        programNode = node
      },
      'Program:exit'() {
        if (!familyHasState(normalized)) {
          context.report({
            data: { file: base },
            messageId: 'shouldBeCompound',
            node: programNode as unknown,
          })
        }
      },
    }
  },
  meta: {
    docs: {
      description:
        'A cell must own state (a hook, a state-bearing organelle, or a store) somewhere in its family. A cell whose whole family is stateless props-in/JSX-out is a compound — move it to compounds/.',
    },
    messages: {
      shouldBeCompound:
        'Cell "{{file}}" holds no state (no hooks, no organelle, no store) anywhere in its family — it is a stateless display and belongs in compounds/, not cells/.',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default cellMustBeStateful
