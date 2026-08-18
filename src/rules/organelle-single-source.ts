const ORGANELLE_FILE_PATTERN = /(?:features\/[^/]+\/)?organelles\//

const ZUSTAND_STORE_PATTERN = /^use\w+Store$/

const FORM_SOURCES = new Set(['react-hook-form'])

const FORM_CONTEXT_IMPORT_PATTERN = /FormContext$/

const organelleSingleSource = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const normalized = context.filename.replaceAll(/\\/g, '/')
    if (!ORGANELLE_FILE_PATTERN.test(normalized)) return {}

    const file =
      normalized
        .split('/')
        .pop()
        ?.replace(/\.tsx?$/, '') || 'unknown'

    const storeHooks = new Map<string, unknown>()
    let formNode: unknown = null
    let formSource = ''
    let programNode: unknown = null

    return {
      CallExpression(node: { callee: { name?: string; type: string }; loc?: unknown }) {
        if (node.callee.type !== 'Identifier') return
        const name = node.callee.name
        if (!name) return

        if (ZUSTAND_STORE_PATTERN.test(name) && !storeHooks.has(name)) {
          storeHooks.set(name, node)
        }
      },

      ImportDeclaration(node: {
        importKind?: string
        source: { value: string }
        specifiers?: { imported?: { name: string }; local?: { name: string }; type: string }[]
      }) {
        if (node.importKind === 'type') return
        const source = node.source.value

        if (FORM_SOURCES.has(source) && !formNode) {
          formNode = node
          formSource = source
          return
        }

        if (source.includes('/providers/')) {
          const specs = node.specifiers ?? []
          for (const spec of specs) {
            const localName = spec.local?.name || ''
            if (FORM_CONTEXT_IMPORT_PATTERN.test(localName) && !formNode) {
              formNode = node
              formSource = localName
            }
          }
        }
      },

      Program(node: unknown) {
        programNode = node
      },

      'Program:exit'() {
        const storeNames = [...storeHooks.keys()]
        const isTsx = normalized.endsWith('.tsx')

        if (storeNames.length > 0 && formNode) {
          context.report({
            data: {
              file,
              formSource,
              zustandSource: storeNames.join(', '),
            },
            messageId: isTsx ? 'mixedStoreAndFormComponent' : 'mixedStoreAndFormHook',
            node: programNode as unknown,
          })
        }

        if (storeNames.length > 1) {
          context.report({
            data: {
              count: String(storeNames.length),
              file,
              stores: storeNames.join(', '),
            },
            messageId: isTsx ? 'multipleStoresComponent' : 'multipleStoresHook',
            node: programNode as unknown,
          })
        }
      },
    }
  },
  meta: {
    docs: {
      description:
        'Organelles must have a single state source. (1) An organelle must not mix Zustand and react-hook-form — the cell coordinates across sources. (2) An organelle must read from at most ONE Zustand store — if it needs multiple stores, the cell should derive and pass the data down.',
    },
    messages: {
      mixedStoreAndFormComponent:
        'Organelle "{{file}}" mixes Zustand ({{zustandSource}}) and form state ({{formSource}}). DECOMPOSE: split into a store organelle + a form organelle, each with ONE source. Cell composes both and passes derived data as props.',
      mixedStoreAndFormHook:
        'Hook "{{file}}" mixes Zustand ({{zustandSource}}) and form state ({{formSource}}). SPLIT into separate hooks — one per source. Cell calls both.',
      multipleStoresComponent:
        'Organelle "{{file}}" reads from {{count}} stores ({{stores}}). DECOMPOSE: split into {{count}} focused organelles, each reading ONE store. Cell composes them and passes shared/derived data as props to compounds.',
      multipleStoresHook:
        'Hook "{{file}}" reads from {{count}} stores ({{stores}}). SPLIT into {{count}} hooks — one per store. Cell calls all of them.',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default organelleSingleSource
