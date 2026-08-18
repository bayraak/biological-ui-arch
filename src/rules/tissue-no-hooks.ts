const forbiddenHooks = new Set([
  'useCallback',
  'useEffect',
  'useImperativeHandle',
  'useLayoutEffect',
  'useMemo',
  'useReducer',
  'useRef',
  'useState',
])

interface ImportNode {
  importKind?: string
  loc?: unknown
  source: { value: string }
  specifiers?: ImportSpecifier[]
}

interface ImportSpecifier {
  imported?: { name: string; type: string }
  local?: { name: string; type: string }
  type: string
}

const TISSUE_FILE_PATTERN = /(?:features\/[^/]+\/)?tissues\//

const tissueNoHooks = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const filename = context.filename
    const normalized = filename.replaceAll(/\\/g, '/')
    const isTissue = TISSUE_FILE_PATTERN.test(normalized)
    const shortName = normalized.split('/').pop() || normalized

    // Only police the PUBLIC tissue entrypoint `<name>.tsx`. Private siblings
    // (.parts/.sections/.layouts/.icons/.types), barrels (index.*), and non-tsx
    // files are not the tissue itself — they may legitimately hold component-
    // local UI state. State at the tissue ARRANGEMENT level is what's forbidden.
    const isEntrypoint =
      isTissue &&
      /\.tsx$/.test(shortName) &&
      shortName !== 'index.tsx' &&
      !/\.(parts|sections|summary|layouts|icons|types|hooks|utils|context|store|sidebar|data|config|stories|spec|test)\.tsx$/.test(
        shortName,
      )
    if (!isEntrypoint) return {}

    return {
      ImportDeclaration(node: ImportNode) {
        if (node.importKind === 'type') return
        if (node.source.value !== 'react') return

        const specifiers = node.specifiers ?? []
        for (const spec of specifiers) {
          if (spec.type !== 'ImportSpecifier') continue
          const importedName = spec.imported?.name
          if (!importedName) continue
          if (forbiddenHooks.has(importedName)) {
            context.report({
              data: { file: shortName, hook: importedName },
              messageId: 'forbidden',
              node: node as unknown,
            })
          }
        }
      },
    }
  },
  meta: {
    docs: {
      description:
        'Tissues are pure arrangements of cells and cannot hold state. Tissues cannot import stateful React hooks. State lives only at the organelle and cell levels. If you need hooks in a tissue, the file is actually a cell - promote it or push the logic into a constituent cell.',
    },
    messages: {
      forbidden:
        'Tissue "{{file}}" imports "{{hook}}" from react. Tissues are pure arrangements of cells and cannot hold state. State lives only at organelle/cell levels. Either push this logic into a cell, or if this file is truly doing cell work, move it to the cells/ tier.',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default tissueNoHooks
