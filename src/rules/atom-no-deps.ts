// Atoms are the lowest level — they cannot import from anything above.
const forbiddenPatterns = [
  /molecules\//,
  /compounds\//,
  /organelles\//,
  /cells\//,
  /tissues\//,
  /stores\//,
  /domains/,
  /\/app\//,
]

const atomNoDeps = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const filename = context.filename
    const isAtom = /\/atoms\//.test(filename)

    if (!isAtom) return {}

    return {
      ImportDeclaration(node: { loc: unknown; source: { value: string } }) {
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
        'Atoms cannot import from molecules, compounds, organelles, cells, stores, or domains',
    },
    messages: {
      forbidden:
        'Atoms cannot import from {{source}}. Atoms are the lowest level and must not depend on higher-level components.',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default atomNoDeps
