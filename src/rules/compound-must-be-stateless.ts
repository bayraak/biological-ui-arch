const reactForbiddenHooks = new Set([
  'useCallback',
  'useEffect',
  'useImperativeHandle',
  'useLayoutEffect',
  'useMemo',
  'useReducer',
  'useRef',
  'useState',
])

interface ImportNode {
  importKind?: string
  loc?: unknown
  source: { value: string }
  specifiers?: ImportSpecifier[]
}

interface ImportSpecifier {
  imported?: { name: string; type: string }
  local?: { name: string; type: string }
  type: string
}

const COMPOUND_FILE_PATTERN = /(?:(?:features\/[^/]+\/)?compounds\/|packages\/ui\/src\/compounds\/)/

const compoundMustBeStateless = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const filename = context.filename
    const normalized = filename.replaceAll(/\\/g, '/')
    const isCompound = COMPOUND_FILE_PATTERN.test(normalized)

    if (!isCompound) return {}

    const shortName = normalized.split('/').pop() || normalized

    return {
      CallExpression(node: { callee: { name?: string; type: string }; loc?: unknown }) {
        if (node.callee.type !== 'Identifier') return
        const name = node.callee.name
        if (!name || !/^use[A-Z]/.test(name)) return
        context.report({
          data: { file: shortName, hook: name },
          messageId: 'forbiddenHookCall',
          node: node as unknown,
        })
      },

      ImportDeclaration(node: ImportNode) {
        if (node.importKind === 'type') return

        const source = node.source.value

        if (source === 'react') {
          const specifiers = node.specifiers ?? []
          for (const spec of specifiers) {
            if (spec.type !== 'ImportSpecifier') continue
            const importedName = spec.imported?.name
            if (!importedName) continue
            if (reactForbiddenHooks.has(importedName)) {
              context.report({
                data: { file: shortName, hook: importedName },
                messageId: 'forbiddenReactHook',
                node: node as unknown,
              })
            }
          }
          return
        }

        if (source.includes('/providers/') || source.startsWith('@/providers/')) {
          context.report({
            data: { file: shortName, source },
            messageId: 'forbiddenContextImport',
            node: node as unknown,
          })
        }
      },
    }
  },
  meta: {
    docs: {
      description:
        'Compounds are pure stateless props-in/JSX-out components. They cannot: (1) import React hooks from react, (2) call ANY hook (use* functions), (3) import from providers/ or contexts/. If you need state, this is a cell or organelle.',
    },
    messages: {
      forbiddenContextImport:
        'Compound "{{file}}" imports from "{{source}}". Compounds must not use context/providers — receive data via props instead.',
      forbiddenHookCall:
        'Compound "{{file}}" calls hook "{{hook}}". Compounds are stateless — no hooks allowed. Move to cells/ or organelles/.',
      forbiddenReactHook:
        'Compound "{{file}}" imports "{{hook}}" from react. Compounds are stateless — move to cells/ or organelles/.',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default compoundMustBeStateless
