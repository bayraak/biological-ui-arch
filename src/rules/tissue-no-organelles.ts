const TISSUE_FILE_PATTERN = /(?:features\/[^/]+\/)?tissues\//

const tissueNoOrganelles = {
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
        if (/\/organelles\//.test(source)) {
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
        'Tissues cannot directly import organelles. In biology, tissues arrange cells; organelles live INSIDE cells. To reach an organelle from a tissue, go through a cell. This forces tissues to stay at the cell-arrangement level and keeps state encapsulated in the cells that own their organelles.',
    },
    messages: {
      forbidden:
        'Tissue "{{file}}" cannot import organelle "{{source}}". Tissues arrange cells; organelles live inside cells. Host this organelle inside a cell, then compose the cell from this tissue.',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default tissueNoOrganelles
