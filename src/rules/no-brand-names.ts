import * as fs from 'node:fs'

// A brand-agnostic kit must carry no brand identity in its source —
// identifiers, strings, copy, or comments. Brand identity lives in examples/.
// The brand words to forbid are configured per project via the `brands`
// option; `allow` lists exact substrings (e.g. a demo-asset CDN host) that
// are stripped from each line before the scan, so an allowed URL never trips
// the rule while a bare brand name still does.
//
// With no `brands` configured the rule does nothing.

interface Options {
  allow?: string[]
  brands?: string[]
}

function escapeRegExp(s: string): string {
  return s.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const noBrandNames = {
  create(context: {
    filename: string
    options: [Options?]
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const opts = context.options?.[0] ?? {}
    const brands = opts.brands ?? []
    const allow = opts.allow ?? []
    if (brands.length === 0) return {}

    const brandRe = new RegExp(`\\b(?:${brands.map(escapeRegExp).join('|')})\\b`, 'i')
    const allowRes = allow.map((a) => new RegExp(escapeRegExp(a), 'gi'))

    const filename = context.filename.replaceAll(/\\/g, '/')
    // examples/ is the brand-demo layer — brand names are expected there.
    if (/\/examples\//.test(filename)) return {}

    let programNode: unknown = null
    return {
      Program(node: unknown) {
        programNode = node
      },
      'Program:exit'() {
        let content: string
        try {
          content = fs.readFileSync(filename, 'utf8')
        } catch {
          return
        }
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          let stripped = lines[i]
          for (const re of allowRes) {
            stripped = stripped.replaceAll(re, '')
          }
          const match = stripped.match(brandRe)
          if (match) {
            context.report({
              data: { brand: match[0], line: String(i + 1) },
              messageId: 'brandLeak',
              node: programNode,
            })
            return
          }
        }
      },
    }
  },
  meta: {
    docs: {
      description:
        'No brand identity in brand-agnostic kit source. Configured brand names (in code, copy, or comments) belong in examples/, not in the kit. Substrings listed in the `allow` option (e.g. demo-asset CDN hosts) are exempt.',
    },
    messages: {
      brandLeak:
        'Brand name "{{brand}}" leaked into the kit at line {{line}}. The kit is brand-agnostic — move brand identity to examples/ (substrings in the `allow` option are exempt).',
    },
    schema: [
      {
        additionalProperties: false,
        properties: {
          allow: { items: { type: 'string' as const }, type: 'array' as const },
          brands: { items: { type: 'string' as const }, type: 'array' as const },
        },
        type: 'object' as const,
      },
    ],
    type: 'problem' as const,
  },
}

export default noBrandNames
