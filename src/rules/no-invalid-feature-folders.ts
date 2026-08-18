const VALID_FOLDERS = new Set([
  'atoms',
  'cells',
  'compounds',
  'lib',
  'molecules',
  'organelles',
  'stores',
  'tissues',
])

const FEATURE_PATH_PATTERN = /features\/([^/]+)\/([^/]+)\//

const noInvalidFeatureFolders = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const normalized = context.filename.replaceAll(/\\/g, '/')
    const match = normalized.match(FEATURE_PATH_PATTERN)

    if (!match) return {}

    const feature = match[1]
    const folder = match[2]

    if (!VALID_FOLDERS.has(folder)) {
      return {
        Program(node: unknown) {
          context.report({ data: { feature, folder }, messageId: 'invalid', node: node as unknown })
        },
      }
    }

    if (folder === 'lib') {
      const fileName = normalized.split('/').pop() || ''
      if (fileName.startsWith('use-') || /^use[A-Z]/.test(fileName)) {
        return {
          Program(node: unknown) {
            context.report({
              data: { feature, file: fileName },
              messageId: 'hookInLib',
              node: node as unknown,
            })
          },
        }
      }
    }

    return {}
  },
  meta: {
    docs: {
      description:
        'Files inside features/*/ must be in a valid biological hierarchy folder. Hooks (use-*) must be in organelles/, not lib/. Folders like "dynamic", "utils", "helpers", "components", "hooks" are forbidden.',
    },
    messages: {
      hookInLib:
        'Hook file "{{file}}" is in features/{{feature}}/lib/ but hooks must be in features/{{feature}}/organelles/. lib/ is for pure logic only — no hooks, no state.',
      invalid:
        'File is in "features/{{feature}}/{{folder}}/" which is not a valid biological hierarchy folder. Valid folders: compounds, organelles, cells, tissues, stores, lib.',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default noInvalidFeatureFolders
