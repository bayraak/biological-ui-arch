// Next.js route segment files (page/layout/template.tsx) are framework
// infrastructure. Their job is to wire up the route and delegate
// rendering. No inline JSX composition, no native HTML wrapping, no
// inline helper functions, no multiple-element returns.
//
// The default export must return ONE of:
//   - null
//   - a single JSXElement whose tag is a PascalCase identifier imported
//     FROM A TISSUE (features/*/tissues/**). Cells/compounds/organelles/
//     molecules/atoms/lib-helpers are FORBIDDEN as direct delegates —
//     route segments compose tissues, and tissues compose the rest.
//   - a JSXFragment containing exactly one such JSXElement
//
// Exempt (framework contracts):
//   - Route fallback files (default/not-found/loading/error/global-error)
//   - __tests__/** files

const DELEGATE_BASENAMES = new Set(['layout.tsx', 'page.tsx', 'template.tsx'])
const FALLBACK_BASENAMES = new Set([
  'default.tsx',
  'error.tsx',
  'global-error.tsx',
  'loading.tsx',
  'not-found.tsx',
])

const SKIP_KEYS = new Set(['parent', 'loc', 'range', 'scope'])

interface ImportSpecifier {
  imported?: { name?: string; type: string }
  local?: { name?: string; type: string }
  type: string
}

interface ImportNode {
  source: { value: string }
  specifiers?: ImportSpecifier[]
  type: string
}

interface JsxElement {
  children?: Array<{ type: string; value?: string; openingElement?: unknown }>
  openingElement?: { attributes?: unknown[]; name?: { name?: string; type: string } }
  type: 'JSXElement'
}

interface JsxFragment {
  children?: Array<{ type: string; value?: string; openingElement?: { name?: { name?: string; type: string } } }>
  type: 'JSXFragment'
}

interface LiteralNode {
  type: 'Literal'
  value?: unknown
}

interface ReturnStatementNode {
  argument?: JsxElement | JsxFragment | LiteralNode | { type: string } | null
  type: 'ReturnStatement'
}

interface FunctionDeclLike {
  body?: { body?: unknown[]; type: string }
  id?: { name?: string } | null
  type: string
}

interface ExportDefaultDeclNode {
  declaration?: FunctionDeclLike | null
  type: 'ExportDefaultDeclaration'
}

function collectReturnStatements(body: unknown): ReturnStatementNode[] {
  const out: ReturnStatementNode[] = []
  const visited = new WeakSet<object>()
  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return
    if (visited.has(node as object)) return
    visited.add(node as object)
    const n = node as { type?: string }
    if (node !== body && (
      n.type === 'FunctionDeclaration' ||
      n.type === 'FunctionExpression' ||
      n.type === 'ArrowFunctionExpression'
    )) {
      return
    }
    if (n.type === 'ReturnStatement') {
      out.push(node as ReturnStatementNode)
    }
    for (const key of Object.keys(n)) {
      if (SKIP_KEYS.has(key)) continue
      const v = (n as Record<string, unknown>)[key]
      if (Array.isArray(v)) {
        for (const item of v) walk(item)
      } else if (v && typeof v === 'object') {
        walk(v)
      }
    }
  }
  walk(body)
  return out
}

function tagOf(el: JsxElement): null | string {
  const name = el.openingElement?.name
  if (!name) return null
  if (name.type === 'JSXIdentifier') return name.name ?? null
  return null
}

function describeReturn(arg: unknown): string {
  if (!arg || typeof arg !== 'object') return 'empty'
  const a = arg as { type?: string; value?: unknown }
  if (a.type === 'Literal' && a.value === null) return 'null'
  if (a.type === 'JSXElement') {
    const t = tagOf(arg as JsxElement)
    return t ? `<${t}/>` : 'JSXElement'
  }
  if (a.type === 'JSXFragment') return 'fragment'
  return a.type ?? 'unknown'
}

