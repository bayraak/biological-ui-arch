interface JSXOpeningElement {
  name: { name?: string; type: string }
  type: 'JSXOpeningElement'
}

interface Restriction {
  atom: string
  element: string
  importPath: string
}

const noRawHtmlAtoms = {
  create(context: {
    filename: string
    options: [Restriction[]]
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const restrictions = context.options[0]
    if (!restrictions || restrictions.length === 0) return {}

    const elementMap = new Map<string, Restriction>()
    for (const r of restrictions) {
      elementMap.set(r.element, r)
    }

    return {
      JSXOpeningElement(node: JSXOpeningElement) {
        if (node?.name?.type !== 'JSXIdentifier') return
        const elementName = node.name.name
        if (!elementName) return
        const restriction = elementMap.get(elementName)
        if (!restriction) return
        context.report({
          data: {
            atom: restriction.atom,
            element: restriction.element,
            importPath: restriction.importPath,
          },
          messageId: 'forbidden',
          node: node as unknown,
        })
      },
    }
  },
  meta: {
    docs: {
      description:
        'Forbid raw native HTML elements when an atom wrapper exists. Use the wrapping atom from your UI kit instead.',
    },
    messages: {
      forbidden:
        'Use <{{atom}}> from "{{importPath}}" instead of raw <{{element}}>. Native HTML elements that have an atom wrapper must not be used directly in molecules/compounds/cells/tissues - use the atom to preserve consistent styling and behavior.',
    },
    schema: [
      {
        items: {
          properties: {
            atom: { type: 'string' as const },
            element: { type: 'string' as const },
            importPath: { type: 'string' as const },
          },
          required: ['element', 'atom', 'importPath'],
          type: 'object' as const,
        },
        type: 'array' as const,
      },
    ],
    type: 'problem' as const,
  },
}

export default noRawHtmlAtoms
