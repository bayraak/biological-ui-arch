interface ProgramNode {
  body: Statement[]
  loc?: unknown
  type: 'Program'
}

interface Statement {
  declaration?: unknown
  importKind?: string
  loc?: unknown
  source?: { value: string } | null
  specifiers?: unknown[]
  type: string
}

const BARREL_FILE_PATTERN = /\/cells\/(?:index\.ts|dynamic\.tsx?)$/

function describeStatement(stmt: Statement): string {
  switch (stmt.type) {
    case 'ClassDeclaration':
      return 'a class declaration'
    case 'ExportDefaultDeclaration':
      return 'a default export declaration'
    case 'ExportNamedDeclaration':
      return 'a named export declaration (not a re-export)'
    case 'ExpressionStatement':
      return 'a top-level expression statement'
    case 'FunctionDeclaration':
      return 'a function declaration'
    case 'ImportDeclaration':
      return 'a side-effect import'
    case 'VariableDeclaration':
      return 'a variable declaration'
    default:
      return `a ${stmt.type} statement`
  }
}

const cellsFolderIndexIsBarrel = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const filename = context.filename
    const normalized = filename.replaceAll(/\\/g, '/')
    if (!BARREL_FILE_PATTERN.test(normalized)) return {}

    const shortName = normalized.split('/').pop() || normalized

    return {
      Program(node: ProgramNode) {
        for (const stmt of node.body) {
          if (stmt.type === 'ExportAllDeclaration') continue

          if (stmt.type === 'ExportNamedDeclaration' && stmt.source) continue

          if (stmt.type === 'ImportDeclaration' && stmt.importKind === 'type') continue

          context.report({
            data: { file: shortName, kind: describeStatement(stmt) },
            messageId: 'notBarrel',
            node: stmt as unknown,
          })
        }
      },
    }
  },
  meta: {
    docs: {
      description:
        'Barrel files under cells/ (index.ts, dynamic.ts, dynamic.tsx) must contain ONLY re-export statements. Component definitions belong in their own file.',
    },
    messages: {
      notBarrel:
        'Barrel file "{{file}}" contains {{kind}}. Barrel files under cells/ must be pure re-export manifests (only `export * from` or `export { X } from`). Component definitions belong in their own file.',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default cellsFolderIndexIsBarrel
