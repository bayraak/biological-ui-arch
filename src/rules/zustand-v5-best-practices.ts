const STORE_HOOK_PATTERN = /^use\w+Store$/

interface CallExpression {
  arguments: { callee?: { name?: string }; type: string }[]
  callee: { name?: string; type: string }
  loc?: { start: { line: number } }
  type: 'CallExpression'
}

/**
 * Zustand v5 best practices — single rule enforcing all patterns:
 *
 * 1. REQUIRE SELECTOR: useStore() without args subscribes to entire state.
 *    Fix: useStore((s) => s.field) or useStore(useShallow((s) => ({ ... })))
 *
 * 2. SINGLE CALL PER STORE: multiple useStore((s) => s.x) calls create
 *    separate subscriptions. Fix: consolidate with useShallow.
 *
 * 3. useShallow BYPASS: calls wrapped in useShallow are always allowed,
 *    even if there are multiple (edge case for different selector shapes).
 */
const zustandV5BestPractices = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const storeCallsByScope = new Map<unknown, Map<string, { count: number; nodes: unknown[] }>>()
    const functionStack: unknown[] = []

    function currentScope(): null | unknown {
      return functionStack.at(-1) ?? null
    }

    function enterFunction(node: unknown) {
      functionStack.push(node)
    }

    function exitFunction() {
      const scope = functionStack.pop()
      const storeCalls = storeCallsByScope.get(scope!)
      if (!storeCalls) return

      for (const [hookName, data] of storeCalls) {
        if (data.count > 1) {
          context.report({
            data: { count: String(data.count), hook: hookName },
            messageId: 'multipleSelectors',
            node: data.nodes[1] as unknown,
          })
        }
      }

      storeCallsByScope.delete(scope!)
    }

    return {
      ArrowFunctionExpression(node: unknown) {
        enterFunction(node)
      },
      'ArrowFunctionExpression:exit'() {
        exitFunction()
      },
      CallExpression(node: CallExpression) {
        if (node.callee.type !== 'Identifier') return
        const name = node.callee.name
        if (!name || !STORE_HOOK_PATTERN.test(name)) return

        // Check 1: no selector at all
        if (node.arguments.length === 0) {
          context.report({
            data: { hook: name },
            messageId: 'noSelector',
            node: node as unknown,
          })
          return
        }

        // useShallow wrapping = OK, skip tracking
        const firstArg = node.arguments[0]
        if (firstArg?.type === 'CallExpression' && firstArg.callee?.name === 'useShallow') return

        // Check 2: track individual selector calls per scope
        const scope = currentScope()
        if (!scope) return

        let scopeMap = storeCallsByScope.get(scope)
        if (!scopeMap) {
          scopeMap = new Map()
          storeCallsByScope.set(scope, scopeMap)
        }

        const existing = scopeMap.get(name) || { count: 0, nodes: [] }
        existing.nodes.push(node)
        existing.count++
        scopeMap.set(name, existing)
      },
      FunctionDeclaration(node: unknown) {
        enterFunction(node)
      },
      'FunctionDeclaration:exit'() {
        exitFunction()
      },
      FunctionExpression(node: unknown) {
        enterFunction(node)
      },

      'FunctionExpression:exit'() {
        exitFunction()
      },
    }
  },
  meta: {
    docs: {
      description:
        'Enforce Zustand v5 best practices. (1) Require selector on store hooks — useStore() without args subscribes to entire state. (2) One call per store per component — multiple individual selectors must be consolidated with useShallow.',
    },
    messages: {
      multipleSelectors:
        '"{{hook}}" called {{count}} times with individual selectors. Use one call with useShallow: const { ... } = {{hook}}(useShallow((s) => ({ ... })))',
      noSelector:
        '"{{hook}}()" called without a selector — subscribes to ENTIRE store, re-renders on ANY change. Use: {{hook}}((s) => s.field) or {{hook}}(useShallow((s) => ({ ... })))',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default zustandV5BestPractices
