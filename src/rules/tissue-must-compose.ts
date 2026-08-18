// Tissues compose cells, compounds, molecules, atoms, or OTHER tissues.
// This rule checks BEHAVIOR (render), not syntax (import). A file that
// Imports a bio symbol but never renders it is FAKE composition — the
// Import is lint-theater. The rule closes this bypass by requiring that
// At least one imported bio symbol actually appears as a JSX tag in the
// File. ("lint-theater" prohibition).

import fs from 'node:fs'

const COMPOSITION_PATTERNS = [
  // Tier segment with a trailing slash OR at the end of the specifier, so both
  // relative (`../cells/x`, `../../feature/cells/x`) and self-subpath feature
  // barrels (`#ui/cart/cells`, `#email/hero/compounds`) are recognized.
  /\/(atoms|molecules|compounds|cells|tissues|organelles)(\/|$)/,
  // react-email primitives are the email surface's compositional units — an
  // email template that arranges <Section>/<Row>/<Container> IS composing.
  /^@react-email\//,
  // Flat-kit sibling splits: a tissue arranges its UI across private siblings
  // (`import { X } from './site-header.parts'`). Importing + rendering those is
  // real composition, not lint-theater.
  /\.(parts|sections|layouts)$/,
]

// A pure re-export shim (only `export … from`, no component) is a compatibility
// alias left behind when a tissue moves to a feature folder — not a tissue.
function isReexportOnly(file: string): boolean {
  try {
    const src = fs
      .readFileSync(file, 'utf8')
      .replaceAll(/\/\*[\s\S]*?\*\//g, '')
      .replaceAll(/\/\/.*$/gm, '')
    const hasReexport = /\bexport\b[^;]*\bfrom\b\s*['"]/.test(src)
    const hasComponent = /\bfunction\b|=>|\breturn\b|<[A-Za-z]/.test(src)
    return hasReexport && !hasComponent
  } catch {
    return false
  }
}

// Next.js route files that hold semantic UI and MUST compose the bio hierarchy.
// Page/layout/template are the route "body" — returning null or passing children
// Through without composing is lint-theater.
const APP_ROUTE_MUST_COMPOSE = new Set([
  'page.tsx',
  'layout.tsx',
  'template.tsx',
])

// Route-fallback files. Next.js allows/expects these to be minimal or null.
// Examples: @drawer/default.tsx returning null is the canonical parallel-route
// Fallback; loading.tsx that defers to Suspense is legitimate. Exempt.
const APP_ROUTE_FALLBACKS = new Set([
  'default.tsx',
  'not-found.tsx',
  'loading.tsx',
  'error.tsx',
  'global-error.tsx',
])

// Route files that scope Next.js metadata. A layout/template whose purpose
// Is `export const metadata` or `export async function generateMetadata` is
// A legitimate framework construct — the component is required by Next.js
// But the real purpose is the metadata export. Forcing a fake bio wrapper
// Here would BE lint-theater.
const METADATA_EXEMPT_BASENAMES = new Set(['layout.tsx', 'template.tsx'])
const METADATA_EXPORT_NAMES = new Set(['metadata', 'viewport', 'generateMetadata', 'generateViewport'])

interface ImportSpecifier {
  imported?: { name?: string; type: string }
  local?: { name?: string; type: string }
  type: string
}

interface ImportNode {
  importKind?: string
  loc: unknown
  source: { value: string }
  specifiers?: ImportSpecifier[]
}

interface JsxIdentifier {
  name?: string
  type: 'JSXIdentifier'
}

interface JsxMemberExpression {
  object?: { name?: string; type: string }
  property?: { name?: string; type: string }
  type: 'JSXMemberExpression'
}

interface JsxOpeningElement {
  attributes?: unknown[]
  loc?: unknown
  name: JsxIdentifier | JsxMemberExpression | { type: string }
  type: 'JSXOpeningElement'
}

const tissueMustCompose = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const filename = context.filename
    const normalized = filename.replaceAll(/\\/g, '/')
    const isTissueDir = /(?:features\/[^/]+\/)?tissues\//.test(normalized)
    const basename = normalized.split('/').pop() ?? ''
    // Only the PUBLIC tissue entrypoint `<name>.tsx` performs the arrangement.
    // Private siblings (.parts/.sections/.layouts/.icons/.types), barrels, and
    // non-tsx files are implementation details, not the tissue itself.
    const isTissue =
      isTissueDir &&
      /\.tsx$/.test(basename) &&
      basename !== 'index.tsx' &&
      !/\.(parts|sections|summary|layouts|icons|types|hooks|utils|context|store|sidebar|data|config|stories|spec|test)\.tsx$/.test(
        basename,
      )
    const isAppRouteFile =
      /\/app\//.test(normalized) && APP_ROUTE_MUST_COMPOSE.has(basename)
    const isAppFallback = /\/app\//.test(normalized) && APP_ROUTE_FALLBACKS.has(basename)

    // Fallback files are contractually null-returning — never fire.
    if (isAppFallback) return {}

    if (!isTissue && !isAppRouteFile) return {}
    if (isReexportOnly(filename)) return {}

    const bioImportLocals = new Set<string>()
    const renderedTagNames = new Set<string>()
    let hasMetadataExport = false
    let programNode: unknown = null

    return {
      ExportNamedDeclaration(node: {
        declaration?: {
          declarations?: Array<{ id?: { name?: string; type?: string } }>
          id?: { name?: string; type?: string }
          type: string
        }
      }) {
        const decl = node.declaration
        if (!decl) return
        if (decl.type === 'VariableDeclaration') {
          for (const d of decl.declarations ?? []) {
            const name = d.id?.name
            if (name && METADATA_EXPORT_NAMES.has(name)) {
              hasMetadataExport = true
            }
          }
        } else if (decl.type === 'FunctionDeclaration') {
          const name = decl.id?.name
          if (name && METADATA_EXPORT_NAMES.has(name)) {
            hasMetadataExport = true
          }
        }
      },
      ImportDeclaration(node: ImportNode) {
        if (node.importKind === 'type') return
        const source = node.source.value
        if (!COMPOSITION_PATTERNS.some((pattern) => pattern.test(source))) return
        for (const spec of node.specifiers ?? []) {
          const localName = spec.local?.name
          if (localName) bioImportLocals.add(localName)
        }
      },
      JSXOpeningElement(node: JsxOpeningElement) {
        const name = node.name
        if (!name) return
        if (name.type === 'JSXIdentifier') {
          const id = name as JsxIdentifier
          if (id.name) renderedTagNames.add(id.name)
        } else if (name.type === 'JSXMemberExpression') {
          const member = name as JsxMemberExpression
          const root = member.object?.name
          if (root) renderedTagNames.add(root)
        }
      },
      'Program:exit'(node: unknown) {
        programNode = node

        // Metadata exemption: layouts/templates whose purpose is metadata
        // Scoping are legitimate Next.js constructs.
        if (hasMetadataExport && METADATA_EXEMPT_BASENAMES.has(basename)) {
          return
        }

        // Routing-marker exemption: a page.tsx with ZERO bio imports, ZERO
        // JSX, AND no metadata export is a Next.js "routing marker" — the
        // Route must exist for Next.js to resolve, but the real UI is in the
        // Sibling layout.tsx. Adding fake bio UI here would be lint-theater.
        // The exemption is intentionally narrow: any bio import, any JSX, or
        // Any metadata export disqualifies the file (a page with metadata
        // Is a real route that should render). The exemption does NOT apply
        // To layout.tsx or template.tsx (those use the metadata exemption).
        const isTrulyEmpty =
          bioImportLocals.size === 0 && renderedTagNames.size === 0 && !hasMetadataExport
        if (basename === 'page.tsx' && isTrulyEmpty) {
          return
        }

        const composesByRender = [...bioImportLocals].some((localName) =>
          renderedTagNames.has(localName),
        )
        // Backstop: a tissue that renders ANY PascalCase component is arranging
        // UI, not doing lint-theater. Passthrough/null tissues (only HTML tags
        // or `{children}`) render no PascalCase tag and are still caught.
        const rendersAnyComponent = [...renderedTagNames].some((tag) => /^[A-Z]/.test(tag))

        if (!composesByRender && !rendersAnyComponent) {
          const shortName = normalized.split('/').pop() || normalized
          const reason =
            bioImportLocals.size === 0
              ? 'noBioImports'
              : 'bioImportedButNotRendered'
          context.report({
            data: { file: shortName, reason },
            messageId: 'missingComposition',
            node: programNode as unknown,
          })
        }
      },
    }
  },
  meta: {
    docs: {
      description:
        'Tissues MUST RENDER at least one cell, compound, molecule, atom, or other tissue. Tissues arrange bio elements into functional units — a tissue that imports bio symbols but never renders them is performing FAKE composition (lint-theater). This rule checks the JSX render tree, not just the import list, to close the fake-compose bypass.',
    },
    messages: {
      missingComposition:
        'Tissue/route "{{file}}" does not RENDER any cell/compound/molecule/atom/tissue. Tissues and Next.js route UI files (page/layout/template) MUST arrange bio elements — passthrough wrappers like `<>{children}</>`, `<div>{children}</div>`, or `return null` are lint-theater. Fix: compose real bio in JSX, OR delete the file if it exists only for metadata (move metadata to a child page.tsx), OR reclassify it. Next.js fallback files (default/not-found/loading/error/global-error) are automatically exempt.',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default tissueMustCompose
