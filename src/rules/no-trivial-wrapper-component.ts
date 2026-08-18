// A component whose body is ONLY `return <X/>` with no added structure is
// a trivial wrapper — it renames another component for no reason. This is
// the lint-theater shape that gets created to satisfy "must-compose" rules
// without actually composing anything.
//
// Specifically flags a component function where ALL of:
//   - body is exactly ONE ReturnStatement
//   - return argument is a JSXElement (not fragment, not null)
//   - JSXElement tag is a PascalCase imported identifier
//   - JSXElement has no meaningful children (empty or whitespace only)
//   - JSXElement has NO dynamic attributes (only static string literals)
//   - the function calls no hooks (no use*() calls)
//
// Exempt (legitimate thin shapes):
//   - Route files (page/layout/template.tsx) — they're inherently delegates
//   - Route fallbacks (default/not-found/loading/error/global-error.tsx)
//   - __tests__/** files
//   - r3f files (@react-three/fiber/drei imports)
//   - Files in features/*/tissues/** that bridge to a non-tissue bio (cells/,
//     compounds/, organelles/, molecules/, atoms/). These "bridge tissues"
//     exist because next-route-segment-is-thin-delegate forces route segments
//     to compose ONLY tissues — the bridge is the designated pattern for
//     passing through to a concrete cell/compound. A tissue wrapping ANOTHER
//     tissue is still flagged (that's just renaming).

const ROUTE_BASENAMES = new Set([
  'default.tsx',
  'error.tsx',
  'global-error.tsx',
  'layout.tsx',
  'loading.tsx',
  'not-found.tsx',
  'page.tsx',
  'template.tsx',
])

const R3F_PACKAGES = new Set(['@react-three/drei', '@react-three/fiber'])

const WALK_SKIP_KEYS = new Set(['parent', 'loc', 'range', 'scope'])

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

interface JsxAttribute {
  name?: { name?: string; type: string }
  type: string
  value?: { type: string; value?: unknown }
}

interface JsxElement {
  children?: Array<{ type: string; value?: string }>
  closingElement?: unknown
  openingElement?: { attributes?: JsxAttribute[]; name?: { name?: string; type: string } }
  type: 'JSXElement'
}

interface FunctionDeclLike {
  body?: { body?: unknown[]; type: string }
  id?: { name?: string } | null
  params?: unknown[]
  type: string
}

interface ReturnStatementNode {
  argument?: unknown
  type: 'ReturnStatement'
}

interface ExportDefaultDeclNode {
  declaration?: FunctionDeclLike | null
  type: 'ExportDefaultDeclaration'
}

interface ExportNamedDeclNode {
  declaration?: FunctionDeclLike | null
  type: 'ExportNamedDeclaration'
}

function functionHasHookCall(body: unknown): boolean {
  let found = false
  const visited = new WeakSet<object>()
  function walk(node: unknown): void {
    if (found) return
    if (!node || typeof node !== 'object') return
    if (visited.has(node as object)) return
    visited.add(node as object)
    const n = node as { callee?: { name?: string; type: string }; type?: string }
    if (
      n.type === 'FunctionDeclaration' ||
      n.type === 'FunctionExpression' ||
      n.type === 'ArrowFunctionExpression'
    ) {
      if (node !== body) return
    }
    if (n.type === 'CallExpression') {
      const callee = n.callee
      if (callee?.type === 'Identifier' && callee.name && /^use[A-Z]/.test(callee.name)) {
        found = true
        return
      }
    }
    for (const key of Object.keys(n)) {
      if (WALK_SKIP_KEYS.has(key)) continue
      const v = (n as Record<string, unknown>)[key]
      if (Array.isArray(v)) {
        for (const item of v) walk(item)
      } else if (v && typeof v === 'object') {
        walk(v)
      }
    }
  }
  walk(body)
  return found
}

function hasMeaningfulChildren(el: JsxElement): boolean {
  const kids = el.children ?? []
  for (const c of kids) {
    if (c.type === 'JSXText') {
      if ((c.value ?? '').trim().length > 0) return true
      continue
    }
    return true
  }
  return false
}

function hasDynamicAttr(el: JsxElement): boolean {
  const attrs = el.openingElement?.attributes ?? []
  for (const a of attrs) {
    if (a.type === 'JSXSpreadAttribute') return true
    if (a.type !== 'JSXAttribute') continue
    const v = a.value
    if (!v) continue
    if (v.type === 'Literal') continue
    return true
  }
  return false
}

