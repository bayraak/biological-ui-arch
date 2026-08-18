// Compounds may only import atoms, molecules, and other compounds.
// Anything higher (organelles, cells, tissues) or state (stores) is a
// Direction violation — compounds are at level 3, everything above is >3.
const forbiddenPatterns = [
  /stores\//,
  /organelles\//,
  /cells\//,
  /tissues\//,
  /layouts\//,
  /\/app\//,
]

const compoundNoStores = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const filename = context.filename
    // Exclude test files — __tests__/unit/feature/compounds/ matches but is not
    // A bio folder. Tests may legitimately import organelles/cells to exercise
    // Them.
    if (/__tests__\//.test(filename)) return {}
    const isCompound = /\/compounds\//.test(filename)

    if (!isCompound) return {}

    return {
      ImportDeclaration(node: { importKind?: string; loc: unknown; source: { value: string } }) {
        if (node.importKind === 'type') return

        const source = node.source.value
        for (const pattern of forbiddenPatterns) {
          if (pattern.test(source)) {
            context.report({
              data: { source },
              messageId: 'forbidden',
              node: node as unknown,
            })
            break
          }
        }
      },
    }
  },
  meta: {
    docs: {
      description:
        'Compounds may only import atoms, molecules, and other compounds. They cannot import organelles, cells, tissues, stores, or app routes — direction rule: a parent may only compose children at levels <= its own.',
    },
    messages: {
      forbidden:
        'Compounds cannot import from {{source}}. Direction violation — compounds are level 3 and can only depend on atoms, molecules, other compounds, and shared libs/domains/types.',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default compoundNoStores