const nextRouteSegmentIsThinDelegate = {
  create(context: {
    filename: string
    report: (d: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const normalized = context.filename.replaceAll(/\\/g, '/')
    if (/__tests__\//.test(normalized)) return {}
    if (!/(?:^|\/)app\//.test(normalized)) return {}
    const basename = normalized.split('/').pop() ?? ''
    if (!DELEGATE_BASENAMES.has(basename)) return {}
    if (FALLBACK_BASENAMES.has(basename)) return {}

    const importSources = new Map<string, string>()

    function isImportedPascalCase(tag: null | string): boolean {
      if (!tag) return false
      if (!/^[A-Z]/.test(tag)) return false
      return importSources.has(tag)
    }

    // Returns the bio folder name from an import source path, or 'unknown'.
    // Examples:
    //   '@/features/foo/tissues/bar' → 'tissues'
    //   '@/features/foo/cells/bar'   → 'cells'
    //   '@ui/atoms/button'    → 'atoms'
    //   '@/features/foo/lib/helper'  → 'lib'
    function bioFolderOf(source: string): string {
      const m = source.match(/\/(atoms|molecules|compounds|organelles|cells|tissues|lib|stores)\//)
      return m?.[1] ?? 'unknown'
    }

    function isTissueSource(source: string | undefined): boolean {
      if (!source) return false
      return /\/tissues\//.test(source)
    }

    function reportNonTissueDelegate(tag: string, ret: ReturnStatementNode): void {
      const source = importSources.get(tag) ?? ''
      context.report({
        data: {
          bio: bioFolderOf(source),
          file: basename,
          source,
          tag,
        },
        messageId: 'delegateMustBeTissue',
        node: ret,
      })
    }

    function checkReturn(ret: ReturnStatementNode): void {
      const arg = ret.argument
      if (!arg || typeof arg !== 'object') return
      const a = arg as { type?: string; value?: unknown }
      if (a.type === 'Literal' && a.value === null) return
      if (a.type === 'JSXElement') {
        const tag = tagOf(arg as JsxElement)
        if (!isImportedPascalCase(tag)) {
          context.report({
            data: { file: basename, found: describeReturn(arg) },
            messageId: 'mustBeThinDelegate',
            node: ret,
          })
          return
        }
        const source = importSources.get(tag!)
        if (!isTissueSource(source)) {
          reportNonTissueDelegate(tag!, ret)
        }
        return
      }
      if (a.type === 'JSXFragment') {
        const kids = (arg as JsxFragment).children ?? []
        const meaningful = kids.filter((c) => {
          if (c.type === 'JSXText') return (c.value ?? '').trim().length > 0
          return true
        })
        if (meaningful.length !== 1) {
          context.report({
            data: { count: String(meaningful.length), file: basename },
            messageId: 'fragmentMustBeSingleDelegate',
            node: ret,
          })
          return
        }
        const child = meaningful[0]
        if (child.type !== 'JSXElement') {
          context.report({
            data: { file: basename, found: 'non-element-child' },
            messageId: 'mustBeThinDelegate',
            node: ret,
          })
          return
        }
        const tagName = child.openingElement?.name?.type === 'JSXIdentifier' ? child.openingElement.name.name ?? null : null
        if (!isImportedPascalCase(tagName)) {
          context.report({
            data: { file: basename, found: `fragment><${tagName ?? '?'}/></fragment` },
            messageId: 'mustBeThinDelegate',
            node: ret,
          })
          return
        }
        const source = importSources.get(tagName!)
        if (!isTissueSource(source)) {
          reportNonTissueDelegate(tagName!, ret)
        }
        return
      }
      context.report({
        data: { file: basename, found: describeReturn(arg) },
        messageId: 'mustBeThinDelegate',
        node: ret,
      })
    }

    return {
      ExportDefaultDeclaration(node: ExportDefaultDeclNode) {
        const decl = node.declaration
        if (!decl || decl.type !== 'FunctionDeclaration') return
        const returns = collectReturnStatements(decl.body)
        for (const ret of returns) checkReturn(ret)
      },
      ImportDeclaration(node: ImportNode) {
        const source = node.source?.value ?? ''
        for (const spec of node.specifiers ?? []) {
          const local = spec.local?.name
          if (local) importSources.set(local, source)
        }
      },
    }
  },

  meta: {
    docs: {
      description:
        "Next.js route segment files (page/layout/template.tsx) must be thin delegates: return exactly one imported component or null. No inline JSX, no native HTML wrapping, no helpers. Route fallback files are exempt.",
    },
    messages: {
      delegateMustBeTissue:
        "Route segment '{{file}}' delegates to '<{{tag}}/>' imported from '{{source}}' (a {{bio}}). Route segments compose TISSUES only — import {{tag}} from features/*/tissues/** or wrap it in a new tissue.",
      fragmentMustBeSingleDelegate:
        "Route segment '{{file}}' returns a fragment with {{count}} elements. Must be a single imported tissue (wrap the fragment contents in a tissue).",
      mustBeThinDelegate:
        "Route segment '{{file}}' must return a single imported tissue or null — found {{found}}. Move the implementation into a tissue and delegate.",
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default nextRouteSegmentIsThinDelegate
