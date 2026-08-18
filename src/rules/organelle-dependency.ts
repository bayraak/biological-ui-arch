const SHARED_INFRA_FEATURES = new Set(['charts', 'document', 'shared'])

interface ImportNode {
  importKind?: string
  loc?: unknown
  source: { value: string }
}

const organelleDependency = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const filename = context.filename.replaceAll(/\\/g, '/')
    // Optional `features/<name>/` prefix so the rule fires on the FLAT kit
    // (packages/ui/src/organelles/) as well as a feature-sliced layout.
    const organelleMatch = filename.match(/(?:features\/([^/]+)\/)?organelles\//)
    if (!organelleMatch) return {}

    const currentFeature = organelleMatch[1]
    const shortName = filename.split('/').pop() || filename

    return {
      ImportDeclaration(node: ImportNode) {
        if (node.importKind === 'type') return

        const source = node.source.value

        if (/\/cells\//.test(source)) {
          context.report({
            data: { file: shortName, source },
            messageId: 'forbidden',
            node: node as unknown,
          })
          return
        }

        if (
          /\/tissues\//.test(source) ||
          /\/organs\//.test(source) ||
          /(?:^|\/)layouts\//.test(source) ||
          /apps\/web\/app\//.test(source)
        ) {
          context.report({
            data: { file: shortName, source },
            messageId: 'forbidden',
            node: node as unknown,
          })
          return
        }

        // Sub-organelle imports (organelle-in-organelle) are allowed for same
        // feature or shared-infra features. Biology analogy: nucleolus inside
        // a nucleus, thylakoid inside a chloroplast, cristae inside a
        // mitochondrion. Essential for eukaryotic specialization.
        const crossFeatureOrganelleMatch = source.match(/features\/([^/]+)\/organelles\//)
        if (crossFeatureOrganelleMatch) {
          const importedFeature = crossFeatureOrganelleMatch[1]
          if (importedFeature !== currentFeature && !SHARED_INFRA_FEATURES.has(importedFeature)) {
            context.report({
              data: { file: shortName, source },
              messageId: 'forbidden',
              node: node as unknown,
            })
          }
        }
      },
    }
  },
  meta: {
    docs: {
      description:
        'Organelles may depend on atoms, molecules, compounds, stores, domains, and OTHER ORGANELLES (sub-organelles: nucleolus in nucleus, thylakoid in chloroplast). Organelles cannot depend on cells, tissues, organs, or layouts - direction is wrong: cells contain organelles, not the reverse. Cross-feature organelle imports are allowed only from shared/document/charts (shared infra) or same feature.',
    },
    messages: {
      forbidden:
        'Organelle "{{file}}" cannot import from "{{source}}". Organelles may depend on atoms, molecules, compounds, stores, domains, and sub-organelles (same feature or shared/document/charts).',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default organelleDependency
