interface JSXAttribute {
  name?: { name?: string; type: string }
  type: string
  value?: { type: string }
}

interface JSXOpeningElement {
  attributes: JSXAttribute[]
  loc?: unknown
  name: { name?: string; type: string }
  type: 'JSXOpeningElement'
}

const noRenderPropReader = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    return {
      JSXOpeningElement(node: JSXOpeningElement) {
        if (node.name?.type !== 'JSXIdentifier') return
        const componentName = node.name.name
        if (!componentName) return

        const viewProp = node.attributes?.find(
          (a) =>
            a.type === 'JSXAttribute' &&
            a.name?.type === 'JSXIdentifier' &&
            a.name.name === 'View' &&
            a.value?.type === 'JSXExpressionContainer',
        )

        if (viewProp) {
          context.report({
            data: { component: componentName },
            messageId: 'renderPropReader',
            node: node as unknown,
          })
        }
      },

      // Catch definition side: function Foo({ View }: { View: React.ComponentType<...> })
      TSPropertySignature(node: {
        key?: { name?: string }
        loc?: unknown
        parent?: { parent?: { parent?: { id?: { name?: string } } } }
        typeAnnotation?: {
          typeAnnotation?: {
            typeName?: {
              left?: { name?: string }
              name?: string
              right?: { name?: string }
              type: string
            }
          }
        }
      }) {
        if (node.key?.name !== 'View') return
        const ta = node.typeAnnotation?.typeAnnotation
        if (!ta?.typeName) return
        const tn = ta.typeName
        const isComponentType =
          (tn.type === 'TSQualifiedName' &&
            tn.left?.name === 'React' &&
            tn.right?.name === 'ComponentType') ||
          (tn.type === 'Identifier' && tn.name === 'ComponentType')
        if (!isComponentType) return

        const filename = context.filename.replaceAll(/\\/g, '/')
        const componentName = filename.split('/').pop()?.replace('.tsx', '') || 'unknown'
        context.report({
          data: { component: componentName },
          messageId: 'renderPropDefinition',
          node: node as unknown,
        })
      },
    }
  },
  meta: {
    docs: {
      description:
        'Forbid the View={} render-prop reader pattern. Organelles should read from stores directly and render their own output — not act as thin bridges that pass data via render props.',
    },
    messages: {
      renderPropDefinition:
        '"{{component}}" accepts a View prop typed as React.ComponentType. This is the render-prop Reader anti-pattern. The organelle should read from the store directly and render its own JSX.',
      renderPropReader:
        '<{{component}}> uses a View={{}} render prop. This is the polymorphic render-prop bridge anti-pattern. The organelle should render its own JSX with store data, or the parent should read from the store directly via useShallow.',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default noRenderPropReader
