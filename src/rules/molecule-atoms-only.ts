// Molecules are inert combinations of ATOMS. They must not import anything above
// them (compounds, organelles, cells, tissues) NOR the raw state-bearing
// components/ui primitives (Calendar, Popover, Carousel, …) — composing those
// makes the file stateful, which is a cell, not a molecule.
const forbiddenPatterns = [
  /components\/ui\//,
  /compounds\//,
  /organelles\//,
  /cells\//,
  /tissues\//,
  /stores\//,
  /domains/,
  /\/app\//,
]

const moleculeAtomsOnly = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const filename = context.filename
    const isMolecule = /\/molecules\//.test(filename)

    if (!isMolecule) return {}

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
        'Molecules are inert combinations of atoms. They must not import compounds, organelles, cells, tissues, stores, domains, or the raw state-bearing components/ui primitives — composing a stateful primitive makes the file a cell.',
    },
    messages: {
      forbidden:
        'Molecules cannot import from {{source}}. Molecules are inert atom-combinations — state-bearing primitives (components/ui) and higher tiers belong in a cell.',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default moleculeAtomsOnly
