// Optional `features/<name>/` prefix so the rule fires on the FLAT kit tiers as
// well as a feature-sliced layout. organelles/ is intentionally excluded — it
// may hold `use-*.ts` hook files.
const BIO_FOLDER_TS_PATTERN =
  /(?:features\/([^/]+)\/)?(atoms|molecules|compounds|cells|tissues|gutenberg|emails|organs)\/[^/]+\.ts$/

const noTsInBioFolders = {
  create(context: {
    filename: string
    report: (descriptor: { data: Record<string, string>; messageId: string; node: unknown }) => void
  }) {
    const normalized = context.filename.replaceAll(/\\/g, '/')
    const match = normalized.match(BIO_FOLDER_TS_PATTERN)
    if (!match) return {}

    const file = normalized.split('/').pop() || ''
    // Allow the barrel (governed by the *-folder-index-is-barrel rules) and the
    // kit's deliberate co-located `<component>.types.ts` convention.
    if (file === 'index.ts' || file.endsWith('.types.ts')) return {}

    const folder = match[2]

    return {
      Program(node: unknown) {
        context.report({
          data: { file, folder },
          messageId: 'tsInBioFolder',
          node: node as unknown,
        })
      },
    }
  },
  meta: {
    docs: {
      description:
        'Pure .ts files must not live in biological component folders (atoms/, molecules/, compounds/, cells/, tissues/, gutenberg/, emails/). Component folders are for .tsx files only. Pure logic and config go in lib/; hooks go in organelles/; stores go in stores/. Exception: co-located `<component>.types.ts` files are allowed.',
    },
    messages: {
      tsInBioFolder:
        '"{{file}}" is a .ts file in {{folder}}/. Only .tsx components (and co-located *.types.ts) belong here. Move pure logic to lib/, hooks to organelles/, stores to stores/.',
    },
    schema: [],
    type: 'problem' as const,
  },
}

export default noTsInBioFolders
