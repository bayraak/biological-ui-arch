const TISSUE_FILE_PATTERN = /(?:features\/[^/]+\/)?tissues\//

const tissueNoStores = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const filename = context.filename
    const normalized = filename.replaceAll(/\\/g, '/')
    const isTissue = TISSUE_FILE_PATTERN.test(normalized)

    if (!isTissue) return {}

    const shortName = normalized.split('/').pop() || normalized

    return {
      ImportDeclaration(node: { importKind?: string; loc: unknown; source: { value: string } }) {
        if (node.importKind === 'type') return

        const source = node.source.value
        if (/stores\//.test(source)) {
          context.report({
            data: { file: shortName, source },
            messageId: 'forbidden',
            node: node as unknown,
          })
        }
      },
    }
  },
  meta: {
    docs: {
      description:
        'Tissues cannot import from stores. Tissues arrange cells but must not directly access state. State lives at organelle and cell levels. (App route files are classified as organs - see organ-no-stores.)',
    },
    messages: {
      forbidden:
        'Tissue "{{file}}" cannot import from "{{source}}". Tissues arrange cells but must not directly access stores. Push the store read into a constituent cell.',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default tissueNoStores
