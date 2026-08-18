const HIGHER_LEVEL_PATTERNS = [
  /(?:features\/[^/]+\/)?tissues\//,
  /(?:features\/[^/]+\/)?organs\//,
  /(?:^|\/)layouts\//,
  /apps\/web\/app\//,
]

const cellNoTissues = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const filename = context.filename
    const normalized = filename.replaceAll(/\\/g, '/')
    const isCell = /(?:features\/[^/]+\/)?cells\//.test(normalized)

    if (!isCell) return {}

    const shortName = normalized.split('/').pop() || normalized

    return {
      ImportDeclaration(node: { importKind?: string; loc: unknown; source: { value: string } }) {
        if (node.importKind === 'type') return

        const source = node.source.value
        for (const pattern of HIGHER_LEVEL_PATTERNS) {
          if (pattern.test(source)) {
            context.report({
              data: { file: shortName, source },
              messageId: 'forbidden',
              node: node as unknown,
            })
            return
          }
        }
      },
    }
  },
  meta: {
    docs: {
      description:
        'Cells cannot import tissues, organs, or app route files. Direction is wrong: tissues compose cells (not the reverse), and organs compose tissues and cells.',
    },
    messages: {
      forbidden:
        'Cell "{{file}}" cannot import higher-level component "{{source}}". Direction is wrong: tissues/organs compose cells, not the reverse. If this cell needs to render a layout-like wrapper, the wrapper should be a compound, or this cell should be promoted.',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default cellNoTissues
