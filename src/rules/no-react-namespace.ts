const noReactNamespace = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    return {
      MemberExpression(node: {
        loc?: unknown
        object: { name?: string; type: string }
        property: { name?: string; type: string }
      }) {
        if (node.object.type !== 'Identifier' || node.object.name !== 'React') return
        if (node.property.type !== 'Identifier' || !node.property.name) return

        context.report({
          data: { member: node.property.name },
          messageId: 'noReactNamespace',
          node: node as unknown,
        })
      },

      TSQualifiedName(node: {
        left: { name?: string; type: string }
        loc?: unknown
        right: { name?: string; type: string }
      }) {
        if (node.left.type !== 'Identifier' || node.left.name !== 'React') return
        if (!node.right.name) return

        context.report({
          data: { member: node.right.name },
          messageId: 'noReactNamespace',
          node: node as unknown,
        })
      },
    }
  },
  meta: {
    docs: {
      description:
        'Forbid React.* namespace access (React.ReactNode, React.MouseEvent, etc.). Use explicit named imports instead: import type { ReactNode, MouseEvent } from "react". This keeps imports explicit and tree-shakeable.',
    },
    messages: {
      noReactNamespace:
        'Use "import type { {{member}} } from \'react\'" instead of "React.{{member}}". Explicit named imports are clearer and tree-shakeable.',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default noReactNamespace
