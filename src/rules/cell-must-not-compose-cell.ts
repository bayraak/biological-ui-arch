import * as path from 'node:path'

// A cell is one logical COMPONENT, often split across private sibling files:
// product-card.tsx + product-card.parts.tsx + product-card.sections.tsx +
// product-card.types.ts. Reduce a path to that component's STEM so a cell
// importing its OWN sibling is recognised as one component, not a breach.
function cellStem(filePath: string): string {
  const base = filePath.split('/').pop() || filePath
  return base
    .replace(/\.[jt]sx?$/, '')
    .replace(
      /\.(parts|sections|summary|layouts|icons|types|hooks|utils|context|store|sidebar|data|config)$/i,
      '',
    )
}

const cellMustNotComposeCell = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const filename = context.filename
    const normalized = filename.replaceAll(/\\/g, '/')
    if (!/(?:^|\/)cells\//.test(normalized)) return {}

    const currentFile = normalized.split('/').pop() || normalized
    const currentDir = path.posix.dirname(normalized)
    const importerStem = cellStem(normalized)

    function report(importedPath: string, node: unknown) {
      // Same component split across private siblings is NOT a breach — only a
      // value import of a DIFFERENT cell's component is.
      if (cellStem(importedPath) === importerStem) return
      context.report({
        data: { currentFile, importedFile: importedPath.split('/').pop() || importedPath },
        messageId: 'forbidden',
        node,
      })
    }

    return {
      ImportDeclaration(node: { importKind?: string; loc: unknown; source: { value: string } }) {
        if (node.importKind === 'type') return

        const source = node.source.value

        if (/(?:^|\/)cells\//.test(source)) {
          report(source, node as unknown)
          return
        }

        if (source.startsWith('./') || source.startsWith('../')) {
          const resolved = path.posix.normalize(path.posix.join(currentDir, source))
          if (/(?:^|\/)cells\//.test(resolved)) {
            report(resolved, node as unknown)
          }
        }
      },
    }
  },
  meta: {
    docs: {
      description:
        'Cells must not import from any other cell anywhere in the repo. No same-feature exception, no shared/document/charts exception. Cells compose only atoms, molecules, compounds, and organelles. Type-only imports are allowed.',
    },
    messages: {
      forbidden:
        'Cell "{{currentFile}}" imports from another cell "{{importedFile}}". Cells never compose other cells. Decompose: if this is arrangement, move the parent to tissues/. If the import is a stateless display, move the child to compounds/. If the child is a store adapter, move it to organelles/.',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default cellMustNotComposeCell
