const COMPONENT_FILE_PATTERN =
  /(?:features\/[^/]+\/)?(compounds|organelles|cells|tissues|organs)\/.+\.tsx$/

const noTypeDefinitionsInComponents = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const normalized = context.filename.replaceAll(/\\/g, '/')
    if (!COMPONENT_FILE_PATTERN.test(normalized)) return {}

    const feature = normalized.match(/features\/([^/]+)\//)?.[1] || ''

    return {
      TSInterfaceDeclaration(node: { id?: { name: string } | null; loc?: unknown }) {
        const name = node.id?.name || 'unknown'
        context.report({
          data: { feature, name },
          messageId: 'interfaceInComponent',
          node: node as unknown,
        })
      },

      TSTypeAliasDeclaration(node: { id?: { name: string } | null; loc?: unknown }) {
        const name = node.id?.name || 'unknown'
        context.report({
          data: { feature, name },
          messageId: 'typeInComponent',
          node: node as unknown,
        })
      },
    }
  },
  meta: {
    docs: {
      description:
        'Component .tsx files must not contain interface or type declarations. Props must be typed inline in the function signature. Shared types go in features/*/lib/types.ts.',
    },
    messages: {
      interfaceInComponent:
        'Interface "{{name}}" defined in a component file. Inline the props in the function signature: ({ prop }: { prop: Type }) or move shared types to features/{{feature}}/lib/types.ts',
      typeInComponent:
        'Type alias "{{name}}" defined in a component file. Inline the type or move to features/{{feature}}/lib/types.ts',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default noTypeDefinitionsInComponents
