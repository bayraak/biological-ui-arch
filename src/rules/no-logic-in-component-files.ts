// Public component files (`<name>.tsx` in a bio tier) should read as ONE
// component. This rule flags the real smell: a public main file that EXPORTS
// several distinct components (a god-file). It does NOT police the kit's
// deliberate decomposition conventions — private sibling splits
// (.parts/.sections/.layouts/.types), co-located Props types, co-located
// helpers/hooks, or SCREAMING_CASE config maps are all accepted and ignored.

const COMPONENT_FILE_PATTERN =
  /(?:features\/[^/]+\/)?(compounds|organelles|cells|tissues|organs)\/.+\.tsx$/

// Private siblings + barrels: implementation detail of ONE component, never the
// "one component per file" subject.
const PRIVATE_OR_NON_ENTRYPOINT =
  /(\.(parts|sections|summary|layouts|icons|types|hooks|utils|context|store|sidebar|data|config|stories|spec|test)\.tsx$|\/index\.tsx$)/

interface ASTNode {
  argument?: ASTNode | null
  body?: ASTNode | ASTNode[] | null
  declaration?: ASTNode | null
  declarations?: {
    id?: { name: string } | null
    init?: { body?: ASTNode | null; type: string } | null
  }[]
  id?: { name: string } | null
  loc?: unknown
  openingElement?: { name?: { name?: string; type?: string } | null } | null
  type: string
}

// PascalCase component name — excludes SCREAMING_SNAKE config constants
// (RESOLVED_DEFAULTS, CTA_VARIANT_BLACK_THEMES) which are data, not components.
function isReactComponent(name: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*$/.test(name) && !/^[A-Z0-9_]+$/.test(name)
}

// True only when the JSX root DELEGATES to another component (PascalCase tag or
// member expression). A root HTML tag (<div>, <section>) is a real leaf
// component, not a delegating wrapper.
function jsxRootIsComponent(node: ASTNode | null | undefined): boolean {
  if (!node || node.type !== 'JSXElement') return false
  const name = node.openingElement?.name
  if (!name) return false
  if (name.type === 'JSXMemberExpression') return true
  return name.type === 'JSXIdentifier' && /^[A-Z]/.test(name.name || '')
}

// A "thin preset wrapper" is an exported component whose entire body is a single
// JSX element delegating to ANOTHER component (e.g. Error404Page renders
// <ErrorPage statusCode={404} />). These are a cohesive preset family, not a
// god-file, so they don't count toward the multi-component smell. A component
// that returns a real HTML subtree is NOT thin.
function isThinWrapper(decl: ASTNode | null | undefined): boolean {
  if (!decl) return false
  try {
    let body = decl.body
    // Arrow stored on a VariableDeclaration's init.
    if (!body && decl.declarations?.[0]?.init) {
      body = decl.declarations[0].init.body
    }
    if (!body || Array.isArray(body)) return false
    // Arrow with an expression body: () => <X/>
    if (body.type === 'JSXElement') return jsxRootIsComponent(body)
    // Block body: { return <X/> }
    if (body.type === 'BlockStatement' && Array.isArray(body.body)) {
      const stmts = body.body
      if (stmts.length !== 1) return false
      const only = stmts[0]
      if (only?.type !== 'ReturnStatement') return false
      return jsxRootIsComponent(only.argument)
    }
  } catch {
    return false
  }
  return false
}

const noLogicInComponentFiles = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const normalized = context.filename.replaceAll(/\\/g, '/')
    if (!COMPONENT_FILE_PATTERN.test(normalized)) return {}
    // Only the public main entrypoint is the "one component per file" subject.
    if (PRIVATE_OR_NON_ENTRYPOINT.test(normalized)) return {}

    const exportedComponents: string[] = []
    let programNode: unknown = null

    return {
      ExportNamedDeclaration(node: ASTNode) {
        const decl = node.declaration
        if (!decl) return

        if (
          decl.type === 'FunctionDeclaration' &&
          decl.id?.name &&
          isReactComponent(decl.id.name) &&
          !isThinWrapper(decl)
        ) {
          exportedComponents.push(decl.id.name)
        }
        if (decl.type === 'VariableDeclaration' && decl.declarations) {
          for (const d of decl.declarations) {
            const initType = d.init?.type
            const isComponentInit =
              initType === 'ArrowFunctionExpression' ||
              initType === 'FunctionExpression' ||
              initType === 'CallExpression' // forwardRef(...) / memo(...)
            if (
              d.id?.name &&
              isReactComponent(d.id.name) &&
              isComponentInit &&
              !isThinWrapper(decl)
            ) {
              exportedComponents.push(d.id.name)
            }
          }
        }
      },

      Program(node: unknown) {
        programNode = node
      },

      'Program:exit'() {
        if (exportedComponents.length > 1) {
          context.report({
            data: {
              count: String(exportedComponents.length),
              names: exportedComponents.join(', '),
            },
            messageId: 'multipleExportedComponents',
            node: programNode as unknown,
          })
        }
      },
    }
  },
  meta: {
    docs: {
      description:
        'A public component file (`<name>.tsx` in a bio tier) should export ONE component. Multiple exported components in a single public file is a god-file — split into separate files. Private sibling splits (.parts/.sections/.layouts/.types), co-located types/helpers/hooks, config constants, and thin preset wrappers are accepted and ignored.',
    },
    messages: {
      multipleExportedComponents:
        'File exports {{count}} components ({{names}}). A public component file should export one component — split the extras into their own files (or a private .parts sibling if they are internal).',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default noLogicInComponentFiles
