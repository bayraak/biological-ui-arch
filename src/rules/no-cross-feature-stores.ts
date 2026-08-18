const BIO_FILE_PATTERN = /features\/([^/]+)\/(cells|organelles)\/.*\.(tsx?|ts)$/

const STORE_IMPORT_PATTERN = /(?:@\/)?features\/([^/]+)\/stores\//

const SHARED_FEATURE = 'shared'

const noCrossFeatureStores = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const normalized = context.filename.replaceAll(/\\/g, '/')
    const fileMatch = normalized.match(BIO_FILE_PATTERN)
    if (!fileMatch) return {}

    const ownFeature = fileMatch[1]
    const file = normalized.split('/').pop() || 'unknown'

    return {
      ImportDeclaration(node: { importKind?: string; source: { value: string }; loc?: unknown }) {
        if (node.importKind === 'type') return
        const source = node.source.value

        const storeMatch = source.match(STORE_IMPORT_PATTERN)
        if (!storeMatch) return

        const importedFeature = storeMatch[1]
        if (importedFeature === ownFeature) return
        if (importedFeature === SHARED_FEATURE) return

        context.report({
          data: {
            file,
            importedFeature,
            ownFeature,
            source,
          },
          messageId: 'crossFeatureStore',
          node: node as unknown,
        })
      },
    }
  },
  meta: {
    docs: {
      description:
        'Cells and organelles must not read stores from other features. A cell/organelle in features/X/ may read only from features/X/stores/ or features/shared/stores/. Cross-feature data flows through the parent tissue/organ as props — never via direct store import.',
    },
    messages: {
      crossFeatureStore:
        '"{{file}}" in feature "{{ownFeature}}" imports from another feature\'s store: "{{source}}" (feature: "{{importedFeature}}"). Cross-feature data must flow through the parent as props. Only features/{{ownFeature}}/stores/* and features/shared/stores/* are allowed here.',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default noCrossFeatureStores
