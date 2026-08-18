const HOOK_FILE_PATTERN = /(?:features\/[^/]+\/)?organelles\/.*\.ts$/

const effectHookNaming = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const normalized = context.filename.replaceAll(/\\/g, '/')
    if (!HOOK_FILE_PATTERN.test(normalized)) return {}

    const file = normalized.split('/').pop() || ''
    if (file.endsWith('-effect.ts')) return {}

    let usesEffect = false
    let effectHookName = ''
    let programNode: unknown = null

    const exportedFunctions: { name: string; node: unknown }[] = []

    return {
      CallExpression(node: { callee: { name?: string; type: string } }) {
        if (node.callee.type !== 'Identifier') return
        if (node.callee.name === 'useEffect' || node.callee.name === 'useLayoutEffect') {
          usesEffect = true
          effectHookName = node.callee.name
        }
      },

      'ExportNamedDeclaration > FunctionDeclaration'(node: {
        id?: { name: string } | null
        loc?: unknown
      }) {
        if (node.id?.name) {
          exportedFunctions.push({ name: node.id.name, node })
        }
      },

      Program(node: unknown) {
        programNode = node
      },

      'Program:exit'() {
        if (!usesEffect) return

        const baseName = file.replace(/\.ts$/, '')
        const suggestedFile = baseName + '-effect.ts'
        context.report({
          data: { file, hook: effectHookName, suggested: suggestedFile },
          messageId: 'filenameMissingEffect',
          node: programNode as unknown,
        })

        for (const fn of exportedFunctions) {
          if (!fn.name.endsWith('Effect')) {
            context.report({
              data: {
                hook: effectHookName,
                name: fn.name,
                suggested: fn.name + 'Effect',
              },
              messageId: 'functionMissingEffect',
              node: fn.node as unknown,
            })
          }
        }
      },
    }
  },
  meta: {
    docs: {
      description:
        'Hook files that use useEffect/useLayoutEffect must have "-effect" suffix in the filename and "Effect" suffix in the exported function name. This makes side-effectful hooks immediately identifiable.',
    },
    messages: {
      filenameMissingEffect:
        'File uses {{hook}} but filename "{{file}}" does not end with "-effect.ts". Rename to "{{suggested}}".',
      functionMissingEffect:
        'Function "{{name}}" uses {{hook}} but does not end with "Effect". Rename to "{{suggested}}".',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default effectHookNaming
