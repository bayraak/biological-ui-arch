const forbiddenPropMap: Record<string, string> = {
  ariaAtomic: 'aria-atomic',
  ariaBusy: 'aria-busy',
  ariaChecked: 'aria-checked',
  ariaControls: 'aria-controls',
  ariaCurrent: 'aria-current',
  ariaDescribedby: 'aria-describedby',
  ariaDisabled: 'aria-disabled',
  ariaExpanded: 'aria-expanded',
  ariaHaspopup: 'aria-haspopup',
  ariaHidden: 'aria-hidden',
  ariaInvalid: 'aria-invalid',
  ariaLabel: 'aria-label',
  ariaLabelledby: 'aria-labelledby',
  ariaLive: 'aria-live',
  ariaPressed: 'aria-pressed',
  ariaReadonly: 'aria-readonly',
  ariaRequired: 'aria-required',
  ariaSelected: 'aria-selected',
  dataTestid: 'data-testid',
  dataTestId: 'data-testid',
  testId: 'data-testid',
}

const biologicalHierarchyPattern = /\/(molecules|compounds|organelles|cells|layouts)\//

interface InterfaceBody {
  body: PropertyNode[]
}

interface PropertyKey {
  name?: string
  type: string
  value?: string
}

interface PropertyNode {
  key?: PropertyKey
  loc?: unknown
  type: string
}

interface TypeLiteral {
  members: PropertyNode[]
}

const noRenamedHtmlProps = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const filename = context.filename

    if (!biologicalHierarchyPattern.test(filename)) return {}

    const checkProperty = (member: PropertyNode) => {
      if (member.type !== 'TSPropertySignature' && member.type !== 'PropertyDefinition') return
      const key = member.key
      if (!key || key.type !== 'Identifier') return
      const name = key.name
      if (!name) return
      const standard = forbiddenPropMap[name]
      if (!standard) return
      context.report({
        data: { forbidden: name, standard },
        messageId: 'renamed',
        node: member as unknown,
      })
    }

    return {
      TSInterfaceBody(node: InterfaceBody) {
        for (const member of node.body) {
          checkProperty(member)
        }
      },
      TSTypeLiteral(node: TypeLiteral) {
        for (const member of node.members) {
          checkProperty(member)
        }
      },
    }
  },
  meta: {
    docs: {
      description:
        'Molecules/compounds/cells/layouts must use HTML-native prop names via ComponentProps spreading instead of renaming them (Radix/shadcn convention)',
    },
    messages: {
      renamed:
        'Prop "{{forbidden}}" is a renamed HTML attribute. Use the standard HTML attribute name "{{standard}}" via prop spreading. Extend ComponentProps<Element> or Radix primitive props to inherit HTML attributes instead of renaming them.',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default noRenamedHtmlProps