function checkFunction(
  fnName: string,
  fn: FunctionDeclLike,
  importedLocals: Set<string>,
  importSources: Map<string, string>,
  isBridgeFromTissue: boolean,
  report: (d: { data: Record<string, string>; messageId: string; node: unknown }) => void,
): void {
  if (!/^[A-Z]/.test(fnName)) return
  const body = fn.body
  if (!body || body.type !== 'BlockStatement') return
  const stmts = body.body ?? []
  if (stmts.length !== 1) return
  const only = stmts[0] as ReturnStatementNode
  if (!only || only.type !== 'ReturnStatement') return
  const arg = only.argument as JsxElement | undefined
  if (!arg || arg.type !== 'JSXElement') return
  const tagNode = arg.openingElement?.name
  if (tagNode?.type !== 'JSXIdentifier') return
  const tag = tagNode.name ?? ''
  if (!/^[A-Z]/.test(tag)) return
  // Only flag when the tag is a value actually imported from another module.
  // A local destructured variable (render-prop-style, e.g.
  // `function Foo({icon: Icon}) { return <Icon .../> }`) is parametrized
  // rendering, NOT a trivial alias — skip.
  if (!importedLocals.has(tag)) return
  if (hasMeaningfulChildren(arg)) return
  if (hasDynamicAttr(arg)) return
  if (functionHasHookCall(body)) return

  // Bridge-tissue exemption: a tissue trivially wrapping a NON-tissue bio
  // (cell/compound/organelle/molecule/atom) is the designated pattern for
  // routing (next-route-segment-is-thin-delegate requires tissues). Only
  // flag when a tissue wraps ANOTHER tissue (just renaming).
  if (isBridgeFromTissue) {
    const source = importSources.get(tag) ?? ''
    const wrapsNonTissueBio = /\/(cells|compounds|organelles|molecules|atoms)\//.test(source)
    if (wrapsNonTissueBio) return
  }

  report({
    data: { inner: tag, name: fnName },
    messageId: 'trivialWrapper',
    node: fn as unknown,
  })
}

const noTrivialWrapperComponent = {
  create(context: {
    filename: string
    report: (d: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const normalized = context.filename.replaceAll(/\\/g, '/')
    if (/__tests__\//.test(normalized)) return {}
    const basename = normalized.split('/').pop() ?? ''
    if (/(?:^|\/)app\//.test(normalized) && ROUTE_BASENAMES.has(basename)) return {}

    const isBridgeFromTissue = /(?:features\/[^/]+\/)?tissues\//.test(normalized)

    let fileUsesR3F = false
    const importedLocals = new Set<string>()
    const importSources = new Map<string, string>()

    return {
      ExportDefaultDeclaration(node: ExportDefaultDeclNode) {
        if (fileUsesR3F) return
        const decl = node.declaration
        if (!decl || decl.type !== 'FunctionDeclaration') return
        const name = decl.id?.name ?? ''
        if (!name) return
        checkFunction(name, decl, importedLocals, importSources, isBridgeFromTissue, context.report)
      },
      ExportNamedDeclaration(node: ExportNamedDeclNode) {
        if (fileUsesR3F) return
        const decl = node.declaration
        if (!decl || decl.type !== 'FunctionDeclaration') return
        const name = decl.id?.name ?? ''
        if (!name) return
        checkFunction(name, decl, importedLocals, importSources, isBridgeFromTissue, context.report)
      },
      ImportDeclaration(node: ImportNode) {
        if (R3F_PACKAGES.has(node.source.value)) {
          fileUsesR3F = true
        }
        for (const spec of node.specifiers ?? []) {
          const local = spec.local?.name
          if (local) {
            importedLocals.add(local)
            importSources.set(local, node.source.value)
          }
        }
      },
    }
  },

  meta: {
    docs: {
      description:
        "Flag components whose body is only `return <ImportedComponent/>` with no children, no dynamic attrs, and no hooks. Such components are trivial wrappers — pointless renames that add a layer without value. If you need the shape, inline or delete. Route files are exempt (thin delegation is their purpose).",
    },
    messages: {
      trivialWrapper:
        "Component '{{name}}' is a trivial wrapper — body is only `return <{{inner}}/>` with no children, no dynamic attrs, no hooks. This is lint-theater: it renames {{inner}} for no reason. Delete the wrapper and call {{inner}} directly, OR give the component real work (wrap in structure, compose multiple elements, add hooks, or pass through children).",
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default noTrivialWrapperComponent
