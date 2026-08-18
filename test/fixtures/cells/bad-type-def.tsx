// Breaches no-type-definitions-in-components: a component .tsx must not declare a
// type/interface — inline the props in the signature, or move shared types to
// features/*/lib/types.ts.
type Label = string

export function BadTypeDef({ label }: { label: Label }) {
  return <button type="button">{label}</button>
}
