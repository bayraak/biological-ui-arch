const biologicalHierarchyPattern = /\/(molecules|compounds|organelles|cells|layouts)\//

const MODIFIER_PREFIX = '(?:(?:dark|print|sm|md|lg|xl|2xl|first|last|odd|even):)?'
const BORDER_PATTERN = new RegExp(`(?:^|\\s)${MODIFIER_PREFIX}border(?:\\s|$|-[1-9]\\d*(?:\\s|$))`)
const BG_PATTERN = new RegExp(
  `(?:^|\\s)${MODIFIER_PREFIX}bg-(?:white|black|container|page|neutral-\\d+|gray-\\d+|zinc-\\d+|stone-\\d+|slate-\\d+)`,
)

interface BinaryExpression {
  left: ClassNameExpression | null
  operator: string
  right: ClassNameExpression | null
  type: 'BinaryExpression'
}

type ClassNameExpression =
  | { type: string }
  | BinaryExpression
  | JSXExpressionContainer
  | Literal
  | TemplateLiteral

interface JSXAttribute {
  name?: { name?: string; type: string }
  type: string
  value?: ClassNameExpression | null
}

interface JSXExpressionContainer {
  expression: ClassNameExpression | null
  type: 'JSXExpressionContainer'
}

interface JSXOpeningElement {
  attributes: JSXAttribute[]
  name: { name?: string; type: string }
  type: 'JSXOpeningElement'
}

interface Literal {
  type: 'Literal'
  value: unknown
}

interface TemplateLiteral {
  quasis: { value?: { raw?: string } }[]
  type: 'TemplateLiteral'
}

function extractClassNameString(node: ClassNameExpression | null): null | string {
  if (!node) return null
  if (node.type === 'Literal') {
    const literal = node as Literal
    return typeof literal.value === 'string' ? literal.value : null
  }
  if (node.type === 'JSXExpressionContainer') {
    return extractClassNameString((node as JSXExpressionContainer).expression)
  }
  if (node.type === 'TemplateLiteral') {
    const tl = node as TemplateLiteral
    return tl.quasis.map((q) => q.value?.raw ?? '').join(' ')
  }
  if (node.type === 'BinaryExpression') {
    const bin = node as BinaryExpression
    if (bin.operator !== '+') return null
    const left = extractClassNameString(bin.left) ?? ''
    const right = extractClassNameString(bin.right) ?? ''
    const combined = (left + ' ' + right).trim()
    return combined.length > 0 ? combined : null
  }
  return null
}

function isCardLikeClassName(className: string): boolean {
  return BORDER_PATTERN.test(className) && BG_PATTERN.test(className)
}

const noCardShapedDiv = {
  create(context: {
    filename: string
    report: (descriptor: {
      data?: Record<string, string>
      messageId: string
      node: unknown
    }) => void
  }) {
    const filename = context.filename
    if (!biologicalHierarchyPattern.test(filename)) return {}

    return {
      JSXOpeningElement(node: JSXOpeningElement) {
        if (node?.name?.type !== 'JSXIdentifier' || node.name.name !== 'div') return

        const classAttr = node.attributes?.find(
          (a) =>
            a?.type === 'JSXAttribute' &&
            a?.name?.type === 'JSXIdentifier' &&
            a?.name?.name === 'className',
        )
        if (!classAttr) return

        const cls = extractClassNameString(classAttr.value ?? null)
        if (!cls) return

        if (isCardLikeClassName(cls)) {
          context.report({ messageId: 'cardLike', node: node as unknown })
        }
      },
    }
  },
  meta: {
    docs: {
      description:
        'Forbid raw <div> styled as a card (border + background combination). Use the <Card> atom from your design system instead so consumers compose the design system rather than recreating it.',
    },
    messages: {
      cardLike:
        'This <div> is styled as a card (className contains both a border and background class). Use the <Card> atom from your design system instead. The Card atom centralizes card styling so consumers compose the design system instead of recreating it.',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default noCardShapedDiv
