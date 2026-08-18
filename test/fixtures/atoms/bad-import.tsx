// Breaches atom-no-deps: atoms are the lowest tier — they must not import from a
// higher level (molecules/compounds/cells/...). Atoms are dependency-free leaves.
import { Field } from '../molecules/field'

export const BadAtom = Field
