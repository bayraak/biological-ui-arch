// Forbid components whose body calls side-effect-ish hooks but whose every
// return path is identity — null, bare `children`, `<></>`, or
// `<>{children}</>`. Such a component renders no real UI; it is a hook
// masquerading as a component. The correct shape is a .ts hook in
// organelles/ with `-effect` suffix, called by a real component that
// actually renders.
//
// A call is "side-effect-ish" if its callee name is:
//   - a React effect hook: useEffect / useLayoutEffect / useInsertionEffect
//   - useRef (ref-holding is pointless in an identity-return component)
//   - any custom effect hook: matches /^use[A-Z].*Effect$/
//     (the effect-hook-naming rule already requires this suffix)
//   - any store hook: matches /^use[A-Z].*Store$/
//     (subscribing to a store in an identity-return component is a disguise)
//
// Read-only helpers (useMemo, useCallback, usePathname, useRouter, useForm,
// useFormContext, useShallow, useId, useTransition, useDeferredValue) are
// NOT tracked — a component that only reads these and returns null is a
// separate concern for a future rule.
//
// Exempt:
//   - __tests__/** files
//   - Next.js route fallback files (default/not-found/loading/error/global-error)
//   - Files importing from @react-three/fiber or @react-three/drei
//     (r3f scene components legitimately return null + use useFrame)

const EXPLICIT_SIDE_EFFECT_HOOKS = new Set([
  'useEffect',
  'useInsertionEffect',
  'useLayoutEffect',
  'useRef',
])

const CUSTOM_EFFECT_HOOK_PATTERN = /^use[A-Z][A-Za-z0-9]*Effect$/
const STORE_HOOK_PATTERN = /^use[A-Z][A-Za-z0-9]*Store$/

function isSideEffectHook(name: string): boolean {
  if (EXPLICIT_SIDE_EFFECT_HOOKS.has(name)) return true
  if (CUSTOM_EFFECT_HOOK_PATTERN.test(name)) return true
  if (STORE_HOOK_PATTERN.test(name)) return true
  return false
}

const ROUTE_FALLBACK_BASENAMES = new Set([
  'default.tsx',
  'error.tsx',
  'global-error.tsx',
  'loading.tsx',
  'not-found.tsx',
])

const R3F_PACKAGES = new Set(['@react-three/drei', '@react-three/fiber'])

interface JsxChild {
  expression?: { name?: string; type: string }
  name?: string
  type: string
  value?: string
}

interface ReturnArg {
  children?: JsxChild[]
  name?: string
  type: string
  value?: unknown
}

interface ReturnStatementNode {
  argument?: null | ReturnArg
  loc?: unknown
  type: 'ReturnStatement'
}

interface CallExpressionNode {
  callee: { name?: string; type: string }
  type: 'CallExpression'
}

interface FunctionLikeNode {
  body?: { type: string }
  id?: { name?: string } | null
  loc?: unknown
  type: string
}

interface VariableDeclaratorNode {
  id?: { name?: string; type: string }
  init?: { type: string } | null
  type: 'VariableDeclarator'
}

interface ImportNode {
  importKind?: string
  loc?: unknown
  source: { value: string }
  type: string
}

interface ScopeRecord {
  calledHooks: Set<string>
  hasIdentityReturn: boolean
  hasNonIdentityReturn: boolean
  name: string
  node: unknown
}

function isPascalCase(name: string): boolean {
  return /^[A-Z]/.test(name)
}

function isNullLiteral(n?: null | ReturnArg): boolean {
  if (!n) return true
  return n.type === 'Literal' && n.value === null
}

function isChildrenIdentifier(n?: null | ReturnArg): boolean {
  return Boolean(n && n.type === 'Identifier' && n.name === 'children')
}

function isIdentityFragment(n?: null | ReturnArg): boolean {
  if (!n) return false
  if (n.type !== 'JSXFragment') return false
  const children = n.children ?? []
  const meaningful = children.filter((c) => {
    if (c.type === 'JSXText') {
      const text = c.value ?? c.name ?? ''
      return text.trim().length > 0
    }
    return true
  })
  if (meaningful.length === 0) return true
  if (meaningful.length === 1) {
    const c = meaningful[0]
    if (
      c.type === 'JSXExpressionContainer' &&
      c.expression?.type === 'Identifier' &&
      c.expression.name === 'children'
    ) {
      return true
    }
  }
  return false
}

function classifyReturnShape(arg?: null | ReturnArg): 'identity' | 'real' {
  if (isNullLiteral(arg)) return 'identity'
  if (isChildrenIdentifier(arg)) return 'identity'
  if (isIdentityFragment(arg)) return 'identity'
  return 'real'
}

