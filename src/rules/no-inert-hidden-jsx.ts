// Catches the "dead lint-satisfaction" anti-pattern:
//   <Separator className="hidden" />
// A className of ONLY "hidden" (no other classes) on an element with NO
// Functional attributes is an inert DOM node — permanently invisible AND
// Non-interactive. This is the signature of imports added solely to satisfy
// Must-compose rules with no runtime purpose. Return null or remove.
//
// LEGITIMATE hidden-but-functional elements (not flagged):
//   <Input type="file" className="hidden" onChange={...} />  (behind a label)
//   <button className="hidden" onClick={...} />              (keyboard shortcut trigger)
//   <a href="#top" className="hidden" />                     (skip link)
// These have functional attributes (onChange/onClick/href) that keep the
// Element semantically active even though visually suppressed.

interface JSXAttribute {
  name?: { name?: string; type: string }
  type: string
  value?: { type: string; value?: unknown }
}

interface JSXOpeningElement {
  attributes: JSXAttribute[]
  loc?: unknown
  name: { name?: string; type: string }
  type: 'JSXOpeningElement'
}

// Purely-presentational attribute names. If the element has ONLY these
// (plus className="hidden"), it's inert. Any other attribute — event
// Handler, id, href, type, name, value, ref, etc. — means the element
// Has a functional role and the rule does not fire.
const PURELY_PRESENTATIONAL_ATTRS = new Set([
  'className',
  'data-testid',
  'aria-hidden',
  'role',
  'key',
])

function getAttrName(attr: JSXAttribute): string | null {
  if (attr.type !== 'JSXAttribute') return null
  if (attr.name?.type !== 'JSXIdentifier') return null
  return attr.name.name ?? null
}

const noInertHiddenJsx = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const normalized = context.filename.replaceAll(/\\/g, '/')
    if (/__tests__\//.test(normalized)) return {}

    return {
      JSXOpeningElement(node: JSXOpeningElement) {
        if (node.name?.type !== 'JSXIdentifier') return
        const componentName = node.name.name
        if (!componentName) return

        const attributes = node.attributes ?? []

        const classNameAttr = attributes.find((a) => getAttrName(a) === 'className')
        if (!classNameAttr || !classNameAttr.value) return
        if (classNameAttr.value.type !== 'Literal') return

        const raw = classNameAttr.value.value
        if (typeof raw !== 'string') return
        if (raw.trim() !== 'hidden') return

        // className is exactly "hidden". Now check: are there any FUNCTIONAL
        // attributes? If yes, this is a hidden-but-functional element and we
        // Do not flag it.
        const hasFunctionalAttr = attributes.some((attr) => {
          // Spread attributes (e.g. {...props}) are treated as functional —
          // They may contain handlers/ids the linter cannot statically see.
          if (attr.type === 'JSXSpreadAttribute') return true
          const name = getAttrName(attr)
          if (!name) return false
          return !PURELY_PRESENTATIONAL_ATTRS.has(name)
        })

        if (hasFunctionalAttr) return

        context.report({
          data: { component: componentName },
          messageId: 'inertHiddenRender',
          node: node as unknown,
        })
      },
    }
  },
  meta: {
    docs: {
      description:
        'Forbid JSX elements whose only className is "hidden" AND which have no functional attributes (no event handlers, no id, no href, no type, etc.). Such elements render invisible, non-interactive DOM nodes — the signature of lint-satisfaction imports. Hidden-but-functional elements (file inputs behind labels, skip links, keyboard triggers) are allowed because they have functional attributes.',
    },
    messages: {
      inertHiddenRender:
        '<{{component}} className="hidden" /> renders an inert, permanently-invisible, non-interactive DOM node — the signature of lint-theater. Return null or remove the element. If the element is functional but visually hidden (e.g. file input behind a label), add the functional attribute (onChange, onClick, href, id, type, name, etc.) and the rule will recognize it as a legitimate hidden-but-functional element.',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default noInertHiddenJsx
