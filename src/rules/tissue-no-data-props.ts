// Tissues are pure arrangements of cells/compounds/other-tissues. They must
// not own data. The tissue self-sufficiency rule: only `children`,
// ReactNode slots, `params`, `searchParams`, and layout-variant literal
// unions may appear on a tissue's props. Any `string`/`number`/`boolean`
// primitive, any array type, or any type reference outside a small React-
// node/icon allowlist means the component is holding domain data — which
// is a cell's job, not a tissue's. The fix is to move the file to cells/.
//
// Scope: files in features/*/tissues/**/*.tsx AND app/**/{layout,template}.tsx.
// Exempt: __tests__/**, route fallbacks (default/not-found/loading/error/
// global-error.tsx), files NOT matching the scope above.

const TISSUE_FILE_PATTERN = /(?:features\/[^/]+\/)?tissues\//
const APP_LAYOUT_OR_TEMPLATE = new Set(['layout.tsx', 'template.tsx'])
const ROUTE_FALLBACK_BASENAMES = new Set([
  'default.tsx',
  'error.tsx',
  'global-error.tsx',
  'loading.tsx',
  'not-found.tsx',
])

// Prop NAMES allowed in ALL tissue scopes (feature + app route).
// `params` and `searchParams` are Next.js framework-injected props and
// Must be forwardable through feature tissues that act as route bridges
// (the route-segment → bridge-tissue → cell pattern). They are framework
// Data, never user data, so they remain allowed on any tissue.
const ALWAYS_ALLOWED_PROP_NAMES = new Set([
  'children',
  'className',
  'params',
  'searchParams',
])

// Type NAMES that are allowed anywhere (ReactNode-family + Icon-family).
const REACT_NODE_TYPE_NAMES = new Set([
  'ComponentType',
  'Element',
  'JSX',
  'PropsWithChildren',
  'ReactElement',
  'ReactNode',
])

function isAllowedTypeRefName(name: string): boolean {
  if (REACT_NODE_TYPE_NAMES.has(name)) return true
  if (name.endsWith('Icon')) return true
  if (name.endsWith('IconComponent')) return true
  if (name.endsWith('IconType')) return true
  return false
}

interface TypeAnnotationNode {
  type: string
  elementType?: TypeAnnotationNode
  typeName?: { name?: string; type: string }
  types?: TypeAnnotationNode[]
  literal?: { type: string; value?: unknown }
}

function describeTypeAnnotation(t: TypeAnnotationNode): string {
  if (!t || !t.type) return 'unknown'
  switch (t.type) {
    case 'TSStringKeyword':
      return 'string'
    case 'TSNumberKeyword':
      return 'number'
    case 'TSBooleanKeyword':
      return 'boolean'
    case 'TSArrayType':
      return `Array<${describeTypeAnnotation(t.elementType!)}>`
    case 'TSTypeReference':
      return t.typeName?.name ?? '(unknown-ref)'
    case 'TSUnionType':
      return (t.types ?? []).map(describeTypeAnnotation).join(' | ')
    default:
      return t.type
  }
}

// Returns true if the type annotation is a pure union of string literal
// types (e.g. 'compact' | 'full'). Those are layout-variant selectors and
// are explicitly allowed on tissues.
function isLiteralStringUnion(t: TypeAnnotationNode): boolean {
  if (t.type !== 'TSUnionType') return false
  const types = t.types ?? []
  if (types.length === 0) return false
  return types.every(
    (x) => x.type === 'TSLiteralType' && typeof x.literal?.value === 'string',
  )
}

function isAllowedType(t: TypeAnnotationNode): boolean {
  if (!t || !t.type) return true
  switch (t.type) {
    case 'TSTypeReference':
      return isAllowedTypeRefName(t.typeName?.name ?? '')
    case 'TSUnionType':
      return isLiteralStringUnion(t)
    // TSTypeLiteral (inline object shape) — allowed because nested shapes
    // Are typically ReactNode records; if it turns out to contain data
    // Primitives, the outer check will miss them (v1 limitation).
    case 'TSTypeLiteral':
      return true
    // Primitives and arrays fall through to forbidden.
    case 'TSStringKeyword':
    case 'TSNumberKeyword':
    case 'TSBooleanKeyword':
    case 'TSArrayType':
      return false
    default:
      // Unknown type annotations (e.g. TSAnyKeyword, TSNullKeyword,
      // TSIntersectionType) — conservative: allow and avoid FPs.
      return true
  }
}

