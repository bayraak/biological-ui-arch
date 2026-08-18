const COMPONENT_FILE_PATTERN =
  /(?:features\/[^/]+\/)?(compounds|organelles|cells|tissues|organs)\/.+\.tsx$/

const MIN_CLASS_LENGTH = 30
// A symmetric PAIR (two-column compare, title/body two-liner) is idiomatic, not
// a missed extraction. Require 3+ repeats before flagging.
const MIN_DUPLICATES = 3

// Array iteration methods whose callback authors ONE JSX literal that renders N
// times. Counting that single authored element as a duplicate is wrong.
const ITERATORS = new Set(['map', 'flatMap', 'forEach', 'filter', 'reduce'])

interface JSXNode {
  attributes: {
    name?: { name: string }
    type: string
    value?: { type: string; value?: string }
  }[]
  loc?: { start: { line: number } }
  name: { name?: string; type: string }
  parent?: AnyNode
}

interface AnyNode {
  callee?: { property?: { name?: string }; type?: string }
  parent?: AnyNode
  type: string
}

// True when this JSX is authored once inside an iterator callback or an array
// literal — i.e. it does not represent a hand-duplicated pattern.
function isInsideIteratedRender(node: JSXNode): boolean {
  let cur: AnyNode | undefined = node.parent
  while (cur) {
    if (cur.type === 'ArrayExpression') return true
    if (cur.type === 'ArrowFunctionExpression' || cur.type === 'FunctionExpression') {
      const call = cur.parent
      if (
        call &&
        call.type === 'CallExpression' &&
        call.callee?.type === 'MemberExpression' &&
        call.callee.property?.name &&
        ITERATORS.has(call.callee.property.name)
      ) {
        return true
      }
    }
    cur = cur.parent
  }
  return false
}

const noDuplicateJsxPatterns = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const normalized = context.filename.replaceAll(/\\/g, '/')
    if (!COMPONENT_FILE_PATTERN.test(normalized)) return {}

    const classNamesByComponent = new Map<string, { lines: Set<number>; nodes: unknown[] }>()
    const allClassNames = new Map<string, { lines: Set<number>; nodes: unknown[] }>()

    function record(map: Map<string, { lines: Set<number>; nodes: unknown[] }>, key: string, node: JSXNode) {
      const line = node.loc?.start.line ?? -1
      let entry = map.get(key)
      if (!entry) {
        entry = { lines: new Set(), nodes: [] }
        map.set(key, entry)
      }
      // Dedup by source line so one literal reachable via branch/loop is not
      // multi-counted.
      if (entry.lines.has(line)) return
      entry.lines.add(line)
      entry.nodes.push(node)
    }

    return {
      JSXOpeningElement(node: JSXNode) {
        if (node.name.type !== 'JSXIdentifier') return
        const componentName = node.name.name
        if (!componentName) return
        if (isInsideIteratedRender(node)) return

        const classNameAttr = node.attributes.find(
          (attr) =>
            attr.type === 'JSXAttribute' &&
            attr.name?.name === 'className' &&
            attr.value?.type === 'Literal' &&
            typeof attr.value.value === 'string',
        )
        if (!classNameAttr || !classNameAttr.value?.value) return
        const className = classNameAttr.value.value as string
        if (className.length < MIN_CLASS_LENGTH) return

        record(classNamesByComponent, `${componentName}::${className}`, node)
        record(allClassNames, className, node)
      },

      'Program:exit'() {
        const reportedClassNames = new Set<string>()

        for (const [key, entry] of classNamesByComponent) {
          if (entry.nodes.length < MIN_DUPLICATES) continue
          const [componentName, className] = key.split('::')
          reportedClassNames.add(className)
          context.report({
            data: { component: componentName, count: String(entry.nodes.length) },
            messageId: 'duplicateComponentPattern',
            node: entry.nodes[1] as unknown,
          })
        }

        for (const [className, entry] of allClassNames) {
          if (entry.nodes.length < MIN_DUPLICATES) continue
          if (reportedClassNames.has(className)) continue
          context.report({
            data: { count: String(entry.nodes.length), preview: className.slice(0, 50) },
            messageId: 'duplicateClassName',
            node: entry.nodes[1] as unknown,
          })
        }
      },
    }
  },
  meta: {
    docs: {
      description:
        'Detect a hand-duplicated JSX className pattern (same long className repeated 3+ times) that signals a missed compound extraction. Ignores JSX authored once inside an iterator callback (.map/.forEach/etc.) or array literal, and symmetric pairs.',
    },
    messages: {
      duplicateClassName:
        'className "{{preview}}..." appears {{count}} times. Extract the repeated pattern into a compound or add a variant to the atom.',
      duplicateComponentPattern:
        '<{{component}} className="..."> appears {{count}} times with the same className. Extract a reusable compound that encapsulates this styling.',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default noDuplicateJsxPatterns
