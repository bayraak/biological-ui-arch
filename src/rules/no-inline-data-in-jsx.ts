const COMPONENT_FILE_PATTERN =
  /(?:features\/[^/]+\/)?(compounds|organelles|cells|tissues|organs)\/.+\.tsx$/

const MIN_OBJECTS = 3

function countObjects(elements: { type: string }[] | undefined): number {
  if (!elements) return 0
  return elements.filter((el) => el.type === 'ObjectExpression').length
}

const noInlineDataInJsx = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const normalized = context.filename.replaceAll(/\\/g, '/')
    if (!COMPONENT_FILE_PATTERN.test(normalized)) return {}

    const feature = normalized.match(/features\/([^/]+)\//)?.[1] || ''

    return {
      // Catch: options={[{ ... }, { ... }, { ... }]}
      JSXAttribute(node: {
        loc?: unknown
        name?: { name?: string }
        parent?: { name?: { name?: string; type: string } }
        value?: {
          expression?: {
            elements?: { type: string }[]
            type: string
          }
          type: string
        }
      }) {
        if (!node.value || node.value.type !== 'JSXExpressionContainer') return
        const expr = node.value.expression
        if (!expr || expr.type !== 'ArrayExpression') return

        const objectCount = countObjects(expr.elements)
        if (objectCount < MIN_OBJECTS) return

        const propName = node.name?.name || 'unknown'
        const componentName =
          node.parent?.name?.type === 'JSXIdentifier'
            ? node.parent.name.name || 'unknown'
            : 'unknown'

        context.report({
          data: {
            component: componentName,
            count: String(objectCount),
            feature,
            prop: propName,
          },
          messageId: 'inlineDataArray',
          node: node as unknown,
        })
      },

      // Catch: {[{ ... }, { ... }, { ... }].map(...)} inside JSX
      JSXExpressionContainer(node: {
        expression?: {
          // CallExpression: [].map()
          callee?: {
            object?: {
              elements?: { type: string }[]
              // Present on TSAsExpression ([...] as const) — the unwrapped array.
              expression?: { elements?: { type: string }[]; type: string }
              type: string
            }
            property?: { name?: string }
            type: string
          }
          type: string
          // TSAsExpression wrapping: ([...] as const).map()
          // or just the array expression for parenthesized: ([...]).map()
        }
        loc?: unknown
        parent?: { type: string }
      }) {
        if (!node.expression || node.expression.type !== 'CallExpression') return
        const callee = node.expression.callee
        if (!callee || callee.type !== 'MemberExpression') return
        if (callee.property?.name !== 'map') return

        let arrayNode = callee.object
        // Unwrap TSAsExpression: ([...] as const).map()
        if (arrayNode && arrayNode.type === 'TSAsExpression') {
          arrayNode = arrayNode.expression
        }
        // Unwrap parenthesized: ([ ... ]).map()
        if (arrayNode && arrayNode.type === 'SequenceExpression') {
          return
        }

        if (!arrayNode || arrayNode.type !== 'ArrayExpression') return

        const objectCount = countObjects(arrayNode.elements)
        if (objectCount < MIN_OBJECTS) return

        context.report({
          data: {
            count: String(objectCount),
            feature,
          },
          messageId: 'inlineDataInJsx',
          node: node as unknown,
        })
      },
    }
  },
  meta: {
    docs: {
      description:
        'Forbid inline data arrays (3+ object literals) in JSX. Catches both prop values ({options={[...]}}) and inline expression containers ({[...].map()}). Configuration data must live in lib/, not inline in component JSX.',
    },
    messages: {
      inlineDataArray:
        'Inline array with {{count}} objects passed to prop "{{prop}}" on <{{component}}>. Extract this data to features/{{feature}}/lib/.',
      inlineDataInJsx:
        'Inline array with {{count}} objects in JSX expression. Extract this data to features/{{feature}}/lib/ — component files are for rendering, not data definitions.',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default noInlineDataInJsx