interface PropertySignatureNode {
  key?: { name?: string; type?: string }
  loc?: unknown
  typeAnnotation?: { typeAnnotation?: TypeAnnotationNode; type: string }
}

interface ParamNode {
  type: string
  typeAnnotation?: {
    type: string
    typeAnnotation?: {
      type: string
      members?: PropertySignatureNode[]
    }
  }
}

interface FunctionLikeNode {
  id?: { name?: string } | null
  loc?: unknown
  params?: ParamNode[]
  type: string
}

const tissueNoDataProps = {
  create(context: {
    filename: string
    report: (d: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const normalized = context.filename.replaceAll(/\\/g, '/')
    if (/__tests__\//.test(normalized)) return {}
    const basename = normalized.split('/').pop() ?? ''

    const isFeatureTissue = TISSUE_FILE_PATTERN.test(normalized)
    const isAppTissue =
      /(?:^|\/)app\//.test(normalized) && APP_LAYOUT_OR_TEMPLATE.has(basename)
    if (!isFeatureTissue && !isAppTissue) return {}

    if (ROUTE_FALLBACK_BASENAMES.has(basename)) return {}

    function checkFunction(node: FunctionLikeNode): void {
      const firstParam = node.params?.[0]
      if (!firstParam) return
      const typeLiteral = firstParam.typeAnnotation?.typeAnnotation
      if (!typeLiteral || typeLiteral.type !== 'TSTypeLiteral') return
      const members = typeLiteral.members ?? []
      for (const member of members) {
        if (member.key?.type !== 'Identifier') continue
        const propName = member.key.name ?? ''
        if (!propName) continue
        if (ALWAYS_ALLOWED_PROP_NAMES.has(propName)) continue
        const t = member.typeAnnotation?.typeAnnotation
        if (!t) continue
        if (isAllowedType(t)) continue
        context.report({
          data: { prop: propName, type: describeTypeAnnotation(t) },
          messageId: 'dataProp',
          node: member as unknown,
        })
      }
    }

    function checkDeclaration(decl: unknown): void {
      if (!decl || typeof decl !== 'object') return
      const d = decl as { type?: string; declarations?: Array<{ init?: unknown }> }
      if (d.type === 'FunctionDeclaration') {
        checkFunction(d as unknown as FunctionLikeNode)
        return
      }
      if (d.type === 'VariableDeclaration') {
        for (const declNode of d.declarations ?? []) {
          const init = declNode.init as { type?: string } | undefined
          if (init && (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression')) {
            checkFunction(init as unknown as FunctionLikeNode)
          }
        }
      }
    }

    return {
      // Only inspect the PUBLIC INTERFACE of the tissue file — the default or
      // Named export. Inner helper functions (not exported) are file-scoped
      // Implementation details; their props don't define the tissue's
      // Contract, so they're out of scope for this rule.
      ExportDefaultDeclaration(node: { declaration?: unknown }) {
        checkDeclaration(node.declaration)
      },
      ExportNamedDeclaration(node: { declaration?: unknown }) {
        checkDeclaration(node.declaration)
      },
    }
  },

  meta: {
    docs: {
      description:
        "Tissues must not own data. Props on a tissue must be limited to `children`, ReactNode slot props, `params`, `searchParams`, icon types, or layout-variant literal unions. Any primitive (`string`/`number`/`boolean`), array type, or arbitrary domain type reference means the file is actually a cell — move it to cells/.",
    },
    messages: {
      dataProp:
        "Tissue prop '{{prop}}' has type '{{type}}' which is not allowed on a tissue. Tissues arrange children without owning data. Move the file from features/*/tissues/ to features/*/cells/ — cells own data. Allowed tissue props: children, params, searchParams, ReactNode slots, literal-union variants, icon types.",
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default tissueNoDataProps