function suggestedHookName(componentName: string): string {
  const trimmed = componentName.replace(/(Provider|Sync|Listener|Hydration)$/, '')
  const kebab = trimmed.replaceAll(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
  return kebab || 'effect'
}

const noHookInComponentDisguise = {
  create(context: {
    filename: string
    report: (d: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const normalized = context.filename.replaceAll(/\\/g, '/')
    if (/__tests__\//.test(normalized)) return {}
    if (!normalized.endsWith('.tsx')) return {}
    const basename = normalized.split('/').pop() ?? ''
    if (ROUTE_FALLBACK_BASENAMES.has(basename)) return {}

    let fileUsesR3F = false
    const scopeStack: ScopeRecord[] = []
    let pendingName: null | string = null

    function currentScope(): null | ScopeRecord {
      return scopeStack.at(-1) ?? null
    }

    function enterFunction(name: string, node: unknown): void {
      scopeStack.push({
        calledHooks: new Set<string>(),
        hasIdentityReturn: false,
        hasNonIdentityReturn: false,
        name,
        node,
      })
    }

    function exitFunction(): void {
      const scope = scopeStack.pop()
      if (!scope) return
      if (fileUsesR3F) return
      if (!isPascalCase(scope.name)) return
      if (scope.hasNonIdentityReturn) return
      if (!scope.hasIdentityReturn) return

      // Routing-marker exemption: Next.js requires page.tsx to exist for a
      // Route to resolve. A page.tsx that does NO work (no hooks) and
      // Returns identity is legitimate — the real UI lives in the sibling
      // Layout.tsx. This exemption applies ONLY to page.tsx, NOT layout/
      // Template.tsx (which have no "must exist for route" excuse).
      if (basename === 'page.tsx' && scope.calledHooks.size === 0) return

      const hasHooks = scope.calledHooks.size > 0
      context.report({
        data: {
          hooks: hasHooks
            ? [...scope.calledHooks].toSorted((a, b) => a.localeCompare(b)).join(', ')
            : '',
          name: scope.name,
          suggested: suggestedHookName(scope.name),
        },
        messageId: hasHooks ? 'hookInDisguise' : 'passthroughComponent',
        node: scope.node,
      })
    }

    return {
      ArrowFunctionExpression(node: FunctionLikeNode) {
        const name = pendingName ?? '<anonymous>'
        pendingName = null
        enterFunction(name, node)

        if (node.body && node.body.type !== 'BlockStatement') {
          const shape = classifyReturnShape(node.body as ReturnArg)
          const scope = currentScope()
          if (scope) {
            if (shape === 'identity') scope.hasIdentityReturn = true
            else scope.hasNonIdentityReturn = true
          }
        }
      },

      'ArrowFunctionExpression:exit'() {
        exitFunction()
      },

      CallExpression(node: CallExpressionNode) {
        if (node.callee.type !== 'Identifier') return
        const scope = currentScope()
        if (!scope) return
        const name = node.callee.name
        if (!name) return
        if (isSideEffectHook(name)) {
          scope.calledHooks.add(name)
        }
      },

      FunctionDeclaration(node: FunctionLikeNode) {
        const name = node.id?.name ?? pendingName ?? '<anonymous>'
        pendingName = null
        enterFunction(name, node)
      },

      'FunctionDeclaration:exit'() {
        exitFunction()
      },

      FunctionExpression(node: FunctionLikeNode) {
        const name = node.id?.name ?? pendingName ?? '<anonymous>'
        pendingName = null
        enterFunction(name, node)
      },

      'FunctionExpression:exit'() {
        exitFunction()
      },

      ImportDeclaration(node: ImportNode) {
        if (R3F_PACKAGES.has(node.source.value)) {
          fileUsesR3F = true
        }
      },

      ReturnStatement(node: ReturnStatementNode) {
        const scope = currentScope()
        if (!scope) return
        const shape = classifyReturnShape(node.argument)
        if (shape === 'identity') scope.hasIdentityReturn = true
        else scope.hasNonIdentityReturn = true
      },

      VariableDeclarator(node: VariableDeclaratorNode) {
        if (
          node.id?.type === 'Identifier' &&
          node.init &&
          (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression')
        ) {
          pendingName = node.id.name ?? null
        }
      },
    }
  },

  meta: {
    docs: {
      description:
        "Forbid components whose body calls side-effect hooks (useEffect/useLayoutEffect/useInsertionEffect/useRef) but whose every return is identity (null, bare `children`, `<></>`, `<>{children}</>`). Such a component renders no real UI — it's a hook masquerading as a component. Move to organelles/use-*-effect.ts and call the hook from a real component. Exempt: route fallback files (default/not-found/loading/error/global-error.tsx) and files importing from @react-three/fiber or @react-three/drei.",
    },
    messages: {
      hookInDisguise:
        "Component '{{name}}' has side-effect hooks ({{hooks}}) but renders only identity/null. It's a hook in disguise — move to organelles/use-{{suggested}}-effect.ts and call the hook from a real component.",
      passthroughComponent:
        "Component '{{name}}' renders only identity/null with no effects. It serves no architectural purpose. If this is a metadata-only layout, move `metadata`/`generateMetadata` to the sibling page.tsx and delete this file. If it's structural, give it real content.",
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default noHookInComponentDisguise
